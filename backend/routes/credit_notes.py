from fastapi import APIRouter, HTTPException, status, Depends, Query, Request
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime, timezone
import os
from typing import Optional
from models.credit_note import CreditNote, CreditNoteCreate, CreditNoteUpdate
from utils.dependencies import get_current_user, get_current_company
from utils.helpers import generate_document_number, calculate_document_totals

router = APIRouter(prefix="/api/credit-notes", tags=["Credit Notes"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]


def serialize_credit_note(c: dict) -> dict:
    """Serialize credit note document for JSON response."""
    return {
        "id": str(c["_id"]),
        "company_id": str(c.get("company_id")) if c.get("company_id") else None,
        "customer_id": str(c.get("customer_id")) if c.get("customer_id") else None,
        "customer_name": c.get("customer_name", ""),
        "invoice_id": str(c.get("invoice_id")) if c.get("invoice_id") else None,
        "invoice_number": c.get("invoice_number"),
        "number": c.get("number"),
        "date": c["date"].isoformat() if isinstance(c.get("date"), datetime) else c.get("date"),
        "reason": c.get("reason"),
        "items": c.get("items", []),
        "subtotal": c.get("subtotal", 0),
        "total_tax": c.get("total_tax", 0),
        "total_discount": c.get("total_discount", 0),
        "total": c.get("total", 0),
        "notes": c.get("notes"),
        "status": c.get("status", "draft"),
        "refund_method": c.get("refund_method"),
        "refund_amount": c.get("refund_amount", 0),
        "applied_at": c["applied_at"].isoformat() if isinstance(c.get("applied_at"), datetime) else c.get("applied_at"),
        "created_at": c["created_at"].isoformat() if isinstance(c.get("created_at"), datetime) else c.get("created_at"),
        "updated_at": c["updated_at"].isoformat() if isinstance(c.get("updated_at"), datetime) else c.get("updated_at")
    }


async def log_action(company_id, user_id, user_name, action, element, ip_address=None):
    await db.access_logs.insert_one({
        "company_id": ObjectId(company_id),
        "user_id": ObjectId(user_id),
        "user_name": user_name,
        "category": "Facture d'avoir",
        "action": action,
        "element": element,
        "ip_address": ip_address,
        "created_at": datetime.now(timezone.utc)
    })


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_credit_note(
    data: CreditNoteCreate,
    request: Request,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    numbering = company.get("numbering", {})
    prefix = numbering.get("credit_prefix", "AV")
    next_num = numbering.get("credit_next", 1)
    
    number = generate_document_number(prefix, next_num, datetime.now().year)
    
    items = [item.dict() for item in data.items]
    totals = calculate_document_totals(items)
    
    doc_dict = data.dict(exclude={'items'})
    
    if isinstance(doc_dict.get('date'), str):
        doc_dict['date'] = datetime.fromisoformat(doc_dict['date'].replace('Z', '+00:00'))
    
    doc_dict.update({
        "company_id": ObjectId(company_id),
        "customer_id": ObjectId(data.customer_id),
        "number": number,
        "items": items,
        **totals,
        "refund_amount": 0.0,
        "status": "draft",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "created_by": current_user["_id"]
    })
    
    if data.invoice_id:
        doc_dict["invoice_id"] = ObjectId(data.invoice_id)
    
    result = await db.credit_notes.insert_one(doc_dict)
    
    await db.companies.update_one(
        {"_id": ObjectId(company_id)},
        {"$inc": {"numbering.credit_next": 1}}
    )
    
    await log_action(company_id, str(current_user["_id"]), current_user.get("full_name", ""), "Créer", number, request.client.host if request.client else None)
    
    return {"id": str(result.inserted_id), "number": number, "message": "Credit note created"}


@router.get("/")
async def list_credit_notes(
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
    
    docs = await db.credit_notes.find(query).sort("created_at", -1).to_list(1000)
    
    for doc in docs:
        if doc.get("customer_id"):
            customer = await db.customers.find_one({"_id": doc["customer_id"]})
            doc["customer_name"] = customer.get("display_name", "Inconnu") if customer else "Inconnu"
        if doc.get("invoice_id"):
            invoice = await db.invoices.find_one({"_id": doc["invoice_id"]})
            doc["invoice_number"] = invoice.get("number") if invoice else None
    
    return [serialize_credit_note(c) for c in docs]


@router.get("/{doc_id}")
async def get_credit_note(
    doc_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    doc = await db.credit_notes.find_one({
        "_id": ObjectId(doc_id),
        "company_id": ObjectId(company_id)
    })
    
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Credit note not found")
    
    if doc.get("customer_id"):
        customer = await db.customers.find_one({"_id": doc["customer_id"]})
        doc["customer_name"] = customer.get("display_name", "") if customer else ""
    
    return serialize_credit_note(doc)


@router.put("/{doc_id}")
async def update_credit_note(
    doc_id: str,
    data: CreditNoteUpdate,
    request: Request,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    existing = await db.credit_notes.find_one({"_id": ObjectId(doc_id)})
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Credit note not found")
    
    update_data = {k: v for k, v in data.dict(exclude_unset=True).items()}
    
    if 'items' in update_data and update_data['items']:
        items = [item.dict() if hasattr(item, 'dict') else item for item in update_data['items']]
        totals = calculate_document_totals(items)
        update_data.update(totals)
        update_data['items'] = items
    
    if 'customer_id' in update_data and update_data['customer_id']:
        update_data['customer_id'] = ObjectId(update_data['customer_id'])
    
    if 'invoice_id' in update_data and update_data['invoice_id']:
        update_data['invoice_id'] = ObjectId(update_data['invoice_id'])
    
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.credit_notes.update_one(
        {"_id": ObjectId(doc_id), "company_id": ObjectId(company_id)},
        {"$set": update_data}
    )
    
    await log_action(company_id, str(current_user["_id"]), current_user.get("full_name", ""), "Modifier", existing.get("number", ""), request.client.host if request.client else None)
    
    return {"message": "Credit note updated"}


@router.delete("/{doc_id}")
async def delete_credit_note(
    doc_id: str,
    request: Request,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    doc = await db.credit_notes.find_one({
        "_id": ObjectId(doc_id),
        "company_id": ObjectId(company_id)
    })
    
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Credit note not found")
    
    await db.credit_notes.delete_one({"_id": ObjectId(doc_id)})
    
    await log_action(company_id, str(current_user["_id"]), current_user.get("full_name", ""), "Supprimer", doc.get("number", ""), request.client.host if request.client else None)
    
    return {"message": "Credit note deleted"}


@router.post("/{doc_id}/apply")
async def apply_credit_note(
    doc_id: str,
    request: Request,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Apply credit note to reduce customer balance"""
    company = await get_current_company(current_user, company_id)
    
    doc = await db.credit_notes.find_one({
        "_id": ObjectId(doc_id),
        "company_id": ObjectId(company_id)
    })
    
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Credit note not found")
    
    if doc.get("status") == "applied":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Credit note already applied")
    
    # Update credit note status
    await db.credit_notes.update_one(
        {"_id": ObjectId(doc_id)},
        {
            "$set": {
                "status": "applied",
                "applied_at": datetime.now(timezone.utc),
                "refund_amount": doc["total"],
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    # Reduce customer balance
    if doc.get("customer_id"):
        await db.customers.update_one(
            {"_id": doc["customer_id"]},
            {"$inc": {"balance": -doc["total"], "total_invoiced": -doc["total"]}}
        )
    
    # If linked to invoice, reduce invoice balance
    if doc.get("invoice_id"):
        invoice = await db.invoices.find_one({"_id": doc["invoice_id"]})
        if invoice:
            new_total = max(0, invoice.get("total", 0) - doc["total"])
            new_balance = max(0, invoice.get("balance_due", 0) - doc["total"])
            await db.invoices.update_one(
                {"_id": doc["invoice_id"]},
                {"$set": {"balance_due": new_balance}}
            )
    
    await log_action(company_id, str(current_user["_id"]), current_user.get("full_name", ""), "Appliquer", doc.get("number", ""), request.client.host if request.client else None)
    
    return {"message": "Credit note applied"}
