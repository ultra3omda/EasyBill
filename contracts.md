# 📋 IBERIS.IO - ANALYSE COMPLÈTE & ARCHITECTURE BACKEND

## 🎯 ANALYSE GLOBALE DU COMPORTEMENT DE L'APPLICATION

### Vue d'ensemble
Iberis.io est une plateforme ERP/CRM complète de gestion d'entreprise pour TPE/PME tunisiennes, offrant une gestion intégrée de la facturation, comptabilité, stock, trésorerie et projets avec synchronisation automatique.

### Workflow Global
```
Utilisateur → Entreprise → Clients/Fournisseurs → Produits → Documents (Devis/Factures/BL/BS) 
           → Paiements → Comptabilité (Auto) → Rapports/Analytics
```

---

## 📊 MODULES & FONCTIONNALITÉS DÉTAILLÉES

### 1. **AUTHENTIFICATION & UTILISATEURS**
**Fonctionnalités:**
- Inscription email/password (6+ caractères)
- Connexion via Google/Facebook (OAuth social)
- Validation email obligatoire
- Récupération mot de passe (lien 30min)
- Sessions multiples (web, mobile)
- Gestion sessions actives
- Programme de parrainage (10-30% commissions)
- Open API avec clés d'accès
- Notifications configurables

**Champs Utilisateur:**
- Nom complet, email (unique), password (hash)
- Photo profil, date naissance, genre
- Services connectés (Google, Facebook)
- Sessions actives (device, IP, date)
- Préférences notifications
- Code parrainage, revenus parrainage
- Clé API, quota API

---

### 2. **ENTREPRISE (COMPANY)**
**Fonctionnalités:**
- Multi-entreprise selon abonnement
- Configuration fiscale (taxes, TVA)
- Gestion collaborateurs avec rôles
- Personnalisation PDF (logo, en-tête, pied de page)
- Calendrier d'entreprise
- Journal d'accès (audit logs)
- Fichiers d'entreprise
- Intégrations tierces (webhooks)
- Workflows automatisés
- Champs supplémentaires personnalisables

**Champs Entreprise:**
- Nom, matricule fiscal, activité
- Logo, slogan, adresse
- Devise principale
- Configuration taxes (taux TVA)
- Banques (IBAN, BIC, nom banque)
- Numérotation documents (préfixes, séquences)
- Paramètres PDF (affichage/masquage)
- Exercice comptable (début, fin)

---

### 3. **CLIENTS (CUSTOMERS)**
**Fonctionnalités:**
- Base de données clients complète
- Import/Export CSV/Excel
- Synthèse client (stats, graphiques)
- Chronologie transactions
- Accès client public (portail)
- Invitation client par email
- Multi-contacts par client
- Historique complet

**Champs Client:**
- Prénom (3-30 char), Nom (3-30 char), Entreprise
- Email (unique), téléphone, mobile
- Matricule fiscal, activité
- Devise client
- Adresse facturation (rue, ville, code postal, pays)
- Adresse livraison (optionnelle)
- Notes internes (privées)
- Solde impayé (calculé automatiquement)
- Nombre factures, devis, BL, BS
- Total paiements reçus
- Date création, dernière modification

---

### 4. **FOURNISSEURS (SUPPLIERS)**
**Fonctionnalités:**
- Identiques aux clients mais pour achats
- Synthèse fournisseur
- Historique commandes/paiements

**Champs Fournisseur:**
- Mêmes champs que clients
- Solde à payer
- Nombre commandes, réceptions

---

### 5. **STOCK & PRODUITS**
**Fonctionnalités:**
- Catalogue produits/services
- Gestion stock (entrées/sorties)
- Inventaires périodiques
- Import/Export articles
- Photos produits
- Tarification flexible (HT/TTC)
- Catégorisation

**Champs Produit:**
- Nom article (obligatoire)
- SKU/Référence (unique)
- Description
- Catégorie
- Type (produit/service)
- Prix unitaire HT
- TVA applicable (%)
- Unité de mesure
- Stock actuel (si produit)
- Stock minimum, stock maximum
- Photos (multiples)
- Code-barres
- Fournisseur par défaut
- Date création

---

### 6. **VENTES (SALES)**

#### A. **DEVIS (QUOTES/ESTIMATES)**
**Fonctionnalités:**
- Création/édition/suppression
- Conversion en facture
- Envoi email automatique
- Validation client
- Import masse
- PDF personnalisable

**Champs Devis:**
- Numéro (auto/manuel)
- Date création
- Date validité
- Client (référence)
- Objet
- Articles (liste)
  - Article, description, quantité, prix unitaire, TVA, total
- Sous-total HT
- Total TVA
- Total TTC
- Remise globale (%, montant)
- Conditions paiement
- Notes/Remarques
- Langue document (FR/EN/AR)
- Filigrane
- Statut (brouillon, envoyé, accepté, rejeté, expiré)
- Pièces jointes

#### B. **FACTURES (INVOICES)**
**Fonctionnalités:**
- Création depuis devis/BL
- Factures récurrentes (automatiques)
- Chronologie numéros (contrôle fiscal)
- Envoi automatique
- Paiements partiels/intégraux
- Rappels automatisés
- Génération PDF
- Import masse

**Champs Facture:**
- Mêmes que devis +
- Date échéance
- Montant payé
- Solde restant
- Statut (brouillon, envoyée, payée partiellement, payée, en retard, annulée)
- Récurrence (fréquence, prochaine date)
- Rappels envoyés
- Écriture comptable (auto-générée)

#### C. **BONS DE LIVRAISON (DELIVERY NOTES)**
**Fonctionnalités:**
- Confirmation livraison physique
- Suivi stocks (sortie automatique)
- Conversion en facture
- Signature électronique

**Champs BL:**
- Similaires facture
- Date livraison
- Adresse livraison
- Livreur
- Signature
- Statut (préparé, livré, facturé)

#### D. **BONS DE SORTIE (EXIT VOUCHERS)**
**Fonctionnalités:**
- Sortie stock sans facturation
- Traçabilité mouvements

**Champs BS:**
- Similaires BL
- Motif sortie
- Destination

#### E. **FACTURES D'AVOIR (CREDIT NOTES)**
**Fonctionnalités:**
- Correction factures
- Remboursements
- Ajustements
- Crédit client réutilisable

**Champs Avoir:**
- Facture originale (référence)
- Montant avoir
- Raison
- Crédit disponible client

#### F. **NOTES DE DÉBOURS (DISBURSEMENT NOTES)**
**Fonctionnalités:**
- Dépenses pour compte client
- Non considérées comme revenus (fiscal)
- Remboursement frais

**Champs Note Débours:**
- Client
- Facture liée
- Articles débours (libres)
- Source paiement
- Date débours

#### G. **PAIEMENTS REÇUS (RECEIVED PAYMENTS)**
**Fonctionnalités:**
- Enregistrement paiements
- Paiements partiels
- Multi-factures
- Modes de paiement variés
- Génération reçus

**Champs Paiement:**
- Client
- Montant total
- Répartition factures (montant par facture)
- Mode paiement (espèces, chèque, virement, carte, e-dinar)
- Référence transaction
- Date paiement
- Frais bancaires
- Pièces jointes (justificatifs)
- Écriture comptable (auto)

#### H. **RAPPELS (REMINDERS)**
**Fonctionnalités:**
- Manuels ou automatisés
- Conditions déclenchement
- Répétition configurable
- Variables dynamiques

**Champs Rappel:**
- Type (manuel/auto)
- Sujet email
- Corps email (variables: #INVOICE_NUMBER#, #CONTACT_NAME#, etc.)
- Conditions (jours après échéance)
- Fréquence répétition
- Statut actif/inactif

---

### 7. **ACHATS (PURCHASES)**

#### A. **BONS DE COMMANDE (PURCHASE ORDERS)**
**Champs:**
- Numéro, date
- Fournisseur
- Articles commandés
- Total, TVA
- Statut (brouillon, envoyé, reçu partiellement, reçu, annulé)

#### B. **BONS DE RÉCEPTION (RECEIPTS)**
**Champs:**
- Bon de commande lié
- Date réception
- Articles reçus (quantités)
- Entrée stock automatique

#### C. **FACTURES FOURNISSEUR (SUPPLIER INVOICES)**
**Champs:**
- Similaires factures vente
- Bon de commande/réception lié
- Échéance paiement
- Montant dû
- Écriture comptable (auto)

#### D. **PRESTATIONS DE SERVICE**
**Champs:**
- Fournisseur
- Service rendu
- Montant
- Facturation

#### E. **PAIEMENTS ÉMIS (PAYMENTS SENT)**
**Champs:**
- Fournisseur
- Facture(s) payée(s)
- Montant, mode paiement
- Référence
- Date

#### F. **RETENUES À LA SOURCE (WITHHOLDING TAX)**
**Champs:**
- Facture fournisseur
- Taux retenue
- Montant retenu
- Montant net payé

---

### 8. **COMPTABILITÉ (ACCOUNTING)**
**Fonctionnalités:**
- Synchronisation automatique
- Plan comptable personnalisable
- Écritures manuelles
- Grand livre
- Balance générale
- Journal

**Champs Écriture Comptable:**
- Date écriture
- Numéro pièce
- Journal (ventes, achats, banque, caisse, OD)
- Compte débit, compte crédit
- Libellé
- Montant
- Document source (facture, paiement, etc.)
- Analytique (optionnel)
- Validé/Non validé

**Plan Comptable:**
- Numéro compte
- Libellé
- Type (actif, passif, charge, produit, capitaux)
- Solde

---

### 9. **PROJETS & FEUILLES DE TEMPS**
**Fonctionnalités:**
- Gestion projets A-Z
- Timesheet facturable
- Suivi temps par tâche
- Facturation heure/forfait/ressources
- Paiements échelonnés

**Champs Projet:**
- Nom projet
- Client
- Budget
- Dépensé
- Heures totales
- Date début, fin
- Statut (planification, en cours, terminé, annulé)
- Tâches (liste)

**Champs Timesheet:**
- Projet
- Utilisateur/Collaborateur
- Tâche
- Date
- Heures travaillées
- Taux horaire
- Facturable (oui/non)
- Facturé (oui/non)

---

### 10. **TRÉSORERIE (TREASURY)**
**Fonctionnalités:**
- Suivi flux trésorerie
- Prévisions
- Rapprochements bancaires
- Paiements masse

**Champs:**
- Solde banque/caisse
- Flux entrants/sortants
- Prévisions échéances

---

### 11. **RAPPORTS & ANALYTICS**
**Fonctionnalités:**
- Dashboard metrics
- KPI (marge, DSO, renouvellement)
- Graphiques évolution CA
- Répartition dépenses
- Comparatifs annuels
- Export PDF/Excel

**Métriques:**
- Chiffre d'affaires
- Marge brute, marge nette
- Créances clients
- Dettes fournisseurs
- Bénéfice net
- Taux conversion devis
- DSO (Days Sales Outstanding)
- Taux attrition

---

## 🗄️ MODÈLES MONGODB PROPOSÉS

### **User**
```python
{
  _id: ObjectId,
  email: String (unique, index),
  password_hash: String,
  full_name: String,
  photo: String (URL),
  birth_date: Date,
  gender: String,
  social_accounts: [{
    provider: String, # google, facebook
    provider_id: String
  }],
  referral_code: String (unique),
  referral_earnings: Float (default: 0),
  api_key: String (unique),
  api_quota: Int,
  email_verified: Boolean (default: false),
  verification_token: String,
  reset_token: String,
  reset_token_expiry: Date,
  preferences: {
    notifications: {
      login: Boolean,
      company_ending: Boolean,
      invitation_expired: Boolean,
      subscription_ending: Boolean,
      support: Boolean,
      news_updates: Boolean
    },
    language: String (default: 'fr')
  },
  sessions: [{
    device: String,
    ip: String,
    user_agent: String,
    last_activity: Date
  }],
  created_at: Date,
  updated_at: Date
}
```

### **Company**
```python
{
  _id: ObjectId,
  name: String (required),
  fiscal_id: String,
  activity: String,
  logo: String (URL),
  slogan: String,
  address: {
    street: String,
    city: String,
    postal_code: String,
    country: String (default: 'Tunisia')
  },
  primary_currency: String (default: 'TND'),
  taxes: [{
    name: String,
    rate: Float, # 19 pour 19%
    default: Boolean
  }],
  banks: [{
    name: String,
    iban: String,
    bic: String,
    is_default: Boolean
  }],
  numbering: {
    invoice_prefix: String (default: 'INV'),
    invoice_next: Int (default: 1),
    quote_prefix: String (default: 'QUO'),
    quote_next: Int (default: 1),
    delivery_prefix: String (default: 'BL'),
    delivery_next: Int (default: 1),
    # ... autres documents
  },
  pdf_settings: {
    show_logo: Boolean (default: true),
    show_addresses: Boolean (default: true),
    show_product_images: Boolean (default: false),
    show_prices: Boolean (default: true),
    footer_text: String
  },
  fiscal_year: {
    start_date: Date,
    end_date: Date
  },
  owner_id: ObjectId (ref: User),
  collaborators: [{
    user_id: ObjectId (ref: User),
    role: String, # admin, manager, user
    permissions: [String], # create_invoice, edit_customer, etc.
    invited_at: Date,
    accepted_at: Date,
    status: String # pending, active, revoked
  }],
  subscription: {
    plan: String, # free, premium
    status: String, # active, expired, canceled
    expires_at: Date,
    auto_renew: Boolean
  },
  created_at: Date,
  updated_at: Date
}
```

### **Customer**
```python
{
  _id: ObjectId,
  company_id: ObjectId (ref: Company, index),
  first_name: String (required, min:3, max:30),
  last_name: String (min:3, max:30),
  company_name: String,
  display_name: String, # Auto-généré: "Nom, Prénom" ou "Prénom Nom" ou "Entreprise"
  email: String,
  phone: String,
  mobile: String,
  fiscal_id: String,
  activity: String,
  currency: String (default: 'TND'),
  billing_address: {
    street: String,
    city: String,
    postal_code: String,
    country: String
  },
  shipping_address: {
    street: String,
    city: String,
    postal_code: String,
    country: String
  },
  notes: String, # Notes internes
  balance: Float (default: 0), # Solde impayé
  total_invoiced: Float (default: 0),
  total_paid: Float (default: 0),
  invoice_count: Int (default: 0),
  quote_count: Int (default: 0),
  public_access: {
    enabled: Boolean (default: false),
    token: String (unique),
    invited_at: Date
  },
  created_at: Date,
  updated_at: Date,
  created_by: ObjectId (ref: User)
}
```

### **Supplier** (identique à Customer)
```python
{
  # Mêmes champs que Customer
  # balance = Solde à payer (dettes)
  purchase_order_count: Int,
  total_purchased: Float
}
```

### **Product**
```python
{
  _id: ObjectId,
  company_id: ObjectId (ref: Company, index),
  name: String (required),
  sku: String (unique per company),
  description: String,
  category: String,
  type: String, # product, service
  unit_price: Float (required),
  tax_rate: Float, # TVA applicable
  unit: String, # Heure, Jour, Unité, Kg, etc.
  stock_quantity: Int, # null si service
  min_stock: Int,
  max_stock: Int,
  images: [String], # URLs
  barcode: String,
  default_supplier_id: ObjectId (ref: Supplier),
  is_active: Boolean (default: true),
  created_at: Date,
  updated_at: Date
}
```

### **Quote (Devis)**
```python
{
  _id: ObjectId,
  company_id: ObjectId (ref: Company, index),
  number: String (unique per company, index),
  date: Date (required),
  valid_until: Date,
  customer_id: ObjectId (ref: Customer, required, index),
  subject: String,
  items: [{
    product_id: ObjectId (ref: Product),
    description: String,
    quantity: Float (required),
    unit_price: Float (required),
    tax_rate: Float,
    discount: Float,
    total: Float # (quantity * unit_price * (1 - discount) * (1 + tax_rate))
  }],
  subtotal: Float, # HT
  total_tax: Float,
  total_discount: Float,
  total: Float, # TTC
  payment_terms: String,
  notes: String,
  language: String (default: 'fr'),
  watermark: String,
  status: String (default: 'draft'), # draft, sent, accepted, rejected, expired
  pdf_url: String,
  attachments: [String], # URLs
  sent_at: Date,
  converted_to_invoice: Boolean (default: false),
  invoice_id: ObjectId (ref: Invoice),
  created_at: Date,
  updated_at: Date,
  created_by: ObjectId (ref: User)
}
```

### **Invoice (Facture)**
```python
{
  _id: ObjectId,
  company_id: ObjectId (ref: Company, index),
  number: String (unique per company, index),
  date: Date (required),
  due_date: Date (required),
  customer_id: ObjectId (ref: Customer, required, index),
  subject: String,
  items: [{
    # Identique Quote
  }],
  subtotal: Float,
  total_tax: Float,
  total_discount: Float,
  total: Float,
  amount_paid: Float (default: 0),
  balance_due: Float, # total - amount_paid
  payment_terms: String,
  notes: String,
  language: String,
  watermark: String,
  status: String (default: 'draft'), # draft, sent, partial, paid, overdue, cancelled
  pdf_url: String,
  attachments: [String],
  sent_at: Date,
  paid_at: Date,
  # Récurrence
  is_recurring: Boolean (default: false),
  recurrence: {
    frequency: String, # daily, weekly, monthly, yearly
    interval: Int, # every X days/weeks/months
    next_date: Date
  },
  # Source
  quote_id: ObjectId (ref: Quote),
  delivery_id: ObjectId (ref: Delivery),
  # Comptabilité
  accounting_entry_id: ObjectId (ref: AccountingEntry),
  created_at: Date,
  updated_at: Date,
  created_by: ObjectId (ref: User)
}
```

### **DeliveryNote (Bon de Livraison)**
```python
{
  _id: ObjectId,
  company_id: ObjectId (ref: Company, index),
  number: String (unique per company),
  date: Date,
  delivery_date: Date,
  customer_id: ObjectId (ref: Customer, required),
  delivery_address: {
    street: String,
    city: String,
    postal_code: String,
    country: String
  },
  items: [{ # identique Invoice }],
  subtotal: Float,
  total: Float,
  notes: String,
  status: String (default: 'prepared'), # prepared, delivered, invoiced
  signature: String, # Base64 ou URL
  delivered_by: String, # Nom livreur
  converted_to_invoice: Boolean (default: false),
  invoice_id: ObjectId (ref: Invoice),
  attachments: [String],
  created_at: Date,
  updated_at: Date
}
```

### **ExitVoucher (Bon de Sortie)**
```python
{
  # Similaire DeliveryNote
  reason: String, # Motif sortie
  destination: String
}
```

### **CreditNote (Facture d'avoir)**
```python
{
  _id: ObjectId,
  company_id: ObjectId (ref: Company),
  number: String (unique per company),
  date: Date,
  customer_id: ObjectId (ref: Customer, required),
  original_invoice_id: ObjectId (ref: Invoice, required),
  items: [{ # identique }],
  total: Float,
  reason: String,
  credit_available: Float, # Crédit réutilisable
  used_amount: Float (default: 0),
  status: String, # issued, partially_used, fully_used
  accounting_entry_id: ObjectId (ref: AccountingEntry),
  created_at: Date,
  updated_at: Date
}
```

### **DisbursementNote (Note de Débours)**
```python
{
  _id: ObjectId,
  company_id: ObjectId (ref: Company),
  date: Date,
  customer_id: ObjectId (ref: Customer, required),
  invoice_id: ObjectId (ref: Invoice),
  payment_source: String,
  items: [{
    description: String, # Libre
    date: Date,
    quantity: Float,
    unit_price: Float,
    total: Float
  }],
  total: Float,
  created_at: Date,
  updated_at: Date
}
```

### **Payment (Paiement Reçu)**
```python
{
  _id: ObjectId,
  company_id: ObjectId (ref: Company, index),
  type: String, # received, sent
  date: Date (required),
  customer_id: ObjectId (ref: Customer), # Si reçu
  supplier_id: ObjectId (ref: Supplier), # Si émis
  amount: Float (required),
  payment_method: String, # cash, check, transfer, card, e_dinar
  reference: String,
  bank_fees: Float (default: 0),
  allocations: [{
    invoice_id: ObjectId (ref: Invoice),
    amount: Float
  }],
  attachments: [String],
  language: String,
  pdf_url: String, # Reçu généré
  accounting_entry_id: ObjectId (ref: AccountingEntry),
  created_at: Date,
  updated_at: Date,
  created_by: ObjectId (ref: User)
}
```

### **Reminder (Rappel)**
```python
{
  _id: ObjectId,
  company_id: ObjectId (ref: Company),
  type: String, # manual, automated
  subject: String,
  body: String, # Avec variables: #INVOICE_NUMBER#, etc.
  conditions: {
    days_after_due: Int, # Envoyer X jours après échéance
    repeat_every: Int, # Répéter tous les X jours
    max_reminders: Int
  },
  is_active: Boolean (default: true),
  sent_count: Int (default: 0),
  created_at: Date,
  updated_at: Date
}
```

### **ReminderLog (Historique envoi)**
```python
{
  _id: ObjectId,
  reminder_id: ObjectId (ref: Reminder),
  invoice_id: ObjectId (ref: Invoice),
  customer_id: ObjectId (ref: Customer),
  sent_at: Date,
  email_status: String # sent, delivered, opened, failed
}
```

### **PurchaseOrder (Bon de Commande)**
```python
{
  _id: ObjectId,
  company_id: ObjectId (ref: Company, index),
  number: String (unique per company),
  date: Date,
  supplier_id: ObjectId (ref: Supplier, required),
  items: [{ # identique }],
  subtotal: Float,
  total_tax: Float,
  total: Float,
  status: String, # draft, sent, partially_received, received, cancelled
  sent_at: Date,
  created_at: Date,
  updated_at: Date
}
```

### **Receipt (Bon de Réception)**
```python
{
  _id: ObjectId,
  company_id: ObjectId (ref: Company),
  number: String,
  date: Date,
  purchase_order_id: ObjectId (ref: PurchaseOrder),
  supplier_id: ObjectId (ref: Supplier, required),
  items: [{
    product_id: ObjectId (ref: Product),
    quantity_ordered: Float,
    quantity_received: Float,
    unit_price: Float
  }],
  status: String, # received, invoiced
  converted_to_invoice: Boolean,
  supplier_invoice_id: ObjectId (ref: SupplierInvoice),
  created_at: Date,
  updated_at: Date
}
```

### **SupplierInvoice (Facture Fournisseur)**
```python
{
  # Similaire Invoice mais inversé
  supplier_id: ObjectId (ref: Supplier),
  purchase_order_id: ObjectId (ref: PurchaseOrder),
  receipt_id: ObjectId (ref: Receipt),
  amount_due: Float,
  status: String # pending, paid, overdue
  # ... autres champs identiques
}
```

### **WithholdingTax (Retenue à la Source)**
```python
{
  _id: ObjectId,
  company_id: ObjectId (ref: Company),
  supplier_invoice_id: ObjectId (ref: SupplierInvoice, required),
  supplier_id: ObjectId (ref: Supplier),
  withholding_rate: Float, # %
  withheld_amount: Float,
  net_amount_paid: Float, # Montant facture - retenue
  date: Date,
  created_at: Date
}
```

### **AccountingEntry (Écriture Comptable)**
```python
{
  _id: ObjectId,
  company_id: ObjectId (ref: Company, index),
  entry_number: String,
  date: Date (required),
  journal: String, # sales, purchases, bank, cash, general
  lines: [{
    account_code: String (required),
    account_name: String,
    debit: Float (default: 0),
    credit: Float (default: 0),
    label: String,
    analytical_code: String # Optionnel
  }],
  description: String,
  source_type: String, # invoice, payment, manual, etc.
  source_id: ObjectId, # ID du document source
  validated: Boolean (default: false),
  attachments: [String],
  created_at: Date,
  updated_at: Date,
  created_by: ObjectId (ref: User)
}
```

### **AccountingPlan (Plan Comptable)**
```python
{
  _id: ObjectId,
  company_id: ObjectId (ref: Company, index),
  code: String (unique per company, required),
  name: String (required),
  type: String, # asset, liability, equity, income, expense
  parent_code: String, # Pour hiérarchie
  balance: Float (default: 0),
  is_system: Boolean (default: false), # Compte système non modifiable
  created_at: Date,
  updated_at: Date
}
```

### **Project (Projet)**
```python
{
  _id: ObjectId,
  company_id: ObjectId (ref: Company, index),
  name: String (required),
  customer_id: ObjectId (ref: Customer, required),
  description: String,
  budget: Float,
  spent: Float (default: 0),
  total_hours: Float (default: 0),
  start_date: Date,
  end_date: Date,
  status: String (default: 'planning'), # planning, in_progress, completed, cancelled
  billing_type: String, # hourly, fixed, resources
  hourly_rate: Float,
  tasks: [{
    name: String,
    description: String,
    estimated_hours: Float,
    actual_hours: Float (default: 0),
    status: String, # pending, in_progress, completed
    assigned_to: ObjectId (ref: User)
  }],
  created_at: Date,
  updated_at: Date,
  created_by: ObjectId (ref: User)
}
```

### **Timesheet (Feuille de Temps)**
```python
{
  _id: ObjectId,
  company_id: ObjectId (ref: Company, index),
  project_id: ObjectId (ref: Project, required, index),
  user_id: ObjectId (ref: User, required, index),
  task_name: String,
  date: Date (required),
  hours: Float (required),
  hourly_rate: Float,
  is_billable: Boolean (default: true),
  is_billed: Boolean (default: false),
  invoice_id: ObjectId (ref: Invoice),
  notes: String,
  created_at: Date,
  updated_at: Date
}
```

### **Inventory (Inventaire)**
```python
{
  _id: ObjectId,
  company_id: ObjectId (ref: Company, index),
  date: Date (required),
  location: String,
  items: [{
    product_id: ObjectId (ref: Product, required),
    expected_quantity: Float,
    actual_quantity: Float,
    difference: Float, # actual - expected
    notes: String
  }],
  status: String, # draft, validated
  validated_at: Date,
  validated_by: ObjectId (ref: User),
  created_at: Date,
  updated_at: Date,
  created_by: ObjectId (ref: User)
}
```

### **StockMovement (Mouvement de Stock)**
```python
{
  _id: ObjectId,
  company_id: ObjectId (ref: Company, index),
  product_id: ObjectId (ref: Product, required, index),
  type: String, # in, out, adjustment
  quantity: Float (required),
  date: Date (required),
  source_type: String, # delivery, receipt, inventory, manual
  source_id: ObjectId, # ID document source
  notes: String,
  created_at: Date,
  created_by: ObjectId (ref: User)
}
```

---

## 🔄 API ENDPOINTS PROPOSÉS

### **Authentification**
- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/logout
- POST /api/auth/verify-email
- POST /api/auth/forgot-password
- POST /api/auth/reset-password
- POST /api/auth/google
- GET /api/auth/sessions
- DELETE /api/auth/sessions/:id

### **Users**
- GET /api/users/profile
- PUT /api/users/profile
- PUT /api/users/password
- GET /api/users/notifications
- PUT /api/users/notifications

### **Companies**
- POST /api/companies
- GET /api/companies
- GET /api/companies/:id
- PUT /api/companies/:id
- DELETE /api/companies/:id
- GET /api/companies/:id/dashboard

### **Customers**
- POST /api/customers
- GET /api/customers
- GET /api/customers/:id
- PUT /api/customers/:id
- DELETE /api/customers/:id
- POST /api/customers/import
- GET /api/customers/:id/stats
- GET /api/customers/:id/timeline

### **Suppliers** (mêmes endpoints que customers)

### **Products**
- POST /api/products
- GET /api/products
- GET /api/products/:id
- PUT /api/products/:id
- DELETE /api/products/:id
- POST /api/products/import

### **Quotes**
- POST /api/quotes
- GET /api/quotes
- GET /api/quotes/:id
- PUT /api/quotes/:id
- DELETE /api/quotes/:id
- POST /api/quotes/:id/convert-to-invoice
- POST /api/quotes/:id/send
- POST /api/quotes/import

### **Invoices**
- POST /api/invoices
- GET /api/invoices
- GET /api/invoices/:id
- PUT /api/invoices/:id
- DELETE /api/invoices/:id
- POST /api/invoices/:id/send
- POST /api/invoices/import
- GET /api/invoices/:id/pdf

### **Delivery Notes, Exit Vouchers, Credit Notes** (similaires)

### **Payments**
- POST /api/payments
- GET /api/payments
- GET /api/payments/:id
- DELETE /api/payments/:id

### **Accounting**
- POST /api/accounting/entries
- GET /api/accounting/entries
- GET /api/accounting/entries/:id
- PUT /api/accounting/entries/:id
- DELETE /api/accounting/entries/:id
- GET /api/accounting/ledger
- GET /api/accounting/balance
- GET /api/accounting/plan

### **Projects**
- POST /api/projects
- GET /api/projects
- GET /api/projects/:id
- PUT /api/projects/:id
- DELETE /api/projects/:id

### **Timesheets**
- POST /api/timesheets
- GET /api/timesheets
- GET /api/timesheets/:id
- PUT /api/timesheets/:id
- DELETE /api/timesheets/:id

### **Reports**
- GET /api/reports/dashboard
- GET /api/reports/sales
- GET /api/reports/purchases
- GET /api/reports/expenses
- GET /api/reports/revenue

---

## 🔐 RÈGLES MÉTIER & VALIDATIONS

1. **Numérotation Chronologique**: Les factures doivent avoir des numéros et dates chronologiques (conformité fiscale tunisienne)
2. **Validation Email**: Obligatoire avant accès complet
3. **Multi-entreprise**: Limité selon abonnement (Gratuit: 1, Premium: 1+)
4. **Accès Client Public**: Token unique sécurisé
5. **Synchronisation Comptable**: Auto sur facture/paiement/avoir
6. **Stock**: Mise à jour automatique sur BL/BS/BR validés
7. **Récurrence**: Génération automatique factures périodiques
8. **Rappels**: Envoi automatique selon conditions
9. **TVA**: Calcul automatique selon taux configurés
10. **Conversion Documents**: Devis→Facture, BL→Facture, BC→BR→Facture Fournisseur

---

## 📝 PROCHAINES ÉTAPES

1. ✅ Créer les modèles MongoDB Python (Pydantic)
2. ✅ Implémenter les endpoints API FastAPI
3. ✅ Authentification JWT + Google OAuth
4. ✅ Synchronisation comptable automatique
5. ✅ Génération PDF factures/devis
6. ✅ Envoi emails (SMTP)
7. ✅ Rappels automatisés (celery/background tasks)
8. ✅ Import/Export CSV
9. ✅ Intégration frontend-backend
10. ✅ Tests complets

---

**Votre avis sur cette analyse ?**
