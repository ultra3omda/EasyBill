import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "./db";

// Tunisian Tax ID validation regex: 0000000/L/A/M/000
const taxIdRegex = /^\d{7}\/[A-Z]\/[A-Z]\/[A-Z]\/\d{3}$/;

// ==================== VALIDATION SCHEMAS ====================
const companySchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  legalForm: z.string().optional(),
  taxId: z.string().regex(taxIdRegex, "Format matricule fiscal invalide (0000000/L/A/M/000)").optional().or(z.literal("")),
  address: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().default("Tunisie"),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  website: z.string().optional(),
  logoUrl: z.string().optional(),
  primaryColor: z.string().optional(),
  accountingPeriodStart: z.date().optional(),
  accountingPeriodEnd: z.date().optional(),
  currency: z.string().default("TND"),
  invoicePrefix: z.string().default("FAC"),
  quotePrefix: z.string().default("DEV"),
  defaultVatRate: z.string().default("19.00"),
  bankName: z.string().optional(),
  bankIban: z.string().optional(),
  bankBic: z.string().optional(),
});

const clientSchema = z.object({
  companyId: z.number(),
  type: z.enum(["individual", "company"]).default("company"),
  name: z.string().min(1, "Le nom est requis"),
  taxId: z.string().optional(),
  contactName: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().default("Tunisie"),
  paymentTermDays: z.number().default(30),
  category: z.string().optional(),
  notes: z.string().optional(),
});

const supplierSchema = z.object({
  companyId: z.number(),
  name: z.string().min(1, "Le nom est requis"),
  taxId: z.string().optional(),
  contactName: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().default("Tunisie"),
  paymentTermDays: z.number().default(30),
  category: z.string().optional(),
  bankName: z.string().optional(),
  bankIban: z.string().optional(),
  notes: z.string().optional(),
});

const productSchema = z.object({
  companyId: z.number(),
  categoryId: z.number().optional(),
  type: z.enum(["product", "service"]).default("product"),
  name: z.string().min(1, "Le nom est requis"),
  description: z.string().optional(),
  reference: z.string().optional(),
  barcode: z.string().optional(),
  unitPrice: z.string(),
  unit: z.string().default("unité"),
  vatRate: z.string().default("19.00"),
  fodecRate: z.string().default("0.00"),
  consumptionTaxRate: z.string().default("0.00"),
  trackStock: z.boolean().default(false),
  stockQuantity: z.string().default("0"),
  minStockLevel: z.string().default("0"),
  costPrice: z.string().optional(),
});

const invoiceItemSchema = z.object({
  productId: z.number().optional(),
  description: z.string().min(1),
  quantity: z.string(),
  unit: z.string().default("unité"),
  unitPrice: z.string(),
  vatRate: z.string().default("19.00"),
  fodecRate: z.string().default("0.00"),
  consumptionTaxRate: z.string().default("0.00"),
  discount: z.string().default("0"),
  discountType: z.enum(["percentage", "fixed"]).default("fixed"),
});

const invoiceSchema = z.object({
  companyId: z.number(),
  clientId: z.number(),
  issueDate: z.date(),
  dueDate: z.date(),
  items: z.array(invoiceItemSchema).min(1, "Au moins un article est requis"),
  notes: z.string().optional(),
  termsAndConditions: z.string().optional(),
  discount: z.string().default("0"),
  discountType: z.enum(["percentage", "fixed"]).default("fixed"),
  includeFiscalStamp: z.boolean().default(true),
});

const quoteSchema = z.object({
  companyId: z.number(),
  clientId: z.number(),
  issueDate: z.date(),
  validUntil: z.date(),
  items: z.array(invoiceItemSchema).min(1, "Au moins un article est requis"),
  notes: z.string().optional(),
  termsAndConditions: z.string().optional(),
  discount: z.string().default("0"),
  discountType: z.enum(["percentage", "fixed"]).default("fixed"),
  includeFiscalStamp: z.boolean().default(true),
});

const paymentSchema = z.object({
  companyId: z.number(),
  invoiceId: z.number(),
  amount: z.string(),
  paymentDate: z.date(),
  paymentMethod: z.enum(["cash", "check", "bank_transfer", "card", "other"]).default("bank_transfer"),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

// ==================== HELPER FUNCTIONS ====================
function calculateItemTotals(item: z.infer<typeof invoiceItemSchema>) {
  const qty = parseFloat(item.quantity);
  const price = parseFloat(item.unitPrice);
  const vatRate = parseFloat(item.vatRate);
  const fodecRate = parseFloat(item.fodecRate);
  const consumptionTaxRate = parseFloat(item.consumptionTaxRate);
  const discount = parseFloat(item.discount);

  let subtotal = qty * price;
  if (item.discountType === "percentage") {
    subtotal = subtotal * (1 - discount / 100);
  } else {
    subtotal = subtotal - discount;
  }

  const vatAmount = subtotal * (vatRate / 100);
  const fodecAmount = subtotal * (fodecRate / 100);
  const consumptionTaxAmount = subtotal * (consumptionTaxRate / 100);
  const total = subtotal + vatAmount + fodecAmount + consumptionTaxAmount;

  return {
    subtotal: subtotal.toFixed(3),
    vatAmount: vatAmount.toFixed(3),
    fodecAmount: fodecAmount.toFixed(3),
    consumptionTaxAmount: consumptionTaxAmount.toFixed(3),
    total: total.toFixed(3),
  };
}

function calculateInvoiceTotals(items: z.infer<typeof invoiceItemSchema>[], discount: string, discountType: "percentage" | "fixed", includeFiscalStamp: boolean) {
  let subtotal = 0;
  let totalVat = 0;
  let totalFodec = 0;
  let totalConsumptionTax = 0;

  items.forEach(item => {
    const totals = calculateItemTotals(item);
    subtotal += parseFloat(totals.subtotal);
    totalVat += parseFloat(totals.vatAmount);
    totalFodec += parseFloat(totals.fodecAmount);
    totalConsumptionTax += parseFloat(totals.consumptionTaxAmount);
  });

  let totalDiscount = 0;
  if (discountType === "percentage") {
    totalDiscount = subtotal * (parseFloat(discount) / 100);
  } else {
    totalDiscount = parseFloat(discount);
  }

  const fiscalStamp = includeFiscalStamp ? 0.6 : 0;
  const total = subtotal - totalDiscount + totalVat + totalFodec + totalConsumptionTax + fiscalStamp;

  return {
    subtotal: subtotal.toFixed(3),
    totalVat: totalVat.toFixed(3),
    totalFodec: totalFodec.toFixed(3),
    totalConsumptionTax: totalConsumptionTax.toFixed(3),
    fiscalStamp: fiscalStamp.toFixed(3),
    discount: totalDiscount.toFixed(3),
    total: total.toFixed(3),
  };
}

// ==================== ROUTERS ====================
export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ==================== COMPANY ROUTES ====================
  company: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getCompaniesByUserId(ctx.user.id);
    }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const company = await db.getCompanyById(input.id);
        if (!company || company.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Entreprise non trouvée" });
        }
        return company;
      }),

    create: protectedProcedure
      .input(companySchema)
      .mutation(async ({ ctx, input }) => {
        const id = await db.createCompany({ ...input, userId: ctx.user.id });
        return { id };
      }),

    update: protectedProcedure
      .input(z.object({ id: z.number(), data: companySchema.partial() }))
      .mutation(async ({ ctx, input }) => {
        const company = await db.getCompanyById(input.id);
        if (!company || company.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Entreprise non trouvée" });
        }
        await db.updateCompany(input.id, input.data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const company = await db.getCompanyById(input.id);
        if (!company || company.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Entreprise non trouvée" });
        }
        await db.deleteCompany(input.id);
        return { success: true };
      }),
  }),

  // ==================== CLIENT ROUTES ====================
  customers: router({
    list: protectedProcedure
      .input(z.object({ companyId: z.number(), search: z.string().optional() }))
      .query(async ({ ctx, input }) => {
        const company = await db.getCompanyById(input.companyId);
        if (!company || company.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        return db.getClientsByCompanyId(input.companyId, input.search);
      }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const client = await db.getClientById(input.id);
        if (!client) throw new TRPCError({ code: "NOT_FOUND" });
        const company = await db.getCompanyById(client.companyId);
        if (!company || company.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        return client;
      }),

    create: protectedProcedure
      .input(clientSchema)
      .mutation(async ({ ctx, input }) => {
        const company = await db.getCompanyById(input.companyId);
        if (!company || company.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        // Check quota for free plan
        const user = await db.getUserById(ctx.user.id);
        if (user && user.subscriptionPlan === "free" && user.clientUsed >= user.clientQuota) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Quota de clients atteint. Passez au plan Premium." });
        }
        const id = await db.createClient(input);
        if (user && user.subscriptionPlan === "free") {
          await db.incrementUserQuota(ctx.user.id, "client");
        }
        return { id };
      }),

    update: protectedProcedure
      .input(z.object({ id: z.number(), data: clientSchema.partial() }))
      .mutation(async ({ ctx, input }) => {
        const client = await db.getClientById(input.id);
        if (!client) throw new TRPCError({ code: "NOT_FOUND" });
        const company = await db.getCompanyById(client.companyId);
        if (!company || company.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        await db.updateClient(input.id, input.data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const client = await db.getClientById(input.id);
        if (!client) throw new TRPCError({ code: "NOT_FOUND" });
        const company = await db.getCompanyById(client.companyId);
        if (!company || company.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        await db.deleteClient(input.id);
        return { success: true };
      }),
  }),

  // ==================== SUPPLIER ROUTES ====================
  supplier: router({
    list: protectedProcedure
      .input(z.object({ companyId: z.number() }))
      .query(async ({ ctx, input }) => {
        const company = await db.getCompanyById(input.companyId);
        if (!company || company.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        return db.getSuppliersByCompanyId(input.companyId);
      }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const supplier = await db.getSupplierById(input.id);
        if (!supplier) throw new TRPCError({ code: "NOT_FOUND" });
        const company = await db.getCompanyById(supplier.companyId);
        if (!company || company.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        return supplier;
      }),

    create: protectedProcedure
      .input(supplierSchema)
      .mutation(async ({ ctx, input }) => {
        const company = await db.getCompanyById(input.companyId);
        if (!company || company.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        const id = await db.createSupplier(input);
        return { id };
      }),

    update: protectedProcedure
      .input(z.object({ id: z.number(), data: supplierSchema.partial() }))
      .mutation(async ({ ctx, input }) => {
        const supplier = await db.getSupplierById(input.id);
        if (!supplier) throw new TRPCError({ code: "NOT_FOUND" });
        const company = await db.getCompanyById(supplier.companyId);
        if (!company || company.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        await db.updateSupplier(input.id, input.data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const supplier = await db.getSupplierById(input.id);
        if (!supplier) throw new TRPCError({ code: "NOT_FOUND" });
        const company = await db.getCompanyById(supplier.companyId);
        if (!company || company.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        await db.deleteSupplier(input.id);
        return { success: true };
      }),
  }),

  // ==================== PRODUCT ROUTES ====================
  product: router({
    list: protectedProcedure
      .input(z.object({ companyId: z.number(), search: z.string().optional() }))
      .query(async ({ ctx, input }) => {
        const company = await db.getCompanyById(input.companyId);
        if (!company || company.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        return db.getProductsByCompanyId(input.companyId, input.search);
      }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const product = await db.getProductById(input.id);
        if (!product) throw new TRPCError({ code: "NOT_FOUND" });
        const company = await db.getCompanyById(product.companyId);
        if (!company || company.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        return product;
      }),

    create: protectedProcedure
      .input(productSchema)
      .mutation(async ({ ctx, input }) => {
        const company = await db.getCompanyById(input.companyId);
        if (!company || company.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        const id = await db.createProduct(input);
        return { id };
      }),

    update: protectedProcedure
      .input(z.object({ id: z.number(), data: productSchema.partial() }))
      .mutation(async ({ ctx, input }) => {
        const product = await db.getProductById(input.id);
        if (!product) throw new TRPCError({ code: "NOT_FOUND" });
        const company = await db.getCompanyById(product.companyId);
        if (!company || company.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        await db.updateProduct(input.id, input.data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const product = await db.getProductById(input.id);
        if (!product) throw new TRPCError({ code: "NOT_FOUND" });
        const company = await db.getCompanyById(product.companyId);
        if (!company || company.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        await db.deleteProduct(input.id);
        return { success: true };
      }),

    categories: protectedProcedure
      .input(z.object({ companyId: z.number() }))
      .query(async ({ ctx, input }) => {
        const company = await db.getCompanyById(input.companyId);
        if (!company || company.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        return db.getCategoriesByCompanyId(input.companyId);
      }),

    createCategory: protectedProcedure
      .input(z.object({ companyId: z.number(), name: z.string(), description: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const company = await db.getCompanyById(input.companyId);
        if (!company || company.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        const id = await db.createProductCategory(input);
        return { id };
      }),
  }),

  // ==================== INVOICE ROUTES ====================
  invoice: router({
    list: protectedProcedure
      .input(z.object({
        companyId: z.number(),
        status: z.string().optional(),
        clientId: z.number().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }))
      .query(async ({ ctx, input }) => {
        const company = await db.getCompanyById(input.companyId);
        if (!company || company.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        return db.getInvoicesByCompanyId(input.companyId, input);
      }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const invoice = await db.getInvoiceById(input.id);
        if (!invoice) throw new TRPCError({ code: "NOT_FOUND" });
        const company = await db.getCompanyById(invoice.companyId);
        if (!company || company.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        const items = await db.getInvoiceItemsByInvoiceId(input.id);
        const client = await db.getClientById(invoice.clientId);
        const payments = await db.getPaymentsByInvoiceId(input.id);
        return { ...invoice, items, client, payments };
      }),

    create: protectedProcedure
      .input(invoiceSchema)
      .mutation(async ({ ctx, input }) => {
        const company = await db.getCompanyById(input.companyId);
        if (!company || company.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        // Check quota
        const user = await db.getUserById(ctx.user.id);
        if (user && user.subscriptionPlan === "free" && user.invoiceUsed >= user.invoiceQuota) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Quota de factures atteint. Passez au plan Premium." });
        }

        // Generate invoice number
        const { prefix, number } = await db.getNextInvoiceNumber(input.companyId);
        const year = new Date().getFullYear();
        const invoiceNumber = `${prefix}-${year}-${String(number).padStart(5, "0")}`;

        // Calculate totals
        const totals = calculateInvoiceTotals(input.items, input.discount, input.discountType, input.includeFiscalStamp);

        // Create invoice
        const invoiceId = await db.createInvoice({
          companyId: input.companyId,
          clientId: input.clientId,
          invoiceNumber,
          issueDate: input.issueDate,
          dueDate: input.dueDate,
          status: "draft",
          subtotal: totals.subtotal,
          totalVat: totals.totalVat,
          totalFodec: totals.totalFodec,
          totalConsumptionTax: totals.totalConsumptionTax,
          fiscalStamp: totals.fiscalStamp,
          discount: totals.discount,
          discountType: input.discountType,
          total: totals.total,
          amountPaid: "0",
          amountDue: totals.total,
          currency: "TND",
          notes: input.notes,
          termsAndConditions: input.termsAndConditions,
        });

        // Create invoice items
        const invoiceItems = input.items.map((item, index) => {
          const itemTotals = calculateItemTotals(item);
          return {
            invoiceId,
            productId: item.productId,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice,
            vatRate: item.vatRate,
            vatAmount: itemTotals.vatAmount,
            fodecRate: item.fodecRate,
            fodecAmount: itemTotals.fodecAmount,
            consumptionTaxRate: item.consumptionTaxRate,
            consumptionTaxAmount: itemTotals.consumptionTaxAmount,
            discount: item.discount,
            discountType: item.discountType,
            subtotal: itemTotals.subtotal,
            total: itemTotals.total,
            sortOrder: index,
          };
        });
        await db.createInvoiceItems(invoiceItems);

        // Increment quota
        if (user && user.subscriptionPlan === "free") {
          await db.incrementUserQuota(ctx.user.id, "invoice");
        }

        return { id: invoiceId, invoiceNumber };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        data: invoiceSchema.partial(),
      }))
      .mutation(async ({ ctx, input }) => {
        const invoice = await db.getInvoiceById(input.id);
        if (!invoice) throw new TRPCError({ code: "NOT_FOUND" });
        const company = await db.getCompanyById(invoice.companyId);
        if (!company || company.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        if (invoice.status !== "draft") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Seules les factures en brouillon peuvent être modifiées" });
        }

        if (input.data.items) {
          const totals = calculateInvoiceTotals(input.data.items, input.data.discount || "0", input.data.discountType || "fixed", input.data.includeFiscalStamp ?? true);
          await db.updateInvoice(input.id, {
            clientId: input.data.clientId,
            issueDate: input.data.issueDate,
            dueDate: input.data.dueDate,
            subtotal: totals.subtotal,
            totalVat: totals.totalVat,
            totalFodec: totals.totalFodec,
            totalConsumptionTax: totals.totalConsumptionTax,
            fiscalStamp: totals.fiscalStamp,
            discount: totals.discount,
            discountType: input.data.discountType,
            total: totals.total,
            amountDue: totals.total,
            notes: input.data.notes,
            termsAndConditions: input.data.termsAndConditions,
          });

          // Update items
          await db.deleteInvoiceItemsByInvoiceId(input.id);
          const invoiceItems = input.data.items.map((item, index) => {
            const itemTotals = calculateItemTotals(item);
            return {
              invoiceId: input.id,
              productId: item.productId,
              description: item.description,
              quantity: item.quantity,
              unit: item.unit,
              unitPrice: item.unitPrice,
              vatRate: item.vatRate,
              vatAmount: itemTotals.vatAmount,
              fodecRate: item.fodecRate,
              fodecAmount: itemTotals.fodecAmount,
              consumptionTaxRate: item.consumptionTaxRate,
              consumptionTaxAmount: itemTotals.consumptionTaxAmount,
              discount: item.discount,
              discountType: item.discountType,
              subtotal: itemTotals.subtotal,
              total: itemTotals.total,
              sortOrder: index,
            };
          });
          await db.createInvoiceItems(invoiceItems);
        }

        return { success: true };
      }),

    updateStatus: protectedProcedure
      .input(z.object({ id: z.number(), status: z.enum(["draft", "sent", "paid", "partial", "overdue", "cancelled"]) }))
      .mutation(async ({ ctx, input }) => {
        const invoice = await db.getInvoiceById(input.id);
        if (!invoice) throw new TRPCError({ code: "NOT_FOUND" });
        const company = await db.getCompanyById(invoice.companyId);
        if (!company || company.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        await db.updateInvoice(input.id, { status: input.status, sentAt: input.status === "sent" ? new Date() : undefined });
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const invoice = await db.getInvoiceById(input.id);
        if (!invoice) throw new TRPCError({ code: "NOT_FOUND" });
        const company = await db.getCompanyById(invoice.companyId);
        if (!company || company.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        await db.deleteInvoice(input.id);
        return { success: true };
      }),
  }),

  // ==================== QUOTE ROUTES ====================
  quote: router({
    list: protectedProcedure
      .input(z.object({ companyId: z.number(), status: z.string().optional(), clientId: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        const company = await db.getCompanyById(input.companyId);
        if (!company || company.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        return db.getQuotesByCompanyId(input.companyId, input);
      }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const quote = await db.getQuoteById(input.id);
        if (!quote) throw new TRPCError({ code: "NOT_FOUND" });
        const company = await db.getCompanyById(quote.companyId);
        if (!company || company.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        const items = await db.getQuoteItemsByQuoteId(input.id);
        const client = await db.getClientById(quote.clientId);
        return { ...quote, items, client };
      }),

    create: protectedProcedure
      .input(quoteSchema)
      .mutation(async ({ ctx, input }) => {
        const company = await db.getCompanyById(input.companyId);
        if (!company || company.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        const { prefix, number } = await db.getNextQuoteNumber(input.companyId);
        const year = new Date().getFullYear();
        const quoteNumber = `${prefix}-${year}-${String(number).padStart(5, "0")}`;

        const totals = calculateInvoiceTotals(input.items, input.discount, input.discountType, input.includeFiscalStamp);

        const quoteId = await db.createQuote({
          companyId: input.companyId,
          clientId: input.clientId,
          quoteNumber,
          issueDate: input.issueDate,
          validUntil: input.validUntil,
          status: "draft",
          subtotal: totals.subtotal,
          totalVat: totals.totalVat,
          totalFodec: totals.totalFodec,
          totalConsumptionTax: totals.totalConsumptionTax,
          fiscalStamp: totals.fiscalStamp,
          discount: totals.discount,
          discountType: input.discountType,
          total: totals.total,
          currency: "TND",
          notes: input.notes,
          termsAndConditions: input.termsAndConditions,
        });

        const quoteItems = input.items.map((item, index) => {
          const itemTotals = calculateItemTotals(item);
          return {
            quoteId,
            productId: item.productId,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice,
            vatRate: item.vatRate,
            vatAmount: itemTotals.vatAmount,
            fodecRate: item.fodecRate,
            fodecAmount: itemTotals.fodecAmount,
            consumptionTaxRate: item.consumptionTaxRate,
            consumptionTaxAmount: itemTotals.consumptionTaxAmount,
            discount: item.discount,
            discountType: item.discountType,
            subtotal: itemTotals.subtotal,
            total: itemTotals.total,
            sortOrder: index,
          };
        });
        await db.createQuoteItems(quoteItems);

        return { id: quoteId, quoteNumber };
      }),

    convertToInvoice: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const quote = await db.getQuoteById(input.id);
        if (!quote) throw new TRPCError({ code: "NOT_FOUND" });
        const company = await db.getCompanyById(quote.companyId);
        if (!company || company.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        if (quote.status === "converted") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Ce devis a déjà été converti" });
        }

        // Check quota
        const user = await db.getUserById(ctx.user.id);
        if (user && user.subscriptionPlan === "free" && user.invoiceUsed >= user.invoiceQuota) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Quota de factures atteint. Passez au plan Premium." });
        }

        const { prefix, number } = await db.getNextInvoiceNumber(quote.companyId);
        const year = new Date().getFullYear();
        const invoiceNumber = `${prefix}-${year}-${String(number).padStart(5, "0")}`;

        const now = new Date();
        const dueDate = new Date(now);
        dueDate.setDate(dueDate.getDate() + 30);

        const invoiceId = await db.createInvoice({
          companyId: quote.companyId,
          clientId: quote.clientId,
          invoiceNumber,
          issueDate: now,
          dueDate,
          status: "draft",
          subtotal: quote.subtotal,
          totalVat: quote.totalVat,
          totalFodec: quote.totalFodec,
          totalConsumptionTax: quote.totalConsumptionTax,
          fiscalStamp: quote.fiscalStamp,
          discount: quote.discount,
          discountType: quote.discountType,
          total: quote.total,
          amountPaid: "0",
          amountDue: quote.total,
          currency: quote.currency,
          notes: quote.notes,
          termsAndConditions: quote.termsAndConditions,
          quoteId: quote.id,
        });

        // Copy items
        const quoteItems = await db.getQuoteItemsByQuoteId(input.id);
        const invoiceItems = quoteItems.map((item, index) => ({
          invoiceId,
          productId: item.productId,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          vatRate: item.vatRate,
          vatAmount: item.vatAmount,
          fodecRate: item.fodecRate,
          fodecAmount: item.fodecAmount,
          consumptionTaxRate: item.consumptionTaxRate,
          consumptionTaxAmount: item.consumptionTaxAmount,
          discount: item.discount,
          discountType: item.discountType,
          subtotal: item.subtotal,
          total: item.total,
          sortOrder: index,
        }));
        await db.createInvoiceItems(invoiceItems);

        // Update quote status
        await db.updateQuote(input.id, { status: "converted", convertedInvoiceId: invoiceId });

        // Increment quota
        if (user && user.subscriptionPlan === "free") {
          await db.incrementUserQuota(ctx.user.id, "invoice");
        }

        return { invoiceId, invoiceNumber };
      }),

    updateStatus: protectedProcedure
      .input(z.object({ id: z.number(), status: z.enum(["draft", "sent", "accepted", "rejected", "expired", "converted"]) }))
      .mutation(async ({ ctx, input }) => {
        const quote = await db.getQuoteById(input.id);
        if (!quote) throw new TRPCError({ code: "NOT_FOUND" });
        const company = await db.getCompanyById(quote.companyId);
        if (!company || company.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        await db.updateQuote(input.id, { status: input.status, sentAt: input.status === "sent" ? new Date() : undefined });
        return { success: true };
      }),
  }),

  // ==================== PAYMENT ROUTES ====================
  payment: router({
    list: protectedProcedure
      .input(z.object({ companyId: z.number() }))
      .query(async ({ ctx, input }) => {
        const company = await db.getCompanyById(input.companyId);
        if (!company || company.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        return db.getPaymentsByCompanyId(input.companyId);
      }),

    create: protectedProcedure
      .input(paymentSchema)
      .mutation(async ({ ctx, input }) => {
        const company = await db.getCompanyById(input.companyId);
        if (!company || company.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        const invoice = await db.getInvoiceById(input.invoiceId);
        if (!invoice || invoice.companyId !== input.companyId) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }

        const paymentId = await db.createPayment(input);

        // Update invoice amounts
        const newAmountPaid = parseFloat(invoice.amountPaid) + parseFloat(input.amount);
        const newAmountDue = parseFloat(invoice.total) - newAmountPaid;
        const newStatus = newAmountDue <= 0 ? "paid" : "partial";

        await db.updateInvoice(input.invoiceId, {
          amountPaid: newAmountPaid.toFixed(3),
          amountDue: Math.max(0, newAmountDue).toFixed(3),
          status: newStatus,
        });

        return { id: paymentId };
      }),
  }),

  // ==================== DASHBOARD ROUTES ====================
  dashboard: router({
    stats: protectedProcedure
      .input(z.object({ companyId: z.number() }))
      .query(async ({ ctx, input }) => {
        const company = await db.getCompanyById(input.companyId);
        if (!company || company.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        return db.getDashboardStats(input.companyId);
      }),
  }),

  // ==================== SUBSCRIPTION ROUTES ====================
  subscription: router({
    status: protectedProcedure.query(async ({ ctx }) => {
      const user = await db.getUserById(ctx.user.id);
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });
      return {
        plan: user.subscriptionPlan,
        expiresAt: user.subscriptionExpiresAt,
        invoiceQuota: user.invoiceQuota,
        invoiceUsed: user.invoiceUsed,
        clientQuota: user.clientQuota,
        clientUsed: user.clientUsed,
      };
    }),
  }),
});

export type AppRouter = typeof appRouter;
