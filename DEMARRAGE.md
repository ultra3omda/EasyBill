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

Fichier de config : `backend/.env` (MONGO_URL, DB_NAME, JWT_SECRET déjà renseignés).

## 3. Frontend (React)

```powershell
cd frontend
npm run start
```

Ou avec npx : `npx craco start`

L’app est disponible sur **http://localhost:3001**.

Le frontend utilise `REACT_APP_BACKEND_URL=http://localhost:8000` (défini dans `frontend/.env`).

## Premier utilisateur

1. Ouvrir http://localhost:3001
2. Cliquer sur **S’inscrire** et créer un compte
3. Après connexion, créer une **entreprise** pour accéder au tableau de bord

## Note

- La génération PDF (factures, reçus) est désactivée sur Windows si Pango/GTK n’est pas installé (WeasyPrint). Le reste de l’app fonctionne normalement.
