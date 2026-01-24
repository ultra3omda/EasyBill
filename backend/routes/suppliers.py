from fastapi import APIRouter, HTTPException, status, Depends, Query, Request
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime, timezone
import os
from typing import Optional
from models.supplier import Supplier, SupplierCreate, SupplierUpdate
from utils.dependencies import get_current_user, get_current_company

router = APIRouter(prefix="/api/suppliers", tags=["Suppliers"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]


def serialize_supplier(s: dict) -> dict:
    """Serialize supplier document for JSON response."""
    return {
        "id": str(s["_id"]),
        "title": s.get("title", "mr"),
        "first_name": s.get("first_name"),
        "last_name": s.get("last_name"),
        "company_name": s.get("company_name"),
        "display_name": s.get("display_name"),
        "reference": s.get("reference"),
        "email": s.get("email"),
        "phone": s.get("phone"),
        "mobile": s.get("mobile"),
        "website": s.get("website"),
        "supplier_type": s.get("supplier_type", "entreprise"),
        "fiscal_id": s.get("fiscal_id"),
        "identity_number": s.get("identity_number"),
        "activity": s.get("activity"),
        "currency": s.get("currency", "TND"),
        "payment_terms": s.get("payment_terms", "immediate"),
        "billing_address": s.get("billing_address"),
        "shipping_address": s.get("shipping_address"),
        "notes": s.get("notes"),
        "balance": s.get("balance", 0.0),
        "total_purchases": s.get("total_purchases", 0.0),
        "total_paid": s.get("total_paid", 0.0),
        "purchases": s.get("purchase_order_count", 0),
        "address": s.get("billing_address", {}).get("street", "") if s.get("billing_address") else "",
        "created_at": s["created_at"].isoformat() if s.get("created_at") else None,
        "updated_at": s["updated_at"].isoformat() if s.get("updated_at") else None
    }


async def log_supplier_action(company_id, user_id, user_name, action, element, ip_address=None):
    """Log supplier action."""
    await db.access_logs.insert_one({
        "company_id": ObjectId(company_id),
        "user_id": ObjectId(user_id),
        "user_name": user_name,
        "category": "Fournisseur",
        "action": action,
        "element": element,
        "ip_address": ip_address,
        "created_at": datetime.now(timezone.utc)
    })


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_supplier(
    supplier_data: SupplierCreate,
    request: Request,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    # Generate display_name
    if supplier_data.company_name:
        display_name = supplier_data.company_name
    elif supplier_data.last_name:
        display_name = f"{supplier_data.last_name}, {supplier_data.first_name}"
    else:
        display_name = supplier_data.first_name
    
    supplier_dict = supplier_data.dict(exclude_unset=True)
    supplier_dict.update({
        "company_id": ObjectId(company_id),
        "display_name": display_name,
        "balance": 0.0,
        "total_purchased": 0.0,
        "total_paid": 0.0,
        "purchase_order_count": 0,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "created_by": current_user["_id"]
    })
    
    result = await db.suppliers.insert_one(supplier_dict)
    
    await log_supplier_action(
        company_id, str(current_user["_id"]), current_user.get("full_name", ""),
        "Créer", display_name, request.client.host if request.client else None
    )
    
    return {"id": str(result.inserted_id), "message": "Supplier created successfully"}


@router.get("/")
async def list_suppliers(
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
    
    suppliers = await db.suppliers.find(query).to_list(1000)
    return [serialize_supplier(s) for s in suppliers]


@router.get("/{supplier_id}")
async def get_supplier(
    supplier_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    supplier = await db.suppliers.find_one({
        "_id": ObjectId(supplier_id),
        "company_id": ObjectId(company_id)
    })
    
    if not supplier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")
    
    return serialize_supplier(supplier)


@router.put("/{supplier_id}")
async def update_supplier(
    supplier_id: str,
    supplier_update: SupplierUpdate,
    request: Request,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    update_data = {k: v for k, v in supplier_update.dict(exclude_unset=True).items()}
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    supplier = await db.suppliers.find_one({"_id": ObjectId(supplier_id)})
    
    result = await db.suppliers.update_one(
        {"_id": ObjectId(supplier_id), "company_id": ObjectId(company_id)},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")
    
    await log_supplier_action(
        company_id, str(current_user["_id"]), current_user.get("full_name", ""),
        "Mise à jour", supplier.get("display_name", ""), request.client.host if request.client else None
    )
    
    return {"message": "Supplier updated successfully"}


@router.delete("/{supplier_id}")
async def delete_supplier(
    supplier_id: str,
    request: Request,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    supplier = await db.suppliers.find_one({"_id": ObjectId(supplier_id)})
    if not supplier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")
    
    result = await db.suppliers.delete_one({
        "_id": ObjectId(supplier_id),
        "company_id": ObjectId(company_id)
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")
    
    await log_supplier_action(
        company_id, str(current_user["_id"]), current_user.get("full_name", ""),
        "Supprimer", supplier.get("display_name", ""), request.client.host if request.client else None
    )
    
    return {"message": "Supplier deleted successfully"}
