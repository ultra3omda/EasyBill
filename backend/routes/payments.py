from fastapi import APIRouter, HTTPException, status, Depends, Query
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime
import os
from models.payment import Payment, PaymentCreate
from utils.dependencies import get_current_user, get_current_company

router = APIRouter(prefix="/api/payments", tags=["Payments"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_payment(
    payment_data: PaymentCreate,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    payment_dict = payment_data.dict()
    payment_dict.update({
        "company_id": ObjectId(company_id),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
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
    
    # Update invoices with payments
    for allocation in payment_data.allocations:
        invoice = await db.invoices.find_one({"_id": ObjectId(allocation.invoice_id)})
        if invoice:
            new_amount_paid = invoice.get("amount_paid", 0) + allocation.amount
            new_balance = invoice["total"] - new_amount_paid
            
            # Update invoice status
            new_status = "paid" if new_balance <= 0 else "partial"
            if new_status == "paid":
                paid_at = datetime.utcnow()
            else:
                paid_at = None
            
            await db.invoices.update_one(
                {"_id": ObjectId(allocation.invoice_id)},
                {
                    "$set": {
                        "amount_paid": new_amount_paid,
                        "balance_due": new_balance,
                        "status": new_status,
                        "paid_at": paid_at
                    }
                }
            )
            
            # Update customer balance
            if payment_data.type == "received":
                await db.customers.update_one(
                    {"_id": invoice["customer_id"]},
                    {
                        "$inc": {
                            "total_paid": allocation.amount,
                            "balance": -allocation.amount
                        }
                    }
                )
    
    return {"id": str(result.inserted_id), "message": "Payment recorded successfully"}

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
    
    payments = await db.payments.find(query).sort("date", -1).to_list(1000)
    
    # Populate customer/supplier names
    for payment in payments:
        if payment.get("customer_id"):
            customer = await db.customers.find_one({"_id": payment["customer_id"]})
            payment["customer_name"] = customer["display_name"] if customer else "Unknown"
        if payment.get("supplier_id"):
            supplier = await db.suppliers.find_one({"_id": payment["supplier_id"]})
            payment["supplier_name"] = supplier["display_name"] if supplier else "Unknown"
    
    return [{"id": str(p["_id"]), **{k: v for k, v in p.items() if k != "_id"}} for p in payments]

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
    
    return {"id": str(payment["_id"]), **{k: v for k, v in payment.items() if k != "_id"}}

@router.delete("/{payment_id}")
async def delete_payment(
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
                        "paid_at": None if new_status != "paid" else invoice.get("paid_at")
                    }
                }
            )
    
    result = await db.payments.delete_one({"_id": ObjectId(payment_id)})
    
    return {"message": "Payment deleted successfully"}