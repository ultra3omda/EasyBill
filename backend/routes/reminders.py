from fastapi import APIRouter, HTTPException, status, Depends, Query, Request
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime, timezone
import os
from typing import Optional, List
from pydantic import BaseModel
from models.reminder import Reminder, ReminderCreate, ReminderUpdate
from utils.dependencies import get_current_user, get_current_company
from utils.helpers import generate_document_number
from services.reminder_service import ReminderService

router = APIRouter(prefix="/api/reminders", tags=["Reminders"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]


def serialize_reminder(r: dict) -> dict:
    """Serialize reminder document for JSON response."""
    return {
        "id": str(r["_id"]),
        "company_id": str(r.get("company_id")) if r.get("company_id") else None,
        "customer_id": str(r.get("customer_id")) if r.get("customer_id") else None,
        "customer_name": r.get("customer_name", ""),
        "number": r.get("number"),
        "date": r["date"].isoformat() if isinstance(r.get("date"), datetime) else r.get("date"),
        "invoice_ids": [str(i) for i in r.get("invoice_ids", [])],
        "invoices": r.get("invoices", []),
        "level": r.get("level", 1),
        "total_due": r.get("total_due", 0),
        "late_fees": r.get("late_fees", 0),
        "message": r.get("message"),
        "status": r.get("status", "draft"),
        "sent_at": r["sent_at"].isoformat() if isinstance(r.get("sent_at"), datetime) else r.get("sent_at"),
        "sent_via": r.get("sent_via"),
        "response_date": r["response_date"].isoformat() if isinstance(r.get("response_date"), datetime) else r.get("response_date"),
        "response_notes": r.get("response_notes"),
        "next_reminder_date": r["next_reminder_date"].isoformat() if isinstance(r.get("next_reminder_date"), datetime) else r.get("next_reminder_date"),
        "created_at": r["created_at"].isoformat() if isinstance(r.get("created_at"), datetime) else r.get("created_at"),
        "updated_at": r["updated_at"].isoformat() if isinstance(r.get("updated_at"), datetime) else r.get("updated_at")
    }


async def log_action(company_id, user_id, user_name, action, element, ip_address=None):
    await db.access_logs.insert_one({
        "company_id": ObjectId(company_id),
        "user_id": ObjectId(user_id),
        "user_name": user_name,
        "category": "Rappel",
        "action": action,
        "element": element,
        "ip_address": ip_address,
        "created_at": datetime.now(timezone.utc)
    })


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_reminder(
    data: ReminderCreate,
    request: Request,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    # Generate reminder number
    count = await db.reminders.count_documents({"company_id": ObjectId(company_id)})
    number = f"RAP-{datetime.now().year}-{count + 1:04d}"
    
    # Calculate total due from invoices
    total_due = 0
    invoice_ids = []
    for inv_id in data.invoice_ids:
        invoice = await db.invoices.find_one({"_id": ObjectId(inv_id)})
        if invoice:
            total_due += invoice.get("balance_due", 0)
            invoice_ids.append(ObjectId(inv_id))
    
    doc_dict = data.dict(exclude={'invoice_ids'})
    
    if isinstance(doc_dict.get('date'), str):
        doc_dict['date'] = datetime.fromisoformat(doc_dict['date'].replace('Z', '+00:00'))
    if isinstance(doc_dict.get('next_reminder_date'), str) and doc_dict.get('next_reminder_date'):
        doc_dict['next_reminder_date'] = datetime.fromisoformat(doc_dict['next_reminder_date'].replace('Z', '+00:00'))
    
    doc_dict.update({
        "company_id": ObjectId(company_id),
        "customer_id": ObjectId(data.customer_id),
        "number": number,
        "invoice_ids": invoice_ids,
        "total_due": total_due + data.late_fees,
        "status": "draft",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "created_by": current_user["_id"]
    })
    
    result = await db.reminders.insert_one(doc_dict)
    
    await log_action(company_id, str(current_user["_id"]), current_user.get("full_name", ""), "Créer", number, request.client.host if request.client else None)
    
    return {"id": str(result.inserted_id), "number": number, "message": "Reminder created"}


@router.get("/")
async def list_reminders(
    company_id: str = Query(...),
    search: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    query = {"company_id": ObjectId(company_id)}
    if search:
        query["$or"] = [
            {"number": {"$regex": search, "$options": "i"}}
        ]
    if status_filter:
        query["status"] = status_filter
    
    docs = await db.reminders.find(query).sort("created_at", -1).to_list(1000)
    
    for doc in docs:
        if doc.get("customer_id"):
            customer = await db.customers.find_one({"_id": doc["customer_id"]})
            doc["customer_name"] = customer.get("display_name", "Inconnu") if customer else "Inconnu"
        
        # Get invoice details
        invoices = []
        for inv_id in doc.get("invoice_ids", []):
            invoice = await db.invoices.find_one({"_id": inv_id})
            if invoice:
                invoices.append({
                    "id": str(invoice["_id"]),
                    "number": invoice.get("number"),
                    "total": invoice.get("total", 0),
                    "balance_due": invoice.get("balance_due", 0)
                })
        doc["invoices"] = invoices
    
    return [serialize_reminder(r) for r in docs]


# ==================== TEMPLATES DE RAPPELS ====================

class ReminderTemplateCreate(BaseModel):
    name: str
    subject: str
    body: str
    days_after_due: int
    reminder_level: int = 1
    is_active: bool = True


@router.get("/templates/list")
async def list_reminder_templates(
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Liste les templates de rappel"""
    templates = await db.reminder_templates.find({
        "company_id": ObjectId(company_id)
    }).sort("reminder_level", 1).to_list(None)
    
    for t in templates:
        t["id"] = str(t["_id"])
    
    return {"items": templates}


@router.post("/templates/create")
async def create_reminder_template(
    template: ReminderTemplateCreate,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Crée un nouveau template de rappel"""
    service = ReminderService(db)
    result = await service.create_reminder_template(
        company_id=company_id,
        name=template.name,
        subject=template.subject,
        body=template.body,
        days_after_due=template.days_after_due,
        reminder_level=template.reminder_level,
        is_active=template.is_active
    )
    return result


@router.post("/templates/initialize-defaults")
async def initialize_default_templates(
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Initialise les templates par défaut"""
    existing = await db.reminder_templates.count_documents({
        "company_id": ObjectId(company_id)
    })
    
    if existing > 0:
        raise HTTPException(status_code=400, detail="Des templates existent déjà")
    
    service = ReminderService(db)
    templates = await service.initialize_default_templates(company_id)
    
    return {
        "message": f"{len(templates)} templates créés",
        "templates": templates
    }


# ==================== FACTURES EN RETARD ====================

@router.get("/overdue-invoices")
async def get_overdue_invoices(
    company_id: str = Query(...),
    min_days_overdue: int = 0,
    max_days_overdue: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    """Liste les factures en retard"""
    service = ReminderService(db)
    invoices = await service.get_overdue_invoices(
        company_id=company_id,
        min_days_overdue=min_days_overdue,
        max_days_overdue=max_days_overdue
    )
    return {"items": invoices, "total": len(invoices)}


# ==================== ENVOI AUTOMATIQUE ====================

@router.post("/send-automatic/{invoice_id}")
async def send_automatic_reminder(
    invoice_id: str,
    template_id: Optional[str] = None,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Envoie un rappel automatique pour une facture"""
    service = ReminderService(db)
    try:
        result = await service.send_reminder(
            invoice_id=invoice_id,
            company_id=company_id,
            template_id=template_id
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/process-automatic")
async def process_automatic_reminders(
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Traite les rappels automatiques"""
    service = ReminderService(db)
    result = await service.process_automatic_reminders(company_id)
    return result


@router.get("/history")
async def get_reminder_history(
    company_id: str = Query(...),
    invoice_id: Optional[str] = None,
    customer_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Récupère l'historique des rappels envoyés"""
    service = ReminderService(db)
    result = await service.get_reminder_history(
        company_id=company_id,
        invoice_id=invoice_id,
        customer_id=customer_id,
        skip=skip,
        limit=limit
    )
    return result


@router.get("/{doc_id}")
async def get_reminder(
    doc_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    doc = await db.reminders.find_one({
        "_id": ObjectId(doc_id),
        "company_id": ObjectId(company_id)
    })
    
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reminder not found")
    
    if doc.get("customer_id"):
        customer = await db.customers.find_one({"_id": doc["customer_id"]})
        doc["customer_name"] = customer.get("display_name", "") if customer else ""
    
    return serialize_reminder(doc)


@router.put("/{doc_id}")
async def update_reminder(
    doc_id: str,
    data: ReminderUpdate,
    request: Request,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    existing = await db.reminders.find_one({"_id": ObjectId(doc_id)})
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reminder not found")
    
    update_data = {k: v for k, v in data.dict(exclude_unset=True).items()}
    
    if 'invoice_ids' in update_data and update_data['invoice_ids']:
        update_data['invoice_ids'] = [ObjectId(i) for i in update_data['invoice_ids']]
    
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.reminders.update_one(
        {"_id": ObjectId(doc_id), "company_id": ObjectId(company_id)},
        {"$set": update_data}
    )
    
    await log_action(company_id, str(current_user["_id"]), current_user.get("full_name", ""), "Modifier", existing.get("number", ""), request.client.host if request.client else None)
    
    return {"message": "Reminder updated"}


@router.delete("/{doc_id}")
async def delete_reminder(
    doc_id: str,
    request: Request,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    doc = await db.reminders.find_one({
        "_id": ObjectId(doc_id),
        "company_id": ObjectId(company_id)
    })
    
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reminder not found")
    
    await db.reminders.delete_one({"_id": ObjectId(doc_id)})
    
    await log_action(company_id, str(current_user["_id"]), current_user.get("full_name", ""), "Supprimer", doc.get("number", ""), request.client.host if request.client else None)
    
    return {"message": "Reminder deleted"}


@router.post("/{doc_id}/send")
async def send_reminder(
    doc_id: str,
    request: Request,
    company_id: str = Query(...),
    via: str = Query("email"),
    current_user: dict = Depends(get_current_user)
):
    """Mark reminder as sent"""
    company = await get_current_company(current_user, company_id)
    
    doc = await db.reminders.find_one({
        "_id": ObjectId(doc_id),
        "company_id": ObjectId(company_id)
    })
    
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reminder not found")
    
    await db.reminders.update_one(
        {"_id": ObjectId(doc_id)},
        {
            "$set": {
                "status": "sent",
                "sent_at": datetime.now(timezone.utc),
                "sent_via": via,
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    await log_action(company_id, str(current_user["_id"]), current_user.get("full_name", ""), "Envoyer", doc.get("number", ""), request.client.host if request.client else None)
    
    return {"message": "Reminder marked as sent"}


@router.post("/{doc_id}/resolve")
async def resolve_reminder(
    doc_id: str,
    request: Request,
    company_id: str = Query(...),
    notes: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """Mark reminder as resolved"""
    company = await get_current_company(current_user, company_id)
    
    doc = await db.reminders.find_one({
        "_id": ObjectId(doc_id),
        "company_id": ObjectId(company_id)
    })
    
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reminder not found")
    
    await db.reminders.update_one(
        {"_id": ObjectId(doc_id)},
        {
            "$set": {
                "status": "resolved",
                "response_date": datetime.now(timezone.utc),
                "response_notes": notes,
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    await log_action(company_id, str(current_user["_id"]), current_user.get("full_name", ""), "Résoudre", doc.get("number", ""), request.client.host if request.client else None)
    
    return {"message": "Reminder resolved"}


# ==================== TEMPLATES DE RAPPELS ====================

class ReminderTemplateCreate(BaseModel):
    name: str
    subject: str
    body: str
    days_after_due: int
    reminder_level: int = 1
    is_active: bool = True


@router.get("/templates/list")
async def list_reminder_templates(
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Liste les templates de rappel"""
    templates = await db.reminder_templates.find({
        "company_id": ObjectId(company_id)
    }).sort("reminder_level", 1).to_list(None)
    
    for t in templates:
        t["id"] = str(t["_id"])
    
    return {"items": templates}


@router.post("/templates/create")
async def create_reminder_template(
    template: ReminderTemplateCreate,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Crée un nouveau template de rappel"""
    service = ReminderService(db)
    result = await service.create_reminder_template(
        company_id=company_id,
        name=template.name,
        subject=template.subject,
        body=template.body,
        days_after_due=template.days_after_due,
        reminder_level=template.reminder_level,
        is_active=template.is_active
    )
    return result


@router.post("/templates/initialize-defaults")
async def initialize_default_templates(
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Initialise les templates par défaut"""
    existing = await db.reminder_templates.count_documents({
        "company_id": ObjectId(company_id)
    })
    
    if existing > 0:
        raise HTTPException(status_code=400, detail="Des templates existent déjà")
    
    service = ReminderService(db)
    templates = await service.initialize_default_templates(company_id)
    
    return {
        "message": f"{len(templates)} templates créés",
        "templates": templates
    }


# ==================== FACTURES EN RETARD ====================

@router.get("/overdue-invoices")
async def get_overdue_invoices(
    company_id: str = Query(...),
    min_days_overdue: int = 0,
    max_days_overdue: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    """Liste les factures en retard"""
    service = ReminderService(db)
    invoices = await service.get_overdue_invoices(
        company_id=company_id,
        min_days_overdue=min_days_overdue,
        max_days_overdue=max_days_overdue
    )
    return {"items": invoices, "total": len(invoices)}


# ==================== ENVOI AUTOMATIQUE ====================

@router.post("/send-automatic/{invoice_id}")
async def send_automatic_reminder(
    invoice_id: str,
    template_id: Optional[str] = None,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Envoie un rappel automatique pour une facture"""
    service = ReminderService(db)
    try:
        result = await service.send_reminder(
            invoice_id=invoice_id,
            company_id=company_id,
            template_id=template_id
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/process-automatic")
async def process_automatic_reminders(
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Traite les rappels automatiques"""
    service = ReminderService(db)
    result = await service.process_automatic_reminders(company_id)
    return result


@router.get("/history")
async def get_reminder_history(
    company_id: str = Query(...),
    invoice_id: Optional[str] = None,
    customer_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Récupère l'historique des rappels envoyés"""
    service = ReminderService(db)
    result = await service.get_reminder_history(
        company_id=company_id,
        invoice_id=invoice_id,
        customer_id=customer_id,
        skip=skip,
        limit=limit
    )
    return result
