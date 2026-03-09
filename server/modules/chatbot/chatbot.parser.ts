/**
 * Chatbot parser – parse user message and detect intent + payload.
 * Rule-based (no ML) for predictable behavior and easy extension.
 */

import type { ChatbotIntent } from "./chatbot.types";
import type { ParsedCommand } from "./chatbot.types";

/** Normalize: trim, collapse spaces, lowercase for matching */
function normalize(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Extract amount (number, optional decimals) from string */
function extractAmount(text: string): number | null {
  const match = text.replace(/,/g, ".").match(/(\d+(?:[.,]\d+)?)/);
  return match ? parseFloat(match[1]) : null;
}

/**
 * Parse "facture 200 ali réparation moteur" -> create_invoice, { amount: 200, customerName: "ali", description: "réparation moteur" }
 * Also: "facture ali 200 réparation" (amount after name)
 */
function parseCreateInvoice(text: string): ParsedCommand | null {
  const t = normalize(text);
  if (!/\bfacture\b/.test(t)) return null;

  const withoutFacture = t.replace(/^\s*facture\s*/i, "").trim();
  const parts = withoutFacture.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;

  let amount: number | null = null;
  let customerName = "";
  const rest: string[] = [];

  for (const p of parts) {
    const num = extractAmount(p);
    if (num !== null && amount === null) {
      amount = num;
    } else if (!customerName && isNaN(Number(p))) {
      customerName = p;
    } else if (customerName) {
      rest.push(p);
    }
  }
  if (!customerName) {
    customerName = parts.find(x => isNaN(Number(x))) || "";
    rest.push(...parts.filter(x => x !== customerName && isNaN(Number(x))));
  }

  return {
    intent: "create_invoice",
    payload: {
      amount: amount ?? 0,
      customerName: customerName || rest[0] || "",
      description: rest.filter(x => x !== customerName).join(" ") || "Facture",
    },
    raw: text,
  };
}

/**
 * Parse "devis 500 ahmed installation clim" -> create_quote
 */
function parseCreateQuote(text: string): ParsedCommand | null {
  const t = normalize(text);
  if (!/\bdevis\b/.test(t)) return null;

  const withoutDevis = t.replace(/^\s*devis\s*/i, "").trim();
  const parts = withoutDevis.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;

  let amount: number | null = null;
  let customerName = "";
  const rest: string[] = [];

  for (const p of parts) {
    const num = extractAmount(p);
    if (num !== null && amount === null) amount = num;
    else if (!customerName && isNaN(Number(p))) customerName = p;
    else if (customerName) rest.push(p);
  }
  if (!customerName) {
    customerName = parts.find(x => isNaN(Number(x))) || "";
    rest.push(...parts.filter(x => x !== customerName && isNaN(Number(x))));
  }

  return {
    intent: "create_quote",
    payload: {
      amount: amount ?? 0,
      customerName: customerName || rest[0] || "",
      description: rest.filter(x => x !== customerName).join(" ") || "Devis",
    },
    raw: text,
  };
}

/**
 * Parse "client ali" -> get_client
 */
function parseGetClient(text: string): ParsedCommand | null {
  const t = normalize(text);
  const match = t.match(/^\s*client\s+(.+)$/);
  if (!match) return null;
  const name = match[1].trim();
  if (!name) return null;
  return { intent: "get_client", payload: { customerName: name }, raw: text };
}

/**
 * Parse "factures impayées" / "liste factures impayées"
 */
function parseListUnpaidInvoices(text: string): ParsedCommand | null {
  const t = normalize(text);
  if (/\b(impayées?|non\s*payées?|en\s*attente)\b/.test(t) && /\bfactures?\b/.test(t)) {
    return { intent: "list_unpaid_invoices", payload: {}, raw: text };
  }
  if (/factures?\s*impayées?/.test(t) || /liste\s*factures?/.test(t)) {
    return { intent: "list_unpaid_invoices", payload: {}, raw: text };
  }
  return null;
}

/**
 * Parse "ali a payé 200" / "paiement ali 200"
 */
function parseRegisterPayment(text: string): ParsedCommand | null {
  const t = normalize(text);
  // "ali a payé 200" -> name before "a payé" or "payé", amount after
  const payMatch = t.match(/(.+?)\s+(?:a\s+)?payé\s*(\d+(?:[.,]\d+)?)/i);
  if (payMatch) {
    const customerName = payMatch[1].trim().replace(/\s+/g, " ");
    const amount = parseFloat(payMatch[2].replace(/,/g, "."));
    if (customerName && amount > 0) {
      return { intent: "register_payment", payload: { customerName, amount }, raw: text };
    }
  }
  const amountMatch = t.match(/(\d+(?:[.,]\d+)?)/);
  const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, ".")) : null;
  if (amount == null || amount <= 0) return null;
  const rest = t.replace(/\d+(?:[.,]\d+)?/g, "").replace(/\b(payé|payee|paiement)\b/gi, "").trim();
  const customerName = rest.split(/\s+/).filter(Boolean)[0] || "";
  if (/\b(payé|paiement)\b/.test(t) && customerName) {
    return { intent: "register_payment", payload: { customerName, amount }, raw: text };
  }
  return null;
}

/**
 * Parse "rappeler ali" / "envoyer rappel ali"
 */
function parseSendReminder(text: string): ParsedCommand | null {
  const t = normalize(text);
  if (!/\b(rappeler?|rappel|relance)\b/.test(t)) return null;
  const nameMatch = t.replace(/^(rappeler?|rappel|relance)\s*/i, "").trim();
  const customerName = nameMatch || t.split(/\s+/).filter(x => !/rappeler?|rappel|relance/i.test(x)).join(" ");
  if (!customerName) return null;
  return { intent: "send_payment_reminder", payload: { customerName: customerName.trim() }, raw: text };
}

/**
 * Parse "rapport aujourd'hui" / "résumé du jour" / "daily summary"
 */
function parseDailySummary(text: string): ParsedCommand | null {
  const t = normalize(text);
  if (/\b(rapport|résumé|resume|summary)\b/.test(t) && /\b(aujourd'hui|jour|du\s*jour|today|daily)\b/.test(t)) {
    return { intent: "daily_business_summary", payload: {}, raw: text };
  }
  if (/^(rapport|résumé)\s*$/.test(t)) {
    return { intent: "daily_business_summary", payload: {}, raw: text };
  }
  return null;
}

/**
 * Parse message and return intent + payload.
 * Order of parsers matters (more specific first).
 */
export function parseMessage(message: string): ParsedCommand {
  const trimmed = (message || "").trim();
  if (!trimmed) {
    return { intent: "unknown", payload: {}, raw: "" };
  }

  const parsers: Array<(text: string) => ParsedCommand | null> = [
    parseCreateInvoice,
    parseCreateQuote,
    parseGetClient,
    parseListUnpaidInvoices,
    parseRegisterPayment,
    parseSendReminder,
    parseDailySummary,
  ];

  for (const parse of parsers) {
    const result = parse(trimmed);
    if (result) return result;
  }

  return { intent: "unknown", payload: { rawMessage: trimmed }, raw: trimmed };
}
