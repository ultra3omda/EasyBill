# 📧 Configuration du Service d'Envoi d'Emails

## Vue d'ensemble

EasyBill utilise un service d'email SMTP pour envoyer :
- Emails de vérification de compte
- Liens de réinitialisation de mot de passe
- Factures aux clients
- Devis aux clients
- Rappels de paiement

## Configuration SMTP

### Option 1 : Gmail (Recommandé pour le développement)

1. **Activer la validation en 2 étapes** sur votre compte Google
   - Allez sur https://myaccount.google.com/security
   - Activez la validation en 2 étapes

2. **Créer un mot de passe d'application**
   - Allez sur https://myaccount.google.com/apppasswords
   - Sélectionnez "Mail" et "Autre (nom personnalisé)"
   - Nommez-le "EasyBill"
   - Copiez le mot de passe généré (16 caractères)

3. **Configurer les variables d'environnement**
   ```bash
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=votre-email@gmail.com
   SMTP_PASSWORD=votre-mot-de-passe-application
   SMTP_FROM_EMAIL=votre-email@gmail.com
   SMTP_FROM_NAME=EasyBill
   ```

### Option 2 : SendGrid (Recommandé pour la production)

SendGrid offre 100 emails/jour gratuits, idéal pour démarrer.

1. **Créer un compte SendGrid**
   - Inscrivez-vous sur https://sendgrid.com
   - Vérifiez votre email

2. **Créer une clé API**
   - Allez dans Settings > API Keys
   - Créez une nouvelle clé avec accès "Full Access"
   - Copiez la clé (elle ne sera affichée qu'une fois)

3. **Configurer les variables d'environnement**
   ```bash
   SMTP_HOST=smtp.sendgrid.net
   SMTP_PORT=587
   SMTP_USER=apikey
   SMTP_PASSWORD=votre-cle-api-sendgrid
   SMTP_FROM_EMAIL=noreply@votredomaine.com
   SMTP_FROM_NAME=EasyBill
   ```

4. **Vérifier votre domaine d'envoi**
   - Allez dans Settings > Sender Authentication
   - Suivez les instructions pour vérifier votre domaine

### Option 3 : Mailgun

Mailgun offre 5000 emails/mois gratuits les 3 premiers mois.

1. **Créer un compte Mailgun**
   - Inscrivez-vous sur https://www.mailgun.com

2. **Obtenir les credentials SMTP**
   - Allez dans Sending > Domain settings
   - Copiez les informations SMTP

3. **Configurer les variables d'environnement**
   ```bash
   SMTP_HOST=smtp.mailgun.org
   SMTP_PORT=587
   SMTP_USER=postmaster@votredomaine.mailgun.org
   SMTP_PASSWORD=votre-mot-de-passe-mailgun
   SMTP_FROM_EMAIL=noreply@votredomaine.com
   SMTP_FROM_NAME=EasyBill
   ```

### Option 4 : SMTP personnalisé

Si vous avez votre propre serveur SMTP :

```bash
SMTP_HOST=smtp.votredomaine.com
SMTP_PORT=587  # ou 465 pour SSL
SMTP_USER=votre-utilisateur
SMTP_PASSWORD=votre-mot-de-passe
SMTP_FROM_EMAIL=noreply@votredomaine.com
SMTP_FROM_NAME=EasyBill
```

## Configuration Frontend

Assurez-vous que la variable `FRONTEND_URL` pointe vers votre application frontend :

```bash
# Développement
FRONTEND_URL=http://localhost:3000

# Production
FRONTEND_URL=https://app.easybill.com
```

## Test de la configuration

### Test manuel via Python

```python
from services.email_service import email_service

# Test email de vérification
email_service.send_verification_email(
    to_email="test@example.com",
    full_name="Test User",
    token="test-token-123"
)

# Test email de réinitialisation
email_service.send_password_reset_email(
    to_email="test@example.com",
    full_name="Test User",
    token="test-token-456"
)
```

### Test via API

```bash
# Test forgot password
curl -X POST http://localhost:8000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "votre-email@example.com"}'

# Test resend verification
curl -X POST http://localhost:8000/api/auth/resend-verification \
  -H "Content-Type: application/json" \
  -d '{"email": "votre-email@example.com"}'
```

## Dépannage

### Erreur : "SMTP AUTH extension not supported"

- Vérifiez que le port est correct (587 pour TLS, 465 pour SSL)
- Assurez-vous que votre pare-feu autorise les connexions sortantes

### Erreur : "Username and Password not accepted"

- Gmail : Utilisez un mot de passe d'application, pas votre mot de passe principal
- SendGrid : Le nom d'utilisateur doit être exactement "apikey"
- Vérifiez qu'il n'y a pas d'espaces dans le mot de passe

### Les emails ne sont pas reçus

1. Vérifiez le dossier spam/courrier indésirable
2. Vérifiez que l'adresse email est correcte
3. Consultez les logs du serveur pour les erreurs
4. Vérifiez les limites d'envoi de votre fournisseur SMTP

### Mode développement sans SMTP

Si `SMTP_USER` et `SMTP_PASSWORD` ne sont pas configurés, le service d'email :
- Ne lèvera pas d'erreur
- Affichera les informations dans les logs
- Retournera les liens dans les réponses API (pour test)

## Bonnes pratiques

### Sécurité

- ✅ Ne jamais commiter les credentials SMTP dans le code
- ✅ Utiliser des variables d'environnement
- ✅ Utiliser des mots de passe d'application (Gmail)
- ✅ Activer DKIM et SPF pour votre domaine
- ✅ Surveiller les bounces et les plaintes de spam

### Performance

- ✅ Utiliser un service d'email dédié en production (SendGrid, Mailgun)
- ✅ Implémenter une file d'attente pour les envois en masse
- ✅ Limiter le nombre d'emails par utilisateur (anti-spam)
- ✅ Utiliser des templates HTML responsive

### Conformité

- ✅ Inclure un lien de désinscription dans les emails marketing
- ✅ Respecter le RGPD pour les données personnelles
- ✅ Obtenir le consentement avant l'envoi d'emails marketing
- ✅ Fournir une politique de confidentialité

## Templates d'emails

Les templates sont définis dans `backend/services/email_service.py`.

Pour personnaliser les templates :

1. Modifiez le HTML dans les méthodes `send_*_email()`
2. Utilisez des variables pour la personnalisation
3. Testez sur différents clients email (Gmail, Outlook, etc.)
4. Assurez-vous que les emails sont responsive

## Emails disponibles

| Type | Méthode | Utilisation |
|------|---------|-------------|
| Vérification email | `send_verification_email()` | Inscription utilisateur |
| Réinitialisation MDP | `send_password_reset_email()` | Mot de passe oublié |
| Facture | `send_invoice_email()` | Envoi facture client |
| Devis | `send_quote_email()` | Envoi devis client |

## Prochaines étapes

Pour ajouter de nouveaux types d'emails :

1. Créer une nouvelle méthode dans `EmailService`
2. Définir le template HTML
3. Appeler la méthode depuis les routes appropriées

Exemple :

```python
def send_reminder_email(self, to_email: str, invoice_number: str, amount_due: float):
    subject = f"Rappel - Facture {invoice_number} impayée"
    html_content = """..."""
    return self._send_email(to_email, subject, html_content)
```

## Support

Pour toute question sur la configuration des emails, consultez :
- Documentation SendGrid : https://docs.sendgrid.com
- Documentation Mailgun : https://documentation.mailgun.com
- Documentation Gmail SMTP : https://support.google.com/mail/answer/7126229
