# Démarrer EasyBill (frontend + backend + base de données)

## 1. Base de données (MongoDB)

```powershell
docker compose up -d
```

Vérifier que le conteneur tourne : `docker ps` (easybill-mongo).

## 2. Backend (API FastAPI)

```powershell
cd backend
.\.venv\Scripts\activate
uvicorn server:app --host 0.0.0.0 --port 8000
```

L’API est disponible sur **http://localhost:8000**.

Fichier de config : `backend/.env`. Pour l’envoi d’emails (vérification de compte, reset mot de passe), ajouter par exemple :

```env
FRONTEND_URL=http://localhost:3000
MAIL_HOST=ssl0.ovh.net
MAIL_PORT=465
MAIL_USERNAME=votre-email@domain.com
MAIL_PASSWORD=votre-mot-de-passe
MAIL_ENCRYPTION=ssl
MAIL_FROM_ADDRESS=hello@votredomaine.app
```

Voir `backend/.env.example` pour la liste complète.

## 3. Frontend (React)

```powershell
cd frontend
npm run start
```

Ou avec npx : `npx craco start`

L’app est disponible sur **http://localhost:3000**.

Le frontend utilise le proxy (`setupProxy.js`) : les requêtes `/api/*` sont relayées vers le backend. Variables dans `frontend/.env` :
- `REACT_APP_USE_PROXY=true` (requêtes via proxy, pas de CORS)
- `REACT_APP_GOOGLE_CLIENT_ID` et `REACT_APP_GOOGLE_REDIRECT_URI=http://localhost:3000/login` pour l’auth Google

## Premier utilisateur

1. Ouvrir http://localhost:3000
2. Cliquer sur **S’inscrire** et créer un compte
3. Consulter l’email de vérification (lien dans le mail), puis se connecter
4. Créer une **entreprise** pour accéder au tableau de bord

Si un compte existe déjà avec cet email, un message invite à se connecter directement.

## Note

- La génération PDF (factures, reçus) est désactivée sur Windows si Pango/GTK n’est pas installé (WeasyPrint). Le reste de l’app fonctionne normalement.
