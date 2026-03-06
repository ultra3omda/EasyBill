"""
Routes API pour les Bons de Sortie (Exit Vouchers)
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime, timezone
from typing import Optional, List
import os
import logging

from models.exit_voucher import (
    ExitVoucherCreate,
    ExitVoucherUpdate,
    ExitVoucherResponse,
    ExitVoucherStatus
)
from utils.dependencies import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/exit-vouchers", tags=["Exit Vouchers"])

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'easybill')]


async def get_next_voucher_number(company_id: str) -> str:
    """Génère le prochain numéro de bon de sortie"""
    year = datetime.now().year
    prefix = f"BS-{year}-"
    
    last_voucher = await db.exit_vouchers.find_one(
        {"company_id": ObjectId(company_id), "number": {"$regex": f"^{prefix}"}},
        sort=[("number", -1)]
    )
    
    if last_voucher:
        try:
            last_num = int(last_voucher["number"].split("-")[-1])
            next_num = last_num + 1
        except:
            next_num = 1
    else:
        next_num = 1
    
    return f"{prefix}{next_num:04d}"


@router.get("/")
async def list_exit_vouchers(
    company_id: str = Query(...),
    status: Optional[str] = None,
    warehouse_id: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Liste tous les bons de sortie"""
    
    query = {"company_id": ObjectId(company_id)}
    
    if status:
        query["status"] = status
    if warehouse_id:
        query["warehouse_id"] = ObjectId(warehouse_id)
    if start_date:
        query["date"] = {"$gte": start_date}
    if end_date:
        query.setdefault("date", {})["$lte"] = end_date
    
    vouchers = await db.exit_vouchers.find(query).sort("date", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.exit_vouchers.count_documents(query)
    
    # Enrichir avec les noms des entrepôts
    for voucher in vouchers:
        voucher["id"] = str(voucher["_id"])
        if voucher.get("warehouse_id"):
            warehouse = await db.warehouses.find_one({"_id": voucher["warehouse_id"]})
            voucher["warehouse_name"] = warehouse.get("name") if warehouse else None
    
    return {
        "items": vouchers,
        "total": total,
        "skip": skip,
        "limit": limit
    }


@router.get("/stats")
async def get_exit_voucher_stats(
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Statistiques des bons de sortie"""
    
    pipeline = [
        {"$match": {"company_id": ObjectId(company_id)}},
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1},
            "total_items": {"$sum": "$total_items"},
            "total_quantity": {"$sum": "$total_quantity"}
        }}
    ]
    
    stats = await db.exit_vouchers.aggregate(pipeline).to_list(None)
    
    result = {
        "total": 0,
        "draft": 0,
        "validated": 0,
        "cancelled": 0,
        "total_items": 0,
        "total_quantity": 0
    }
    
    for stat in stats:
        status = stat["_id"]
        result[status] = stat["count"]
        result["total"] += stat["count"]
        if status == "validated":
            result["total_items"] += stat.get("total_items", 0)
            result["total_quantity"] += stat.get("total_quantity", 0)
    
    return result


@router.get("/{voucher_id}")
async def get_exit_voucher(
    voucher_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Récupère un bon de sortie par ID"""
    
    voucher = await db.exit_vouchers.find_one({
        "_id": ObjectId(voucher_id),
        "company_id": ObjectId(company_id)
    })
    
    if not voucher:
        raise HTTPException(status_code=404, detail="Bon de sortie non trouvé")
    
    voucher["id"] = str(voucher["_id"])
    
    # Enrichir avec les détails des produits
    for item in voucher.get("items", []):
        if item.get("product_id"):
            product = await db.products.find_one({"_id": ObjectId(item["product_id"])})
            if product:
                item["product_name"] = product.get("name")
                item["product_sku"] = product.get("sku")
    
    return voucher


@router.post("/")
async def create_exit_voucher(
    voucher: ExitVoucherCreate,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Crée un nouveau bon de sortie"""
    
    # Générer le numéro
    number = voucher.number or await get_next_voucher_number(company_id)
    
    # Calculer les totaux
    total_items = len(voucher.items)
    total_quantity = sum(item.quantity for item in voucher.items)
    
    # Enrichir les items avec les noms des produits
    items_data = []
    for item in voucher.items:
        item_dict = item.dict()
        if item.product_id:
            product = await db.products.find_one({"_id": ObjectId(item.product_id)})
            if product:
                item_dict["product_name"] = product.get("name")
        items_data.append(item_dict)
    
    voucher_data = {
        "number": number,
        "date": voucher.date or datetime.now(timezone.utc),
        "reason": voucher.reason,
        "destination": voucher.destination,
        "warehouse_id": ObjectId(voucher.warehouse_id) if voucher.warehouse_id else None,
        "items": items_data,
        "total_items": total_items,
        "total_quantity": total_quantity,
        "status": ExitVoucherStatus.DRAFT.value,
        "notes": voucher.notes,
        "reference": voucher.reference,
        "company_id": ObjectId(company_id),
        "created_by": ObjectId(current_user["id"]),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    result = await db.exit_vouchers.insert_one(voucher_data)
    
    return {
        "id": str(result.inserted_id),
        "number": number,
        "message": "Bon de sortie créé avec succès"
    }


@router.put("/{voucher_id}")
async def update_exit_voucher(
    voucher_id: str,
    voucher: ExitVoucherUpdate,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Met à jour un bon de sortie"""
    
    existing = await db.exit_vouchers.find_one({
        "_id": ObjectId(voucher_id),
        "company_id": ObjectId(company_id)
    })
    
    if not existing:
        raise HTTPException(status_code=404, detail="Bon de sortie non trouvé")
    
    if existing.get("status") == "validated":
        raise HTTPException(status_code=400, detail="Impossible de modifier un bon validé")
    
    update_data = {k: v for k, v in voucher.dict().items() if v is not None}
    
    if "items" in update_data:
        update_data["total_items"] = len(update_data["items"])
        update_data["total_quantity"] = sum(item["quantity"] for item in update_data["items"])
    
    if "warehouse_id" in update_data and update_data["warehouse_id"]:
        update_data["warehouse_id"] = ObjectId(update_data["warehouse_id"])
    
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.exit_vouchers.update_one(
        {"_id": ObjectId(voucher_id)},
        {"$set": update_data}
    )
    
    return {"message": "Bon de sortie mis à jour avec succès"}


@router.post("/{voucher_id}/validate")
async def validate_exit_voucher(
    voucher_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Valide un bon de sortie et met à jour le stock"""
    
    voucher = await db.exit_vouchers.find_one({
        "_id": ObjectId(voucher_id),
        "company_id": ObjectId(company_id)
    })
    
    if not voucher:
        raise HTTPException(status_code=404, detail="Bon de sortie non trouvé")
    
    if voucher.get("status") != "draft":
        raise HTTPException(status_code=400, detail="Seuls les bons en brouillon peuvent être validés")
    
    # Mettre à jour le stock pour chaque item
    for item in voucher.get("items", []):
        if item.get("product_id"):
            # Décrémenter le stock
            await db.products.update_one(
                {"_id": ObjectId(item["product_id"])},
                {"$inc": {"stock_quantity": -item["quantity"]}}
            )
            
            # Créer un mouvement de stock
            movement = {
                "product_id": ObjectId(item["product_id"]),
                "type": "exit",
                "quantity": -item["quantity"],
                "reason": voucher.get("reason"),
                "reference_type": "exit_voucher",
                "reference_id": ObjectId(voucher_id),
                "warehouse_id": voucher.get("warehouse_id"),
                "company_id": ObjectId(company_id),
                "created_by": ObjectId(current_user["id"]),
                "created_at": datetime.now(timezone.utc)
            }
            await db.stock_movements.insert_one(movement)
    
    # Mettre à jour le statut du bon
    await db.exit_vouchers.update_one(
        {"_id": ObjectId(voucher_id)},
        {
            "$set": {
                "status": "validated",
                "validated_at": datetime.now(timezone.utc),
                "validated_by": ObjectId(current_user["id"]),
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    return {"message": "Bon de sortie validé avec succès"}


@router.post("/{voucher_id}/cancel")
async def cancel_exit_voucher(
    voucher_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Annule un bon de sortie"""
    
    voucher = await db.exit_vouchers.find_one({
        "_id": ObjectId(voucher_id),
        "company_id": ObjectId(company_id)
    })
    
    if not voucher:
        raise HTTPException(status_code=404, detail="Bon de sortie non trouvé")
    
    if voucher.get("status") == "validated":
        # Restaurer le stock
        for item in voucher.get("items", []):
            if item.get("product_id"):
                await db.products.update_one(
                    {"_id": ObjectId(item["product_id"])},
                    {"$inc": {"stock_quantity": item["quantity"]}}
                )
    
    await db.exit_vouchers.update_one(
        {"_id": ObjectId(voucher_id)},
        {
            "$set": {
                "status": "cancelled",
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    return {"message": "Bon de sortie annulé avec succès"}


@router.delete("/{voucher_id}")
async def delete_exit_voucher(
    voucher_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Supprime un bon de sortie (uniquement si brouillon)"""
    
    voucher = await db.exit_vouchers.find_one({
        "_id": ObjectId(voucher_id),
        "company_id": ObjectId(company_id)
    })
    
    if not voucher:
        raise HTTPException(status_code=404, detail="Bon de sortie non trouvé")
    
    if voucher.get("status") != "draft":
        raise HTTPException(status_code=400, detail="Seuls les bons en brouillon peuvent être supprimés")
    
    await db.exit_vouchers.delete_one({"_id": ObjectId(voucher_id)})
    
    return {"message": "Bon de sortie supprimé avec succès"}
