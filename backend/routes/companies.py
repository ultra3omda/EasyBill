from fastapi import APIRouter, HTTPException, status, Depends
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime
import os
from typing import List
from models.company import Company, CompanyCreate, CompanyUpdate
from utils.dependencies import get_current_user, get_current_company

router = APIRouter(prefix="/api/companies", tags=["Companies"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_company(company_data: CompanyCreate, current_user: dict = Depends(get_current_user)):
    company_dict = company_data.dict(exclude_unset=True)
    company_dict.update({
        "owner_id": current_user["_id"],
        "primary_currency": company_data.primary_currency or "TND",
        "taxes": [{"name": "TVA", "rate": 19.0, "default": True}],
        "banks": [],
        "numbering": {
            "invoice_prefix": "INV",
            "invoice_next": 1,
            "quote_prefix": "QUO",
            "quote_next": 1,
            "delivery_prefix": "BL",
            "delivery_next": 1,
            "exit_prefix": "BS",
            "exit_next": 1,
            "credit_prefix": "AV",
            "credit_next": 1,
            "purchase_order_prefix": "BC",
            "purchase_order_next": 1
        },
        "pdf_settings": {
            "show_logo": True,
            "show_addresses": True,
            "show_product_images": False,
            "show_prices": True
        },
        "collaborators": [],
        "subscription": {
            "plan": "free",
            "status": "active"
        },
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    })
    
    result = await db.companies.insert_one(company_dict)
    company_dict["_id"] = result.inserted_id
    
    return {"id": str(result.inserted_id), **company_dict}

@router.get("/")
async def list_companies(current_user: dict = Depends(get_current_user)):
    companies = await db.companies.find(
        {"$or": [
            {"owner_id": current_user["_id"]},
            {"collaborators.user_id": current_user["_id"], "collaborators.status": "active"}
        ]}
    ).to_list(100)
    
    return [{"id": str(c["_id"]), **{k: v for k, v in c.items() if k != "_id"}} for c in companies]

@router.get("/{company_id}")
async def get_company(company_id: str, current_user: dict = Depends(get_current_user)):
    company = await get_current_company(current_user, company_id)
    return {"id": str(company["_id"]), **{k: v for k, v in company.items() if k != "_id"}}

@router.put("/{company_id}")
async def update_company(company_id: str, company_update: CompanyUpdate, current_user: dict = Depends(get_current_user)):
    company = await get_current_company(current_user, company_id)
    
    # Only owner can update company
    if str(company["owner_id"]) != str(current_user["_id"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only company owner can update company details"
        )
    
    update_data = {k: v for k, v in company_update.dict(exclude_unset=True).items()}
    update_data["updated_at"] = datetime.utcnow()
    
    await db.companies.update_one(
        {"_id": ObjectId(company_id)},
        {"$set": update_data}
    )
    
    return {"message": "Company updated successfully"}

@router.delete("/{company_id}")
async def delete_company(company_id: str, current_user: dict = Depends(get_current_user)):
    company = await get_current_company(current_user, company_id)
    
    # Only owner can delete company
    if str(company["owner_id"]) != str(current_user["_id"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only company owner can delete company"
        )
    
    await db.companies.delete_one({"_id": ObjectId(company_id)})
    
    return {"message": "Company deleted successfully"}

@router.get("/{company_id}/dashboard")
async def get_dashboard(company_id: str, current_user: dict = Depends(get_current_user)):
    company = await get_current_company(current_user, company_id)
    
    # Get dashboard statistics
    total_customers = await db.customers.count_documents({"company_id": ObjectId(company_id)})
    total_suppliers = await db.suppliers.count_documents({"company_id": ObjectId(company_id)})
    total_products = await db.products.count_documents({"company_id": ObjectId(company_id)})
    
    # Get invoice stats
    invoices = await db.invoices.find({"company_id": ObjectId(company_id)}).to_list(1000)
    total_invoiced = sum(inv.get("total", 0) for inv in invoices)
    total_paid = sum(inv.get("amount_paid", 0) for inv in invoices)
    total_due = total_invoiced - total_paid
    
    # Get quotes stats
    quotes = await db.quotes.find({"company_id": ObjectId(company_id)}).to_list(1000)
    total_quotes = sum(q.get("total", 0) for q in quotes)
    
    return {
        "customers": total_customers,
        "suppliers": total_suppliers,
        "products": total_products,
        "invoices": {
            "count": len(invoices),
            "total": total_invoiced,
            "paid": total_paid,
            "due": total_due
        },
        "quotes": {
            "count": len(quotes),
            "total": total_quotes
        }
    }