"""
Module B - Chatbot Financial Interface
Parser de commandes en langage naturel (français/arabe translittéré).
Sans dépendance externe : règles regex + patterns, prêt pour branchement LLM ultérieur.
"""

import re
from typing import Optional, Dict, Any
from dataclasses import dataclass, field
from enum import Enum


class ChatbotIntent(str, Enum):
    CREATE_INVOICE = "create_invoice"
    CREATE_QUOTE = "create_quote"
    CONSULT_CLIENT = "consult_client"
    LIST_UNPAID = "list_unpaid"
    REGISTER_PAYMENT = "register_payment"
    SEND_REMINDER = "send_reminder"
    DAILY_SUMMARY = "daily_summary"
    UNKNOWN = "unknown"


@dataclass
class ParsedCommand:
    intent: ChatbotIntent
    raw_text: str
    confidence: float = 0.0
    entities: Dict[str, Any] = field(default_factory=dict)
    suggested_action: Optional[str] = None
    missing_fields: list = field(default_factory=list)
    response_text: str = ""


class ChatbotParser:
    """
    Parseur de commandes financières en langage naturel.
    Supporte le français, l'arabe translittéré, et les mélanges (darija).
    Règles basées sur regex — remplaçable par un LLM via l'interface commune.
    """

    # ── Patterns de détection d'intention ──────────────────────────────────

    _INVOICE_PATTERNS = [
        r"\bfacture\b", r"\bfacturation\b", r"\bfact\b", r"\bfattura\b",
        r"\bfatura\b", r"\bfaktoura\b", r"\binvoice\b",
    ]
    _QUOTE_PATTERNS = [
        r"\bdevis\b", r"\bpro.?forma\b", r"\boffre\b", r"\bprix\b",
        r"\bcitation\b", r"\bquote\b",
    ]
    _CONSULT_PATTERNS = [
        r"\bclient\b", r"\bfiche.?client\b", r"\binfo(rmation)?s?\b",
        r"\bsold[e]?\b.*\bclient\b", r"\bclient\b.*\bsold[e]?\b",
    ]
    _UNPAID_PATTERNS = [
        r"\bimpay[ée]e?s?\b", r"\bnon.?pay[ée]e?s?\b", r"\ben.?retard\b",
        r"\bdue\b", r"\bdettes?\b", r"\bcr[ée]ances?\b", r"\bimpaid\b",
    ]
    _PAYMENT_PATTERNS = [
        r"\bpay[ée]?\b", r"\brègl[e]?\b", r"\bencaiss[e]?\b",
        r"\breçu\b", r"\bpayment\b", r"\bkhallas\b", r"\bkhalles\b",
    ]
    _REMINDER_PATTERNS = [
        r"\brappel\b", r"\brelance\b", r"\brappeler\b", r"\brelancer\b",
        r"\breminder\b", r"\baviser\b",
    ]
    _SUMMARY_PATTERNS = [
        r"\brapport\b", r"\bsummary\b", r"\br[ée]sum[ée]\b",
        r"\btoday\b", r"\baujourd.?hui\b", r"\bjournée\b",
        r"\bbilan\b", r"\bstat(istique)?s?\b",
    ]

    # ── Patterns d'extraction d'entités ────────────────────────────────────

    _AMOUNT_PATTERN = re.compile(
        r"(\d[\d\s,\.]*)\s*(dt|dinar|tnd|eur|€|usd|\$|mad|dzd)?",
        re.IGNORECASE
    )
    _CLIENT_PATTERN = re.compile(
        r"(?:pour|client|de|à|pour le client|lil client)\s+([A-Za-zÀ-ÿ\u0600-\u06FF][A-Za-zÀ-ÿ\u0600-\u06FF\s]{1,50}?)(?:\s+(?:facture|devis|paiement|pour|dt|dinar|\d)|$)",
        re.IGNORECASE
    )
    _DESC_PATTERN = re.compile(
        r"(?:pour|objet|description|travaux?|service|article|prestation|installation|r[ée]paration)\s+(.{3,80}?)(?:\s+\d|\s*$)",
        re.IGNORECASE
    )

    def _match_any(self, text: str, patterns: list) -> bool:
        return any(re.search(p, text, re.IGNORECASE) for p in patterns)

    def _extract_amount(self, text: str) -> Optional[float]:
        match = self._AMOUNT_PATTERN.search(text)
        if match:
            raw = match.group(1).replace(" ", "").replace(",", ".")
            try:
                return float(raw)
            except ValueError:
                return None
        return None

    def _extract_client_name(self, text: str) -> Optional[str]:
        match = self._CLIENT_PATTERN.search(text)
        if match:
            return match.group(1).strip()
        # Fallback: dernier mot majuscule
        words = [w for w in text.split() if w[0:1].isupper() and len(w) > 2]
        return words[-1] if words else None

    def _extract_description(self, text: str) -> Optional[str]:
        match = self._DESC_PATTERN.search(text)
        return match.group(1).strip() if match else None

    def _detect_intent(self, text: str) -> ChatbotIntent:
        t = text.lower()
        # Ordre de priorité : paiement avant facture (pour ne pas confondre "Ali a payé" avec facture)
        if self._match_any(t, self._PAYMENT_PATTERNS):
            return ChatbotIntent.REGISTER_PAYMENT
        if self._match_any(t, self._INVOICE_PATTERNS):
            return ChatbotIntent.CREATE_INVOICE
        if self._match_any(t, self._QUOTE_PATTERNS):
            return ChatbotIntent.CREATE_QUOTE
        if self._match_any(t, self._REMINDER_PATTERNS):
            return ChatbotIntent.SEND_REMINDER
        if self._match_any(t, self._UNPAID_PATTERNS):
            return ChatbotIntent.LIST_UNPAID
        if self._match_any(t, self._SUMMARY_PATTERNS):
            return ChatbotIntent.DAILY_SUMMARY
        if self._match_any(t, self._CONSULT_PATTERNS):
            return ChatbotIntent.CONSULT_CLIENT
        return ChatbotIntent.UNKNOWN

    def parse(self, text: str) -> ParsedCommand:
        """
        Parse une commande en langage naturel et retourne une ParsedCommand structurée.

        Exemples supportés :
            "facture 250 dt pour Ali réparation moteur"
            "devis 500 dt pour Ahmed installation clim"
            "client Ahmed"
            "factures impayées"
            "Ali a payé 200"
            "rappeler Ahmed"
            "rapport aujourd'hui"
        """
        intent = self._detect_intent(text)
        entities: Dict[str, Any] = {}
        missing: list = []

        amount = self._extract_amount(text)
        client_name = self._extract_client_name(text)
        description = self._extract_description(text)

        if amount:
            entities["amount"] = amount
        if client_name:
            entities["client_name"] = client_name
        if description:
            entities["description"] = description

        # Vérification des champs requis par intention
        if intent == ChatbotIntent.CREATE_INVOICE:
            if not amount:
                missing.append("amount")
            if not client_name:
                missing.append("client_name")
            if not description:
                entities.setdefault("description", "Prestation de service")

        elif intent == ChatbotIntent.CREATE_QUOTE:
            if not amount:
                missing.append("amount")
            if not client_name:
                missing.append("client_name")

        elif intent == ChatbotIntent.REGISTER_PAYMENT:
            if not amount:
                missing.append("amount")
            if not client_name:
                missing.append("client_name")

        elif intent in (ChatbotIntent.CONSULT_CLIENT, ChatbotIntent.SEND_REMINDER):
            if not client_name:
                missing.append("client_name")

        confidence = 1.0 if not missing else max(0.3, 1.0 - len(missing) * 0.3)
        response = self._build_response(intent, entities, missing)

        return ParsedCommand(
            intent=intent,
            raw_text=text,
            confidence=confidence,
            entities=entities,
            missing_fields=missing,
            response_text=response,
        )

    def _build_response(self, intent: ChatbotIntent, entities: dict, missing: list) -> str:
        if missing:
            labels = {
                "amount": "le montant",
                "client_name": "le nom du client",
                "description": "la description"
            }
            missing_str = ", ".join(labels.get(f, f) for f in missing)
            return f"Il manque : {missing_str}. Pouvez-vous préciser ?"

        client = entities.get("client_name", "")
        amount = entities.get("amount", "")
        desc = entities.get("description", "")

        responses = {
            ChatbotIntent.CREATE_INVOICE: f"Création d'une facture de {amount} DT pour {client} — {desc}",
            ChatbotIntent.CREATE_QUOTE: f"Création d'un devis de {amount} DT pour {client}",
            ChatbotIntent.CONSULT_CLIENT: f"Consultation de la fiche client : {client}",
            ChatbotIntent.LIST_UNPAID: "Récupération des factures impayées…",
            ChatbotIntent.REGISTER_PAYMENT: f"Enregistrement d'un paiement de {amount} DT pour {client}",
            ChatbotIntent.SEND_REMINDER: f"Envoi d'un rappel à {client}",
            ChatbotIntent.DAILY_SUMMARY: "Récupération du rapport journalier…",
            ChatbotIntent.UNKNOWN: "Commande non reconnue. Essayez : 'facture 250 dt pour Ahmed'",
        }
        return responses.get(intent, "")


# Singleton accessible depuis les routes
chatbot_parser = ChatbotParser()
