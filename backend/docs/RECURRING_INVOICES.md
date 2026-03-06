# 🔄 Factures Récurrentes - Documentation

## Vue d'ensemble

Le système de factures récurrentes permet de générer automatiquement des factures à intervalles réguliers pour les abonnements, services récurrents, ou tout autre type de facturation périodique.

## Fonctionnalités

### ✅ Création de factures récurrentes

Créez une facture template qui servira de modèle pour générer automatiquement de nouvelles factures.

**Fréquences supportées :**
- `daily` - Quotidien
- `weekly` - Hebdomadaire
- `monthly` - Mensuel (recommandé)
- `yearly` - Annuel

**Intervalles personnalisables :**
- `interval: 1` - Chaque période (par défaut)
- `interval: 2` - Toutes les 2 périodes (bi-mensuel, bi-annuel, etc.)
- `interval: 3` - Toutes les 3 périodes (trimestriel si monthly)

### ✅ Génération automatique

Les factures sont générées automatiquement selon la fréquence définie :
- Le script `process_recurring_invoices.py` vérifie les factures dues
- Génère de nouvelles factures avec numérotation automatique
- Calcule la prochaine date de génération
- Envoie les factures par email aux clients (optionnel)

### ✅ Gestion des templates

- Consulter tous les templates de factures récurrentes
- Voir l'historique des factures générées
- Annuler un template (arrêter la génération)
- Générer manuellement une facture hors cycle

## API Endpoints

### Liste des factures récurrentes

```http
GET /api/recurring-invoices?company_id={company_id}
Authorization: Bearer {token}
```

**Réponse :**
```json
{
  "invoices": [
    {
      "_id": "...",
      "number": "INV-0001",
      "is_recurring": true,
      "recurrence": {
        "frequency": "monthly",
        "interval": 1,
        "next_date": "2026-02-25T00:00:00Z"
      },
      "customer_id": "...",
      "total": 1500.00,
      "status": "draft"
    }
  ],
  "count": 1
}
```

### Obtenir une facture récurrente

```http
GET /api/recurring-invoices/{invoice_id}
Authorization: Bearer {token}
```

### Historique des factures générées

```http
GET /api/recurring-invoices/{invoice_id}/history
Authorization: Bearer {token}
```

**Réponse :**
```json
{
  "invoices": [
    {
      "_id": "...",
      "number": "INV-0123",
      "parent_recurring_invoice_id": "...",
      "date": "2026-01-25T00:00:00Z",
      "total": 1500.00,
      "status": "sent"
    }
  ],
  "count": 12
}
```

### Annuler une facture récurrente

```http
POST /api/recurring-invoices/{invoice_id}/cancel
Authorization: Bearer {token}
```

**Réponse :**
```json
{
  "message": "Recurring invoice cancelled successfully"
}
```

### Générer manuellement une facture

```http
POST /api/recurring-invoices/{invoice_id}/generate-now
Authorization: Bearer {token}
```

**Réponse :**
```json
{
  "message": "Invoice generated successfully",
  "invoice": {
    "_id": "...",
    "number": "INV-0124",
    "total": 1500.00
  }
}
```

### Traiter toutes les factures dues (Admin)

```http
POST /api/recurring-invoices/process
Authorization: Bearer {token}
```

**Réponse :**
```json
{
  "message": "Recurring invoices processed successfully",
  "result": {
    "processed_at": "2026-01-25T08:00:00Z",
    "total_due": 5,
    "generated": 5,
    "failed": 0,
    "invoices": [...]
  }
}
```

## Création d'une facture récurrente

### Via l'API Invoices

Lors de la création d'une facture, ajoutez les champs de récurrence :

```http
POST /api/invoices
Authorization: Bearer {token}
Content-Type: application/json

{
  "customer_id": "...",
  "date": "2026-01-25T00:00:00Z",
  "due_date": "2026-02-25T00:00:00Z",
  "items": [...],
  "is_recurring": true,
  "recurrence": {
    "frequency": "monthly",
    "interval": 1
  }
}
```

### Champs requis

| Champ | Type | Description |
|-------|------|-------------|
| `is_recurring` | boolean | Doit être `true` |
| `recurrence.frequency` | string | `daily`, `weekly`, `monthly`, `yearly` |
| `recurrence.interval` | integer | Nombre de périodes (défaut: 1) |

### Calcul automatique

- `next_date` est calculé automatiquement lors de la création
- Mis à jour après chaque génération de facture
- Prend en compte les jours du mois (ex: 31 janvier → 28 février)

## Configuration du Cron Job

### Option 1 : Cron Linux

Ajoutez cette ligne à votre crontab (`crontab -e`) :

```bash
# Exécuter tous les jours à 8h00
0 8 * * * cd /path/to/EasyBilll/backend && /usr/bin/python3 scripts/process_recurring_invoices.py >> /var/log/easybill-recurring.log 2>&1
```

### Option 2 : Systemd Timer

Créez `/etc/systemd/system/easybill-recurring.service` :

```ini
[Unit]
Description=EasyBill Recurring Invoices Processing
After=network.target

[Service]
Type=oneshot
User=ubuntu
WorkingDirectory=/path/to/EasyBilll/backend
Environment="MONGO_URL=mongodb://localhost:27017"
Environment="DB_NAME=easybill"
ExecStart=/usr/bin/python3 scripts/process_recurring_invoices.py
```

Créez `/etc/systemd/system/easybill-recurring.timer` :

```ini
[Unit]
Description=Run EasyBill recurring invoices daily

[Timer]
OnCalendar=daily
OnCalendar=08:00
Persistent=true

[Install]
WantedBy=timers.target
```

Activez le timer :

```bash
sudo systemctl enable easybill-recurring.timer
sudo systemctl start easybill-recurring.timer
```

### Option 3 : Celery (Recommandé pour production)

Installez Celery :

```bash
pip install celery redis
```

Créez `tasks.py` :

```python
from celery import Celery
from services.recurring_invoice_service import recurring_invoice_service

app = Celery('easybill', broker='redis://localhost:6379/0')

@app.task
def process_recurring_invoices():
    return recurring_invoice_service.process_recurring_invoices()
```

Configurez le beat schedule :

```python
app.conf.beat_schedule = {
    'process-recurring-invoices': {
        'task': 'tasks.process_recurring_invoices',
        'schedule': crontab(hour=8, minute=0),
    },
}
```

### Option 4 : Exécution manuelle

Pour tester ou exécuter manuellement :

```bash
cd /path/to/EasyBilll/backend
python3 scripts/process_recurring_invoices.py
```

## Notifications par Email

Le script envoie automatiquement les factures générées par email si :
- Le service SMTP est configuré
- Le client a une adresse email valide
- Le statut de la facture passe de `draft` à `sent`

Pour désactiver l'envoi automatique, commentez la section `send_invoice_notifications` dans le script.

## Exemples d'utilisation

### Abonnement mensuel

```json
{
  "customer_id": "...",
  "items": [
    {
      "description": "Abonnement Premium",
      "quantity": 1,
      "unit_price": 99.00
    }
  ],
  "is_recurring": true,
  "recurrence": {
    "frequency": "monthly",
    "interval": 1
  }
}
```

**Résultat :** Facture générée automatiquement le même jour chaque mois.

### Abonnement trimestriel

```json
{
  "recurrence": {
    "frequency": "monthly",
    "interval": 3
  }
}
```

**Résultat :** Facture générée tous les 3 mois.

### Abonnement annuel

```json
{
  "recurrence": {
    "frequency": "yearly",
    "interval": 1
  }
}
```

**Résultat :** Facture générée une fois par an à la même date.

### Abonnement hebdomadaire

```json
{
  "recurrence": {
    "frequency": "weekly",
    "interval": 1
  }
}
```

**Résultat :** Facture générée chaque semaine.

## Gestion du cycle de vie

### États d'une facture récurrente

1. **Active** (`status: "draft"`)
   - Template actif
   - Génère des factures selon la fréquence
   - `next_date` est mis à jour après chaque génération

2. **Annulée** (`status: "cancelled"`)
   - Ne génère plus de factures
   - L'historique reste accessible
   - Peut être réactivée en changeant le statut

### Modification d'une facture récurrente

Pour modifier un template :

```http
PUT /api/invoices/{invoice_id}
Authorization: Bearer {token}

{
  "items": [...],
  "recurrence": {
    "frequency": "monthly",
    "interval": 2
  }
}
```

**Note :** Les modifications affectent uniquement les futures factures générées.

### Suppression

Pour supprimer définitivement un template :

```http
DELETE /api/invoices/{invoice_id}
Authorization: Bearer {token}
```

**Attention :** Les factures déjà générées ne sont pas supprimées.

## Monitoring et Logs

### Logs du script

Les logs sont écrits dans stdout/stderr. Redirigez vers un fichier :

```bash
python3 scripts/process_recurring_invoices.py >> /var/log/easybill-recurring.log 2>&1
```

### Format des logs

```
2026-01-25 08:00:00 - INFO - Starting recurring invoice processing...
2026-01-25 08:00:01 - INFO - Generated recurring invoice INV-0124 from template INV-0001
2026-01-25 08:00:02 - INFO - Sent invoice INV-0124 to customer@example.com
2026-01-25 08:00:03 - INFO - Processing complete: 5 generated, 0 failed
```

### Surveillance

Surveillez ces métriques :
- Nombre de factures générées par jour
- Taux d'échec de génération
- Taux d'échec d'envoi d'email
- Temps d'exécution du script

## Dépannage

### Les factures ne sont pas générées

1. Vérifiez que le cron job s'exécute :
   ```bash
   grep CRON /var/log/syslog
   ```

2. Vérifiez les logs du script :
   ```bash
   tail -f /var/log/easybill-recurring.log
   ```

3. Vérifiez que `next_date` est dans le passé :
   ```javascript
   db.invoices.find({
     is_recurring: true,
     "recurrence.next_date": { $lte: new Date() }
   })
   ```

### Erreur de connexion MongoDB

Assurez-vous que les variables d'environnement sont définies :
```bash
export MONGO_URL=mongodb://localhost:27017
export DB_NAME=easybill
```

### Les emails ne sont pas envoyés

Vérifiez la configuration SMTP (voir `EMAIL_SETUP.md`).

## Bonnes pratiques

### ✅ Recommandations

- Exécutez le script quotidiennement (pas plus fréquemment)
- Utilisez `monthly` pour la plupart des abonnements
- Testez avec `generate-now` avant de mettre en production
- Surveillez les logs régulièrement
- Sauvegardez la base de données avant les modifications

### ❌ À éviter

- Ne pas exécuter le script trop fréquemment (risque de doublons)
- Ne pas modifier `next_date` manuellement
- Ne pas supprimer les templates avec historique
- Ne pas oublier de configurer le cron job en production

## Évolutions futures

Fonctionnalités prévues :
- [ ] Pause temporaire d'un abonnement
- [ ] Fin automatique après N factures
- [ ] Escalade de prix automatique
- [ ] Remises progressives
- [ ] Notifications avant génération
- [ ] Dashboard de suivi des abonnements

## Support

Pour toute question sur les factures récurrentes :
- Consultez les logs du script
- Testez avec l'endpoint `/process` manuel
- Vérifiez la configuration du cron job
