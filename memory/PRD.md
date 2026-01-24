# EasyBill - Product Requirements Document

## Original Problem Statement
Clone complet du logiciel de facturation tunisien (inspiré d'iberis.io) rebaptisé **EasyBill** avec:
- Toutes les fonctionnalités et modules
- Support bilingue (Français/Anglais)
- Thème violet/gold personnalisé
- Authentification JWT et OAuth (Google/Facebook)
- Données mock initiales
- Flux d'onboarding obligatoire pour la création d'entreprise

## Branding
- **Nom**: EasyBill
- **Couleurs principales**: Violet (#7c3aed) et Gold/Ambre (#f59e0b)
- **Logo**: Icône "E" violet avec texte gradient

## User Personas
- **Entrepreneurs tunisiens**: Petites et moyennes entreprises cherchant une solution de facturation
- **Comptables**: Gestion des factures, devis et comptabilité pour plusieurs clients
- **Freelancers**: Facturation simplifiée pour les services professionnels

## Technical Architecture
```
/app
├── backend (FastAPI + MongoDB)
│   ├── models/       # Pydantic models
│   ├── routes/       # API routers (auth, companies, customers, suppliers, products, invoices, quotes, payments, projects, settings)
│   ├── utils/        # Auth helpers, dependencies
│   └── server.py     # Main app
└── frontend (React + TailwindCSS)
    ├── components/   # UI components (Shadcn), modals
    ├── pages/        # Route pages
    ├── services/     # API services
    └── context/      # Auth & Language contexts
```

## What's Been Implemented

### Phase 1: Foundation - COMPLETE ✅
- [x] JWT-based authentication (login, register, logout)
- [x] Protected routes with company verification
- [x] Mandatory company onboarding flow
- [x] Complete rebranding to "EasyBill" with violet/gold theme

### Phase 2: Menu & Navigation - COMPLETE ✅
- [x] Hierarchical sidebar menu with 3-level navigation
- [x] 45+ routes configured with placeholder pages
- [x] Responsive design

### Phase 3: Default Configuration - COMPLETE ✅
- [x] Auto-creation of default taxes (TVA 19%, 13%, 7%, 0%, DC 10%, FODEC 1%)
- [x] Auto-creation of Timbre fiscal (1 TND)
- [x] Auto-creation of default payment methods
- [x] Auto-creation of default purchase categories
- [x] Access logs for all actions

### Phase 4: Contacts Module - COMPLETE ✅
- [x] Customers CRUD (create, read, update, delete)
- [x] Suppliers CRUD (create, read, update, delete)
- [x] Search and filter functionality
- [x] Stats cards with real data

### Phase 5: Stock Module - COMPLETE ✅
- [x] Products/Articles CRUD
- [x] Product types (product/service)
- [x] Stock quantity tracking
- [x] Low stock alerts

### Phase 6: Sales Module - IN PROGRESS 🔄
- [x] **Invoices (Factures)** - COMPLETE ✅
  - Full CRUD with proper ObjectId serialization
  - Line items with tax calculations
  - Send/Mark as paid actions
  - Stats cards with real data
  - Conversion from quotes
- [x] **Quotes (Devis)** - COMPLETE ✅
  - Full CRUD with proper ObjectId serialization
  - Line items with tax calculations
  - Send/Accept actions
  - Convert to invoice functionality
  - Stats cards with real data
- [ ] Delivery Notes (Bons de livraison)
- [ ] Credit Notes (Factures d'avoir)
- [ ] Payments (Paiements reçus)
- [ ] Reminders (Rappels)

### Phase 7: Settings Module - PARTIAL ✅
- [x] Taxes display page
- [x] Additional entries display page
- [x] Access logs display page
- [ ] Banks management
- [ ] Collaborators management
- [ ] Roles & permissions

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

### Companies
- `POST /api/companies/` - Create company (with default data seeding)
- `GET /api/companies/` - List user companies
- `GET /api/companies/{id}/dashboard` - Dashboard stats

### Customers & Suppliers
- Full CRUD: `GET`, `POST`, `PUT`, `DELETE` on `/api/customers/` and `/api/suppliers/`

### Products
- Full CRUD: `GET`, `POST`, `PUT`, `DELETE` on `/api/products/`
- Stock movements: `POST /api/products/{id}/stock-movement`

### Invoices
- Full CRUD: `GET`, `POST`, `PUT`, `DELETE` on `/api/invoices/`
- Actions: `POST /api/invoices/{id}/send`, `POST /api/invoices/{id}/mark-paid`

### Quotes
- Full CRUD: `GET`, `POST`, `PUT`, `DELETE` on `/api/quotes/`
- Actions: `POST /api/quotes/{id}/send`, `POST /api/quotes/{id}/accept`, `POST /api/quotes/{id}/convert`

## Prioritized Backlog

### P0 - Critical (Current Sprint)
- [ ] Complete remaining Sales module items (Delivery Notes, Credit Notes, Payments)
- [ ] Implement Purchases module (Purchase Orders, Supplier Invoices)

### P1 - High Priority
- [ ] Dashboard with real data (replace mock data)
- [ ] PDF generation for invoices and quotes
- [ ] Remaining Stock modules (Warehouses, Inventory, Movements)

### P2 - Medium Priority
- [ ] Accounting module (Chart of accounts, Journal entries)
- [ ] Projects module
- [ ] Language selector (FR/EN toggle)
- [ ] Settings CRUD (Banks, Collaborators, Roles)

### P3 - Future Enhancements
- [ ] OAuth integration (Google/Facebook)
- [ ] Email reminders for overdue invoices
- [ ] CSV/Excel import/export
- [ ] Open API for integrations

## Test Credentials
- Create new user via registration
- Test user: `onboard_test@test.com` / `testpass123`

## Known Technical Notes
- **ObjectId Serialization**: All backend routes must use `serialize_*` helper functions to convert MongoDB ObjectId to strings
- **Trailing Slashes**: FastAPI routes require trailing slashes in frontend API calls to avoid 307 redirects losing auth headers
- **Date Handling**: Dates must be converted from strings to datetime objects in create/update operations

## Files of Reference
- `/app/backend/routes/invoices.py` - Invoice API with proper serialization
- `/app/backend/routes/quotes.py` - Quote API with conversion to invoice
- `/app/frontend/src/services/api.js` - API service with trailing slashes
- `/app/frontend/src/pages/Invoices.js` - Full CRUD page example
- `/app/frontend/src/components/modals/InvoiceFormModal.js` - Create/Edit modal example

## Test Reports
- `/app/test_reports/iteration_1.json` - Onboarding flow tests
- `/app/test_reports/iteration_2.json` - Invoice module tests (17/17 passed)
