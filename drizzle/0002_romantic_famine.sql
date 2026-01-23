CREATE TABLE `accounting_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`code` varchar(20) NOT NULL,
	`name` varchar(255) NOT NULL,
	`type` enum('asset','liability','equity','revenue','expense') NOT NULL,
	`parentId` int,
	`balance` decimal(15,3) DEFAULT '0',
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `accounting_accounts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `credit_note_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`creditNoteId` int NOT NULL,
	`productId` int,
	`description` text NOT NULL,
	`quantity` decimal(15,3) NOT NULL,
	`unitPrice` decimal(15,3) NOT NULL,
	`vatRate` decimal(5,2) DEFAULT '19.00',
	`vatAmount` decimal(15,3) DEFAULT '0',
	`subtotal` decimal(15,3) NOT NULL,
	`total` decimal(15,3) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `credit_note_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `credit_notes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`clientId` int NOT NULL,
	`invoiceId` int,
	`noteNumber` varchar(50) NOT NULL,
	`issueDate` timestamp NOT NULL,
	`status` enum('draft','issued','applied','cancelled') NOT NULL DEFAULT 'draft',
	`subtotal` decimal(15,3) NOT NULL DEFAULT '0',
	`totalVat` decimal(15,3) NOT NULL DEFAULT '0',
	`total` decimal(15,3) NOT NULL DEFAULT '0',
	`reason` text,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `credit_notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `delivery_note_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`deliveryNoteId` int NOT NULL,
	`productId` int,
	`description` text NOT NULL,
	`quantity` decimal(15,3) NOT NULL,
	`unit` varchar(20) DEFAULT 'unité',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `delivery_note_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `delivery_notes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`clientId` int NOT NULL,
	`invoiceId` int,
	`noteNumber` varchar(50) NOT NULL,
	`issueDate` timestamp NOT NULL,
	`deliveryDate` timestamp,
	`status` enum('draft','delivered','cancelled') NOT NULL DEFAULT 'draft',
	`deliveryAddress` text,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `delivery_notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fiscal_years` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`startDate` timestamp NOT NULL,
	`endDate` timestamp NOT NULL,
	`status` enum('open','closed') NOT NULL DEFAULT 'open',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fiscal_years_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `goods_receipt_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`goodsReceiptId` int NOT NULL,
	`productId` int,
	`purchaseOrderItemId` int,
	`description` text NOT NULL,
	`quantity` decimal(15,3) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `goods_receipt_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `goods_receipts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`supplierId` int NOT NULL,
	`purchaseOrderId` int,
	`warehouseId` int,
	`receiptNumber` varchar(50) NOT NULL,
	`receiptDate` timestamp NOT NULL,
	`status` enum('draft','received','cancelled') NOT NULL DEFAULT 'draft',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `goods_receipts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inventory_count_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`inventoryCountId` int NOT NULL,
	`productId` int NOT NULL,
	`expectedQuantity` decimal(15,3) NOT NULL,
	`countedQuantity` decimal(15,3),
	`difference` decimal(15,3),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inventory_count_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inventory_counts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`warehouseId` int,
	`reference` varchar(100),
	`countDate` timestamp NOT NULL,
	`status` enum('draft','in_progress','completed','cancelled') NOT NULL DEFAULT 'draft',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`completedAt` timestamp,
	CONSTRAINT `inventory_counts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `journal_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`entryNumber` varchar(50) NOT NULL,
	`entryDate` timestamp NOT NULL,
	`referenceType` varchar(50),
	`referenceId` int,
	`description` text,
	`status` enum('draft','posted','cancelled') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `journal_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `journal_entry_lines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`journalEntryId` int NOT NULL,
	`accountId` int NOT NULL,
	`debit` decimal(15,3) DEFAULT '0',
	`credit` decimal(15,3) DEFAULT '0',
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `journal_entry_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payment_reminders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`invoiceId` int NOT NULL,
	`reminderNumber` int NOT NULL DEFAULT 1,
	`reminderDate` timestamp NOT NULL,
	`status` enum('pending','sent','acknowledged') NOT NULL DEFAULT 'pending',
	`subject` varchar(500),
	`message` text,
	`sentAt` timestamp,
	`sentTo` varchar(320),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payment_reminders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `project_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`startDate` timestamp,
	`dueDate` timestamp,
	`completedAt` timestamp,
	`status` enum('todo','in_progress','completed','cancelled') NOT NULL DEFAULT 'todo',
	`priority` enum('low','medium','high') DEFAULT 'medium',
	`estimatedHours` decimal(10,2),
	`actualHours` decimal(10,2),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `project_tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`clientId` int,
	`name` varchar(255) NOT NULL,
	`code` varchar(50),
	`description` text,
	`startDate` timestamp,
	`endDate` timestamp,
	`budget` decimal(15,3),
	`status` enum('draft','active','on_hold','completed','cancelled') NOT NULL DEFAULT 'draft',
	`progress` int DEFAULT 0,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `purchase_order_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`purchaseOrderId` int NOT NULL,
	`productId` int,
	`description` text NOT NULL,
	`quantity` decimal(15,3) NOT NULL,
	`unitPrice` decimal(15,3) NOT NULL,
	`vatRate` decimal(5,2) DEFAULT '19.00',
	`vatAmount` decimal(15,3) DEFAULT '0',
	`subtotal` decimal(15,3) NOT NULL,
	`total` decimal(15,3) NOT NULL,
	`receivedQuantity` decimal(15,3) DEFAULT '0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `purchase_order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `purchase_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`supplierId` int NOT NULL,
	`orderNumber` varchar(50) NOT NULL,
	`orderDate` timestamp NOT NULL,
	`expectedDeliveryDate` timestamp,
	`status` enum('draft','sent','confirmed','received','partial','cancelled') NOT NULL DEFAULT 'draft',
	`subtotal` decimal(15,3) NOT NULL DEFAULT '0',
	`totalVat` decimal(15,3) NOT NULL DEFAULT '0',
	`total` decimal(15,3) NOT NULL DEFAULT '0',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `purchase_orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `warehouse_stock` (
	`id` int AUTO_INCREMENT NOT NULL,
	`warehouseId` int NOT NULL,
	`productId` int NOT NULL,
	`quantity` decimal(15,3) NOT NULL DEFAULT '0',
	`minQuantity` decimal(15,3) DEFAULT '0',
	`maxQuantity` decimal(15,3),
	`location` varchar(100),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `warehouse_stock_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `warehouses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`code` varchar(50),
	`address` text,
	`city` varchar(100),
	`postalCode` varchar(10),
	`contactName` varchar(255),
	`phone` varchar(20),
	`isDefault` boolean DEFAULT false,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `warehouses_id` PRIMARY KEY(`id`)
);
