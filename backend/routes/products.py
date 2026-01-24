from fastapi import APIRouter, HTTPException, status, Depends, Query, Request
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime, timezone
import os
from typing import Optional
from models.product import Product, ProductCreate, ProductUpdate
from utils.dependencies import get_current_user, get_current_company

router = APIRouter(prefix="/api/products", tags=["Products"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]


def serialize_product(p: dict) -> dict:
    """Serialize product document for JSON response."""
    return {
        "id": str(p["_id"]),
        "name": p.get("name"),
        "sku": p.get("sku"),
        "description": p.get("description"),
        "type": p.get("type", "product"),
        "category": p.get("category"),
        "unit": p.get("unit", "pièce"),
        "selling_price": p.get("selling_price", 0),
        "purchase_price": p.get("purchase_price", 0),
        "tax_id": str(p.get("tax_id")) if p.get("tax_id") else None,
        "tax_rate": p.get("tax_rate", 19),
        "quantity_in_stock": p.get("quantity_in_stock", 0),
        "min_stock_level": p.get("min_stock_level", 0),
        "warehouse_id": str(p.get("warehouse_id")) if p.get("warehouse_id") else None,
        "is_active": p.get("is_active", True),
        "created_at": p["created_at"].isoformat() if p.get("created_at") else None,
        "updated_at": p["updated_at"].isoformat() if p.get("updated_at") else None
    }


async def log_product_action(company_id, user_id, user_name, action, element, ip_address=None):
    """Log product action."""
    await db.access_logs.insert_one({
        "company_id": ObjectId(company_id),
        "user_id": ObjectId(user_id),
        "user_name": user_name,
        "category": "Article",
        "action": action,
        "element": element,
        "ip_address": ip_address,
        "created_at": datetime.now(timezone.utc)
    })


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_product(
    product_data: ProductCreate,
    request: Request,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    product_dict = product_data.dict(exclude_unset=True)
    product_dict.update({
        "company_id": ObjectId(company_id),
        "quantity_in_stock": product_dict.get("quantity_in_stock", 0),
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    })
    
    result = await db.products.insert_one(product_dict)
    
    await log_product_action(
        company_id, str(current_user["_id"]), current_user.get("full_name", ""),
        "Créer", product_data.name, request.client.host if request.client else None
    )
    
    return {"id": str(result.inserted_id), "message": "Product created successfully"}


@router.get("/")
async def list_products(
    company_id: str = Query(...),
    search: Optional[str] = None,
    category: Optional[str] = None,
    type: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    query = {"company_id": ObjectId(company_id)}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"sku": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}}
        ]
    if category:
        query["category"] = category
    if type:
        query["type"] = type
    
    products = await db.products.find(query).to_list(1000)
    return [serialize_product(p) for p in products]


@router.get("/{product_id}")
async def get_product(
    product_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    product = await db.products.find_one({
        "_id": ObjectId(product_id),
        "company_id": ObjectId(company_id)
    })
    
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    
    return serialize_product(product)


@router.put("/{product_id}")
async def update_product(
    product_id: str,
    product_update: ProductUpdate,
    request: Request,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    product = await db.products.find_one({"_id": ObjectId(product_id)})
    
    update_data = {k: v for k, v in product_update.dict(exclude_unset=True).items()}
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    result = await db.products.update_one(
        {"_id": ObjectId(product_id), "company_id": ObjectId(company_id)},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    
    await log_product_action(
        company_id, str(current_user["_id"]), current_user.get("full_name", ""),
        "Mise à jour", product.get("name", ""), request.client.host if request.client else None
    )
    
    return {"message": "Product updated successfully"}


@router.delete("/{product_id}")
async def delete_product(
    product_id: str,
    request: Request,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    product = await db.products.find_one({"_id": ObjectId(product_id)})
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    
    result = await db.products.delete_one({
        "_id": ObjectId(product_id),
        "company_id": ObjectId(company_id)
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    
    await log_product_action(
        company_id, str(current_user["_id"]), current_user.get("full_name", ""),
        "Supprimer", product.get("name", ""), request.client.host if request.client else None
    )
    
    return {"message": "Product deleted successfully"}


# Stock movements
@router.post("/{product_id}/stock-movement")
async def create_stock_movement(
    product_id: str,
    request: Request,
    company_id: str = Query(...),
    quantity: float = Query(...),
    movement_type: str = Query(...),  # "in" or "out"
    reason: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    product = await db.products.find_one({
        "_id": ObjectId(product_id),
        "company_id": ObjectId(company_id)
    })
    
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    
    current_stock = product.get("quantity_in_stock", 0)
    if movement_type == "in":
        new_stock = current_stock + quantity
    else:
        if current_stock < quantity:
            raise HTTPException(status_code=400, detail="Stock insuffisant")
        new_stock = current_stock - quantity
    
    # Update product stock
    await db.products.update_one(
        {"_id": ObjectId(product_id)},
        {"$set": {"quantity_in_stock": new_stock, "updated_at": datetime.now(timezone.utc)}}
    )
    
    # Log movement
    movement = {
        "product_id": ObjectId(product_id),
        "company_id": ObjectId(company_id),
        "type": movement_type,
        "quantity": quantity,
        "previous_stock": current_stock,
        "new_stock": new_stock,
        "reason": reason,
        "created_by": current_user["_id"],
        "created_at": datetime.now(timezone.utc)
    }
    await db.stock_movements.insert_one(movement)
    
    await log_product_action(
        company_id, str(current_user["_id"]), current_user.get("full_name", ""),
        "Mouvement stock", f"{product.get('name')} ({'+' if movement_type == 'in' else '-'}{quantity})",
        request.client.host if request.client else None
    )
    
    return {"message": "Stock movement recorded", "new_stock": new_stock}


@router.get("/{product_id}/stock-movements")
async def get_stock_movements(
    product_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    movements = await db.stock_movements.find({
        "product_id": ObjectId(product_id),
        "company_id": ObjectId(company_id)
    }).sort("created_at", -1).to_list(100)
    
    return [{
        "id": str(m["_id"]),
        "type": m["type"],
        "quantity": m["quantity"],
        "previous_stock": m["previous_stock"],
        "new_stock": m["new_stock"],
        "reason": m.get("reason"),
        "created_at": m["created_at"].isoformat()
    } for m in movements]
