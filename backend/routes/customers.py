from fastapi import APIRouter, HTTPException, status, Depends, Query, Request
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime, timezone
import os
from typing import List, Optional
from models.customer import Customer, CustomerCreate, CustomerUpdate
from utils.dependencies import get_current_user, get_current_company

router = APIRouter(prefix="/api/customers", tags=["Customers"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]


def serialize_customer(c: dict) -> dict:
    """Serialize customer document for JSON response."""
    result = {
        "id": str(c["_id"]),
        "first_name": c.get("first_name"),
        "last_name": c.get("last_name"),
        "company_name": c.get("company_name"),
        "display_name": c.get("display_name"),
        "email": c.get("email"),
        "phone": c.get("phone"),
        "mobile": c.get("mobile"),
        "fiscal_id": c.get("fiscal_id"),
        "activity": c.get("activity"),
        "currency": c.get("currency", "TND"),
        "billing_address": c.get("billing_address"),
        "shipping_address": c.get("shipping_address"),
        "notes": c.get("notes"),
        "balance": c.get("balance", 0.0),
        "total_invoiced": c.get("total_invoiced", 0.0),
        "total_paid": c.get("total_paid", 0.0),
        "invoices": c.get("invoice_count", 0),
        "quotes": c.get("quote_count", 0),
        "address": c.get("billing_address", {}).get("street", "") if c.get("billing_address") else "",
        "created_at": c["created_at"].isoformat() if c.get("created_at") else None,
        "updated_at": c["updated_at"].isoformat() if c.get("updated_at") else None
    }
    return result


async def log_customer_action(company_id, user_id, user_name, action, element, ip_address=None):
    """Log customer action."""
    await db.access_logs.insert_one({
        "company_id": ObjectId(company_id),
        "user_id": ObjectId(user_id),
        "user_name": user_name,
        "category": "Client",
        "action": action,
        "element": element,
        "ip_address": ip_address,
        "created_at": datetime.now(timezone.utc)
    })

@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_customer(
    customer_data: CustomerCreate,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    # Generate display_name
    if customer_data.company_name:
        display_name = customer_data.company_name
    elif customer_data.last_name:
        display_name = f"{customer_data.last_name}, {customer_data.first_name}"
    else:
        display_name = customer_data.first_name
    
    customer_dict = customer_data.dict(exclude_unset=True)
    customer_dict.update({
        "company_id": ObjectId(company_id),
        "display_name": display_name,
        "balance": 0.0,
        "total_invoiced": 0.0,
        "total_paid": 0.0,
        "invoice_count": 0,
        "quote_count": 0,
        "public_access": {"enabled": False},
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "created_by": current_user["_id"]
    })
    
    result = await db.customers.insert_one(customer_dict)
    return {"id": str(result.inserted_id), "message": "Customer created successfully"}

@router.get("/")
async def list_customers(
    company_id: str = Query(...),
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    query = {"company_id": ObjectId(company_id)}
    if search:
        query["$or"] = [
            {"first_name": {"$regex": search, "$options": "i"}},
            {"last_name": {"$regex": search, "$options": "i"}},
            {"company_name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}}
        ]
    
    customers = await db.customers.find(query).to_list(1000)
    return [{"id": str(c["_id"]), **{k: v for k, v in c.items() if k != "_id"}} for c in customers]

@router.get("/{customer_id}")
async def get_customer(
    customer_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    customer = await db.customers.find_one({
        "_id": ObjectId(customer_id),
        "company_id": ObjectId(company_id)
    })
    
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    
    return {"id": str(customer["_id"]), **{k: v for k, v in customer.items() if k != "_id"}}

@router.put("/{customer_id}")
async def update_customer(
    customer_id: str,
    customer_update: CustomerUpdate,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    update_data = {k: v for k, v in customer_update.dict(exclude_unset=True).items()}
    update_data["updated_at"] = datetime.utcnow()
    
    # Update display_name if relevant fields changed
    if any(k in update_data for k in ['first_name', 'last_name', 'company_name']):
        customer = await db.customers.find_one({"_id": ObjectId(customer_id)})
        first_name = update_data.get('first_name', customer.get('first_name'))
        last_name = update_data.get('last_name', customer.get('last_name'))
        company_name = update_data.get('company_name', customer.get('company_name'))
        
        if company_name:
            update_data['display_name'] = company_name
        elif last_name:
            update_data['display_name'] = f"{last_name}, {first_name}"
        else:
            update_data['display_name'] = first_name
    
    result = await db.customers.update_one(
        {"_id": ObjectId(customer_id), "company_id": ObjectId(company_id)},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    
    return {"message": "Customer updated successfully"}

@router.delete("/{customer_id}")
async def delete_customer(
    customer_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    result = await db.customers.delete_one({
        "_id": ObjectId(customer_id),
        "company_id": ObjectId(company_id)
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    
    return {"message": "Customer deleted successfully"}

@router.get("/{customer_id}/stats")
async def get_customer_stats(
    customer_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    customer = await db.customers.find_one({
        "_id": ObjectId(customer_id),
        "company_id": ObjectId(company_id)
    })
    
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    
    # Get invoices
    invoices = await db.invoices.find({
        "company_id": ObjectId(company_id),
        "customer_id": ObjectId(customer_id)
    }).to_list(1000)
    
    # Get quotes
    quotes = await db.quotes.find({
        "company_id": ObjectId(company_id),
        "customer_id": ObjectId(customer_id)
    }).to_list(1000)
    
    # Get payments
    payments = await db.payments.find({
        "company_id": ObjectId(company_id),
        "customer_id": ObjectId(customer_id)
    }).to_list(1000)
    
    return {
        "customer": {"id": str(customer["_id"]), **{k: v for k, v in customer.items() if k != "_id"}},
        "invoices": {
            "count": len(invoices),
            "total": sum(inv.get("total", 0) for inv in invoices),
            "paid": sum(inv.get("amount_paid", 0) for inv in invoices)
        },
        "quotes": {
            "count": len(quotes),
            "total": sum(q.get("total", 0) for q in quotes)
        },
        "payments": {
            "count": len(payments),
            "total": sum(p.get("amount", 0) for p in payments)
        }
    }