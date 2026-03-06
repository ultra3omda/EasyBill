# 📊 Synchronisation Comptable Automatique - EasyBill

## Vue d'ensemble

Le système de synchronisation comptable automatique génère automatiquement les écritures comptables pour toutes les opérations transactionnelles de l'application EasyBill, conformément aux normes comptables tunisiennes.

## 🎯 Objectifs

- **Automatisation complète** : Aucune saisie manuelle d'écritures comptables nécessaire
- **Conformité tunisienne** : Respect du plan comptable tunisien (SCE)
- **Traçabilité** : Lien bidirectionnel entre documents et écritures comptables
- **Fiabilité** : Validation automatique de l'équilibre débit/crédit
- **Flexibilité** : Re-synchronisation manuelle possible en cas de besoin

## 📋 Opérations synchronisées

### 1. Factures clients (Ventes)

**Déclenchement** : Changement de statut vers `sent` ou `paid`

**Écriture générée** :
```
Débit  411 Clients                     [Total TTC]
Crédit 707 Ventes de marchandises      [Montant HT]
Crédit 4351 TVA à payer                [Montant TVA]
```

**Variantes** :
- Si service : compte 706 au lieu de 707
- Si remise : débit 709 (Rabais accordés)

**Exemple** :
```
Facture FAC-2026-0001 : 1000 DT HT + 190 DT TVA = 1190 DT TTC

Débit  411 Clients                     1190.000
Crédit 707 Ventes de marchandises      1000.000
Crédit 4351 TVA à payer                 190.000
```

### 2. Paiements clients (Encaissements)

**Déclenchement** : Création du paiement

**Écriture générée** :
```
Débit  521 Banques (ou 531 Caisse)     [Montant]
Crédit 411 Clients                     [Montant]
```

**Exemple** :
```
Paiement PAY-2026-00001 : 1190 DT

Débit  521 Banques                     1190.000
Crédit 411 Clients                     1190.000
```

### 3. Factures fournisseurs (Achats)

**Déclenchement** : Changement de statut vers `validated`

**Écriture générée** :
```
Débit  607 Achats de marchandises      [Montant HT]
Débit  4362 TVA récupérable            [Montant TVA]
Crédit 401 Fournisseurs                [Total TTC]
```

**Variantes** :
- Si service : compte 604 au lieu de 607
- Si matière première : compte 601 au lieu de 607

**Exemple** :
```
Facture fournisseur FF-2026-0001 : 500 DT HT + 95 DT TVA = 595 DT TTC

Débit  607 Achats de marchandises       500.000
Débit  4362 TVA récupérable              95.000
Crédit 401 Fournisseurs                 595.000
```

### 4. Paiements fournisseurs (Décaissements)

**Déclenchement** : Création du paiement

**Écriture générée** :
```
Débit  401 Fournisseurs                [Montant]
Crédit 521 Banques (ou 531 Caisse)     [Montant]
```

**Exemple** :
```
Paiement fournisseur PAY-F-2026-00001 : 595 DT

Débit  401 Fournisseurs                 595.000
Crédit 521 Banques                      595.000
```

### 5. Mouvements de stock

**Déclenchement** : Création du mouvement (si valeur > 0)

**Entrée de stock** :
```
Débit  370 Stock de marchandises       [Quantité × Prix unitaire]
Crédit 6087 Variation des stocks       [Quantité × Prix unitaire]
```

**Sortie de stock** :
```
Débit  6087 Variation des stocks       [Quantité × Prix unitaire]
Crédit 370 Stock de marchandises       [Quantité × Prix unitaire]
```

**Exemple entrée** :
```
Entrée stock : 100 unités × 10 DT = 1000 DT

Débit  370 Stock de marchandises       1000.000
Crédit 6087 Variation des stocks       1000.000
```

### 6. Avoirs clients (Notes de crédit)

**Déclenchement** : Changement de statut vers `validated`

**Écriture générée** (inverse de la facture) :
```
Débit  707 Ventes de marchandises      [Montant HT]
Débit  4351 TVA à payer                [Montant TVA]
Crédit 411 Clients                     [Total TTC]
```

**Exemple** :
```
Avoir AV-2026-0001 : 200 DT HT + 38 DT TVA = 238 DT TTC

Débit  707 Ventes de marchandises       200.000
Débit  4351 TVA à payer                  38.000
Crédit 411 Clients                      238.000
```

## 🔧 Architecture technique

### Service principal

**Fichier** : `backend/services/accounting_sync_service.py`

**Classe** : `AccountingSyncService`

**Méthodes publiques** :
- `sync_invoice(invoice_id)` - Synchronise une facture client
- `sync_payment(payment_id)` - Synchronise un paiement client
- `sync_supplier_invoice(invoice_id)` - Synchronise une facture fournisseur
- `sync_supplier_payment(payment_id)` - Synchronise un paiement fournisseur
- `sync_stock_movement(movement_id)` - Synchronise un mouvement de stock
- `sync_credit_note(credit_note_id)` - Synchronise un avoir client
- `resync_all_documents(company_id, document_type)` - Re-synchronise tous les documents

### Hooks automatiques

Les hooks sont intégrés dans les routes suivantes :

| Route | Fichier | Hook |
|-------|---------|------|
| Factures clients | `routes/invoices.py` | Après changement statut → sent/paid |
| Paiements clients | `routes/payments.py` | Après création |
| Factures fournisseurs | `routes/supplier_invoices.py` | Après changement statut → validated |
| Paiements fournisseurs | `routes/supplier_payments.py` | Après création |
| Mouvements de stock | `routes/stock_movements.py` | Après création |
| Avoirs clients | `routes/credit_notes.py` | Après changement statut → validated |

### API de synchronisation manuelle

**Fichier** : `routes/accounting_sync.py`

**Endpoints disponibles** :

```
POST /api/accounting-sync/sync-invoice/{invoice_id}
POST /api/accounting-sync/sync-payment/{payment_id}
POST /api/accounting-sync/sync-supplier-invoice/{invoice_id}
POST /api/accounting-sync/sync-supplier-payment/{payment_id}
POST /api/accounting-sync/sync-stock-movement/{movement_id}
POST /api/accounting-sync/sync-credit-note/{credit_note_id}
POST /api/accounting-sync/resync-all?document_type=invoices
```

## 📊 Structure des écritures

Chaque écriture comptable générée contient :

```json
{
  "company_id": ObjectId,
  "date": DateTime,
  "reference": "VE-2026-0001",
  "description": "Facture client FAC-2026-0001 - Client ABC",
  "journal_type": "sales",
  "lines": [
    {
      "account_code": "411",
      "account_name": "Clients",
      "debit": 1190.000,
      "credit": 0,
      "description": "Facture FAC-2026-0001"
    },
    {
      "account_code": "707",
      "account_name": "Ventes de marchandises",
      "debit": 0,
      "credit": 1000.000,
      "description": "Vente facture FAC-2026-0001"
    },
    {
      "account_code": "4351",
      "account_name": "État - TVA à payer",
      "debit": 0,
      "credit": 190.000,
      "description": "TVA facture FAC-2026-0001"
    }
  ],
  "document_type": "invoice",
  "document_id": ObjectId,
  "status": "posted",
  "auto_generated": true,
  "created_at": DateTime
}
```

## 🔍 Validation et contrôles

### Contrôles automatiques

1. **Équilibre débit/crédit** : Tolérance de 0.01 DT
2. **Statut du document** : Vérification avant synchronisation
3. **Duplication** : Détection des documents déjà synchronisés
4. **Valeurs** : Validation des montants > 0

### Gestion d'erreurs

- Les erreurs de synchronisation sont loggées mais ne bloquent pas l'opération principale
- Un document peut être re-synchronisé manuellement en cas d'échec
- Les écritures mal équilibrées sont rejetées automatiquement

## 📈 Numérotation des écritures

Format : `{TYPE}-{ANNÉE}-{NUMÉRO}`

**Types de journaux** :
- `VE` - Ventes (sales)
- `AC` - Achats (purchases)
- `BQ` - Banque (bank)
- `CA` - Caisse (cash)
- `ST` - Stock (stock)
- `OD` - Opérations Diverses (general)

**Exemple** : `VE-2026-0001`, `AC-2026-0042`, `BQ-2026-0123`

## 🛠️ Utilisation

### Synchronisation automatique

Aucune action nécessaire. Les écritures sont générées automatiquement lors des opérations.

### Synchronisation manuelle d'un document

```bash
curl -X POST "http://localhost:8000/api/accounting-sync/sync-invoice/65abc123def456789" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"company_id": "65xyz789abc123456"}'
```

### Re-synchronisation globale

```bash
# Re-synchroniser toutes les factures d'une entreprise
curl -X POST "http://localhost:8000/api/accounting-sync/resync-all?company_id=65xyz789abc123456&document_type=invoices" \
  -H "Authorization: Bearer {token}"

# Re-synchroniser tous les types de documents
curl -X POST "http://localhost:8000/api/accounting-sync/resync-all?company_id=65xyz789abc123456" \
  -H "Authorization: Bearer {token}"
```

**Réponse** :
```json
{
  "message": "Re-synchronisation terminée: 145/150 documents synchronisés, 5 erreurs",
  "results": {
    "invoices": {"total": 50, "synced": 48, "errors": 2},
    "payments": {"total": 40, "synced": 40, "errors": 0},
    "supplier_invoices": {"total": 30, "synced": 28, "errors": 2},
    "supplier_payments": {"total": 20, "synced": 20, "errors": 0},
    "stock_movements": {"total": 10, "synced": 9, "errors": 1},
    "credit_notes": {"total": 0, "synced": 0, "errors": 0}
  },
  "summary": {
    "total": 150,
    "synced": 145,
    "errors": 5
  }
}
```

## 🔗 Traçabilité

### Document → Écriture

Chaque document synchronisé contient un champ `accounting_entry_id` qui pointe vers l'écriture générée.

```json
{
  "_id": "65abc123def456789",
  "number": "FAC-2026-0001",
  "total": 1190.00,
  "accounting_entry_id": "65def456abc789123"
}
```

### Écriture → Document

Chaque écriture contient les champs `document_type` et `document_id` qui pointent vers le document source.

```json
{
  "_id": "65def456abc789123",
  "reference": "VE-2026-0001",
  "document_type": "invoice",
  "document_id": "65abc123def456789"
}
```

## 📝 Plan comptable tunisien utilisé

### Classe 1 - Capitaux propres
- Non utilisé actuellement

### Classe 2 - Actifs immobilisés
- Non utilisé actuellement

### Classe 3 - Stocks
- **370** - Stock de marchandises

### Classe 4 - Tiers
- **401** - Fournisseurs d'exploitation
- **411** - Clients
- **4351** - État - TVA à payer
- **4362** - TVA récupérable sur achats et charges

### Classe 5 - Trésorerie
- **521** - Banques
- **531** - Caisse en monnaie nationale

### Classe 6 - Charges
- **601** - Achats de matières premières
- **604** - Achats de services
- **607** - Achats de marchandises
- **6087** - Variation des stocks de marchandises
- **709** - Rabais, remises et ristournes accordés (en négatif)

### Classe 7 - Produits
- **706** - Prestations de services
- **707** - Ventes de marchandises

## 🚀 Évolutions futures

### Fonctionnalités prévues

1. **Avances et acomptes** (comptes 409, 419)
2. **Charges d'exploitation** (6xxx → 401)
3. **Régularisations** (46x)
4. **Immobilisations** (2xx)
5. **Amortissements** (28x, 68x)
6. **Provisions** (15x, 68x)
7. **Salaires et charges sociales** (64x, 42x, 43x)
8. **Clôture d'exercice** automatique

### Améliorations techniques

1. **Validation avancée** : Règles métier personnalisables
2. **Workflows d'approbation** : Validation manuelle optionnelle
3. **Exports comptables** : FEC, SAGE, Ciel
4. **Rapports avancés** : Analyse des écritures automatiques
5. **Audit trail** : Historique complet des modifications

## 📞 Support

Pour toute question ou problème concernant la synchronisation comptable :

1. Vérifier les logs : `backend/logs/accounting_sync.log`
2. Consulter la documentation : `backend/docs/ACCOUNTING_SYNC_ANALYSIS.md`
3. Utiliser l'endpoint de re-synchronisation manuelle
4. Contacter le support technique

## ✅ Checklist de déploiement

- [x] Service de synchronisation créé
- [x] Hooks intégrés dans toutes les routes
- [x] API de synchronisation manuelle
- [x] Documentation complète
- [x] Gestion d'erreurs robuste
- [x] Logging configuré
- [x] Validation débit/crédit
- [x] Traçabilité bidirectionnelle
- [ ] Tests unitaires
- [ ] Tests d'intégration
- [ ] Formation utilisateurs
- [ ] Migration des données existantes

---

**Version** : 1.0.0  
**Date** : 25 janvier 2026  
**Auteur** : Équipe EasyBill
