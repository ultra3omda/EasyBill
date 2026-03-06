# 📊 Analyse de la Synchronisation Comptable Automatique

## Vue d'ensemble

Ce document analyse toutes les opérations transactionnelles de l'application EasyBill qui nécessitent des écritures comptables automatiques selon les normes comptables tunisiennes.

## Opérations à Synchroniser

### 1. 💰 VENTES (Factures Clients)

#### Opération: Création/Validation d'une facture client

**Déclencheur:** Changement de statut de `draft` → `sent` ou `paid`

**Écriture comptable:**

| Compte | Libellé | Débit | Crédit |
|--------|---------|-------|--------|
| 411 | Clients | Total TTC | |
| 4362 | TVA récupérable sur achats | | TVA |
| 707 | Ventes de marchandises | | HT |

**Cas particuliers:**
- **Produits finis:** Utiliser compte 701 au lieu de 707
- **Services:** Utiliser compte 706
- **Avec remise:** Affecter la remise au compte 709 (RRR accordés)

---

### 2. 💸 ENCAISSEMENTS (Paiements Clients)

#### Opération: Enregistrement d'un paiement client

**Déclencheur:** Création d'un paiement lié à une facture

**Écriture comptable:**

| Compte | Libellé | Débit | Crédit |
|--------|---------|-------|--------|
| 521 | Banque | Montant | |
| 411 | Clients | | Montant |

**Cas particuliers:**
- **Paiement espèces:** Utiliser compte 531 (Caisse) au lieu de 521
- **Paiement chèque:** Utiliser compte 521 (Banque)
- **Paiement partiel:** Montant = montant du paiement uniquement

---

### 3. 🛒 ACHATS (Factures Fournisseurs)

#### Opération: Création/Validation d'une facture fournisseur

**Déclencheur:** Changement de statut de `draft` → `validated`

**Écriture comptable:**

| Compte | Libellé | Débit | Crédit |
|--------|---------|-------|--------|
| 607 | Achats de marchandises | HT | |
| 4362 | TVA récupérable sur achats | TVA | |
| 401 | Fournisseurs d'exploitation | | Total TTC |

**Cas particuliers:**
- **Matières premières:** Utiliser compte 601
- **Services:** Utiliser compte 604
- **Immobilisations:** Utiliser compte 404 (Fournisseurs d'immobilisations) et compte 22x

---

### 4. 💳 DÉCAISSEMENTS (Paiements Fournisseurs)

#### Opération: Enregistrement d'un paiement fournisseur

**Déclencheur:** Création d'un paiement lié à une facture fournisseur

**Écriture comptable:**

| Compte | Libellé | Débit | Crédit |
|--------|---------|-------|--------|
| 401 | Fournisseurs d'exploitation | Montant | |
| 521 | Banque | | Montant |

**Cas particuliers:**
- **Paiement espèces:** Utiliser compte 531 (Caisse)
- **Paiement partiel:** Montant = montant du paiement uniquement

---

### 5. 📦 MOUVEMENTS DE STOCK

#### 5.1 Entrée de stock (Achat)

**Déclencheur:** Réception de marchandises (bon de réception)

**Écriture comptable:**

| Compte | Libellé | Débit | Crédit |
|--------|---------|-------|--------|
| 370 | Stock de marchandises | Coût d'achat | |
| 6087 | Variation des stocks | | Coût d'achat |

#### 5.2 Sortie de stock (Vente)

**Déclencheur:** Livraison de marchandises (bon de livraison)

**Écriture comptable:**

| Compte | Libellé | Débit | Crédit |
|--------|---------|-------|--------|
| 6087 | Variation des stocks | Coût d'achat | |
| 370 | Stock de marchandises | | Coût d'achat |

**Note:** Cette écriture est DISTINCTE de la facture de vente. Elle constate le coût des marchandises vendues.

---

### 6. 📋 BONS DE COMMANDE

#### Opération: Validation d'un bon de commande

**Déclencheur:** Changement de statut → `validated`

**Écriture comptable:**

| Compte | Libellé | Débit | Crédit |
|--------|---------|-------|--------|
| 409 | Fournisseurs - Avances | Montant acompte | |
| 521 | Banque | | Montant acompte |

**Note:** Uniquement si un acompte est versé. L'écriture sera régularisée à la réception de la facture.

---

### 7. 📄 AVOIRS (Notes de Crédit)

#### Opération: Création d'un avoir client

**Déclencheur:** Validation d'une note de crédit

**Écriture comptable:**

| Compte | Libellé | Débit | Crédit |
|--------|---------|-------|--------|
| 707 | Ventes de marchandises | HT | |
| 4351 | TVA à payer | TVA | |
| 411 | Clients | | Total TTC |

**Note:** C'est l'inverse de la facture de vente.

---

### 8. 📝 DEVIS (Quotes)

**Aucune écriture comptable**

Les devis n'ont pas d'impact comptable tant qu'ils ne sont pas transformés en factures.

---

### 9. 🚚 BONS DE LIVRAISON

**Aucune écriture comptable directe**

Le bon de livraison déclenche uniquement la sortie de stock (voir section 5.2).

---

### 10. 💼 CHARGES D'EXPLOITATION

#### Opération: Enregistrement d'une dépense

**Déclencheur:** Création d'une dépense (expense)

**Écriture comptable (exemple: loyer):**

| Compte | Libellé | Débit | Crédit |
|--------|---------|-------|--------|
| 6132 | Location de constructions | HT | |
| 4362 | TVA récupérable | TVA | |
| 401 | Fournisseurs | | Total TTC |

**Comptes selon type de charge:**
- **Loyer:** 6132
- **Électricité/Eau:** 6061
- **Téléphone/Internet:** 6262/6264
- **Assurance:** 616x
- **Publicité:** 623x
- **Transport:** 624x
- **Honoraires:** 6224
- **Salaires:** 641

---

## Règles de Gestion Comptable

### TVA Tunisienne

- **Taux normal:** 19%
- **Taux réduit:** 7% (certains produits alimentaires)
- **Taux zéro:** 0% (exportations)

**Comptes TVA:**
- **4351:** TVA collectée (à payer)
- **4362:** TVA déductible sur achats
- **4361:** TVA déductible sur immobilisations

### Numérotation des Écritures

Format: `{type}-{année}-{numéro}`

Exemples:
- `VE-2026-0001` (Vente)
- `AC-2026-0001` (Achat)
- `RE-2026-0001` (Règlement)
- `ST-2026-0001` (Stock)

### Journaux Comptables

| Code | Libellé | Type d'opérations |
|------|---------|-------------------|
| VE | Ventes | Factures clients |
| AC | Achats | Factures fournisseurs |
| BQ | Banque | Paiements bancaires |
| CA | Caisse | Paiements espèces |
| OD | Opérations Diverses | Autres opérations |
| ST | Stock | Mouvements de stock |

---

## Mapping Opérations → Écritures

| Opération | Collection MongoDB | Champ déclencheur | Type écriture |
|-----------|-------------------|-------------------|---------------|
| Facture client | `invoices` | `status: sent/paid` | VE |
| Paiement client | `payments` | `type: customer` | BQ/CA |
| Facture fournisseur | `supplier_invoices` | `status: validated` | AC |
| Paiement fournisseur | `supplier_payments` | `type: supplier` | BQ/CA |
| Entrée stock | `stock_movements` | `type: in` | ST |
| Sortie stock | `stock_movements` | `type: out` | ST |
| Avoir client | `credit_notes` | `status: validated` | VE |
| Dépense | `expenses` | `status: validated` | OD |

---

## Cas Complexes

### 1. Facture avec Acompte

**Étape 1: Réception acompte**
```
Débit  521 Banque              500
Crédit 419 Clients - Avances   500
```

**Étape 2: Facture finale (total 1000)**
```
Débit  411 Clients            1000
Crédit 707 Ventes              840
Crédit 4351 TVA                160
```

**Étape 3: Règlement solde (500)**
```
Débit  521 Banque              500
Débit  419 Clients - Avances   500
Crédit 411 Clients            1000
```

### 2. Facture Récurrente

Chaque facture générée automatiquement suit le même schéma qu'une facture normale.

### 3. Remise Globale

Si remise de 10% sur facture de 1000 TND HT:

```
Débit  411 Clients            1071  (900 HT + 171 TVA)
Crédit 707 Ventes              900
Crédit 709 RRR accordés       -100  (remise)
Crédit 4351 TVA                171
```

### 4. Retour de Marchandises

**Option 1: Avoir**
Créer une note de crédit (voir section 7)

**Option 2: Annulation partielle**
Modifier la facture et régénérer l'écriture

---

## Contrôles de Cohérence

### 1. Équilibre Débit/Crédit

Chaque écriture DOIT avoir : `Σ Débits = Σ Crédits`

### 2. Cohérence Client/Fournisseur

Le solde du compte 411 (Clients) doit correspondre à la somme des factures impayées.

### 3. Cohérence Stock

Le solde du compte 370 (Stock) doit correspondre à la valeur du stock physique.

### 4. TVA

Le solde du compte 4351 - 4362 doit correspondre à la TVA à payer/récupérer.

---

## Priorités d'Implémentation

### Phase 1 (Critique - P0)
1. ✅ Factures clients (ventes)
2. ✅ Paiements clients (encaissements)
3. ✅ Factures fournisseurs (achats)
4. ✅ Paiements fournisseurs (décaissements)

### Phase 2 (Important - P1)
5. ✅ Mouvements de stock (entrées/sorties)
6. ✅ Notes de crédit (avoirs)

### Phase 3 (Souhaitable - P2)
7. ⏳ Charges d'exploitation
8. ⏳ Avances et acomptes
9. ⏳ Régularisations

---

## Implémentation Technique

### Architecture

```
Service: AccountingSyncService
├── syncInvoice(invoice_id)
├── syncPayment(payment_id)
├── syncSupplierInvoice(invoice_id)
├── syncSupplierPayment(payment_id)
├── syncStockMovement(movement_id)
├── syncCreditNote(credit_note_id)
└── syncExpense(expense_id)
```

### Hooks

Les écritures comptables sont générées automatiquement via des hooks:

1. **After Insert/Update** sur collections transactionnelles
2. Vérification du statut (draft → validated/sent/paid)
3. Appel du service de synchronisation
4. Génération de l'écriture comptable
5. Insertion dans `journal_entries`
6. Mise à jour du champ `accounting_entry_id` sur le document source

### Gestion des Erreurs

- **Erreur de génération:** Log + notification admin
- **Écriture déséquilibrée:** Blocage + alerte
- **Doublon:** Vérification via `accounting_entry_id`

---

## Tests

### Scénarios de Test

1. ✅ Facture simple → Écriture VE
2. ✅ Facture + Paiement → 2 écritures (VE + BQ)
3. ✅ Facture avec remise → Compte 709
4. ✅ Achat + Paiement → 2 écritures (AC + BQ)
5. ✅ Mouvement stock → Écriture ST
6. ✅ Avoir → Écriture VE négative
7. ✅ Paiement partiel → Montant partiel

### Vérifications

- Équilibre débit/crédit
- Cohérence des comptes
- Numérotation séquentielle
- Pas de doublons
- Liaison document ↔ écriture

---

## Conclusion

La synchronisation comptable automatique est **critique** pour l'intégrité de l'application. Elle doit couvrir **toutes** les opérations transactionnelles et respecter **strictement** les normes comptables tunisiennes.

**Prochaine étape:** Implémentation du service `AccountingSyncService`
