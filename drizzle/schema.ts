import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, json } from "drizzle-orm/mysql-core";

// ==================== USERS ====================
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  // Subscription
  subscriptionPlan: mysqlEnum("subscriptionPlan", ["free", "premium"]).default("free").notNull(),
  subscriptionExpiresAt: timestamp("subscriptionExpiresAt"),
  // Quotas for free plan
  invoiceQuota: int("invoiceQuota").default(10).notNull(),
  invoiceUsed: int("invoiceUsed").default(0).notNull(),
  clientQuota: int("clientQuota").default(5).notNull(),
  clientUsed: int("clientUsed").default(0).notNull(),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ==================== COMPANIES ====================
export const companies = mysqlTable("companies", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  // Company Info
  name: varchar("name", { length: 255 }).notNull(),
  legalForm: varchar("legalForm", { length: 50 }), // SARL, SA, SUARL, etc.
  // Tunisian Tax ID: 0000000/L/A/M/000
  taxId: varchar("taxId", { length: 20 }),
  // Address
  address: text("address"),
  city: varchar("city", { length: 100 }),
  postalCode: varchar("postalCode", { length: 10 }),
  country: varchar("country", { length: 100 }).default("Tunisie"),
  // Contact
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 320 }),
  website: varchar("website", { length: 255 }),
  // Branding
  logoUrl: varchar("logoUrl", { length: 500 }),
  primaryColor: varchar("primaryColor", { length: 7 }).default("#1e40af"),
  // Accounting
  accountingPeriodStart: timestamp("accountingPeriodStart"),
  accountingPeriodEnd: timestamp("accountingPeriodEnd"),
  currency: varchar("currency", { length: 3 }).default("TND").notNull(),
  // Invoice Settings
  invoicePrefix: varchar("invoicePrefix", { length: 10 }).default("FAC"),
  invoiceNextNumber: int("invoiceNextNumber").default(1).notNull(),
  quotePrefix: varchar("quotePrefix", { length: 10 }).default("DEV"),
  quoteNextNumber: int("quoteNextNumber").default(1).notNull(),
  // Default VAT
  defaultVatRate: decimal("defaultVatRate", { precision: 5, scale: 2 }).default("19.00"),
  // Bank Info
  bankName: varchar("bankName", { length: 100 }),
  bankIban: varchar("bankIban", { length: 34 }),
  bankBic: varchar("bankBic", { length: 11 }),
  // Status
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Company = typeof companies.$inferSelect;
export type InsertCompany = typeof companies.$inferInsert;

// ==================== CLIENTS ====================
export const clients = mysqlTable("clients", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  // Client Info
  type: mysqlEnum("type", ["individual", "company"]).default("company").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  taxId: varchar("taxId", { length: 20 }), // Tunisian format
  // Contact
  contactName: varchar("contactName", { length: 255 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 20 }),
  // Address
  address: text("address"),
  city: varchar("city", { length: 100 }),
  postalCode: varchar("postalCode", { length: 10 }),
  country: varchar("country", { length: 100 }).default("Tunisie"),
  // Payment Terms
  paymentTermDays: int("paymentTermDays").default(30),
  // Category
  category: varchar("category", { length: 100 }),
  // Notes
  notes: text("notes"),
  // Status
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;

// ==================== SUPPLIERS ====================
export const suppliers = mysqlTable("suppliers", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  // Supplier Info
  name: varchar("name", { length: 255 }).notNull(),
  taxId: varchar("taxId", { length: 20 }),
  // Contact
  contactName: varchar("contactName", { length: 255 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 20 }),
  // Address
  address: text("address"),
  city: varchar("city", { length: 100 }),
  postalCode: varchar("postalCode", { length: 10 }),
  country: varchar("country", { length: 100 }).default("Tunisie"),
  // Payment Terms
  paymentTermDays: int("paymentTermDays").default(30),
  // Category
  category: varchar("category", { length: 100 }),
  // Bank Info
  bankName: varchar("bankName", { length: 100 }),
  bankIban: varchar("bankIban", { length: 34 }),
  // Notes
  notes: text("notes"),
  // Status
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Supplier = typeof suppliers.$inferSelect;
export type InsertSupplier = typeof suppliers.$inferInsert;

// ==================== PRODUCT CATEGORIES ====================
export const productCategories = mysqlTable("product_categories", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  parentId: int("parentId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProductCategory = typeof productCategories.$inferSelect;
export type InsertProductCategory = typeof productCategories.$inferInsert;

// ==================== PRODUCTS/SERVICES ====================
export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  categoryId: int("categoryId"),
  // Product Info
  type: mysqlEnum("type", ["product", "service"]).default("product").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  reference: varchar("reference", { length: 100 }),
  barcode: varchar("barcode", { length: 50 }),
  // Pricing
  unitPrice: decimal("unitPrice", { precision: 15, scale: 3 }).notNull(),
  unit: varchar("unit", { length: 20 }).default("unité"),
  // Tax
  vatRate: decimal("vatRate", { precision: 5, scale: 2 }).default("19.00"),
  fodecRate: decimal("fodecRate", { precision: 5, scale: 2 }).default("0.00"),
  consumptionTaxRate: decimal("consumptionTaxRate", { precision: 5, scale: 2 }).default("0.00"),
  // Stock (for products only)
  trackStock: boolean("trackStock").default(false),
  stockQuantity: decimal("stockQuantity", { precision: 15, scale: 3 }).default("0"),
  minStockLevel: decimal("minStockLevel", { precision: 15, scale: 3 }).default("0"),
  // Cost
  costPrice: decimal("costPrice", { precision: 15, scale: 3 }),
  // Status
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

// ==================== INVOICES ====================
export const invoices = mysqlTable("invoices", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  clientId: int("clientId").notNull(),
  // Invoice Number (sequential)
  invoiceNumber: varchar("invoiceNumber", { length: 50 }).notNull(),
  // Dates
  issueDate: timestamp("issueDate").notNull(),
  dueDate: timestamp("dueDate").notNull(),
  // Status
  status: mysqlEnum("status", ["draft", "sent", "paid", "partial", "overdue", "cancelled"]).default("draft").notNull(),
  // Amounts (in TND millimes for precision)
  subtotal: decimal("subtotal", { precision: 15, scale: 3 }).default("0").notNull(),
  totalVat: decimal("totalVat", { precision: 15, scale: 3 }).default("0").notNull(),
  totalFodec: decimal("totalFodec", { precision: 15, scale: 3 }).default("0").notNull(),
  totalConsumptionTax: decimal("totalConsumptionTax", { precision: 15, scale: 3 }).default("0").notNull(),
  fiscalStamp: decimal("fiscalStamp", { precision: 15, scale: 3 }).default("0.600"), // Timbre fiscal 0.600 TND
  discount: decimal("discount", { precision: 15, scale: 3 }).default("0"),
  discountType: mysqlEnum("discountType", ["percentage", "fixed"]).default("fixed"),
  total: decimal("total", { precision: 15, scale: 3 }).default("0").notNull(),
  amountPaid: decimal("amountPaid", { precision: 15, scale: 3 }).default("0").notNull(),
  amountDue: decimal("amountDue", { precision: 15, scale: 3 }).default("0").notNull(),
  // Currency
  currency: varchar("currency", { length: 3 }).default("TND").notNull(),
  // Notes
  notes: text("notes"),
  termsAndConditions: text("termsAndConditions"),
  // PDF
  pdfUrl: varchar("pdfUrl", { length: 500 }),
  // Email tracking
  sentAt: timestamp("sentAt"),
  lastReminderAt: timestamp("lastReminderAt"),
  reminderCount: int("reminderCount").default(0),
  // Source (if converted from quote)
  quoteId: int("quoteId"),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = typeof invoices.$inferInsert;

// ==================== INVOICE ITEMS ====================
export const invoiceItems = mysqlTable("invoice_items", {
  id: int("id").autoincrement().primaryKey(),
  invoiceId: int("invoiceId").notNull(),
  productId: int("productId"),
  // Item Details
  description: text("description").notNull(),
  quantity: decimal("quantity", { precision: 15, scale: 3 }).notNull(),
  unit: varchar("unit", { length: 20 }).default("unité"),
  unitPrice: decimal("unitPrice", { precision: 15, scale: 3 }).notNull(),
  // Taxes
  vatRate: decimal("vatRate", { precision: 5, scale: 2 }).default("19.00"),
  vatAmount: decimal("vatAmount", { precision: 15, scale: 3 }).default("0"),
  fodecRate: decimal("fodecRate", { precision: 5, scale: 2 }).default("0.00"),
  fodecAmount: decimal("fodecAmount", { precision: 15, scale: 3 }).default("0"),
  consumptionTaxRate: decimal("consumptionTaxRate", { precision: 5, scale: 2 }).default("0.00"),
  consumptionTaxAmount: decimal("consumptionTaxAmount", { precision: 15, scale: 3 }).default("0"),
  // Discount
  discount: decimal("discount", { precision: 15, scale: 3 }).default("0"),
  discountType: mysqlEnum("discountType", ["percentage", "fixed"]).default("fixed"),
  // Totals
  subtotal: decimal("subtotal", { precision: 15, scale: 3 }).notNull(),
  total: decimal("total", { precision: 15, scale: 3 }).notNull(),
  // Order
  sortOrder: int("sortOrder").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type InsertInvoiceItem = typeof invoiceItems.$inferInsert;

// ==================== QUOTES ====================
export const quotes = mysqlTable("quotes", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  clientId: int("clientId").notNull(),
  // Quote Number
  quoteNumber: varchar("quoteNumber", { length: 50 }).notNull(),
  // Dates
  issueDate: timestamp("issueDate").notNull(),
  validUntil: timestamp("validUntil").notNull(),
  // Status
  status: mysqlEnum("status", ["draft", "sent", "accepted", "rejected", "expired", "converted"]).default("draft").notNull(),
  // Amounts
  subtotal: decimal("subtotal", { precision: 15, scale: 3 }).default("0").notNull(),
  totalVat: decimal("totalVat", { precision: 15, scale: 3 }).default("0").notNull(),
  totalFodec: decimal("totalFodec", { precision: 15, scale: 3 }).default("0").notNull(),
  totalConsumptionTax: decimal("totalConsumptionTax", { precision: 15, scale: 3 }).default("0").notNull(),
  fiscalStamp: decimal("fiscalStamp", { precision: 15, scale: 3 }).default("0.600"),
  discount: decimal("discount", { precision: 15, scale: 3 }).default("0"),
  discountType: mysqlEnum("discountType", ["percentage", "fixed"]).default("fixed"),
  total: decimal("total", { precision: 15, scale: 3 }).default("0").notNull(),
  // Currency
  currency: varchar("currency", { length: 3 }).default("TND").notNull(),
  // Notes
  notes: text("notes"),
  termsAndConditions: text("termsAndConditions"),
  // PDF
  pdfUrl: varchar("pdfUrl", { length: 500 }),
  // Email tracking
  sentAt: timestamp("sentAt"),
  // Converted Invoice
  convertedInvoiceId: int("convertedInvoiceId"),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Quote = typeof quotes.$inferSelect;
export type InsertQuote = typeof quotes.$inferInsert;

// ==================== QUOTE ITEMS ====================
export const quoteItems = mysqlTable("quote_items", {
  id: int("id").autoincrement().primaryKey(),
  quoteId: int("quoteId").notNull(),
  productId: int("productId"),
  // Item Details
  description: text("description").notNull(),
  quantity: decimal("quantity", { precision: 15, scale: 3 }).notNull(),
  unit: varchar("unit", { length: 20 }).default("unité"),
  unitPrice: decimal("unitPrice", { precision: 15, scale: 3 }).notNull(),
  // Taxes
  vatRate: decimal("vatRate", { precision: 5, scale: 2 }).default("19.00"),
  vatAmount: decimal("vatAmount", { precision: 15, scale: 3 }).default("0"),
  fodecRate: decimal("fodecRate", { precision: 5, scale: 2 }).default("0.00"),
  fodecAmount: decimal("fodecAmount", { precision: 15, scale: 3 }).default("0"),
  consumptionTaxRate: decimal("consumptionTaxRate", { precision: 5, scale: 2 }).default("0.00"),
  consumptionTaxAmount: decimal("consumptionTaxAmount", { precision: 15, scale: 3 }).default("0"),
  // Discount
  discount: decimal("discount", { precision: 15, scale: 3 }).default("0"),
  discountType: mysqlEnum("discountType", ["percentage", "fixed"]).default("fixed"),
  // Totals
  subtotal: decimal("subtotal", { precision: 15, scale: 3 }).notNull(),
  total: decimal("total", { precision: 15, scale: 3 }).notNull(),
  // Order
  sortOrder: int("sortOrder").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type QuoteItem = typeof quoteItems.$inferSelect;
export type InsertQuoteItem = typeof quoteItems.$inferInsert;

// ==================== PAYMENTS ====================
export const payments = mysqlTable("payments", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  invoiceId: int("invoiceId").notNull(),
  // Payment Info
  amount: decimal("amount", { precision: 15, scale: 3 }).notNull(),
  paymentDate: timestamp("paymentDate").notNull(),
  paymentMethod: mysqlEnum("paymentMethod", ["cash", "check", "bank_transfer", "card", "other"]).default("bank_transfer").notNull(),
  // Reference
  reference: varchar("reference", { length: 100 }),
  // Notes
  notes: text("notes"),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = typeof payments.$inferInsert;

// ==================== STOCK MOVEMENTS ====================
export const stockMovements = mysqlTable("stock_movements", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  productId: int("productId").notNull(),
  // Movement Info
  type: mysqlEnum("type", ["in", "out", "adjustment"]).notNull(),
  quantity: decimal("quantity", { precision: 15, scale: 3 }).notNull(),
  previousQuantity: decimal("previousQuantity", { precision: 15, scale: 3 }).notNull(),
  newQuantity: decimal("newQuantity", { precision: 15, scale: 3 }).notNull(),
  // Reference
  referenceType: varchar("referenceType", { length: 50 }), // invoice, purchase, adjustment
  referenceId: int("referenceId"),
  // Notes
  notes: text("notes"),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type StockMovement = typeof stockMovements.$inferSelect;
export type InsertStockMovement = typeof stockMovements.$inferInsert;

// ==================== SUPPLIER INVOICES (for OCR) ====================
export const supplierInvoices = mysqlTable("supplier_invoices", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  supplierId: int("supplierId"),
  // Invoice Info
  invoiceNumber: varchar("invoiceNumber", { length: 100 }),
  issueDate: timestamp("issueDate"),
  dueDate: timestamp("dueDate"),
  // Amounts
  subtotal: decimal("subtotal", { precision: 15, scale: 3 }),
  totalVat: decimal("totalVat", { precision: 15, scale: 3 }),
  total: decimal("total", { precision: 15, scale: 3 }),
  // Status
  status: mysqlEnum("status", ["pending", "paid", "partial", "cancelled"]).default("pending").notNull(),
  amountPaid: decimal("amountPaid", { precision: 15, scale: 3 }).default("0"),
  // OCR Data
  originalImageUrl: varchar("originalImageUrl", { length: 500 }),
  ocrRawData: json("ocrRawData"),
  ocrConfidence: decimal("ocrConfidence", { precision: 5, scale: 2 }),
  // Notes
  notes: text("notes"),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SupplierInvoice = typeof supplierInvoices.$inferSelect;
export type InsertSupplierInvoice = typeof supplierInvoices.$inferInsert;

// ==================== EMAIL LOGS ====================
export const emailLogs = mysqlTable("email_logs", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  // Email Info
  type: mysqlEnum("type", ["invoice", "quote", "reminder", "confirmation"]).notNull(),
  recipientEmail: varchar("recipientEmail", { length: 320 }).notNull(),
  subject: varchar("subject", { length: 500 }).notNull(),
  // Reference
  referenceType: varchar("referenceType", { length: 50 }),
  referenceId: int("referenceId"),
  // Status
  status: mysqlEnum("status", ["sent", "failed", "bounced"]).default("sent").notNull(),
  errorMessage: text("errorMessage"),
  // Timestamps
  sentAt: timestamp("sentAt").defaultNow().notNull(),
});

export type EmailLog = typeof emailLogs.$inferSelect;
export type InsertEmailLog = typeof emailLogs.$inferInsert;

// ==================== ACTIVITY LOGS ====================
export const activityLogs = mysqlTable("activity_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  companyId: int("companyId"),
  // Activity Info
  action: varchar("action", { length: 100 }).notNull(),
  entityType: varchar("entityType", { length: 50 }),
  entityId: int("entityId"),
  // Details
  details: json("details"),
  ipAddress: varchar("ipAddress", { length: 45 }),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = typeof activityLogs.$inferInsert;

// ==================== WAREHOUSES ====================
export const warehouses = mysqlTable("warehouses", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  // Warehouse Info
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 50 }),
  // Address
  address: text("address"),
  city: varchar("city", { length: 100 }),
  postalCode: varchar("postalCode", { length: 10 }),
  // Contact
  contactName: varchar("contactName", { length: 255 }),
  phone: varchar("phone", { length: 20 }),
  // Status
  isDefault: boolean("isDefault").default(false),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Warehouse = typeof warehouses.$inferSelect;
export type InsertWarehouse = typeof warehouses.$inferInsert;

// ==================== WAREHOUSE STOCK ====================
export const warehouseStock = mysqlTable("warehouse_stock", {
  id: int("id").autoincrement().primaryKey(),
  warehouseId: int("warehouseId").notNull(),
  productId: int("productId").notNull(),
  // Stock
  quantity: decimal("quantity", { precision: 15, scale: 3 }).default("0").notNull(),
  minQuantity: decimal("minQuantity", { precision: 15, scale: 3 }).default("0"),
  maxQuantity: decimal("maxQuantity", { precision: 15, scale: 3 }),
  // Location in warehouse
  location: varchar("location", { length: 100 }),
  // Timestamps
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WarehouseStock = typeof warehouseStock.$inferSelect;
export type InsertWarehouseStock = typeof warehouseStock.$inferInsert;

// ==================== INVENTORY COUNTS ====================
export const inventoryCounts = mysqlTable("inventory_counts", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  warehouseId: int("warehouseId"),
  // Count Info
  reference: varchar("reference", { length: 100 }),
  countDate: timestamp("countDate").notNull(),
  // Status
  status: mysqlEnum("status", ["draft", "in_progress", "completed", "cancelled"]).default("draft").notNull(),
  // Notes
  notes: text("notes"),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type InventoryCount = typeof inventoryCounts.$inferSelect;
export type InsertInventoryCount = typeof inventoryCounts.$inferInsert;

// ==================== INVENTORY COUNT ITEMS ====================
export const inventoryCountItems = mysqlTable("inventory_count_items", {
  id: int("id").autoincrement().primaryKey(),
  inventoryCountId: int("inventoryCountId").notNull(),
  productId: int("productId").notNull(),
  // Quantities
  expectedQuantity: decimal("expectedQuantity", { precision: 15, scale: 3 }).notNull(),
  countedQuantity: decimal("countedQuantity", { precision: 15, scale: 3 }),
  difference: decimal("difference", { precision: 15, scale: 3 }),
  // Notes
  notes: text("notes"),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type InventoryCountItem = typeof inventoryCountItems.$inferSelect;
export type InsertInventoryCountItem = typeof inventoryCountItems.$inferInsert;

// ==================== DELIVERY NOTES (Bons de livraison) ====================
export const deliveryNotes = mysqlTable("delivery_notes", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  clientId: int("clientId").notNull(),
  invoiceId: int("invoiceId"),
  // Reference
  noteNumber: varchar("noteNumber", { length: 50 }).notNull(),
  // Dates
  issueDate: timestamp("issueDate").notNull(),
  deliveryDate: timestamp("deliveryDate"),
  // Status
  status: mysqlEnum("status", ["draft", "delivered", "cancelled"]).default("draft").notNull(),
  // Delivery Address
  deliveryAddress: text("deliveryAddress"),
  // Notes
  notes: text("notes"),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DeliveryNote = typeof deliveryNotes.$inferSelect;
export type InsertDeliveryNote = typeof deliveryNotes.$inferInsert;

// ==================== DELIVERY NOTE ITEMS ====================
export const deliveryNoteItems = mysqlTable("delivery_note_items", {
  id: int("id").autoincrement().primaryKey(),
  deliveryNoteId: int("deliveryNoteId").notNull(),
  productId: int("productId"),
  // Item Details
  description: text("description").notNull(),
  quantity: decimal("quantity", { precision: 15, scale: 3 }).notNull(),
  unit: varchar("unit", { length: 20 }).default("unité"),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DeliveryNoteItem = typeof deliveryNoteItems.$inferSelect;
export type InsertDeliveryNoteItem = typeof deliveryNoteItems.$inferInsert;

// ==================== CREDIT NOTES (Factures d'avoir) ====================
export const creditNotes = mysqlTable("credit_notes", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  clientId: int("clientId").notNull(),
  invoiceId: int("invoiceId"),
  // Reference
  noteNumber: varchar("noteNumber", { length: 50 }).notNull(),
  // Dates
  issueDate: timestamp("issueDate").notNull(),
  // Status
  status: mysqlEnum("status", ["draft", "issued", "applied", "cancelled"]).default("draft").notNull(),
  // Amounts
  subtotal: decimal("subtotal", { precision: 15, scale: 3 }).default("0").notNull(),
  totalVat: decimal("totalVat", { precision: 15, scale: 3 }).default("0").notNull(),
  total: decimal("total", { precision: 15, scale: 3 }).default("0").notNull(),
  // Reason
  reason: text("reason"),
  // Notes
  notes: text("notes"),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CreditNote = typeof creditNotes.$inferSelect;
export type InsertCreditNote = typeof creditNotes.$inferInsert;

// ==================== CREDIT NOTE ITEMS ====================
export const creditNoteItems = mysqlTable("credit_note_items", {
  id: int("id").autoincrement().primaryKey(),
  creditNoteId: int("creditNoteId").notNull(),
  productId: int("productId"),
  // Item Details
  description: text("description").notNull(),
  quantity: decimal("quantity", { precision: 15, scale: 3 }).notNull(),
  unitPrice: decimal("unitPrice", { precision: 15, scale: 3 }).notNull(),
  vatRate: decimal("vatRate", { precision: 5, scale: 2 }).default("19.00"),
  vatAmount: decimal("vatAmount", { precision: 15, scale: 3 }).default("0"),
  subtotal: decimal("subtotal", { precision: 15, scale: 3 }).notNull(),
  total: decimal("total", { precision: 15, scale: 3 }).notNull(),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CreditNoteItem = typeof creditNoteItems.$inferSelect;
export type InsertCreditNoteItem = typeof creditNoteItems.$inferInsert;

// ==================== PURCHASE ORDERS (Bons de commande) ====================
export const purchaseOrders = mysqlTable("purchase_orders", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  supplierId: int("supplierId").notNull(),
  // Reference
  orderNumber: varchar("orderNumber", { length: 50 }).notNull(),
  // Dates
  orderDate: timestamp("orderDate").notNull(),
  expectedDeliveryDate: timestamp("expectedDeliveryDate"),
  // Status
  status: mysqlEnum("status", ["draft", "sent", "confirmed", "received", "partial", "cancelled"]).default("draft").notNull(),
  // Amounts
  subtotal: decimal("subtotal", { precision: 15, scale: 3 }).default("0").notNull(),
  totalVat: decimal("totalVat", { precision: 15, scale: 3 }).default("0").notNull(),
  total: decimal("total", { precision: 15, scale: 3 }).default("0").notNull(),
  // Notes
  notes: text("notes"),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type InsertPurchaseOrder = typeof purchaseOrders.$inferInsert;

// ==================== PURCHASE ORDER ITEMS ====================
export const purchaseOrderItems = mysqlTable("purchase_order_items", {
  id: int("id").autoincrement().primaryKey(),
  purchaseOrderId: int("purchaseOrderId").notNull(),
  productId: int("productId"),
  // Item Details
  description: text("description").notNull(),
  quantity: decimal("quantity", { precision: 15, scale: 3 }).notNull(),
  unitPrice: decimal("unitPrice", { precision: 15, scale: 3 }).notNull(),
  vatRate: decimal("vatRate", { precision: 5, scale: 2 }).default("19.00"),
  vatAmount: decimal("vatAmount", { precision: 15, scale: 3 }).default("0"),
  subtotal: decimal("subtotal", { precision: 15, scale: 3 }).notNull(),
  total: decimal("total", { precision: 15, scale: 3 }).notNull(),
  // Received
  receivedQuantity: decimal("receivedQuantity", { precision: 15, scale: 3 }).default("0"),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect;
export type InsertPurchaseOrderItem = typeof purchaseOrderItems.$inferInsert;

// ==================== GOODS RECEIPTS (Bons de réception) ====================
export const goodsReceipts = mysqlTable("goods_receipts", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  supplierId: int("supplierId").notNull(),
  purchaseOrderId: int("purchaseOrderId"),
  warehouseId: int("warehouseId"),
  // Reference
  receiptNumber: varchar("receiptNumber", { length: 50 }).notNull(),
  // Dates
  receiptDate: timestamp("receiptDate").notNull(),
  // Status
  status: mysqlEnum("status", ["draft", "received", "cancelled"]).default("draft").notNull(),
  // Notes
  notes: text("notes"),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type GoodsReceipt = typeof goodsReceipts.$inferSelect;
export type InsertGoodsReceipt = typeof goodsReceipts.$inferInsert;

// ==================== GOODS RECEIPT ITEMS ====================
export const goodsReceiptItems = mysqlTable("goods_receipt_items", {
  id: int("id").autoincrement().primaryKey(),
  goodsReceiptId: int("goodsReceiptId").notNull(),
  productId: int("productId"),
  purchaseOrderItemId: int("purchaseOrderItemId"),
  // Item Details
  description: text("description").notNull(),
  quantity: decimal("quantity", { precision: 15, scale: 3 }).notNull(),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type GoodsReceiptItem = typeof goodsReceiptItems.$inferSelect;
export type InsertGoodsReceiptItem = typeof goodsReceiptItems.$inferInsert;

// ==================== PAYMENT REMINDERS ====================
export const paymentReminders = mysqlTable("payment_reminders", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  invoiceId: int("invoiceId").notNull(),
  // Reminder Info
  reminderNumber: int("reminderNumber").default(1).notNull(),
  reminderDate: timestamp("reminderDate").notNull(),
  // Status
  status: mysqlEnum("status", ["pending", "sent", "acknowledged"]).default("pending").notNull(),
  // Content
  subject: varchar("subject", { length: 500 }),
  message: text("message"),
  // Sent Info
  sentAt: timestamp("sentAt"),
  sentTo: varchar("sentTo", { length: 320 }),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PaymentReminder = typeof paymentReminders.$inferSelect;
export type InsertPaymentReminder = typeof paymentReminders.$inferInsert;

// ==================== PROJECTS ====================
export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  clientId: int("clientId"),
  // Project Info
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 50 }),
  description: text("description"),
  // Dates
  startDate: timestamp("startDate"),
  endDate: timestamp("endDate"),
  // Budget
  budget: decimal("budget", { precision: 15, scale: 3 }),
  // Status
  status: mysqlEnum("status", ["draft", "active", "on_hold", "completed", "cancelled"]).default("draft").notNull(),
  // Progress
  progress: int("progress").default(0),
  // Notes
  notes: text("notes"),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

// ==================== PROJECT TASKS ====================
export const projectTasks = mysqlTable("project_tasks", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  // Task Info
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  // Dates
  startDate: timestamp("startDate"),
  dueDate: timestamp("dueDate"),
  completedAt: timestamp("completedAt"),
  // Status
  status: mysqlEnum("status", ["todo", "in_progress", "completed", "cancelled"]).default("todo").notNull(),
  // Priority
  priority: mysqlEnum("priority", ["low", "medium", "high"]).default("medium"),
  // Time tracking
  estimatedHours: decimal("estimatedHours", { precision: 10, scale: 2 }),
  actualHours: decimal("actualHours", { precision: 10, scale: 2 }),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProjectTask = typeof projectTasks.$inferSelect;
export type InsertProjectTask = typeof projectTasks.$inferInsert;

// ==================== ACCOUNTING ACCOUNTS (Plan comptable) ====================
export const accountingAccounts = mysqlTable("accounting_accounts", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  // Account Info
  code: varchar("code", { length: 20 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  // Type
  type: mysqlEnum("type", ["asset", "liability", "equity", "revenue", "expense"]).notNull(),
  // Parent
  parentId: int("parentId"),
  // Balance
  balance: decimal("balance", { precision: 15, scale: 3 }).default("0"),
  // Status
  isActive: boolean("isActive").default(true).notNull(),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AccountingAccount = typeof accountingAccounts.$inferSelect;
export type InsertAccountingAccount = typeof accountingAccounts.$inferInsert;

// ==================== JOURNAL ENTRIES (Écritures comptables) ====================
export const journalEntries = mysqlTable("journal_entries", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  // Entry Info
  entryNumber: varchar("entryNumber", { length: 50 }).notNull(),
  entryDate: timestamp("entryDate").notNull(),
  // Reference
  referenceType: varchar("referenceType", { length: 50 }), // invoice, payment, etc.
  referenceId: int("referenceId"),
  // Description
  description: text("description"),
  // Status
  status: mysqlEnum("status", ["draft", "posted", "cancelled"]).default("draft").notNull(),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type JournalEntry = typeof journalEntries.$inferSelect;
export type InsertJournalEntry = typeof journalEntries.$inferInsert;

// ==================== JOURNAL ENTRY LINES ====================
export const journalEntryLines = mysqlTable("journal_entry_lines", {
  id: int("id").autoincrement().primaryKey(),
  journalEntryId: int("journalEntryId").notNull(),
  accountId: int("accountId").notNull(),
  // Amounts
  debit: decimal("debit", { precision: 15, scale: 3 }).default("0"),
  credit: decimal("credit", { precision: 15, scale: 3 }).default("0"),
  // Description
  description: text("description"),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type JournalEntryLine = typeof journalEntryLines.$inferSelect;
export type InsertJournalEntryLine = typeof journalEntryLines.$inferInsert;

// ==================== FISCAL YEARS (Exercices comptables) ====================
export const fiscalYears = mysqlTable("fiscal_years", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  // Year Info
  name: varchar("name", { length: 100 }).notNull(),
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate").notNull(),
  // Status
  status: mysqlEnum("status", ["open", "closed"]).default("open").notNull(),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FiscalYear = typeof fiscalYears.$inferSelect;
export type InsertFiscalYear = typeof fiscalYears.$inferInsert;
