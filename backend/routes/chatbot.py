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
from services.chatbot_service import ParsedCommand

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
    selected_client_id: Optional[str] = None  # Confirmation du client (quand plusieurs correspondances)
    confirm_action: Optional[bool] = None  # Confirmation d'exécution de l'action en attente
    cancel_action: Optional[bool] = None  # Annulation de l'action en attente


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
    if action_result and action_result.get("action") in ("confirm_client", "confirm_execution"):
        return []
    # Documents créés directement → boutons de navigation
    if action_result:
        if action_result.get("action") == "create_invoice" and action_result.get("id"):
            return [{"id": "view_invoice", "title": "📄 Voir la facture", "path": f"/invoices/{action_result['id']}/edit"}]
        if action_result.get("action") == "create_quote" and action_result.get("id"):
            return [{"id": "view_quote", "title": "📄 Voir le devis", "path": f"/quotes/{action_result['id']}/edit"}]
        if action_result.get("action") == "register_payment" and action_result.get("id"):
            return [{"id": "view_payments", "title": "📄 Voir les paiements", "path": "/payments"}]
        if action_result.get("action") == "create_client" and action_result.get("id"):
            return [{"id": "view_customers", "title": "👤 Voir les clients", "path": "/customers"}]
        if action_result.get("action") == "create_supplier" and action_result.get("id"):
            return [{"id": "view_suppliers", "title": "🏭 Voir les fournisseurs", "path": "/suppliers"}]
        if action_result.get("action") == "register_purchase" and action_result.get("id"):
            return [{"id": "view_purchase_orders", "title": "📋 Voir les bons de commande", "path": "/purchase-orders"}]
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

async def _handle_chat_internal(text: str, company_id: str, current_user: dict, company: dict, sender_id: Optional[str] = None, channel: str = "api", selected_client_id: Optional[str] = None, confirm_action: bool = False, cancel_action: bool = False):
    """Logique commune pour message et command."""
    user_id = current_user.get("_id")

    # 1. Annulation : l'utilisateur annule l'action en attente
    if cancel_action:
        await _clear_pending_confirmation(company_id, user_id)
        parsed = type('Parsed', (), {'intent': ChatbotIntent.UNKNOWN, 'confidence': 1.0, 'response_text': "Action annulée.", 'entities': {}, 'missing_fields': []})()
        return parsed, {"action": "cancelled", "message": "Action annulée."}

    # 2. Confirmation d'exécution : l'utilisateur a confirmé l'action en attente
    if confirm_action:
        pending = await _get_pending_execution(company_id, user_id)
        if pending:
            await _clear_pending_confirmation(company_id, user_id)
            action_result = await _execute_pending_action(pending, company_id, current_user, company)
            parsed = type('Parsed', (), {
                'intent': pending["intent"], 'confidence': 1.0, 'response_text': action_result.get("message", ""),
                'entities': pending.get("entities", {}), 'missing_fields': []
            })()
            return parsed, action_result
        return chatbot_parser.parse(text), None

    # 3. Confirmation client : si l'utilisateur a sélectionné un client (plusieurs correspondances)
    if selected_client_id:
        pending = await _get_pending_confirmation(company_id, user_id)
        if pending:
            suggestions = pending.get("client_suggestions", [])
            customer = None
            for c in suggestions:
                if str(c.get("id")) == str(selected_client_id):
                    customer = await db.customers.find_one({"_id": ObjectId(selected_client_id), "company_id": ObjectId(company_id)})
                    break
            if customer:
                await _clear_pending_confirmation(company_id, user_id)
                intent = pending["intent"]
                entities = pending["entities"]
                # Action d'affichage (ex: consult_client) : exécution immédiate sans confirmation
                if intent not in _CONFIRM_REQUIRED_INTENTS:
                    action_result = await _execute_action_with_customer(intent, entities, company_id, current_user, company, customer)
                    parsed = type('Parsed', (), {
                        'intent': intent, 'confidence': 1.0, 'response_text': action_result.get("message", ""),
                        'entities': entities, 'missing_fields': []
                    })()
                    return parsed, action_result
                # Action d'ajout/modif/suppression : demander confirmation
                action_summary = _build_action_summary(intent, entities, customer)
                await _save_pending_execution(company_id, user_id, intent, entities, customer, action_summary)
                msg = "Voici ce que je vais faire :\n• " + "\n• ".join(action_summary) + "\n\nConfirmez-vous l'exécution ?"
                parsed = type('Parsed', (), {
                    'intent': intent, 'confidence': 1.0, 'response_text': msg,
                    'entities': entities, 'missing_fields': []
                })()
                return parsed, {"action": "confirm_execution", "action_summary": action_summary, "message": msg}
        await _clear_pending_confirmation(company_id, user_id)

    # 4. Nouveau message : parser (IA si dispo, sinon regex) et préparer l'action
    parsed = await _parse_message(text)
    action_result = None
    if not parsed.missing_fields and parsed.intent != ChatbotIntent.UNKNOWN:
        action_result = await _prepare_action_for_confirmation(parsed, company_id, current_user, company)
    return parsed, action_result


async def _parse_message(text: str) -> ParsedCommand:
    """Parse le message : IA (Gemini/OpenAI) si clé dispo, sinon regex."""
    try:
        from services.chatbot_ai_service import parse_message_with_ai, AIParseResult
        ai_result = await parse_message_with_ai(text)
        if ai_result and ai_result.intent != "unknown":
            intent_str = ai_result.intent
            intent_map = {
                "create_client": ChatbotIntent.CREATE_CLIENT,
                "create_supplier": ChatbotIntent.CREATE_SUPPLIER,
                "register_purchase": ChatbotIntent.REGISTER_PURCHASE,
                "register_sale": ChatbotIntent.REGISTER_SALE,
                "create_invoice": ChatbotIntent.CREATE_INVOICE,
                "create_quote": ChatbotIntent.CREATE_QUOTE,
                "register_payment": ChatbotIntent.REGISTER_PAYMENT,
                "consult_client": ChatbotIntent.CONSULT_CLIENT,
                "send_reminder": ChatbotIntent.SEND_REMINDER,
                "list_unpaid": ChatbotIntent.LIST_UNPAID,
                "daily_summary": ChatbotIntent.DAILY_SUMMARY,
            }
            intent = intent_map.get(intent_str, ChatbotIntent.UNKNOWN)
            if intent != ChatbotIntent.UNKNOWN:
                entities = ai_result.entities or {}
                missing = []
                if intent == ChatbotIntent.CREATE_CLIENT and not entities.get("first_name"):
                    missing.append("first_name")
                elif intent == ChatbotIntent.CREATE_SUPPLIER and not entities.get("first_name"):
                    missing.append("first_name")
                elif intent in (ChatbotIntent.CREATE_INVOICE, ChatbotIntent.CREATE_QUOTE):
                    if not entities.get("amount"):
                        missing.append("amount")
                    if not entities.get("client_name"):
                        missing.append("client_name")
                elif intent == ChatbotIntent.REGISTER_PAYMENT:
                    if not entities.get("amount"):
                        missing.append("amount")
                    if not entities.get("client_name"):
                        missing.append("client_name")
                elif intent in (ChatbotIntent.CONSULT_CLIENT, ChatbotIntent.SEND_REMINDER):
                    cn = entities.get("client_name") or entities.get("client") or entities.get("customer") or entities.get("customer_name")
                    if cn:
                        entities["client_name"] = cn
                    if not entities.get("client_name"):
                        # Fallback: extraire le nom depuis le message brut (ex: "client Ahmed")
                        extracted = chatbot_parser._extract_client_name(text, intent=intent)
                        if extracted:
                            entities["client_name"] = extracted
                        else:
                            missing.append("client_name")
                elif intent == ChatbotIntent.REGISTER_PURCHASE:
                    if not entities.get("quantity"):
                        missing.append("quantity")
                    if not entities.get("product_ref"):
                        missing.append("product_ref")
                elif intent == ChatbotIntent.REGISTER_SALE:
                    if not entities.get("quantity"):
                        missing.append("quantity")
                    if not entities.get("product_ref"):
                        missing.append("product_ref")
                response_text = ai_result.action_summary or ""
                return ParsedCommand(
                    intent=intent,
                    raw_text=text,
                    confidence=ai_result.confidence,
                    entities=entities,
                    missing_fields=missing,
                    response_text=response_text,
                    hints=ai_result.suggestions or [],
                )
    except Exception as e:
        logger.warning("Chatbot AI parse failed, fallback to regex: %s", e)
    return chatbot_parser.parse(text)


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
        sender_id=message.sender_id, channel=message.channel,
        selected_client_id=message.selected_client_id,
        confirm_action=message.confirm_action or False,
        cancel_action=message.cancel_action or False
    )

    hints = (action_result or {}).get("suggestions", []) or getattr(parsed, "hints", [])
    response_text = (action_result.get("message") or parsed.response_text) if action_result else parsed.response_text
    suggested_actions = _build_quick_replies(parsed.intent, action_result)

    # Sauvegarde de la conversation (100 derniers messages conservés par company)
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
    await _prune_chatbot_logs(company_id, keep_last=50)
    return ChatResponse(
        intent=parsed.intent,
        confidence=parsed.confidence,
        response_text=response_text,
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
    hints = (action_result or {}).get("suggestions", []) or getattr(parsed, "hints", [])
    response_text = (action_result.get("message") or parsed.response_text) if action_result else parsed.response_text
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
    await _prune_chatbot_logs(company_id, keep_last=50)
    return ChatResponse(
        intent=parsed.intent,
        confidence=parsed.confidence,
        response_text=response_text,
        entities=parsed.entities,
        missing_fields=parsed.missing_fields,
        action_result=action_result,
        suggested_actions=suggested_actions,
        hints=hints,
    )


async def _prune_chatbot_logs(company_id: str, keep_last: int = 50):
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


async def _execute_action_with_customer(intent: str, entities: dict, company_id: str, current_user: dict, company: dict, customer: dict) -> dict:
    """Exécute l'action avec un client déjà sélectionné (après confirmation)."""
    if intent == ChatbotIntent.CONSULT_CLIENT:
        return await _action_consult_client(company_id, "", customer=customer)
    if intent == ChatbotIntent.SEND_REMINDER:
        return await _action_send_reminder(company_id, "", customer=customer)
    if intent == ChatbotIntent.REGISTER_PAYMENT:
        return await _action_register_payment_with_customer(company_id, entities, current_user, customer)
    if intent in (ChatbotIntent.CREATE_INVOICE, ChatbotIntent.REGISTER_SALE):
        return await _action_create_invoice_with_customer(company_id, entities, current_user, company, customer)
    if intent == ChatbotIntent.CREATE_QUOTE:
        return await _action_create_quote_with_customer(company_id, entities, current_user, company, customer)
    return {"action": intent, "message": "Action non supportée.", "found": False}


async def _execute_pending_action(pending: dict, company_id: str, current_user: dict, company: dict) -> dict:
    """Exécute l'action en attente (après confirmation utilisateur)."""
    intent = pending["intent"]
    entities = pending.get("entities", {})
    customer = pending.get("customer")

    if customer:
        return await _execute_action_with_customer(intent, entities, company_id, current_user, company, customer)
    if intent == ChatbotIntent.CREATE_CLIENT:
        return await _action_create_client(company_id, entities, current_user)
    if intent == ChatbotIntent.CREATE_SUPPLIER:
        return await _action_create_supplier(company_id, entities, current_user)
    if intent == ChatbotIntent.REGISTER_PURCHASE:
        supplier = pending.get("supplier")
        create_supplier_first = pending.get("create_supplier_first")
        if create_supplier_first:
            supplier_entities = {"first_name": create_supplier_first.strip(), "display_name": create_supplier_first.strip()}
            create_result = await _action_create_supplier(company_id, supplier_entities, current_user)
            if create_result.get("found") is False or not create_result.get("id"):
                return create_result
            new_supplier = await db.suppliers.find_one({"_id": ObjectId(create_result["id"]), "company_id": ObjectId(company_id)})
            if new_supplier:
                purchase_result = await _action_register_purchase(company_id, entities, current_user, company, new_supplier)
                purchase_result["message"] = f"{create_result.get('message', '')} {purchase_result.get('message', '')}"
                return purchase_result
            return create_result
        return await _action_register_purchase(company_id, entities, current_user, company, supplier)
    if intent == ChatbotIntent.REGISTER_SALE:
        create_client_first = pending.get("create_client_first")
        if create_client_first:
            client_entities = {"first_name": create_client_first.strip(), "display_name": create_client_first.strip()}
            create_result = await _action_create_client(company_id, client_entities, current_user)
            if create_result.get("found") is False or not create_result.get("id"):
                return create_result
            new_customer = await db.customers.find_one({"_id": ObjectId(create_result["id"]), "company_id": ObjectId(company_id)})
            if new_customer:
                invoice_result = await _action_create_invoice_with_customer(company_id, entities, current_user, company, new_customer)
                invoice_result["message"] = f"{create_result.get('message', '')} {invoice_result.get('message', '')}"
                return invoice_result
            return create_result
        return await _execute_action_with_customer(intent, entities, company_id, current_user, company, pending.get("customer"))
    return await _dispatch_action_direct(intent, entities, company_id, current_user, company)


async def _prepare_purchase_action(company_id: str, user_id, intent: str, entities: dict, current_user: dict, company: dict) -> Optional[dict]:
    """Prépare l'achat : résout le fournisseur, construit le résumé, demande confirmation."""
    supplier_name = entities.get("supplier_name", "")
    matches = await _find_suppliers_by_name(company_id, supplier_name, limit=10)
    if not matches:
        similar = await _find_similar_supplier_names(company_id, supplier_name)
        qty = int(entities.get("quantity", 0))
        product_ref = entities.get("product_ref", "")
        unit_price = entities.get("unit_price", 0)
        action_summary = [
            f"Créer le fournisseur « {supplier_name} »",
            f"Créer le bon de commande : {qty} x {product_ref} à {unit_price:,.3f} dt chez {supplier_name}",
        ]
        await _save_pending_execution(company_id, user_id, intent, entities, None, action_summary, supplier=None, create_supplier_first=supplier_name)
        msg = f"Le fournisseur « {supplier_name} » n'existe pas. Voulez-vous le créer puis enregistrer cet achat ?\n\n• " + "\n• ".join(action_summary) + "\n\nConfirmez-vous ?"
        suggestions = [f"Achat {qty} {product_ref} à {unit_price} dt chez {s}" for s in similar[:2]] if similar else [f"Nouveau fournisseur {supplier_name}"]
        return {"action": "confirm_execution", "action_summary": action_summary, "message": msg, "suggestions": suggestions}
    supplier = matches[0]
    action_summary = _build_action_summary(intent, entities, None, supplier=supplier)
    await _save_pending_execution(company_id, user_id, intent, entities, None, action_summary, supplier=supplier)
    msg = "Voici ce que je vais faire :\n• " + "\n• ".join(action_summary) + "\n\nConfirmez-vous l'exécution ?"
    return {"action": "confirm_execution", "action_summary": action_summary, "message": msg}


async def _prepare_sale_action(company_id: str, user_id, intent: str, entities: dict, current_user: dict, company: dict) -> Optional[dict]:
    """Prépare la vente : résout le client, construit le résumé, demande confirmation."""
    client_name = entities.get("client_name", "")
    customer, err_resp = await _resolve_customer_for_action(company_id, client_name, user_id, intent, entities, "register_sale")
    if err_resp:
        if err_resp.get("found") is False and not err_resp.get("client_suggestions"):
            qty = entities.get("quantity", 0)
            product_ref = entities.get("product_ref", "")
            unit_price = entities.get("unit_price", 0)
            action_summary = [
                f"Créer le client « {client_name} »",
                f"Créer la facture : {int(qty)} x {product_ref} à {unit_price:,.3f} dt pour {client_name}",
            ]
            await _save_pending_execution(company_id, user_id, intent, entities, None, action_summary, supplier=None, create_client_first=client_name)
            msg = f"Le client « {client_name} » n'existe pas. Voulez-vous le créer puis enregistrer cette vente ?\n\n• " + "\n• ".join(action_summary) + "\n\nConfirmez-vous ?"
            return {"action": "confirm_execution", "action_summary": action_summary, "message": msg, "suggestions": err_resp.get("suggestions", [])}
        return err_resp
    qty = entities.get("quantity", 1)
    product_ref = entities.get("product_ref", "")
    unit_price = entities.get("unit_price", 0)
    amount = qty * unit_price
    entities["amount"] = amount
    entities["description"] = f"{int(qty)} x {product_ref} à {unit_price:,.3f} dt"
    action_summary = _build_action_summary(intent, entities, customer)
    await _save_pending_execution(company_id, user_id, intent, entities, customer, action_summary)
    msg = "Voici ce que je vais faire :\n• " + "\n• ".join(action_summary) + "\n\nConfirmez-vous l'exécution ?"
    return {"action": "confirm_execution", "action_summary": action_summary, "message": msg}


async def _dispatch_action_direct(intent: str, entities: dict, company_id: str, current_user: dict, company: dict) -> Optional[dict]:
    """Exécute directement l'action (sans résolution client)."""
    if intent == ChatbotIntent.LIST_UNPAID:
        return await _action_list_unpaid(company_id)
    if intent == ChatbotIntent.DAILY_SUMMARY:
        return await _action_daily_summary(company_id)
    if intent == ChatbotIntent.CONSULT_CLIENT:
        return await _action_consult_client(company_id, entities.get("client_name", ""), current_user=current_user)
    if intent == ChatbotIntent.SEND_REMINDER:
        return await _action_send_reminder(company_id, entities.get("client_name", ""), current_user=current_user)
    if intent == ChatbotIntent.REGISTER_PAYMENT:
        return await _action_register_payment(company_id, entities, current_user)
    if intent == ChatbotIntent.CREATE_INVOICE:
        return await _action_create_invoice(company_id, entities, current_user, company)
    if intent == ChatbotIntent.CREATE_QUOTE:
        return await _action_create_quote(company_id, entities, current_user, company)
    return None


# Intentions qui nécessitent une confirmation (ajout, modification, suppression)
_CONFIRM_REQUIRED_INTENTS = {
    ChatbotIntent.CREATE_INVOICE,
    ChatbotIntent.CREATE_QUOTE,
    ChatbotIntent.CREATE_CLIENT,
    ChatbotIntent.CREATE_SUPPLIER,
    ChatbotIntent.REGISTER_PURCHASE,
    ChatbotIntent.REGISTER_SALE,
    ChatbotIntent.REGISTER_PAYMENT,
    ChatbotIntent.SEND_REMINDER,
}


async def _prepare_action_for_confirmation(parsed, company_id: str, current_user: dict, company: dict) -> Optional[dict]:
    """Prépare l'action. Pour affichage (list_unpaid, daily_summary, consult_client) : exécution directe. Pour ajout/modif/suppression : confirmation requise."""
    intent = parsed.intent
    entities = parsed.entities
    user_id = current_user.get("_id")

    # Actions d'affichage : exécution immédiate sans confirmation
    if intent == ChatbotIntent.LIST_UNPAID:
        return await _action_list_unpaid(company_id)
    if intent == ChatbotIntent.DAILY_SUMMARY:
        return await _action_daily_summary(company_id)
    if intent == ChatbotIntent.CONSULT_CLIENT:
        return await _action_consult_client(company_id, entities.get("client_name", ""), current_user=current_user)

    # Actions create_client / create_supplier : confirmation requise, pas de résolution client
    if intent == ChatbotIntent.CREATE_CLIENT:
        action_summary = _build_action_summary(intent, entities, None)
        await _save_pending_execution(company_id, user_id, intent, entities, None, action_summary)
        msg = "Voici ce que je vais faire :\n• " + "\n• ".join(action_summary) + "\n\nConfirmez-vous l'exécution ?"
        return {"action": "confirm_execution", "action_summary": action_summary, "message": msg}
    if intent == ChatbotIntent.CREATE_SUPPLIER:
        action_summary = _build_action_summary(intent, entities, None)
        await _save_pending_execution(company_id, user_id, intent, entities, None, action_summary)
        msg = "Voici ce que je vais faire :\n• " + "\n• ".join(action_summary) + "\n\nConfirmez-vous l'exécution ?"
        return {"action": "confirm_execution", "action_summary": action_summary, "message": msg}

    if intent == ChatbotIntent.REGISTER_PURCHASE:
        qty = entities.get("quantity")
        product_ref = entities.get("product_ref")
        supplier_name = entities.get("supplier_name")
        unit_price = entities.get("unit_price")
        if not qty or not product_ref:
            return {"action": "register_purchase", "found": False, "message": "Pour enregistrer un achat, indiquez la quantité et l'article. Exemple : Achat 50 Article 2 à 80 dt chez Pathé", "suggestions": ["Achat 50 Article 2 à 80 dt chez Pathé", "Achat 10 Chaise REF001 chez Fournisseur XYZ"]}
        if not supplier_name or not unit_price:
            msg = f"J'ai bien compris : achat de {qty} x {product_ref}."
            if not supplier_name:
                msg += " Quel fournisseur ?"
            if not unit_price:
                msg += " À quel prix unitaire ?"
            suggestions = [f"Achat {int(qty)} {product_ref} à XX dt chez [fournisseur]"]
            return {"action": "register_purchase", "found": False, "message": msg, "suggestions": suggestions}
        return await _prepare_purchase_action(company_id, user_id, intent, entities, current_user, company)

    if intent == ChatbotIntent.REGISTER_SALE:
        qty = entities.get("quantity")
        product_ref = entities.get("product_ref")
        client_name = entities.get("client_name")
        unit_price = entities.get("unit_price")
        if not qty or not product_ref:
            return {"action": "register_sale", "found": False, "message": "Pour enregistrer une vente, indiquez la quantité et l'article. Exemple : Vente 10 chaise à 120 dt pour Ahmed", "suggestions": ["Vente 10 chaise à 120 dt pour Ahmed", "Vente 5 table à 200 dt pour Sami"]}
        if not client_name:
            total = (qty or 0) * (unit_price or 0)
            msg = f"J'ai bien compris : vente de {int(qty)} x {product_ref} à {unit_price:,.3f} dt (total {total:,.3f} dt). Quel client ?"
            suggestions = [f"Vente {int(qty)} {product_ref} à {unit_price} dt pour [nom client]"]
            return {"action": "register_sale", "found": False, "message": msg, "suggestions": suggestions}
        return await _prepare_sale_action(company_id, user_id, intent, entities, current_user, company)

    # Actions d'ajout/modification/suppression : confirmation requise
    if intent not in _CONFIRM_REQUIRED_INTENTS:
        return await _dispatch_action(parsed, company_id, current_user, company)

    # Actions avec client (create_invoice, create_quote, register_payment, send_reminder)
    client_name = entities.get("client_name", "")
    action_key = str(intent)
    customer, err_resp = await _resolve_customer_for_action(company_id, client_name, user_id, intent, entities, action_key)
    if err_resp:
        return err_resp
    action_summary = _build_action_summary(intent, entities, customer)
    await _save_pending_execution(company_id, user_id, intent, entities, customer, action_summary)
    msg = "Voici ce que je vais faire :\n• " + "\n• ".join(action_summary) + "\n\nConfirmez-vous l'exécution ?"
    return {"action": "confirm_execution", "action_summary": action_summary, "message": msg}


async def _dispatch_action(parsed, company_id: str, current_user: dict, company: dict) -> Optional[dict]:
    """Exécute l'action correspondant à l'intention parsée (utilisé par _execute_pending_action)."""
    intent = parsed.intent
    entities = parsed.entities

    if intent == ChatbotIntent.LIST_UNPAID:
        return await _action_list_unpaid(company_id)

    if intent == ChatbotIntent.DAILY_SUMMARY:
        return await _action_daily_summary(company_id)

    if intent == ChatbotIntent.CONSULT_CLIENT:
        return await _action_consult_client(company_id, entities.get("client_name", ""), current_user=current_user)

    if intent == ChatbotIntent.SEND_REMINDER:
        return await _action_send_reminder(company_id, entities.get("client_name", ""), current_user=current_user)

    if intent == ChatbotIntent.REGISTER_PAYMENT:
        return await _action_register_payment(company_id, entities, current_user)

    if intent == ChatbotIntent.CREATE_INVOICE:
        return await _action_create_invoice(company_id, entities, current_user, company)

    if intent == ChatbotIntent.CREATE_QUOTE:
        return await _action_create_quote(company_id, entities, current_user, company)

    return None


async def _resolve_customer_for_action(company_id: str, client_name: str, user_id, intent: str, entities: dict, action_key: str) -> tuple:
    """
    Résout le client pour une action. Retourne:
    - (customer, None) si un seul client trouvé
    - (None, response_dict) si 0 ou plusieurs (demande confirmation ou suggestions)
    """
    matches = await _find_customers_by_name(company_id, client_name, limit=10)
    if not matches:
        similar = await _find_similar_customer_names(company_id, client_name)
        msg = f"Client '{client_name}' non trouvé."
        if similar:
            msg += f" Clients similaires : {', '.join(similar)}."
        qty = int(entities.get("quantity", 0))
        product_ref = entities.get("product_ref", "")
        unit_price = entities.get("unit_price", 0)
        suggestions = [f"facture 250 dt pour {s} réparation moteur" for s in similar[:2]] if action_key == "create_invoice" else (
            [f"devis 300 dt pour {s} prestation" for s in similar[:2]] if action_key == "create_quote" else
            [f"{s} a payé 200" for s in similar[:2]] if action_key == "register_payment" else
            [f"Vente {qty} {product_ref} à {unit_price} dt pour {s}" for s in similar[:2]] if action_key == "register_sale" else
            [f"client {s}" for s in similar[:3]] if action_key == "consult_client" else
            [f"rappeler {s}" for s in similar[:3]]
        )
        if not suggestions and action_key == "create_invoice":
            suggestions = ["facture 250 dt pour Mohamed Sahli réparation moteur"]
        return (None, {"action": action_key, "found": False, "message": msg, "suggestions": suggestions})
    if len(matches) == 1:
        return (matches[0], None)
    # Plusieurs correspondances : demander confirmation
    client_suggestions = [
        {"id": str(c["_id"]), "display_name": c.get("display_name") or c.get("name") or "?", "company_name": c.get("company_name", ""), "email": c.get("email", "")}
        for c in matches
    ]
    await _save_pending_confirmation(company_id, user_id, intent, entities, client_suggestions)
    msg = f"Plusieurs clients correspondent à « {client_name} ». Lequel choisissez-vous ?"
    return (None, {
        "action": "confirm_client",
        "pending_intent": intent,
        "message": msg,
        "client_suggestions": client_suggestions,
        "found": False,
    })


async def _action_create_invoice(company_id: str, entities: dict, current_user: dict, company: dict) -> dict:
    """Crée une facture en réutilisant la logique des routes invoices."""
    client_name = entities.get("client_name", "")
    customer, err_resp = await _resolve_customer_for_action(company_id, client_name, current_user.get("_id"), ChatbotIntent.CREATE_INVOICE, entities, "create_invoice")
    if err_resp:
        return err_resp
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


async def _action_create_invoice_with_customer(company_id: str, entities: dict, current_user: dict, company: dict, customer: dict) -> dict:
    """Crée une facture avec un client déjà sélectionné (après confirmation)."""
    amount = entities.get("amount", 0)
    description = entities.get("description", "Prestation de service")
    qty = entities.get("quantity")
    unit_price = entities.get("unit_price")
    product_ref = entities.get("product_ref")
    if qty and unit_price is not None and product_ref:
        items = [{"description": f"{product_ref} — {qty} x {unit_price:,.3f} dt", "quantity": float(qty), "unit_price": float(unit_price), "tax_rate": 0, "discount": 0}]
    else:
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
    customer, err_resp = await _resolve_customer_for_action(company_id, client_name, current_user.get("_id"), ChatbotIntent.CREATE_QUOTE, entities, "create_quote")
    if err_resp:
        return err_resp
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


async def _action_create_quote_with_customer(company_id: str, entities: dict, current_user: dict, company: dict, customer: dict) -> dict:
    """Crée un devis avec un client déjà sélectionné (après confirmation)."""
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
    customer, err_resp = await _resolve_customer_for_action(company_id, client_name, current_user.get("_id"), ChatbotIntent.REGISTER_PAYMENT, entities, "register_payment")
    if err_resp:
        return err_resp
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


async def _action_register_payment_with_customer(company_id: str, entities: dict, current_user: dict, customer: dict) -> dict:
    """Enregistre un paiement avec un client déjà sélectionné (après confirmation)."""
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


async def _find_suppliers_by_name(company_id: str, name: str, limit: int = 10) -> List[dict]:
    """Retourne les fournisseurs correspondant au nom."""
    if not name or len(name.strip()) < 2:
        return []
    pattern = re.escape(name.strip())
    cursor = db.suppliers.find(
        {
            "company_id": ObjectId(company_id),
            "$or": [
                {"display_name": {"$regex": pattern, "$options": "i"}},
                {"first_name": {"$regex": pattern, "$options": "i"}},
                {"company_name": {"$regex": pattern, "$options": "i"}},
            ]
        },
        {"_id": 1, "display_name": 1, "first_name": 1, "company_name": 1}
    ).limit(limit)
    return await cursor.to_list(length=limit)


async def _find_similar_supplier_names(company_id: str, search: str, limit: int = 5) -> List[str]:
    """Retourne des noms de fournisseurs similaires."""
    if not search or len(search.strip()) < 2:
        return []
    cursor = db.suppliers.find(
        {"company_id": ObjectId(company_id)},
        {"display_name": 1, "first_name": 1, "company_name": 1}
    ).limit(50)
    found = []
    seen = set()
    for s in await cursor.to_list(length=50):
        for key in ("display_name", "first_name", "company_name"):
            val = s.get(key)
            if val and val.lower().find(search.lower()) >= 0 and val not in seen:
                seen.add(val)
                found.append(val)
                if len(found) >= limit:
                    return found
    return found[:limit]


async def _find_customers_by_name(company_id: str, name: str, limit: int = 10) -> List[dict]:
    """Retourne tous les clients correspondant au nom (pour confirmation si plusieurs)."""
    if not name or len(name.strip()) < 2:
        return []
    pattern = re.escape(name.strip())
    cursor = db.customers.find(
        {
            "company_id": ObjectId(company_id),
            "$or": [
                {"display_name": {"$regex": pattern, "$options": "i"}},
                {"name": {"$regex": pattern, "$options": "i"}},
                {"first_name": {"$regex": pattern, "$options": "i"}},
                {"company_name": {"$regex": pattern, "$options": "i"}},
            ]
        },
        {"_id": 1, "display_name": 1, "name": 1, "first_name": 1, "company_name": 1, "email": 1, "phone": 1}
    ).limit(limit)
    return await cursor.to_list(length=limit)


async def _get_pending_confirmation(company_id: str, user_id) -> Optional[dict]:
    """Récupère une action en attente de confirmation client (plusieurs correspondances)."""
    doc = await db.chatbot_pending.find_one({
        "company_id": ObjectId(company_id),
        "user_id": user_id,
        "type": "confirm_client",
        "created_at": {"$gte": datetime.now(timezone.utc) - timedelta(minutes=10)}
    })
    return doc


async def _save_pending_confirmation(company_id: str, user_id, intent: str, entities: dict, client_suggestions: List[dict]):
    """Enregistre une action en attente de confirmation client (plusieurs correspondances)."""
    await db.chatbot_pending.delete_many({"company_id": ObjectId(company_id), "user_id": user_id})
    await db.chatbot_pending.insert_one({
        "company_id": ObjectId(company_id),
        "user_id": user_id,
        "type": "confirm_client",
        "intent": intent,
        "entities": entities,
        "client_suggestions": client_suggestions,
        "created_at": datetime.now(timezone.utc)
    })


async def _clear_pending_confirmation(company_id: str, user_id):
    """Supprime l'action en attente."""
    await db.chatbot_pending.delete_many({"company_id": ObjectId(company_id), "user_id": user_id})


async def _get_pending_execution(company_id: str, user_id) -> Optional[dict]:
    """Récupère une action en attente d'exécution (après confirmation utilisateur)."""
    doc = await db.chatbot_pending.find_one({
        "company_id": ObjectId(company_id),
        "user_id": user_id,
        "type": "confirm_execution",
        "created_at": {"$gte": datetime.now(timezone.utc) - timedelta(minutes=10)}
    })
    return doc


async def _save_pending_execution(company_id: str, user_id, intent: str, entities: dict, customer: Optional[dict], action_summary: List[str], supplier: Optional[dict] = None, create_supplier_first: Optional[str] = None, create_client_first: Optional[str] = None):
    """Enregistre une action en attente de confirmation d'exécution."""
    await db.chatbot_pending.delete_many({"company_id": ObjectId(company_id), "user_id": user_id})
    doc = {
        "company_id": ObjectId(company_id),
        "user_id": user_id,
        "type": "confirm_execution",
        "intent": intent,
        "entities": entities,
        "action_summary": action_summary,
        "created_at": datetime.now(timezone.utc)
    }
    if customer:
        doc["customer"] = customer
    if supplier:
        doc["supplier"] = supplier
    if create_supplier_first:
        doc["create_supplier_first"] = create_supplier_first
    if create_client_first:
        doc["create_client_first"] = create_client_first
    await db.chatbot_pending.insert_one(doc)


def _build_action_summary(intent: str, entities: dict, customer: Optional[dict] = None, supplier: Optional[dict] = None) -> List[str]:
    """Construit la liste des actions à afficher pour confirmation."""
    client_name = (customer.get("display_name") or customer.get("name") or "?") if customer else entities.get("client_name", "?")
    amount = entities.get("amount", 0)
    desc = entities.get("description", "Prestation de service")
    display = entities.get("display_name") or entities.get("first_name", "?")
    supplier_name = (supplier.get("display_name") or supplier.get("first_name", "?")) if supplier else entities.get("supplier_name", "?")
    qty = entities.get("quantity", 0)
    product_ref = entities.get("product_ref", "?")
    unit_price = entities.get("unit_price", 0)
    summaries = {
        ChatbotIntent.CREATE_INVOICE: [f"Créer une facture de {amount:,.3f} TND pour {client_name} — {desc}"],
        ChatbotIntent.CREATE_QUOTE: [f"Créer un devis de {amount:,.3f} TND pour {client_name} — {desc}"],
        ChatbotIntent.CREATE_CLIENT: [f"Créer un nouveau client : {display}"],
        ChatbotIntent.CREATE_SUPPLIER: [f"Créer un nouveau fournisseur : {display}" + (f" — type {entities.get('supplier_type', 'entreprise')}, devise {entities.get('currency', 'TND')}" if entities.get("supplier_type") or entities.get("currency", "TND") != "TND" else "")],
        ChatbotIntent.REGISTER_PURCHASE: [f"Créer un bon de commande : {int(qty)} x {product_ref} à {unit_price:,.3f} dt chez {supplier_name}"],
        ChatbotIntent.REGISTER_SALE: [f"Créer une facture : {int(qty)} x {product_ref} à {unit_price:,.3f} dt pour {client_name}"],
        ChatbotIntent.REGISTER_PAYMENT: [f"Enregistrer un paiement de {amount:,.3f} TND pour {client_name}"],
        ChatbotIntent.CONSULT_CLIENT: [f"Consulter la fiche client : {client_name}"],
        ChatbotIntent.SEND_REMINDER: [f"Envoyer un rappel à {client_name}"],
        ChatbotIntent.LIST_UNPAID: ["Récupérer la liste des factures impayées"],
        ChatbotIntent.DAILY_SUMMARY: ["Récupérer le rapport journalier"],
    }
    return summaries.get(intent, ["Exécuter l'action"])


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


async def _action_consult_client(company_id: str, name: str, current_user: dict = None, customer: Optional[dict] = None) -> dict:
    if not customer:
        user_id = current_user.get("_id") if current_user else None
        customer, err_resp = await _resolve_customer_for_action(company_id, name, user_id, ChatbotIntent.CONSULT_CLIENT, {"client_name": name}, "consult_client")
        if err_resp:
            return err_resp
    if not customer:
        return {"action": "consult_client", "found": False, "message": f"Client '{name}' non trouvé.", "suggestions": []}

    total_invoiced_pipeline = [
        {"$match": {"company_id": ObjectId(company_id), "customer_id": customer["_id"]}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}, "balance": {"$sum": "$balance_due"}}}
    ]
    stats_list = await db.invoices.aggregate(total_invoiced_pipeline).to_list(1)
    stats = stats_list[0] if stats_list else {"total": 0, "balance": 0}

    cust_name = customer.get("display_name") or customer.get("name") or customer.get("first_name") or "?"
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


async def _action_send_reminder(company_id: str, client_name: str, current_user: dict = None, customer: Optional[dict] = None) -> dict:
    if not customer:
        user_id = current_user.get("_id") if current_user else None
        customer, err_resp = await _resolve_customer_for_action(company_id, client_name, user_id, ChatbotIntent.SEND_REMINDER, {"client_name": client_name}, "send_reminder")
        if err_resp:
            return err_resp
    if not customer:
        return {"action": "send_reminder", "found": False, "message": f"Client '{client_name}' non trouvé.", "suggestions": []}

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


async def _action_create_client(company_id: str, entities: dict, current_user: dict) -> dict:
    """Crée un nouveau client."""
    first_name = entities.get("first_name", "").strip()
    if not first_name:
        return {"action": "create_client", "found": False, "message": "Nom du client manquant.", "suggestions": []}
    last_name = entities.get("last_name")
    display_name = entities.get("display_name") or (f"{first_name} {last_name}".strip() if last_name else first_name)
    client_type = entities.get("client_type", "entreprise")
    currency = entities.get("currency", "TND")
    now = datetime.now(timezone.utc)
    customer_dict = {
        "company_id": ObjectId(company_id),
        "first_name": first_name,
        "last_name": last_name or None,
        "display_name": display_name,
        "client_type": client_type,
        "currency": currency,
        "balance": 0.0,
        "total_invoiced": 0.0,
        "total_paid": 0.0,
        "invoice_count": 0,
        "quote_count": 0,
        "public_access": {"enabled": False},
        "created_at": now,
        "updated_at": now,
        "created_by": current_user["_id"]
    }
    result = await db.customers.insert_one(customer_dict)
    await db.access_logs.insert_one({
        "company_id": ObjectId(company_id),
        "user_id": ObjectId(str(current_user["_id"])),
        "user_name": current_user.get("full_name", ""),
        "category": "Client",
        "action": "Créer",
        "element": display_name,
        "ip_address": None,
        "created_at": now
    })
    return {
        "action": "create_client",
        "id": str(result.inserted_id),
        "message": f"Client « {display_name} » créé avec succès."
    }


async def _action_create_supplier(company_id: str, entities: dict, current_user: dict) -> dict:
    """Crée un nouveau fournisseur."""
    first_name = entities.get("first_name", "").strip()
    if not first_name:
        return {"action": "create_supplier", "found": False, "message": "Nom du fournisseur manquant.", "suggestions": []}
    last_name = entities.get("last_name")
    display_name = entities.get("display_name") or (f"{first_name} {last_name}".strip() if last_name else first_name)
    supplier_type = entities.get("supplier_type", "entreprise")
    currency = entities.get("currency", "TND")
    now = datetime.now(timezone.utc)
    supplier_dict = {
        "company_id": ObjectId(company_id),
        "first_name": first_name,
        "last_name": last_name or None,
        "display_name": display_name,
        "supplier_type": supplier_type,
        "currency": currency,
        "balance": 0.0,
        "total_purchases": 0.0,
        "total_paid": 0.0,
        "purchase_order_count": 0,
        "created_at": now,
        "updated_at": now,
        "created_by": current_user["_id"]
    }
    result = await db.suppliers.insert_one(supplier_dict)
    await db.access_logs.insert_one({
        "company_id": ObjectId(company_id),
        "user_id": ObjectId(str(current_user["_id"])),
        "user_name": current_user.get("full_name", ""),
        "category": "Fournisseur",
        "action": "Créer",
        "element": display_name,
        "ip_address": None,
        "created_at": now
    })
    return {
        "action": "create_supplier",
        "id": str(result.inserted_id),
        "message": f"Fournisseur « {display_name} » créé avec succès."
    }


async def _action_register_purchase(company_id: str, entities: dict, current_user: dict, company: dict, supplier: Optional[dict] = None) -> dict:
    """Crée un bon de commande fournisseur."""
    if not supplier:
        return {"action": "register_purchase", "found": False, "message": "Fournisseur requis pour créer un bon de commande.", "suggestions": []}
    qty = float(entities.get("quantity", 1))
    product_ref = entities.get("product_ref", "").strip()
    unit_price = float(entities.get("unit_price", 0))
    if not product_ref:
        return {"action": "register_purchase", "found": False, "message": "Référence article manquante.", "suggestions": []}
    product = await db.products.find_one({
        "company_id": ObjectId(company_id),
        "$or": [
            {"name": {"$regex": re.escape(product_ref), "$options": "i"}},
            {"sku": {"$regex": re.escape(product_ref), "$options": "i"}},
        ]
    })
    description = product.get("name", product_ref) if product else product_ref
    if product and unit_price == 0:
        unit_price = product.get("purchase_price", 0)
    product_id = str(product["_id"]) if product else None
    items = [{"product_id": product_id, "description": description, "quantity": qty, "unit_price": unit_price, "tax_rate": 0, "discount": 0}]
    totals = calculate_document_totals(items)
    numbering = company.get("numbering", {})
    number = generate_document_number(numbering.get("po_prefix", "BC"), numbering.get("po_next", 1), datetime.now().year)
    now = datetime.now(timezone.utc)
    doc_dict = {
        "company_id": ObjectId(company_id),
        "supplier_id": supplier["_id"],
        "number": number,
        "date": now,
        "items": items,
        **totals,
        "status": "draft",
        "created_at": now,
        "updated_at": now,
        "created_by": current_user["_id"]
    }
    result = await db.purchase_orders.insert_one(doc_dict)
    await db.companies.update_one({"_id": ObjectId(company_id)}, {"$inc": {"numbering.po_next": 1}})
    await db.access_logs.insert_one({
        "company_id": ObjectId(company_id),
        "user_id": ObjectId(str(current_user["_id"])),
        "user_name": current_user.get("full_name", ""),
        "category": "Bon de commande",
        "action": "Créer",
        "element": number,
        "ip_address": None,
        "created_at": now
    })
    supplier_name = supplier.get("display_name") or supplier.get("first_name", "?")
    return {
        "action": "register_purchase",
        "id": str(result.inserted_id),
        "number": number,
        "message": f"Bon de commande {number} créé : {int(qty)} x {description} à {unit_price:,.3f} dt chez {supplier_name}."
    }


@router.get("/help")
async def get_chatbot_help(
    current_user: dict = Depends(get_current_user)
):
    """Retourne l'aide et la liste des commandes supportées."""
    return {
        "title": "Commandes du chatbot EasyBill",
        "description": "Vous pouvez envoyer des commandes en langage naturel (français/arabe translittéré).",
        "intents": [
            {"id": "create_client", "label": "Créer un client", "examples": ["Nouveau client Ahmed ben ali", "ajouter client Mohamed Sahli"]},
            {"id": "create_supplier", "label": "Créer un fournisseur", "examples": ["Nouveau fournisseur Pathé, particulier devise dinars", "ajouter fournisseur ABC SARL"]},
            {"id": "register_sale", "label": "Enregistrer une vente", "examples": ["j'ai vendue 10 chaise à 120 dt", "Vente 5 table à 200 dt pour Ahmed"]},
            {"id": "create_invoice", "label": "Créer une facture", "examples": ["facture 250 dt pour Ali réparation moteur", "nouvelle facture Ahmed 500 dt installation clim"]},
            {"id": "create_quote", "label": "Créer un devis", "examples": ["devis 300 dt pour Sami peinture", "pro-forma Ahmed 1000 dt"]},
            {"id": "consult_client", "label": "Consulter un client", "examples": ["client Ahmed", "fiche client Sami", "infos Ali"]},
            {"id": "list_unpaid", "label": "Liste des impayés", "examples": ["factures impayées", "dettes clients", "créances en retard"]},
            {"id": "register_payment", "label": "Enregistrer un paiement", "examples": ["Ali a payé 200", "paiement 500 dt Ahmed", "Sami a réglé 300"]},
            {"id": "send_reminder", "label": "Envoyer un rappel", "examples": ["rappeler Ahmed", "relancer Sami", "envoyer rappel Ali"]},
            {"id": "daily_summary", "label": "Résumé du jour", "examples": ["ventes du jour", "rapport aujourd'hui", "bilan journée"]},
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
            {"id": "create_client", "examples": ["Nouveau client Ahmed ben ali", "ajouter client Mohamed Sahli"]},
            {"id": "create_supplier", "examples": ["Nouveau fournisseur Pathé, particulier devise dinars", "ajouter fournisseur ABC SARL"]},
            {"id": "register_sale", "examples": ["j'ai vendue 10 chaise à 120 dt", "Vente 5 table à 200 dt pour Ahmed"]},
            {"id": "create_invoice", "examples": ["facture 250 dt pour Ali réparation moteur", "nouvelle facture Ahmed 500 dt installation clim"]},
            {"id": "create_quote", "examples": ["devis 300 dt pour Sami peinture", "pro-forma Ahmed 1000 dt"]},
            {"id": "consult_client", "examples": ["client Ahmed", "fiche client Sami", "infos Ali"]},
            {"id": "list_unpaid", "examples": ["factures impayées", "dettes clients", "créances en retard"]},
            {"id": "register_payment", "examples": ["Ali a payé 200", "paiement 500 dt Ahmed", "Sami a réglé 300"]},
            {"id": "send_reminder", "examples": ["rappeler Ahmed", "relancer Sami", "envoyer rappel Ali"]},
            {"id": "daily_summary", "examples": ["ventes du jour", "rapport aujourd'hui", "bilan journée"]},
        ]
    }


# Import manquant (re) ajouté
import re
