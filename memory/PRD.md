# EasyBill - Product Requirements Document

## Project Overview
Full-stack invoicing and business management application (clone of iberis.io) with Tunisian accounting standards compliance.

---

## ✅ IMPLEMENTED MODULES (Jan 2026)

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
- **Factures (Invoices)** - Full CRUD + **PDF Generation**
- **Devis (Quotes)** - Full CRUD + **PDF Generation** + Convert to invoice
- **Bons de livraison** - Full CRUD + **PDF Generation**
- **Factures d'avoir (Credit Notes)** - Full CRUD
- **Paiements reçus** - Full CRUD (Espèces, Chèque, Virement)
- **Rappels** - Full CRUD

### Achats (Purchases) ✅
- **Bons de commande (Purchase Orders)** - Full CRUD
- **Factures fournisseur (Supplier Invoices)** - Full CRUD
- **Paiements effectués (Supplier Payments)** - Full CRUD

### Comptabilité (Accounting) ✅
- **Plan Comptable Tunisien (SCE)** - 490 accounts auto-seeded
- **Tableau de Bord Comptable** - Charts (Pie & Bar), stats, quick links
- **Écritures Comptables (Journal Entries)** - Full CRUD with post/cancel
- **Grand Livre (General Ledger)** - By account with date filter
- **Balance des Comptes (Trial Balance)** - Balanced/unbalanced status

### PDF Generation ✅ (NEW)
- **WeasyPrint** integration for professional PDF generation
- **Factures** - PDF with fiscal stamp, amount in words
- **Devis** - PDF with validity date, conditions
- **Bons de livraison** - PDF with signature zones
- API endpoints: `/api/pdf/invoice/{id}`, `/api/pdf/quote/{id}`, `/api/pdf/delivery-note/{id}`

### Module Projets ✅ (UPDATED)
- **Projets** - Full CRUD with customer link, budget, hourly rate
- **Tâches** - Full CRUD with status (todo, in_progress, review, completed), priority
- **Timesheets** - Full CRUD with billable tracking
- Stats endpoint with totals

---

## API Endpoints

### PDF Generation (NEW)
- `GET /api/pdf/invoice/{id}` - Generate invoice PDF
- `GET /api/pdf/quote/{id}` - Generate quote PDF
- `GET /api/pdf/delivery-note/{id}` - Generate delivery note PDF

### Projects (UPDATED)
- `GET /api/projects/stats` - Project statistics
- `GET /api/projects/` - List projects
- `POST /api/projects/` - Create project
- `GET /api/projects/{id}` - Get project
- `PUT /api/projects/{id}` - Update project
- `DELETE /api/projects/{id}` - Delete project
- `GET /api/projects/{id}/tasks` - List tasks
- `POST /api/projects/{id}/tasks` - Create task
- `PUT /api/projects/{id}/tasks/{task_id}` - Update task
- `DELETE /api/projects/{id}/tasks/{task_id}` - Delete task
- `GET /api/projects/{id}/timesheets` - List timesheets
- `POST /api/projects/{id}/timesheets` - Create timesheet
- `DELETE /api/projects/{id}/timesheets/{ts_id}` - Delete timesheet

---

## Tech Stack
- **Frontend:** React, React Router, TailwindCSS, Shadcn UI, Recharts
- **Backend:** FastAPI, Pydantic, MongoDB with motor, WeasyPrint
- **Authentication:** JWT

---

## Test Coverage
- `/app/backend/tests/test_accounting_crud.py` - Chart of accounts
- `/app/backend/tests/test_journal_entries.py` - Journal entries
- `/app/test_reports/iteration_4.json` - Latest report (100% pass)

---

## BACKLOG

### P0 - In Progress
- [ ] Frontend Projects page (Tâches, Timesheets)
- [ ] OAuth Google integration

### P1 - High Priority
- [ ] Bilingual support (FR/EN) with i18n
- [ ] États comptables (Bilan, État de résultat)
- [ ] Journaux légaux

### P2 - Medium Priority
- [ ] Data import/export (CSV/Excel)
- [ ] Automated email reminders
- [ ] Cash flow statement

### P3 - Low Priority
- [ ] OAuth Facebook
- [ ] External API (Open API)
- [ ] Advanced reporting

---

## Test Credentials
- Email: comptable@test.com
- Password: Test123!
- Company ID: 6974f559a9d10a5493c3241a

---

## Change Log

### Jan 24, 2026 (Session 2)
- ✅ PDF Generation with WeasyPrint (Factures, Devis, Bons de livraison)
- ✅ Updated Projects backend with Tasks and Timesheets CRUD
- ✅ PDF includes fiscal stamp, amount in words (French)

### Jan 24, 2026 (Session 1)
- ✅ Accounting Dashboard with Recharts
- ✅ Journal Entries CRUD with post/cancel
- ✅ General Ledger and Trial Balance
- ✅ 30 backend tests passing
