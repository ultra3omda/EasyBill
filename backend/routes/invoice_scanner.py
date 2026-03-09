"""
invoice_scanner.py
Rubrique "Scanner une facture" dans le module Achats.
Permet d'uploader une facture PDF/image, d'extraire les données automatiquement,
de présenter un résumé des actions à confirmer, puis d'exécuter ces actions.
"""
from fastapi import APIRouter, HTTPException, status, Depends, Query, UploadFile, File
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
import os
import re
import logging

from utils.dependencies import get_current_user, get_current_company
from utils.helpers import generate_document_number, calculate_document_totals
from services.invoice_extractor_service import extract_invoice_data

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/invoice-scanner", tags=["Invoice Scanner"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

ALLOWED_MIME = {
    "application/pdf",
    "image/jpeg", "image/jpg", "image/png",
    "image/webp", "image/tiff", "image/bmp",
}
MAX_FILE_SIZE = 10 * 1024 * 1024   # 10 MB


# ─── Pydantic models ──────────────────────────────────────────────────────────

class SupplierData(BaseModel):
    id: Optional[str] = None          # existing supplier id (if found)
    name: Optional[str] = None
    fiscal_id: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    is_new: bool = False               # True = will be created


class InvoiceItemData(BaseModel):
    description: str = ""
    quantity: float = 1
    unit_price: float = 0
    tax_rate: float = 19
    discount: float = 0
    total: float = 0


class InvoiceData(BaseModel):
    supplier_number: Optional[str] = None
    date: Optional[str] = None
    due_date: Optional[str] = None
    items: List[InvoiceItemData] = []
    subtotal: float = 0
    fodec: float = 0
    assiette_tva: float = 0
    total_tax: float = 0
    timbre: float = 0
    total: float = 0
    notes: Optional[str] = None

    class Config:
        extra = "allow"


class JournalLineData(BaseModel):
    account_code: str
    account_name: str
    debit: float = 0
    credit: float = 0
    description: str = ""


class JournalEntryData(BaseModel):
    description: str
    journal_type: str
    lines: List[JournalLineData]
    total_debit: float
    total_credit: float


class ConfirmScanRequest(BaseModel):
    supplier: SupplierData
    invoice: InvoiceData
    journal_entries: List[JournalEntryData]
    company_id: str


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _build_journal_entries(
    supplier_name: str,
    subtotal: float,
    fodec: float,
    total_tax: float,
    timbre: float,
    net_a_payer: float,
    invoice_ref: str,
    tva_rate: float = 19.0
) -> List[Dict]:
    """
    Écriture comptable complète pour une facture fournisseur tunisienne (PCE) :
      Débit  601/611  Achats HT NET
      Débit  6393     FODEC (taxe parafiscale, 1% du HT)
      Débit  43620    TVA déductible (19% sur HT+FODEC)
      Débit  6318     Timbre fiscal (1 TND)
      Crédit 401      Fournisseurs (Net à payer total)
    """
    lines = []
    total_d = 0.0
    total_c = 0.0

    # Compte d'achat selon le taux de TVA
    purchase_account = "601"
    purchase_name = "Achats de marchandises"
    if tva_rate == 0:
        purchase_account = "611"
        purchase_name = "Services extérieurs (exonérés)"

    # Débit 1 : Achats HT NET
    if subtotal and subtotal > 0:
        lines.append({
            "account_code": purchase_account,
            "account_name": purchase_name,
            "debit": round(subtotal, 3),
            "credit": 0,
            "description": f"Achat HT - {supplier_name}"
        })
        total_d += subtotal

    # Débit 2 : FODEC (6393 — taxe parafiscale non récupérable, 1% du HT)
    if fodec and fodec > 0:
        lines.append({
            "account_code": "6393",
            "account_name": "Contribution FODEC (1% du HT)",
            "debit": round(fodec, 3),
            "credit": 0,
            "description": f"FODEC - {supplier_name}"
        })
        total_d += fodec

    # Débit 3 : TVA déductible (base = HT + FODEC)
    if total_tax and total_tax > 0:
        tva_account = "43620" if tva_rate >= 19 else "43610" if tva_rate >= 13 else "43611"
        lines.append({
            "account_code": tva_account,
            "account_name": f"TVA déductible ({tva_rate}%) sur achats",
            "debit": round(total_tax, 3),
            "credit": 0,
            "description": f"TVA achat (base HT+FODEC) - {supplier_name}"
        })
        total_d += total_tax

    # Débit 4 : Timbre fiscal (6318 — droit de timbre, charge non récupérable)
    if timbre and timbre > 0:
        lines.append({
            "account_code": "6318",
            "account_name": "Droits de timbre fiscal",
            "debit": round(timbre, 3),
            "credit": 0,
            "description": f"Timbre fiscal - facture {invoice_ref}"
        })
        total_d += timbre

    # Crédit : Fournisseurs (401) = somme exacte des débits pour garantir l'équilibre
    # (le net_a_payer de la facture peut avoir des arrondis — on utilise le total_d)
    credit_amount = round(total_d, 3)
    lines.append({
        "account_code": "401",
        "account_name": "Fournisseurs",
        "debit": 0,
        "credit": credit_amount,
        "description": f"Facture {invoice_ref} - {supplier_name}"
    })
    total_c += credit_amount

    return [{
        "description": f"Facture fournisseur {invoice_ref} - {supplier_name}",
        "journal_type": "purchases",
        "lines": lines,
        "total_debit": round(total_d, 3),
        "total_credit": round(total_c, 3),
    }]


async def _find_existing_supplier(company_id: str, name: Optional[str], fiscal_id: Optional[str]) -> Optional[dict]:
    """Find supplier by fiscal_id or fuzzy name match."""
    if not name and not fiscal_id:
        return None

    query = {"company_id": ObjectId(company_id)}

    if fiscal_id:
        supplier = await db.suppliers.find_one({**query, "fiscal_id": {"$regex": re.escape(fiscal_id.strip()), "$options": "i"}})
        if supplier:
            return supplier

    if name:
        # Try exact match first
        supplier = await db.suppliers.find_one({
            **query,
            "$or": [
                {"display_name": {"$regex": re.escape(name.strip()), "$options": "i"}},
                {"company_name": {"$regex": re.escape(name.strip()), "$options": "i"}},
            ]
        })
        if supplier:
            return supplier

    return None


# ─── Routes ──────────────────────────────────────────────────────────────────

@router.post("/parse")
async def parse_invoice_document(
    file: UploadFile = File(...),
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Upload a supplier invoice (PDF or image) and extract its data.
    Returns extracted data + planned actions for user confirmation.
    """
    await get_current_company(current_user, company_id)

    # Validate file
    content_type = file.content_type or ""
    if content_type not in ALLOWED_MIME:
        # Try to infer from filename
        fn = (file.filename or "").lower()
        if fn.endswith(".pdf"):
            content_type = "application/pdf"
        elif fn.endswith((".jpg", ".jpeg")):
            content_type = "image/jpeg"
        elif fn.endswith(".png"):
            content_type = "image/png"
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Type de fichier non supporté: {content_type}. Formats acceptés: PDF, JPEG, PNG, WebP"
            )

    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="Fichier trop volumineux (max 10 Mo)")

    # Extract data
    try:
        extracted = await extract_invoice_data(file_bytes, file.filename or "", content_type)
    except Exception as e:
        logger.error(f"Extraction error: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur d'extraction: {str(e)}")

    supplier_raw = extracted.get("supplier", {})
    invoice_raw = extracted.get("invoice", {})

    # Check if supplier exists
    existing_supplier = await _find_existing_supplier(
        company_id,
        supplier_raw.get("name"),
        supplier_raw.get("fiscal_id")
    )

    supplier_data = {
        "id": str(existing_supplier["_id"]) if existing_supplier else None,
        "name": existing_supplier.get("display_name") if existing_supplier else supplier_raw.get("name"),
        "fiscal_id": existing_supplier.get("fiscal_id") if existing_supplier else supplier_raw.get("fiscal_id"),
        "phone": existing_supplier.get("phone") if existing_supplier else supplier_raw.get("phone"),
        "email": existing_supplier.get("email") if existing_supplier else supplier_raw.get("email"),
        "address": supplier_raw.get("address"),
        "is_new": existing_supplier is None,
    }

    # Normalize items
    raw_items = invoice_raw.get("items") or []
    items = []
    for item in raw_items:
        qty = float(item.get("quantity") or 1)
        price = float(item.get("unit_price") or 0)
        tva = float(item.get("tax_rate") or 19)
        disc = float(item.get("discount") or 0)
        ht = qty * price * (1 - disc / 100)
        ttc = round(ht * (1 + tva / 100), 3)
        items.append({
            "description": str(item.get("description") or ""),
            "quantity": qty,
            "unit_price": price,
            "tax_rate": tva,
            "discount": disc,
            "total": ttc
        })

    # Totaux extraits par Gemini — RÈGLE : ne recalculer QUE ce qui est absent
    # FODEC et Timbre = 0 si absents de la facture (jamais inventés)
    subtotal  = float(invoice_raw.get("subtotal_ht") or invoice_raw.get("subtotal") or 0)
    fodec     = float(invoice_raw.get("fodec") or 0)          # 0 si facture sans FODEC
    total_tax = float(invoice_raw.get("total_tax") or 0)
    timbre    = float(invoice_raw.get("timbre_fiscal") or invoice_raw.get("timbre") or 0)  # 0 si sans timbre
    total_ttc = float(invoice_raw.get("total_ttc") or 0)
    net_a_payer = float(invoice_raw.get("net_a_payer") or 0)

    # HT depuis les items si Gemini ne l'a pas retourné
    if items and subtotal == 0:
        subtotal = round(sum(
            float(i["quantity"]) * float(i["unit_price"]) * (1 - float(i["discount"]) / 100)
            for i in items
        ), 3)

    # Assiette TVA = HT + FODEC (FODEC peut être 0 — c'est normal)
    assiette_tva = round(subtotal + fodec, 3)

    # TVA : recalcul uniquement si absente de la facture
    if total_tax == 0 and assiette_tva > 0:
        tva_rate_main = items[0]["tax_rate"] if items else 19
        total_tax = round(assiette_tva * tva_rate_main / 100, 3)

    # Net à payer : priorité au champ extrait par Gemini
    if net_a_payer == 0:
        if total_ttc > 0:
            net_a_payer = round(total_ttc + timbre, 3)
        else:
            net_a_payer = round(subtotal + fodec + total_tax + timbre, 3)

    tva_rate_main = items[0]["tax_rate"] if items else 19

    # Invoice date & due date
    date_str = invoice_raw.get("date")
    if not date_str:
        date_str = datetime.now().strftime("%Y-%m-%d")

    due_date_str = invoice_raw.get("due_date")
    if not due_date_str:
        try:
            d = datetime.fromisoformat(date_str)
            due_date_str = (d + timedelta(days=30)).strftime("%Y-%m-%d")
        except Exception:
            due_date_str = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")

    invoice_data = {
        "supplier_number": invoice_raw.get("supplier_number"),
        "date": date_str,
        "due_date": due_date_str,
        "items": items,
        "subtotal": round(subtotal, 3),
        "fodec": round(fodec, 3),
        "assiette_tva": round(assiette_tva, 3),
        "total_tax": round(total_tax, 3),
        "timbre": round(timbre, 3),
        "total": round(subtotal + fodec + total_tax + timbre, 3),   # calculé, pas Gemini
        "notes": None,
    }

    # Total réel = somme des composants (source de vérité, identique à l'endpoint confirm)
    computed_total = round(subtotal + fodec + total_tax + timbre, 3)

    # Mettre à jour invoice_data.total avec le total calculé (pas celui de Gemini)
    invoice_data["total"] = computed_total

    # Build journal entries preview
    inv_ref = invoice_raw.get("supplier_number") or "N/A"
    journal_entries = _build_journal_entries(
        supplier_name=supplier_data.get("name") or "Fournisseur",
        subtotal=subtotal,
        fodec=fodec,
        total_tax=total_tax,
        timbre=timbre,
        net_a_payer=computed_total,
        invoice_ref=inv_ref,
        tva_rate=tva_rate_main
    )

    # Summary of planned actions
    planned_actions = []
    if supplier_data["is_new"] and supplier_data.get("name"):
        planned_actions.append({
            "type": "create_supplier",
            "label": f"Créer le fournisseur «{supplier_data['name']}»",
            "icon": "UserPlus",
            "severity": "info"
        })
    elif not supplier_data["is_new"]:
        planned_actions.append({
            "type": "use_existing_supplier",
            "label": f"Utiliser le fournisseur existant «{supplier_data['name']}»",
            "icon": "User",
            "severity": "success"
        })

    planned_actions.append({
        "type": "create_supplier_invoice",
        "label": f"Créer la facture fournisseur ({computed_total:.3f} TND)",
        "icon": "FileText",
        "severity": "info"
    })

    for je in journal_entries:
        planned_actions.append({
            "type": "create_journal_entry",
            "label": f"Écriture comptable — {je['description']}",
            "icon": "BookOpen",
            "severity": "info"
        })

    return {
        "supplier": supplier_data,
        "invoice": invoice_data,
        "journal_entries": journal_entries,
        "planned_actions": planned_actions,
        "confidence": extracted.get("confidence", 0),
        "extraction_method": extracted.get("extraction_method", "unknown"),
        "warnings": [],
        "error": extracted.get("error"),
        "raw_text_preview": extracted.get("raw_text_preview", "")[:300],
        "filename": file.filename,
    }


@router.post("/confirm")
async def confirm_invoice_import(
    data: ConfirmScanRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Confirm and execute all actions:
    1. Create supplier (if new)
    2. Create supplier invoice
    3. Create journal entries
    """
    company_id = data.company_id
    await get_current_company(current_user, company_id)
    now = datetime.now(timezone.utc)
    user_name = current_user.get("full_name") or current_user.get("email", "")
    results = {}

    # ── 1. Supplier ────────────────────────────────────────────────────────────
    supplier_id = data.supplier.id
    if data.supplier.is_new and data.supplier.name:
        supplier_doc = {
            "company_id": ObjectId(company_id),
            "display_name": data.supplier.name,
            "company_name": data.supplier.name,
            "supplier_type": "entreprise",
            "fiscal_id": data.supplier.fiscal_id,
            "phone": data.supplier.phone,
            "email": data.supplier.email,
            "billing_address": {"street": data.supplier.address} if data.supplier.address else {},
            "currency": "TND",
            "payment_terms": "30_days",
            "balance": 0.0,
            "total_purchases": 0.0,
            "total_paid": 0.0,
            "created_at": now,
            "updated_at": now,
            "created_by": current_user["_id"]
        }
        r = await db.suppliers.insert_one(supplier_doc)
        supplier_id = str(r.inserted_id)
        results["supplier"] = {"created": True, "id": supplier_id, "name": data.supplier.name}

        # Log
        await db.access_logs.insert_one({
            "company_id": ObjectId(company_id), "user_id": current_user["_id"],
            "user_name": user_name, "category": "Fournisseur", "action": "Création (Scanner)",
            "element": data.supplier.name, "created_at": now
        })
    else:
        results["supplier"] = {"created": False, "id": supplier_id, "name": data.supplier.name}

    if not supplier_id:
        raise HTTPException(status_code=400, detail="supplier_id manquant — impossible de créer la facture")

    # ── 2. Supplier Invoice ────────────────────────────────────────────────────
    # Numéro unique basé sur le count réel (évite les doublons)
    count = await db.supplier_invoices.count_documents({"company_id": ObjectId(company_id)})
    si_number = f"FF-{datetime.now().year}-{(count + 1):04d}"

    items = [item.dict() for item in data.invoice.items]

    # Parse dates
    try:
        date_dt = datetime.fromisoformat(data.invoice.date).replace(tzinfo=timezone.utc) if data.invoice.date else now
    except Exception:
        date_dt = now
    try:
        due_dt = datetime.fromisoformat(data.invoice.due_date).replace(tzinfo=timezone.utc) if data.invoice.due_date else (now + timedelta(days=30))
    except Exception:
        due_dt = now + timedelta(days=30)

    # ── Calcul des totaux depuis les données validées ─────────────────────────
    # HT recalculé depuis les items (source de vérité pour le HT)
    items_subtotal = round(sum(
        float(it.get("quantity", 0)) * float(it.get("unit_price", 0)) *
        (1 - float(it.get("discount", 0)) / 100)
        for it in items
    ), 3)

    # FODEC et Timbre : uniquement les valeurs confirmées par l'utilisateur dans le modal
    # (0 si la facture n'en a pas — pas de calcul automatique)
    fodec  = round(float(data.invoice.fodec or 0), 3)
    timbre = round(float(data.invoice.timbre or 0), 3)

    # Assiette TVA = HT + FODEC (FODEC peut être 0)
    assiette_tva = round(items_subtotal + fodec, 3)

    # Taux TVA principal (depuis le premier item, défaut 19%)
    tva_rate_main = float(items[0].get("tax_rate", 19)) if items else 19.0
    # Utiliser total_tax du frontend si présent et cohérent, sinon recalculer
    total_tax_front = round(float(data.invoice.total_tax or 0), 3)
    total_tax_calc  = round(assiette_tva * tva_rate_main / 100, 3)
    # On préfère le total_tax du frontend (extrait par Gemini) si > 0
    total_tax = total_tax_front if total_tax_front > 0 else total_tax_calc

    # Net à payer = HT + FODEC + TVA + Timbre
    net_total = round(items_subtotal + fodec + total_tax + timbre, 3)

    si_doc = {
        "company_id": ObjectId(company_id),
        "supplier_id": ObjectId(supplier_id),
        "supplier_name": data.supplier.name or "",
        "number": si_number,
        "supplier_number": data.invoice.supplier_number,
        "date": date_dt,
        "due_date": due_dt,
        "items": items,
        "subtotal": items_subtotal,   # HT NET des items
        "fodec": fodec,               # FODEC 1%
        "assiette_tva": assiette_tva, # HT + FODEC
        "total_tax": total_tax,       # TVA calculée sur HT+FODEC
        "timbre": timbre,             # Timbre fiscal
        "total_discount": 0,
        "total": net_total,           # Net à payer = HT+FODEC+TVA+Timbre
        "amount_paid": 0,
        "balance_due": net_total,
        "notes": data.invoice.notes,
        "status": "received",
        "created_at": now,
        "updated_at": now,
        "created_by": current_user["_id"],
        "source": "scanner"
    }

    r = await db.supplier_invoices.insert_one(si_doc)
    si_id = str(r.inserted_id)
    results["supplier_invoice"] = {
        "created": True, "id": si_id,
        "number": si_number, "total": net_total
    }

    await db.access_logs.insert_one({
        "company_id": ObjectId(company_id), "user_id": current_user["_id"],
        "user_name": user_name, "category": "Facture fournisseur", "action": "Import Scanner",
        "element": f"{si_number} - {data.supplier.name}", "created_at": now
    })

    # ── 3. Journal Entries ─────────────────────────────────────────────────────
    # Get next entry number
    last = await db.journal_entries.find_one(
        {"company_id": ObjectId(company_id)},
        sort=[("created_at", -1)]
    )
    try:
        last_num = int((last.get("entry_number") or "EC-00000").split("-")[-1])
    except Exception:
        last_num = 0

    created_entries = []
    for i, je in enumerate(data.journal_entries):
        entry_number = f"EC-{(last_num + i + 1):05d}"
        entry_doc = {
            "company_id": ObjectId(company_id),
            "entry_number": entry_number,
            "date": date_dt,
            "reference": si_number,
            "description": je.description,
            "journal_type": je.journal_type,
            "lines": [line.dict() for line in je.lines],
            "total_debit": je.total_debit,
            "total_credit": je.total_credit,
            "status": "posted",
            "document_type": "supplier_invoice",
            "document_id": ObjectId(si_id),
            "created_by": current_user["_id"],
            "created_at": now
        }
        r = await db.journal_entries.insert_one(entry_doc)
        created_entries.append({"id": str(r.inserted_id), "entry_number": entry_number})

    results["journal_entries"] = {"created": len(created_entries), "entries": created_entries}

    return {
        "success": True,
        "message": f"Facture importée avec succès — {si_number}",
        "results": results
    }

