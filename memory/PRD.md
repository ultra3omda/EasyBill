# EasyBill - Product Requirements Document

## Original Problem Statement
Build a full-stack invoicing and business management application named "EasyBill", inspired by iberis.io, for Tunisian businesses (TPME).

## Core Requirements
1. **Application:** Full-stack invoicing and business management
2. **Branding:** EasyBill with violet/gold color scheme
3. **Authentication:** JWT (email/password), OAuth (Google/Facebook) planned
4. **Bilingual:** French and English support planned
5. **PDF Generation:** Invoices and quotes downloadable as PDFs

## User Personas
- Small and Medium Enterprise (TPME) owners in Tunisia
- Accountants and financial managers
- Sales teams managing invoices and quotes

## Architecture
- **Frontend:** React + TailwindCSS + Shadcn UI + Recharts
- **Backend:** FastAPI + MongoDB (motor)
- **PDF:** WeasyPrint

---

## Implemented Features

### Core System
- [x] JWT Authentication (login/register)
- [x] Company Onboarding with automatic data seeding
- [x] Hierarchical navigation menu
- [x] Multi-company support

### Contacts Module ✅ (Updated 2026-01-24)
- [x] **Customers Page** - Iberis-style KPIs (Clients, Impayé, Chiffre d'affaire, Nouveaux ce mois)
- [x] **Customer Form Modal** - Dynamic form with Particulier/Entreprise toggle
  - Informations générales (Titre, Prénom, Nom, Entreprise, Email, etc.)
  - Informations professionnelles (Type, N° fiscal/CIN, Activité, Devise, Conditions de paiement)
  - Adresses de facturation et livraison avec copie automatique
  - Listes pré-remplies (Gouvernorats tunisiens, Devises, Conditions de paiement, Activités)
- [x] **Suppliers Page** - Same Iberis-style design with KPIs
- [x] **Supplier Form Modal** - Same dynamic form as customers

### Stock Module
- [x] Products CRUD
- [x] Warehouses management
- [x] Stock movements tracking
- [x] Inventory view

### Sales Module
- [x] Invoices CRUD with PDF generation
- [x] Quotes CRUD with PDF generation
- [x] Delivery Notes
- [x] Credit Notes
- [x] Payments tracking

### Purchases Module
- [x] Purchase Orders CRUD
- [x] Supplier Invoices
- [x] Supplier Payments

### Accounting Module ✅
- [x] Chart of Accounts (490 Tunisian accounts)
- [x] Accounting Dashboard with Recharts
- [x] Journal Entries CRUD
- [x] General Ledger
- [x] Trial Balance

### PDF Generation ✅
- [x] Invoice PDF with company info, fiscal stamp, total in letters
- [x] Quote PDF

### Settings
- [x] Company settings
- [x] Taxes configuration
- [x] Fiscal stamps
- [x] Access logs

---

## Prioritized Backlog

### P0 - In Progress
- [ ] **Projects Module Frontend** - Backend ready, need UI

### P1 - Next Up
- [ ] OAuth Google Integration
- [ ] Bilingual Support (FR/EN)

### P2 - Future
- [ ] Data Import/Export (CSV/Excel)
- [ ] Email reminders for overdue invoices
- [ ] External REST API (Open API)

---

## Technical Notes

### MongoDB Serialization
Always exclude `_id` from projections or convert `ObjectId` to `str` for JSON responses.

### WeasyPrint Dependencies
Required system libraries: `libpangoft2-1.0-0`, `libpango-1.0-0`, `libcairo2`, `libgdk-pixbuf-2.0-0`

### Test Credentials
- Email: demo@test.com
- Password: Demo123!
- Company ID: 69750647d138aa95c3cad9f5
