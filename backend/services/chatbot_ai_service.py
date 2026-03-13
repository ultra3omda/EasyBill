"""
Service IA pour le chatbot EasyBill.
Utilise Gemini ou OpenAI pour comprendre les messages en langage naturel
et extraire l'intention + entités structurées.
"""

import os
import json
import re
import asyncio
import logging
from typing import Optional, Dict, Any, List
from dataclasses import dataclass

logger = logging.getLogger(__name__)

CHATBOT_AI_PROMPT = """Tu es l'assistant financier d'EasyBill, une application de gestion d'entreprise (facturation, clients, fournisseurs, achats, ventes, stock).

ACTIONS SUPPORTÉES (retourne intent + entities en JSON strict) :
- create_client : Nouveau client (ex: "Nouveau client Ahmed ben ali" → first_name=Ahmed, last_name=ben ali, display_name="Ahmed ben ali")
- create_supplier : Nouveau fournisseur (ex: "Nouveau fournisseur Pathé, particulier, devise dinars" → first_name=Pathé, supplier_type=particulier, currency=TND)
- register_purchase : Achat (ex: "j'ai acheté 50 Article 2" → quantity=50, product_ref=Article 2 ; "achat 50 chaise REF0001 à 80dt chez Pathé" → quantity=50, product_ref=REF0001, unit_price=80, supplier_name=Pathé)
- register_sale : Vente (ex: "j'ai vendue 10 chaise à 120 dt" → quantity=10, product_ref=chaise, unit_price=120 ; "vente 5 table pour Ahmed à 200 dt" → quantity=5, product_ref=table, unit_price=200, client_name=Ahmed)
- create_invoice : Facture (montant, client_name, description)
- create_quote : Devis (montant, client_name, description)
- register_payment : Paiement reçu (ex: "Ahmed a payé 200" → client_name, amount)
- consult_client : Consulter fiche client (ex: "client Ahmed" → client_name=Ahmed)
- send_reminder : Envoyer rappel
- list_unpaid : Factures impayées
- daily_summary : Rapport journalier (ex: "ventes du jour", "rapport aujourd'hui", "bilan journée")
- unknown : Si le message n'est pas une action reconnue

RÈGLES :
- Extrais les entités du message (noms, montants, types, etc.)
- Pour "Ahmed ben ali" comme nom client : first_name=Ahmed, last_name=ben ali, display_name="Ahmed ben ali"
- Pour fournisseur "Pathé, particulier" : first_name=Pathé, supplier_type=particulier
- Devise : dinars, dinar, dt, TND → currency=TND
- Montants : extrais le nombre (ex: 200, 80, 120)
- Si ambiguïté, mets suggestions dans le champ "suggestions" (questions à poser)
- "ventes du jour", "ventes aujourd'hui" = daily_summary (rapport), PAS register_sale
- needs_confirmation=true pour create_client, create_supplier, register_purchase, register_sale, create_invoice, create_quote, register_payment, send_reminder
- Pour register_purchase : si supplier_name ou unit_price manquent, mets des suggestions comme "Quel fournisseur ?", "À quel prix unitaire ?", "Exemple : Achat 50 Article 2 à 80 dt chez Pathé"
- Pour register_sale : si client_name manque, mets des suggestions comme "Quel client ?", "Exemple : Vente 10 chaise à 120 dt pour Ahmed"

Réponds UNIQUEMENT avec un JSON valide, sans markdown :
{"intent": "...", "entities": {...}, "action_summary": "résumé en français", "confidence": 0.0-1.0, "needs_confirmation": true/false, "suggestions": []}
"""


@dataclass
class AIParseResult:
    intent: str
    entities: Dict[str, Any]
    action_summary: str
    confidence: float
    needs_confirmation: bool
    suggestions: List[str]
    raw_response: Optional[str] = None


async def parse_message_with_ai(message: str, context: Optional[Dict] = None) -> Optional[AIParseResult]:
    """
    Parse le message utilisateur avec Gemini ou OpenAI.
    Retourne None si pas de clé API ou en cas d'erreur (fallback vers regex).
    """
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_AI_KEY")
    if api_key:
        result = await _parse_with_gemini(message, api_key, context)
        if result:
            return result
    openai_key = os.environ.get("OPENAI_API_KEY")
    if openai_key:
        result = await _parse_with_openai(message, openai_key, context)
        if result:
            return result
    return None


def _gemini_sync_call(message: str, api_key: str) -> Optional[str]:
    """Appel synchrone à Gemini (exécuté dans un thread)."""
    from google import genai
    from google.genai import types
    client = genai.Client(api_key=api_key)
    models = ["gemini-2.0-flash", "gemini-2.5-flash-lite", "gemini-1.5-flash", "gemini-1.5-pro"]
    for model_name in models:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=f"{CHATBOT_AI_PROMPT}\n\nMessage utilisateur : « {message} »",
                config=types.GenerateContentConfig(
                    temperature=0.2,
                    max_output_tokens=1024,
                )
            )
            text = response.text.strip() if response.text else ""
            if text:
                return text
        except Exception as e:
            logger.warning("Gemini %s: %s", model_name, str(e)[:100])
            continue
    return None


async def _parse_with_gemini(message: str, api_key: str, context: Optional[Dict]) -> Optional[AIParseResult]:
    """Parse avec Google Gemini (API sync → run_in_executor)."""
    try:
        text = await asyncio.to_thread(_gemini_sync_call, message, api_key)
        if not text:
            return None
        text = re.sub(r"^```json\s*", "", text)
        text = re.sub(r"\s*```\s*$", "", text)
        data = json.loads(text)
        return _build_parse_result(data, text)
    except Exception as e:
        logger.warning("Chatbot AI Gemini error: %s", e)
    return None


async def _parse_with_openai(message: str, api_key: str, context: Optional[Dict]) -> Optional[AIParseResult]:
    """Parse avec OpenAI."""
    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=api_key)
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": CHATBOT_AI_PROMPT},
                {"role": "user", "content": f"Message utilisateur : « {message} »"}
            ],
            temperature=0.2,
            max_tokens=1024,
        )
        text = (response.choices[0].message.content or "").strip()
        if not text:
            return None
        text = re.sub(r"^```json\s*", "", text)
        text = re.sub(r"\s*```\s*$", "", text)
        data = json.loads(text)
        return _build_parse_result(data, text)
    except Exception as e:
        logger.warning("Chatbot AI OpenAI error: %s", e)
    return None


def _build_parse_result(data: dict, raw: str) -> AIParseResult:
    """Construit AIParseResult depuis la réponse JSON du LLM."""
    intent = data.get("intent", "unknown")
    if intent not in ("create_client", "create_supplier", "register_purchase", "register_sale", "create_invoice", "create_quote",
                     "register_payment", "consult_client", "send_reminder", "list_unpaid", "daily_summary"):
        intent = "unknown"
    entities = data.get("entities") or {}
    if isinstance(entities, str):
        entities = {}
    action_summary = data.get("action_summary") or ""
    confidence = float(data.get("confidence", 0.8))
    needs_confirmation = bool(data.get("needs_confirmation", True))
    suggestions = data.get("suggestions") or []
    if isinstance(suggestions, str):
        suggestions = [suggestions] if suggestions else []
    return AIParseResult(
        intent=intent,
        entities=entities,
        action_summary=action_summary,
        confidence=confidence,
        needs_confirmation=needs_confirmation,
        suggestions=suggestions,
        raw_response=raw,
    )
