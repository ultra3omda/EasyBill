"""
Module D - Reminder Engine (Routes)
Étend les routes rappels existantes avec le moteur intelligent.
"""

from fastapi import APIRouter, Depends, Query, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime, timezone
from typing import Optional, List
from pydantic import BaseModel, Field
import os

from utils.dependencies import get_current_user, get_current_company
from services.reminder_engine import ReminderEngine

router = APIRouter(prefix="/api/reminder-engine", tags=["Reminder Engine"])

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'easybill')]


class ReminderRuleCreate(BaseModel):
    name: str
    trigger: str = Field(..., description="before_due | on_due | after_due")
    days_offset: int = Field(0, description="Négatif = avant, positif = après l'échéance")
    level: int = Field(1, ge=1, le=10)
    channels: List[str] = ["email"]
    is_active: bool = True


class ReminderTemplateCreate(BaseModel):
    name: str
    level: int = Field(1, ge=1)
    trigger: str = "after_due"
    subject: str
    body_email: str
    body_sms: Optional[str] = None
    body_whatsapp: Optional[str] = None
    is_active: bool = True


def _get_engine() -> ReminderEngine:
    return ReminderEngine(db)


# ─────────────────────────────────────────────
# Initialisation
# ─────────────────────────────────────────────

@router.post("/initialize")
async def initialize_reminder_defaults(
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Initialise les règles et templates de rappel par défaut pour l'entreprise."""
    await get_current_company(current_user, company_id)
    engine = _get_engine()
    return await engine.initialize_defaults(company_id)


# ─────────────────────────────────────────────
# Règles
# ─────────────────────────────────────────────

@router.get("/rules")
async def list_reminder_rules(
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Liste les règles de rappel de l'entreprise."""
    await get_current_company(current_user, company_id)
    rules = await db.reminder_rules.find(
        {"company_id": ObjectId(company_id)}
    ).sort("level", 1).to_list(50)
    for r in rules:
        r["id"] = str(r["_id"])
        del r["_id"]
        r["company_id"] = str(r.get("company_id", ""))
    return rules


@router.post("/rules", status_code=201)
async def create_reminder_rule(
    data: ReminderRuleCreate,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Crée une règle de rappel personnalisée."""
    await get_current_company(current_user, company_id)
    doc = {
        **data.dict(),
        "company_id": ObjectId(company_id),
        "created_at": datetime.now(timezone.utc)
    }
    result = await db.reminder_rules.insert_one(doc)
    return {"id": str(result.inserted_id), "message": "Règle créée"}


@router.put("/rules/{rule_id}")
async def update_reminder_rule(
    rule_id: str,
    data: ReminderRuleCreate,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)
    update = {**data.dict(), "updated_at": datetime.now(timezone.utc)}
    await db.reminder_rules.update_one(
        {"_id": ObjectId(rule_id), "company_id": ObjectId(company_id)},
        {"$set": update}
    )
    return {"message": "Règle mise à jour"}


@router.delete("/rules/{rule_id}")
async def delete_reminder_rule(
    rule_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)
    await db.reminder_rules.delete_one(
        {"_id": ObjectId(rule_id), "company_id": ObjectId(company_id)}
    )
    return {"message": "Règle supprimée"}


# ─────────────────────────────────────────────
# Templates
# ─────────────────────────────────────────────

@router.get("/templates")
async def list_reminder_templates_v2(
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Liste les templates de rappel (moteur v2)."""
    await get_current_company(current_user, company_id)
    templates = await db.reminder_templates_v2.find(
        {"company_id": ObjectId(company_id)}
    ).sort("level", 1).to_list(50)
    for t in templates:
        t["id"] = str(t["_id"])
        del t["_id"]
        t["company_id"] = str(t.get("company_id", ""))
    return templates


@router.post("/templates", status_code=201)
async def create_reminder_template_v2(
    data: ReminderTemplateCreate,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)
    doc = {
        **data.dict(),
        "company_id": ObjectId(company_id),
        "created_at": datetime.now(timezone.utc)
    }
    result = await db.reminder_templates_v2.insert_one(doc)
    return {"id": str(result.inserted_id), "message": "Template créé"}


# ─────────────────────────────────────────────
# Détection & Envoi
# ─────────────────────────────────────────────

@router.get("/detect")
async def detect_invoices_to_remind(
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Analyse les factures et retourne celles qui nécessitent un rappel aujourd'hui.
    Ne crée pas encore de rappel — prévisualisation uniquement.
    """
    await get_current_company(current_user, company_id)
    engine = _get_engine()
    items = await engine.detect_invoices_to_remind(company_id)
    return {"count": len(items), "items": items}


@router.post("/generate-payload/{invoice_id}")
async def generate_reminder_payload(
    invoice_id: str,
    level: int = Query(1, ge=1),
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Génère les payloads email, SMS et WhatsApp pour un rappel.
    Utilisé pour prévisualiser ou envoyer via service externe.
    """
    company = await get_current_company(current_user, company_id)
    engine = _get_engine()

    # Récupère les infos de l'entreprise
    fiscal = company.get("fiscal_settings") or {}
    currency = fiscal.get("currency", company.get("primary_currency", "TND"))

    return await engine.generate_reminder_payloads(
        company_id=company_id,
        invoice_id=invoice_id,
        level=level,
        company_name=company.get("name", ""),
        company_phone=company.get("address", {}).get("phone", "") if company.get("address") else "",
        currency=currency
    )


@router.post("/process")
async def process_reminders_now(
    company_id: str = Query(...),
    dry_run: bool = Query(False, description="Si True, simule sans créer de logs"),
    current_user: dict = Depends(get_current_user)
):
    """
    Déclenche le traitement des rappels pour l'entreprise.
    Détecte les factures à relancer et crée les logs correspondants.
    """
    await get_current_company(current_user, company_id)
    engine = _get_engine()

    items = await engine.detect_invoices_to_remind(company_id)
    logged = 0

    if not dry_run:
        for item in items:
            for channel in item.get("channels", ["email"]):
                await engine.log_reminder_sent(
                    company_id=company_id,
                    invoice_id=item["invoice_id"],
                    level=item["level"],
                    channel=channel,
                    status="pending"
                )
                logged += 1

    return {
        "reminders_detected": len(items),
        "reminders_queued": logged if not dry_run else 0,
        "dry_run": dry_run,
        "items": items
    }


# ─────────────────────────────────────────────
# Historique
# ─────────────────────────────────────────────

@router.get("/logs")
async def get_reminder_logs(
    company_id: str = Query(...),
    invoice_id: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
    current_user: dict = Depends(get_current_user)
):
    """Historique des rappels envoyés."""
    await get_current_company(current_user, company_id)
    engine = _get_engine()
    return await engine.get_reminder_logs(company_id, invoice_id, limit)
