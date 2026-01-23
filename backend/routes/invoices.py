from fastapi import APIRouter, HTTPException, status, Depends, Query
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime
import os
from typing import Optional
from models.invoice import Invoice, InvoiceCreate, InvoiceUpdate
from utils.dependencies import get_current_user, get_current_company
from utils.helpers import generate_document_number, calculate_document_totals

router = APIRouter(prefix="/api/invoices", tags=["Invoices"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_invoice(
    invoice_data: InvoiceCreate,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    # Generate invoice number
    invoice_number = generate_document_number(
        company["numbering"]["invoice_prefix"],
        company["numbering"]["invoice_next"],
        datetime.now().year
    )
    
    # Calculate totals
    items = [item.dict() for item in invoice_data.items]
    totals = calculate_document_totals(items)
    
    invoice_dict = invoice_data.dict(exclude={'items'})
    invoice_dict.update({
        "company_id": ObjectId(company_id),
        "customer_id": ObjectId(invoice_data.customer_id),
        "number": invoice_number,
        "items": items,
        **totals,
        "amount_paid": 0.0,
        "balance_due": totals["total"],
        "status": "draft",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "created_by": current_user["_id"]
    })
    
    result = await db.invoices.insert_one(invoice_dict)
    
    # Update company numbering
    await db.companies.update_one(
        {"_id": ObjectId(company_id)},
        {"$inc": {"numbering.invoice_next": 1}}
    )
    
    # Update customer stats
    await db.customers.update_one(
        {"_id": ObjectId(invoice_data.customer_id)},
        {
            "$inc": {
                "invoice_count": 1,
                "total_invoiced": totals["total"],
                "balance": totals["total"]
            }
        }
    )
    
    return {"id": str(result.inserted_id), "number": invoice_number, "message": "Invoice created successfully"}

@router.get("/")
async def list_invoices(
    company_id: str = Query(...),
    search: Optional[str] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    query = {"company_id": ObjectId(company_id)}
    if search:
        query["$or"] = [
            {"number": {"$regex": search, "$options": "i"}},
            {"subject": {"$regex": search, "$options": "i"}}
        ]
    if status:
        query["status"] = status
    
    invoices = await db.invoices.find(query).sort("date", -1).to_list(1000)
    
    # Populate customer names
    for invoice in invoices:
        customer = await db.customers.find_one({"_id": invoice["customer_id"]})
        invoice["customer_name"] = customer["display_name"] if customer else "Unknown"
    
    return [{"id": str(i["_id"]), **{k: v for k, v in i.items() if k != "_id"}} for i in invoices]

@router.get("/{invoice_id}")
async def get_invoice(
    invoice_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    invoice = await db.invoices.find_one({
        "_id": ObjectId(invoice_id),
        "company_id": ObjectId(company_id)
    })
    
    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    
    # Populate customer details
    customer = await db.customers.find_one({"_id": invoice["customer_id"]})
    invoice["customer"] = {"id": str(customer["_id"]), **{k: v for k, v in customer.items() if k != "_id"}} if customer else None
    
    return {"id": str(invoice["_id"]), **{k: v for k, v in invoice.items() if k != "_id"}}

@router.put("/{invoice_id}")
async def update_invoice(
    invoice_id: str,
    invoice_update: InvoiceUpdate,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    update_data = {k: v for k, v in invoice_update.dict(exclude_unset=True).items()}
    
    # Recalculate totals if items updated
    if 'items' in update_data:
        items = [item.dict() for item in update_data['items']]
        totals = calculate_document_totals(items)
        update_data.update(totals)
        update_data['items'] = items
        update_data['balance_due'] = totals['total'] - update_data.get('amount_paid', 0)
    
    update_data["updated_at"] = datetime.utcnow()
    
    result = await db.invoices.update_one(
        {"_id": ObjectId(invoice_id), "company_id": ObjectId(company_id)},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    
    return {"message": "Invoice updated successfully"}

@router.delete("/{invoice_id}")
async def delete_invoice(
    invoice_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    result = await db.invoices.delete_one({
        "_id": ObjectId(invoice_id),
        "company_id": ObjectId(company_id)
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    
    return {"message": "Invoice deleted successfully"}