# Analyse fonctionnelle – EasyBill

## 1. Vue d’ensemble

**EasyBill** est une application de **gestion d’entreprise (ERP / facturation)** destinée aux **TPE/PME**, avec un focus sur le marché **tunisien** (réglementation fiscale, TVA, FODEC, timbre fiscal, plan comptable tunisien).

Le projet propose **deux stacks techniques** dans le même dépôt :

| Stack | Frontend | Backend | Base de données | Commande |
|-------|----------|---------|-----------------|----------|
| **Principal** | React 19 + Vite (dossier `client/`) | Node.js + Express + tRPC (dossier `server/`) | **MySQL** (Drizzle ORM) | `pnpm dev` |
| **Alternative** | React 19 + CRA/craco (dossier `frontend/`) | **Python FastAPI** (dossier `backend/`) | **MongoDB** | `yarn start` + `uvicorn server:app --port 8000` |

Les deux versions visent les **mêmes grandes fonctionnalités** (facturation, clients, stock, comptabilité, etc.), avec des implémentations et des modèles de données différents.

---

## 2. Workflow global

```
Utilisateur → Inscription / Connexion (email, Google, Facebook)
    → Création / choix d’une Entreprise
    → Gestion des Contacts (Clients, Fournisseurs)
    → Catalogue Produits / Services
    → Documents de vente (Devis → Factures, Bons de livraison, Avoirs)
    → Paiements reçus / émis
    → Achats (Commandes, Factures fournisseur, Paiements)
    → Stock (entrepôts, mouvements, inventaires)
    → Comptabilité (plan comptable, écritures, grands livres, bilans)
    → Rapports et tableaux de bord
```

---

## 3. Modules fonctionnels détaillés

### 3.1 Authentification et utilisateurs

- **Inscription** par email / mot de passe (avec validation email).
- **Connexion** : email/mot de passe, **Google OAuth**, **Facebook OAuth**.
- **Récupération de mot de passe** (lien par email, délai limité).
- **Sessions** : gestion des sessions actives (web, mobile).
- **Profil** : modification du profil, mot de passe.
- **Parrainage** : code parrain, commissions (côté backend MongoDB).
- **Abonnement** : plans Free / Premium, quotas (ex. nombre de factures, clients) sur la stack principale (MySQL).

Champs utilisateur typiques : nom, email, mot de passe (hashé), photo, méthode de connexion (Google/Facebook), préférences, rôles (user/admin), plan d’abonnement, quotas.

---

### 3.2 Entreprise (Company)

- **Multi-entreprise** : un utilisateur peut gérer plusieurs sociétés (selon abonnement).
- **Informations légales** : nom, forme juridique (SARL, SA, etc.), matricule fiscal (format tunisien).
- **Adresse, contact** : adresse, ville, code postal, pays, téléphone, email, site web.
- **Identité visuelle** : logo, couleur principale.
- **Comptabilité** : devise (TND par défaut), début/fin d’exercice.
- **Facturation** : préfixes et numéros pour factures (FAC) et devis (DEV), TVA par défaut.
- **Banque** : nom, IBAN, BIC.
- **Paramètres PDF** : personnalisation des documents générés.

---

### 3.3 Clients (Customers)

- **Fiche client** : type (particulier/société), nom, matricule fiscal, contact, email, téléphone, adresse (facturation / livraison), conditions de paiement (ex. 30 jours), catégorie, notes.
- **Synthèse client** : statistiques, historique des factures, paiements, solde.
- **Portail client** (stack backend Python) : accès sécurisé pour le client (tableau de bord, factures, devis, paiements) via un lien/ token.

---

### 3.4 Fournisseurs (Suppliers)

- Même logique que les clients, orientée **achats** : nom, matricule fiscal, contact, adresse, coordonnées bancaires (IBAN, BIC), notes.
- Synthèse : commandes, factures fournisseur, paiements, solde à payer.

---

### 3.5 Produits et services

- **Catalogue** : produits ou services, nom, référence (SKU), code-barres, description, catégorie, type (produit / service).
- **Prix** : prix unitaire HT, devise, unité (unité, kg, etc.).
- **Fiscalité** : taux de TVA, FODEC, taxe de consommation (conformité tunisienne).
- **Stock** (pour les produits) : suivi des quantités, stock actuel, seuil minimum, coût d’achat.
- **Import / export** : CSV/Excel pour produits (stack backend Python).

---

### 3.6 Ventes

#### Devis (Quotes)

- Création, édition, envoi par email.
- Lignes : produit/service, quantité, prix unitaire, TVA, remises, totaux.
- Totaux : sous-total HT, TVA, FODEC, timbre fiscal (0,600 TND), total TTC.
- Statuts : brouillon, envoyé, accepté, rejeté, expiré, converti en facture.
- **Conversion** d’un devis accepté en facture.

#### Factures (Invoices)

- Création manuelle ou à partir d’un devis / bon de livraison.
- Numérotation séquentielle (préfixe + numéro).
- Dates d’émission et d’échéance.
- Lignes avec TVA, FODEC, timbre fiscal.
- Statuts : brouillon, envoyée, payée partiellement, payée, en retard, annulée.
- **Factures récurrentes** (stack backend Python) : génération automatique selon une fréquence.
- Envoi par email, suivi des rappels.
- Génération **PDF** (WeasyPrint côté backend Python si disponible).

#### Bons de livraison (Delivery notes)

- Document de livraison physique.
- Lien avec les factures (conversion possible).
- Suivi des quantités livrées (impact stock si utilisé).

#### Factures d’avoir (Credit notes)

- Correction ou annulation d’une facture.
- Montant en crédit, raison, lien avec la facture d’origine.
- Crédit réutilisable pour le client.

#### Paiements reçus (Payments)

- Enregistrement des encaissements (espèces, chèque, virement, carte, e-dinar, etc.).
- Répartition sur une ou plusieurs factures (paiement partiel ou global).
- Référence de transaction, date, éventuellement frais.
- Génération de **reçus** (PDF si module activé).

#### Rappels (Reminders)

- Rappels manuels ou automatisés pour factures impayées.
- Modèle d’email, conditions (ex. X jours après échéance), fréquence.

#### Notes de débours (Disbursements)

- Dépenses engagées pour le compte du client (frais à rembourser).
- Lien possible avec une facture ou un client.

#### Bons de sortie (Exit vouchers)

- Sortie de stock sans facturation directe (traçabilité des mouvements).

---

### 3.7 Achats

#### Bons de commande (Purchase orders)

- Création de commandes fournisseur : fournisseur, lignes (produit, quantité, prix), totaux, TVA.
- Statuts : brouillon, envoyé, reçu partiellement, reçu, annulé.

#### Bons de réception (Goods receipts / Receipts)

- Réception physique des marchandises.
- Lien avec un bon de commande, mise à jour des quantités en stock.

#### Factures fournisseur (Supplier invoices)

- Saisie des factures reçues des fournisseurs.
- Lien éventuel avec commande / réception.
- Échéance, montant dû, suivi du solde.

#### Paiements fournisseur (Supplier payments)

- Enregistrement des paiements aux fournisseurs.
- Répartition sur une ou plusieurs factures fournisseur.

#### Retenues à la source (Withholding tax)

- Gestion des retenues à la source sur factures fournisseur (taux, montant retenu, net payé).

---

### 3.8 Stock et entrepôts

- **Entrepôts (Warehouses)** : plusieurs emplacements de stock.
- **Mouvements de stock** : entrées (achats, retours), sorties (ventes, BL, bons de sortie), transferts entre entrepôts.
- **Inventaires** : état des stocks par produit / entrepôt, comparaison stock théorique / physique.
- **Niveaux de stock** : alertes si seuil minimum atteint (selon configuration produit).

---

### 3.9 Comptabilité

- **Plan comptable** : plan tunisien (ou personnalisé), comptes avec code, libellé, type (actif, passif, charge, produit), regroupements.
- **Synchronisation** : écritures comptables générées automatiquement à partir des factures, paiements, achats (selon les modules activés).
- **Écritures manuelles** : saisie d’écritures (journal, date, compte débit, compte crédit, libellé, montant).
- **Journaux** : journaux légaux / par type (ventes, achats, banque, caisse, OD, etc.).
- **Grand livre** : liste des mouvements par compte.
- **Balance** : balance des comptes (balance générale, balance auxiliaire).
- **États financiers** (stack backend Python) : bilan, compte de résultat, flux de trésorerie.
- **Exercices fiscaux** : gestion des périodes comptables (ouvertures / clôtures).

---

### 3.10 Trésorerie et caisse

- **Trésorerie** : suivi des flux (encaissements, décaissements), soldes banque / caisse.
- **Comptes de caisse / banque** (cash_accounts) : modélisation des comptes pour un suivi « cash » des paiements.
- **Prévisions** : échéances à venir (factures à encaisser / à payer).

---

### 3.11 Projets et feuilles de temps

- **Projets** : nom, client, budget, dates, statut (planification, en cours, terminé, annulé).
- **Feuilles de temps (timesheets)** : saisie du temps par projet / tâche / collaborateur, taux horaire, facturable ou non, lien avec facturation.

---

### 3.12 Tableau de bord et rapports

- **Dashboard** : indicateurs (CA, créances, dettes, factures en attente, paiements récents).
- **Rapports** : évolution du CA, marges, analyse des dépenses, comparatifs.
- **Export** : PDF, Excel (rapports comptables, grand livre, balance, etc.).

---

### 3.13 Fonctionnalités avancées (selon la stack)

- **Portail client** : espace client sécurisé (factures, devis, paiements) – backend Python.
- **Chatbot** : interface conversationnelle (finances / facturation) – backend Python.
- **Assistant IA / AI assistant** : hooks pour intégrations IA – backend Python.
- **Moteur de rappels** : automatisation des relances – backend Python.
- **Configurations multi-pays** : paramétrage comptable par pays – backend Python.
- **Signatures** : signature électronique de documents – backend Python.
- **Import / export** : CSV/Excel pour clients, produits, etc. – backend Python.
- **Génération PDF** : factures, reçus (WeasyPrint) – backend Python si dépendances installées.

---

## 4. Parcours utilisateur type

1. **Arrivée sur le site** : page d’accueil (landing), présentation des fonctionnalités, tarifs, blog, aide.
2. **Inscription** : création de compte (email ou Google/Facebook), validation email si activée.
3. **Première connexion** : création d’une **entreprise** (obligatoire pour accéder au cœur métier).
4. **Configuration** : paramètres de l’entreprise (fiscalité, numérotation, logo, banque).
5. **Saisie des données de base** : clients, fournisseurs, produits.
6. **Activité courante** : création de devis → envoi → acceptation → conversion en facture → envoi facture → enregistrement des paiements ; achats (commandes, réceptions, factures fournisseur, paiements) ; mouvements de stock ; consultation du tableau de bord et de la comptabilité.
7. **Fin de période** : rapports, export, clôture d’exercice (selon modules disponibles).

---

## 5. Résumé technique par stack

### Stack principale (client + server, MySQL)

- **Frontend** : React 19, Vite, Tailwind, tRPC, Wouter.
- **Backend** : Node.js, Express, tRPC, Drizzle ORM, MySQL.
- **Modèles** : utilisateurs, entreprises, clients, fournisseurs, produits, catégories, factures, devis, lignes de facture/devis, paiements, entrepôts, mouvements de stock, etc. (schéma dans `drizzle/schema.ts`).
- **Auth** : session (cookie), OAuth Google (redirect), JWT (jose).
- **Lancement** : `pnpm dev` (serveur unique qui sert l’API et le front en dev).

### Stack alternative (frontend + backend, MongoDB)

- **Frontend** : React 19, Create React App (craco), React Router, Axios, i18n.
- **Backend** : FastAPI, Uvicorn, PyMongo/Motor (MongoDB).
- **Modèles** : documents MongoDB (users, companies, customers, invoices, etc.) – voir `contracts.md` et modèles dans `backend/`.
- **Auth** : JWT, OAuth Google/Facebook (token envoyé au backend puis création/liaison utilisateur).
- **Lancement** : `yarn start` (frontend) + `uvicorn server:app --port 8000` (backend), MongoDB requis.

---

## 6. Public cible et positionnement

- **TPE/PME** (dirigeants, petites équipes).
- **Marché tunisien** : conformité fiscale (TVA, FODEC, timbre fiscal, plan comptable tunisien), facturation électronique (préparation 2026).
- **Usage** : facturation, gestion des clients/fournisseurs, stock, comptabilité de base à avancée, rapports et pilotage de l’activité.

Ce document décrit les **fonctionnalités prévues ou implémentées** selon le code et la documentation du dépôt ; certaines peuvent être partielles selon la branche ou la stack utilisée.
