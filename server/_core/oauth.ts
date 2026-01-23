import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import crypto from "crypto";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import { sdk } from "./sdk";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

const GOOGLE_STATE_COOKIE = "google_oauth_state";
const GOOGLE_REDIRECT_COOKIE = "google_oauth_redirect";

function getCookieValue(req: Request, key: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  const parsed = parseCookieHeader(header);
  return parsed[key];
}

function setTempCookie(
  req: Request,
  res: Response,
  key: string,
  value: string,
  maxAgeMs: number
) {
  const options = getSessionCookieOptions(req);
  res.cookie(key, value, { ...options, maxAge: maxAgeMs, sameSite: "lax" });
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });

  app.get("/api/auth/google/start", async (req: Request, res: Response) => {
    if (!ENV.googleClientId || !ENV.googleClientSecret || !ENV.googleRedirectUri) {
      res.status(500).json({ error: "Google OAuth is not configured" });
      return;
    }

    const state = crypto.randomBytes(16).toString("hex");
    const redirect = getQueryParam(req, "redirect") ?? "/dashboard";

    setTempCookie(req, res, GOOGLE_STATE_COOKIE, state, 10 * 60 * 1000);
    setTempCookie(req, res, GOOGLE_REDIRECT_COOKIE, redirect, 10 * 60 * 1000);

    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", ENV.googleClientId);
    url.searchParams.set("redirect_uri", ENV.googleRedirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", state);
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");

    res.redirect(302, url.toString());
  });

  app.get("/api/auth/google/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    if (!ENV.googleClientId || !ENV.googleClientSecret || !ENV.googleRedirectUri) {
      res.status(500).json({ error: "Google OAuth is not configured" });
      return;
    }

    const savedState = getCookieValue(req, GOOGLE_STATE_COOKIE);
    if (!savedState || savedState !== state) {
      res.status(400).json({ error: "invalid oauth state" });
      return;
    }

    try {
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: ENV.googleClientId,
          client_secret: ENV.googleClientSecret,
          redirect_uri: ENV.googleRedirectUri,
          grant_type: "authorization_code",
        }),
      });

      if (!tokenResponse.ok) {
        const errorBody = await tokenResponse.text();
        console.error("[OAuth] Google token exchange failed", errorBody);
        res.status(500).json({ error: "Google token exchange failed" });
        return;
      }

      const tokenData = (await tokenResponse.json()) as {
        access_token?: string;
        id_token?: string;
      };

      if (!tokenData.access_token) {
        res.status(500).json({ error: "Google access token missing" });
        return;
      }

      const userInfoResponse = await fetch(
        "https://openidconnect.googleapis.com/v1/userinfo",
        {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        }
      );

      if (!userInfoResponse.ok) {
        const errorBody = await userInfoResponse.text();
        console.error("[OAuth] Google userinfo failed", errorBody);
        res.status(500).json({ error: "Google userinfo failed" });
        return;
      }

      const userInfo = (await userInfoResponse.json()) as {
        sub?: string;
        email?: string;
        name?: string;
        given_name?: string;
      };

      if (!userInfo.sub) {
        res.status(500).json({ error: "Google user id missing" });
        return;
      }

      const openId = `google:${userInfo.sub}`;
      const name = userInfo.name || userInfo.given_name || "";

      await db.upsertUser({
        openId,
        name: name || null,
        email: userInfo.email ?? null,
        loginMethod: "google",
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(openId, {
        name,
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.cookie(GOOGLE_STATE_COOKIE, "", { ...cookieOptions, maxAge: 0 });

      const redirect = getCookieValue(req, GOOGLE_REDIRECT_COOKIE) ?? "/dashboard";
      res.cookie(GOOGLE_REDIRECT_COOKIE, "", { ...cookieOptions, maxAge: 0 });
      res.redirect(302, redirect);
    } catch (error) {
      console.error("[OAuth] Google callback failed", error);
      res.status(500).json({ error: "Google OAuth callback failed" });
    }
  });

  if (process.env.NODE_ENV === "development" && process.env.DEV_LOGIN_ENABLED === "true") {
    app.get("/api/dev/login", async (req: Request, res: Response) => {
      const email = getQueryParam(req, "email") ?? "dev@example.com";
      const name = getQueryParam(req, "name") ?? "Dev User";
      const openId = `dev:${email}`;

      await db.upsertUser({
        openId,
        name,
        email,
        loginMethod: "dev",
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(openId, {
        name,
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/dashboard");
    });
  }
}
