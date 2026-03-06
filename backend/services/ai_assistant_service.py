"""
Module E - AI-Ready Service Hooks
Interface propre pour les futurs modules IA.
Implémentations mock pour l'instant — remplaçables par des appels LLM/OCR.
Architecture : chaque méthode est une interface stable, la logique IA peut évoluer
indépendamment sans casser les routes qui l'appellent.
"""

import re
import logging
from typing import Optional, Dict, Any, List
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class AIActionType(str, Enum):
    PARSE_INVOICE_TEXT = "parse_invoice_text"
    OCR_SUPPLIER_INVOICE = "ocr_supplier_invoice"
    SUGGEST_REMINDER_TEXT = "suggest_reminder_text"
    CUSTOMER_FOLLOWUP = "customer_followup"
    CATEGORIZE_EXPENSE = "categorize_expense"
    DETECT_DUPLICATE = "detect_duplicate"


@dataclass
class AIResult:
    action: AIActionType
    success: bool
    data: Dict[str, Any] = field(default_factory=dict)
    confidence: float = 0.0
    is_mock: bool = True
    warnings: List[str] = field(default_factory=list)


class AIAssistantService:
    """
    Service IA centralisé. Toutes les méthodes retournent un AIResult standardisé.

    Pour connecter un LLM réel (OpenAI, Gemini, etc.) :
    1. Remplacer le corps de la méthode correspondante
    2. Conserver la signature (paramètres + type de retour AIResult)
    3. Mettre is_mock=False dans le résultat

    Note : le module google-generativeai est déjà dans requirements.txt.
    """

    # ──────────────────────────────────────────────
    # 1. Parse d'une facture depuis texte libre
    # ──────────────────────────────────────────────

    async def parse_invoice_from_text(self, text: str) -> AIResult:
        """
        Extrait les données structurées d'une facture depuis du texte libre.
        Ex: "Facture Ali Ben Salah 3 500 DT 19% TVA matériel informatique 30/01/2025"

        TODO: Remplacer le mock par un appel LLM (Gemini/OpenAI) avec prompt structuré.
        """
        # Mock : extraction par regex basique
        amount_match = re.search(r"(\d[\d\s,\.]+)\s*(dt|dinar|tnd|eur|€|usd)?", text, re.IGNORECASE)
        vat_match = re.search(r"(\d+)\s*%\s*(?:tva|taxe)?", text, re.IGNORECASE)
        date_match = re.search(r"(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4})", text)
        name_match = re.search(r"(?:pour|client|de)\s+([A-Za-zÀ-ÿ\s]{3,40}?)(?:\s+\d|\s*$)", text, re.IGNORECASE)

        amount_raw = amount_match.group(1).replace(" ", "").replace(",", ".") if amount_match else None
        amount = float(amount_raw) if amount_raw else None
        vat_rate = float(vat_match.group(1)) if vat_match else 19.0

        data = {
            "customer_name": name_match.group(1).strip() if name_match else None,
            "amount_ht": round(amount / (1 + vat_rate / 100), 3) if amount else None,
            "amount_ttc": amount,
            "vat_rate": vat_rate,
            "date": date_match.group(1) if date_match else None,
            "description": text[:200],
        }

        missing = [k for k, v in data.items() if v is None and k in ("customer_name", "amount_ttc")]
        confidence = max(0.2, 1.0 - len(missing) * 0.3)

        return AIResult(
            action=AIActionType.PARSE_INVOICE_TEXT,
            success=len(missing) == 0,
            data=data,
            confidence=confidence,
            is_mock=True,
            warnings=["Résultat basé sur regex — connectez un LLM pour plus de précision"] if missing else []
        )

    # ──────────────────────────────────────────────
    # 2. OCR Facture fournisseur (image/PDF)
    # ──────────────────────────────────────────────

    async def ocr_supplier_invoice(
        self,
        file_content: bytes,
        file_type: str = "pdf"
    ) -> AIResult:
        """
        Extrait les données d'une facture fournisseur depuis un fichier image/PDF.
        Mock retourne une structure vide avec instructions pour intégration OCR.

        TODO: Intégrer Google Vision API, AWS Textract, ou Azure Form Recognizer.
        """
        logger.info(f"OCR demandé pour fichier de type {file_type}, taille {len(file_content)} bytes")

        return AIResult(
            action=AIActionType.OCR_SUPPLIER_INVOICE,
            success=False,
            data={
                "supplier_name": None,
                "invoice_number": None,
                "date": None,
                "total_ht": None,
                "total_ttc": None,
                "vat_amount": None,
                "items": [],
            },
            confidence=0.0,
            is_mock=True,
            warnings=[
                "OCR non connecté. Pour activer, intégrez Google Vision API ou AWS Textract.",
                "Installez google-cloud-vision ou boto3 (déjà dans requirements.txt pour boto3)."
            ]
        )

    # ──────────────────────────────────────────────
    # 3. Suggestion de texte de rappel
    # ──────────────────────────────────────────────

    async def suggest_reminder_text(
        self,
        customer_name: str,
        amount: float,
        days_overdue: int,
        currency: str = "TND",
        tone: str = "professional"   # professional, friendly, firm
    ) -> AIResult:
        """
        Suggère un texte de rappel personnalisé selon le contexte.
        Mock : templates pré-définis par tone et niveau de retard.

        TODO: Remplacer par appel LLM pour personnalisation avancée.
        """
        if days_overdue == 0:
            prefix = "Nous vous rappelons que"
            urgency = ""
        elif days_overdue <= 7:
            prefix = "Nous attirons votre attention sur le fait que"
            urgency = " Merci de régulariser dès que possible."
        elif days_overdue <= 30:
            prefix = "Malgré nos précédents rappels,"
            urgency = " Nous vous demandons de régulariser immédiatement."
        else:
            prefix = "À défaut de règlement dans les 48h,"
            urgency = " nous serons contraints d'engager une procédure de recouvrement."

        tone_styles = {
            "friendly": f"Bonjour {customer_name} ! {prefix} votre facture de {amount:,.3f} {currency} est en attente. {urgency}",
            "professional": f"Bonjour {customer_name}, {prefix} votre facture de {amount:,.3f} {currency} (retard : {days_overdue} jours) est en attente de règlement.{urgency}",
            "firm": f"{customer_name}, {prefix} la somme de {amount:,.3f} {currency} reste due depuis {days_overdue} jours.{urgency}",
        }

        suggested = tone_styles.get(tone, tone_styles["professional"])

        return AIResult(
            action=AIActionType.SUGGEST_REMINDER_TEXT,
            success=True,
            data={
                "suggested_text": suggested,
                "tone": tone,
                "days_overdue": days_overdue,
                "customer_name": customer_name,
                "amount": amount,
                "currency": currency,
                "alternatives": list(tone_styles.values()),
            },
            confidence=0.75,
            is_mock=True,
            warnings=["Texte généré par template — connectez un LLM pour personnalisation avancée"]
        )

    # ──────────────────────────────────────────────
    # 4. Suivi client (analyse du portefeuille)
    # ──────────────────────────────────────────────

    async def customer_followup_analysis(
        self,
        customer_data: Dict[str, Any]
    ) -> AIResult:
        """
        Analyse le profil de paiement d'un client et suggère des actions de suivi.
        Mock : règles heuristiques basiques.

        TODO: Remplacer par modèle ML de prédiction de paiement.
        """
        balance = customer_data.get("balance_due", 0)
        invoice_count = customer_data.get("invoice_count", 0)
        days_overdue = customer_data.get("max_days_overdue", 0)
        payment_history = customer_data.get("payment_history", [])

        # Calcul du score de risque (0-100, 100 = risque max)
        risk_score = 0
        if balance > 5000:
            risk_score += 40
        elif balance > 1000:
            risk_score += 20

        if days_overdue > 60:
            risk_score += 40
        elif days_overdue > 30:
            risk_score += 25
        elif days_overdue > 7:
            risk_score += 10

        if invoice_count > 5:
            risk_score += 10

        risk_level = "high" if risk_score >= 60 else "medium" if risk_score >= 30 else "low"

        actions = []
        if risk_level == "high":
            actions = ["Relance formelle immédiate", "Blocage nouvelles commandes", "Contact téléphonique"]
        elif risk_level == "medium":
            actions = ["Rappel par email", "Proposition de paiement échelonné"]
        else:
            actions = ["Rappel de courtoisie"]

        return AIResult(
            action=AIActionType.CUSTOMER_FOLLOWUP,
            success=True,
            data={
                "risk_score": risk_score,
                "risk_level": risk_level,
                "recommended_actions": actions,
                "balance_due": balance,
                "days_overdue": days_overdue,
            },
            confidence=0.65,
            is_mock=True,
            warnings=["Analyse basée sur heuristiques — connectez un modèle ML pour plus de précision"]
        )

    # ──────────────────────────────────────────────
    # 5. Catégorisation automatique d'une dépense
    # ──────────────────────────────────────────────

    async def categorize_expense(self, description: str, amount: float) -> AIResult:
        """
        Suggère une catégorie comptable pour une dépense depuis sa description.
        Mock : dictionnaire de mots-clés.

        TODO: Remplacer par classification LLM.
        """
        keywords = {
            "loyer": ["loyer", "location", "bail", "immeuble"],
            "transport": ["carburant", "essence", "taxi", "transport", "voiture", "auto"],
            "informatique": ["ordinateur", "logiciel", "serveur", "cloud", "hébergement", "internet"],
            "fournitures": ["papier", "stylo", "bureau", "fourniture", "papeterie"],
            "restauration": ["repas", "déjeuner", "restaurant", "dîner", "café"],
            "communication": ["téléphone", "mobile", "abonnement", "box"],
            "formation": ["formation", "cours", "séminaire", "conférence"],
            "salaires": ["salaire", "rémunération", "prime", "congé"],
            "charges_sociales": ["cnss", "cnam", "charges sociales", "cotisation"],
        }

        desc_lower = description.lower()
        detected = None
        for category, words in keywords.items():
            if any(w in desc_lower for w in words):
                detected = category
                break

        return AIResult(
            action=AIActionType.CATEGORIZE_EXPENSE,
            success=detected is not None,
            data={
                "suggested_category": detected or "divers",
                "description": description,
                "amount": amount,
                "confidence_note": "Catégorie suggérée automatiquement — vérifiez avant validation"
            },
            confidence=0.70 if detected else 0.20,
            is_mock=True,
        )

    # ──────────────────────────────────────────────
    # 6. Détection de doublons
    # ──────────────────────────────────────────────

    async def detect_duplicate_invoice(
        self,
        existing_invoices: List[Dict],
        new_invoice: Dict
    ) -> AIResult:
        """
        Détecte si une nouvelle facture est un doublon probable.
        Mock : comparaison exacte montant + client + date proximité.
        """
        new_amount = new_invoice.get("total", 0)
        new_customer = new_invoice.get("customer_id", "")

        duplicates = []
        for inv in existing_invoices:
            if (
                inv.get("customer_id") == new_customer
                and abs(inv.get("total", 0) - new_amount) < 0.01
            ):
                duplicates.append({
                    "invoice_id": inv.get("id"),
                    "number": inv.get("number"),
                    "similarity": "montant et client identiques"
                })

        return AIResult(
            action=AIActionType.DETECT_DUPLICATE,
            success=True,
            data={
                "is_duplicate": len(duplicates) > 0,
                "duplicates_found": duplicates,
            },
            confidence=0.85 if duplicates else 1.0,
            is_mock=True,
        )


# Singleton
ai_assistant = AIAssistantService()
