# EasyBill - Product Requirements Document

## What's Been Implemented

### Phase 1-5: Foundation - COMPLETE ✅
- JWT authentication, Onboarding, Branding, Contacts, Stock

### Phase 6: Sales Module - COMPLETE ✅
- Factures, Devis, Bons de livraison, Avoirs, Paiements reçus, Rappels

### Phase 7: Purchases Module - COMPLETE ✅
- **Bons de commande fournisseur** - Full CRUD + Send/Confirm/Receive
- **Factures fournisseur** - Full CRUD with balance tracking
- **Paiements fournisseur** - Full CRUD with invoice allocation

## API Endpoints

### Purchases Module (NEW)
- `/api/purchase-orders/` - CRUD + `/send`, `/confirm`, `/receive`
- `/api/supplier-invoices/` - CRUD + `/pending`
- `/api/supplier-payments/` - CRUD

## Prioritized Backlog

### P2 - Stock Compléments (Next)
- [ ] Entrepôts
- [ ] Inventaire
- [ ] Mouvements de stock

### P3 - Comptabilité
- [ ] Plan comptable
- [ ] Écritures comptables
- [ ] Grand livre, Balance, Journaux

### P4 - Future
- Dashboard données réelles
- Génération PDF
- Module Projets
- OAuth, Support bilingue FR/EN
