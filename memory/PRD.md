# EasyBill - Product Requirements Document

## Project Overview
Full-stack invoicing and business management application (clone of iberis.io) with Tunisian accounting standards compliance.

## Implemented Modules

### Foundation ✅
- JWT Authentication (email/password)
- Company Onboarding with default data seeding
- Branding: EasyBill - violet/gold theme
- Hierarchical menu navigation

### Contacts ✅  
- **Clients** - Full CRUD with stats
- **Fournisseurs** - Full CRUD

### Stock ✅
- **Articles (Products)** - Full CRUD
- **Entrepôts (Warehouses)** - Full CRUD with stats
- **Inventaire** - Real-time stock view by warehouse
- **Mouvements** - Stock movements (In/Out/Transfer/Adjustment)

### Ventes (Sales) ✅
- **Factures (Invoices)** - Full CRUD
- **Devis (Quotes)** - Full CRUD, convert to invoice
- **Bons de livraison** - Scaffolded
- **Factures d'avoir (Credit Notes)** - Scaffolded
- **Paiements reçus** - Scaffolded
- **Rappels** - Scaffolded

### Achats (Purchases) ✅
- **Bons de commande (Purchase Orders)** - Scaffolded
- **Factures fournisseur (Supplier Invoices)** - Scaffolded
- **Paiements effectués (Supplier Payments)** - Scaffolded

### Comptabilité (Accounting) ✅ (NEW - Jan 2026)
- **Plan Comptable Tunisien (SCE)** - Full implementation
  - 490 accounts auto-seeded for new companies
  - 7 classes: Capitaux (1), Actifs non courants (2), Stocks (3), Tiers (4), Financiers (5), Charges (6), Produits (7)
  - Hierarchical tree view with expand/collapse
  - Search by code or name
  - Filter by account type
  - CRUD for custom accounts
  - System account protection (cannot delete)

## API Endpoints

### Accounting (NEW)
- `GET /api/accounting/accounts` - List accounts (with type filter, search)
- `GET /api/accounting/accounts/{id}` - Get single account
- `POST /api/accounting/accounts` - Create custom account
- `PUT /api/accounting/accounts/{id}` - Update account
- `DELETE /api/accounting/accounts/{id}` - Delete custom account
- `GET /api/accounting/account-types` - Get 7 account type classes
- `POST /api/accounting/seed-chart-of-accounts` - Seed chart for existing company

### Stock
- `/api/warehouses/` - CRUD warehouses
- `/api/stock-movements/` - Movements + `/stock-levels`

### Sales
- `/api/invoices/` - CRUD invoices
- `/api/quotes/` - CRUD quotes
- `/api/delivery-notes/` - CRUD delivery notes
- `/api/credit-notes/` - CRUD credit notes
- `/api/payments/` - CRUD payments

### Purchases
- `/api/purchase-orders/` - CRUD purchase orders
- `/api/supplier-invoices/` - CRUD supplier invoices
- `/api/supplier-payments/` - CRUD supplier payments

## Database Collections

### chart_of_accounts (NEW)
```json
{
  "code": "411",
  "name": "Clients",
  "type": "asset",
  "is_group": true,
  "parent_code": "41",
  "company_id": ObjectId,
  "is_system": true,
  "is_active": true,
  "balance": 0,
  "notes": null,
  "created_at": datetime
}
```

## Tech Stack
- **Frontend:** React, React Router, TailwindCSS, Shadcn UI
- **Backend:** FastAPI, Pydantic, MongoDB with motor
- **Authentication:** JWT

## Test Coverage
- `/app/backend/tests/test_accounting_crud.py` - 21 tests, 100% pass
- `/app/test_reports/iteration_3.json` - Latest test report

## Backlog

### P0 - In Progress
- ✅ Plan Comptable Tunisien (COMPLETED)
- Full CRUD for scaffolded modules (Delivery Notes, Credit Notes, etc.)

### P1 - Next
- Journal entries (Écritures comptables)
- Grand livre (Ledger)
- Balance des comptes
- PDF generation for invoices/quotes
- Manual payment types (Espèces, Chèque, Virement)

### P2 - Future
- Dashboard with real data
- Module Projets
- OAuth (Google/Facebook)
- Bilingual support (FR/EN)
- Data import/export (CSV/Excel)

## Test Credentials
- Email: comptable@test.com
- Password: Test123!
- Company ID: 6974f559a9d10a5493c3241a
