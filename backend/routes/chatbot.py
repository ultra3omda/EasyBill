"""
Module B - Chatbot Financial Interface (Routes)
Endpoints REST simulant un chatbot WhatsApp/Messenger.
Chaque requête retourne un payload structuré prêt pour le formatage messaging.
"""

from fastapi import APIRouter, Depends, Query, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from pydantic import BaseModel
import os
import logging

from utils.dependencies import get_current_user, get_current_company
from utils.helpers import generate_document_number, calculate_document_totals
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


class ChatCommand(BaseModel):
    command: str


class ChatResponse(BaseModel):
    intent: str
    confidence: float
    response_text: str
    entities: dict
    missing_fields: List[str]
    action_result: Optional[dict] = None
    suggested_actions: List[dict] = []
    hints: List[str] = []  # Suggestions pour guider l'utilisateur


# ─────────────────────────────────────────────
# Helpers — formatage réponse messaging
# ─────────────────────────────────────────────

def _format_currency(amount: float, currency: str = "TND") -> str:
    return f"{amount:,.3f} {currency}"


def _build_quick_replies(intent: ChatbotIntent, action_result: Optional[dict] = None) -> List[dict]:
    """Génère des boutons de réponse rapide selon l'intention et le résultat d'action."""
    # Documents créés directement → boutons de navigation
    if action_result:
        if action_result.get("action") == "create_invoice" and action_result.get("id"):
            return [{"id": "view_invoice", "title": "📄 Voir la facture", "path": f"/invoices/{action_result['id']}/edit"}]
        if action_result.get("action") == "create_quote" and action_result.get("id"):
            return [{"id": "view_quote", "title": "📄 Voir le devis", "path": f"/quotes/{action_result['id']}/edit"}]
        if action_result.get("action") == "register_payment" and action_result.get("id"):
            return [{"id": "view_payments", "title": "📄 Voir les paiements", "path": "/payments"}]
    base = {
        ChatbotIntent.LIST_UNPAID: [
            {"id": "send_reminders", "title": "📧 Envoyer rappels", "path": "/sales/reminders"},
            {"id": "export_list", "title": "📄 Exporter liste", "path": "/sales/invoices"},
        ],
        ChatbotIntent.DAILY_SUMMARY: [
            {"id": "export_pdf", "title": "📥 PDF rapport", "path": "/reports"},
        ],
    }
    return base.get(intent, [])


# ─────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────

async def _handle_chat_internal(text: str, company_id: str, current_user: dict, company: dict, sender_id: Optional[str] = None, channel: str = "api"):
    """Logique commune pour message et command."""
    parsed = chatbot_parser.parse(text)
    action_result = None
    if not parsed.missing_fields and parsed.intent != ChatbotIntent.UNKNOWN:
        action_result = await _dispatch_action(parsed, company_id, current_user, company)
    return parsed, action_result


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
    parsed, action_result = await _handle_chat_internal(
        message.text, company_id, current_user, company,
        sender_id=message.sender_id, channel=message.channel
    )

    hints = action_result.get("suggestions", []) if action_result else []
    response_text = parsed.response_text
    suggested_actions = _build_quick_replies(parsed.intent, action_result)

    # Sauvegarde de la conversation (20 derniers messages conservés par company)
    await db.chatbot_logs.insert_one({
        "company_id": ObjectId(company_id),
        "user_id": current_user["_id"],
        "sender_id": message.sender_id,
        "channel": message.channel,
        "text": message.text,
        "response_text": response_text,
        "intent": parsed.intent,
        "confidence": parsed.confidence,
        "entities": parsed.entities,
        "action_result": action_result,
        "suggested_actions": suggested_actions,
        "hints": hints,
        "created_at": datetime.now(timezone.utc)
    })
    await _prune_chatbot_logs(company_id, keep_last=20)
    return ChatResponse(
        intent=parsed.intent,
        confidence=parsed.confidence,
        response_text=parsed.response_text,
        entities=parsed.entities,
        missing_fields=parsed.missing_fields,
        action_result=action_result,
        suggested_actions=_build_quick_replies(parsed.intent, action_result),
        hints=hints,
    )


@router.post("/command", response_model=ChatResponse)
async def handle_chat_command(
    cmd: ChatCommand,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Endpoint alternatif pour les commandes courtes.
    Même comportement que POST /message.
    """
    company = await get_current_company(current_user, company_id)
    parsed, action_result = await _handle_chat_internal(
        cmd.command, company_id, current_user, company, channel="api"
    )
    hints = action_result.get("suggestions", []) if action_result else []
    response_text = parsed.response_text
    suggested_actions = _build_quick_replies(parsed.intent, action_result)
    await db.chatbot_logs.insert_one({
        "company_id": ObjectId(company_id),
        "user_id": current_user["_id"],
        "sender_id": None,
        "channel": "api",
        "text": cmd.command,
        "response_text": response_text,
        "intent": parsed.intent,
        "confidence": parsed.confidence,
        "entities": parsed.entities,
        "action_result": action_result,
        "suggested_actions": suggested_actions,
        "hints": hints,
        "created_at": datetime.now(timezone.utc)
    })
    await _prune_chatbot_logs(company_id, keep_last=20)
    return ChatResponse(
        intent=parsed.intent,
        confidence=parsed.confidence,
        response_text=parsed.response_text,
        entities=parsed.entities,
        missing_fields=parsed.missing_fields,
        action_result=action_result,
        suggested_actions=suggested_actions,
        hints=hints,
    )


async def _prune_chatbot_logs(company_id: str, keep_last: int = 20):
    """Garde seulement les keep_last derniers messages par entreprise."""
    cursor = db.chatbot_logs.find(
        {"company_id": ObjectId(company_id)}
    ).sort("created_at", -1).limit(keep_last)
    ids_to_keep = [doc["_id"] async for doc in cursor]
    if ids_to_keep:
        await db.chatbot_logs.delete_many({
            "company_id": ObjectId(company_id),
            "_id": {"$nin": ids_to_keep}
        })


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

    if intent == ChatbotIntent.CREATE_INVOICE:
        return await _action_create_invoice(company_id, entities, current_user, company)

    if intent == ChatbotIntent.CREATE_QUOTE:
        return await _action_create_quote(company_id, entities, current_user, company)

    return None


async def _action_create_invoice(company_id: str, entities: dict, current_user: dict, company: dict) -> dict:
    """Crée une facture en réutilisant la logique des routes invoices."""
    client_name = entities.get("client_name", "")
    customer = await _find_customer_by_name(company_id, client_name)
    if not customer:
        similar = await _find_similar_customer_names(company_id, client_name)
        msg = f"Client '{client_name}' non trouvé."
        if similar:
            msg += f" Clients similaires : {', '.join(similar)}."
        suggestions = [f"facture 250 dt pour {s} réparation moteur" for s in similar[:2]] if similar else ["facture 250 dt pour Mohamed Sahli réparation moteur"]
        return {"action": "create_invoice", "found": False, "message": msg, "suggestions": suggestions}
    amount = entities.get("amount", 0)
    description = entities.get("description", "Prestation de service")
    items = [{"description": description, "quantity": 1, "unit_price": amount, "tax_rate": 0, "discount": 0}]
    totals = calculate_document_totals(items)
    numbering = company.get("numbering", {})
    invoice_prefix = numbering.get("invoice_prefix", "FAC")
    invoice_next = numbering.get("invoice_next", 1)
    invoice_number = generate_document_number(invoice_prefix, invoice_next, datetime.now().year)
    now = datetime.now(timezone.utc)
    due_date = now + timedelta(days=30)
    invoice_dict = {
        "company_id": ObjectId(company_id),
        "customer_id": customer["_id"],
        "number": invoice_number,
        "date": now,
        "due_date": due_date,
        "subject": description,
        "items": items,
        **totals,
        "amount_paid": 0.0,
        "balance_due": totals["total"],
        "status": "draft",
        "created_at": now,
        "updated_at": now,
        "created_by": current_user["_id"]
    }
    result = await db.invoices.insert_one(invoice_dict)
    await db.companies.update_one({"_id": ObjectId(company_id)}, {"$inc": {"numbering.invoice_next": 1}})
    await db.customers.update_one(
        {"_id": customer["_id"]},
        {"$inc": {"invoice_count": 1, "total_invoiced": totals["total"], "balance": totals["total"]}}
    )
    await db.access_logs.insert_one({
        "company_id": ObjectId(company_id),
        "user_id": ObjectId(str(current_user["_id"])),
        "user_name": current_user.get("full_name", ""),
        "category": "Facture",
        "action": "Créer",
        "element": invoice_number,
        "ip_address": None,
        "created_at": now
    })
    return {
        "action": "create_invoice",
        "id": str(result.inserted_id),
        "number": invoice_number,
        "message": f"Facture {invoice_number} créée pour {customer.get('display_name') or customer.get('name')} — {amount:,.3f} TND."
    }


async def _action_create_quote(company_id: str, entities: dict, current_user: dict, company: dict) -> dict:
    """Crée un devis en réutilisant la logique des routes quotes."""
    client_name = entities.get("client_name", "")
    customer = await _find_customer_by_name(company_id, client_name)
    if not customer:
        similar = await _find_similar_customer_names(company_id, client_name)
        msg = f"Client '{client_name}' non trouvé."
        if similar:
            msg += f" Clients similaires : {', '.join(similar)}."
        suggestions = [f"devis 300 dt pour {s} prestation" for s in similar[:2]] if similar else ["devis 300 dt pour Ahmed Ben Ali installation clim"]
        return {"action": "create_quote", "found": False, "message": msg, "suggestions": suggestions}
    amount = entities.get("amount", 0)
    description = entities.get("description", "Prestation de service")
    items = [{"description": description, "quantity": 1, "unit_price": amount, "tax_rate": 0, "discount": 0}]
    totals = calculate_document_totals(items)
    numbering = company.get("numbering", {})
    quote_prefix = numbering.get("quote_prefix", "DEV")
    quote_next = numbering.get("quote_next", 1)
    quote_number = generate_document_number(quote_prefix, quote_next, datetime.now().year)
    now = datetime.now(timezone.utc)
    valid_until = now + timedelta(days=30)
    quote_dict = {
        "company_id": ObjectId(company_id),
        "customer_id": customer["_id"],
        "number": quote_number,
        "date": now,
        "valid_until": valid_until,
        "subject": description,
        "items": items,
        **totals,
        "status": "draft",
        "converted_to_invoice": False,
        "created_at": now,
        "updated_at": now,
        "created_by": current_user["_id"]
    }
    result = await db.quotes.insert_one(quote_dict)
    await db.companies.update_one({"_id": ObjectId(company_id)}, {"$inc": {"numbering.quote_next": 1}})
    await db.customers.update_one({"_id": customer["_id"]}, {"$inc": {"quote_count": 1}})
    await db.access_logs.insert_one({
        "company_id": ObjectId(company_id),
        "user_id": ObjectId(str(current_user["_id"])),
        "user_name": current_user.get("full_name", ""),
        "category": "Devis",
        "action": "Créer",
        "element": quote_number,
        "ip_address": None,
        "created_at": now
    })
    return {
        "action": "create_quote",
        "id": str(result.inserted_id),
        "number": quote_number,
        "message": f"Devis {quote_number} créé pour {customer.get('display_name') or customer.get('name')} — {amount:,.3f} TND."
    }


async def _action_register_payment_real(company_id: str, entities: dict, current_user: dict) -> dict:
    """Crée un paiement en réutilisant la logique des routes payments."""
    client_name = entities.get("client_name", "")
    customer = await _find_customer_by_name(company_id, client_name)
    if not customer:
        similar = await _find_similar_customer_names(company_id, client_name)
        msg = f"Client '{client_name}' non trouvé."
        if similar:
            msg += f" Clients similaires : {', '.join(similar)}."
        suggestions = [f"{s} a payé 200" for s in similar[:2]] if similar else ["Ahmed Ben Ali a payé 200"]
        return {"action": "register_payment", "found": False, "message": msg, "suggestions": suggestions}
    amount = entities.get("amount", 0)
    numbering = (await db.companies.find_one({"_id": ObjectId(company_id)})) or {}
    numbering = numbering.get("numbering", {})
    prefix = numbering.get("payment_prefix", "PAY")
    next_num = numbering.get("payment_next", 1)
    number = f"{prefix}-{datetime.now().year}-{next_num:05d}"
    now = datetime.now(timezone.utc)
    payment_dict = {
        "company_id": ObjectId(company_id),
        "customer_id": customer["_id"],
        "type": "received",
        "date": now,
        "amount": amount,
        "payment_method": "cash",
        "allocations": [],
        "number": number,
        "status": "completed",
        "created_at": now,
        "updated_at": now,
        "created_by": current_user["_id"]
    }
    result = await db.payments.insert_one(payment_dict)
    await db.companies.update_one({"_id": ObjectId(company_id)}, {"$inc": {"numbering.payment_next": 1}})
    await db.access_logs.insert_one({
        "company_id": ObjectId(company_id),
        "user_id": ObjectId(str(current_user["_id"])),
        "user_name": current_user.get("full_name", ""),
        "category": "Paiement",
        "action": "Créer",
        "element": number,
        "ip_address": None,
        "created_at": now
    })
    try:
        from services.accounting_sync_service import accounting_sync_service
        await accounting_sync_service.sync_payment(str(result.inserted_id))
    except Exception as e:
        logger.error(f"Erreur sync paiement {result.inserted_id}: {str(e)}")
    try:
        from routes.cash_accounts import auto_record_cash_movement
        cust_name = customer.get("display_name")
        await auto_record_cash_movement(
            company_id=company_id, amount=amount, movement_type="in",
            label=f"Encaissement client - {number}",
            payment_method="cash",
            customer_id=str(customer["_id"]), customer_name=cust_name,
            reference=number, movement_date=now
        )
    except Exception as e:
        logger.error(f"Erreur caisse paiement {result.inserted_id}: {str(e)}")
    return {
        "action": "register_payment",
        "id": str(result.inserted_id),
        "number": number,
        "message": f"Paiement {number} enregistré pour {customer.get('display_name') or customer.get('name')} — {amount:,.3f} TND."
    }


async def _find_similar_customer_names(company_id: str, search: str, limit: int = 5) -> List[str]:
    """Retourne des noms de clients similaires pour aider l'utilisateur."""
    if not search or len(search.strip()) < 2:
        return []
    pattern = re.escape(search.strip())
    cursor = db.customers.find(
        {"company_id": ObjectId(company_id)},
        {"display_name": 1, "name": 1, "company_name": 1}
    ).limit(50)
    found = []
    seen = set()
    for c in await cursor.to_list(length=50):
        for key in ("display_name", "name", "company_name"):
            val = c.get(key)
            if val and val.lower().find(search.lower()) >= 0 and val not in seen:
                seen.add(val)
                found.append(val)
                if len(found) >= limit:
                    return found
    return found[:limit]


async def _find_customer_by_name(company_id: str, name: str) -> Optional[dict]:
    if not name:
        return None
    pattern = re.escape(name)
    return await db.customers.find_one({
        "company_id": ObjectId(company_id),
        "$or": [
            {"display_name": {"$regex": pattern, "$options": "i"}},
            {"name": {"$regex": pattern, "$options": "i"}},
            {"company_name": {"$regex": pattern, "$options": "i"}},
        ]
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
            "number": inv.get("number") or inv.get("invoice_number"),
            "customer": (c.get("display_name") or c.get("name") or "?") if c else "?",
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
        similar = await _find_similar_customer_names(company_id, name)
        msg = f"Client '{name}' non trouvé."
        if similar:
            msg += f" Clients similaires : {', '.join(similar)}."
        return {
            "action": "consult_client",
            "found": False,
            "message": msg,
            "suggestions": [f"client {s}" for s in similar[:3]] if similar else ["Utilisez le nom complet (ex: client Mohamed Sahli)"],
        }

    total_invoiced_pipeline = [
        {"$match": {"company_id": ObjectId(company_id), "customer_id": customer["_id"]}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}, "balance": {"$sum": "$balance_due"}}}
    ]
    stats_list = await db.invoices.aggregate(total_invoiced_pipeline).to_list(1)
    stats = stats_list[0] if stats_list else {"total": 0, "balance": 0}

    cust_name = customer.get("display_name") or customer.get("name") or "?"
    return {
        "action": "consult_client",
        "found": True,
        "customer_id": str(customer["_id"]),
        "name": cust_name,
        "phone": customer.get("phone"),
        "email": customer.get("email"),
        "total_invoiced": stats.get("total", 0),
        "balance_due": stats.get("balance", 0),
        "message": (
            f"👤 {cust_name} | Tél: {customer.get('phone', '-')} | "
            f"Solde dû: {stats.get('balance', 0):,.3f} TND"
        )
    }


async def _action_send_reminder(company_id: str, client_name: str) -> dict:
    customer = await _find_customer_by_name(company_id, client_name)
    if not customer:
        similar = await _find_similar_customer_names(company_id, client_name)
        msg = f"Client '{client_name}' non trouvé."
        if similar:
            msg += f" Clients similaires : {', '.join(similar)}."
        return {
            "action": "send_reminder",
            "found": False,
            "message": msg,
            "suggestions": [f"rappeler {s}" for s in similar[:3]] if similar else ["Utilisez le nom complet (ex: rappeler Mohamed Sahli)"],
        }

    unpaid = await db.invoices.find({
        "company_id": ObjectId(company_id),
        "customer_id": customer["_id"],
        "balance_due": {"$gt": 0}
    }).to_list(50)

    if not unpaid:
        return {"action": "send_reminder", "message": f"{client_name} n'a pas de facture impayée."}

    total_due = sum(inv.get("balance_due", 0) for inv in unpaid)
    cust_name = customer.get("display_name") or customer.get("name") or client_name
    return {
        "action": "send_reminder",
        "customer_id": str(customer["_id"]),
        "customer_name": cust_name,
        "phone": customer.get("phone"),
        "invoice_count": len(unpaid),
        "total_due": total_due,
        "message": f"📧 Rappel prêt pour {cust_name} — {len(unpaid)} facture(s), {total_due:,.3f} TND"
    }


async def _action_register_payment(company_id: str, entities: dict, current_user: dict) -> dict:
    return await _action_register_payment_real(company_id, entities, current_user)


@router.get("/help")
async def get_chatbot_help(
    current_user: dict = Depends(get_current_user)
):
    """Retourne l'aide et la liste des commandes supportées."""
    return {
        "title": "Commandes du chatbot EasyBill",
        "description": "Vous pouvez envoyer des commandes en langage naturel (français/arabe translittéré).",
        "intents": [
            {"id": "create_invoice", "label": "Créer une facture", "examples": ["facture 250 dt pour Ali réparation moteur", "nouvelle facture Ahmed 500 dt installation clim"]},
            {"id": "create_quote", "label": "Créer un devis", "examples": ["devis 300 dt pour Sami peinture", "pro-forma Ahmed 1000 dt"]},
            {"id": "consult_client", "label": "Consulter un client", "examples": ["client Ahmed", "fiche client Sami", "infos Ali"]},
            {"id": "list_unpaid", "label": "Liste des impayés", "examples": ["factures impayées", "dettes clients", "créances en retard"]},
            {"id": "register_payment", "label": "Enregistrer un paiement", "examples": ["Ali a payé 200", "paiement 500 dt Ahmed", "Sami a réglé 300"]},
            {"id": "send_reminder", "label": "Envoyer un rappel", "examples": ["rappeler Ahmed", "relancer Sami", "envoyer rappel Ali"]},
            {"id": "daily_summary", "label": "Résumé du jour", "examples": ["rapport aujourd'hui", "bilan journée", "stats du jour"]},
        ]
    }


@router.get("/history")
async def get_chatbot_history(
    company_id: str = Query(...),
    limit: int = Query(20, le=100),
    current_user: dict = Depends(get_current_user)
):
    """Retourne les derniers messages de la conversation au format chat (user/bot)."""
    await get_current_company(current_user, company_id)
    logs = await db.chatbot_logs.find(
        {"company_id": ObjectId(company_id)}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    messages = []
    for log in reversed(logs):
        messages.append({
            "role": "user",
            "text": log.get("text", ""),
            "id": f"u-{log['_id']}"
        })
        bot_text = log.get("response_text") or (log.get("action_result", {}).get("message", "Commande traitée.") if log.get("action_result") else "Commande traitée.")
        messages.append({
            "role": "bot",
            "text": bot_text,
            "intent": log.get("intent"),
            "confidence": log.get("confidence"),
            "action_result": log.get("action_result"),
            "suggested_actions": log.get("suggested_actions", []),
            "hints": log.get("hints", []),
            "id": f"b-{log['_id']}"
        })
    return {"messages": messages}


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
