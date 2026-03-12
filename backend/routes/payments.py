from fastapi import APIRouter, HTTPException, status, Query, Depends, Request
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime, timezone
import os
import logging
from typing import Optional, List
from pydantic import BaseModel, Field
from utils.dependencies import get_current_user, get_current_company
from services.accounting_sync_service import accounting_sync_service
from routes.cash_accounts import auto_record_cash_movement

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/payments", tags=["Payments"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]


class PaymentAllocation(BaseModel):
    invoice_id: str
    amount: float = Field(gt=0)


class PaymentCreate(BaseModel):
    type: str = "received"  # received, sent
    date: datetime = Field(default_factory=datetime.utcnow)
    customer_id: Optional[str] = None
    supplier_id: Optional[str] = None
    amount: float = Field(gt=0)
    payment_method: str  # cash, check, transfer, card, e_dinar
    reference: Optional[str] = None
    bank_fees: float = 0.0
    allocations: List[PaymentAllocation] = []
    notes: Optional[str] = None


def serialize_payment(p: dict) -> dict:
    """Serialize payment document for JSON response."""
    return {
        "id": str(p["_id"]),
        "company_id": str(p.get("company_id")) if p.get("company_id") else None,
        "customer_id": str(p.get("customer_id")) if p.get("customer_id") else None,
        "supplier_id": str(p.get("supplier_id")) if p.get("supplier_id") else None,
        "customer_name": p.get("customer_name", ""),
        "supplier_name": p.get("supplier_name", ""),
        "number": p.get("number"),
        "type": p.get("type"),
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
        "status": p.get("status", "completed"),
        "created_at": p["created_at"].isoformat() if isinstance(p.get("created_at"), datetime) else p.get("created_at"),
        "updated_at": p["updated_at"].isoformat() if isinstance(p.get("updated_at"), datetime) else p.get("updated_at")
    }


async def log_action(company_id, user_id, user_name, action, element, ip_address=None):
    await db.access_logs.insert_one({
        "company_id": ObjectId(company_id),
        "user_id": ObjectId(user_id),
        "user_name": user_name,
        "category": "Paiement",
        "action": action,
        "element": element,
        "ip_address": ip_address,
        "created_at": datetime.now(timezone.utc)
    })


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_payment(
    payment_data: PaymentCreate,
    request: Request,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    # Generate payment number
    numbering = company.get("numbering", {})
    prefix = numbering.get("payment_prefix", "PAY")
    next_num = numbering.get("payment_next", 1)
    number = f"{prefix}-{datetime.now().year}-{next_num:05d}"
    
    payment_dict = payment_data.dict()
    
    if isinstance(payment_dict.get('date'), str):
        payment_dict['date'] = datetime.fromisoformat(payment_dict['date'].replace('Z', '+00:00'))
    
    payment_dict.update({
        "company_id": ObjectId(company_id),
        "number": number,
        "status": "completed",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "created_by": current_user["_id"]
    })
    
    # Convert allocation invoice IDs to ObjectId
    for allocation in payment_dict["allocations"]:
        allocation["invoice_id"] = ObjectId(allocation["invoice_id"])
    
    # Convert customer/supplier ID
    if payment_dict.get("customer_id"):
        payment_dict["customer_id"] = ObjectId(payment_dict["customer_id"])
    if payment_dict.get("supplier_id"):
        payment_dict["supplier_id"] = ObjectId(payment_dict["supplier_id"])
    
    result = await db.payments.insert_one(payment_dict)
    
    # Update company numbering
    await db.companies.update_one(
        {"_id": ObjectId(company_id)},
        {"$inc": {"numbering.payment_next": 1}}
    )
    
    # Update invoices with payments
    for allocation in payment_data.allocations:
        invoice = await db.invoices.find_one({"_id": ObjectId(allocation.invoice_id)})
        if invoice:
            new_amount_paid = invoice.get("amount_paid", 0) + allocation.amount
            new_balance = invoice["total"] - new_amount_paid
            
            # Update invoice status
            new_status = "paid" if new_balance <= 0 else "partial"
            paid_at = datetime.now(timezone.utc) if new_status == "paid" else None
            
            await db.invoices.update_one(
                {"_id": ObjectId(allocation.invoice_id)},
                {
                    "$set": {
                        "amount_paid": new_amount_paid,
                        "balance_due": max(0, new_balance),
                        "status": new_status,
                        "paid_at": paid_at,
                        "updated_at": datetime.now(timezone.utc)
                    }
                }
            )
            
            # Update customer balance
            if payment_data.type == "received" and invoice.get("customer_id"):
                await db.customers.update_one(
                    {"_id": invoice["customer_id"]},
                    {
                        "$inc": {
                            "total_paid": allocation.amount,
                            "balance": -allocation.amount
                        }
                    }
                )
    
    await log_action(company_id, str(current_user["_id"]), current_user.get("full_name", ""), "Créer", number, request.client.host if request.client else None)
    
    # Synchronisation comptable : écriture de vente pour chaque facture allouée (si pas encore créée)
    for allocation in payment_data.allocations:
        try:
            inv = await db.invoices.find_one({"_id": allocation.invoice_id})
            if inv and not inv.get("accounting_entry_id"):
                await accounting_sync_service.sync_invoice(str(allocation.invoice_id))
        except Exception as e:
            logger.error(f"Erreur sync facture {allocation.invoice_id}: {str(e)}")
    
    # Synchronisation comptable : écriture de règlement (531/521 / 411)
    try:
        await accounting_sync_service.sync_payment(str(result.inserted_id))
    except Exception as e:
        logger.error(f"Erreur synchronisation comptable paiement {result.inserted_id}: {str(e)}")

    # ── Alimentation de la caisse pour les paiements en espèces ────────────
    try:
        payment_method = payment_data.payment_method
        if payment_data.type == "received":
            movement_type = "in"
            # Construire le label depuis les allocations
            if payment_data.allocations:
                inv = await db.invoices.find_one({"_id": ObjectId(payment_data.allocations[0].invoice_id)})
                inv_number = inv.get("number", "") if inv else ""
                label = f"Encaissement {inv_number} - {number}"
            else:
                label = f"Encaissement client - {number}"
        else:
            movement_type = "out"
            label = f"Décaissement fournisseur - {number}"

        # Résoudre le nom du client
        cust_name = None
        cust_id_str = None
        if payment_data.customer_id:
            cust = await db.customers.find_one({"_id": ObjectId(payment_data.customer_id)})
            cust_name = cust.get("display_name") if cust else None
            cust_id_str = payment_data.customer_id

        await auto_record_cash_movement(
            company_id=company_id,
            amount=payment_data.amount,
            movement_type=movement_type,
            label=label,
            payment_method=payment_method,
            customer_id=cust_id_str,
            customer_name=cust_name,
            invoice_id=payment_data.allocations[0].invoice_id if payment_data.allocations else None,
            reference=number,
            notes=payment_data.notes,
            movement_date=payment_data.date,
        )
    except Exception as e:
        logger.error(f"Erreur alimentation caisse paiement {result.inserted_id}: {str(e)}")

    return {"id": str(result.inserted_id), "number": number, "message": "Payment recorded successfully"}


@router.get("/")
async def list_payments(
    company_id: str = Query(...),
    type: str = Query(None),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    query = {"company_id": ObjectId(company_id)}
    if type:
        query["type"] = type
    
    payments = await db.payments.find(query).sort("created_at", -1).to_list(1000)
    
    # Populate customer/supplier names and invoice numbers
    for payment in payments:
        if payment.get("customer_id"):
            customer = await db.customers.find_one({"_id": payment["customer_id"]})
            payment["customer_name"] = customer.get("display_name", "Inconnu") if customer else "Inconnu"
        if payment.get("supplier_id"):
            supplier = await db.suppliers.find_one({"_id": payment["supplier_id"]})
            payment["supplier_name"] = supplier.get("display_name", "Inconnu") if supplier else "Inconnu"
        
        # Get invoice numbers for allocations
        for allocation in payment.get("allocations", []):
            if allocation.get("invoice_id"):
                invoice = await db.invoices.find_one({"_id": allocation["invoice_id"]})
                allocation["invoice_number"] = invoice.get("number") if invoice else None
    
    return [serialize_payment(p) for p in payments]


@router.get("/pending-invoices")
async def get_pending_invoices(
    company_id: str = Query(...),
    customer_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """Get invoices with outstanding balance for payment allocation"""
    company = await get_current_company(current_user, company_id)
    
    query = {
        "company_id": ObjectId(company_id),
        "balance_due": {"$gt": 0}
    }
    
    if customer_id:
        query["customer_id"] = ObjectId(customer_id)
    
    invoices = await db.invoices.find(query).sort("date", 1).to_list(1000)
    
    result = []
    for inv in invoices:
        customer = await db.customers.find_one({"_id": inv.get("customer_id")})
        result.append({
            "id": str(inv["_id"]),
            "number": inv.get("number"),
            "date": inv["date"].isoformat() if isinstance(inv.get("date"), datetime) else inv.get("date"),
            "customer_id": str(inv.get("customer_id")) if inv.get("customer_id") else None,
            "customer_name": customer.get("display_name", "") if customer else "",
            "total": inv.get("total", 0),
            "amount_paid": inv.get("amount_paid", 0),
            "balance_due": inv.get("balance_due", 0)
        })
    
    return result


@router.get("/{payment_id}")
async def get_payment(
    payment_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    payment = await db.payments.find_one({
        "_id": ObjectId(payment_id),
        "company_id": ObjectId(company_id)
    })
    
    if not payment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")
    
    if payment.get("customer_id"):
        customer = await db.customers.find_one({"_id": payment["customer_id"]})
        payment["customer_name"] = customer.get("display_name", "") if customer else ""
    
    return serialize_payment(payment)


@router.delete("/{payment_id}")
async def delete_payment(
    payment_id: str,
    request: Request,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    payment = await db.payments.find_one({
        "_id": ObjectId(payment_id),
        "company_id": ObjectId(company_id)
    })
    
    if not payment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")
    
    # Reverse the payment effects on invoices
    for allocation in payment.get("allocations", []):
        invoice = await db.invoices.find_one({"_id": allocation["invoice_id"]})
        if invoice:
            new_amount_paid = max(0, invoice.get("amount_paid", 0) - allocation["amount"])
            new_balance = invoice["total"] - new_amount_paid
            new_status = "paid" if new_balance <= 0 else "sent" if new_amount_paid == 0 else "partial"
            
            await db.invoices.update_one(
                {"_id": allocation["invoice_id"]},
                {
                    "$set": {
                        "amount_paid": new_amount_paid,
                        "balance_due": new_balance,
                        "status": new_status,
                        "paid_at": None if new_status != "paid" else invoice.get("paid_at"),
                        "updated_at": datetime.now(timezone.utc)
                    }
                }
            )
            
            # Reverse customer balance
            if payment.get("type") == "received" and invoice.get("customer_id"):
                await db.customers.update_one(
                    {"_id": invoice["customer_id"]},
                    {
                        "$inc": {
                            "total_paid": -allocation["amount"],
                            "balance": allocation["amount"]
                        }
                    }
                )
    
    await db.payments.delete_one({"_id": ObjectId(payment_id)})
    
    await log_action(company_id, str(current_user["_id"]), current_user.get("full_name", ""), "Supprimer", payment.get("number", ""), request.client.host if request.client else None)
    
    return {"message": "Payment deleted successfully"}
