# Iberis.io Clone - Product Requirements Document

## Original Problem Statement
Clone complet du logiciel de facturation tunisien iberis.io avec:
- Toutes les fonctionnalités et modules
- Support bilingue (Français/Anglais)
- Authentification JWT et OAuth (Google/Facebook)
- Données mock initiales
- Flux d'onboarding obligatoire pour la création d'entreprise

## User Personas
- **Entrepreneurs tunisiens**: Petites et moyennes entreprises cherchant une solution de facturation
- **Comptables**: Gestion des factures, devis et comptabilité pour plusieurs clients
- **Freelancers**: Facturation simplifiée pour les services professionnels

## Core Requirements
1. **Authentification**: JWT + OAuth (Google)
2. **Onboarding obligatoire**: Création d'entreprise avant accès à l'application
3. **Modules de gestion**: Factures, Devis, Clients, Fournisseurs, Produits, Achats, Dépenses, Trésorerie, Comptabilité, Projets, Rapports
4. **Interface bilingue**: FR/EN avec sélecteur de langue
5. **Devises et taxes**: Support multi-devises avec TVA tunisienne (19%)

## Technical Architecture
```
/app
├── backend (FastAPI + MongoDB)
│   ├── models/       # Pydantic models
│   ├── routes/       # API routers
│   ├── utils/        # Auth helpers
│   └── server.py     # Main app
└── frontend (React + TailwindCSS)
    ├── components/   # UI components (Shadcn)
    ├── pages/        # Route pages
    ├── services/     # API services
    └── context/      # Auth & Language contexts
```

## What's Been Implemented (January 24, 2026)

### Phase 1: Authentication & Onboarding ✅ COMPLETE
- [x] JWT-based authentication (login, register, logout)
- [x] Protected routes with company verification
- [x] Mandatory company onboarding flow
- [x] Two-column onboarding form with pre-filled dropdowns
- [x] API endpoints: `/api/auth/*`, `/api/companies/`
- [x] ObjectId serialization bug fixed
- [x] Trailing slash API consistency
- [x] data-testid attributes for automated testing

### Phase 2: Core Modules (SCAFFOLDED)
- [x] Dashboard with mock KPIs
- [x] Navigation sidebar with all modules
- [x] Basic page layouts for all 11 modules

### Phase 3: CRUD Operations (IN PROGRESS)
- [ ] Full CRUD for Invoices
- [ ] Full CRUD for Quotes
- [ ] Full CRUD for Customers
- [ ] Full CRUD for Suppliers
- [ ] Full CRUD for Products

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/me` - Update profile
- `POST /api/auth/logout` - Logout

### Companies
- `POST /api/companies/` - Create company
- `GET /api/companies/` - List user companies
- `GET /api/companies/{id}/` - Get company details
- `PUT /api/companies/{id}/` - Update company
- `DELETE /api/companies/{id}/` - Delete company

## Test Credentials
- User with company: `onboard_test@test.com` / `testpass123`
- User for onboarding: `onboard_only@test.com` / `testpass123`

## Prioritized Backlog

### P0 - Critical (Next)
- [ ] Implement full CRUD for Invoices module
- [ ] Implement full CRUD for Customers module
- [ ] Implement full CRUD for Products module

### P1 - High Priority
- [ ] Quote creation and conversion to invoice
- [ ] Supplier management
- [ ] Purchase orders
- [ ] Language selector (FR/EN toggle)

### P2 - Medium Priority
- [ ] PDF generation for documents
- [ ] Email reminders for overdue invoices
- [ ] Dashboard with real data
- [ ] Expense tracking

### P3 - Future Enhancements
- [ ] OAuth integration (Google/Facebook)
- [ ] CSV/Excel import/export
- [ ] Open API for integrations
- [ ] Multi-company switching
- [ ] Collaborator invitations

## Known Issues
- Dashboard shows mock data (not connected to real database)
- Some modules are read-only (missing create/edit forms)

## Files of Reference
- `/app/contracts.md` - Full API and DB schema specification
- `/app/backend/routes/companies.py` - Company API with serialization
- `/app/frontend/src/pages/CompanyOnboarding.js` - Onboarding form
- `/app/frontend/src/App.js` - Protected routes logic
- `/app/test_reports/iteration_1.json` - Latest test results
