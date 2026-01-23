import { eq, and, desc, sql, gte, lte, like, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users,
  InsertCompany, companies, Company,
  InsertClient, clients, Client,
  InsertSupplier, suppliers, Supplier,
  InsertProduct, products, Product,
  InsertProductCategory, productCategories, ProductCategory,
  InsertInvoice, invoices, Invoice,
  InsertInvoiceItem, invoiceItems, InvoiceItem,
  InsertQuote, quotes, Quote,
  InsertQuoteItem, quoteItems, QuoteItem,
  InsertPayment, payments, Payment,
  InsertStockMovement, stockMovements,
  InsertSupplierInvoice, supplierInvoices,
  InsertEmailLog, emailLogs,
  InsertActivityLog, activityLogs,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ==================== USER HELPERS ====================
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  const textFields = ["name", "email", "loginMethod"] as const;
  textFields.forEach(field => {
    const value = user[field];
    if (value !== undefined) {
      values[field] = value ?? null;
      updateSet[field] = value ?? null;
    }
  });

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = 'admin';
    updateSet.role = 'admin';
  }

  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserSubscription(userId: number, plan: "free" | "premium", expiresAt?: Date) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({
    subscriptionPlan: plan,
    subscriptionExpiresAt: expiresAt || null,
    invoiceQuota: plan === "premium" ? 999999 : 10,
    clientQuota: plan === "premium" ? 999999 : 5,
  }).where(eq(users.id, userId));
}

export async function incrementUserQuota(userId: number, type: "invoice" | "client") {
  const db = await getDb();
  if (!db) return;
  const field = type === "invoice" ? users.invoiceUsed : users.clientUsed;
  await db.update(users).set({ [type === "invoice" ? "invoiceUsed" : "clientUsed"]: sql`${field} + 1` }).where(eq(users.id, userId));
}

// ==================== COMPANY HELPERS ====================
export async function createCompany(data: InsertCompany): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(companies).values(data);
  return result[0].insertId;
}

export async function getCompanyById(id: number): Promise<Company | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
  return result[0];
}

export async function getCompaniesByUserId(userId: number): Promise<Company[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(companies).where(and(eq(companies.userId, userId), eq(companies.isActive, true))).orderBy(desc(companies.createdAt));
}

export async function updateCompany(id: number, data: Partial<InsertCompany>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(companies).set(data).where(eq(companies.id, id));
}

export async function deleteCompany(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(companies).set({ isActive: false }).where(eq(companies.id, id));
}

export async function getNextInvoiceNumber(companyId: number): Promise<{ prefix: string; number: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const company = await getCompanyById(companyId);
  if (!company) throw new Error("Company not found");
  await db.update(companies).set({ invoiceNextNumber: sql`${companies.invoiceNextNumber} + 1` }).where(eq(companies.id, companyId));
  return { prefix: company.invoicePrefix || "FAC", number: company.invoiceNextNumber };
}

export async function getNextQuoteNumber(companyId: number): Promise<{ prefix: string; number: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const company = await getCompanyById(companyId);
  if (!company) throw new Error("Company not found");
  await db.update(companies).set({ quoteNextNumber: sql`${companies.quoteNextNumber} + 1` }).where(eq(companies.id, companyId));
  return { prefix: company.quotePrefix || "DEV", number: company.quoteNextNumber };
}

// ==================== CLIENT HELPERS ====================
export async function createClient(data: InsertClient): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(clients).values(data);
  return result[0].insertId;
}

export async function getClientById(id: number): Promise<Client | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  return result[0];
}

export async function getClientsByCompanyId(companyId: number, search?: string): Promise<Client[]> {
  const db = await getDb();
  if (!db) return [];
  let query = db.select().from(clients).where(and(eq(clients.companyId, companyId), eq(clients.isActive, true)));
  if (search) {
    query = db.select().from(clients).where(and(
      eq(clients.companyId, companyId),
      eq(clients.isActive, true),
      or(like(clients.name, `%${search}%`), like(clients.email, `%${search}%`))
    ));
  }
  return query.orderBy(desc(clients.createdAt));
}

export async function updateClient(id: number, data: Partial<InsertClient>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(clients).set(data).where(eq(clients.id, id));
}

export async function deleteClient(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(clients).set({ isActive: false }).where(eq(clients.id, id));
}

// ==================== SUPPLIER HELPERS ====================
export async function createSupplier(data: InsertSupplier): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(suppliers).values(data);
  return result[0].insertId;
}

export async function getSupplierById(id: number): Promise<Supplier | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);
  return result[0];
}

export async function getSuppliersByCompanyId(companyId: number): Promise<Supplier[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(suppliers).where(and(eq(suppliers.companyId, companyId), eq(suppliers.isActive, true))).orderBy(desc(suppliers.createdAt));
}

export async function updateSupplier(id: number, data: Partial<InsertSupplier>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(suppliers).set(data).where(eq(suppliers.id, id));
}

export async function deleteSupplier(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(suppliers).set({ isActive: false }).where(eq(suppliers.id, id));
}

// ==================== PRODUCT HELPERS ====================
export async function createProduct(data: InsertProduct): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(products).values(data);
  return result[0].insertId;
}

export async function getProductById(id: number): Promise<Product | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return result[0];
}

export async function getProductsByCompanyId(companyId: number, search?: string): Promise<Product[]> {
  const db = await getDb();
  if (!db) return [];
  let conditions = and(eq(products.companyId, companyId), eq(products.isActive, true));
  if (search) {
    conditions = and(conditions, or(like(products.name, `%${search}%`), like(products.reference, `%${search}%`)));
  }
  return db.select().from(products).where(conditions).orderBy(desc(products.createdAt));
}

export async function updateProduct(id: number, data: Partial<InsertProduct>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(products).set(data).where(eq(products.id, id));
}

export async function deleteProduct(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(products).set({ isActive: false }).where(eq(products.id, id));
}

export async function updateProductStock(id: number, quantity: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(products).set({ stockQuantity: quantity }).where(eq(products.id, id));
}

// ==================== PRODUCT CATEGORY HELPERS ====================
export async function createProductCategory(data: InsertProductCategory): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(productCategories).values(data);
  return result[0].insertId;
}

export async function getCategoriesByCompanyId(companyId: number): Promise<ProductCategory[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(productCategories).where(eq(productCategories.companyId, companyId)).orderBy(productCategories.name);
}

// ==================== INVOICE HELPERS ====================
export async function createInvoice(data: InsertInvoice): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(invoices).values(data);
  return result[0].insertId;
}

export async function getInvoiceById(id: number): Promise<Invoice | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
  return result[0];
}

export async function getInvoicesByCompanyId(companyId: number, filters?: {
  status?: string;
  clientId?: number;
  startDate?: Date;
  endDate?: Date;
}): Promise<Invoice[]> {
  const db = await getDb();
  if (!db) return [];
  let conditions: any = eq(invoices.companyId, companyId);
  if (filters?.status) conditions = and(conditions, eq(invoices.status, filters.status as any));
  if (filters?.clientId) conditions = and(conditions, eq(invoices.clientId, filters.clientId));
  if (filters?.startDate) conditions = and(conditions, gte(invoices.issueDate, filters.startDate));
  if (filters?.endDate) conditions = and(conditions, lte(invoices.issueDate, filters.endDate));
  return db.select().from(invoices).where(conditions).orderBy(desc(invoices.createdAt));
}

export async function updateInvoice(id: number, data: Partial<InsertInvoice>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(invoices).set(data).where(eq(invoices.id, id));
}

export async function deleteInvoice(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(invoices).set({ status: "cancelled" }).where(eq(invoices.id, id));
}

// ==================== INVOICE ITEM HELPERS ====================
export async function createInvoiceItems(items: InsertInvoiceItem[]): Promise<void> {
  const db = await getDb();
  if (!db) return;
  if (items.length > 0) await db.insert(invoiceItems).values(items);
}

export async function getInvoiceItemsByInvoiceId(invoiceId: number): Promise<InvoiceItem[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId)).orderBy(invoiceItems.sortOrder);
}

export async function deleteInvoiceItemsByInvoiceId(invoiceId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));
}

// ==================== QUOTE HELPERS ====================
export async function createQuote(data: InsertQuote): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(quotes).values(data);
  return result[0].insertId;
}

export async function getQuoteById(id: number): Promise<Quote | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(quotes).where(eq(quotes.id, id)).limit(1);
  return result[0];
}

export async function getQuotesByCompanyId(companyId: number, filters?: {
  status?: string;
  clientId?: number;
}): Promise<Quote[]> {
  const db = await getDb();
  if (!db) return [];
  let conditions: any = eq(quotes.companyId, companyId);
  if (filters?.status) conditions = and(conditions, eq(quotes.status, filters.status as any));
  if (filters?.clientId) conditions = and(conditions, eq(quotes.clientId, filters.clientId));
  return db.select().from(quotes).where(conditions).orderBy(desc(quotes.createdAt));
}

export async function updateQuote(id: number, data: Partial<InsertQuote>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(quotes).set(data).where(eq(quotes.id, id));
}

// ==================== QUOTE ITEM HELPERS ====================
export async function createQuoteItems(items: InsertQuoteItem[]): Promise<void> {
  const db = await getDb();
  if (!db) return;
  if (items.length > 0) await db.insert(quoteItems).values(items);
}

export async function getQuoteItemsByQuoteId(quoteId: number): Promise<QuoteItem[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(quoteItems).where(eq(quoteItems.quoteId, quoteId)).orderBy(quoteItems.sortOrder);
}

export async function deleteQuoteItemsByQuoteId(quoteId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(quoteItems).where(eq(quoteItems.quoteId, quoteId));
}

// ==================== PAYMENT HELPERS ====================
export async function createPayment(data: InsertPayment): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(payments).values(data);
  return result[0].insertId;
}

export async function getPaymentsByInvoiceId(invoiceId: number): Promise<Payment[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(payments).where(eq(payments.invoiceId, invoiceId)).orderBy(desc(payments.paymentDate));
}

export async function getPaymentsByCompanyId(companyId: number): Promise<Payment[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(payments).where(eq(payments.companyId, companyId)).orderBy(desc(payments.paymentDate));
}

// ==================== STOCK MOVEMENT HELPERS ====================
export async function createStockMovement(data: InsertStockMovement): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(stockMovements).values(data);
  return result[0].insertId;
}

export async function getStockMovementsByProductId(productId: number): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(stockMovements).where(eq(stockMovements.productId, productId)).orderBy(desc(stockMovements.createdAt));
}

// ==================== SUPPLIER INVOICE HELPERS ====================
export async function createSupplierInvoice(data: InsertSupplierInvoice): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(supplierInvoices).values(data);
  return result[0].insertId;
}

export async function getSupplierInvoicesByCompanyId(companyId: number): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(supplierInvoices).where(eq(supplierInvoices.companyId, companyId)).orderBy(desc(supplierInvoices.createdAt));
}

export async function updateSupplierInvoice(id: number, data: Partial<InsertSupplierInvoice>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(supplierInvoices).set(data).where(eq(supplierInvoices.id, id));
}

// ==================== EMAIL LOG HELPERS ====================
export async function createEmailLog(data: InsertEmailLog): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(emailLogs).values(data);
  return result[0].insertId;
}

// ==================== ACTIVITY LOG HELPERS ====================
export async function createActivityLog(data: InsertActivityLog): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(activityLogs).values(data);
}

// ==================== DASHBOARD STATS ====================
export async function getDashboardStats(companyId: number) {
  const db = await getDb();
  if (!db) return null;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  // Total revenue this month
  const monthlyRevenue = await db.select({
    total: sql<string>`COALESCE(SUM(${invoices.total}), 0)`,
  }).from(invoices).where(and(
    eq(invoices.companyId, companyId),
    eq(invoices.status, "paid"),
    gte(invoices.issueDate, startOfMonth)
  ));

  // Total revenue this year
  const yearlyRevenue = await db.select({
    total: sql<string>`COALESCE(SUM(${invoices.total}), 0)`,
  }).from(invoices).where(and(
    eq(invoices.companyId, companyId),
    eq(invoices.status, "paid"),
    gte(invoices.issueDate, startOfYear)
  ));

  // Pending invoices
  const pendingInvoices = await db.select({
    count: sql<number>`COUNT(*)`,
    total: sql<string>`COALESCE(SUM(${invoices.amountDue}), 0)`,
  }).from(invoices).where(and(
    eq(invoices.companyId, companyId),
    sql`${invoices.status} IN ('sent', 'partial')`
  ));

  // Overdue invoices
  const overdueInvoices = await db.select({
    count: sql<number>`COUNT(*)`,
    total: sql<string>`COALESCE(SUM(${invoices.amountDue}), 0)`,
  }).from(invoices).where(and(
    eq(invoices.companyId, companyId),
    eq(invoices.status, "overdue")
  ));

  // Total VAT collected this year
  const vatCollected = await db.select({
    total: sql<string>`COALESCE(SUM(${invoices.totalVat}), 0)`,
  }).from(invoices).where(and(
    eq(invoices.companyId, companyId),
    eq(invoices.status, "paid"),
    gte(invoices.issueDate, startOfYear)
  ));

  // Client count
  const clientCount = await db.select({
    count: sql<number>`COUNT(*)`,
  }).from(clients).where(and(eq(clients.companyId, companyId), eq(clients.isActive, true)));

  // Product count
  const productCount = await db.select({
    count: sql<number>`COUNT(*)`,
  }).from(products).where(and(eq(products.companyId, companyId), eq(products.isActive, true)));

  // Recent invoices
  const recentInvoices = await db.select().from(invoices)
    .where(eq(invoices.companyId, companyId))
    .orderBy(desc(invoices.createdAt))
    .limit(5);

  return {
    monthlyRevenue: monthlyRevenue[0]?.total || "0",
    yearlyRevenue: yearlyRevenue[0]?.total || "0",
    pendingCount: pendingInvoices[0]?.count || 0,
    pendingAmount: pendingInvoices[0]?.total || "0",
    overdueCount: overdueInvoices[0]?.count || 0,
    overdueAmount: overdueInvoices[0]?.total || "0",
    vatCollected: vatCollected[0]?.total || "0",
    clientCount: clientCount[0]?.count || 0,
    productCount: productCount[0]?.count || 0,
    recentInvoices,
  };
}
