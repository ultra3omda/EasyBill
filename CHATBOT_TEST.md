# Test du module Chatbot EasyBill

## Prérequis

### 1. Backend Python (port 8000)

```bash
cd backend
# Vérifier .env : MONGO_URL, DB_NAME, JWT_SECRET_KEY ou JWT_SECRET
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

### 2. Frontend React (port 3000)

```bash
cd frontend
# Créer .env si besoin :
# REACT_APP_BACKEND_URL=http://localhost:8000
yarn start
```

### 3. Données de test (recommandé)

Connectez-vous avec un utilisateur, puis appelez l’API seed pour créer des clients, factures, etc. :

```bash
# Obtenez le token JWT après login
# Obtenez le company_id (id de l’entreprise)

curl -X POST "http://localhost:8000/api/seed/test-data?company_id=VOTRE_COMPANY_ID" \
  -H "Authorization: Bearer VOTRE_TOKEN"
```

Ou via l’interface : Dashboard → générer données de test (si l’option existe).

Le seed crée notamment des clients : Ahmed Ben Ali, Fatma Trabelsi, Mohamed Sahli, Tech Solutions SARL, etc.

---

## Scénario de test utilisateur réel

### Étape 1 : Connexion

1. Ouvrir http://localhost:3000
2. Se connecter (email + mot de passe)
3. Choisir ou créer une entreprise si nécessaire

### Étape 2 : Accès au chatbot

1. Dans le menu de gauche, cliquer sur **Assistant chatbot** (icône Bot)
2. Ou aller directement sur http://localhost:3000/chatbot

### Étape 3 : Test des commandes

| # | Commande à taper | Résultat attendu |
|---|------------------|------------------|
| 1 | `factures impayées` | Liste des factures non payées avec montants |
| 2 | `rapport aujourd'hui` | Résumé du jour : factures créées, paiements, impayés |
| 3 | `client Ahmed` | Fiche client Ahmed (téléphone, solde dû) |
| 4 | `facture 250 dt pour Ahmed réparation moteur` | Création d’une facture FAC-YYYY-NNNN pour Ahmed, 250 TND |
| 5 | `devis 300 dt pour Fatma peinture murale` | Création d’un devis DEV-YYYY-NNNN pour Fatma |
| 6 | `Ahmed a payé 200` | Enregistrement d’un paiement PAY-YYYY-NNNNN pour Ahmed |
| 7 | `rappeler Mohamed` | Info rappel : factures impayées et montant à rappeler |

### Étape 4 : Vérifications post-test

- **Factures** : Menu Ventes → Factures → vérifier la facture créée
- **Devis** : Menu Ventes → Devis → vérifier le devis créé
- **Paiements** : Menu Ventes → Paiements → vérifier le paiement créé

---

## Commandes rapides (panneau droit)

Cliquer sur une commande pour l’envoyer automatiquement.

---

## Dépannage

- **401 Unauthorized** : Token expiré ou invalide → se reconnecter
- **Client non trouvé** : Utiliser un nom exact (Ahmed, Fatma, Mohamed) ou créer le client dans Contacts → Clients
- **REACT_APP_BACKEND_URL non défini** : Créer `frontend/.env` avec `REACT_APP_BACKEND_URL=http://localhost:8000`
