from fastapi import APIRouter, HTTPException, status, Depends, Query, Request
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime, timezone
import os
from typing import Optional, List
from pydantic import BaseModel, Field
from utils.dependencies import get_current_user, get_current_company

router = APIRouter(prefix="/api/stock-movements", tags=["Stock Movements"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]


class StockMovementCreate(BaseModel):
    product_id: str
    warehouse_id: str
    type: str  # in, out, transfer, adjustment
    quantity: float = Field(gt=0)
    unit_cost: Optional[float] = None
    reason: Optional[str] = None
    reference: Optional[str] = None  # Invoice/PO number
    destination_warehouse_id: Optional[str] = None  # For transfers
    notes: Optional[str] = None


def serialize_movement(m: dict) -> dict:
    return {
        "id": str(m["_id"]),
        "company_id": str(m.get("company_id")) if m.get("company_id") else None,
        "product_id": str(m.get("product_id")) if m.get("product_id") else None,
        "product_name": m.get("product_name", ""),
        "warehouse_id": str(m.get("warehouse_id")) if m.get("warehouse_id") else None,
        "warehouse_name": m.get("warehouse_name", ""),
        "destination_warehouse_id": str(m.get("destination_warehouse_id")) if m.get("destination_warehouse_id") else None,
        "destination_warehouse_name": m.get("destination_warehouse_name", ""),
        "type": m.get("type"),
        "quantity": m.get("quantity", 0),
        "unit_cost": m.get("unit_cost", 0),
        "total_value": m.get("total_value", 0),
        "reason": m.get("reason"),
        "reference": m.get("reference"),
        "notes": m.get("notes"),
        "stock_before": m.get("stock_before", 0),
        "stock_after": m.get("stock_after", 0),
        "created_at": m["created_at"].isoformat() if isinstance(m.get("created_at"), datetime) else m.get("created_at"),
        "created_by_name": m.get("created_by_name", "")
    }


async def update_stock_level(warehouse_id, product_id, quantity_change, unit_cost=None):
    """Update or create stock level for a product in a warehouse"""
    stock = await db.stock_levels.find_one({"warehouse_id": ObjectId(warehouse_id), "product_id": ObjectId(product_id)})
    
    if stock:
        new_quantity = stock.get("quantity", 0) + quantity_change
        update = {"quantity": max(0, new_quantity), "updated_at": datetime.now(timezone.utc)}
        if unit_cost is not None:
            update["unit_cost"] = unit_cost
        await db.stock_levels.update_one({"_id": stock["_id"]}, {"$set": update})
        return stock.get("quantity", 0), new_quantity
    else:
        new_stock = {
            "warehouse_id": ObjectId(warehouse_id),
            "product_id": ObjectId(product_id),
            "quantity": max(0, quantity_change),
            "unit_cost": unit_cost or 0,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
        await db.stock_levels.insert_one(new_stock)
        return 0, max(0, quantity_change)


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_movement(data: StockMovementCreate, company_id: str = Query(...), current_user: dict = Depends(get_current_user)):
    company = await get_current_company(current_user, company_id)
    
    # Validate product and warehouse
    product = await db.products.find_one({"_id": ObjectId(data.product_id), "company_id": ObjectId(company_id)})
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    
    warehouse = await db.warehouses.find_one({"_id": ObjectId(data.warehouse_id), "company_id": ObjectId(company_id)})
    if not warehouse:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Warehouse not found")
    
    # Calculate quantity change based on movement type
    quantity_change = data.quantity if data.type == "in" else -data.quantity
    
    # Check stock for outgoing movements
    if data.type in ["out", "transfer"]:
        current_stock = await db.stock_levels.find_one({"warehouse_id": ObjectId(data.warehouse_id), "product_id": ObjectId(data.product_id)})
        current_qty = current_stock.get("quantity", 0) if current_stock else 0
        if current_qty < data.quantity:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Insufficient stock. Available: {current_qty}")
    
    # Update stock levels
    stock_before, stock_after = await update_stock_level(data.warehouse_id, data.product_id, quantity_change, data.unit_cost)
    
    # Create movement record
    movement_dict = {
        "company_id": ObjectId(company_id),
        "product_id": ObjectId(data.product_id),
        "product_name": product.get("name"),
        "warehouse_id": ObjectId(data.warehouse_id),
        "warehouse_name": warehouse.get("name"),
        "type": data.type,
        "quantity": data.quantity,
        "unit_cost": data.unit_cost or product.get("purchase_price", 0),
        "total_value": data.quantity * (data.unit_cost or product.get("purchase_price", 0)),
        "reason": data.reason,
        "reference": data.reference,
        "notes": data.notes,
        "stock_before": stock_before,
        "stock_after": stock_after,
        "created_at": datetime.now(timezone.utc),
        "created_by": current_user["_id"],
        "created_by_name": current_user.get("full_name", "")
    }
    
    # Handle transfer
    if data.type == "transfer" and data.destination_warehouse_id:
        dest_warehouse = await db.warehouses.find_one({"_id": ObjectId(data.destination_warehouse_id)})
        if not dest_warehouse:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Destination warehouse not found")
        
        movement_dict["destination_warehouse_id"] = ObjectId(data.destination_warehouse_id)
        movement_dict["destination_warehouse_name"] = dest_warehouse.get("name")
        
        # Add to destination warehouse
        await update_stock_level(data.destination_warehouse_id, data.product_id, data.quantity, data.unit_cost)
    
    result = await db.stock_movements.insert_one(movement_dict)
    
    # Update product total stock (quantity_in_stock field)
    total_stock = 0
    all_levels = await db.stock_levels.find({"product_id": ObjectId(data.product_id)}).to_list(100)
    total_stock = sum(l.get("quantity", 0) for l in all_levels)
    await db.products.update_one(
        {"_id": ObjectId(data.product_id)}, 
        {"$set": {"quantity_in_stock": total_stock, "stock_quantity": total_stock, "updated_at": datetime.now(timezone.utc)}}
    )
    
    return {"id": str(result.inserted_id), "message": "Stock movement recorded", "stock_after": stock_after}


@router.get("/")
async def list_movements(company_id: str = Query(...), product_id: Optional[str] = None, warehouse_id: Optional[str] = None, type: Optional[str] = None, limit: int = 100, current_user: dict = Depends(get_current_user)):
    company = await get_current_company(current_user, company_id)
    
    query = {"company_id": ObjectId(company_id)}
    if product_id:
        query["product_id"] = ObjectId(product_id)
    if warehouse_id:
        query["warehouse_id"] = ObjectId(warehouse_id)
    if type:
        query["type"] = type
    
    movements = await db.stock_movements.find(query).sort("created_at", -1).limit(limit).to_list(limit)
    return [serialize_movement(m) for m in movements]


@router.get("/by-product/{product_id}")
async def get_product_movements(product_id: str, company_id: str = Query(...), current_user: dict = Depends(get_current_user)):
    company = await get_current_company(current_user, company_id)
    movements = await db.stock_movements.find({"company_id": ObjectId(company_id), "product_id": ObjectId(product_id)}).sort("created_at", -1).to_list(100)
    return [serialize_movement(m) for m in movements]


@router.get("/stock-levels")
async def get_stock_levels(company_id: str = Query(...), warehouse_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Get current stock levels for all products"""
    company = await get_current_company(current_user, company_id)
    
    # Get all products
    products = await db.products.find({"company_id": ObjectId(company_id)}).to_list(1000)
    
    result = []
    for product in products:
        query = {"product_id": product["_id"]}
        if warehouse_id:
            query["warehouse_id"] = ObjectId(warehouse_id)
        
        levels = await db.stock_levels.find(query).to_list(100)
        
        for level in levels:
            warehouse = await db.warehouses.find_one({"_id": level["warehouse_id"]})
            result.append({
                "product_id": str(product["_id"]),
                "product_name": product.get("name"),
                "product_sku": product.get("sku"),
                "warehouse_id": str(level["warehouse_id"]),
                "warehouse_name": warehouse.get("name") if warehouse else "",
                "quantity": level.get("quantity", 0),
                "unit_cost": level.get("unit_cost", 0),
                "total_value": level.get("quantity", 0) * level.get("unit_cost", 0),
                "min_stock": product.get("min_stock", 0),
                "is_low_stock": level.get("quantity", 0) <= product.get("min_stock", 0)
            })
    
    return result
