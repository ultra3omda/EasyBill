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
    CREATE_CLIENT = "create_client"
    CREATE_SUPPLIER = "create_supplier"
    REGISTER_PURCHASE = "register_purchase"
    REGISTER_SALE = "register_sale"
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
    hints: list = field(default_factory=list)


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
        r"\bpay[ée]?\b", r"\br[èeé]gl[éeè]?\b", r"\bencaiss[ée]?\b",
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
        r"\bventes?\s+(du\s+jour|aujourd['']hui|de\s+la\s+journ[ée]e)\b",
        r"\b(du\s+jour|aujourd['']hui)\s+ventes?\b",
    ]
    _CREATE_CLIENT_PATTERNS = [
        r"\bnouveau\s+client\b", r"\bnouvelle\s+client\b", r"\bajouter\s+client\b",
        r"\bcr[ée]er\s+client\b", r"\bclient\s+nouveau\b", r"\badd\s+customer\b",
    ]
    _CREATE_SUPPLIER_PATTERNS = [
        r"\bnouveau\s+fournisseur\b", r"\bnouvelle\s+fournisseur\b", r"\bajouter\s+fournisseur\b",
        r"\bcr[ée]er\s+fournisseur\b", r"\bfournisseur\s+nouveau\b", r"\badd\s+supplier\b",
    ]
    _PURCHASE_PATTERNS = [
        r"\bachat\b", r"\bachats?\b", r"\bachéter\b", r"\bachèt\b", r"\bacheté\b",
        r"\bj['']ai\s+achet[ée]\b", r"\bacheter\b", r"\bpurchase\b", r"\bbuy\b",
    ]
    _SALE_PATTERNS = [
        r"\bvente\b", r"\bventes?\b", r"\bvendu\b", r"\bvendue\b", r"\bvendre\b",
        r"\bj['']ai\s+vendu[e]?\b", r"\bsale\b", r"\bsold\b",
    ]
    _CREATE_CLIENT_NAME_PATTERN = re.compile(
        r"(?:nouveau|nouvelle|ajouter|cr[ée]er)\s+client\s+(.+)",
        re.IGNORECASE
    )
    _CREATE_SUPPLIER_NAME_PATTERN = re.compile(
        r"(?:nouveau|nouvelle|ajouter|cr[ée]er)\s+fournisseur\s+(.+)",
        re.IGNORECASE
    )
    _PURCHASE_QUANTITY_PRODUCT_PATTERN = re.compile(
        r"(\d[\d\s,\.]*)\s+([A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9\s\-]{1,60}?)(?:\s+à\s+|\s+@\s+|\s+dt\b|\s+dinar|\s+chez|\s*$)",
        re.IGNORECASE
    )
    _PURCHASE_AT_PATTERN = re.compile(
        r"(?:à|@)\s*(\d[\d\s,\.]*)\s*(?:dt|dinar|tnd)?",
        re.IGNORECASE
    )
    _PURCHASE_CHEZ_PATTERN = re.compile(
        r"(?:chez|auprès de|from)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s\-]{1,50}?)(?:\s|$)",
        re.IGNORECASE
    )
    _SALE_QUANTITY_PRODUCT_PATTERN = re.compile(
        r"(\d[\d\s,\.]*)\s+([A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9\s\-]{1,60}?)(?:\s+[aà]\s+|\s+@\s+|\s+dt\b|\s+dinar|\s+pour|\s*$)",
        re.IGNORECASE
    )
    _SALE_POUR_PATTERN = re.compile(
        r"(?:pour|à|client)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s\-]{1,50}?)(?:\s|$)",
        re.IGNORECASE
    )

    # ── Patterns d'extraction d'entités ────────────────────────────────────

    _AMOUNT_PATTERN = re.compile(
        r"(\d[\d\s,\.]*)\s*(dt|dinar|tnd|eur|€|usd|\$|mad|dzd)?",
        re.IGNORECASE
    )
    _CLIENT_PATTERN = re.compile(
        r"(?:pour|client|de|pour le client|lil client)\s+([A-Za-zÀ-ÿ\u0600-\u06FF][A-Za-zÀ-ÿ\u0600-\u06FF\s]{1,50}?)(?:\s+(?:facture|devis|paiement|pour|dt|dinar|\d)|$)",
        re.IGNORECASE
    )
    # "Ahmed a payé 200" / "Mohamed à payé 300 dt" — client AVANT le verbe
    _PAYMENT_CLIENT_PATTERN = re.compile(
        r"^([A-Za-zÀ-ÿ\u0600-\u06FF][A-Za-zÀ-ÿ\u0600-\u06FF\s]*?)\s+(?:a|à)\s+(?:payé|paye|r[èeé]gl[éeè]?|encaissé|encaisse|khallas|khalles)\b",
        re.IGNORECASE
    )
    # "paiement 200 dt pour Ahmed" / "200 dt pour Ahmed"
    _PAYMENT_CLIENT_AFTER_PATTERN = re.compile(
        r"(?:\d[\d\s,\.]*\s*(?:dt|dinar|tnd)\s+)?(?:pour|par|de)\s+([A-Za-zÀ-ÿ\u0600-\u06FF][A-Za-zÀ-ÿ\u0600-\u06FF\s]{1,50}?)(?:\s|$)",
        re.IGNORECASE
    )
    _DESC_PATTERN = re.compile(
        r"((?:r[ée]paration|installation|prestation|travaux?|service|article|objet|description|maintenance|peinture)\s+[A-Za-zÀ-ÿ\u0600-\u06FF\s]{0,80}?)(?:\s+\d|\s*$)",
        re.IGNORECASE
    )
    # Mots-clés qui marquent le début de la description (après le nom du client)
    _DESC_START_KEYWORDS = [
        r"\br[ée]paration\b", r"\binstallation\b", r"\bprestation\b", r"\btravaux?\b",
        r"\bservice\b", r"\barticle\b", r"\bobjet\b", r"\bdescription\b", r"\bmaintenance\b",
        r"\bpeinture\b", r"\bd[ée]m[ée]nagement\b",
    ]
    _CONSULT_CLIENT_NAME_PATTERN = re.compile(
        r"(?:client|fiche.?client|infos?)\s+([A-Za-zÀ-ÿ\u0600-\u06FF][A-Za-zÀ-ÿ\u0600-\u06FF\s\-]{1,50}?)(?:\s*$|\s+pour|\s+facture)",
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

    def _extract_client_name(self, text: str, trim_before_desc: bool = True, intent: Optional[ChatbotIntent] = None) -> Optional[str]:
        # Paiement : "Ahmed a payé 200" / "Mohamed à payé 300 dt" — client avant le verbe
        if intent == ChatbotIntent.REGISTER_PAYMENT:
            match = self._PAYMENT_CLIENT_PATTERN.search(text)
            if match:
                return match.group(1).strip()
            match = self._PAYMENT_CLIENT_AFTER_PATTERN.search(text)
            if match:
                return match.group(1).strip()
        if intent == ChatbotIntent.CONSULT_CLIENT:
            match = self._CONSULT_CLIENT_NAME_PATTERN.search(text)
            if match:
                return match.group(1).strip()
        match = self._CLIENT_PATTERN.search(text)
        if match:
            raw = match.group(1).strip()
            if trim_before_desc:
                # Couper avant un mot-clé de description : "Mohamed Sahli réparation moteur" → "Mohamed Sahli"
                for kw in self._DESC_START_KEYWORDS:
                    m = re.search(kw, raw, re.IGNORECASE)
                    if m:
                        before = raw[:m.start()].strip()
                        if len(before) >= 2:
                            return before
            return raw
        # Fallback: premier mot qui ressemble à un prénom (lettre majuscule, pas un mot-clé)
        skip_words = {"facture", "devis", "client", "paiement", "payé", "paye", "réglé", "règle", "pour", "dt", "dinar", "tnd", "rappeler", "rapport"}
        words = text.split()
        for w in words:
            if w and w[0:1].isupper() and w.lower() not in skip_words and len(w) >= 2:
                return w
        return None

    def _extract_description(self, text: str) -> Optional[str]:
        match = self._DESC_PATTERN.search(text)
        return match.group(1).strip() if match else None

    def _extract_create_client_entities(self, text: str) -> Dict[str, Any]:
        """Extrait first_name, last_name, display_name pour create_client."""
        match = self._CREATE_CLIENT_NAME_PATTERN.search(text)
        if not match:
            return {}
        raw = match.group(1).strip()
        if not raw:
            return {}
        parts = raw.split(None, 1)
        first_name = parts[0] if parts else ""
        last_name = parts[1] if len(parts) > 1 else None
        display_name = raw
        return {"first_name": first_name, "last_name": last_name, "display_name": display_name}

    def _extract_sale_entities(self, text: str) -> Dict[str, Any]:
        """Extrait quantity, product_ref, unit_price, client_name pour register_sale."""
        entities = {}
        match = self._SALE_QUANTITY_PRODUCT_PATTERN.search(text)
        if match:
            try:
                entities["quantity"] = float(match.group(1).replace(" ", "").replace(",", "."))
            except ValueError:
                pass
            entities["product_ref"] = match.group(2).strip()
        amount = self._extract_amount(text)
        if amount and "quantity" in entities:
            entities["unit_price"] = amount
        elif amount and "quantity" not in entities:
            entities["quantity"] = 1.0
            entities["unit_price"] = amount
        match_pour = self._SALE_POUR_PATTERN.search(text)
        if match_pour:
            entities["client_name"] = match_pour.group(1).strip()
        return entities

    def _extract_purchase_entities(self, text: str) -> Dict[str, Any]:
        """Extrait quantity, product_ref, unit_price, supplier_name pour register_purchase."""
        entities = {}
        match = self._PURCHASE_QUANTITY_PRODUCT_PATTERN.search(text)
        if match:
            try:
                entities["quantity"] = float(match.group(1).replace(" ", "").replace(",", "."))
            except ValueError:
                pass
            entities["product_ref"] = match.group(2).strip()
        amount = self._extract_amount(text)
        if amount and "quantity" in entities:
            entities["unit_price"] = amount
        elif amount and "quantity" not in entities:
            entities["quantity"] = 1.0
            entities["unit_price"] = amount
        match_chez = self._PURCHASE_CHEZ_PATTERN.search(text)
        if match_chez:
            entities["supplier_name"] = match_chez.group(1).strip()
        return entities

    def _extract_create_supplier_entities(self, text: str) -> Dict[str, Any]:
        """Extrait first_name, supplier_type, currency pour create_supplier."""
        match = self._CREATE_SUPPLIER_NAME_PATTERN.search(text)
        if not match:
            return {}
        raw = match.group(1).strip()
        if not raw:
            return {}
        entities = {}
        t = raw.lower()
        if "particulier" in t:
            entities["supplier_type"] = "particulier"
        if "entreprise" in t:
            entities["supplier_type"] = "entreprise"
        if any(x in t for x in ["dinar", "dinars", "dt", "tnd"]):
            entities["currency"] = "TND"
        name_part = re.sub(r",?\s*(particulier|entreprise|devise|en\s*dinars?|dt|tnd).*", "", raw, flags=re.IGNORECASE).strip()
        name_part = re.sub(r",\s*", " ", name_part).strip()
        parts = name_part.split(None, 1)
        entities["first_name"] = parts[0] if parts else ""
        if len(parts) > 1:
            entities["last_name"] = parts[1]
        entities["display_name"] = name_part or entities.get("first_name", "")
        return entities

    def _detect_intent(self, text: str) -> ChatbotIntent:
        t = text.lower()
        # Ordre de priorité : paiement avant facture (pour ne pas confondre "Ali a payé" avec facture)
        if self._match_any(t, self._PAYMENT_PATTERNS):
            return ChatbotIntent.REGISTER_PAYMENT
        if self._match_any(t, self._CREATE_CLIENT_PATTERNS):
            return ChatbotIntent.CREATE_CLIENT
        if self._match_any(t, self._CREATE_SUPPLIER_PATTERNS):
            return ChatbotIntent.CREATE_SUPPLIER
        # Ventes du jour / rapport jour = daily_summary (avant PURCHASE/SALE pour éviter confusion)
        if self._match_any(t, self._SUMMARY_PATTERNS):
            return ChatbotIntent.DAILY_SUMMARY
        if self._match_any(t, self._PURCHASE_PATTERNS):
            return ChatbotIntent.REGISTER_PURCHASE
        if self._match_any(t, self._SALE_PATTERNS):
            return ChatbotIntent.REGISTER_SALE
        if self._match_any(t, self._INVOICE_PATTERNS):
            return ChatbotIntent.CREATE_INVOICE
        if self._match_any(t, self._QUOTE_PATTERNS):
            return ChatbotIntent.CREATE_QUOTE
        if self._match_any(t, self._REMINDER_PATTERNS):
            return ChatbotIntent.SEND_REMINDER
        if self._match_any(t, self._UNPAID_PATTERNS):
            return ChatbotIntent.LIST_UNPAID
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
        client_name = self._extract_client_name(text, intent=intent)
        description = self._extract_description(text)

        if amount:
            entities["amount"] = amount
        if client_name:
            entities["client_name"] = client_name
        if description:
            entities["description"] = description

        if intent == ChatbotIntent.CREATE_CLIENT:
            entities.update(self._extract_create_client_entities(text))
        elif intent == ChatbotIntent.CREATE_SUPPLIER:
            entities.update(self._extract_create_supplier_entities(text))
        elif intent == ChatbotIntent.REGISTER_PURCHASE:
            entities.update(self._extract_purchase_entities(text))
        elif intent == ChatbotIntent.REGISTER_SALE:
            entities.update(self._extract_sale_entities(text))

        # Vérification des champs requis par intention
        if intent == ChatbotIntent.CREATE_CLIENT:
            if not entities.get("first_name"):
                missing.append("first_name")
        elif intent == ChatbotIntent.CREATE_SUPPLIER:
            if not entities.get("first_name"):
                missing.append("first_name")
        elif intent == ChatbotIntent.REGISTER_PURCHASE:
            if not entities.get("quantity") and not entities.get("product_ref"):
                missing.append("quantity")
                missing.append("product_ref")
            elif not entities.get("product_ref"):
                missing.append("product_ref")
            elif not entities.get("quantity"):
                missing.append("quantity")
        elif intent == ChatbotIntent.REGISTER_SALE:
            if not entities.get("quantity") and not entities.get("product_ref"):
                missing.append("quantity")
                missing.append("product_ref")
            elif not entities.get("product_ref"):
                missing.append("product_ref")
            elif not entities.get("quantity"):
                missing.append("quantity")
        elif intent == ChatbotIntent.CREATE_INVOICE:
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
                "amount": "le montant (ex: 250 dt)",
                "client_name": "le nom complet du client (ex: Mohamed Sahli)",
                "description": "la description (ex: réparation moteur)",
                "first_name": "le nom du client ou fournisseur (ex: Nouveau client Ahmed ben ali)",
                "quantity": "la quantité (ex: 50)",
                "product_ref": "la référence ou nom de l'article (ex: Article 2)",
            }
            examples = {
                "amount": "facture 250 dt pour Mohamed Sahli réparation moteur",
                "client_name": "facture 250 dt pour Mohamed Sahli réparation moteur",
                "description": "facture 250 dt pour Ahmed installation clim",
                "first_name": "Nouveau client Ahmed ben ali",
                "quantity": "Achat 50 Article 2 à 80 dt chez Pathé",
                "product_ref": "Achat 50 Article 2 à 80 dt chez Pathé",
            }
            missing_str = ", ".join(labels.get(f, f) for f in missing)
            ex = examples.get(missing[0], "facture 250 dt pour Mohamed Sahli réparation moteur") if missing else ""
            return f"Il manque : {missing_str}. Exemple : « {ex} »"

        client = entities.get("client_name", "")
        amount = entities.get("amount", "")
        desc = entities.get("description", "")

        client_display = entities.get("display_name") or entities.get("first_name", "")
        responses = {
            ChatbotIntent.CREATE_INVOICE: f"Création d'une facture de {amount} DT pour {client} — {desc}",
            ChatbotIntent.CREATE_QUOTE: f"Création d'un devis de {amount} DT pour {client}",
            ChatbotIntent.CREATE_CLIENT: f"Création d'un nouveau client : {client_display}",
            ChatbotIntent.CREATE_SUPPLIER: f"Création d'un nouveau fournisseur : {client_display}",
            ChatbotIntent.REGISTER_PURCHASE: f"Achat de {entities.get('quantity', '?')} x {entities.get('product_ref', '?')}" + (f" à {entities.get('unit_price', 0):,.3f} dt" if entities.get("unit_price") else "") + (f" chez {entities.get('supplier_name', '')}" if entities.get("supplier_name") else ""),
            ChatbotIntent.REGISTER_SALE: f"Vente de {entities.get('quantity', '?')} x {entities.get('product_ref', '?')}" + (f" à {entities.get('unit_price', 0):,.3f} dt" if entities.get("unit_price") else "") + (f" pour {entities.get('client_name', '')}" if entities.get("client_name") else ""),
            ChatbotIntent.CONSULT_CLIENT: f"Consultation de la fiche client : {client}",
            ChatbotIntent.LIST_UNPAID: "Récupération des factures impayées…",
            ChatbotIntent.REGISTER_PAYMENT: f"Enregistrement d'un paiement de {amount} DT pour {client}",
            ChatbotIntent.SEND_REMINDER: f"Envoi d'un rappel à {client}",
            ChatbotIntent.DAILY_SUMMARY: "Récupération du rapport journalier…",
            ChatbotIntent.UNKNOWN: "Commande non reconnue. Consultez les commandes rapides à droite ou cliquez sur une des suggestions ci-dessous pour essayer.",
        }
        return responses.get(intent, "")


# Singleton accessible depuis les routes
chatbot_parser = ChatbotParser()
