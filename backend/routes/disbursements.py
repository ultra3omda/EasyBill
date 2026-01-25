"""
Routes API pour les Notes de Débours (Disbursement Notes)
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime, timezone
from typing import Optional, List
import os
import logging

from models.disbursement import (
    DisbursementCreate,
    DisbursementUpdate,
    DisbursementResponse,
    DisbursementStatus
)
from utils.dependencies import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/disbursements", tags=["Disbursements"])

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'easybill')]


async def get_next_disbursement_number(company_id: str) -> str:
    """Génère le prochain numéro de note de débours"""
    year = datetime.now().year
    prefix = f"ND-{year}-"
    
    last_note = await db.disbursements.find_one(
        {"company_id": ObjectId(company_id), "number": {"$regex": f"^{prefix}"}},
        sort=[("number", -1)]
    )
    
    if last_note:
        try:
            last_num = int(last_note["number"].split("-")[-1])
            next_num = last_num + 1
        except:
            next_num = 1
    else:
        next_num = 1
    
    return f"{prefix}{next_num:04d}"


@router.get("/")
async def list_disbursements(
    company_id: str = Query(...),
    status: Optional[str] = None,
    customer_id: Optional[str] = None,
    project_id: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Liste toutes les notes de débours"""
    
    query = {"company_id": ObjectId(company_id)}
    
    if status:
        query["status"] = status
    if customer_id:
        query["customer_id"] = ObjectId(customer_id)
    if project_id:
        query["project_id"] = ObjectId(project_id)
    if start_date:
        query["date"] = {"$gte": start_date}
    if end_date:
        query.setdefault("date", {})["$lte"] = end_date
    
    notes = await db.disbursements.find(query).sort("date", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.disbursements.count_documents(query)
    
    # Enrichir avec les noms
    for note in notes:
        note["id"] = str(note["_id"])
        
        if note.get("customer_id"):
            customer = await db.customers.find_one({"_id": note["customer_id"]})
            note["customer_name"] = customer.get("display_name") or customer.get("company_name") if customer else None
        
        if note.get("project_id"):
            project = await db.projects.find_one({"_id": note["project_id"]})
            note["project_name"] = project.get("name") if project else None
    
    return {
        "items": notes,
        "total": total,
        "skip": skip,
        "limit": limit
    }


@router.get("/stats")
async def get_disbursement_stats(
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Statistiques des notes de débours"""
    
    pipeline = [
        {"$match": {"company_id": ObjectId(company_id)}},
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1},
            "total_amount": {"$sum": "$total"}
        }}
    ]
    
    stats = await db.disbursements.aggregate(pipeline).to_list(None)
    
    result = {
        "total": 0,
        "draft": 0,
        "sent": 0,
        "invoiced": 0,
        "cancelled": 0,
        "total_amount": 0,
        "pending_amount": 0
    }
    
    for stat in stats:
        status = stat["_id"]
        result[status] = stat["count"]
        result["total"] += stat["count"]
        if status in ["draft", "sent"]:
            result["pending_amount"] += stat.get("total_amount", 0)
        result["total_amount"] += stat.get("total_amount", 0)
    
    return result


@router.get("/{disbursement_id}")
async def get_disbursement(
    disbursement_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Récupère une note de débours par ID"""
    
    note = await db.disbursements.find_one({
        "_id": ObjectId(disbursement_id),
        "company_id": ObjectId(company_id)
    })
    
    if not note:
        raise HTTPException(status_code=404, detail="Note de débours non trouvée")
    
    note["id"] = str(note["_id"])
    
    # Enrichir avec les détails
    if note.get("customer_id"):
        customer = await db.customers.find_one({"_id": note["customer_id"]})
        note["customer_name"] = customer.get("display_name") or customer.get("company_name") if customer else None
    
    if note.get("project_id"):
        project = await db.projects.find_one({"_id": note["project_id"]})
        note["project_name"] = project.get("name") if project else None
    
    return note


@router.post("/")
async def create_disbursement(
    disbursement: DisbursementCreate,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Crée une nouvelle note de débours"""
    
    # Vérifier que le client existe
    customer = await db.customers.find_one({
        "_id": ObjectId(disbursement.customer_id),
        "company_id": ObjectId(company_id)
    })
    
    if not customer:
        raise HTTPException(status_code=404, detail="Client non trouvé")
    
    # Générer le numéro
    number = disbursement.number or await get_next_disbursement_number(company_id)
    
    # Calculer les totaux pour chaque item et le total global
    items_data = []
    subtotal = 0
    total_tax = 0
    
    for item in disbursement.items:
        item_dict = item.dict()
        amount = item.amount
        tax_rate = item.tax_rate or 0
        tax_amount = round(amount * tax_rate / 100, 3)
        item_total = round(amount + tax_amount, 3)
        
        item_dict["tax_amount"] = tax_amount
        item_dict["total"] = item_total
        items_data.append(item_dict)
        
        subtotal += amount
        total_tax += tax_amount
    
    total = round(subtotal + total_tax, 3)
    
    note_data = {
        "number": number,
        "date": disbursement.date or datetime.now(timezone.utc),
        "customer_id": ObjectId(disbursement.customer_id),
        "project_id": ObjectId(disbursement.project_id) if disbursement.project_id else None,
        "items": items_data,
        "subtotal": round(subtotal, 3),
        "tax_amount": round(total_tax, 3),
        "total": total,
        "status": DisbursementStatus.DRAFT.value,
        "notes": disbursement.notes,
        "payment_terms": disbursement.payment_terms,
        "due_date": disbursement.due_date,
        "company_id": ObjectId(company_id),
        "created_by": ObjectId(current_user["id"]),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    result = await db.disbursements.insert_one(note_data)
    
    return {
        "id": str(result.inserted_id),
        "number": number,
        "message": "Note de débours créée avec succès"
    }


@router.put("/{disbursement_id}")
async def update_disbursement(
    disbursement_id: str,
    disbursement: DisbursementUpdate,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Met à jour une note de débours"""
    
    existing = await db.disbursements.find_one({
        "_id": ObjectId(disbursement_id),
        "company_id": ObjectId(company_id)
    })
    
    if not existing:
        raise HTTPException(status_code=404, detail="Note de débours non trouvée")
    
    if existing.get("status") == "invoiced":
        raise HTTPException(status_code=400, detail="Impossible de modifier une note déjà facturée")
    
    update_data = {k: v for k, v in disbursement.dict().items() if v is not None}
    
    if "items" in update_data:
        # Recalculer les totaux
        subtotal = 0
        total_tax = 0
        
        for item in update_data["items"]:
            amount = item.get("amount", 0)
            tax_rate = item.get("tax_rate", 0)
            tax_amount = round(amount * tax_rate / 100, 3)
            item["tax_amount"] = tax_amount
            item["total"] = round(amount + tax_amount, 3)
            
            subtotal += amount
            total_tax += tax_amount
        
        update_data["subtotal"] = round(subtotal, 3)
        update_data["tax_amount"] = round(total_tax, 3)
        update_data["total"] = round(subtotal + total_tax, 3)
    
    if "customer_id" in update_data:
        update_data["customer_id"] = ObjectId(update_data["customer_id"])
    if "project_id" in update_data and update_data["project_id"]:
        update_data["project_id"] = ObjectId(update_data["project_id"])
    
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.disbursements.update_one(
        {"_id": ObjectId(disbursement_id)},
        {"$set": update_data}
    )
    
    return {"message": "Note de débours mise à jour avec succès"}


@router.post("/{disbursement_id}/send")
async def send_disbursement(
    disbursement_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Marque une note de débours comme envoyée"""
    
    note = await db.disbursements.find_one({
        "_id": ObjectId(disbursement_id),
        "company_id": ObjectId(company_id)
    })
    
    if not note:
        raise HTTPException(status_code=404, detail="Note de débours non trouvée")
    
    if note.get("status") != "draft":
        raise HTTPException(status_code=400, detail="Seules les notes en brouillon peuvent être envoyées")
    
    await db.disbursements.update_one(
        {"_id": ObjectId(disbursement_id)},
        {
            "$set": {
                "status": "sent",
                "sent_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    return {"message": "Note de débours marquée comme envoyée"}


@router.post("/{disbursement_id}/convert-to-invoice")
async def convert_to_invoice(
    disbursement_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Convertit une note de débours en facture"""
    
    note = await db.disbursements.find_one({
        "_id": ObjectId(disbursement_id),
        "company_id": ObjectId(company_id)
    })
    
    if not note:
        raise HTTPException(status_code=404, detail="Note de débours non trouvée")
    
    if note.get("status") == "invoiced":
        raise HTTPException(status_code=400, detail="Cette note a déjà été convertie en facture")
    
    if note.get("status") == "cancelled":
        raise HTTPException(status_code=400, detail="Impossible de convertir une note annulée")
    
    # Générer le numéro de facture
    year = datetime.now().year
    prefix = f"INV-{year}-"
    last_invoice = await db.invoices.find_one(
        {"company_id": ObjectId(company_id), "number": {"$regex": f"^{prefix}"}},
        sort=[("number", -1)]
    )
    
    if last_invoice:
        try:
            last_num = int(last_invoice["number"].split("-")[-1])
            next_num = last_num + 1
        except:
            next_num = 1
    else:
        next_num = 1
    
    invoice_number = f"{prefix}{next_num:04d}"
    
    # Créer les items de facture
    invoice_items = []
    for item in note.get("items", []):
        invoice_items.append({
            "description": f"[Débours] {item.get('description')}",
            "quantity": 1,
            "unit_price": item.get("amount"),
            "tax_rate": item.get("tax_rate", 0),
            "discount": 0,
            "total": item.get("total")
        })
    
    # Créer la facture
    invoice_data = {
        "number": invoice_number,
        "customer_id": note["customer_id"],
        "date": datetime.now(timezone.utc),
        "due_date": note.get("due_date") or datetime.now(timezone.utc),
        "items": invoice_items,
        "subtotal": note.get("subtotal"),
        "total_tax": note.get("tax_amount"),
        "total_discount": 0,
        "total": note.get("total"),
        "amount_paid": 0,
        "balance_due": note.get("total"),
        "status": "draft",
        "notes": f"Facture générée depuis la note de débours {note.get('number')}",
        "disbursement_id": ObjectId(disbursement_id),
        "company_id": ObjectId(company_id),
        "created_by": ObjectId(current_user["id"]),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    result = await db.invoices.insert_one(invoice_data)
    invoice_id = str(result.inserted_id)
    
    # Mettre à jour la note de débours
    await db.disbursements.update_one(
        {"_id": ObjectId(disbursement_id)},
        {
            "$set": {
                "status": "invoiced",
                "invoice_id": ObjectId(invoice_id),
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    return {
        "message": "Note de débours convertie en facture",
        "invoice_id": invoice_id,
        "invoice_number": invoice_number
    }


@router.post("/{disbursement_id}/cancel")
async def cancel_disbursement(
    disbursement_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Annule une note de débours"""
    
    note = await db.disbursements.find_one({
        "_id": ObjectId(disbursement_id),
        "company_id": ObjectId(company_id)
    })
    
    if not note:
        raise HTTPException(status_code=404, detail="Note de débours non trouvée")
    
    if note.get("status") == "invoiced":
        raise HTTPException(status_code=400, detail="Impossible d'annuler une note déjà facturée")
    
    await db.disbursements.update_one(
        {"_id": ObjectId(disbursement_id)},
        {
            "$set": {
                "status": "cancelled",
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    return {"message": "Note de débours annulée avec succès"}


@router.delete("/{disbursement_id}")
async def delete_disbursement(
    disbursement_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Supprime une note de débours (uniquement si brouillon)"""
    
    note = await db.disbursements.find_one({
        "_id": ObjectId(disbursement_id),
        "company_id": ObjectId(company_id)
    })
    
    if not note:
        raise HTTPException(status_code=404, detail="Note de débours non trouvée")
    
    if note.get("status") != "draft":
        raise HTTPException(status_code=400, detail="Seules les notes en brouillon peuvent être supprimées")
    
    await db.disbursements.delete_one({"_id": ObjectId(disbursement_id)})
    
    return {"message": "Note de débours supprimée avec succès"}
