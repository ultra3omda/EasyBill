from fastapi import APIRouter, HTTPException, status, Depends, Query, Request
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime, timezone
import os
from typing import Optional
from models.purchase_order import PurchaseOrder, PurchaseOrderCreate, PurchaseOrderUpdate
from utils.dependencies import get_current_user, get_current_company
from utils.helpers import generate_document_number, calculate_document_totals

router = APIRouter(prefix="/api/purchase-orders", tags=["Purchase Orders"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]


def serialize_po(p: dict) -> dict:
    return {
        "id": str(p["_id"]),
        "company_id": str(p.get("company_id")) if p.get("company_id") else None,
        "supplier_id": str(p.get("supplier_id")) if p.get("supplier_id") else None,
        "supplier_name": p.get("supplier_name", ""),
        "number": p.get("number"),
        "date": p["date"].isoformat() if isinstance(p.get("date"), datetime) else p.get("date"),
        "expected_date": p["expected_date"].isoformat() if isinstance(p.get("expected_date"), datetime) else p.get("expected_date"),
        "items": p.get("items", []),
        "subtotal": p.get("subtotal", 0),
        "total_tax": p.get("total_tax", 0),
        "total_discount": p.get("total_discount", 0),
        "total": p.get("total", 0),
        "notes": p.get("notes"),
        "status": p.get("status", "draft"),
        "sent_at": p["sent_at"].isoformat() if isinstance(p.get("sent_at"), datetime) else p.get("sent_at"),
        "confirmed_at": p["confirmed_at"].isoformat() if isinstance(p.get("confirmed_at"), datetime) else p.get("confirmed_at"),
        "received_at": p["received_at"].isoformat() if isinstance(p.get("received_at"), datetime) else p.get("received_at"),
        "created_at": p["created_at"].isoformat() if isinstance(p.get("created_at"), datetime) else p.get("created_at"),
        "updated_at": p["updated_at"].isoformat() if isinstance(p.get("updated_at"), datetime) else p.get("updated_at")
    }


async def log_action(company_id, user_id, user_name, action, element, ip_address=None):
    await db.access_logs.insert_one({
        "company_id": ObjectId(company_id), "user_id": ObjectId(user_id), "user_name": user_name,
        "category": "Bon de commande", "action": action, "element": element,
        "ip_address": ip_address, "created_at": datetime.now(timezone.utc)
    })


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_purchase_order(data: PurchaseOrderCreate, request: Request, company_id: str = Query(...), current_user: dict = Depends(get_current_user)):
    company = await get_current_company(current_user, company_id)
    
    numbering = company.get("numbering", {})
    number = generate_document_number(numbering.get("po_prefix", "BC"), numbering.get("po_next", 1), datetime.now().year)
    
    items = [item.dict() for item in data.items]
    totals = calculate_document_totals(items)
    
    doc_dict = data.dict(exclude={'items'})
    if isinstance(doc_dict.get('date'), str):
        doc_dict['date'] = datetime.fromisoformat(doc_dict['date'].replace('Z', '+00:00'))
    if isinstance(doc_dict.get('expected_date'), str) and doc_dict.get('expected_date'):
        doc_dict['expected_date'] = datetime.fromisoformat(doc_dict['expected_date'].replace('Z', '+00:00'))
    
    doc_dict.update({
        "company_id": ObjectId(company_id), "supplier_id": ObjectId(data.supplier_id),
        "number": number, "items": items, **totals, "status": "draft",
        "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "created_by": current_user["_id"]
    })
    
    result = await db.purchase_orders.insert_one(doc_dict)
    await db.companies.update_one({"_id": ObjectId(company_id)}, {"$inc": {"numbering.po_next": 1}})
    await log_action(company_id, str(current_user["_id"]), current_user.get("full_name", ""), "Créer", number, request.client.host if request.client else None)
    
    return {"id": str(result.inserted_id), "number": number, "message": "Purchase order created"}


@router.get("/")
async def list_purchase_orders(company_id: str = Query(...), search: Optional[str] = None, status_filter: Optional[str] = Query(None, alias="status"), current_user: dict = Depends(get_current_user)):
    company = await get_current_company(current_user, company_id)
    
    query = {"company_id": ObjectId(company_id)}
    if search:
        query["$or"] = [{"number": {"$regex": search, "$options": "i"}}]
    if status_filter:
        query["status"] = status_filter
    
    docs = await db.purchase_orders.find(query).sort("created_at", -1).to_list(1000)
    
    for doc in docs:
        if doc.get("supplier_id"):
            supplier = await db.suppliers.find_one({"_id": doc["supplier_id"]})
            doc["supplier_name"] = supplier.get("display_name", "Inconnu") if supplier else "Inconnu"
    
    return [serialize_po(d) for d in docs]


@router.get("/{doc_id}")
async def get_purchase_order(doc_id: str, company_id: str = Query(...), current_user: dict = Depends(get_current_user)):
    company = await get_current_company(current_user, company_id)
    doc = await db.purchase_orders.find_one({"_id": ObjectId(doc_id), "company_id": ObjectId(company_id)})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase order not found")
    if doc.get("supplier_id"):
        supplier = await db.suppliers.find_one({"_id": doc["supplier_id"]})
        doc["supplier_name"] = supplier.get("display_name", "") if supplier else ""
    return serialize_po(doc)


@router.put("/{doc_id}")
async def update_purchase_order(doc_id: str, data: PurchaseOrderUpdate, request: Request, company_id: str = Query(...), current_user: dict = Depends(get_current_user)):
    company = await get_current_company(current_user, company_id)
    existing = await db.purchase_orders.find_one({"_id": ObjectId(doc_id)})
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase order not found")
    
    update_data = {k: v for k, v in data.dict(exclude_unset=True).items()}
    if 'items' in update_data and update_data['items']:
        items = [item.dict() if hasattr(item, 'dict') else item for item in update_data['items']]
        update_data.update(calculate_document_totals(items))
        update_data['items'] = items
    if 'supplier_id' in update_data and update_data['supplier_id']:
        update_data['supplier_id'] = ObjectId(update_data['supplier_id'])
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.purchase_orders.update_one({"_id": ObjectId(doc_id), "company_id": ObjectId(company_id)}, {"$set": update_data})
    await log_action(company_id, str(current_user["_id"]), current_user.get("full_name", ""), "Modifier", existing.get("number", ""), request.client.host if request.client else None)
    return {"message": "Purchase order updated"}


@router.delete("/{doc_id}")
async def delete_purchase_order(doc_id: str, request: Request, company_id: str = Query(...), current_user: dict = Depends(get_current_user)):
    company = await get_current_company(current_user, company_id)
    doc = await db.purchase_orders.find_one({"_id": ObjectId(doc_id), "company_id": ObjectId(company_id)})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase order not found")
    await db.purchase_orders.delete_one({"_id": ObjectId(doc_id)})
    await log_action(company_id, str(current_user["_id"]), current_user.get("full_name", ""), "Supprimer", doc.get("number", ""), request.client.host if request.client else None)
    return {"message": "Purchase order deleted"}


@router.post("/{doc_id}/send")
async def send_purchase_order(doc_id: str, request: Request, company_id: str = Query(...), current_user: dict = Depends(get_current_user)):
    company = await get_current_company(current_user, company_id)
    doc = await db.purchase_orders.find_one({"_id": ObjectId(doc_id), "company_id": ObjectId(company_id)})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase order not found")
    await db.purchase_orders.update_one({"_id": ObjectId(doc_id)}, {"$set": {"status": "sent", "sent_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc)}})
    await log_action(company_id, str(current_user["_id"]), current_user.get("full_name", ""), "Envoyer", doc.get("number", ""), request.client.host if request.client else None)
    return {"message": "Purchase order sent"}


@router.post("/{doc_id}/confirm")
async def confirm_purchase_order(doc_id: str, request: Request, company_id: str = Query(...), current_user: dict = Depends(get_current_user)):
    company = await get_current_company(current_user, company_id)
    doc = await db.purchase_orders.find_one({"_id": ObjectId(doc_id), "company_id": ObjectId(company_id)})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase order not found")
    await db.purchase_orders.update_one({"_id": ObjectId(doc_id)}, {"$set": {"status": "confirmed", "confirmed_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc)}})
    await log_action(company_id, str(current_user["_id"]), current_user.get("full_name", ""), "Confirmer", doc.get("number", ""), request.client.host if request.client else None)
    return {"message": "Purchase order confirmed"}


@router.post("/{doc_id}/receive")
async def receive_purchase_order(doc_id: str, request: Request, company_id: str = Query(...), current_user: dict = Depends(get_current_user)):
    company = await get_current_company(current_user, company_id)
    doc = await db.purchase_orders.find_one({"_id": ObjectId(doc_id), "company_id": ObjectId(company_id)})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase order not found")
    await db.purchase_orders.update_one({"_id": ObjectId(doc_id)}, {"$set": {"status": "received", "received_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc)}})
    await log_action(company_id, str(current_user["_id"]), current_user.get("full_name", ""), "Réceptionner", doc.get("number", ""), request.client.host if request.client else None)
    return {"message": "Purchase order received"}
