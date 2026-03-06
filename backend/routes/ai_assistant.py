"""
Module E - AI-Ready Service Routes
Endpoints pour les hooks IA. Tous retournent is_mock=True jusqu'à intégration LLM réelle.
"""

from fastapi import APIRouter, Depends, Query, HTTPException, UploadFile, File
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from typing import Optional, List
from pydantic import BaseModel, Field
import os

from utils.dependencies import get_current_user, get_current_company
from services.ai_assistant_service import ai_assistant

router = APIRouter(prefix="/api/ai", tags=["AI Assistant"])

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'easybill')]


# ─────────────────────────────────────────────
# Schemas
# ─────────────────────────────────────────────

class ParseInvoiceTextRequest(BaseModel):
    text: str = Field(..., min_length=5, max_length=2000)


class SuggestReminderRequest(BaseModel):
    customer_name: str
    amount: float = Field(..., gt=0)
    days_overdue: int = Field(0, ge=0)
    currency: str = "TND"
    tone: str = Field("professional", description="professional | friendly | firm")


class CategorizeExpenseRequest(BaseModel):
    description: str = Field(..., min_length=3)
    amount: float = Field(..., gt=0)


class CustomerFollowupRequest(BaseModel):
    customer_id: str


# ─────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────

@router.get("/status")
async def ai_status():
    """Retourne le statut du module IA (mock vs réel)."""
    return {
        "status": "operational",
        "mode": "mock",
        "available_actions": [
            "parse_invoice_text",
            "ocr_supplier_invoice",
            "suggest_reminder_text",
            "customer_followup",
            "categorize_expense",
            "detect_duplicate",
        ],
        "note": "Toutes les actions retournent is_mock=True. Connectez un LLM pour activer l'IA réelle.",
        "llm_ready": False,
        "ocr_ready": False,
    }


@router.post("/parse-invoice")
async def parse_invoice_from_text(
    data: ParseInvoiceTextRequest,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Extrait les données structurées d'une facture depuis du texte libre.
    Exemple : 'Ali 3500 DT TVA 19% installation réseau 15/01/2025'
    """
    await get_current_company(current_user, company_id)
    result = await ai_assistant.parse_invoice_from_text(data.text)
    return {
        "action": result.action,
        "success": result.success,
        "data": result.data,
        "confidence": result.confidence,
        "is_mock": result.is_mock,
        "warnings": result.warnings,
    }


@router.post("/ocr-invoice")
async def ocr_supplier_invoice(
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user),
    file: UploadFile = File(..., description="PDF ou image de la facture fournisseur")
):
    """
    Extrait les données d'une facture fournisseur par OCR.
    (Mock — à connecter à Google Vision / AWS Textract)
    """
    await get_current_company(current_user, company_id)
    content = await file.read()
    file_type = file.content_type or "application/octet-stream"
    result = await ai_assistant.ocr_supplier_invoice(content, file_type)
    return {
        "action": result.action,
        "success": result.success,
        "data": result.data,
        "confidence": result.confidence,
        "is_mock": result.is_mock,
        "warnings": result.warnings,
    }


@router.post("/suggest-reminder")
async def suggest_reminder_text(
    data: SuggestReminderRequest,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Génère un texte de rappel personnalisé selon le contexte."""
    await get_current_company(current_user, company_id)
    result = await ai_assistant.suggest_reminder_text(
        customer_name=data.customer_name,
        amount=data.amount,
        days_overdue=data.days_overdue,
        currency=data.currency,
        tone=data.tone
    )
    return {
        "action": result.action,
        "success": result.success,
        "data": result.data,
        "confidence": result.confidence,
        "is_mock": result.is_mock,
        "warnings": result.warnings,
    }


@router.post("/customer-followup")
async def customer_followup(
    data: CustomerFollowupRequest,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Analyse le profil de paiement d'un client et recommande des actions."""
    await get_current_company(current_user, company_id)

    # Calcul des données client depuis la base
    customer = await db.customers.find_one({
        "_id": ObjectId(data.customer_id),
        "company_id": ObjectId(company_id)
    })
    if not customer:
        raise HTTPException(status_code=404, detail="Client introuvable")

    # Agrégation des factures impayées
    from datetime import datetime, timezone
    unpaid = await db.invoices.find({
        "company_id": ObjectId(company_id),
        "customer_id": ObjectId(data.customer_id),
        "balance_due": {"$gt": 0}
    }).to_list(200)

    max_overdue = 0
    for inv in unpaid:
        due = inv.get("due_date")
        if isinstance(due, datetime):
            days = max(0, (datetime.now(timezone.utc) - due.replace(tzinfo=timezone.utc)).days)
            max_overdue = max(max_overdue, days)

    customer_data = {
        "customer_id": data.customer_id,
        "name": customer.get("display_name"),
        "balance_due": sum(inv.get("balance_due", 0) for inv in unpaid),
        "invoice_count": len(unpaid),
        "max_days_overdue": max_overdue,
    }

    result = await ai_assistant.customer_followup_analysis(customer_data)
    return {
        "customer": {
            "id": data.customer_id,
            "name": customer.get("display_name"),
        },
        "action": result.action,
        "success": result.success,
        "data": result.data,
        "confidence": result.confidence,
        "is_mock": result.is_mock,
        "warnings": result.warnings,
    }


@router.post("/categorize-expense")
async def categorize_expense(
    data: CategorizeExpenseRequest,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Suggère une catégorie comptable pour une dépense."""
    await get_current_company(current_user, company_id)
    result = await ai_assistant.categorize_expense(data.description, data.amount)
    return {
        "action": result.action,
        "success": result.success,
        "data": result.data,
        "confidence": result.confidence,
        "is_mock": result.is_mock,
    }


@router.post("/detect-duplicate")
async def detect_duplicate(
    new_invoice: dict,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Vérifie si une facture en cours de création est un doublon probable."""
    await get_current_company(current_user, company_id)

    existing = await db.invoices.find({
        "company_id": ObjectId(company_id),
        "customer_id": ObjectId(new_invoice.get("customer_id", "")) if new_invoice.get("customer_id") else None,
    }).limit(100).to_list(100)

    existing_simple = [{"id": str(inv["_id"]), "number": inv.get("number"), "total": inv.get("total", 0), "customer_id": str(inv.get("customer_id", ""))} for inv in existing]
    result = await ai_assistant.detect_duplicate_invoice(existing_simple, new_invoice)

    return {
        "action": result.action,
        "success": result.success,
        "data": result.data,
        "confidence": result.confidence,
        "is_mock": result.is_mock,
    }
