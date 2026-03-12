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

    class Config:
        extra = "allow"


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
    workflow: Optional[Dict[str, Any]] = None
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


def _normalize_text(value: Optional[str]) -> str:
    return re.sub(r"[^a-z0-9]+", " ", (value or "").lower()).strip()


def _words(value: Optional[str]) -> set:
    return {part for part in _normalize_text(value).split() if len(part) >= 3}


def _item_similarity(source_items: List[Dict[str, Any]], target_items: List[Dict[str, Any]]) -> float:
    if not source_items or not target_items:
        return 0.0
    source_sets = [_words(item.get("description")) for item in source_items if item.get("description")]
    target_sets = [_words(item.get("description")) for item in target_items if item.get("description")]
    if not source_sets or not target_sets:
        return 0.0

    matched = 0
    for source in source_sets:
        best = 0.0
        for target in target_sets:
            union = source | target
            if not union:
                continue
            score = len(source & target) / len(union)
            best = max(best, score)
        if best >= 0.4:
            matched += 1
    return round(matched / max(len(source_sets), 1), 3)


async def _find_existing_supplier_invoice(company_id: str, supplier_id: Optional[str], supplier_number: Optional[str], total: float) -> Optional[dict]:
    if not supplier_id and not supplier_number:
        return None
    query = {"company_id": ObjectId(company_id)}
    if supplier_id:
        query["supplier_id"] = ObjectId(supplier_id)
    if supplier_number:
        query["supplier_number"] = supplier_number
    existing = await db.supplier_invoices.find_one(query)
    if existing:
        return existing
    if supplier_id:
        return await db.supplier_invoices.find_one({
            "company_id": ObjectId(company_id),
            "supplier_id": ObjectId(supplier_id),
            "total": {"$gte": round(total - 0.01, 3), "$lte": round(total + 0.01, 3)},
        })
    return None


async def _get_default_warehouse(company_id: str) -> Optional[dict]:
    warehouse = await db.warehouses.find_one({"company_id": ObjectId(company_id), "is_default": True})
    if warehouse:
        return warehouse
    return await db.warehouses.find_one({"company_id": ObjectId(company_id)})


def _find_best_product_match_from_candidates(products: List[dict], description: str) -> Optional[dict]:
    desc_words = _words(description)
    if not desc_words:
        return None
    best_match = None
    best_score = 0.0
    for product in products:
        candidate_text = " ".join([
            product.get("name", ""),
            product.get("sku", ""),
            product.get("brand", ""),
            product.get("category", ""),
        ])
        candidate_words = _words(candidate_text)
        if not candidate_words:
            continue
        union = desc_words | candidate_words
        score = len(desc_words & candidate_words) / len(union) if union else 0.0
        if _normalize_text(product.get("name")) in _normalize_text(description):
            score = max(score, 0.85)
        if product.get("sku") and _normalize_text(product.get("sku")) in _normalize_text(description):
            score = max(score, 0.95)
        if score > best_score:
            best_score = score
            best_match = product
    if best_match and best_score >= 0.35:
        best_match = dict(best_match)
        best_match["_match_score"] = round(best_score, 3)
        return best_match
    return None


async def _find_best_product_match(company_id: str, description: str) -> Optional[dict]:
    products = await db.products.find({"company_id": ObjectId(company_id)}).to_list(500)
    return _find_best_product_match_from_candidates(products, description)


def _guess_stock_decision(description: str, product: Optional[dict]) -> tuple[bool, str, float]:
    service_keywords = {"service", "maintenance", "formation", "consult", "prestation", "abonnement", "facebook", "meta", "ads", "licence", "hébergement", "hebergement"}
    stock_keywords = {"article", "produit", "marchandise", "cartouche", "clavier", "souris", "cable", "écran", "ecran", "pc", "imprimante", "matériel", "materiel", "pièce", "piece"}
    normalized = _normalize_text(description)
    if product:
        if product.get("type") == "service":
            return False, "Produit existant classé comme service", float(product.get("_match_score", 0.7))
        return True, "Produit existant classé en stock", float(product.get("_match_score", 0.8))
    if any(keyword in normalized for keyword in service_keywords):
        return False, "Libellé assimilé à une prestation/service", 0.6
    if any(keyword in normalized for keyword in stock_keywords):
        return True, "Libellé assimilé à un article stockable", 0.45
    return False, "Aucun produit fiable trouvé, revue manuelle recommandée", 0.2


async def _build_intelligent_items(company_id: str, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    warehouse = await _get_default_warehouse(company_id)
    products = await db.products.find({"company_id": ObjectId(company_id)}).to_list(500)
    enriched = []
    for item in items:
        product = _find_best_product_match_from_candidates(products, item.get("description"))
        should_stock, reason, confidence = _guess_stock_decision(item.get("description"), product)
        enriched.append({
            **item,
            "product_id": str(product["_id"]) if product else None,
            "product_name": product.get("name") if product else None,
            "product_type": product.get("type") if product else None,
            "product_match_confidence": round(confidence, 3),
            "stock_decision": "stock" if should_stock else "non_stock",
            "should_create_stock_movement": should_stock and bool(product) and bool(warehouse),
            "stock_reason": reason if warehouse or not should_stock else f"{reason}. Aucun entrepôt par défaut disponible.",
            "warehouse_id": str(warehouse["_id"]) if warehouse else None,
            "warehouse_name": warehouse.get("name") if warehouse else None,
            "review_required": should_stock and not product,
        })
    return enriched


async def _find_matching_purchase_process(
    company_id: str,
    supplier_id: Optional[str],
    items: List[Dict[str, Any]],
) -> Dict[str, Any]:
    workflow = {
        "purchase_order": {"existing_id": None, "existing_number": None, "create": True, "similarity": 0.0},
        "receipt": {"existing_id": None, "existing_number": None, "create": True, "similarity": 0.0},
    }
    if not supplier_id:
        return workflow

    po_candidates = await db.purchase_orders.find({
        "company_id": ObjectId(company_id),
        "supplier_id": ObjectId(supplier_id),
        "status": {"$in": ["draft", "sent", "confirmed", "received"]},
    }).sort("created_at", -1).to_list(10)
    for po in po_candidates:
        score = _item_similarity(items, po.get("items", []))
        if score > workflow["purchase_order"]["similarity"]:
            workflow["purchase_order"] = {
                "existing_id": str(po["_id"]),
                "existing_number": po.get("number"),
                "create": score < 0.6,
                "similarity": score,
            }

    receipt_candidates = await db.receipts.find({
        "company_id": ObjectId(company_id),
        "supplier_id": ObjectId(supplier_id),
        "status": {"$in": ["draft", "validated"]},
    }).sort("created_at", -1).to_list(10)
    for receipt in receipt_candidates:
        score = _item_similarity(items, receipt.get("items", []))
        if score > workflow["receipt"]["similarity"]:
            workflow["receipt"] = {
                "existing_id": str(receipt["_id"]),
                "existing_number": receipt.get("number"),
                "create": score < 0.6,
                "similarity": score,
                "status": receipt.get("status"),
            }
    return workflow


def _build_planned_actions(
    supplier_data: Dict[str, Any],
    invoice_total: float,
    workflow: Dict[str, Any],
    journal_entries: List[Dict[str, Any]],
    items: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    planned_actions = []
    if supplier_data["is_new"] and supplier_data.get("name"):
        planned_actions.append({"type": "create_supplier", "label": f"Créer le fournisseur «{supplier_data['name']}»", "icon": "UserPlus", "severity": "info"})
    elif not supplier_data["is_new"]:
        planned_actions.append({"type": "use_existing_supplier", "label": f"Utiliser le fournisseur existant «{supplier_data['name']}»", "icon": "User", "severity": "success"})

    po_flow = workflow.get("purchase_order", {})
    if po_flow.get("create", True):
        planned_actions.append({"type": "create_purchase_order", "label": "Créer automatiquement le bon de commande manquant", "icon": "Receipt", "severity": "warning"})
    else:
        planned_actions.append({"type": "use_existing_purchase_order", "label": f"Rattacher au bon de commande existant {po_flow.get('existing_number')}", "icon": "Receipt", "severity": "success"})

    receipt_flow = workflow.get("receipt", {})
    if receipt_flow.get("create", True):
        planned_actions.append({"type": "create_receipt", "label": "Créer automatiquement le bon de réception manquant", "icon": "Receipt", "severity": "warning"})
    else:
        planned_actions.append({"type": "use_existing_receipt", "label": f"Rattacher au bon de réception existant {receipt_flow.get('existing_number')}", "icon": "Receipt", "severity": "success"})

    stockable_count = sum(1 for item in items if item.get("should_create_stock_movement"))
    review_count = sum(1 for item in items if item.get("review_required"))
    if stockable_count:
        planned_actions.append({"type": "create_stock_movement", "label": f"Créer {stockable_count} mouvement(s) de stock après revue utilisateur", "icon": "Receipt", "severity": "info"})
    if review_count:
        planned_actions.append({"type": "review_stock_decisions", "label": f"{review_count} ligne(s) nécessitent une revue stock manuelle", "icon": "AlertTriangle", "severity": "warning"})

    planned_actions.append({"type": "create_supplier_invoice", "label": f"Créer la facture fournisseur ({invoice_total:.3f} TND)", "icon": "FileText", "severity": "info"})
    for je in journal_entries:
        planned_actions.append({"type": "create_draft_journal_entry", "label": f"Créer une écriture en brouillon — {je['description']}", "icon": "BookOpen", "severity": "info"})
    return planned_actions


async def _get_next_receipt_number(company_id: str) -> str:
    year = datetime.now().year
    prefix = f"BR-{year}-"
    last_receipt = await db.receipts.find_one(
        {"company_id": ObjectId(company_id), "number": {"$regex": f"^{prefix}"}},
        sort=[("number", -1)]
    )
    if last_receipt:
        try:
            next_num = int(last_receipt["number"].split("-")[-1]) + 1
        except Exception:
            next_num = 1
    else:
        next_num = 1
    return f"{prefix}{next_num:04d}"


async def _ensure_stock_product(company_id: str, current_user: dict, item: Dict[str, Any]) -> Dict[str, Any]:
    if item.get("product_id") or not item.get("should_create_stock_movement"):
        return item

    now = datetime.now(timezone.utc)
    product_name = (item.get("description") or "Article scanné").strip() or "Article scanné"
    sku_prefix = re.sub(r"[^A-Z0-9]+", "", product_name.upper())[:8] or "SCAN"
    product_count = await db.products.count_documents({"company_id": ObjectId(company_id)})
    sku = f"{sku_prefix}-{product_count + 1:04d}"

    product_doc = {
        "company_id": ObjectId(company_id),
        "sku": sku,
        "name": product_name,
        "description": f"Article créé automatiquement depuis le scan de facture: {product_name}",
        "category": "Articles scannés",
        "brand": "",
        "unit": item.get("unit") or "pièce",
        "selling_price": 0,
        "purchase_price": float(item.get("unit_price") or 0),
        "tax_rate": float(item.get("tax_rate") or 19),
        "quantity_in_stock": 0,
        "min_stock_level": 0,
        "type": "product",
        "destination": "both",
        "is_active": True,
        "created_at": now,
        "updated_at": now,
        "source": "invoice_scanner",
        "auto_created": True,
        "created_by": current_user["_id"],
    }
    result = await db.products.insert_one(product_doc)
    return {
        **item,
        "product_id": str(result.inserted_id),
        "product_name": product_name,
        "product_type": "product",
        "review_required": False,
        "stock_reason": f"{item.get('stock_reason')}. Article créé automatiquement à la confirmation.",
    }


async def _apply_stock_entry(company_id: str, current_user: dict, receipt_id: str, invoice_number: str, item: Dict[str, Any]) -> Optional[str]:
    product_id = item.get("product_id")
    warehouse_id = item.get("warehouse_id")
    if not product_id or not warehouse_id:
        return None
    product = await db.products.find_one({"_id": ObjectId(product_id), "company_id": ObjectId(company_id)})
    warehouse = await db.warehouses.find_one({"_id": ObjectId(warehouse_id), "company_id": ObjectId(company_id)})
    if not product or not warehouse or product.get("type") == "service":
        return None

    stock_level = await db.stock_levels.find_one({"warehouse_id": ObjectId(warehouse_id), "product_id": ObjectId(product_id)})
    stock_before = stock_level.get("quantity", 0) if stock_level else 0
    quantity = float(item.get("quantity") or 0)
    stock_after = stock_before + quantity
    unit_cost = float(item.get("unit_price") or product.get("purchase_price", 0) or 0)
    now = datetime.now(timezone.utc)

    if stock_level:
        await db.stock_levels.update_one(
            {"_id": stock_level["_id"]},
            {"$set": {"quantity": stock_after, "unit_cost": unit_cost, "updated_at": now}}
        )
    else:
        await db.stock_levels.insert_one({
            "warehouse_id": ObjectId(warehouse_id),
            "product_id": ObjectId(product_id),
            "quantity": stock_after,
            "unit_cost": unit_cost,
            "created_at": now,
            "updated_at": now,
        })

    all_levels = await db.stock_levels.find({"product_id": ObjectId(product_id)}).to_list(100)
    total_stock = sum(level.get("quantity", 0) for level in all_levels)
    await db.products.update_one(
        {"_id": ObjectId(product_id)},
        {"$set": {"quantity_in_stock": total_stock, "stock_quantity": total_stock, "updated_at": now}}
    )

    result = await db.stock_movements.insert_one({
        "company_id": ObjectId(company_id),
        "product_id": ObjectId(product_id),
        "product_name": product.get("name"),
        "warehouse_id": ObjectId(warehouse_id),
        "warehouse_name": warehouse.get("name"),
        "type": "in",
        "quantity": quantity,
        "unit_cost": unit_cost,
        "total_value": round(quantity * unit_cost, 3),
        "reason": "Réception fournisseur via scanner",
        "reference": invoice_number,
        "reference_type": "receipt",
        "reference_id": ObjectId(receipt_id),
        "stock_before": stock_before,
        "stock_after": stock_after,
        "created_at": now,
        "created_by": current_user["_id"],
        "created_by_name": current_user.get("full_name", ""),
        "source": "scanner",
    })
    return str(result.inserted_id)


async def _create_draft_journal_entries(
    company_id: str,
    supplier_invoice_id: str,
    reference: str,
    date_value,
    journal_entries: List[JournalEntryData],
    current_user: dict,
) -> List[Dict[str, Any]]:
    existing = await db.journal_entries.find({
        "company_id": ObjectId(company_id),
        "document_type": "supplier_invoice",
        "document_id": ObjectId(supplier_invoice_id),
    }).to_list(20)
    if existing:
        return [{"id": str(entry["_id"]), "entry_number": entry.get("entry_number"), "existing": True} for entry in existing]

    last = await db.journal_entries.find_one({"company_id": ObjectId(company_id)}, sort=[("created_at", -1)])
    try:
        last_num = int((last.get("entry_number") or "EC-00000").split("-")[-1])
    except Exception:
        last_num = 0

    created = []
    now = datetime.now(timezone.utc)
    for idx, journal_entry in enumerate(journal_entries):
        entry_number = f"EC-{(last_num + idx + 1):05d}"
        result = await db.journal_entries.insert_one({
            "company_id": ObjectId(company_id),
            "entry_number": entry_number,
            "date": date_value,
            "reference": reference,
            "description": journal_entry.description,
            "journal_type": journal_entry.journal_type,
            "lines": [line.dict() for line in journal_entry.lines],
            "total_debit": journal_entry.total_debit,
            "total_credit": journal_entry.total_credit,
            "status": "draft",
            "document_type": "supplier_invoice",
            "document_id": ObjectId(supplier_invoice_id),
            "created_by": current_user["_id"],
            "created_at": now,
            "auto_generated": True,
            "source": "invoice_scanner",
        })
        created.append({"id": str(result.inserted_id), "entry_number": entry_number, "existing": False})
    return created


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

    items = await _build_intelligent_items(company_id, items)

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

    workflow = await _find_matching_purchase_process(
        company_id,
        supplier_data.get("id"),
        items,
    )
    default_warehouse = await _get_default_warehouse(company_id)
    workflow.update({
        "warehouse_id": str(default_warehouse["_id"]) if default_warehouse else None,
        "warehouse_name": default_warehouse.get("name") if default_warehouse else None,
        "draft_accounting_only": True,
    })

    duplicate_invoice = await _find_existing_supplier_invoice(
        company_id,
        supplier_data.get("id"),
        invoice_data.get("supplier_number"),
        computed_total,
    )

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

    planned_actions = _build_planned_actions(
        supplier_data,
        computed_total,
        workflow,
        journal_entries,
        items,
    )

    warnings = []
    if duplicate_invoice:
        warnings.append(
            f"Une facture fournisseur similaire existe déjà ({duplicate_invoice.get('number') or duplicate_invoice.get('supplier_number')})."
        )
    if not default_warehouse:
        warnings.append("Aucun entrepôt par défaut trouvé : les mouvements de stock seront désactivés.")
    if any(item.get("review_required") for item in items):
        warnings.append("Certaines lignes semblent stockables mais ne sont pas reliées à un produit connu. Vérifie les décisions de stock avant confirmation.")

    return {
        "supplier": supplier_data,
        "invoice": invoice_data,
        "journal_entries": journal_entries,
        "workflow": workflow,
        "planned_actions": planned_actions,
        "confidence": extracted.get("confidence", 0),
        "extraction_method": extracted.get("extraction_method", "unknown"),
        "warnings": warnings,
        "error": extracted.get("error"),
        "raw_text_preview": extracted.get("raw_text_preview", "")[:300],
        "filename": file.filename,
        "duplicate_invoice": {
            "id": str(duplicate_invoice["_id"]),
            "number": duplicate_invoice.get("number"),
        } if duplicate_invoice else None,
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
    workflow = data.workflow or {}

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

    existing_invoice = await _find_existing_supplier_invoice(
        company_id,
        supplier_id,
        data.invoice.supplier_number,
        float(data.invoice.total or 0),
    )
    if existing_invoice:
        raise HTTPException(
            status_code=400,
            detail=f"Une facture fournisseur existe déjà pour cette référence ({existing_invoice.get('number') or existing_invoice.get('supplier_number')}).",
        )

    items = [item.dict() for item in data.invoice.items]

    # ── 2. Purchase Order / Receipt chain ──────────────────────────────────────
    purchase_order_id = workflow.get("purchase_order", {}).get("existing_id")
    purchase_order_number = workflow.get("purchase_order", {}).get("existing_number")
    receipt_id = workflow.get("receipt", {}).get("existing_id")
    receipt_number = workflow.get("receipt", {}).get("existing_number")

    company = await db.companies.find_one({"_id": ObjectId(company_id)})
    numbering = company.get("numbering", {}) if company else {}

    if workflow.get("purchase_order", {}).get("create", True):
        po_number = generate_document_number(numbering.get("po_prefix", "BC"), numbering.get("po_next", 1), datetime.now().year)
        po_doc = {
            "company_id": ObjectId(company_id),
            "supplier_id": ObjectId(supplier_id),
            "supplier_name": data.supplier.name or "",
            "number": po_number,
            "date": now,
            "expected_date": now,
            "items": items,
            "subtotal": float(data.invoice.subtotal or 0),
            "total_tax": float(data.invoice.total_tax or 0),
            "total_discount": 0,
            "total": float(data.invoice.total or 0),
            "status": "confirmed",
            "confirmed_at": now,
            "created_at": now,
            "updated_at": now,
            "created_by": current_user["_id"],
            "source": "invoice_scanner",
            "auto_created": True,
        }
        po_result = await db.purchase_orders.insert_one(po_doc)
        purchase_order_id = str(po_result.inserted_id)
        purchase_order_number = po_number
        await db.companies.update_one({"_id": ObjectId(company_id)}, {"$inc": {"numbering.po_next": 1}})
        results["purchase_order"] = {"created": True, "id": purchase_order_id, "number": po_number}
    elif purchase_order_id:
        results["purchase_order"] = {"created": False, "id": purchase_order_id, "number": purchase_order_number}

    items = [await _ensure_stock_product(company_id, current_user, item) for item in items]

    existing_receipt_doc = None
    if receipt_id and not workflow.get("receipt", {}).get("create", True):
        existing_receipt_doc = await db.receipts.find_one({"_id": ObjectId(receipt_id), "company_id": ObjectId(company_id)})

    stock_items = [item for item in items if item.get("should_create_stock_movement") and item.get("product_id")]
    if existing_receipt_doc and existing_receipt_doc.get("status") == "validated":
        stock_items = []
    receipt_status = "validated" if stock_items else "draft"
    if workflow.get("receipt", {}).get("create", True):
        receipt_number = await _get_next_receipt_number(company_id)
        receipt_doc = {
            "number": receipt_number,
            "date": now,
            "supplier_id": ObjectId(supplier_id),
            "purchase_order_id": ObjectId(purchase_order_id) if purchase_order_id else None,
            "warehouse_id": ObjectId(workflow.get("warehouse_id")) if workflow.get("warehouse_id") else None,
            "items": [
                {
                    "product_id": item.get("product_id"),
                    "product_name": item.get("product_name"),
                    "ordered_quantity": item.get("quantity"),
                    "received_quantity": item.get("quantity"),
                    "unit": item.get("unit") or "unité",
                    "unit_price": item.get("unit_price"),
                    "notes": item.get("stock_reason"),
                }
                for item in items if item.get("product_id")
            ],
            "total_items": len([item for item in items if item.get("product_id")]),
            "total_quantity": sum(float(item.get("quantity") or 0) for item in items if item.get("product_id")),
            "total_value": sum(float(item.get("quantity") or 0) * float(item.get("unit_price") or 0) for item in items if item.get("product_id")),
            "status": receipt_status,
            "notes": "Bon de réception auto-généré depuis le scanner de facture fournisseur",
            "delivery_note_number": data.invoice.supplier_number,
            "company_id": ObjectId(company_id),
            "created_by": current_user["_id"],
            "created_at": now,
            "updated_at": now,
            "validated_at": now if receipt_status == "validated" else None,
            "validated_by": current_user["_id"] if receipt_status == "validated" else None,
            "source": "invoice_scanner",
            "auto_created": True,
        }
        receipt_result = await db.receipts.insert_one(receipt_doc)
        receipt_id = str(receipt_result.inserted_id)
        results["receipt"] = {"created": True, "id": receipt_id, "number": receipt_number, "status": receipt_status}
    elif receipt_id:
        results["receipt"] = {
            "created": False,
            "id": receipt_id,
            "number": receipt_number,
            "status": (existing_receipt_doc or {}).get("status") or workflow.get("receipt", {}).get("status"),
        }

    created_stock_movements = []
    if receipt_id:
        for item in stock_items:
            movement_id = await _apply_stock_entry(company_id, current_user, receipt_id, data.invoice.supplier_number or receipt_number or "SCAN", item)
            if movement_id:
                created_stock_movements.append(movement_id)
    results["stock_movements"] = {
        "created": len(created_stock_movements),
        "ids": created_stock_movements,
        "skipped_existing_validated_receipt": bool(existing_receipt_doc and existing_receipt_doc.get("status") == "validated"),
    }

    # ── 3. Supplier Invoice ────────────────────────────────────────────────────
    # Numéro unique basé sur le count réel (évite les doublons)
    count = await db.supplier_invoices.count_documents({"company_id": ObjectId(company_id)})
    si_number = f"FF-{datetime.now().year}-{(count + 1):04d}"

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
        "purchase_order_id": ObjectId(purchase_order_id) if purchase_order_id else None,
        "receipt_id": ObjectId(receipt_id) if receipt_id else None,
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
        "source": "scanner",
        "regulated_purchase_chain": {
            "purchase_order_id": ObjectId(purchase_order_id) if purchase_order_id else None,
            "receipt_id": ObjectId(receipt_id) if receipt_id else None,
            "stock_review_completed": True,
            "draft_accounting_only": True,
        },
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

    # ── 4. Journal Entries (draft only) ────────────────────────────────────────
    created_entries = await _create_draft_journal_entries(
        company_id,
        si_id,
        si_number,
        date_dt,
        data.journal_entries,
        current_user,
    )
    results["journal_entries"] = {
        "created": len([entry for entry in created_entries if not entry.get("existing")]),
        "existing": len([entry for entry in created_entries if entry.get("existing")]),
        "entries": created_entries,
        "status": "draft",
    }

    await db.supplier_invoices.update_one(
        {"_id": ObjectId(si_id)},
        {"$set": {"proposed_journal_entry_ids": [ObjectId(entry["id"]) for entry in created_entries]}}
    )

    return {
        "success": True,
        "message": f"Facture importée avec succès — {si_number}",
        "results": results
    }

