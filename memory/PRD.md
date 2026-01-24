# EasyBill - Product Requirements Document

## Implemented Modules

### Foundation ✅
- JWT Auth, Onboarding, Branding violet/gold

### Contacts ✅  
- Clients CRUD, Fournisseurs CRUD

### Stock ✅ (NEW)
- **Articles** - Full CRUD
- **Entrepôts** - Full CRUD avec stats (produits, valeur)
- **Inventaire** - Vue temps réel du stock par entrepôt, alertes stock bas
- **Mouvements** - Entrées/Sorties/Transferts/Ajustements

### Ventes ✅
- Factures, Devis, Bons de livraison, Avoirs, Paiements, Rappels

### Achats ✅
- Bons de commande, Factures fournisseur, Paiements fournisseur

## API Endpoints (Stock)
- `/api/warehouses/` - CRUD entrepôts
- `/api/stock-movements/` - Mouvements + `/stock-levels`

## Backlog

### P3 - Comptabilité (Next)
- Plan comptable, Écritures, Grand livre, Balance

### P4 - Future
- Dashboard données réelles
- Génération PDF
- Module Projets  
- OAuth, Support bilingue FR/EN
