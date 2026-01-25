from fastapi import APIRouter, HTTPException, status, Depends, Query, Request
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime, timezone
import os
import logging
from typing import Optional, List
from pydantic import BaseModel, Field
from services.accounting_sync_service import accounting_sync_service
from utils.dependencies import get_current_user, get_current_company

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/supplier-payments", tags=["Supplier Payments"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]


class PaymentAllocation(BaseModel):
    invoice_id: str
    amount: float = Field(gt=0)


class SupplierPaymentCreate(BaseModel):
    date: datetime = Field(default_factory=datetime.utcnow)
    supplier_id: str
    amount: float = Field(gt=0)
    payment_method: str
    reference: Optional[str] = None
    bank_fees: float = 0.0
    allocations: List[PaymentAllocation] = []
    notes: Optional[str] = None


def serialize_payment(p: dict) -> dict:
    return {
        "id": str(p["_id"]),
        "company_id": str(p.get("company_id")) if p.get("company_id") else None,
        "supplier_id": str(p.get("supplier_id")) if p.get("supplier_id") else None,
        "supplier_name": p.get("supplier_name", ""),
        "number": p.get("number"),
        "date": p["date"].isoformat() if isinstance(p.get("date"), datetime) else p.get("date"),
        "amount": p.get("amount", 0),
        "payment_method": p.get("payment_method"),
        "reference": p.get("reference"),
        "bank_fees": p.get("bank_fees", 0),
        "allocations": [{
            "invoice_id": str(a["invoice_id"]) if isinstance(a.get("invoice_id"), ObjectId) else a.get("invoice_id"),
            "amount": a.get("amount", 0),
            "invoice_number": a.get("invoice_number")
        } for a in p.get("allocations", [])],
        "notes": p.get("notes"),
        "created_at": p["created_at"].isoformat() if isinstance(p.get("created_at"), datetime) else p.get("created_at")
    }


async def log_action(company_id, user_id, user_name, action, element, ip_address=None):
    await db.access_logs.insert_one({
        "company_id": ObjectId(company_id), "user_id": ObjectId(user_id), "user_name": user_name,
        "category": "Paiement fournisseur", "action": action, "element": element,
        "ip_address": ip_address, "created_at": datetime.now(timezone.utc)
    })


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_supplier_payment(data: SupplierPaymentCreate, request: Request, company_id: str = Query(...), current_user: dict = Depends(get_current_user)):
    company = await get_current_company(current_user, company_id)
    
    numbering = company.get("numbering", {})
    number = f"PAY-F-{datetime.now().year}-{numbering.get('sp_next', 1):05d}"
    
    payment_dict = data.dict()
    if isinstance(payment_dict.get('date'), str):
        payment_dict['date'] = datetime.fromisoformat(payment_dict['date'].replace('Z', '+00:00'))
    
    payment_dict.update({
        "company_id": ObjectId(company_id), "supplier_id": ObjectId(data.supplier_id),
        "number": number, "type": "sent",
        "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "created_by": current_user["_id"]
    })
    
    for allocation in payment_dict["allocations"]:
        allocation["invoice_id"] = ObjectId(allocation["invoice_id"])
    
    result = await db.supplier_payments.insert_one(payment_dict)
    await db.companies.update_one({"_id": ObjectId(company_id)}, {"$inc": {"numbering.sp_next": 1}})
    
    # Update supplier invoices
    for allocation in data.allocations:
        invoice = await db.supplier_invoices.find_one({"_id": ObjectId(allocation.invoice_id)})
        if invoice:
            new_amount_paid = invoice.get("amount_paid", 0) + allocation.amount
            new_balance = invoice["total"] - new_amount_paid
            new_status = "paid" if new_balance <= 0 else "partial"
            
            await db.supplier_invoices.update_one(
                {"_id": ObjectId(allocation.invoice_id)},
                {"$set": {"amount_paid": new_amount_paid, "balance_due": max(0, new_balance), "status": new_status,
                         "paid_at": datetime.now(timezone.utc) if new_status == "paid" else None, "updated_at": datetime.now(timezone.utc)}}
            )
            
            # Update supplier balance
            await db.suppliers.update_one({"_id": invoice["supplier_id"]}, {"$inc": {"total_paid": allocation.amount, "balance": -allocation.amount}})
    
    await log_action(company_id, str(current_user["_id"]), current_user.get("full_name", ""), "Créer", number, request.client.host if request.client else None)
    
    # Synchronisation comptable automatique
    try:
        await accounting_sync_service.sync_supplier_payment(str(result.inserted_id))
    except Exception as e:
        logger.error(f"Erreur synchronisation comptable paiement fournisseur {result.inserted_id}: {str(e)}")
    
    return {"id": str(result.inserted_id), "number": number, "message": "Supplier payment recorded"}


@router.get("/")
async def list_supplier_payments(company_id: str = Query(...), current_user: dict = Depends(get_current_user)):
    company = await get_current_company(current_user, company_id)
    payments = await db.supplier_payments.find({"company_id": ObjectId(company_id)}).sort("created_at", -1).to_list(1000)
    
    for payment in payments:
        if payment.get("supplier_id"):
            supplier = await db.suppliers.find_one({"_id": payment["supplier_id"]})
            payment["supplier_name"] = supplier.get("display_name", "Inconnu") if supplier else "Inconnu"
        for allocation in payment.get("allocations", []):
            if allocation.get("invoice_id"):
                invoice = await db.supplier_invoices.find_one({"_id": allocation["invoice_id"]})
                allocation["invoice_number"] = invoice.get("number") if invoice else None
    
    return [serialize_payment(p) for p in payments]


@router.delete("/{payment_id}")
async def delete_supplier_payment(payment_id: str, request: Request, company_id: str = Query(...), current_user: dict = Depends(get_current_user)):
    company = await get_current_company(current_user, company_id)
    payment = await db.supplier_payments.find_one({"_id": ObjectId(payment_id), "company_id": ObjectId(company_id)})
    if not payment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")
    
    # Reverse payment effects
    for allocation in payment.get("allocations", []):
        invoice = await db.supplier_invoices.find_one({"_id": allocation["invoice_id"]})
        if invoice:
            new_amount_paid = max(0, invoice.get("amount_paid", 0) - allocation["amount"])
            new_balance = invoice["total"] - new_amount_paid
            new_status = "paid" if new_balance <= 0 else "received" if new_amount_paid == 0 else "partial"
            
            await db.supplier_invoices.update_one(
                {"_id": allocation["invoice_id"]},
                {"$set": {"amount_paid": new_amount_paid, "balance_due": new_balance, "status": new_status, "paid_at": None if new_status != "paid" else invoice.get("paid_at")}}
            )
            
            await db.suppliers.update_one({"_id": invoice["supplier_id"]}, {"$inc": {"total_paid": -allocation["amount"], "balance": allocation["amount"]}})
    
    await db.supplier_payments.delete_one({"_id": ObjectId(payment_id)})
    await log_action(company_id, str(current_user["_id"]), current_user.get("full_name", ""), "Supprimer", payment.get("number", ""), request.client.host if request.client else None)
    return {"message": "Supplier payment deleted"}
