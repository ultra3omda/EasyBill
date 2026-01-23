CREATE TABLE `activity_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`companyId` int,
	`action` varchar(100) NOT NULL,
	`entityType` varchar(50),
	`entityId` int,
	`details` json,
	`ipAddress` varchar(45),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activity_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `clients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`type` enum('individual','company') NOT NULL DEFAULT 'company',
	`name` varchar(255) NOT NULL,
	`taxId` varchar(20),
	`contactName` varchar(255),
	`email` varchar(320),
	`phone` varchar(20),
	`address` text,
	`city` varchar(100),
	`postalCode` varchar(10),
	`country` varchar(100) DEFAULT 'Tunisie',
	`paymentTermDays` int DEFAULT 30,
	`category` varchar(100),
	`notes` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `companies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`legalForm` varchar(50),
	`taxId` varchar(20),
	`address` text,
	`city` varchar(100),
	`postalCode` varchar(10),
	`country` varchar(100) DEFAULT 'Tunisie',
	`phone` varchar(20),
	`email` varchar(320),
	`website` varchar(255),
	`logoUrl` varchar(500),
	`primaryColor` varchar(7) DEFAULT '#1e40af',
	`accountingPeriodStart` timestamp,
	`accountingPeriodEnd` timestamp,
	`currency` varchar(3) NOT NULL DEFAULT 'TND',
	`invoicePrefix` varchar(10) DEFAULT 'FAC',
	`invoiceNextNumber` int NOT NULL DEFAULT 1,
	`quotePrefix` varchar(10) DEFAULT 'DEV',
	`quoteNextNumber` int NOT NULL DEFAULT 1,
	`defaultVatRate` decimal(5,2) DEFAULT '19.00',
	`bankName` varchar(100),
	`bankIban` varchar(34),
	`bankBic` varchar(11),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `companies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `email_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`type` enum('invoice','quote','reminder','confirmation') NOT NULL,
	`recipientEmail` varchar(320) NOT NULL,
	`subject` varchar(500) NOT NULL,
	`referenceType` varchar(50),
	`referenceId` int,
	`status` enum('sent','failed','bounced') NOT NULL DEFAULT 'sent',
	`errorMessage` text,
	`sentAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `email_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `invoice_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`invoiceId` int NOT NULL,
	`productId` int,
	`description` text NOT NULL,
	`quantity` decimal(15,3) NOT NULL,
	`unit` varchar(20) DEFAULT 'unité',
	`unitPrice` decimal(15,3) NOT NULL,
	`vatRate` decimal(5,2) DEFAULT '19.00',
	`vatAmount` decimal(15,3) DEFAULT '0',
	`fodecRate` decimal(5,2) DEFAULT '0.00',
	`fodecAmount` decimal(15,3) DEFAULT '0',
	`consumptionTaxRate` decimal(5,2) DEFAULT '0.00',
	`consumptionTaxAmount` decimal(15,3) DEFAULT '0',
	`discount` decimal(15,3) DEFAULT '0',
	`discountType` enum('percentage','fixed') DEFAULT 'fixed',
	`subtotal` decimal(15,3) NOT NULL,
	`total` decimal(15,3) NOT NULL,
	`sortOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `invoice_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`clientId` int NOT NULL,
	`invoiceNumber` varchar(50) NOT NULL,
	`issueDate` timestamp NOT NULL,
	`dueDate` timestamp NOT NULL,
	`status` enum('draft','sent','paid','partial','overdue','cancelled') NOT NULL DEFAULT 'draft',
	`subtotal` decimal(15,3) NOT NULL DEFAULT '0',
	`totalVat` decimal(15,3) NOT NULL DEFAULT '0',
	`totalFodec` decimal(15,3) NOT NULL DEFAULT '0',
	`totalConsumptionTax` decimal(15,3) NOT NULL DEFAULT '0',
	`fiscalStamp` decimal(15,3) DEFAULT '0.600',
	`discount` decimal(15,3) DEFAULT '0',
	`discountType` enum('percentage','fixed') DEFAULT 'fixed',
	`total` decimal(15,3) NOT NULL DEFAULT '0',
	`amountPaid` decimal(15,3) NOT NULL DEFAULT '0',
	`amountDue` decimal(15,3) NOT NULL DEFAULT '0',
	`currency` varchar(3) NOT NULL DEFAULT 'TND',
	`notes` text,
	`termsAndConditions` text,
	`pdfUrl` varchar(500),
	`sentAt` timestamp,
	`lastReminderAt` timestamp,
	`reminderCount` int DEFAULT 0,
	`quoteId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `invoices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`invoiceId` int NOT NULL,
	`amount` decimal(15,3) NOT NULL,
	`paymentDate` timestamp NOT NULL,
	`paymentMethod` enum('cash','check','bank_transfer','card','other') NOT NULL DEFAULT 'bank_transfer',
	`reference` varchar(100),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`parentId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `product_categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`categoryId` int,
	`type` enum('product','service') NOT NULL DEFAULT 'product',
	`name` varchar(255) NOT NULL,
	`description` text,
	`reference` varchar(100),
	`barcode` varchar(50),
	`unitPrice` decimal(15,3) NOT NULL,
	`unit` varchar(20) DEFAULT 'unité',
	`vatRate` decimal(5,2) DEFAULT '19.00',
	`fodecRate` decimal(5,2) DEFAULT '0.00',
	`consumptionTaxRate` decimal(5,2) DEFAULT '0.00',
	`trackStock` boolean DEFAULT false,
	`stockQuantity` decimal(15,3) DEFAULT '0',
	`minStockLevel` decimal(15,3) DEFAULT '0',
	`costPrice` decimal(15,3),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quote_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`quoteId` int NOT NULL,
	`productId` int,
	`description` text NOT NULL,
	`quantity` decimal(15,3) NOT NULL,
	`unit` varchar(20) DEFAULT 'unité',
	`unitPrice` decimal(15,3) NOT NULL,
	`vatRate` decimal(5,2) DEFAULT '19.00',
	`vatAmount` decimal(15,3) DEFAULT '0',
	`fodecRate` decimal(5,2) DEFAULT '0.00',
	`fodecAmount` decimal(15,3) DEFAULT '0',
	`consumptionTaxRate` decimal(5,2) DEFAULT '0.00',
	`consumptionTaxAmount` decimal(15,3) DEFAULT '0',
	`discount` decimal(15,3) DEFAULT '0',
	`discountType` enum('percentage','fixed') DEFAULT 'fixed',
	`subtotal` decimal(15,3) NOT NULL,
	`total` decimal(15,3) NOT NULL,
	`sortOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `quote_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quotes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`clientId` int NOT NULL,
	`quoteNumber` varchar(50) NOT NULL,
	`issueDate` timestamp NOT NULL,
	`validUntil` timestamp NOT NULL,
	`status` enum('draft','sent','accepted','rejected','expired','converted') NOT NULL DEFAULT 'draft',
	`subtotal` decimal(15,3) NOT NULL DEFAULT '0',
	`totalVat` decimal(15,3) NOT NULL DEFAULT '0',
	`totalFodec` decimal(15,3) NOT NULL DEFAULT '0',
	`totalConsumptionTax` decimal(15,3) NOT NULL DEFAULT '0',
	`fiscalStamp` decimal(15,3) DEFAULT '0.600',
	`discount` decimal(15,3) DEFAULT '0',
	`discountType` enum('percentage','fixed') DEFAULT 'fixed',
	`total` decimal(15,3) NOT NULL DEFAULT '0',
	`currency` varchar(3) NOT NULL DEFAULT 'TND',
	`notes` text,
	`termsAndConditions` text,
	`pdfUrl` varchar(500),
	`sentAt` timestamp,
	`convertedInvoiceId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `quotes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stock_movements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`productId` int NOT NULL,
	`type` enum('in','out','adjustment') NOT NULL,
	`quantity` decimal(15,3) NOT NULL,
	`previousQuantity` decimal(15,3) NOT NULL,
	`newQuantity` decimal(15,3) NOT NULL,
	`referenceType` varchar(50),
	`referenceId` int,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stock_movements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `supplier_invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`supplierId` int,
	`invoiceNumber` varchar(100),
	`issueDate` timestamp,
	`dueDate` timestamp,
	`subtotal` decimal(15,3),
	`totalVat` decimal(15,3),
	`total` decimal(15,3),
	`status` enum('pending','paid','partial','cancelled') NOT NULL DEFAULT 'pending',
	`amountPaid` decimal(15,3) DEFAULT '0',
	`originalImageUrl` varchar(500),
	`ocrRawData` json,
	`ocrConfidence` decimal(5,2),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `supplier_invoices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`taxId` varchar(20),
	`contactName` varchar(255),
	`email` varchar(320),
	`phone` varchar(20),
	`address` text,
	`city` varchar(100),
	`postalCode` varchar(10),
	`country` varchar(100) DEFAULT 'Tunisie',
	`paymentTermDays` int DEFAULT 30,
	`category` varchar(100),
	`bankName` varchar(100),
	`bankIban` varchar(34),
	`notes` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `suppliers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `subscriptionPlan` enum('free','premium') DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `subscriptionExpiresAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `invoiceQuota` int DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `invoiceUsed` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `clientQuota` int DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `clientUsed` int DEFAULT 0 NOT NULL;