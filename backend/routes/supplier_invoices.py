from fastapi import APIRouter, HTTPException, status, Depends, Query, Request
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime, timezone
import os
from typing import Optional
from models.supplier_invoice import SupplierInvoice, SupplierInvoiceCreate, SupplierInvoiceUpdate
from utils.dependencies import get_current_user, get_current_company
from utils.helpers import generate_document_number, calculate_document_totals

router = APIRouter(prefix="/api/supplier-invoices", tags=["Supplier Invoices"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]


def serialize_si(s: dict) -> dict:
    return {
        "id": str(s["_id"]),
        "company_id": str(s.get("company_id")) if s.get("company_id") else None,
        "supplier_id": str(s.get("supplier_id")) if s.get("supplier_id") else None,
        "supplier_name": s.get("supplier_name", ""),
        "purchase_order_id": str(s.get("purchase_order_id")) if s.get("purchase_order_id") else None,
        "number": s.get("number"),
        "supplier_number": s.get("supplier_number"),
        "date": s["date"].isoformat() if isinstance(s.get("date"), datetime) else s.get("date"),
        "due_date": s["due_date"].isoformat() if isinstance(s.get("due_date"), datetime) else s.get("due_date"),
        "items": s.get("items", []),
        "subtotal": s.get("subtotal", 0),
        "total_tax": s.get("total_tax", 0),
        "total_discount": s.get("total_discount", 0),
        "total": s.get("total", 0),
        "amount_paid": s.get("amount_paid", 0),
        "balance_due": s.get("balance_due", 0),
        "notes": s.get("notes"),
        "status": s.get("status", "draft"),
        "paid_at": s["paid_at"].isoformat() if isinstance(s.get("paid_at"), datetime) else s.get("paid_at"),
        "created_at": s["created_at"].isoformat() if isinstance(s.get("created_at"), datetime) else s.get("created_at"),
        "updated_at": s["updated_at"].isoformat() if isinstance(s.get("updated_at"), datetime) else s.get("updated_at")
    }


async def log_action(company_id, user_id, user_name, action, element, ip_address=None):
    await db.access_logs.insert_one({
        "company_id": ObjectId(company_id), "user_id": ObjectId(user_id), "user_name": user_name,
        "category": "Facture fournisseur", "action": action, "element": element,
        "ip_address": ip_address, "created_at": datetime.now(timezone.utc)
    })


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_supplier_invoice(data: SupplierInvoiceCreate, request: Request, company_id: str = Query(...), current_user: dict = Depends(get_current_user)):
    company = await get_current_company(current_user, company_id)
    
    numbering = company.get("numbering", {})
    number = generate_document_number(numbering.get("si_prefix", "FF"), numbering.get("si_next", 1), datetime.now().year)
    
    items = [item.dict() for item in data.items]
    totals = calculate_document_totals(items)
    
    doc_dict = data.dict(exclude={'items'})
    if isinstance(doc_dict.get('date'), str):
        doc_dict['date'] = datetime.fromisoformat(doc_dict['date'].replace('Z', '+00:00'))
    if isinstance(doc_dict.get('due_date'), str):
        doc_dict['due_date'] = datetime.fromisoformat(doc_dict['due_date'].replace('Z', '+00:00'))
    
    doc_dict.update({
        "company_id": ObjectId(company_id), "supplier_id": ObjectId(data.supplier_id),
        "number": number, "items": items, **totals, "amount_paid": 0, "balance_due": totals["total"],
        "status": "received", "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "created_by": current_user["_id"]
    })
    
    if data.purchase_order_id:
        doc_dict["purchase_order_id"] = ObjectId(data.purchase_order_id)
    
    result = await db.supplier_invoices.insert_one(doc_dict)
    await db.companies.update_one({"_id": ObjectId(company_id)}, {"$inc": {"numbering.si_next": 1}})
    
    # Update supplier stats
    await db.suppliers.update_one({"_id": ObjectId(data.supplier_id)}, {"$inc": {"invoice_count": 1, "total_invoiced": totals["total"], "balance": totals["total"]}})
    
    # Update stock - increase for purchased items
    warehouse = await db.warehouses.find_one({"company_id": ObjectId(company_id), "is_default": True})
    if not warehouse:
        warehouse = await db.warehouses.find_one({"company_id": ObjectId(company_id)})
    
    if warehouse:
        for item in items:
            product_id = item.get("product_id")
            if product_id:
                product = await db.products.find_one({"_id": ObjectId(product_id)})
                if product and product.get("type") != "service":
                    current_stock = product.get("quantity_in_stock", 0)
                    qty = item.get("quantity", 0)
                    new_stock = current_stock + qty
                    
                    # Create stock movement (entrée)
                    await db.stock_movements.insert_one({
                        "company_id": ObjectId(company_id),
                        "product_id": ObjectId(product_id),
                        "product_name": product.get("name"),
                        "warehouse_id": warehouse["_id"],
                        "warehouse_name": warehouse.get("name"),
                        "type": "in",
                        "quantity": qty,
                        "unit_cost": item.get("unit_price", product.get("purchase_price", 0)),
                        "total_value": qty * item.get("unit_price", product.get("purchase_price", 0)),
                        "reason": "Achat",
                        "reference": number,
                        "stock_before": current_stock,
                        "stock_after": new_stock,
                        "created_at": datetime.now(timezone.utc),
                        "created_by": current_user["_id"],
                        "created_by_name": current_user.get("full_name", "")
                    })
                    
                    # Update product stock
                    await db.products.update_one(
                        {"_id": ObjectId(product_id)},
                        {"$set": {"quantity_in_stock": new_stock, "updated_at": datetime.now(timezone.utc)}}
                    )
    
    await log_action(company_id, str(current_user["_id"]), current_user.get("full_name", ""), "Créer", number, request.client.host if request.client else None)
    return {"id": str(result.inserted_id), "number": number, "message": "Supplier invoice created"}


@router.get("/")
async def list_supplier_invoices(company_id: str = Query(...), search: Optional[str] = None, status_filter: Optional[str] = Query(None, alias="status"), current_user: dict = Depends(get_current_user)):
    company = await get_current_company(current_user, company_id)
    
    query = {"company_id": ObjectId(company_id)}
    if search:
        query["$or"] = [{"number": {"$regex": search, "$options": "i"}}, {"supplier_number": {"$regex": search, "$options": "i"}}]
    if status_filter:
        query["status"] = status_filter
    
    docs = await db.supplier_invoices.find(query).sort("created_at", -1).to_list(1000)
    
    for doc in docs:
        if doc.get("supplier_id"):
            supplier = await db.suppliers.find_one({"_id": doc["supplier_id"]})
            doc["supplier_name"] = supplier.get("display_name", "Inconnu") if supplier else "Inconnu"
    
    return [serialize_si(d) for d in docs]


@router.get("/pending")
async def get_pending_invoices(company_id: str = Query(...), supplier_id: Optional[str] = Query(None), current_user: dict = Depends(get_current_user)):
    """Get supplier invoices with outstanding balance for payment allocation"""
    company = await get_current_company(current_user, company_id)
    query = {"company_id": ObjectId(company_id), "balance_due": {"$gt": 0}}
    if supplier_id:
        query["supplier_id"] = ObjectId(supplier_id)
    
    invoices = await db.supplier_invoices.find(query).sort("date", 1).to_list(1000)
    result = []
    for inv in invoices:
        supplier = await db.suppliers.find_one({"_id": inv.get("supplier_id")})
        result.append({
            "id": str(inv["_id"]), "number": inv.get("number"),
            "date": inv["date"].isoformat() if isinstance(inv.get("date"), datetime) else inv.get("date"),
            "supplier_id": str(inv.get("supplier_id")) if inv.get("supplier_id") else None,
            "supplier_name": supplier.get("display_name", "") if supplier else "",
            "total": inv.get("total", 0), "amount_paid": inv.get("amount_paid", 0), "balance_due": inv.get("balance_due", 0)
        })
    return result


@router.get("/{doc_id}")
async def get_supplier_invoice(doc_id: str, company_id: str = Query(...), current_user: dict = Depends(get_current_user)):
    company = await get_current_company(current_user, company_id)
    doc = await db.supplier_invoices.find_one({"_id": ObjectId(doc_id), "company_id": ObjectId(company_id)})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier invoice not found")
    if doc.get("supplier_id"):
        supplier = await db.suppliers.find_one({"_id": doc["supplier_id"]})
        doc["supplier_name"] = supplier.get("display_name", "") if supplier else ""
    return serialize_si(doc)


@router.put("/{doc_id}")
async def update_supplier_invoice(doc_id: str, data: SupplierInvoiceUpdate, request: Request, company_id: str = Query(...), current_user: dict = Depends(get_current_user)):
    company = await get_current_company(current_user, company_id)
    existing = await db.supplier_invoices.find_one({"_id": ObjectId(doc_id)})
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier invoice not found")
    
    update_data = {k: v for k, v in data.dict(exclude_unset=True).items()}
    if 'items' in update_data and update_data['items']:
        items = [item.dict() if hasattr(item, 'dict') else item for item in update_data['items']]
        totals = calculate_document_totals(items)
        update_data.update(totals)
        update_data['items'] = items
        update_data['balance_due'] = totals['total'] - existing.get('amount_paid', 0)
    if 'supplier_id' in update_data and update_data['supplier_id']:
        update_data['supplier_id'] = ObjectId(update_data['supplier_id'])
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.supplier_invoices.update_one({"_id": ObjectId(doc_id), "company_id": ObjectId(company_id)}, {"$set": update_data})
    await log_action(company_id, str(current_user["_id"]), current_user.get("full_name", ""), "Modifier", existing.get("number", ""), request.client.host if request.client else None)
    return {"message": "Supplier invoice updated"}


@router.delete("/{doc_id}")
async def delete_supplier_invoice(doc_id: str, request: Request, company_id: str = Query(...), current_user: dict = Depends(get_current_user)):
    company = await get_current_company(current_user, company_id)
    doc = await db.supplier_invoices.find_one({"_id": ObjectId(doc_id), "company_id": ObjectId(company_id)})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier invoice not found")
    
    # Update supplier stats
    if doc.get("supplier_id"):
        await db.suppliers.update_one({"_id": doc["supplier_id"]}, {"$inc": {"invoice_count": -1, "total_invoiced": -doc.get("total", 0), "balance": -doc.get("balance_due", 0)}})
    
    await db.supplier_invoices.delete_one({"_id": ObjectId(doc_id)})
    await log_action(company_id, str(current_user["_id"]), current_user.get("full_name", ""), "Supprimer", doc.get("number", ""), request.client.host if request.client else None)
    return {"message": "Supplier invoice deleted"}
