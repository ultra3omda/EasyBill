/**
 * Chatbot service – execute actions by reusing existing ERP logic (db + tRPC caller).
 * No duplication of business rules: invoices, quotes, payments go through the same procedures.
 */

import * as db from "../../db";
import type { ParsedCommand, ChatbotResponse, ChatbotContext } from "./chatbot.types";

function buildItem(amount: number, description: string) {
  return {
    description: description || "Prestation",
    quantity: "1",
    unit: "unité",
    unitPrice: String(amount),
    vatRate: "19.00",
    fodecRate: "0.00",
    consumptionTaxRate: "0.00",
    discount: "0",
    discountType: "fixed" as const,
  };
}

function toDate(d: Date): Date {
  return d instanceof Date ? d : new Date(d);
}

export async function executeAction(
  parsed: ParsedCommand,
  ctx: ChatbotContext
): Promise<ChatbotResponse> {
  const { companyId, caller } = ctx;

  switch (parsed.intent) {
    case "create_invoice": {
      const amount = Number(parsed.payload.amount) || 0;
      const customerName = String(parsed.payload.customerName || "").trim();
      const description = String(parsed.payload.description || "Facture").trim();
      if (!customerName) {
        return { intent: "create_invoice", message: "Précisez le nom du client.", error: "MISSING_CUSTOMER" };
      }
      const clients = await db.getClientsByCompanyId(companyId, customerName);
      const client = clients[0];
      if (!client) {
        return { intent: "create_invoice", message: `Aucun client trouvé pour "${customerName}".`, error: "CLIENT_NOT_FOUND" };
      }
      const now = new Date();
      const due = new Date(now);
      due.setDate(due.getDate() + 30);
      const result = await caller.invoice.create({
        companyId,
        clientId: client.id,
        issueDate: now,
        dueDate: due,
        items: [buildItem(amount, description)],
        includeFiscalStamp: true,
      });
      return {
        intent: "create_invoice",
        message: `Facture ${result.invoiceNumber} créée pour ${client.name} (${amount} TND).`,
        data: { invoiceId: result.id, invoiceNumber: result.invoiceNumber, clientName: client.name },
      };
    }

    case "create_quote": {
      const amount = Number(parsed.payload.amount) || 0;
      const customerName = String(parsed.payload.customerName || "").trim();
      const description = String(parsed.payload.description || "Devis").trim();
      if (!customerName) {
        return { intent: "create_quote", message: "Précisez le nom du client.", error: "MISSING_CUSTOMER" };
      }
      const clients = await db.getClientsByCompanyId(companyId, customerName);
      const client = clients[0];
      if (!client) {
        return { intent: "create_quote", message: `Aucun client trouvé pour "${customerName}".`, error: "CLIENT_NOT_FOUND" };
      }
      const now = new Date();
      const validUntil = new Date(now);
      validUntil.setDate(validUntil.getDate() + 30);
      const result = await caller.quote.create({
        companyId,
        clientId: client.id,
        issueDate: now,
        validUntil,
        items: [buildItem(amount, description)],
        includeFiscalStamp: true,
      });
      return {
        intent: "create_quote",
        message: `Devis ${result.quoteNumber} créé pour ${client.name} (${amount} TND).`,
        data: { quoteId: result.id, quoteNumber: result.quoteNumber, clientName: client.name },
      };
    }

    case "get_client": {
      const customerName = String(parsed.payload.customerName || "").trim();
      if (!customerName) {
        return { intent: "get_client", message: "Précisez le nom du client.", error: "MISSING_CUSTOMER" };
      }
      const clients = await db.getClientsByCompanyId(companyId, customerName);
      const client = clients[0];
      if (!client) {
        return { intent: "get_client", message: `Aucun client trouvé pour "${customerName}".`, error: "CLIENT_NOT_FOUND" };
      }
      return {
        intent: "get_client",
        message: `Client : ${client.name}${client.email ? ` – ${client.email}` : ""}${client.phone ? ` – ${client.phone}` : ""}.`,
        data: { id: client.id, name: client.name, email: client.email, phone: client.phone, address: client.address },
      };
    }

    case "list_unpaid_invoices": {
      const invoices = await db.getInvoicesByCompanyId(companyId, {
        status: "sent",
        startDate: undefined,
        endDate: undefined,
        clientId: undefined,
      });
      const unpaid = invoices.filter(
        (inv) => parseFloat(inv.amountDue) > 0 && ["sent", "partial", "overdue"].includes(inv.status)
      );
      const totalDue = unpaid.reduce((s, inv) => s + parseFloat(inv.amountDue), 0);
      const list = unpaid.slice(0, 10).map((inv) => `${inv.invoiceNumber}: ${inv.amountDue} TND`);
      const message =
        unpaid.length === 0
          ? "Aucune facture impayée."
          : `${unpaid.length} facture(s) impayée(s) (total: ${totalDue.toFixed(3)} TND). ${list.join(" ; ")}${unpaid.length > 10 ? "…" : ""}`;
      return {
        intent: "list_unpaid_invoices",
        message,
        data: { count: unpaid.length, totalDue: totalDue.toFixed(3), invoices: unpaid.slice(0, 20) },
      };
    }

    case "register_payment": {
      const amount = Number(parsed.payload.amount) || 0;
      const customerName = String(parsed.payload.customerName || "").trim();
      if (!customerName || amount <= 0) {
        return { intent: "register_payment", message: "Précisez le client et le montant.", error: "INVALID_INPUT" };
      }
      const clients = await db.getClientsByCompanyId(companyId, customerName);
      const client = clients[0];
      if (!client) {
        return { intent: "register_payment", message: `Aucun client trouvé pour "${customerName}".`, error: "CLIENT_NOT_FOUND" };
      }
      const companyInvoices = await db.getInvoicesByCompanyId(companyId, { clientId: client.id });
      const unpaidInvoices = companyInvoices
        .filter((inv) => parseFloat(inv.amountDue) > 0 && inv.status !== "cancelled")
        .sort((a, b) => toDate(a.dueDate).getTime() - toDate(b.dueDate).getTime());
      const invoice = unpaidInvoices[0];
      if (!invoice) {
        return { intent: "register_payment", message: `Aucune facture impayée pour ${client.name}.`, error: "NO_UNPAID_INVOICE" };
      }
      await caller.payment.create({
        companyId,
        invoiceId: invoice.id,
        amount: String(amount),
        paymentDate: new Date(),
        paymentMethod: "bank_transfer",
        notes: "Enregistré via assistant conversationnel",
      });
      return {
        intent: "register_payment",
        message: `Paiement de ${amount} TND enregistré pour ${client.name} (facture ${invoice.invoiceNumber}).`,
        data: { clientName: client.name, invoiceNumber: invoice.invoiceNumber, amount },
      };
    }

    case "send_payment_reminder": {
      const customerName = String(parsed.payload.customerName || "").trim();
      if (!customerName) {
        return { intent: "send_payment_reminder", message: "Précisez le client à rappeler.", error: "MISSING_CUSTOMER" };
      }
      const clients = await db.getClientsByCompanyId(companyId, customerName);
      const client = clients[0];
      if (!client) {
        return { intent: "send_payment_reminder", message: `Aucun client trouvé pour "${customerName}".`, error: "CLIENT_NOT_FOUND" };
      }
      const companyInvoices = await db.getInvoicesByCompanyId(companyId, { clientId: client.id });
      const unpaid = companyInvoices.filter(
        (inv) => parseFloat(inv.amountDue) > 0 && ["sent", "partial", "overdue"].includes(inv.status)
      );
      if (unpaid.length === 0) {
        return { intent: "send_payment_reminder", message: `Aucune facture impayée pour ${client.name}.`, error: "NO_UNPAID_INVOICE" };
      }
      const reminderCount = (unpaid[0].reminderCount ?? 0) + 1;
      await db.updateInvoice(unpaid[0].id, {
        lastReminderAt: new Date(),
        reminderCount,
      });
      return {
        intent: "send_payment_reminder",
        message: `Rappel enregistré pour ${client.name} (facture ${unpaid[0].invoiceNumber}).`,
        data: { clientName: client.name, invoiceNumber: unpaid[0].invoiceNumber, reminderCount },
      };
    }

    case "daily_business_summary": {
      const stats = await db.getDashboardStats(companyId);
      if (!stats) {
        return { intent: "daily_business_summary", message: "Impossible de charger le rapport.", error: "STATS_ERROR" };
      }
      const message = [
        `Rapport du jour – CA du mois: ${stats.monthlyRevenue} TND, CA de l'année: ${stats.yearlyRevenue} TND.`,
        `En attente: ${stats.pendingCount} facture(s), ${stats.pendingAmount} TND.`,
        `En retard: ${stats.overdueCount} facture(s), ${stats.overdueAmount} TND.`,
        `Clients: ${stats.clientCount}, Produits: ${stats.productCount}.`,
      ].join(" ");
      return {
        intent: "daily_business_summary",
        message,
        data: stats,
      };
    }

    default:
      return {
        intent: "unknown",
        message: "Commande non reconnue. Essayez : « facture 200 ali réparation », « devis 500 ahmed installation », « client ali », « factures impayées », « ali a payé 200 », « rappeler ali », « rapport aujourd'hui ».",
        error: "UNKNOWN_INTENT",
      };
  }
}
