/**
 * Chatbot module – types and response format.
 * Designed to be compatible with conversational UIs and later WhatsApp/Messenger.
 */

export const CHATBOT_INTENTS = [
  "create_invoice",
  "create_quote",
  "get_client",
  "list_unpaid_invoices",
  "register_payment",
  "send_payment_reminder",
  "daily_business_summary",
  "unknown",
] as const;

export type ChatbotIntent = (typeof CHATBOT_INTENTS)[number];

/** Parsed result from chatbot.parser */
export interface ParsedCommand {
  intent: ChatbotIntent;
  /** Intent-specific payload (e.g. amount, customerName, description) */
  payload: Record<string, unknown>;
  /** Raw normalized text for logging */
  raw: string;
}

/** Standard API response format */
export interface ChatbotResponse<T = unknown> {
  intent: ChatbotIntent;
  message: string;
  data?: T;
  /** Optional error code for client handling */
  error?: string;
}

/** Minimal tRPC caller interface used by chatbot (reuse of existing ERP procedures) */
export interface ChatbotCaller {
  invoice: {
    create: (input: {
      companyId: number;
      clientId: number;
      issueDate: Date;
      dueDate: Date;
      items: Array<{
        description: string;
        quantity: string;
        unit?: string;
        unitPrice: string;
        vatRate?: string;
        fodecRate?: string;
        consumptionTaxRate?: string;
        discount?: string;
        discountType?: "percentage" | "fixed";
      }>;
      notes?: string;
      termsAndConditions?: string;
      discount?: string;
      discountType?: "percentage" | "fixed";
      includeFiscalStamp?: boolean;
    }) => Promise<{ id: number; invoiceNumber: string }>;
  };
  quote: {
    create: (input: {
      companyId: number;
      clientId: number;
      issueDate: Date;
      validUntil: Date;
      items: Array<{
        description: string;
        quantity: string;
        unit?: string;
        unitPrice: string;
        vatRate?: string;
        fodecRate?: string;
        consumptionTaxRate?: string;
        discount?: string;
        discountType?: "percentage" | "fixed";
      }>;
      notes?: string;
      termsAndConditions?: string;
      discount?: string;
      discountType?: "percentage" | "fixed";
      includeFiscalStamp?: boolean;
    }) => Promise<{ id: number; quoteNumber: string }>;
  };
  payment: {
    create: (input: {
      companyId: number;
      invoiceId: number;
      amount: string;
      paymentDate: Date;
      paymentMethod?: "cash" | "check" | "bank_transfer" | "card" | "other";
      reference?: string;
      notes?: string;
    }) => Promise<{ id: number }>;
  };
}

/** Context passed to the chatbot service (user + company + tRPC caller) */
export interface ChatbotContext {
  userId: number;
  companyId: number;
  caller: ChatbotCaller;
}
