from fastapi import APIRouter, HTTPException, status, Depends, Query, Request
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime, timezone
import os
from typing import Optional
from pydantic import BaseModel, Field
from utils.dependencies import get_current_user, get_current_company

router = APIRouter(prefix="/api/warehouses", tags=["Warehouses"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]


class WarehouseCreate(BaseModel):
    name: str
    code: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    phone: Optional[str] = None
    manager: Optional[str] = None
    is_default: bool = False
    notes: Optional[str] = None


class WarehouseUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    phone: Optional[str] = None
    manager: Optional[str] = None
    is_default: Optional[bool] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


def serialize_warehouse(w: dict) -> dict:
    return {
        "id": str(w["_id"]),
        "company_id": str(w.get("company_id")) if w.get("company_id") else None,
        "name": w.get("name"),
        "code": w.get("code"),
        "address": w.get("address"),
        "city": w.get("city"),
        "phone": w.get("phone"),
        "manager": w.get("manager"),
        "is_default": w.get("is_default", False),
        "is_active": w.get("is_active", True),
        "notes": w.get("notes"),
        "product_count": w.get("product_count", 0),
        "total_value": w.get("total_value", 0),
        "created_at": w["created_at"].isoformat() if isinstance(w.get("created_at"), datetime) else w.get("created_at")
    }


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_warehouse(data: WarehouseCreate, company_id: str = Query(...), current_user: dict = Depends(get_current_user)):
    company = await get_current_company(current_user, company_id)
    
    # Generate code if not provided
    if not data.code:
        count = await db.warehouses.count_documents({"company_id": ObjectId(company_id)})
        data.code = f"ENT{count + 1:03d}"
    
    # Si c'est le premier entrepôt, le définir comme défaut automatiquement
    existing_count = await db.warehouses.count_documents({"company_id": ObjectId(company_id)})
    if existing_count == 0:
        data.is_default = True

    # If this is default, unset others
    if data.is_default:
        await db.warehouses.update_many({"company_id": ObjectId(company_id)}, {"$set": {"is_default": False}})
    
    warehouse_dict = data.dict()
    warehouse_dict.update({
        "company_id": ObjectId(company_id),
        "is_active": True,
        "product_count": 0,
        "total_value": 0,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    })
    
    result = await db.warehouses.insert_one(warehouse_dict)
    return {"id": str(result.inserted_id), "code": data.code, "message": "Warehouse created"}


@router.get("/")
async def list_warehouses(company_id: str = Query(...), current_user: dict = Depends(get_current_user)):
    company = await get_current_company(current_user, company_id)
    warehouses = await db.warehouses.find({"company_id": ObjectId(company_id)}).sort("name", 1).to_list(100)
    
    # Auto-create default warehouse if none exists
    if len(warehouses) == 0:
        default_warehouse = {
            "company_id": ObjectId(company_id),
            "name": "Entrepôt Principal",
            "code": "ENT001",
            "address": "",
            "is_default": True,
            "is_active": True,
            "product_count": 0,
            "total_value": 0,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
        await db.warehouses.insert_one(default_warehouse)
        warehouses = await db.warehouses.find({"company_id": ObjectId(company_id)}).sort("name", 1).to_list(100)
    
    # Si aucun entrepôt n'est marqué is_default, le premier devient automatiquement défaut
    has_default = any(w.get("is_default") for w in warehouses)
    if not has_default and len(warehouses) > 0:
        first_id = warehouses[0]["_id"]
        await db.warehouses.update_one({"_id": first_id}, {"$set": {"is_default": True}})
        warehouses[0]["is_default"] = True

    # Calculate stats for each warehouse
    for w in warehouses:
        stock = await db.stock_levels.find({"warehouse_id": w["_id"]}).to_list(1000)
        w["product_count"] = len(stock)
        w["total_value"] = sum(s.get("quantity", 0) * s.get("unit_cost", 0) for s in stock)
    
    return [serialize_warehouse(w) for w in warehouses]


@router.get("/{warehouse_id}")
async def get_warehouse(warehouse_id: str, company_id: str = Query(...), current_user: dict = Depends(get_current_user)):
    company = await get_current_company(current_user, company_id)
    warehouse = await db.warehouses.find_one({"_id": ObjectId(warehouse_id), "company_id": ObjectId(company_id)})
    if not warehouse:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Warehouse not found")
    return serialize_warehouse(warehouse)


@router.put("/{warehouse_id}")
async def update_warehouse(warehouse_id: str, data: WarehouseUpdate, company_id: str = Query(...), current_user: dict = Depends(get_current_user)):
    company = await get_current_company(current_user, company_id)
    
    update_data = {k: v for k, v in data.dict(exclude_unset=True).items()}
    
    if update_data.get("is_default"):
        await db.warehouses.update_many({"company_id": ObjectId(company_id)}, {"$set": {"is_default": False}})
    
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    result = await db.warehouses.update_one({"_id": ObjectId(warehouse_id), "company_id": ObjectId(company_id)}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Warehouse not found")
    return {"message": "Warehouse updated"}


@router.delete("/{warehouse_id}")
async def delete_warehouse(warehouse_id: str, company_id: str = Query(...), current_user: dict = Depends(get_current_user)):
    company = await get_current_company(current_user, company_id)
    
    # Check if warehouse has stock
    stock_count = await db.stock_levels.count_documents({"warehouse_id": ObjectId(warehouse_id), "quantity": {"$gt": 0}})
    if stock_count > 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete warehouse with stock")
    
    result = await db.warehouses.delete_one({"_id": ObjectId(warehouse_id), "company_id": ObjectId(company_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Warehouse not found")
    
    # Delete stock levels for this warehouse
    await db.stock_levels.delete_many({"warehouse_id": ObjectId(warehouse_id)})
    
    return {"message": "Warehouse deleted"}
