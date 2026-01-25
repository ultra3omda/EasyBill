"""
Service de Rappels Automatisés
Gère les rappels et relances pour les factures impayées
"""

from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
from bson import ObjectId
import logging

logger = logging.getLogger(__name__)


class ReminderService:
    """Service pour gérer les rappels automatisés"""
    
    def __init__(self, db):
        self.db = db
    
    async def create_reminder_template(
        self,
        company_id: str,
        name: str,
        subject: str,
        body: str,
        days_after_due: int,
        reminder_level: int = 1,
        is_active: bool = True
    ) -> Dict[str, Any]:
        """
        Crée un template de rappel
        
        Args:
            company_id: ID de l'entreprise
            name: Nom du template
            subject: Sujet de l'email
            body: Corps de l'email (supporte les variables {client_name}, {invoice_number}, {amount}, {due_date}, etc.)
            days_after_due: Nombre de jours après l'échéance pour envoyer le rappel
            reminder_level: Niveau de rappel (1=premier rappel, 2=deuxième, 3=mise en demeure)
            is_active: Si le template est actif
            
        Returns:
            Dict avec les détails du template créé
        """
        
        template = {
            "company_id": ObjectId(company_id),
            "name": name,
            "subject": subject,
            "body": body,
            "days_after_due": days_after_due,
            "reminder_level": reminder_level,
            "is_active": is_active,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
        
        result = await self.db.reminder_templates.insert_one(template)
        
        return {
            "id": str(result.inserted_id),
            "name": name,
            "reminder_level": reminder_level,
            "days_after_due": days_after_due
        }
    
    async def get_default_templates(self) -> List[Dict[str, Any]]:
        """
        Retourne les templates de rappel par défaut
        """
        return [
            {
                "name": "Premier rappel",
                "subject": "Rappel de paiement - Facture {invoice_number}",
                "body": """Cher(e) {client_name},

Nous nous permettons de vous rappeler que la facture n° {invoice_number} d'un montant de {amount} {currency} est arrivée à échéance le {due_date}.

Nous vous serions reconnaissants de bien vouloir procéder au règlement de cette facture dans les meilleurs délais.

Si vous avez déjà effectué ce paiement, veuillez ne pas tenir compte de ce message.

Cordialement,
{company_name}""",
                "days_after_due": 7,
                "reminder_level": 1
            },
            {
                "name": "Deuxième rappel",
                "subject": "Deuxième rappel - Facture {invoice_number} en retard",
                "body": """Cher(e) {client_name},

Malgré notre précédent rappel, nous constatons que la facture n° {invoice_number} d'un montant de {amount} {currency}, échue le {due_date}, reste impayée.

Nous vous prions de bien vouloir régulariser cette situation dans un délai de 8 jours.

En cas de difficultés de paiement, nous vous invitons à nous contacter afin de trouver une solution amiable.

Cordialement,
{company_name}""",
                "days_after_due": 15,
                "reminder_level": 2
            },
            {
                "name": "Mise en demeure",
                "subject": "MISE EN DEMEURE - Facture {invoice_number}",
                "body": """Cher(e) {client_name},

Par la présente, nous vous mettons en demeure de régler la facture n° {invoice_number} d'un montant de {amount} {currency}, échue depuis le {due_date}.

À défaut de règlement sous 8 jours, nous nous verrons dans l'obligation de transmettre ce dossier à notre service contentieux et d'engager les procédures de recouvrement appropriées.

Les frais de recouvrement seront à votre charge conformément à la réglementation en vigueur.

Cordialement,
{company_name}""",
                "days_after_due": 30,
                "reminder_level": 3
            }
        ]
    
    async def initialize_default_templates(self, company_id: str) -> List[Dict[str, Any]]:
        """
        Initialise les templates par défaut pour une entreprise
        """
        templates = await self.get_default_templates()
        created = []
        
        for template in templates:
            result = await self.create_reminder_template(
                company_id=company_id,
                name=template["name"],
                subject=template["subject"],
                body=template["body"],
                days_after_due=template["days_after_due"],
                reminder_level=template["reminder_level"]
            )
            created.append(result)
        
        return created
    
    async def get_overdue_invoices(
        self,
        company_id: str,
        min_days_overdue: int = 0,
        max_days_overdue: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Récupère les factures en retard
        """
        now = datetime.now(timezone.utc)
        
        query = {
            "company_id": ObjectId(company_id),
            "status": {"$in": ["sent", "overdue"]},
            "due_date": {"$lt": now - timedelta(days=min_days_overdue)}
        }
        
        if max_days_overdue:
            query["due_date"]["$gte"] = now - timedelta(days=max_days_overdue)
        
        invoices = await self.db.invoices.find(query).to_list(None)
        
        result = []
        for inv in invoices:
            # Calculer le nombre de jours de retard
            due_date = inv.get("due_date")
            if isinstance(due_date, str):
                due_date = datetime.fromisoformat(due_date.replace('Z', '+00:00'))
            
            days_overdue = (now - due_date).days if due_date else 0
            
            # Récupérer le client
            customer = None
            if inv.get("customer_id"):
                customer = await self.db.customers.find_one({"_id": inv["customer_id"]})
            
            result.append({
                "id": str(inv["_id"]),
                "number": inv.get("number"),
                "customer_id": str(inv.get("customer_id")) if inv.get("customer_id") else None,
                "customer_name": customer.get("company_name") or f"{customer.get('first_name', '')} {customer.get('last_name', '')}".strip() if customer else None,
                "customer_email": customer.get("email") if customer else None,
                "total": inv.get("total", 0),
                "due_date": due_date.isoformat() if due_date else None,
                "days_overdue": days_overdue,
                "last_reminder_sent": inv.get("last_reminder_sent"),
                "reminder_count": inv.get("reminder_count", 0)
            })
        
        return result
    
    async def send_reminder(
        self,
        invoice_id: str,
        company_id: str,
        template_id: Optional[str] = None,
        custom_subject: Optional[str] = None,
        custom_body: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Envoie un rappel pour une facture
        """
        from services.email_service import EmailService
        
        # Récupérer la facture
        invoice = await self.db.invoices.find_one({
            "_id": ObjectId(invoice_id),
            "company_id": ObjectId(company_id)
        })
        
        if not invoice:
            raise ValueError("Facture non trouvée")
        
        # Récupérer le client
        customer = await self.db.customers.find_one({"_id": invoice.get("customer_id")})
        if not customer or not customer.get("email"):
            raise ValueError("Client sans adresse email")
        
        # Récupérer l'entreprise
        company = await self.db.companies.find_one({"_id": ObjectId(company_id)})
        
        # Récupérer le template si spécifié
        template = None
        if template_id:
            template = await self.db.reminder_templates.find_one({
                "_id": ObjectId(template_id),
                "company_id": ObjectId(company_id)
            })
        
        # Préparer les variables de remplacement
        due_date = invoice.get("due_date")
        if isinstance(due_date, str):
            due_date = datetime.fromisoformat(due_date.replace('Z', '+00:00'))
        
        variables = {
            "client_name": customer.get("company_name") or f"{customer.get('first_name', '')} {customer.get('last_name', '')}".strip(),
            "invoice_number": invoice.get("number"),
            "amount": f"{invoice.get('total', 0):,.3f}",
            "currency": invoice.get("currency", "TND"),
            "due_date": due_date.strftime("%d/%m/%Y") if due_date else "N/A",
            "company_name": company.get("name") if company else "EasyBill"
        }
        
        # Préparer le sujet et le corps
        if custom_subject and custom_body:
            subject = custom_subject
            body = custom_body
        elif template:
            subject = template.get("subject")
            body = template.get("body")
        else:
            # Template par défaut
            subject = f"Rappel de paiement - Facture {variables['invoice_number']}"
            body = f"""Cher(e) {variables['client_name']},

Nous vous rappelons que la facture n° {variables['invoice_number']} d'un montant de {variables['amount']} {variables['currency']} est en attente de paiement.

Merci de procéder au règlement dans les meilleurs délais.

Cordialement,
{variables['company_name']}"""
        
        # Remplacer les variables
        for key, value in variables.items():
            subject = subject.replace(f"{{{key}}}", str(value))
            body = body.replace(f"{{{key}}}", str(value))
        
        # Envoyer l'email
        email_service = EmailService()
        email_sent = await email_service.send_email(
            to_email=customer.get("email"),
            subject=subject,
            html_content=f"<pre style='font-family: Arial, sans-serif; white-space: pre-wrap;'>{body}</pre>",
            text_content=body
        )
        
        # Enregistrer le rappel
        reminder_record = {
            "invoice_id": ObjectId(invoice_id),
            "company_id": ObjectId(company_id),
            "customer_id": invoice.get("customer_id"),
            "template_id": ObjectId(template_id) if template_id else None,
            "subject": subject,
            "body": body,
            "sent_to": customer.get("email"),
            "sent_at": datetime.now(timezone.utc),
            "email_sent": email_sent
        }
        
        await self.db.reminders.insert_one(reminder_record)
        
        # Mettre à jour la facture
        await self.db.invoices.update_one(
            {"_id": ObjectId(invoice_id)},
            {
                "$set": {"last_reminder_sent": datetime.now(timezone.utc)},
                "$inc": {"reminder_count": 1}
            }
        )
        
        return {
            "success": True,
            "email_sent": email_sent,
            "sent_to": customer.get("email"),
            "subject": subject
        }
    
    async def get_reminder_history(
        self,
        company_id: str,
        invoice_id: Optional[str] = None,
        customer_id: Optional[str] = None,
        skip: int = 0,
        limit: int = 50
    ) -> Dict[str, Any]:
        """
        Récupère l'historique des rappels
        """
        query = {"company_id": ObjectId(company_id)}
        
        if invoice_id:
            query["invoice_id"] = ObjectId(invoice_id)
        if customer_id:
            query["customer_id"] = ObjectId(customer_id)
        
        reminders = await self.db.reminders.find(query).sort("sent_at", -1).skip(skip).limit(limit).to_list(limit)
        total = await self.db.reminders.count_documents(query)
        
        items = []
        for rem in reminders:
            items.append({
                "id": str(rem["_id"]),
                "invoice_id": str(rem.get("invoice_id")),
                "subject": rem.get("subject"),
                "sent_to": rem.get("sent_to"),
                "sent_at": rem.get("sent_at").isoformat() if rem.get("sent_at") else None,
                "email_sent": rem.get("email_sent", False)
            })
        
        return {
            "items": items,
            "total": total,
            "skip": skip,
            "limit": limit
        }
    
    async def process_automatic_reminders(self, company_id: str) -> Dict[str, Any]:
        """
        Traite les rappels automatiques pour une entreprise
        """
        # Récupérer les templates actifs
        templates = await self.db.reminder_templates.find({
            "company_id": ObjectId(company_id),
            "is_active": True
        }).sort("days_after_due", 1).to_list(None)
        
        if not templates:
            return {"processed": 0, "sent": 0, "message": "Aucun template de rappel actif"}
        
        now = datetime.now(timezone.utc)
        processed = 0
        sent = 0
        errors = []
        
        for template in templates:
            days_after_due = template.get("days_after_due", 7)
            reminder_level = template.get("reminder_level", 1)
            
            # Trouver les factures éligibles pour ce niveau de rappel
            query = {
                "company_id": ObjectId(company_id),
                "status": {"$in": ["sent", "overdue"]},
                "due_date": {"$lt": now - timedelta(days=days_after_due)},
                "reminder_count": {"$lt": reminder_level}
            }
            
            invoices = await self.db.invoices.find(query).to_list(None)
            
            for invoice in invoices:
                processed += 1
                
                # Vérifier si un rappel a déjà été envoyé récemment (moins de 3 jours)
                last_reminder = invoice.get("last_reminder_sent")
                if last_reminder:
                    if isinstance(last_reminder, str):
                        last_reminder = datetime.fromisoformat(last_reminder.replace('Z', '+00:00'))
                    if (now - last_reminder).days < 3:
                        continue
                
                try:
                    result = await self.send_reminder(
                        invoice_id=str(invoice["_id"]),
                        company_id=company_id,
                        template_id=str(template["_id"])
                    )
                    if result.get("email_sent"):
                        sent += 1
                except Exception as e:
                    errors.append({
                        "invoice_id": str(invoice["_id"]),
                        "error": str(e)
                    })
        
        return {
            "processed": processed,
            "sent": sent,
            "errors": errors
        }
