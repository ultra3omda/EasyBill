/**
 * Chatbot controller – HTTP handlers for chatbot API.
 * Authenticates user, resolves company, delegates to parser + service.
 */

import type { Request, Response } from "express";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { appRouter } from "../../routers";
import { createContext } from "../../_core/context";
import { sdk } from "../../_core/sdk";
import * as db from "../../db";
import { parseMessage } from "./chatbot.parser";
import { executeAction } from "./chatbot.service";
import type { ChatbotCaller } from "./chatbot.types";

async function getAuthenticatedUser(req: Request) {
  try {
    return await sdk.authenticateRequest(req);
  } catch {
    return null;
  }
}

async function getCompanyId(req: Request, userId: number): Promise<number | null> {
  const body = req.body as { companyId?: number };
  if (body?.companyId != null) {
    const company = await db.getCompanyById(body.companyId);
    if (company && company.userId === userId) return company.id;
  }
  const companies = await db.getCompaniesByUserId(userId);
  return companies[0]?.id ?? null;
}

/**
 * POST /api/chatbot/message
 * Body: { message: string, companyId?: number }
 */
export async function handleMessage(req: Request, res: Response): Promise<void> {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ intent: "unknown", message: "Non authentifié.", error: "UNAUTHORIZED" });
    return;
  }

  const companyId = await getCompanyId(req, user.id);
  if (companyId == null) {
    res.status(400).json({ intent: "unknown", message: "Aucune entreprise. Créez d’abord une entreprise.", error: "NO_COMPANY" });
    return;
  }

  const message = (req.body?.message ?? req.body?.text ?? "").trim();
  if (!message) {
    res.status(400).json({ intent: "unknown", message: "Le champ « message » est requis.", error: "MISSING_MESSAGE" });
    return;
  }

  try {
    const opts = { req, res, info: {} } as CreateExpressContextOptions;
    const trpcContext = await createContext(opts);
    const caller = appRouter.createCaller(trpcContext) as unknown as ChatbotCaller;
    const parsed = parseMessage(message);
    const response = await executeAction(parsed, { userId: user.id, companyId, caller });
    res.json(response);
  } catch (err) {
    console.error("[Chatbot] handleMessage error", err);
    res.status(500).json({
      intent: "unknown",
      message: "Une erreur est survenue.",
      error: err instanceof Error ? err.message : "INTERNAL_ERROR",
    });
  }
}

/**
 * POST /api/chatbot/command
 * Body: { command: string, companyId?: number }
 * Alias for /message with command as message.
 */
export async function handleCommand(req: Request, res: Response): Promise<void> {
  const command = (req.body?.command ?? req.body?.message ?? "").trim();
  req.body = { ...req.body, message: command };
  return handleMessage(req, res);
}

/**
 * GET /api/chatbot/help
 * Returns list of supported intents and example commands.
 */
export async function handleHelp(_req: Request, res: Response): Promise<void> {
  const help = {
    intents: [
      "create_invoice",
      "create_quote",
      "get_client",
      "list_unpaid_invoices",
      "register_payment",
      "send_payment_reminder",
      "daily_business_summary",
    ],
    examples: [
      "facture 200 ali réparation moteur",
      "devis 500 ahmed installation clim",
      "client ali",
      "factures impayées",
      "ali a payé 200",
      "rappeler ali",
      "rapport aujourd'hui",
    ],
    endpoints: {
      "POST /api/chatbot/message": "Body: { message: string, companyId?: number }",
      "POST /api/chatbot/command": "Body: { command: string, companyId?: number }",
      "GET /api/chatbot/help": "Returns this help",
    },
  };
  res.json(help);
}
