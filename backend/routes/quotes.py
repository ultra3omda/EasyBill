from fastapi import APIRouter, HTTPException, status, Depends, Query, Request
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime, timezone
import os
import logging
from typing import Optional
from models.quote import Quote, QuoteCreate, QuoteUpdate
from utils.dependencies import get_current_user, get_current_company
from utils.helpers import generate_document_number, calculate_document_totals
from services.email_service import email_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/quotes", tags=["Quotes"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]


def serialize_quote(q: dict) -> dict:
    """Serialize quote document for JSON response."""
    return {
        "id": str(q["_id"]),
        "company_id": str(q.get("company_id")) if q.get("company_id") else None,
        "customer_id": str(q.get("customer_id")) if q.get("customer_id") else None,
        "customer_name": q.get("customer_name", ""),
        "number": q.get("number"),
        "date": q["date"].isoformat() if isinstance(q.get("date"), datetime) else q.get("date"),
        "valid_until": q["valid_until"].isoformat() if isinstance(q.get("valid_until"), datetime) else q.get("valid_until"),
        "subject": q.get("subject"),
        "items": q.get("items", []),
        "subtotal": q.get("subtotal", 0),
        "total_tax": q.get("total_tax", 0),
        "total_discount": q.get("total_discount", 0),
        "total": q.get("total", 0),
        "status": q.get("status", "draft"),
        "converted_to_invoice": q.get("converted_to_invoice", False),
        "invoice_id": str(q.get("invoice_id")) if q.get("invoice_id") else None,
        "notes": q.get("notes"),
        "payment_terms": q.get("payment_terms"),
        "created_at": q["created_at"].isoformat() if isinstance(q.get("created_at"), datetime) else q.get("created_at"),
        "updated_at": q["updated_at"].isoformat() if isinstance(q.get("updated_at"), datetime) else q.get("updated_at")
    }


async def log_quote_action(company_id, user_id, user_name, action, element, ip_address=None):
    """Log quote action."""
    await db.access_logs.insert_one({
        "company_id": ObjectId(company_id),
        "user_id": ObjectId(user_id),
        "user_name": user_name,
        "category": "Devis",
        "action": action,
        "element": element,
        "ip_address": ip_address,
        "created_at": datetime.now(timezone.utc)
    })


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_quote(
    quote_data: QuoteCreate,
    request: Request,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    # Get numbering settings with defaults
    numbering = company.get("numbering", {})
    quote_prefix = numbering.get("quote_prefix", "DEV")
    quote_next = numbering.get("quote_next", 1)
    
    # Generate quote number
    quote_number = generate_document_number(
        quote_prefix,
        quote_next,
        datetime.now().year
    )
    
    # Calculate totals
    items = [item.dict() for item in quote_data.items]
    totals = calculate_document_totals(items)
    
    quote_dict = quote_data.dict(exclude={'items'})
    
    # Convert date strings to datetime if needed
    if isinstance(quote_dict.get('date'), str):
        quote_dict['date'] = datetime.fromisoformat(quote_dict['date'].replace('Z', '+00:00'))
    if isinstance(quote_dict.get('valid_until'), str):
        quote_dict['valid_until'] = datetime.fromisoformat(quote_dict['valid_until'].replace('Z', '+00:00'))
    
    quote_dict.update({
        "company_id": ObjectId(company_id),
        "customer_id": ObjectId(quote_data.customer_id),
        "number": quote_number,
        "items": items,
        **totals,
        "status": "draft",
        "converted_to_invoice": False,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
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
    
    # Log action
    await log_quote_action(
        company_id, str(current_user["_id"]), current_user.get("full_name", ""),
        "Créer", quote_number, request.client.host if request.client else None
    )
    
    return {"id": str(result.inserted_id), "number": quote_number, "message": "Quote created successfully"}

@router.get("/")
async def list_quotes(
    company_id: str = Query(...),
    search: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    query = {"company_id": ObjectId(company_id)}
    if search:
        query["$or"] = [
            {"number": {"$regex": search, "$options": "i"}},
            {"subject": {"$regex": search, "$options": "i"}}
        ]
    if status_filter:
        query["status"] = status_filter
    
    quotes = await db.quotes.find(query).sort("created_at", -1).to_list(1000)
    
    # Populate customer names
    for quote in quotes:
        if quote.get("customer_id"):
            customer = await db.customers.find_one({"_id": quote["customer_id"]})
            quote["customer_name"] = customer.get("display_name", "Inconnu") if customer else "Inconnu"
        else:
            quote["customer_name"] = "Inconnu"
    
    return [serialize_quote(q) for q in quotes]


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
    if quote.get("customer_id"):
        customer = await db.customers.find_one({"_id": quote["customer_id"]})
        if customer:
            quote["customer_name"] = customer.get("display_name", "")
            quote["customer"] = {
                "id": str(customer["_id"]),
                "display_name": customer.get("display_name"),
                "email": customer.get("email"),
                "phone": customer.get("phone"),
                "address": customer.get("billing_address")
            }
    
    return serialize_quote(quote)


@router.put("/{quote_id}")
async def update_quote(
    quote_id: str,
    quote_update: QuoteUpdate,
    request: Request,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    # Get existing quote for logging
    existing = await db.quotes.find_one({"_id": ObjectId(quote_id)})
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quote not found")
    
    update_data = {k: v for k, v in quote_update.dict(exclude_unset=True).items()}
    
    # Recalculate totals if items updated
    if 'items' in update_data and update_data['items']:
        items = [item.dict() if hasattr(item, 'dict') else item for item in update_data['items']]
        totals = calculate_document_totals(items)
        update_data.update(totals)
        update_data['items'] = items
    
    # Handle customer_id update
    if 'customer_id' in update_data and update_data['customer_id']:
        update_data['customer_id'] = ObjectId(update_data['customer_id'])
    
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    result = await db.quotes.update_one(
        {"_id": ObjectId(quote_id), "company_id": ObjectId(company_id)},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quote not found")
    
    # Log action
    await log_quote_action(
        company_id, str(current_user["_id"]), current_user.get("full_name", ""),
        "Modifier", existing.get("number", ""), request.client.host if request.client else None
    )
    
    return {"message": "Quote updated successfully"}


@router.delete("/{quote_id}")
async def delete_quote(
    quote_id: str,
    request: Request,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    # Get quote before deletion for logging
    quote = await db.quotes.find_one({
        "_id": ObjectId(quote_id),
        "company_id": ObjectId(company_id)
    })
    
    if not quote:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quote not found")
    
    result = await db.quotes.delete_one({
        "_id": ObjectId(quote_id),
        "company_id": ObjectId(company_id)
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quote not found")
    
    # Update customer stats if customer exists
    if quote.get("customer_id"):
        await db.customers.update_one(
            {"_id": quote["customer_id"]},
            {"$inc": {"quote_count": -1}}
        )
    
    # Log action
    await log_quote_action(
        company_id, str(current_user["_id"]), current_user.get("full_name", ""),
        "Supprimer", quote.get("number", ""), request.client.host if request.client else None
    )
    
    return {"message": "Quote deleted successfully"}


@router.post("/{quote_id}/send")
async def send_quote(
    quote_id: str,
    request: Request,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Mark quote as sent."""
    company = await get_current_company(current_user, company_id)
    
    quote = await db.quotes.find_one({
        "_id": ObjectId(quote_id),
        "company_id": ObjectId(company_id)
    })
    
    if not quote:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quote not found")
    
    await db.quotes.update_one(
        {"_id": ObjectId(quote_id)},
        {
            "$set": {
                "status": "sent",
                "sent_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    await log_quote_action(
        company_id, str(current_user["_id"]), current_user.get("full_name", ""),
        "Envoyer", quote.get("number", ""), request.client.host if request.client else None
    )
    
    return {"message": "Quote marked as sent"}


@router.post("/{quote_id}/accept")
async def accept_quote(
    quote_id: str,
    request: Request,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Mark quote as accepted."""
    company = await get_current_company(current_user, company_id)
    
    quote = await db.quotes.find_one({
        "_id": ObjectId(quote_id),
        "company_id": ObjectId(company_id)
    })
    
    if not quote:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quote not found")
    
    await db.quotes.update_one(
        {"_id": ObjectId(quote_id)},
        {
            "$set": {
                "status": "accepted",
                "accepted_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    await log_quote_action(
        company_id, str(current_user["_id"]), current_user.get("full_name", ""),
        "Accepter", quote.get("number", ""), request.client.host if request.client else None
    )
    
    return {"message": "Quote accepted"}

@router.post("/{quote_id}/convert")
async def convert_to_invoice(
    quote_id: str,
    request: Request,
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
    
    # Get numbering settings with defaults
    numbering = company.get("numbering", {})
    invoice_prefix = numbering.get("invoice_prefix", "FAC")
    invoice_next = numbering.get("invoice_next", 1)
    
    # Generate invoice number
    invoice_number = generate_document_number(
        invoice_prefix,
        invoice_next,
        datetime.now().year
    )
    
    # Create invoice from quote
    invoice_dict = {
        "company_id": quote["company_id"],
        "number": invoice_number,
        "date": datetime.now(timezone.utc),
        "due_date": datetime.now(timezone.utc),  # Default: same day
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
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "created_by": current_user["_id"]
    }
    
    result = await db.invoices.insert_one(invoice_dict)
    
    # Update quote
    await db.quotes.update_one(
        {"_id": ObjectId(quote_id)},
        {"$set": {
            "converted_to_invoice": True, 
            "invoice_id": result.inserted_id, 
            "status": "accepted",
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    # Update company numbering
    await db.companies.update_one(
        {"_id": ObjectId(company_id)},
        {"$inc": {"numbering.invoice_next": 1}}
    )
    
    # Update customer invoice count
    await db.customers.update_one(
        {"_id": quote["customer_id"]},
        {"$inc": {
            "invoice_count": 1,
            "total_invoiced": quote["total"],
            "balance": quote["total"]
        }}
    )
    
    # Log action
    await log_quote_action(
        company_id, str(current_user["_id"]), current_user.get("full_name", ""),
        "Convertir en facture", f"{quote.get('number', '')} -> {invoice_number}",
        request.client.host if request.client else None
    )
    
    return {"id": str(result.inserted_id), "number": invoice_number, "message": "Quote converted to invoice"}