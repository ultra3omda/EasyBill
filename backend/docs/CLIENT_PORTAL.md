# 🔐 Portail Client Public - EasyBill

## Vue d'ensemble

Le portail client public permet aux clients d'accéder à leurs documents (factures, devis, paiements) via un lien sécurisé sans avoir besoin de créer un compte ou de se connecter à l'application principale.

## 🎯 Objectifs

- **Accès simplifié** : Les clients accèdent à leurs documents via un simple lien
- **Sécurité** : Tokens sécurisés avec expiration automatique
- **Autonomie** : Les clients consultent leurs documents 24/7 sans intervention
- **Transparence** : Vue complète sur factures, devis, paiements et soldes
- **Professionnalisme** : Interface moderne et responsive aux couleurs de l'entreprise

## 📋 Fonctionnalités

### Pour l'entreprise (Backend)

1. **Génération de liens sécurisés** pour chaque client
2. **Envoi automatique par email** du lien d'accès
3. **Gestion des expirations** (par défaut 90 jours)
4. **Révocation d'accès** à tout moment
5. **Statistiques d'utilisation** (nombre d'accès, dernière connexion)

### Pour le client (Frontend)

1. **Tableau de bord** avec statistiques
2. **Liste des factures** avec statuts et soldes
3. **Liste des devis** avec dates de validité
4. **Historique des paiements** avec factures associées
5. **Téléchargement des PDF** (à venir)

## 🏗️ Architecture

### Backend (Python/FastAPI)

#### Service principal
**Fichier** : `backend/services/client_portal_service.py`

**Classe** : `ClientPortalService`

**Méthodes principales** :
- `create_customer_portal_access()` - Crée un accès portail
- `verify_portal_token()` - Vérifie et valide un token
- `get_customer_invoices()` - Récupère les factures du client
- `get_customer_quotes()` - Récupère les devis du client
- `get_customer_payments()` - Récupère les paiements du client
- `revoke_portal_access()` - Révoque un accès
- `send_portal_link_email()` - Envoie l'email avec le lien

#### Routes API
**Fichier** : `backend/routes/client_portal.py`

**Endpoints protégés** (nécessitent authentification) :
```
POST /api/client-portal/create-access
POST /api/client-portal/send-link
POST /api/client-portal/revoke-access
```

**Endpoints publics** (sans authentification) :
```
GET /api/client-portal/verify/{token}
GET /api/client-portal/invoices/{token}
GET /api/client-portal/quotes/{token}
GET /api/client-portal/payments/{token}
GET /api/client-portal/dashboard/{token}
```

### Frontend (React)

#### Page principale
**Fichier** : `frontend/src/pages/ClientPortal.js`

**Composant** : `ClientPortal`

**Fonctionnalités** :
- Vérification automatique du token
- Navigation par onglets (Dashboard, Factures, Devis, Paiements)
- Affichage responsive
- Gestion des erreurs (token invalide/expiré)

#### Intégration dans l'application
**Fichier** : `frontend/src/pages/Customers.js`

**Bouton** : "Envoyer lien portail" dans le menu actions de chaque client

## 🔐 Sécurité

### Génération des tokens

Les tokens sont générés de manière sécurisée :

```python
token = secrets.token_urlsafe(32)  # 32 bytes = 256 bits
token_hash = hashlib.sha256(token.encode()).hexdigest()
```

- **Token brut** : Envoyé au client (43 caractères)
- **Token hashé** : Stocké en base de données (SHA-256)
- **Impossible de récupérer** le token original depuis la base

### Expiration

- **Durée par défaut** : 90 jours
- **Configurable** lors de la création
- **Vérification automatique** à chaque accès
- **Révocation manuelle** possible à tout moment

### Validation

À chaque requête, le système vérifie :

1. ✅ Token existe dans la base
2. ✅ Token n'est pas révoqué (`is_active = true`)
3. ✅ Token n'est pas expiré (`expires_at > now`)
4. ✅ Client et entreprise existent toujours

### Statistiques

Le système enregistre :
- **Date de création** du token
- **Dernière connexion** du client
- **Nombre d'accès** total

## 📧 Email de notification

### Template

L'email envoyé au client contient :

- **En-tête** avec logo de l'entreprise (si disponible)
- **Message de bienvenue** personnalisé
- **Liste des fonctionnalités** accessibles
- **Bouton d'accès** avec le lien sécurisé
- **Avertissement de sécurité** (lien personnel, date d'expiration)
- **Footer** avec copyright et branding EasyBill

### Personnalisation

Variables dynamiques :
- `{customer_name}` - Nom du client
- `{company_name}` - Nom de l'entreprise
- `{portal_url}` - Lien d'accès complet
- `{expires_at}` - Date d'expiration

## 🎨 Interface utilisateur

### Design

- **Gradient violet/bleu** pour l'ambiance
- **Cards blanches** pour le contenu
- **Badges colorés** pour les statuts
- **Responsive** : Mobile, tablette, desktop

### Navigation

4 onglets principaux :
1. **📊 Tableau de bord** - Vue d'ensemble
2. **📄 Factures** - Liste complète
3. **📋 Devis** - Devis en cours et historique
4. **💰 Paiements** - Historique des règlements

### Statuts

**Factures** :
- 🔵 Envoyé (`sent`)
- 🟢 Payé (`paid`)
- 🟡 Partiel (`partial`)
- 🔴 En retard (`overdue`)

**Devis** :
- 🔵 Envoyé (`sent`)
- 🟢 Accepté (`accepted`)
- 🔴 Refusé (`rejected`)

## 📊 Modèle de données

### Collection MongoDB : `customer_portal_access`

```json
{
  "_id": ObjectId,
  "customer_id": ObjectId,
  "company_id": ObjectId,
  "token_hash": "sha256_hash_of_token",
  "expires_at": ISODate,
  "created_at": ISODate,
  "last_accessed_at": ISODate,
  "access_count": 0,
  "is_active": true
}
```

### Index recommandés

```javascript
db.customer_portal_access.createIndex({ "token_hash": 1 })
db.customer_portal_access.createIndex({ "customer_id": 1, "company_id": 1 })
db.customer_portal_access.createIndex({ "expires_at": 1 })
```

## 🚀 Utilisation

### 1. Créer un accès portail

**Depuis l'interface** :
1. Aller dans "Clients"
2. Cliquer sur le menu actions (⋮) d'un client
3. Sélectionner "Envoyer lien portail"
4. Le lien est créé et envoyé automatiquement par email

**Via API** :
```bash
curl -X POST "http://localhost:8000/api/client-portal/create-access" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "65abc123def456789",
    "company_id": "65xyz789abc123456",
    "expires_in_days": 90,
    "send_email": true
  }'
```

**Réponse** :
```json
{
  "message": "Accès portail créé avec succès",
  "access_id": "65def456abc789123",
  "portal_url": "http://localhost:3000/portal/xYz123AbC...",
  "expires_at": "2026-04-25T10:30:00Z",
  "email_sent": true
}
```

### 2. Accéder au portail

Le client reçoit un email avec un lien du type :
```
http://localhost:3000/portal/xYz123AbC456DeF789GhI012JkL345MnO678PqR
```

En cliquant sur ce lien, il accède directement à son espace client.

### 3. Révoquer un accès

**Via API** :
```bash
curl -X POST "http://localhost:8000/api/client-portal/revoke-access" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "65abc123def456789",
    "company_id": "65xyz789abc123456"
  }'
```

## 🔄 Workflow complet

```
1. Entreprise crée un client
   ↓
2. Entreprise clique "Envoyer lien portail"
   ↓
3. Système génère token sécurisé
   ↓
4. Système envoie email au client
   ↓
5. Client clique sur le lien
   ↓
6. Système vérifie token
   ↓
7. Client accède à son espace
   ↓
8. Client consulte factures/devis/paiements
```

## 📈 Statistiques disponibles

Pour chaque accès portail, le système enregistre :

- **Date de création** : Quand le lien a été généré
- **Date d'expiration** : Quand le lien expirera
- **Dernière connexion** : Dernière visite du client
- **Nombre d'accès** : Combien de fois le client s'est connecté

Ces statistiques peuvent être utilisées pour :
- Identifier les clients actifs
- Détecter les liens non utilisés
- Renouveler les accès expirés
- Analyser l'engagement des clients

## 🛠️ Configuration

### Variables d'environnement

```bash
# URL du frontend (pour générer les liens)
FRONTEND_URL=http://localhost:3000

# Configuration email (pour envoyer les liens)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=votre-email@gmail.com
SMTP_PASSWORD=votre-mot-de-passe-app
SMTP_FROM_EMAIL=noreply@easybill.com
SMTP_FROM_NAME=EasyBill
```

### Personnalisation

**Durée d'expiration par défaut** :
Modifier dans `client_portal_service.py` :
```python
expires_in_days: int = 90  # Changer ici
```

**Design du portail** :
Modifier dans `ClientPortal.js` :
```javascript
// Couleurs du gradient
className="bg-gradient-to-br from-purple-50 to-blue-50"

// Logo de l'entreprise
{company?.logo && <img src={company.logo} alt={company.name} />}
```

## 🔮 Évolutions futures

### Fonctionnalités prévues

1. **Téléchargement PDF** - Bouton de téléchargement pour chaque document
2. **Acceptation de devis** - Le client peut accepter/refuser un devis
3. **Paiement en ligne** - Intégration Stripe/PayPal pour payer les factures
4. **Notifications** - Alertes pour nouvelles factures/devis
5. **Historique complet** - Graphiques d'évolution des achats
6. **Multi-contact** - Plusieurs accès pour une même entreprise cliente
7. **Personnalisation** - Couleurs et logo personnalisables par entreprise
8. **Messagerie** - Chat direct avec le fournisseur
9. **Documents joints** - Upload de documents (bons de commande, etc.)
10. **Export comptable** - Le client peut exporter ses données

### Améliorations techniques

1. **Cache** - Redis pour améliorer les performances
2. **Rate limiting** - Protection contre les abus
3. **Logs avancés** - Audit trail complet
4. **Tests** - Tests unitaires et d'intégration
5. **Documentation API** - Swagger/OpenAPI
6. **Webhooks** - Notifications en temps réel
7. **API publique** - Pour intégrations tierces

## 📞 Support

### Problèmes courants

**Le client ne reçoit pas l'email** :
- Vérifier la configuration SMTP
- Vérifier les spams du client
- Vérifier l'adresse email du client
- Consulter les logs backend

**Token invalide ou expiré** :
- Vérifier la date d'expiration
- Vérifier que l'accès n'a pas été révoqué
- Générer un nouveau lien si nécessaire

**Erreur de chargement des données** :
- Vérifier que le client existe toujours
- Vérifier que l'entreprise existe toujours
- Consulter les logs backend

### Logs

Les logs sont disponibles dans :
```
backend/logs/client_portal.log
```

Activer le logging détaillé :
```python
logger.setLevel(logging.DEBUG)
```

## ✅ Checklist de déploiement

- [x] Service backend créé
- [x] Routes API créées
- [x] Page frontend créée
- [x] Intégration dans Customers
- [x] Template email créé
- [x] Documentation complète
- [x] Sécurité implémentée
- [x] Gestion d'erreurs
- [ ] Tests unitaires
- [ ] Tests d'intégration
- [ ] Tests utilisateurs
- [ ] Migration des données
- [ ] Formation utilisateurs
- [ ] Monitoring production

---

**Version** : 1.0.0  
**Date** : 25 janvier 2026  
**Auteur** : Équipe EasyBill
