"""
Module B - Chatbot Financial Interface (Routes)
Endpoints REST simulant un chatbot WhatsApp/Messenger.
Chaque requête retourne un payload structuré prêt pour le formatage messaging.
"""

from fastapi import APIRouter, Depends, Query, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime, timezone
from typing import Optional, List
from pydantic import BaseModel
import os
import logging

from utils.dependencies import get_current_user, get_current_company
from services.chatbot_service import chatbot_parser, ChatbotIntent

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chatbot", tags=["Chatbot"])

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'easybill')]


# ─────────────────────────────────────────────
# Schemas
# ─────────────────────────────────────────────

class ChatMessage(BaseModel):
    text: str
    sender_id: Optional[str] = None      # ID WhatsApp ou Messenger de l'expéditeur
    channel: str = "api"                  # api, whatsapp, messenger


class ChatResponse(BaseModel):
    intent: str
    confidence: float
    response_text: str
    entities: dict
    missing_fields: List[str]
    action_result: Optional[dict] = None
    suggested_actions: List[dict] = []


# ─────────────────────────────────────────────
# Helpers — formatage réponse messaging
# ─────────────────────────────────────────────

def _format_currency(amount: float, currency: str = "TND") -> str:
    return f"{amount:,.3f} {currency}"


def _build_quick_replies(intent: ChatbotIntent) -> List[dict]:
    """Génère des boutons de réponse rapide selon l'intention."""
    base = {
        ChatbotIntent.CREATE_INVOICE: [
            {"id": "confirm_invoice", "title": "✅ Confirmer"},
            {"id": "cancel", "title": "❌ Annuler"},
        ],
        ChatbotIntent.CREATE_QUOTE: [
            {"id": "confirm_quote", "title": "✅ Confirmer"},
            {"id": "cancel", "title": "❌ Annuler"},
        ],
        ChatbotIntent.LIST_UNPAID: [
            {"id": "send_reminders", "title": "📧 Envoyer rappels"},
            {"id": "export_list", "title": "📄 Exporter liste"},
        ],
        ChatbotIntent.DAILY_SUMMARY: [
            {"id": "export_pdf", "title": "📥 PDF rapport"},
        ],
    }
    return base.get(intent, [])


# ─────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────

@router.post("/message", response_model=ChatResponse)
async def handle_chat_message(
    message: ChatMessage,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Point d'entrée principal du chatbot.
    Reçoit un message texte, le parse, et dispatche l'action si possible.
    """
    company = await get_current_company(current_user, company_id)
    parsed = chatbot_parser.parse(message.text)

    action_result = None
    if not parsed.missing_fields and parsed.intent != ChatbotIntent.UNKNOWN:
        action_result = await _dispatch_action(parsed, company_id, current_user, company)

    # Sauvegarde de la conversation
    await db.chatbot_logs.insert_one({
        "company_id": ObjectId(company_id),
        "user_id": current_user["_id"],
        "sender_id": message.sender_id,
        "channel": message.channel,
        "text": message.text,
        "intent": parsed.intent,
        "confidence": parsed.confidence,
        "entities": parsed.entities,
        "action_result": action_result,
        "created_at": datetime.now(timezone.utc)
    })

    return ChatResponse(
        intent=parsed.intent,
        confidence=parsed.confidence,
        response_text=parsed.response_text,
        entities=parsed.entities,
        missing_fields=parsed.missing_fields,
        action_result=action_result,
        suggested_actions=_build_quick_replies(parsed.intent)
    )


async def _dispatch_action(parsed, company_id: str, current_user: dict, company: dict) -> Optional[dict]:
    """Exécute l'action correspondant à l'intention parsée."""
    intent = parsed.intent
    entities = parsed.entities

    if intent == ChatbotIntent.LIST_UNPAID:
        return await _action_list_unpaid(company_id)

    if intent == ChatbotIntent.DAILY_SUMMARY:
        return await _action_daily_summary(company_id)

    if intent == ChatbotIntent.CONSULT_CLIENT:
        return await _action_consult_client(company_id, entities.get("client_name", ""))

    if intent == ChatbotIntent.SEND_REMINDER:
        return await _action_send_reminder(company_id, entities.get("client_name", ""))

    if intent == ChatbotIntent.REGISTER_PAYMENT:
        return await _action_register_payment(company_id, entities, current_user)

    if intent in (ChatbotIntent.CREATE_INVOICE, ChatbotIntent.CREATE_QUOTE):
        # Retourne les données pré-remplies pour confirmation UI
        doc_type = "invoice" if intent == ChatbotIntent.CREATE_INVOICE else "quote"
        customer = await _find_customer_by_name(company_id, entities.get("client_name", ""))
        return {
            "action": f"prefill_{doc_type}",
            "prefill": {
                "customer_id": str(customer["_id"]) if customer else None,
                "customer_name": customer.get("display_name") if customer else entities.get("client_name"),
                "amount": entities.get("amount"),
                "description": entities.get("description", ""),
            },
            "message": f"Données pré-remplies pour nouveau {doc_type}. Confirmez dans l'interface."
        }

    return None


async def _find_customer_by_name(company_id: str, name: str) -> Optional[dict]:
    if not name:
        return None
    return await db.customers.find_one({
        "company_id": ObjectId(company_id),
        "display_name": {"$regex": re.escape(name), "$options": "i"}
    })


async def _action_list_unpaid(company_id: str) -> dict:
    invoices = await db.invoices.find({
        "company_id": ObjectId(company_id),
        "balance_due": {"$gt": 0},
        "status": {"$in": ["sent", "partial", "overdue"]}
    }).sort("due_date", 1).limit(20).to_list(20)

    total_due = sum(inv.get("balance_due", 0) for inv in invoices)
    items = []
    for inv in invoices:
        c = await db.customers.find_one({"_id": inv.get("customer_id")})
        items.append({
            "number": inv.get("number"),
            "customer": c.get("display_name", "?") if c else "?",
            "balance_due": inv.get("balance_due", 0),
            "status": inv.get("status")
        })
    return {
        "action": "list_unpaid",
        "total_due": total_due,
        "count": len(invoices),
        "items": items,
        "message": f"{len(invoices)} facture(s) impayée(s) — Total : {total_due:,.3f} TND"
    }


async def _action_daily_summary(company_id: str) -> dict:
    from datetime import timedelta
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)

    invoices_today = await db.invoices.count_documents({
        "company_id": ObjectId(company_id),
        "created_at": {"$gte": today_start, "$lt": today_end}
    })
    payments_today = await db.payments.find({
        "company_id": ObjectId(company_id),
        "created_at": {"$gte": today_start, "$lt": today_end},
        "type": "received"
    }).to_list(1000)
    total_collected = sum(p.get("amount", 0) for p in payments_today)

    unpaid_count = await db.invoices.count_documents({
        "company_id": ObjectId(company_id),
        "balance_due": {"$gt": 0}
    })

    return {
        "action": "daily_summary",
        "date": today_start.date().isoformat(),
        "invoices_created_today": invoices_today,
        "payments_count": len(payments_today),
        "total_collected_today": total_collected,
        "unpaid_invoices_total": unpaid_count,
        "message": (
            f"📊 Aujourd'hui : {invoices_today} facture(s) créée(s), "
            f"{len(payments_today)} paiement(s) encaissé(s) = {total_collected:,.3f} TND. "
            f"{unpaid_count} facture(s) en attente."
        )
    }


async def _action_consult_client(company_id: str, name: str) -> dict:
    customer = await _find_customer_by_name(company_id, name)
    if not customer:
        return {"action": "consult_client", "found": False, "message": f"Client '{name}' non trouvé."}

    total_invoiced_pipeline = [
        {"$match": {"company_id": ObjectId(company_id), "customer_id": customer["_id"]}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}, "balance": {"$sum": "$balance_due"}}}
    ]
    stats_list = await db.invoices.aggregate(total_invoiced_pipeline).to_list(1)
    stats = stats_list[0] if stats_list else {"total": 0, "balance": 0}

    return {
        "action": "consult_client",
        "found": True,
        "customer_id": str(customer["_id"]),
        "name": customer.get("display_name"),
        "phone": customer.get("phone"),
        "email": customer.get("email"),
        "total_invoiced": stats.get("total", 0),
        "balance_due": stats.get("balance", 0),
        "message": (
            f"👤 {customer.get('display_name')} | Tél: {customer.get('phone', '-')} | "
            f"Solde dû: {stats.get('balance', 0):,.3f} TND"
        )
    }


async def _action_send_reminder(company_id: str, client_name: str) -> dict:
    customer = await _find_customer_by_name(company_id, client_name)
    if not customer:
        return {"action": "send_reminder", "found": False, "message": f"Client '{client_name}' non trouvé."}

    unpaid = await db.invoices.find({
        "company_id": ObjectId(company_id),
        "customer_id": customer["_id"],
        "balance_due": {"$gt": 0}
    }).to_list(50)

    if not unpaid:
        return {"action": "send_reminder", "message": f"{client_name} n'a pas de facture impayée."}

    total_due = sum(inv.get("balance_due", 0) for inv in unpaid)
    return {
        "action": "send_reminder",
        "customer_id": str(customer["_id"]),
        "customer_name": customer.get("display_name"),
        "phone": customer.get("phone"),
        "invoice_count": len(unpaid),
        "total_due": total_due,
        "message": f"📧 Rappel prêt pour {customer.get('display_name')} — {len(unpaid)} facture(s), {total_due:,.3f} TND"
    }


async def _action_register_payment(company_id: str, entities: dict, current_user: dict) -> dict:
    client_name = entities.get("client_name", "")
    amount = entities.get("amount", 0)
    customer = await _find_customer_by_name(company_id, client_name)
    if not customer:
        return {"action": "register_payment", "found": False, "message": f"Client '{client_name}' non trouvé."}

    return {
        "action": "prefill_payment",
        "prefill": {
            "customer_id": str(customer["_id"]),
            "customer_name": customer.get("display_name"),
            "amount": amount,
            "payment_method": "cash",
        },
        "message": f"Paiement de {amount:,.3f} TND pour {customer.get('display_name')} prêt à confirmer."
    }


@router.get("/logs")
async def get_chatbot_logs(
    company_id: str = Query(...),
    limit: int = Query(50, le=200),
    current_user: dict = Depends(get_current_user)
):
    """Historique des conversations chatbot."""
    await get_current_company(current_user, company_id)
    logs = await db.chatbot_logs.find(
        {"company_id": ObjectId(company_id)}
    ).sort("created_at", -1).limit(limit).to_list(limit)

    for log in logs:
        log["id"] = str(log["_id"])
        del log["_id"]
        if isinstance(log.get("user_id"), ObjectId):
            log["user_id"] = str(log["user_id"])
        if isinstance(log.get("company_id"), ObjectId):
            log["company_id"] = str(log["company_id"])
        if isinstance(log.get("created_at"), datetime):
            log["created_at"] = log["created_at"].isoformat()
    return logs


@router.get("/intents")
async def list_supported_intents():
    """Retourne la liste des commandes supportées avec des exemples."""
    return {
        "intents": [
            {"id": "create_invoice", "examples": ["facture 250 dt pour Ali réparation moteur", "nouvelle facture Ahmed 500 dt installation clim"]},
            {"id": "create_quote", "examples": ["devis 300 dt pour Sami peinture", "pro-forma Ahmed 1000 dt"]},
            {"id": "consult_client", "examples": ["client Ahmed", "fiche client Sami", "infos Ali"]},
            {"id": "list_unpaid", "examples": ["factures impayées", "dettes clients", "créances en retard"]},
            {"id": "register_payment", "examples": ["Ali a payé 200", "paiement 500 dt Ahmed", "Sami a réglé 300"]},
            {"id": "send_reminder", "examples": ["rappeler Ahmed", "relancer Sami", "envoyer rappel Ali"]},
            {"id": "daily_summary", "examples": ["rapport aujourd'hui", "bilan journée", "stats du jour"]},
        ]
    }


# Import manquant (re) ajouté
import re
