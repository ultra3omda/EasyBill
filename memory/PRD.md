# EasyBill - Product Requirements Document

## Original Problem Statement
Clone complet du logiciel de facturation tunisien (inspiré d'iberis.io) rebaptisé **EasyBill** avec:
- Toutes les fonctionnalités et modules
- Support bilingue (Français/Anglais)
- Thème violet/gold personnalisé
- Authentification JWT et OAuth (Google/Facebook)
- Données mock initiales
- Flux d'onboarding obligatoire pour la création d'entreprise

## What's Been Implemented

### Phase 1-5: Foundation - COMPLETE ✅
- JWT-based authentication
- Mandatory company onboarding with data seeding
- Complete rebranding "EasyBill" violet/gold
- Contacts: Clients & Fournisseurs CRUD
- Stock: Articles CRUD

### Phase 6: Sales Module - COMPLETE ✅
- **Factures (Invoices)** - Full CRUD + Send/Pay actions
- **Devis (Quotes)** - Full CRUD + Convert to invoice
- **Bons de livraison** - Full CRUD + Deliver action
- **Factures d'avoir (Credit Notes)** - Full CRUD + Apply action  
- **Paiements reçus** - Full CRUD with invoice allocation, multi-payment methods (espèces, chèque, virement, carte, e-dinar)
- **Rappels** - Full CRUD + Send/Resolve actions

### Phase 7: Settings Module - PARTIAL ✅
- Taxes, Additional entries, Access logs display

## API Endpoints

### Sales Module (NEW)
- `/api/invoices/` - Full CRUD + `/send`, `/mark-paid`
- `/api/quotes/` - Full CRUD + `/send`, `/accept`, `/convert`
- `/api/delivery-notes/` - Full CRUD + `/deliver`
- `/api/credit-notes/` - Full CRUD + `/apply`
- `/api/payments/` - Full CRUD + `/pending-invoices`
- `/api/reminders/` - Full CRUD + `/send`, `/resolve`

## Prioritized Backlog

### P1 - Achats Module (Next)
- [ ] Bons de commande fournisseur
- [ ] Factures fournisseur  
- [ ] Paiements effectués

### P2 - Stock Compléments
- [ ] Entrepôts
- [ ] Inventaire
- [ ] Mouvements de stock

### P3 - Comptabilité
- [ ] Plan comptable
- [ ] Écritures comptables
- [ ] Grand livre, Balance, Journaux

### P4 - Future
- [ ] Dashboard données réelles
- [ ] Génération PDF
- [ ] Module Projets
- [ ] OAuth Google/Facebook
- [ ] Support bilingue FR/EN

## Key Technical Notes
- All backend routes use `serialize_*` helpers for ObjectId conversion
- Frontend uses trailing slashes in API calls
- Payment methods: cash, check, transfer, card, e_dinar

## Files of Reference
- `/app/backend/routes/payments.py` - Payment with invoice allocation
- `/app/frontend/src/pages/Payments.js` - Payment form with invoice selection
- `/app/frontend/src/pages/Reminders.js` - Reminder management

## Test Reports
- `/app/test_reports/iteration_2.json` - Invoice module tests (17/17 passed)
