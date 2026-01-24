# EasyBill - Product Requirements Document

## Project Overview
Full-stack invoicing and business management application (clone of iberis.io) with Tunisian accounting standards compliance.

---

## ✅ IMPLEMENTED MODULES

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
- **Bons de livraison** - Full CRUD
- **Factures d'avoir (Credit Notes)** - Full CRUD
- **Paiements reçus** - Full CRUD (Espèces, Chèque, Virement)
- **Rappels** - Full CRUD

### Achats (Purchases) ✅
- **Bons de commande (Purchase Orders)** - Full CRUD
- **Factures fournisseur (Supplier Invoices)** - Full CRUD
- **Paiements effectués (Supplier Payments)** - Full CRUD

### Comptabilité (Accounting) ✅ (Jan 2026)
- **Plan Comptable Tunisien (SCE)** - 490 accounts auto-seeded
- **Tableau de Bord Comptable** - Charts (Pie & Bar), stats, quick links
- **Écritures Comptables (Journal Entries)** - Full CRUD with post/cancel
- **Grand Livre (General Ledger)** - By account with date filter
- **Balance des Comptes (Trial Balance)** - Balanced/unbalanced status

---

## API Endpoints

### Accounting
- `GET /api/accounting/dashboard` - Dashboard with charts data
- `GET /api/accounting/accounts` - List chart of accounts
- `POST /api/accounting/accounts` - Create custom account
- `PUT/DELETE /api/accounting/accounts/{id}` - Update/delete account
- `GET /api/accounting/general-ledger` - General ledger
- `GET /api/accounting/trial-balance` - Trial balance
- `POST /api/accounting/seed-chart-of-accounts` - Seed for existing company

### Journal Entries
- `GET /api/journal-entries/` - List entries (with filters)
- `POST /api/journal-entries/` - Create balanced entry
- `GET /api/journal-entries/{id}` - Get entry details
- `PUT /api/journal-entries/{id}` - Update draft entry
- `DELETE /api/journal-entries/{id}` - Delete draft entry
- `POST /api/journal-entries/{id}/post` - Post entry (updates balances)
- `POST /api/journal-entries/{id}/cancel` - Cancel entry (reverses balances)
- `GET /api/journal-entries/stats` - Entry statistics

---

## Database Collections

### journal_entries
```json
{
  "entry_number": "EC-00001",
  "date": datetime,
  "reference": "FAC-001",
  "description": "Achat fournitures",
  "journal_type": "purchases",
  "lines": [
    {"account_code": "6064", "debit": 100, "credit": 0, "description": "..."},
    {"account_code": "401", "debit": 0, "credit": 100, "description": "..."}
  ],
  "total_debit": 100,
  "total_credit": 100,
  "status": "posted",
  "company_id": ObjectId,
  "created_at": datetime,
  "posted_at": datetime
}
```

---

## Tech Stack
- **Frontend:** React, React Router, TailwindCSS, Shadcn UI, Recharts
- **Backend:** FastAPI, Pydantic, MongoDB with motor
- **Authentication:** JWT

---

## Test Coverage
- `/app/backend/tests/test_accounting_crud.py` - Chart of accounts (21 tests)
- `/app/backend/tests/test_journal_entries.py` - Journal entries (30 tests)
- `/app/test_reports/iteration_4.json` - Latest test report (100% pass)

---

## BACKLOG

### P0 - Priority
- [ ] PDF generation for invoices/quotes (jspdf or fpdf2)

### P1 - High Priority
- [ ] Module Projets with tasks and timesheets
- [ ] Journaux légaux (Sales, Purchases, Bank, Cash journals)
- [ ] États comptables (Bilan, État de résultat)

### P2 - Medium Priority
- [ ] OAuth (Google/Facebook)
- [ ] Bilingual support (FR/EN) with i18n
- [ ] Data import/export (CSV/Excel)
- [ ] Automated email reminders

### P3 - Low Priority
- [ ] Cash flow statement
- [ ] External API (Open API)
- [ ] Advanced reporting

---

## Test Credentials
- Email: comptable@test.com
- Password: Test123!
- Company ID: 6974f559a9d10a5493c3241a

---

## Change Log

### Jan 24, 2026
- ✅ Implemented Accounting Dashboard with Recharts charts
- ✅ Implemented Journal Entries CRUD with post/cancel
- ✅ Implemented General Ledger (Grand Livre)
- ✅ Implemented Trial Balance (Balance des comptes)
- ✅ All 30 backend tests passing

### Jan 23, 2026
- ✅ Implemented Chart of Accounts (490 Tunisian accounts)
- ✅ Auto-seeding on company creation
