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

## Core Requirements
1. **Authentification**: JWT + OAuth (Google)
2. **Onboarding obligatoire**: Création d'entreprise avant accès à l'application
3. **Modules de gestion**: 
   - Contacts (Clients, Fournisseurs)
   - Stock (Articles, Entrepôts, Inventaire, Mouvements)
   - Ventes (Bons de livraison, Bons de sortie, Devis, Factures, Factures d'avoir, Notes de débours, Paiements, Rappels, Points de vente)
   - Achats (Bons de réception, Bons de commande, Factures fournisseur, Prestations de service, Paiements, Retenue à la source, Rappels)
   - Comptabilité (Plan comptable, Écritures, Grands Livres, Balances, Journaux légaux, Exercices, États)
   - Projets
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

### Phase 1: Rebranding - COMPLETE ✅
- [x] Renommage de "Iberis" à "EasyBill" dans toute l'application
- [x] Nouveau thème violet/gold (CSS variables)
- [x] Logo EasyBill avec gradient violet/gold
- [x] Nouveau menu hiérarchique avec sous-menus expansibles
- [x] Routes pour tous les nouveaux modules (placeholder pages)

### Phase 2: Authentication & Onboarding ✅ COMPLETE
- [x] JWT-based authentication (login, register, logout)
- [x] Protected routes with company verification
- [x] Mandatory company onboarding flow
- [x] Two-column onboarding form with pre-filled dropdowns
- [x] API endpoints: `/api/auth/*`, `/api/companies/`

### Phase 3: Core Modules (SCAFFOLDED)
- [x] Dashboard with mock KPIs (violet/gold theme)
- [x] Navigation sidebar with hierarchical menu
- [x] Basic page layouts for all modules
- [x] Placeholder pages for new modules

## Menu Structure (Complete - January 24, 2026)
- Tableau de bord
- Contacts → Clients, Fournisseurs
- Stock → Articles, Entrepôts, Inventaire, Mouvements
- Ventes → Bons de livraison, Bons de sortie, Devis, Factures, Factures d'avoir, Notes de débours, Paiements, Rappels, Points de vente
- Achats → Bons de réception, Bons de commande, Factures fournisseur, Prestations de service, Paiements, Retenue à la source, Rappels d'achats
- Comptabilité →
  - Plan comptable
  - Écritures Comptables
  - Grands Livres
  - **Balances** → Balance tiers, Balance générale
  - Journaux légaux
  - Exercices comptables
  - **États comptables** → Bilan, État de résultat, État des flux de trésorerie, États financiers
- Projets
- **Paramètres** →
  - Collaborateurs
  - Rôles & permissions
  - Entrées supplémentaires
  - Taxes
  - Banques
  - Personnalisation
  - Calendrier
  - Journal d'accès
  - Mes Fichiers
  - Mes Rapports
  - Intégrations
  - Workflows

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
- [ ] Language selector (FR/EN toggle) - functional but basic

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
- New modules use placeholder pages (not yet implemented)

## Files of Reference
- `/app/contracts.md` - Full API and DB schema specification
- `/app/backend/routes/companies.py` - Company API with serialization
- `/app/frontend/src/components/layout/AppLayout.js` - New hierarchical menu
- `/app/frontend/src/pages/CompanyOnboarding.js` - Onboarding form
- `/app/frontend/src/index.css` - Theme colors (violet/gold)
- `/app/frontend/src/i18n/translations.js` - Translations (EasyBill)
- `/app/test_reports/iteration_1.json` - Latest test results
