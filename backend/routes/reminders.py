from fastapi import APIRouter, HTTPException, status, Depends, Query, Request
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime, timezone
import os
from typing import Optional
from models.reminder import Reminder, ReminderCreate, ReminderUpdate
from utils.dependencies import get_current_user, get_current_company
from utils.helpers import generate_document_number

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
