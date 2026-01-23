# EasyBill - Logiciel de Facturation Tunisien

EasyBill est une application web complète de facturation et de gestion commerciale, spécialement conçue pour les entreprises tunisiennes. Elle offre une conformité totale avec la réglementation fiscale tunisienne, incluant la gestion de la TVA (19%, 13%, 7%), le FODEC, le droit de consommation et le timbre fiscal.

## Fonctionnalités Principales

### Gestion Commerciale
- **Facturation** : Création et gestion de factures avec numérotation automatique séquentielle
- **Devis** : Création de devis avec conversion en factures
- **Bons de livraison** : Suivi des livraisons
- **Factures d'avoir** : Gestion des retours et avoirs
- **Paiements** : Suivi des encaissements avec paiements partiels

### Gestion des Contacts
- **Clients** : Base de données clients avec historique des transactions
- **Fournisseurs** : Gestion des fournisseurs et achats

### Gestion de Stock
- **Articles** : Catalogue de produits et services
- **Entrepôts** : Gestion multi-entrepôts
- **Inventaire** : Suivi des niveaux de stock
- **Mouvements** : Historique des entrées/sorties

### Achats
- **Bons de commande** : Commandes fournisseurs
- **Bons de réception** : Réception des marchandises
- **Factures fournisseur** : Enregistrement des achats

### Comptabilité
- **Plan comptable** : Plan comptable tunisien normalisé
- **Écritures comptables** : Génération automatique des écritures

### Projets
- **Gestion de projets** : Suivi des projets et feuilles de temps

## Conformité Tunisienne

L'application respecte les exigences légales tunisiennes :

| Élément | Format / Valeur |
|---------|-----------------|
| Matricule fiscal | 0000000/L/A/M/000 |
| TVA standard | 19% |
| TVA réduite | 13% ou 7% |
| FODEC | 1% |
| Droit de consommation | Variable |
| Timbre fiscal | 1 DT par facture |
| Devise par défaut | TND (Dinar Tunisien) |

## Stack Technique

| Composant | Technologie |
|-----------|-------------|
| Frontend | React 19 + TypeScript |
| Styling | Tailwind CSS 4 + shadcn/ui |
| Backend | Express 4 + tRPC 11 |
| Base de données | MySQL/TiDB via Drizzle ORM |
| Authentification | OAuth (Manus Auth) |
| Build | Vite |
| Tests | Vitest |

## Installation Locale

### Prérequis

- Node.js 22 ou supérieur
- pnpm (gestionnaire de paquets)
- Base de données MySQL ou TiDB

### Étapes d'Installation

1. **Cloner le dépôt**
```bash
git clone https://github.com/votre-repo/easybill.git
cd easybill
```

2. **Installer les dépendances**
```bash
pnpm install
```

3. **Configurer les variables d'environnement**

Créez un fichier `.env` à la racine du projet :

```env
# Base de données
DATABASE_URL=mysql://user:password@localhost:3306/easybill

# Authentification
JWT_SECRET=votre-secret-jwt-securise
VITE_APP_ID=votre-app-id
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://auth.manus.im

# Propriétaire
OWNER_OPEN_ID=votre-open-id
OWNER_NAME=Votre Nom

# API Manus (optionnel)
BUILT_IN_FORGE_API_URL=https://api.manus.im
BUILT_IN_FORGE_API_KEY=votre-api-key
```

4. **Initialiser la base de données**
```bash
pnpm db:push
```

5. **Lancer le serveur de développement**
```bash
pnpm dev
```

L'application sera accessible à l'adresse `http://localhost:3000`.

## Scripts Disponibles

| Commande | Description |
|----------|-------------|
| `pnpm dev` | Lance le serveur de développement |
| `pnpm build` | Compile l'application pour la production |
| `pnpm test` | Exécute les tests unitaires |
| `pnpm db:push` | Applique les migrations de base de données |
| `pnpm db:studio` | Ouvre Drizzle Studio pour explorer la BDD |

## Structure du Projet

```
easybill/
├── client/                 # Application frontend React
│   ├── src/
│   │   ├── components/     # Composants réutilisables
│   │   ├── pages/          # Pages de l'application
│   │   ├── hooks/          # Hooks personnalisés
│   │   └── lib/            # Utilitaires et configuration
│   └── public/             # Assets statiques
├── server/                 # Backend Express + tRPC
│   ├── routers.ts          # Définition des routes tRPC
│   ├── db.ts               # Helpers de base de données
│   └── _core/              # Infrastructure (auth, context)
├── drizzle/                # Schéma et migrations BDD
│   └── schema.ts           # Définition des tables
├── shared/                 # Types et constantes partagés
└── storage/                # Helpers S3
```

## Pages de l'Application

### Pages Publiques
- `/` - Page d'accueil (Landing)
- `/pricing` - Tarifs et abonnements
- `/blog` - Articles et actualités
- `/docs` - Centre d'aide
- `/mobile` - Application mobile

### Authentification
- `/login` - Connexion
- `/register` - Inscription

### Dashboard (authentifié)
- `/dashboard` - Tableau de bord principal
- `/profile` - Mon profil
- `/subscription` - Mon abonnement
- `/referral` - Programme de parrainage

### Gestion Commerciale
- `/invoices` - Factures
- `/quotes` - Devis
- `/payments` - Paiements
- `/delivery-notes` - Bons de livraison
- `/credit-notes` - Factures d'avoir

### Contacts
- `/clients` - Clients
- `/suppliers` - Fournisseurs

### Stock
- `/products` - Articles
- `/warehouses` - Entrepôts
- `/inventory` - Inventaire
- `/stock-movements` - Mouvements

### Achats
- `/purchase-orders` - Bons de commande
- `/goods-receipts` - Bons de réception
- `/supplier-invoices` - Factures fournisseur

### Comptabilité & Projets
- `/accounting` - Plan comptable et écritures
- `/projects` - Projets

## Modèle d'Abonnement

| Plan | Prix | Limites |
|------|------|---------|
| Gratuit | 0 DT/mois | 1 entreprise, 1 utilisateur, 5 clients, 5 factures |
| Premium | 39 DT/mois | 1 entreprise, 5 utilisateurs, illimité |

## Tests

L'application inclut une suite de tests unitaires couvrant les fonctionnalités principales :

```bash
# Exécuter tous les tests
pnpm test

# Exécuter les tests en mode watch
pnpm test:watch
```

Les tests couvrent :
- Authentification et déconnexion
- Gestion des entreprises
- Calculs de taxes tunisiennes
- Validation des matricules fiscaux

## Déploiement

### Via Manus Platform

L'application est optimisée pour le déploiement sur la plateforme Manus :

1. Créez un checkpoint via l'interface
2. Cliquez sur le bouton "Publish" dans le Management UI
3. Configurez votre domaine personnalisé si souhaité

### Déploiement Manuel

Pour un déploiement sur votre propre infrastructure :

1. **Build de production**
```bash
pnpm build
```

2. **Variables d'environnement de production**

Assurez-vous que toutes les variables d'environnement sont configurées sur votre serveur.

3. **Démarrage**
```bash
NODE_ENV=production node dist/server/index.js
```

## Support

Pour toute question ou assistance :
- Email : support@easybill.tn
- Téléphone : (+216) 98 15 66 66

## Licence

© 2026 EasyBill. Tous droits réservés.
