"""
Routes API pour les Bons de Réception (Goods Receipt)
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime, timezone
from typing import Optional, List
import os
import logging

from models.receipt import (
    ReceiptCreate,
    ReceiptUpdate,
    ReceiptResponse,
    ReceiptStatus
)
from utils.dependencies import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/receipts", tags=["Receipts"])

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'easybill')]


async def get_next_receipt_number(company_id: str) -> str:
    """Génère le prochain numéro de bon de réception"""
    year = datetime.now().year
    prefix = f"BR-{year}-"
    
    last_receipt = await db.receipts.find_one(
        {"company_id": ObjectId(company_id), "number": {"$regex": f"^{prefix}"}},
        sort=[("number", -1)]
    )
    
    if last_receipt:
        try:
            last_num = int(last_receipt["number"].split("-")[-1])
            next_num = last_num + 1
        except:
            next_num = 1
    else:
        next_num = 1
    
    return f"{prefix}{next_num:04d}"


@router.get("/")
async def list_receipts(
    company_id: str = Query(...),
    status: Optional[str] = None,
    supplier_id: Optional[str] = None,
    warehouse_id: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Liste tous les bons de réception"""
    
    query = {"company_id": ObjectId(company_id)}
    
    if status:
        query["status"] = status
    if supplier_id:
        query["supplier_id"] = ObjectId(supplier_id)
    if warehouse_id:
        query["warehouse_id"] = ObjectId(warehouse_id)
    if start_date:
        query["date"] = {"$gte": start_date}
    if end_date:
        query.setdefault("date", {})["$lte"] = end_date
    
    receipts = await db.receipts.find(query).sort("date", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.receipts.count_documents(query)
    
    # Enrichir avec les noms
    for receipt in receipts:
        receipt["id"] = str(receipt["_id"])
        
        if receipt.get("supplier_id"):
            supplier = await db.suppliers.find_one({"_id": receipt["supplier_id"]})
            receipt["supplier_name"] = supplier.get("company_name") if supplier else None
        
        if receipt.get("warehouse_id"):
            warehouse = await db.warehouses.find_one({"_id": receipt["warehouse_id"]})
            receipt["warehouse_name"] = warehouse.get("name") if warehouse else None
    
    return {
        "items": receipts,
        "total": total,
        "skip": skip,
        "limit": limit
    }


@router.get("/stats")
async def get_receipt_stats(
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Statistiques des bons de réception"""
    
    pipeline = [
        {"$match": {"company_id": ObjectId(company_id)}},
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1},
            "total_items": {"$sum": "$total_items"},
            "total_quantity": {"$sum": "$total_quantity"},
            "total_value": {"$sum": "$total_value"}
        }}
    ]
    
    stats = await db.receipts.aggregate(pipeline).to_list(None)
    
    result = {
        "total": 0,
        "draft": 0,
        "validated": 0,
        "cancelled": 0,
        "total_items": 0,
        "total_quantity": 0,
        "total_value": 0
    }
    
    for stat in stats:
        status = stat["_id"]
        result[status] = stat["count"]
        result["total"] += stat["count"]
        if status == "validated":
            result["total_items"] += stat.get("total_items", 0)
            result["total_quantity"] += stat.get("total_quantity", 0)
            result["total_value"] += stat.get("total_value", 0)
    
    return result


@router.get("/{receipt_id}")
async def get_receipt(
    receipt_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Récupère un bon de réception par ID"""
    
    receipt = await db.receipts.find_one({
        "_id": ObjectId(receipt_id),
        "company_id": ObjectId(company_id)
    })
    
    if not receipt:
        raise HTTPException(status_code=404, detail="Bon de réception non trouvé")
    
    receipt["id"] = str(receipt["_id"])
    
    # Enrichir avec les détails
    if receipt.get("supplier_id"):
        supplier = await db.suppliers.find_one({"_id": receipt["supplier_id"]})
        receipt["supplier_name"] = supplier.get("company_name") if supplier else None
    
    if receipt.get("purchase_order_id"):
        po = await db.purchase_orders.find_one({"_id": receipt["purchase_order_id"]})
        receipt["purchase_order_number"] = po.get("number") if po else None
    
    # Enrichir les items avec les détails des produits
    for item in receipt.get("items", []):
        if item.get("product_id"):
            product = await db.products.find_one({"_id": ObjectId(item["product_id"])})
            if product:
                item["product_name"] = product.get("name")
                item["product_sku"] = product.get("sku")
    
    return receipt


@router.post("/")
async def create_receipt(
    receipt: ReceiptCreate,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Crée un nouveau bon de réception"""
    
    # Vérifier que le fournisseur existe
    supplier = await db.suppliers.find_one({
        "_id": ObjectId(receipt.supplier_id),
        "company_id": ObjectId(company_id)
    })
    
    if not supplier:
        raise HTTPException(status_code=404, detail="Fournisseur non trouvé")
    
    # Générer le numéro
    number = receipt.number or await get_next_receipt_number(company_id)
    
    # Calculer les totaux
    total_items = len(receipt.items)
    total_quantity = sum(item.received_quantity for item in receipt.items)
    total_value = sum(
        (item.received_quantity * (item.unit_price or 0))
        for item in receipt.items
    )
    
    # Enrichir les items avec les noms des produits
    items_data = []
    for item in receipt.items:
        item_dict = item.dict()
        if item.product_id:
            product = await db.products.find_one({"_id": ObjectId(item.product_id)})
            if product:
                item_dict["product_name"] = product.get("name")
        items_data.append(item_dict)
    
    receipt_data = {
        "number": number,
        "date": receipt.date or datetime.now(timezone.utc),
        "supplier_id": ObjectId(receipt.supplier_id),
        "purchase_order_id": ObjectId(receipt.purchase_order_id) if receipt.purchase_order_id else None,
        "warehouse_id": ObjectId(receipt.warehouse_id) if receipt.warehouse_id else None,
        "items": items_data,
        "total_items": total_items,
        "total_quantity": total_quantity,
        "total_value": total_value,
        "status": ReceiptStatus.DRAFT.value,
        "notes": receipt.notes,
        "delivery_note_number": receipt.delivery_note_number,
        "carrier": receipt.carrier,
        "company_id": ObjectId(company_id),
        "created_by": ObjectId(current_user["id"]),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    result = await db.receipts.insert_one(receipt_data)
    
    return {
        "id": str(result.inserted_id),
        "number": number,
        "message": "Bon de réception créé avec succès"
    }


@router.put("/{receipt_id}")
async def update_receipt(
    receipt_id: str,
    receipt: ReceiptUpdate,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Met à jour un bon de réception"""
    
    existing = await db.receipts.find_one({
        "_id": ObjectId(receipt_id),
        "company_id": ObjectId(company_id)
    })
    
    if not existing:
        raise HTTPException(status_code=404, detail="Bon de réception non trouvé")
    
    if existing.get("status") == "validated":
        raise HTTPException(status_code=400, detail="Impossible de modifier un bon validé")
    
    update_data = {k: v for k, v in receipt.dict().items() if v is not None}
    
    if "items" in update_data:
        update_data["total_items"] = len(update_data["items"])
        update_data["total_quantity"] = sum(item["received_quantity"] for item in update_data["items"])
        update_data["total_value"] = sum(
            (item["received_quantity"] * (item.get("unit_price") or 0))
            for item in update_data["items"]
        )
    
    if "supplier_id" in update_data:
        update_data["supplier_id"] = ObjectId(update_data["supplier_id"])
    if "warehouse_id" in update_data and update_data["warehouse_id"]:
        update_data["warehouse_id"] = ObjectId(update_data["warehouse_id"])
    
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.receipts.update_one(
        {"_id": ObjectId(receipt_id)},
        {"$set": update_data}
    )
    
    return {"message": "Bon de réception mis à jour avec succès"}


@router.post("/{receipt_id}/validate")
async def validate_receipt(
    receipt_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Valide un bon de réception et met à jour le stock"""
    
    receipt = await db.receipts.find_one({
        "_id": ObjectId(receipt_id),
        "company_id": ObjectId(company_id)
    })
    
    if not receipt:
        raise HTTPException(status_code=404, detail="Bon de réception non trouvé")
    
    if receipt.get("status") != "draft":
        raise HTTPException(status_code=400, detail="Seuls les bons en brouillon peuvent être validés")
    
    # Mettre à jour le stock pour chaque item
    for item in receipt.get("items", []):
        if item.get("product_id"):
            # Incrémenter le stock
            await db.products.update_one(
                {"_id": ObjectId(item["product_id"])},
                {"$inc": {"stock_quantity": item["received_quantity"]}}
            )
            
            # Créer un mouvement de stock
            movement = {
                "product_id": ObjectId(item["product_id"]),
                "type": "entry",
                "quantity": item["received_quantity"],
                "reason": "Réception fournisseur",
                "reference_type": "receipt",
                "reference_id": ObjectId(receipt_id),
                "warehouse_id": receipt.get("warehouse_id"),
                "supplier_id": receipt.get("supplier_id"),
                "lot_number": item.get("lot_number"),
                "expiry_date": item.get("expiry_date"),
                "company_id": ObjectId(company_id),
                "created_by": ObjectId(current_user["id"]),
                "created_at": datetime.now(timezone.utc)
            }
            await db.stock_movements.insert_one(movement)
    
    # Mettre à jour le statut du bon de commande si lié
    if receipt.get("purchase_order_id"):
        await db.purchase_orders.update_one(
            {"_id": receipt["purchase_order_id"]},
            {"$set": {"status": "received", "updated_at": datetime.now(timezone.utc)}}
        )
    
    # Mettre à jour le statut du bon de réception
    await db.receipts.update_one(
        {"_id": ObjectId(receipt_id)},
        {
            "$set": {
                "status": "validated",
                "validated_at": datetime.now(timezone.utc),
                "validated_by": ObjectId(current_user["id"]),
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    return {"message": "Bon de réception validé avec succès"}


@router.post("/{receipt_id}/cancel")
async def cancel_receipt(
    receipt_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Annule un bon de réception"""
    
    receipt = await db.receipts.find_one({
        "_id": ObjectId(receipt_id),
        "company_id": ObjectId(company_id)
    })
    
    if not receipt:
        raise HTTPException(status_code=404, detail="Bon de réception non trouvé")
    
    if receipt.get("status") == "validated":
        # Restaurer le stock (décrémenter)
        for item in receipt.get("items", []):
            if item.get("product_id"):
                await db.products.update_one(
                    {"_id": ObjectId(item["product_id"])},
                    {"$inc": {"stock_quantity": -item["received_quantity"]}}
                )
    
    await db.receipts.update_one(
        {"_id": ObjectId(receipt_id)},
        {
            "$set": {
                "status": "cancelled",
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    return {"message": "Bon de réception annulé avec succès"}


@router.delete("/{receipt_id}")
async def delete_receipt(
    receipt_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Supprime un bon de réception (uniquement si brouillon)"""
    
    receipt = await db.receipts.find_one({
        "_id": ObjectId(receipt_id),
        "company_id": ObjectId(company_id)
    })
    
    if not receipt:
        raise HTTPException(status_code=404, detail="Bon de réception non trouvé")
    
    if receipt.get("status") != "draft":
        raise HTTPException(status_code=400, detail="Seuls les bons en brouillon peuvent être supprimés")
    
    await db.receipts.delete_one({"_id": ObjectId(receipt_id)})
    
    return {"message": "Bon de réception supprimé avec succès"}


@router.post("/from-purchase-order/{po_id}")
async def create_receipt_from_po(
    po_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Crée un bon de réception depuis un bon de commande"""
    
    po = await db.purchase_orders.find_one({
        "_id": ObjectId(po_id),
        "company_id": ObjectId(company_id)
    })
    
    if not po:
        raise HTTPException(status_code=404, detail="Bon de commande non trouvé")
    
    # Générer le numéro
    number = await get_next_receipt_number(company_id)
    
    # Préparer les items
    items = []
    for item in po.get("items", []):
        items.append({
            "product_id": str(item.get("product_id")),
            "product_name": item.get("product_name"),
            "ordered_quantity": item.get("quantity"),
            "received_quantity": item.get("quantity"),  # Par défaut, quantité commandée
            "unit": item.get("unit", "unité"),
            "unit_price": item.get("unit_price")
        })
    
    receipt_data = {
        "number": number,
        "date": datetime.now(timezone.utc),
        "supplier_id": po.get("supplier_id"),
        "purchase_order_id": ObjectId(po_id),
        "warehouse_id": po.get("warehouse_id"),
        "items": items,
        "total_items": len(items),
        "total_quantity": sum(item["received_quantity"] for item in items),
        "total_value": sum(item["received_quantity"] * (item.get("unit_price") or 0) for item in items),
        "status": ReceiptStatus.DRAFT.value,
        "notes": f"Créé depuis le bon de commande {po.get('number')}",
        "company_id": ObjectId(company_id),
        "created_by": ObjectId(current_user["id"]),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    result = await db.receipts.insert_one(receipt_data)
    
    return {
        "id": str(result.inserted_id),
        "number": number,
        "message": "Bon de réception créé depuis le bon de commande"
    }
