from fastapi import APIRouter, HTTPException, status, Depends, Query
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime
import os
from typing import Optional
from models.supplier import Supplier, SupplierCreate, SupplierUpdate
from utils.dependencies import get_current_user, get_current_company

router = APIRouter(prefix="/api/suppliers", tags=["Suppliers"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_supplier(
    supplier_data: SupplierCreate,
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
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "created_by": current_user["_id"]
    })
    
    result = await db.suppliers.insert_one(supplier_dict)
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
    return [{"id": str(s["_id"]), **{k: v for k, v in s.items() if k != "_id"}} for s in suppliers]

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
    
    return {"id": str(supplier["_id"]), **{k: v for k, v in supplier.items() if k != "_id"}}

@router.put("/{supplier_id}")
async def update_supplier(
    supplier_id: str,
    supplier_update: SupplierUpdate,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    update_data = {k: v for k, v in supplier_update.dict(exclude_unset=True).items()}
    update_data["updated_at"] = datetime.utcnow()
    
    result = await db.suppliers.update_one(
        {"_id": ObjectId(supplier_id), "company_id": ObjectId(company_id)},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")
    
    return {"message": "Supplier updated successfully"}

@router.delete("/{supplier_id}")
async def delete_supplier(
    supplier_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    result = await db.suppliers.delete_one({
        "_id": ObjectId(supplier_id),
        "company_id": ObjectId(company_id)
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")
    
    return {"message": "Supplier deleted successfully"}