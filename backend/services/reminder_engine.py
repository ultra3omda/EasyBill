"""
Module D - Reminder Engine (service étendu)
Moteur de rappels automatiques avec règles, templates, logs et payloads multi-canal.
Étend ReminderService existant sans le modifier.
"""

from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
import logging

logger = logging.getLogger(__name__)


class ReminderEngine:
    """
    Moteur de rappels intelligent. Fonctionne en lecture/écriture sur les collections :
    - invoices (lecture)
    - customers (lecture)
    - reminder_rules (règles de déclenchement)
    - reminder_templates (templates de messages)
    - reminder_logs (historique détaillé)
    - reminders (collection existante — on y ajoute des entrées)
    """

    DEFAULT_RULES = [
        {
            "name": "Rappel anticipé (J-3)",
            "trigger": "before_due",
            "days_offset": -3,
            "level": 1,
            "is_active": True,
            "channels": ["email"],
        },
        {
            "name": "Rappel à l'échéance (J0)",
            "trigger": "on_due",
            "days_offset": 0,
            "level": 2,
            "is_active": True,
            "channels": ["email", "sms"],
        },
        {
            "name": "Rappel 7 jours après échéance",
            "trigger": "after_due",
            "days_offset": 7,
            "level": 3,
            "is_active": True,
            "channels": ["email", "sms", "whatsapp"],
        },
        {
            "name": "Relance formelle (J+30)",
            "trigger": "after_due",
            "days_offset": 30,
            "level": 4,
            "is_active": True,
            "channels": ["email", "whatsapp"],
        },
    ]

    DEFAULT_TEMPLATES = [
        {
            "name": "Rappel anticipé",
            "level": 1,
            "trigger": "before_due",
            "subject": "Rappel : facture {invoice_number} à échéance le {due_date}",
            "body_email": (
                "Bonjour {customer_name},\n\n"
                "Nous vous rappelons que la facture n°{invoice_number} "
                "d'un montant de {amount} {currency} arrive à échéance le {due_date}.\n\n"
                "Merci de procéder au règlement avant cette date.\n\n"
                "Cordialement,\n{company_name}"
            ),
            "body_sms": "Rappel : facture {invoice_number} ({amount} {currency}) échéance {due_date}. {company_name}",
            "body_whatsapp": (
                "⏰ *Rappel de paiement*\n"
                "Bonjour {customer_name}, votre facture *{invoice_number}* "
                "de *{amount} {currency}* est à régler avant le *{due_date}*.\n"
                "Merci ! 🙏"
            ),
            "is_active": True,
        },
        {
            "name": "Rappel à l'échéance",
            "level": 2,
            "trigger": "on_due",
            "subject": "Facture {invoice_number} — Paiement dû aujourd'hui",
            "body_email": (
                "Bonjour {customer_name},\n\n"
                "La facture n°{invoice_number} d'un montant de {amount} {currency} "
                "est due aujourd'hui.\n\n"
                "Merci de procéder au règlement dès que possible.\n\n"
                "Cordialement,\n{company_name}"
            ),
            "body_sms": "Facture {invoice_number} ({amount} {currency}) due aujourd'hui. Merci de régler. {company_name}",
            "body_whatsapp": (
                "📅 *Échéance aujourd'hui*\n"
                "Bonjour {customer_name}, votre facture *{invoice_number}* "
                "de *{amount} {currency}* est à payer aujourd'hui.\n"
                "Contact : {company_phone}"
            ),
            "is_active": True,
        },
        {
            "name": "Rappel en retard",
            "level": 3,
            "trigger": "after_due",
            "subject": "URGENT : Facture {invoice_number} en retard de {days_overdue} jours",
            "body_email": (
                "Bonjour {customer_name},\n\n"
                "Malgré nos précédents rappels, la facture n°{invoice_number} "
                "d'un montant de {amount} {currency} reste impayée depuis {days_overdue} jours.\n\n"
                "Nous vous demandons de régulariser votre situation dans les plus brefs délais.\n\n"
                "Cordialement,\n{company_name}"
            ),
            "body_sms": "RETARD {days_overdue}j : facture {invoice_number} ({amount} {currency}). Réglez immédiatement. {company_name}",
            "body_whatsapp": (
                "⚠️ *Facture en retard*\n"
                "Bonjour {customer_name}, la facture *{invoice_number}* "
                "de *{amount} {currency}* est en retard de *{days_overdue} jours*.\n"
                "Merci de régulariser rapidement. 📞 {company_phone}"
            ),
            "is_active": True,
        },
        {
            "name": "Relance formelle",
            "level": 4,
            "trigger": "after_due",
            "subject": "Mise en demeure — Facture {invoice_number}",
            "body_email": (
                "Bonjour {customer_name},\n\n"
                "Par la présente, nous vous mettons en demeure de régler la facture "
                "n°{invoice_number} d'un montant de {amount} {currency}, "
                "en retard de {days_overdue} jours.\n\n"
                "Sans règlement sous 48h, nous nous réservons le droit d'engager "
                "des procédures de recouvrement.\n\n"
                "Cordialement,\n{company_name}"
            ),
            "body_sms": "MISE EN DEMEURE : facture {invoice_number} ({amount} {currency}). Sans règlement sous 48h, recouvrement engagé.",
            "body_whatsapp": (
                "🚨 *Mise en demeure*\n"
                "Bonjour {customer_name}, la facture *{invoice_number}* "
                "({amount} {currency}) est en retard de *{days_overdue} jours*.\n"
                "Sans règlement sous 48h, une procédure de recouvrement sera engagée."
            ),
            "is_active": True,
        },
    ]

    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db

    # ──────────────────────────────────────────────
    # Initialisation
    # ──────────────────────────────────────────────

    async def initialize_defaults(self, company_id: str) -> Dict:
        """Initialise les règles et templates par défaut pour une entreprise."""
        oid = ObjectId(company_id)
        rules_created = 0
        templates_created = 0

        for rule in self.DEFAULT_RULES:
            existing = await self.db.reminder_rules.find_one({
                "company_id": oid, "name": rule["name"]
            })
            if not existing:
                await self.db.reminder_rules.insert_one({
                    **rule,
                    "company_id": oid,
                    "created_at": datetime.now(timezone.utc)
                })
                rules_created += 1

        for tpl in self.DEFAULT_TEMPLATES:
            existing = await self.db.reminder_templates_v2.find_one({
                "company_id": oid, "level": tpl["level"]
            })
            if not existing:
                await self.db.reminder_templates_v2.insert_one({
                    **tpl,
                    "company_id": oid,
                    "created_at": datetime.now(timezone.utc)
                })
                templates_created += 1

        return {
            "rules_created": rules_created,
            "templates_created": templates_created,
            "message": f"{rules_created} règles et {templates_created} templates créés."
        }

    # ──────────────────────────────────────────────
    # Détection des factures à relancer
    # ──────────────────────────────────────────────

    async def detect_invoices_to_remind(self, company_id: str) -> List[Dict]:
        """
        Retourne les factures nécessitant un rappel selon les règles actives.
        Classe chaque facture selon son statut : before_due, on_due, after_due.
        """
        oid = ObjectId(company_id)
        now = datetime.now(timezone.utc)
        today = now.replace(hour=0, minute=0, second=0, microsecond=0)

        # Factures impayées avec date d'échéance
        invoices = await self.db.invoices.find({
            "company_id": oid,
            "balance_due": {"$gt": 0},
            "status": {"$in": ["sent", "partial", "overdue"]},
            "due_date": {"$exists": True, "$ne": None}
        }).to_list(2000)

        rules = await self.db.reminder_rules.find({
            "company_id": oid, "is_active": True
        }).sort("level", 1).to_list(50)

        if not rules:
            # Utilise les règles par défaut si non initialisées
            rules = self.DEFAULT_RULES

        result = []
        for inv in invoices:
            due_date = inv.get("due_date")
            if not due_date:
                continue
            if isinstance(due_date, datetime):
                due_date = due_date.replace(tzinfo=timezone.utc)
            else:
                continue

            days_to_due = (due_date - today).days  # négatif si en retard

            for rule in rules:
                offset = rule.get("days_offset", 0)
                trigger = rule.get("trigger", "after_due")

                should_remind = False
                if trigger == "before_due" and days_to_due == abs(offset):
                    should_remind = True
                elif trigger == "on_due" and days_to_due == 0:
                    should_remind = True
                elif trigger == "after_due" and days_to_due == -offset:
                    should_remind = True

                if should_remind:
                    # Vérifie qu'on n'a pas déjà envoyé ce niveau de rappel
                    already_sent = await self.db.reminder_logs.find_one({
                        "company_id": oid,
                        "invoice_id": inv["_id"],
                        "level": rule.get("level", 1),
                    })
                    if not already_sent:
                        customer = await self.db.customers.find_one({"_id": inv.get("customer_id")})
                        result.append({
                            "invoice_id": str(inv["_id"]),
                            "invoice_number": inv.get("number"),
                            "due_date": due_date.isoformat(),
                            "days_overdue": max(0, -days_to_due),
                            "days_to_due": days_to_due,
                            "balance_due": inv.get("balance_due", 0),
                            "trigger": trigger,
                            "level": rule.get("level", 1),
                            "rule_name": rule.get("name"),
                            "channels": rule.get("channels", ["email"]),
                            "customer_id": str(inv["customer_id"]) if inv.get("customer_id") else None,
                            "customer_name": customer.get("display_name", "") if customer else "",
                            "customer_email": customer.get("email") if customer else None,
                            "customer_phone": customer.get("phone") if customer else None,
                        })
                    break  # une seule règle par facture

        return result

    # ──────────────────────────────────────────────
    # Génération de payloads par canal
    # ──────────────────────────────────────────────

    async def generate_reminder_payloads(
        self,
        company_id: str,
        invoice_id: str,
        level: int,
        company_name: str = "",
        company_phone: str = "",
        currency: str = "TND"
    ) -> Dict[str, Any]:
        """
        Génère les payloads email, SMS et WhatsApp pour un rappel donné.
        Prêt pour envoi via service externe (SendGrid, Twilio, WhatsApp API).
        """
        oid = ObjectId(company_id)
        inv = await self.db.invoices.find_one({"_id": ObjectId(invoice_id)})
        if not inv:
            return {"error": "Facture non trouvée"}

        customer = await self.db.customers.find_one({"_id": inv.get("customer_id")})
        template = await self.db.reminder_templates_v2.find_one({
            "company_id": oid, "level": level, "is_active": True
        })

        if not template:
            # Fallback sur les templates par défaut
            template = next((t for t in self.DEFAULT_TEMPLATES if t["level"] == level), None)

        if not template:
            return {"error": f"Aucun template pour le niveau {level}"}

        due_date = inv.get("due_date")
        due_date_str = due_date.strftime("%d/%m/%Y") if isinstance(due_date, datetime) else str(due_date or "")
        days_overdue = max(0, (datetime.now(timezone.utc) - due_date.replace(tzinfo=timezone.utc)).days) if isinstance(due_date, datetime) else 0

        vars_map = {
            "{invoice_number}": inv.get("number", ""),
            "{customer_name}": customer.get("display_name", "") if customer else "",
            "{amount}": f"{inv.get('balance_due', 0):,.3f}",
            "{currency}": currency,
            "{due_date}": due_date_str,
            "{days_overdue}": str(days_overdue),
            "{company_name}": company_name,
            "{company_phone}": company_phone,
        }

        def render(text: str) -> str:
            for k, v in vars_map.items():
                text = text.replace(k, v)
            return text

        payload = {
            "level": level,
            "invoice_id": invoice_id,
            "customer_email": customer.get("email") if customer else None,
            "customer_phone": customer.get("phone") if customer else None,
            "email": {
                "subject": render(template.get("subject", "")),
                "body": render(template.get("body_email", "")),
                "to": customer.get("email") if customer else None,
            },
            "sms": {
                "body": render(template.get("body_sms", "")),
                "to": customer.get("phone") if customer else None,
            },
            "whatsapp": {
                "body": render(template.get("body_whatsapp", "")),
                "to": customer.get("phone") if customer else None,
            },
        }
        return payload

    # ──────────────────────────────────────────────
    # Log d'un rappel envoyé
    # ──────────────────────────────────────────────

    async def log_reminder_sent(
        self,
        company_id: str,
        invoice_id: str,
        level: int,
        channel: str,
        status: str = "sent",
        error: Optional[str] = None
    ) -> str:
        doc = {
            "company_id": ObjectId(company_id),
            "invoice_id": ObjectId(invoice_id),
            "level": level,
            "channel": channel,
            "status": status,
            "error": error,
            "sent_at": datetime.now(timezone.utc),
        }
        result = await self.db.reminder_logs.insert_one(doc)
        return str(result.inserted_id)

    async def get_reminder_logs(
        self,
        company_id: str,
        invoice_id: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict]:
        query: dict = {"company_id": ObjectId(company_id)}
        if invoice_id:
            query["invoice_id"] = ObjectId(invoice_id)
        logs = await self.db.reminder_logs.find(query).sort("sent_at", -1).limit(limit).to_list(limit)
        result = []
        for log in logs:
            result.append({
                "id": str(log["_id"]),
                "invoice_id": str(log.get("invoice_id", "")),
                "level": log.get("level"),
                "channel": log.get("channel"),
                "status": log.get("status"),
                "error": log.get("error"),
                "sent_at": log["sent_at"].isoformat() if isinstance(log.get("sent_at"), datetime) else log.get("sent_at"),
            })
        return result

    # ──────────────────────────────────────────────
    # Traitement automatique (hook cron)
    # ──────────────────────────────────────────────

    async def process_all_companies(self) -> Dict:
        """
        Point d'entrée pour le traitement automatique (cron/scheduler).
        Parcourt toutes les entreprises actives et déclenche les rappels nécessaires.
        """
        companies = await self.db.companies.find({}).to_list(1000)
        total_reminders = 0
        errors = []

        for company in companies:
            company_id = str(company["_id"])
            try:
                to_remind = await self.detect_invoices_to_remind(company_id)
                for item in to_remind:
                    await self.log_reminder_sent(
                        company_id=company_id,
                        invoice_id=item["invoice_id"],
                        level=item["level"],
                        channel="scheduled",
                        status="pending"
                    )
                total_reminders += len(to_remind)
            except Exception as e:
                errors.append({"company_id": company_id, "error": str(e)})
                logger.error(f"Erreur traitement rappels company {company_id}: {e}")

        return {
            "companies_processed": len(companies),
            "reminders_queued": total_reminders,
            "errors": errors
        }
