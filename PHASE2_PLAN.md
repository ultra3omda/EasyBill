# PHASE 2 - PLAN D'IMPLÉMENTATION
## Fonctionnalités Manquantes - EasyBill

**Date de début:** 2025-01-25
**Statut:** EN COURS

---

## 🎯 OBJECTIFS PHASE 2

Implémenter les fonctionnalités manquantes critiques pour rendre l'application production-ready:
1. ✅ Automatisations essentielles
2. ✅ Interfaces frontend manquantes
3. ✅ Améliorations UX
4. ✅ Support bilingue (FR/EN)

---

## 📋 TÂCHES PRIORITAIRES

### **BLOC 1: AUTOMATISATIONS CRITIQUES** (Priorité MAX)

#### 1.1 Envoi automatique d'emails
- [ ] Endpoint: POST /api/invoices/{id}/send-email
- [ ] Endpoint: POST /api/quotes/{id}/send-email
- [ ] Intégration avec email_service existant
- [ ] Bouton "Envoyer par email" dans UI factures/devis
- [ ] Template email professionnel avec lien PDF
- **Impact:** Permet aux utilisateurs d'envoyer factures/devis directement

#### 1.2 Conversion automatique BL → Facture
- [ ] Endpoint: POST /api/delivery-notes/{id}/convert-to-invoice
- [ ] Copie des items et montants
- [ ] Lien entre BL et facture créée
- [ ] Bouton "Convertir en facture" dans UI BL
- **Impact:** Simplifie le processus de facturation après livraison

#### 1.3 Sortie automatique de stock depuis BL
- [ ] Hook dans routes/delivery_notes.py lors de la validation
- [ ] Appel à stock_service pour sortir les quantités
- [ ] Mise à jour automatique des stocks produits
- [ ] Log des mouvements de stock
- **Impact:** Stock toujours à jour automatiquement

---

### **BLOC 2: INTERFACES FRONTEND ESSENTIELLES** (Haute priorité)

#### 2.1 Page Rappels (Reminders)
- [ ] Frontend: /app/frontend/src/pages/Reminders.js
- [ ] Liste des rappels avec filtres (statut, client)
- [ ] Formulaire création/modification rappel
- [ ] Bouton "Envoyer rappel" par email
- [ ] Gestion des templates de rappels
- [ ] Intégration avec backend existant
- **Impact:** Interface utilisateur pour gérer les relances clients

#### 2.2 Pages pour nouveaux modules P1
- [ ] Page Bons de Sortie (Exit Vouchers)
- [ ] Page Bons de Réception (Receipts)
- [ ] Page Notes de Débours (Disbursements)
- [ ] Page Retenues à la Source (Withholding Taxes)
- [ ] Navigation menu mise à jour
- **Impact:** Accès UI aux 17 fonctionnalités P0/P1 backend

#### 2.3 Page Inventaires Périodiques
- [ ] Frontend: /app/frontend/src/pages/Inventory.js
- [ ] Liste des inventaires avec statut
- [ ] Formulaire création inventaire
- [ ] Saisie des quantités réelles vs théoriques
- [ ] Génération automatique des écarts
- [ ] Ajustement automatique des stocks
- **Impact:** Contrôle et ajustement des stocks

---

### **BLOC 3: AMÉLIORATIONS UX** (Moyenne priorité)

#### 3.1 Synthèse Client/Fournisseur
- [ ] Onglet "Synthèse" dans page Client
- [ ] Statistiques: CA total, factures payées/impayées, retard moyen
- [ ] Graphique évolution CA sur 12 mois
- [ ] Historique complet des transactions
- [ ] Idem pour Fournisseurs
- **Impact:** Vue 360° de chaque client/fournisseur

#### 3.2 Multi-contacts par Client
- [ ] Modèle: contacts array dans Customer
- [ ] Section "Contacts" dans formulaire client
- [ ] Ajout/suppression de contacts multiples
- [ ] Contact principal vs secondaires
- **Impact:** Gestion des entreprises avec plusieurs interlocuteurs

#### 3.3 Personnalisation PDF Avancée
- [ ] Upload logo entreprise
- [ ] Configuration en-tête et pied de page personnalisés
- [ ] Choix de couleurs principales
- [ ] Ajout de mentions légales personnalisées
- [ ] Prévisualisation avant sauvegarde
- **Impact:** Documents professionnels à l'image de l'entreprise

---

### **BLOC 4: INTERNATIONALISATION** (Moyenne priorité)

#### 4.1 Support bilingue FR/EN
- [ ] Fichiers de traduction: /app/frontend/src/locales/fr.json, en.json
- [ ] Bibliothèque i18n (react-i18next)
- [ ] Sélecteur de langue dans navbar
- [ ] Traduction de tous les textes UI
- [ ] Traduction des emails et PDF
- [ ] Persistance de la préférence utilisateur
- **Impact:** Application utilisable en français et anglais

---

## 🚀 ORDRE D'IMPLÉMENTATION

### **Sprint 1 (Automatisations)** - 2-3h
1. Envoi emails automatique (factures/devis)
2. Conversion BL → Facture
3. Sortie stock automatique depuis BL

### **Sprint 2 (Frontend essentiel)** - 2-3h
4. Page Rappels (UI complète)
5. Pages modules P1 (5 pages basiques)

### **Sprint 3 (UX & i18n)** - 2-3h
6. Synthèse client/fournisseur
7. Multi-contacts
8. Support bilingue FR/EN

### **Sprint 4 (Finitions)** - 1-2h
9. Personnalisation PDF
10. Page Inventaires
11. Tests finaux

**DURÉE TOTALE ESTIMÉE: 7-11 heures**

---

## 📊 MÉTRIQUES DE SUCCÈS

- ✅ 100% des fonctionnalités P2 implémentées
- ✅ Toutes les pages frontend fonctionnelles
- ✅ Automatisations testées et validées
- ✅ Application bilingue (FR/EN)
- ✅ Tests E2E passés

---

## 🔄 STATUT ACTUEL

**Phase 1:** ✅ TERMINÉE (17/17 fonctionnalités P0/P1, tests E2E 100%)
**Phase 2:** 🚧 EN COURS (Sprint 1 - Automatisations)

---

*Document mis à jour en temps réel pendant l'implémentation*
