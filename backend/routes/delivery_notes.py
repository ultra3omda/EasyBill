from fastapi import APIRouter, HTTPException, status, Depends, Query, Request
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime, timezone
import os
from typing import Optional
from models.delivery_note import DeliveryNote, DeliveryNoteCreate, DeliveryNoteUpdate
from utils.dependencies import get_current_user, get_current_company
from utils.helpers import generate_document_number

router = APIRouter(prefix="/api/delivery-notes", tags=["Delivery Notes"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]


def serialize_delivery_note(d: dict) -> dict:
    """Serialize delivery note document for JSON response."""
    return {
        "id": str(d["_id"]),
        "company_id": str(d.get("company_id")) if d.get("company_id") else None,
        "customer_id": str(d.get("customer_id")) if d.get("customer_id") else None,
        "customer_name": d.get("customer_name", ""),
        "invoice_id": str(d.get("invoice_id")) if d.get("invoice_id") else None,
        "quote_id": str(d.get("quote_id")) if d.get("quote_id") else None,
        "number": d.get("number"),
        "date": d["date"].isoformat() if isinstance(d.get("date"), datetime) else d.get("date"),
        "shipping_address": d.get("shipping_address"),
        "items": d.get("items", []),
        "notes": d.get("notes"),
        "status": d.get("status", "draft"),
        "delivered_at": d["delivered_at"].isoformat() if isinstance(d.get("delivered_at"), datetime) else d.get("delivered_at"),
        "delivery_person": d.get("delivery_person"),
        "created_at": d["created_at"].isoformat() if isinstance(d.get("created_at"), datetime) else d.get("created_at"),
        "updated_at": d["updated_at"].isoformat() if isinstance(d.get("updated_at"), datetime) else d.get("updated_at")
    }


async def log_action(company_id, user_id, user_name, action, element, ip_address=None):
    await db.access_logs.insert_one({
        "company_id": ObjectId(company_id),
        "user_id": ObjectId(user_id),
        "user_name": user_name,
        "category": "Bon de livraison",
        "action": action,
        "element": element,
        "ip_address": ip_address,
        "created_at": datetime.now(timezone.utc)
    })


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_delivery_note(
    data: DeliveryNoteCreate,
    request: Request,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    numbering = company.get("numbering", {})
    prefix = numbering.get("delivery_prefix", "BL")
    next_num = numbering.get("delivery_next", 1)
    
    number = generate_document_number(prefix, next_num, datetime.now().year)
    
    doc_dict = data.dict(exclude={'items'})
    items = [item.dict() for item in data.items]
    
    if isinstance(doc_dict.get('date'), str):
        doc_dict['date'] = datetime.fromisoformat(doc_dict['date'].replace('Z', '+00:00'))
    
    doc_dict.update({
        "company_id": ObjectId(company_id),
        "customer_id": ObjectId(data.customer_id),
        "number": number,
        "items": items,
        "status": "draft",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "created_by": current_user["_id"]
    })
    
    if data.invoice_id:
        doc_dict["invoice_id"] = ObjectId(data.invoice_id)
    if data.quote_id:
        doc_dict["quote_id"] = ObjectId(data.quote_id)
    
    result = await db.delivery_notes.insert_one(doc_dict)
    
    await db.companies.update_one(
        {"_id": ObjectId(company_id)},
        {"$inc": {"numbering.delivery_next": 1}}
    )
    
    await log_action(company_id, str(current_user["_id"]), current_user.get("full_name", ""), "Créer", number, request.client.host if request.client else None)
    
    return {"id": str(result.inserted_id), "number": number, "message": "Delivery note created"}


@router.get("/")
async def list_delivery_notes(
    company_id: str = Query(...),
    search: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    query = {"company_id": ObjectId(company_id)}
    if search:
        query["$or"] = [
            {"number": {"$regex": search, "$options": "i"}}
        ]
    if status_filter:
        query["status"] = status_filter
    
    docs = await db.delivery_notes.find(query).sort("created_at", -1).to_list(1000)
    
    for doc in docs:
        if doc.get("customer_id"):
            customer = await db.customers.find_one({"_id": doc["customer_id"]})
            doc["customer_name"] = customer.get("display_name", "Inconnu") if customer else "Inconnu"
    
    return [serialize_delivery_note(d) for d in docs]


@router.get("/{doc_id}")
async def get_delivery_note(
    doc_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    doc = await db.delivery_notes.find_one({
        "_id": ObjectId(doc_id),
        "company_id": ObjectId(company_id)
    })
    
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery note not found")
    
    if doc.get("customer_id"):
        customer = await db.customers.find_one({"_id": doc["customer_id"]})
        doc["customer_name"] = customer.get("display_name", "") if customer else ""
    
    return serialize_delivery_note(doc)


@router.put("/{doc_id}")
async def update_delivery_note(
    doc_id: str,
    data: DeliveryNoteUpdate,
    request: Request,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    existing = await db.delivery_notes.find_one({"_id": ObjectId(doc_id)})
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery note not found")
    
    update_data = {k: v for k, v in data.dict(exclude_unset=True).items()}
    
    if 'items' in update_data and update_data['items']:
        update_data['items'] = [item.dict() if hasattr(item, 'dict') else item for item in update_data['items']]
    
    if 'customer_id' in update_data and update_data['customer_id']:
        update_data['customer_id'] = ObjectId(update_data['customer_id'])
    
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.delivery_notes.update_one(
        {"_id": ObjectId(doc_id), "company_id": ObjectId(company_id)},
        {"$set": update_data}
    )
    
    await log_action(company_id, str(current_user["_id"]), current_user.get("full_name", ""), "Modifier", existing.get("number", ""), request.client.host if request.client else None)
    
    return {"message": "Delivery note updated"}




@router.post("/{delivery_id}/convert-to-invoice")
async def convert_delivery_note_to_invoice(
    delivery_id: str,
    request: Request,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Convertit un bon de livraison en facture
    """
    company = await get_current_company(current_user, company_id)
    
    # Récupérer le bon de livraison
    delivery = await db.delivery_notes.find_one({
        "_id": ObjectId(delivery_id),
        "company_id": ObjectId(company_id)
    })
    
    if not delivery:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery note not found")
    
    # Vérifier si déjà converti
    if delivery.get("converted_to_invoice"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Delivery note already converted to invoice")
    
    # Générer le numéro de facture
    numbering = company.get("numbering", {})
    invoice_prefix = numbering.get("invoice_prefix", "FAC")
    invoice_next = numbering.get("invoice_next", 1)
    
    invoice_number = generate_document_number(
        invoice_prefix,
        invoice_next,
        datetime.now().year
    )
    
    # Calculer les totaux
    items = delivery.get("items", [])
    totals = calculate_document_totals(items)
    
    # Créer la facture
    invoice_dict = {
        "company_id": ObjectId(company_id),
        "customer_id": delivery["customer_id"],
        "number": invoice_number,
        "date": datetime.now(timezone.utc),
        "due_date": delivery.get("due_date", datetime.now(timezone.utc)),
        "subject": delivery.get("subject"),
        "items": items,
        **totals,
        "amount_paid": 0.0,
        "balance_due": totals["total"],
        "payment_terms": delivery.get("payment_terms"),
        "notes": delivery.get("notes"),
        "language": delivery.get("language", "fr"),
        "status": "draft",
        "delivery_id": ObjectId(delivery_id),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "created_by": current_user["_id"]
    }
    
    result = await db.invoices.insert_one(invoice_dict)
    invoice_id = str(result.inserted_id)
    
    # Mettre à jour la numérotation
    await db.companies.update_one(
        {"_id": ObjectId(company_id)},
        {"$inc": {"numbering.invoice_next": 1}}
    )
    
    # Marquer le BL comme converti
    await db.delivery_notes.update_one(
        {"_id": ObjectId(delivery_id)},
        {
            "$set": {
                "converted_to_invoice": True,
                "invoice_id": ObjectId(invoice_id),
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    # Mettre à jour les stats client
    await db.customers.update_one(
        {"_id": delivery["customer_id"]},
        {
            "$inc": {
                "invoice_count": 1,
                "total_invoiced": totals["total"],
                "balance": totals["total"]
            }
        }
    )
    
    # Log action
    await log_action(
        company_id,
        str(current_user["_id"]),
        current_user.get("full_name", ""),
        "Convertir BL en Facture",
        f"{delivery.get('number', '')} → {invoice_number}",
        request.client.host if request.client else None


@router.post("/{delivery_id}/validate")
async def validate_delivery_note(
    delivery_id: str,
    request: Request,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Valide un bon de livraison et sort automatiquement le stock
    """
    company = await get_current_company(current_user, company_id)
    
    # Récupérer le BL
    delivery = await db.delivery_notes.find_one({
        "_id": ObjectId(delivery_id),
        "company_id": ObjectId(company_id)
    })
    
    if not delivery:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery note not found")
    
    if delivery.get("status") == "validated":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Delivery note already validated")
    
    # Sortir le stock pour chaque item
    stock_movements = []
    for item in delivery.get("items", []):
        if item.get("product_id"):
            product_id = item["product_id"]
            quantity = item["quantity"]
            
            # Récupérer le produit
            product = await db.products.find_one({"_id": ObjectId(product_id)})
            if not product:
                continue
            
            # Vérifier si c'est un produit avec stock (pas un service)
            if product.get("type") != "service":
                # Obtenir l'entrepôt principal
                warehouse = await db.warehouses.find_one({
                    "company_id": ObjectId(company_id),
                    "is_default": True
                })
                
                if not warehouse:
                    # Créer l'entrepôt principal s'il n'existe pas
                    warehouse_result = await db.warehouses.insert_one({
                        "company_id": ObjectId(company_id),
                        "name": "Entrepôt Principal",
                        "code": "MAIN",
                        "is_default": True,
                        "created_at": datetime.now(timezone.utc)
                    })
                    warehouse = {"_id": warehouse_result.inserted_id}
                
                # Créer le mouvement de sortie
                movement = {
                    "company_id": ObjectId(company_id),
                    "product_id": ObjectId(product_id),
                    "warehouse_id": warehouse["_id"],
                    "type": "out",
                    "quantity": quantity,
                    "reference": delivery.get("number"),
                    "document_type": "delivery_note",
                    "document_id": ObjectId(delivery_id),
                    "date": datetime.now(timezone.utc),
                    "notes": f"Sortie automatique BL {delivery.get('number')}",
                    "created_at": datetime.now(timezone.utc),
                    "created_by": current_user["_id"]
                }
                
                movement_result = await db.stock_movements.insert_one(movement)
                stock_movements.append(str(movement_result.inserted_id))
                
                # Mettre à jour le stock du produit
                current_stock = product.get("quantity_in_stock", 0)
                new_stock = max(0, current_stock - quantity)
                
                await db.products.update_one(
                    {"_id": ObjectId(product_id)},
                    {
                        "$set": {
                            "quantity_in_stock": new_stock,
                            "updated_at": datetime.now(timezone.utc)
                        }
                    }
                )
    
    # Mettre à jour le statut du BL
    await db.delivery_notes.update_one(
        {"_id": ObjectId(delivery_id)},
        {
            "$set": {
                "status": "validated",
                "validated_at": datetime.now(timezone.utc),
                "validated_by": current_user["_id"],
                "stock_movements": stock_movements,
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    # Log action
    await log_action(
        company_id,
        str(current_user["_id"]),
        current_user.get("full_name", ""),
        "Valider BL",
        delivery.get("number", ""),
        request.client.host if request.client else None
    )
    
    return {
        "message": "Delivery note validated successfully",
        "stock_movements_created": len(stock_movements),
        "stock_movements": stock_movements
    }

    )
    
    return {
        "id": invoice_id,
        "number": invoice_number,
        "message": "Delivery note converted to invoice successfully"
    }

@router.delete("/{doc_id}")
async def delete_delivery_note(
    doc_id: str,
    request: Request,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    doc = await db.delivery_notes.find_one({
        "_id": ObjectId(doc_id),
        "company_id": ObjectId(company_id)
    })
    
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery note not found")
    
    await db.delivery_notes.delete_one({"_id": ObjectId(doc_id)})
    
    await log_action(company_id, str(current_user["_id"]), current_user.get("full_name", ""), "Supprimer", doc.get("number", ""), request.client.host if request.client else None)
    
    return {"message": "Delivery note deleted"}


@router.post("/{doc_id}/deliver")
async def mark_delivered(
    doc_id: str,
    request: Request,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    doc = await db.delivery_notes.find_one({
        "_id": ObjectId(doc_id),
        "company_id": ObjectId(company_id)
    })
    
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery note not found")
    
    await db.delivery_notes.update_one(
        {"_id": ObjectId(doc_id)},
        {
            "$set": {
                "status": "delivered",
                "delivered_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    await log_action(company_id, str(current_user["_id"]), current_user.get("full_name", ""), "Livrer", doc.get("number", ""), request.client.host if request.client else None)
    
    return {"message": "Delivery note marked as delivered"}
