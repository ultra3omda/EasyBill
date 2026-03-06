"""
Routes API pour les Retenues à la Source (Withholding Tax)
Conformité fiscale tunisienne
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime, timezone
from typing import Optional, List
import os
import logging

from models.withholding_tax import (
    WithholdingTaxCreate,
    WithholdingTaxUpdate,
    WithholdingTaxResponse,
    WithholdingTaxStatus,
    WithholdingTaxType,
    WITHHOLDING_TAX_RATES,
    WITHHOLDING_TAX_LABELS
)
from utils.dependencies import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/withholding-taxes", tags=["Withholding Taxes"])

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'easybill')]


async def get_next_wht_number(company_id: str) -> str:
    """Génère le prochain numéro de retenue à la source"""
    year = datetime.now().year
    prefix = f"RS-{year}-"
    
    last_wht = await db.withholding_taxes.find_one(
        {"company_id": ObjectId(company_id), "number": {"$regex": f"^{prefix}"}},
        sort=[("number", -1)]
    )
    
    if last_wht:
        try:
            last_num = int(last_wht["number"].split("-")[-1])
            next_num = last_num + 1
        except:
            next_num = 1
    else:
        next_num = 1
    
    return f"{prefix}{next_num:04d}"


def get_fiscal_quarter(date: datetime) -> int:
    """Retourne le trimestre fiscal pour une date donnée"""
    month = date.month
    if month <= 3:
        return 1
    elif month <= 6:
        return 2
    elif month <= 9:
        return 3
    else:
        return 4


@router.get("/")
async def list_withholding_taxes(
    company_id: str = Query(...),
    status: Optional[str] = None,
    supplier_id: Optional[str] = None,
    tax_type: Optional[str] = None,
    fiscal_year: Optional[int] = None,
    fiscal_quarter: Optional[int] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Liste toutes les retenues à la source"""
    
    query = {"company_id": ObjectId(company_id)}
    
    if status:
        query["status"] = status
    if supplier_id:
        query["supplier_id"] = ObjectId(supplier_id)
    if tax_type:
        query["tax_type"] = tax_type
    if fiscal_year:
        query["fiscal_year"] = fiscal_year
    if fiscal_quarter:
        query["fiscal_quarter"] = fiscal_quarter
    if start_date:
        query["date"] = {"$gte": start_date}
    if end_date:
        query.setdefault("date", {})["$lte"] = end_date
    
    taxes = await db.withholding_taxes.find(query).sort("date", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.withholding_taxes.count_documents(query)
    
    # Enrichir avec les noms
    for tax in taxes:
        tax["id"] = str(tax["_id"])
        tax["tax_type_label"] = WITHHOLDING_TAX_LABELS.get(tax.get("tax_type"), tax.get("tax_type"))
        
        if tax.get("supplier_id"):
            supplier = await db.suppliers.find_one({"_id": tax["supplier_id"]})
            if supplier:
                tax["supplier_name"] = supplier.get("company_name")
                tax["supplier_tax_id"] = supplier.get("tax_id")
    
    return {
        "items": taxes,
        "total": total,
        "skip": skip,
        "limit": limit
    }


@router.get("/stats")
async def get_withholding_tax_stats(
    company_id: str = Query(...),
    fiscal_year: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    """Statistiques des retenues à la source"""
    
    year = fiscal_year or datetime.now().year
    
    # Stats par statut
    pipeline_status = [
        {"$match": {"company_id": ObjectId(company_id), "fiscal_year": year}},
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1},
            "total_amount": {"$sum": "$tax_amount"}
        }}
    ]
    
    # Stats par type
    pipeline_type = [
        {"$match": {"company_id": ObjectId(company_id), "fiscal_year": year}},
        {"$group": {
            "_id": "$tax_type",
            "count": {"$sum": 1},
            "total_base": {"$sum": "$base_amount"},
            "total_tax": {"$sum": "$tax_amount"}
        }}
    ]
    
    # Stats par trimestre
    pipeline_quarter = [
        {"$match": {"company_id": ObjectId(company_id), "fiscal_year": year}},
        {"$group": {
            "_id": "$fiscal_quarter",
            "count": {"$sum": 1},
            "total_amount": {"$sum": "$tax_amount"}
        }},
        {"$sort": {"_id": 1}}
    ]
    
    stats_status = await db.withholding_taxes.aggregate(pipeline_status).to_list(None)
    stats_type = await db.withholding_taxes.aggregate(pipeline_type).to_list(None)
    stats_quarter = await db.withholding_taxes.aggregate(pipeline_quarter).to_list(None)
    
    result = {
        "fiscal_year": year,
        "by_status": {
            "draft": {"count": 0, "amount": 0},
            "validated": {"count": 0, "amount": 0},
            "declared": {"count": 0, "amount": 0},
            "paid": {"count": 0, "amount": 0},
            "cancelled": {"count": 0, "amount": 0}
        },
        "by_type": {},
        "by_quarter": {1: 0, 2: 0, 3: 0, 4: 0},
        "total_count": 0,
        "total_base": 0,
        "total_tax": 0,
        "pending_declaration": 0,
        "pending_payment": 0
    }
    
    for stat in stats_status:
        status = stat["_id"]
        result["by_status"][status] = {
            "count": stat["count"],
            "amount": stat.get("total_amount", 0)
        }
        result["total_count"] += stat["count"]
        result["total_tax"] += stat.get("total_amount", 0)
        
        if status == "validated":
            result["pending_declaration"] += stat.get("total_amount", 0)
        elif status == "declared":
            result["pending_payment"] += stat.get("total_amount", 0)
    
    for stat in stats_type:
        tax_type = stat["_id"]
        result["by_type"][tax_type] = {
            "label": WITHHOLDING_TAX_LABELS.get(tax_type, tax_type),
            "count": stat["count"],
            "base": stat.get("total_base", 0),
            "tax": stat.get("total_tax", 0)
        }
        result["total_base"] += stat.get("total_base", 0)
    
    for stat in stats_quarter:
        quarter = stat["_id"]
        result["by_quarter"][quarter] = stat.get("total_amount", 0)
    
    return result


@router.get("/rates")
async def get_withholding_tax_rates(
    current_user: dict = Depends(get_current_user)
):
    """Retourne les taux de retenue à la source par défaut"""
    
    rates = []
    for tax_type, rate in WITHHOLDING_TAX_RATES.items():
        rates.append({
            "type": tax_type,
            "label": WITHHOLDING_TAX_LABELS.get(tax_type, tax_type),
            "rate": rate
        })
    
    return {"rates": rates}


@router.get("/{wht_id}")
async def get_withholding_tax(
    wht_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Récupère une retenue à la source par ID"""
    
    tax = await db.withholding_taxes.find_one({
        "_id": ObjectId(wht_id),
        "company_id": ObjectId(company_id)
    })
    
    if not tax:
        raise HTTPException(status_code=404, detail="Retenue à la source non trouvée")
    
    tax["id"] = str(tax["_id"])
    tax["tax_type_label"] = WITHHOLDING_TAX_LABELS.get(tax.get("tax_type"), tax.get("tax_type"))
    
    # Enrichir avec les détails
    if tax.get("supplier_id"):
        supplier = await db.suppliers.find_one({"_id": tax["supplier_id"]})
        if supplier:
            tax["supplier_name"] = supplier.get("company_name")
            tax["supplier_tax_id"] = supplier.get("tax_id")
    
    if tax.get("supplier_invoice_id"):
        invoice = await db.supplier_invoices.find_one({"_id": tax["supplier_invoice_id"]})
        tax["supplier_invoice_number"] = invoice.get("number") if invoice else None
    
    return tax


@router.post("/")
async def create_withholding_tax(
    wht: WithholdingTaxCreate,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Crée une nouvelle retenue à la source"""
    
    # Vérifier que le fournisseur existe
    supplier = await db.suppliers.find_one({
        "_id": ObjectId(wht.supplier_id),
        "company_id": ObjectId(company_id)
    })
    
    if not supplier:
        raise HTTPException(status_code=404, detail="Fournisseur non trouvé")
    
    # Générer le numéro
    number = wht.number or await get_next_wht_number(company_id)
    
    # Date et période fiscale
    date = wht.date or datetime.now(timezone.utc)
    fiscal_year = wht.fiscal_year or date.year
    fiscal_quarter = wht.fiscal_quarter or get_fiscal_quarter(date)
    
    # Calculer le taux et le montant de la retenue
    tax_rate = wht.tax_rate
    if tax_rate is None:
        tax_rate = WITHHOLDING_TAX_RATES.get(wht.tax_type.value, 0)
    
    tax_amount = wht.tax_amount
    if tax_amount is None:
        tax_amount = round(wht.base_amount * tax_rate / 100, 3)
    
    wht_data = {
        "number": number,
        "date": date,
        "supplier_id": ObjectId(wht.supplier_id),
        "supplier_invoice_id": ObjectId(wht.supplier_invoice_id) if wht.supplier_invoice_id else None,
        "payment_id": ObjectId(wht.payment_id) if wht.payment_id else None,
        "tax_type": wht.tax_type.value,
        "base_amount": wht.base_amount,
        "tax_rate": tax_rate,
        "tax_amount": tax_amount,
        "fiscal_year": fiscal_year,
        "fiscal_quarter": fiscal_quarter,
        "status": WithholdingTaxStatus.DRAFT.value,
        "notes": wht.notes,
        "company_id": ObjectId(company_id),
        "created_by": ObjectId(current_user["id"]),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    result = await db.withholding_taxes.insert_one(wht_data)
    
    return {
        "id": str(result.inserted_id),
        "number": number,
        "tax_amount": tax_amount,
        "message": "Retenue à la source créée avec succès"
    }


@router.put("/{wht_id}")
async def update_withholding_tax(
    wht_id: str,
    wht: WithholdingTaxUpdate,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Met à jour une retenue à la source"""
    
    existing = await db.withholding_taxes.find_one({
        "_id": ObjectId(wht_id),
        "company_id": ObjectId(company_id)
    })
    
    if not existing:
        raise HTTPException(status_code=404, detail="Retenue à la source non trouvée")
    
    if existing.get("status") in ["declared", "paid"]:
        raise HTTPException(status_code=400, detail="Impossible de modifier une retenue déclarée ou payée")
    
    update_data = {k: v for k, v in wht.dict().items() if v is not None}
    
    # Recalculer le montant si nécessaire
    if "base_amount" in update_data or "tax_rate" in update_data:
        base = update_data.get("base_amount", existing.get("base_amount"))
        rate = update_data.get("tax_rate", existing.get("tax_rate"))
        update_data["tax_amount"] = round(base * rate / 100, 3)
    
    if "supplier_id" in update_data:
        update_data["supplier_id"] = ObjectId(update_data["supplier_id"])
    
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.withholding_taxes.update_one(
        {"_id": ObjectId(wht_id)},
        {"$set": update_data}
    )
    
    return {"message": "Retenue à la source mise à jour avec succès"}


@router.post("/{wht_id}/validate")
async def validate_withholding_tax(
    wht_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Valide une retenue à la source"""
    
    tax = await db.withholding_taxes.find_one({
        "_id": ObjectId(wht_id),
        "company_id": ObjectId(company_id)
    })
    
    if not tax:
        raise HTTPException(status_code=404, detail="Retenue à la source non trouvée")
    
    if tax.get("status") != "draft":
        raise HTTPException(status_code=400, detail="Seules les retenues en brouillon peuvent être validées")
    
    await db.withholding_taxes.update_one(
        {"_id": ObjectId(wht_id)},
        {
            "$set": {
                "status": "validated",
                "validated_at": datetime.now(timezone.utc),
                "validated_by": ObjectId(current_user["id"]),
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    return {"message": "Retenue à la source validée avec succès"}


@router.post("/{wht_id}/declare")
async def declare_withholding_tax(
    wht_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Marque une retenue comme déclarée aux impôts"""
    
    tax = await db.withholding_taxes.find_one({
        "_id": ObjectId(wht_id),
        "company_id": ObjectId(company_id)
    })
    
    if not tax:
        raise HTTPException(status_code=404, detail="Retenue à la source non trouvée")
    
    if tax.get("status") != "validated":
        raise HTTPException(status_code=400, detail="Seules les retenues validées peuvent être déclarées")
    
    await db.withholding_taxes.update_one(
        {"_id": ObjectId(wht_id)},
        {
            "$set": {
                "status": "declared",
                "declaration_date": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    return {"message": "Retenue à la source marquée comme déclarée"}


@router.post("/{wht_id}/pay")
async def pay_withholding_tax(
    wht_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Marque une retenue comme payée aux impôts"""
    
    tax = await db.withholding_taxes.find_one({
        "_id": ObjectId(wht_id),
        "company_id": ObjectId(company_id)
    })
    
    if not tax:
        raise HTTPException(status_code=404, detail="Retenue à la source non trouvée")
    
    if tax.get("status") != "declared":
        raise HTTPException(status_code=400, detail="Seules les retenues déclarées peuvent être payées")
    
    await db.withholding_taxes.update_one(
        {"_id": ObjectId(wht_id)},
        {
            "$set": {
                "status": "paid",
                "payment_date": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    return {"message": "Retenue à la source marquée comme payée"}


@router.post("/{wht_id}/cancel")
async def cancel_withholding_tax(
    wht_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Annule une retenue à la source"""
    
    tax = await db.withholding_taxes.find_one({
        "_id": ObjectId(wht_id),
        "company_id": ObjectId(company_id)
    })
    
    if not tax:
        raise HTTPException(status_code=404, detail="Retenue à la source non trouvée")
    
    if tax.get("status") in ["declared", "paid"]:
        raise HTTPException(status_code=400, detail="Impossible d'annuler une retenue déclarée ou payée")
    
    await db.withholding_taxes.update_one(
        {"_id": ObjectId(wht_id)},
        {
            "$set": {
                "status": "cancelled",
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    return {"message": "Retenue à la source annulée avec succès"}


@router.delete("/{wht_id}")
async def delete_withholding_tax(
    wht_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Supprime une retenue à la source (uniquement si brouillon)"""
    
    tax = await db.withholding_taxes.find_one({
        "_id": ObjectId(wht_id),
        "company_id": ObjectId(company_id)
    })
    
    if not tax:
        raise HTTPException(status_code=404, detail="Retenue à la source non trouvée")
    
    if tax.get("status") != "draft":
        raise HTTPException(status_code=400, detail="Seules les retenues en brouillon peuvent être supprimées")
    
    await db.withholding_taxes.delete_one({"_id": ObjectId(wht_id)})
    
    return {"message": "Retenue à la source supprimée avec succès"}


@router.get("/report/quarterly")
async def get_quarterly_report(
    company_id: str = Query(...),
    fiscal_year: int = Query(...),
    fiscal_quarter: int = Query(..., ge=1, le=4),
    current_user: dict = Depends(get_current_user)
):
    """Génère un rapport trimestriel des retenues à la source"""
    
    # Récupérer toutes les retenues du trimestre
    taxes = await db.withholding_taxes.find({
        "company_id": ObjectId(company_id),
        "fiscal_year": fiscal_year,
        "fiscal_quarter": fiscal_quarter,
        "status": {"$nin": ["draft", "cancelled"]}
    }).to_list(None)
    
    # Grouper par fournisseur
    by_supplier = {}
    total_base = 0
    total_tax = 0
    
    for tax in taxes:
        supplier_id = str(tax.get("supplier_id"))
        
        if supplier_id not in by_supplier:
            supplier = await db.suppliers.find_one({"_id": tax["supplier_id"]})
            by_supplier[supplier_id] = {
                "supplier_name": supplier.get("company_name") if supplier else "Inconnu",
                "supplier_tax_id": supplier.get("tax_id") if supplier else None,
                "items": [],
                "total_base": 0,
                "total_tax": 0
            }
        
        by_supplier[supplier_id]["items"].append({
            "number": tax.get("number"),
            "date": tax.get("date"),
            "type": WITHHOLDING_TAX_LABELS.get(tax.get("tax_type"), tax.get("tax_type")),
            "base": tax.get("base_amount"),
            "rate": tax.get("tax_rate"),
            "tax": tax.get("tax_amount")
        })
        by_supplier[supplier_id]["total_base"] += tax.get("base_amount", 0)
        by_supplier[supplier_id]["total_tax"] += tax.get("tax_amount", 0)
        
        total_base += tax.get("base_amount", 0)
        total_tax += tax.get("tax_amount", 0)
    
    return {
        "fiscal_year": fiscal_year,
        "fiscal_quarter": fiscal_quarter,
        "by_supplier": list(by_supplier.values()),
        "total_base": total_base,
        "total_tax": total_tax,
        "count": len(taxes)
    }
