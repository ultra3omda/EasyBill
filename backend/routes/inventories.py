from fastapi import APIRouter, HTTPException, Depends, Query, Request
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime, timezone
from pydantic import BaseModel
from typing import List, Optional
import os
from utils.dependencies import get_current_user, get_current_company

router = APIRouter(prefix="/api/inventories", tags=["Inventories"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

class InventoryItem(BaseModel):
    product_id: str
    product_name: str
    product_sku: Optional[str] = ""
    theoretical_qty: float
    counted_qty: float
    unit_cost: float = 0
    difference: float = 0
    adjustment_type: Optional[str] = None  # "in" or "out" or None

class InventoryCreate(BaseModel):
    warehouse_id: str
    date: str
    notes: Optional[str] = ""
    items: List[InventoryItem]

def serialize_inventory(inv: dict) -> dict:
    return {
        "id": str(inv["_id"]),
        "inventory_number": inv.get("inventory_number", ""),
        "warehouse_id": str(inv.get("warehouse_id", "")),
        "warehouse_name": inv.get("warehouse_name", ""),
        "date": inv.get("date").isoformat() if inv.get("date") else None,
        "status": inv.get("status", "draft"),
        "items_count": len(inv.get("items", [])),
        "total_theoretical": inv.get("total_theoretical", 0),
        "total_counted": inv.get("total_counted", 0),
        "total_difference": inv.get("total_difference", 0),
        "total_value_adjustment": inv.get("total_value_adjustment", 0),
        "notes": inv.get("notes", ""),
        "created_at": inv.get("created_at").isoformat() if inv.get("created_at") else None,
        "validated_at": inv.get("validated_at").isoformat() if inv.get("validated_at") else None,
        "created_by_name": inv.get("created_by_name", "")
    }

@router.get("/")
async def list_inventories(
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """List all inventories for a company"""
    company = await get_current_company(current_user, company_id)
    inventories = await db.inventories.find({"company_id": ObjectId(company_id)}).sort("created_at", -1).to_list(100)
    return [serialize_inventory(inv) for inv in inventories]

@router.get("/products-for-count")
async def get_products_for_inventory(
    company_id: str = Query(...),
    warehouse_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Get all products with their current stock for inventory counting"""
    company = await get_current_company(current_user, company_id)
    
    # Get warehouse info
    warehouse = await db.warehouses.find_one({"_id": ObjectId(warehouse_id), "company_id": ObjectId(company_id)})
    if not warehouse:
        raise HTTPException(status_code=404, detail="Entrepôt non trouvé")
    
    # Get all products
    products = await db.products.find({
        "company_id": ObjectId(company_id),
        "type": "product"  # Only physical products, not services
    }).to_list(1000)
    
    result = []
    for product in products:
        # Get current stock for this product in this warehouse
        stock_level = await db.stock_levels.find_one({
            "product_id": product["_id"],
            "warehouse_id": ObjectId(warehouse_id)
        })
        
        current_qty = stock_level.get("quantity", 0) if stock_level else product.get("quantity_in_stock", 0)
        unit_cost = product.get("purchase_price", 0)
        
        result.append({
            "product_id": str(product["_id"]),
            "product_name": product.get("name", ""),
            "product_sku": product.get("sku", ""),
            "category": product.get("category", ""),
            "unit": product.get("unit", "pièce"),
            "theoretical_qty": current_qty,
            "counted_qty": current_qty,  # Default to theoretical
            "unit_cost": unit_cost,
            "difference": 0,
            "total_value": current_qty * unit_cost
        })
    
    return {
        "warehouse": {
            "id": str(warehouse["_id"]),
            "name": warehouse.get("name", "")
        },
        "products": result
    }

@router.post("/")
async def create_inventory(
    data: InventoryCreate,
    request: Request,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Create a new inventory count"""
    company = await get_current_company(current_user, company_id)
    
    # Get warehouse
    warehouse = await db.warehouses.find_one({"_id": ObjectId(data.warehouse_id)})
    if not warehouse:
        raise HTTPException(status_code=404, detail="Entrepôt non trouvé")
    
    # Generate inventory number
    count = await db.inventories.count_documents({"company_id": ObjectId(company_id)})
    inventory_number = f"INV-{datetime.now().year}-{str(count + 1).zfill(5)}"
    
    # Calculate totals
    total_theoretical = sum(item.theoretical_qty for item in data.items)
    total_counted = sum(item.counted_qty for item in data.items)
    total_difference = total_counted - total_theoretical
    total_value_adjustment = sum(
        (item.counted_qty - item.theoretical_qty) * item.unit_cost 
        for item in data.items
    )
    
    # Prepare items with differences
    items = []
    for item in data.items:
        diff = item.counted_qty - item.theoretical_qty
        items.append({
            "product_id": ObjectId(item.product_id),
            "product_name": item.product_name,
            "product_sku": item.product_sku,
            "theoretical_qty": item.theoretical_qty,
            "counted_qty": item.counted_qty,
            "unit_cost": item.unit_cost,
            "difference": diff,
            "adjustment_type": "in" if diff > 0 else ("out" if diff < 0 else None),
            "value_adjustment": diff * item.unit_cost
        })
    
    inventory_doc = {
        "company_id": ObjectId(company_id),
        "inventory_number": inventory_number,
        "warehouse_id": ObjectId(data.warehouse_id),
        "warehouse_name": warehouse.get("name", ""),
        "date": datetime.fromisoformat(data.date),
        "status": "draft",
        "items": items,
        "total_theoretical": total_theoretical,
        "total_counted": total_counted,
        "total_difference": total_difference,
        "total_value_adjustment": total_value_adjustment,
        "notes": data.notes,
        "created_at": datetime.now(timezone.utc),
        "created_by": current_user["_id"],
        "created_by_name": current_user.get("full_name", "")
    }
    
    result = await db.inventories.insert_one(inventory_doc)
    
    return {
        "id": str(result.inserted_id),
        "inventory_number": inventory_number,
        "message": "Inventaire créé avec succès"
    }

@router.get("/{inventory_id}")
async def get_inventory(
    inventory_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Get inventory details"""
    company = await get_current_company(current_user, company_id)
    
    inventory = await db.inventories.find_one({
        "_id": ObjectId(inventory_id),
        "company_id": ObjectId(company_id)
    })
    
    if not inventory:
        raise HTTPException(status_code=404, detail="Inventaire non trouvé")
    
    # Serialize items
    items = []
    for item in inventory.get("items", []):
        items.append({
            "product_id": str(item.get("product_id", "")),
            "product_name": item.get("product_name", ""),
            "product_sku": item.get("product_sku", ""),
            "theoretical_qty": item.get("theoretical_qty", 0),
            "counted_qty": item.get("counted_qty", 0),
            "unit_cost": item.get("unit_cost", 0),
            "difference": item.get("difference", 0),
            "adjustment_type": item.get("adjustment_type"),
            "value_adjustment": item.get("value_adjustment", 0)
        })
    
    return {
        **serialize_inventory(inventory),
        "items": items
    }

@router.post("/{inventory_id}/validate")
async def validate_inventory(
    inventory_id: str,
    request: Request,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Validate inventory and create stock adjustments"""
    company = await get_current_company(current_user, company_id)
    
    inventory = await db.inventories.find_one({
        "_id": ObjectId(inventory_id),
        "company_id": ObjectId(company_id)
    })
    
    if not inventory:
        raise HTTPException(status_code=404, detail="Inventaire non trouvé")
    
    if inventory.get("status") == "validated":
        raise HTTPException(status_code=400, detail="Inventaire déjà validé")
    
    warehouse_id = inventory.get("warehouse_id")
    adjustments_created = 0
    
    # Create stock movements for each item with difference
    for item in inventory.get("items", []):
        diff = item.get("difference", 0)
        if diff == 0:
            continue
        
        product_id = item.get("product_id")
        product = await db.products.find_one({"_id": product_id})
        if not product:
            continue
        
        current_stock = product.get("quantity_in_stock", 0)
        new_stock = current_stock + diff
        
        # Create stock movement
        movement = {
            "company_id": ObjectId(company_id),
            "product_id": product_id,
            "product_name": item.get("product_name", ""),
            "warehouse_id": warehouse_id,
            "warehouse_name": inventory.get("warehouse_name", ""),
            "type": "in" if diff > 0 else "out",
            "quantity": abs(diff),
            "unit_cost": item.get("unit_cost", 0),
            "total_value": abs(diff) * item.get("unit_cost", 0),
            "reason": "Ajustement inventaire",
            "reference": inventory.get("inventory_number", ""),
            "stock_before": current_stock,
            "stock_after": new_stock,
            "created_at": datetime.now(timezone.utc),
            "created_by": current_user["_id"],
            "created_by_name": current_user.get("full_name", "")
        }
        
        await db.stock_movements.insert_one(movement)
        
        # Update product stock
        await db.products.update_one(
            {"_id": product_id},
            {"$set": {"quantity_in_stock": new_stock, "updated_at": datetime.now(timezone.utc)}}
        )
        
        # Update stock_levels if exists
        await db.stock_levels.update_one(
            {"product_id": product_id, "warehouse_id": warehouse_id},
            {"$set": {"quantity": new_stock, "updated_at": datetime.now(timezone.utc)}},
            upsert=True
        )
        
        adjustments_created += 1
    
    # Update inventory status
    await db.inventories.update_one(
        {"_id": ObjectId(inventory_id)},
        {
            "$set": {
                "status": "validated",
                "validated_at": datetime.now(timezone.utc),
                "validated_by": current_user["_id"],
                "validated_by_name": current_user.get("full_name", "")
            }
        }
    )
    
    return {
        "message": f"Inventaire validé. {adjustments_created} ajustement(s) de stock créé(s).",
        "adjustments_created": adjustments_created
    }

@router.delete("/{inventory_id}")
async def delete_inventory(
    inventory_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Delete a draft inventory"""
    company = await get_current_company(current_user, company_id)
    
    inventory = await db.inventories.find_one({
        "_id": ObjectId(inventory_id),
        "company_id": ObjectId(company_id)
    })
    
    if not inventory:
        raise HTTPException(status_code=404, detail="Inventaire non trouvé")
    
    if inventory.get("status") == "validated":
        raise HTTPException(status_code=400, detail="Impossible de supprimer un inventaire validé")
    
    await db.inventories.delete_one({"_id": ObjectId(inventory_id)})
    
    return {"message": "Inventaire supprimé"}
