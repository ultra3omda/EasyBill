from fastapi import APIRouter, HTTPException, status, Depends, Query
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime
import os
from typing import Optional
from models.quote import Quote, QuoteCreate, QuoteUpdate
from utils.dependencies import get_current_user, get_current_company
from utils.helpers import generate_document_number, calculate_document_totals

router = APIRouter(prefix="/api/quotes", tags=["Quotes"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_quote(
    quote_data: QuoteCreate,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    # Generate quote number
    quote_number = generate_document_number(
        company["numbering"]["quote_prefix"],
        company["numbering"]["quote_next"],
        datetime.now().year
    )
    
    # Calculate totals
    items = [item.dict() for item in quote_data.items]
    totals = calculate_document_totals(items)
    
    quote_dict = quote_data.dict(exclude={'items'})
    quote_dict.update({
        "company_id": ObjectId(company_id),
        "customer_id": ObjectId(quote_data.customer_id),
        "number": quote_number,
        "items": items,
        **totals,
        "status": "draft",
        "converted_to_invoice": False,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "created_by": current_user["_id"]
    })
    
    result = await db.quotes.insert_one(quote_dict)
    
    # Update company numbering
    await db.companies.update_one(
        {"_id": ObjectId(company_id)},
        {"$inc": {"numbering.quote_next": 1}}
    )
    
    # Update customer quote count
    await db.customers.update_one(
        {"_id": ObjectId(quote_data.customer_id)},
        {"$inc": {"quote_count": 1}}
    )
    
    return {"id": str(result.inserted_id), "number": quote_number, "message": "Quote created successfully"}

@router.get("/")
async def list_quotes(
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
    
    quotes = await db.quotes.find(query).sort("date", -1).to_list(1000)
    
    # Populate customer names
    for quote in quotes:
        customer = await db.customers.find_one({"_id": quote["customer_id"]})
        quote["customer_name"] = customer["display_name"] if customer else "Unknown"
    
    return [{"id": str(q["_id"]), **{k: v for k, v in q.items() if k != "_id"}} for q in quotes]

@router.get("/{quote_id}")
async def get_quote(
    quote_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    quote = await db.quotes.find_one({
        "_id": ObjectId(quote_id),
        "company_id": ObjectId(company_id)
    })
    
    if not quote:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quote not found")
    
    # Populate customer details
    customer = await db.customers.find_one({"_id": quote["customer_id"]})
    quote["customer"] = {"id": str(customer["_id"]), **{k: v for k, v in customer.items() if k != "_id"}} if customer else None
    
    return {"id": str(quote["_id"]), **{k: v for k, v in quote.items() if k != "_id"}}

@router.put("/{quote_id}")
async def update_quote(
    quote_id: str,
    quote_update: QuoteUpdate,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    update_data = {k: v for k, v in quote_update.dict(exclude_unset=True).items()}
    
    # Recalculate totals if items updated
    if 'items' in update_data:
        items = [item.dict() for item in update_data['items']]
        totals = calculate_document_totals(items)
        update_data.update(totals)
        update_data['items'] = items
    
    update_data["updated_at"] = datetime.utcnow()
    
    result = await db.quotes.update_one(
        {"_id": ObjectId(quote_id), "company_id": ObjectId(company_id)},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quote not found")
    
    return {"message": "Quote updated successfully"}

@router.delete("/{quote_id}")
async def delete_quote(
    quote_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    result = await db.quotes.delete_one({
        "_id": ObjectId(quote_id),
        "company_id": ObjectId(company_id)
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quote not found")
    
    return {"message": "Quote deleted successfully"}

@router.post("/{quote_id}/convert")
async def convert_to_invoice(
    quote_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    quote = await db.quotes.find_one({
        "_id": ObjectId(quote_id),
        "company_id": ObjectId(company_id)
    })
    
    if not quote:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quote not found")
    
    if quote.get("converted_to_invoice"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Quote already converted")
    
    # Generate invoice number
    invoice_number = generate_document_number(
        company["numbering"]["invoice_prefix"],
        company["numbering"]["invoice_next"],
        datetime.now().year
    )
    
    # Create invoice from quote
    invoice_dict = {
        "company_id": quote["company_id"],
        "number": invoice_number,
        "date": datetime.utcnow(),
        "due_date": datetime.utcnow(),  # Default: same day
        "customer_id": quote["customer_id"],
        "subject": quote.get("subject"),
        "items": quote["items"],
        "subtotal": quote["subtotal"],
        "total_tax": quote["total_tax"],
        "total_discount": quote["total_discount"],
        "total": quote["total"],
        "amount_paid": 0.0,
        "balance_due": quote["total"],
        "payment_terms": quote.get("payment_terms"),
        "notes": quote.get("notes"),
        "language": quote.get("language", "fr"),
        "status": "draft",
        "is_recurring": False,
        "quote_id": quote["_id"],
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "created_by": current_user["_id"]
    }
    
    result = await db.invoices.insert_one(invoice_dict)
    
    # Update quote
    await db.quotes.update_one(
        {"_id": ObjectId(quote_id)},
        {"$set": {"converted_to_invoice": True, "invoice_id": result.inserted_id, "status": "accepted"}}
    )
    
    # Update company numbering
    await db.companies.update_one(
        {"_id": ObjectId(company_id)},
        {"$inc": {"numbering.invoice_next": 1}}
    )
    
    return {"id": str(result.inserted_id), "number": invoice_number, "message": "Quote converted to invoice"}