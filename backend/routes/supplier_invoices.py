from fastapi import APIRouter, HTTPException, status, Depends, Query, Request
from fastapi.responses import FileResponse
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime, timezone, timedelta
import os
import logging
from typing import Optional
from pathlib import Path
import mimetypes
from models.supplier_invoice import SupplierInvoice, SupplierInvoiceCreate, SupplierInvoiceUpdate
from services.accounting_sync_service import accounting_sync_service
from utils.dependencies import get_current_user, get_current_company
from utils.auth import decode_token
from utils.helpers import generate_document_number, calculate_document_totals

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/supplier-invoices", tags=["Supplier Invoices"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]
SUPPLIER_IMPORT_UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads" / "supplier_invoice_imports"


def serialize_si(s: dict) -> dict:
    return {
        "id": str(s["_id"]),
        "company_id": str(s.get("company_id")) if s.get("company_id") else None,
        "supplier_id": str(s.get("supplier_id")) if s.get("supplier_id") else None,
        "supplier_name": s.get("supplier_name", ""),
        "purchase_order_id": str(s.get("purchase_order_id")) if s.get("purchase_order_id") else None,
        "number": s.get("number"),
        "supplier_number": s.get("supplier_number"),
        "date": s["date"].isoformat() if isinstance(s.get("date"), datetime) else s.get("date"),
        "due_date": s["due_date"].isoformat() if isinstance(s.get("due_date"), datetime) else s.get("due_date"),
        "items": s.get("items", []),
        "subtotal": s.get("subtotal", 0),
        "fodec": s.get("fodec", 0),             # FODEC 1% du HT (spécifique Tunisie)
        "assiette_tva": s.get("assiette_tva", 0),
        "total_tax": s.get("total_tax", 0),
        "timbre": s.get("timbre", 0),           # Timbre fiscal (spécifique Tunisie)
        "total_discount": s.get("total_discount", 0),
        "total": s.get("total", 0),
        "amount_paid": s.get("amount_paid", 0),
        "balance_due": s.get("balance_due", 0),
        "notes": s.get("notes"),
        "status": s.get("status", "draft"),
        "attachments": s.get("attachments", []),
        "source": s.get("source"),
        "paid_at": s["paid_at"].isoformat() if isinstance(s.get("paid_at"), datetime) else s.get("paid_at"),
        "created_at": s["created_at"].isoformat() if isinstance(s.get("created_at"), datetime) else s.get("created_at"),
        "updated_at": s["updated_at"].isoformat() if isinstance(s.get("updated_at"), datetime) else s.get("updated_at")
    }


async def _get_current_user_from_token(token: str) -> dict:
    payload = decode_token(token)
    if payload is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication credentials")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication credentials")

    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def _as_object_id(value):
    if not value:
        return None
    if isinstance(value, ObjectId):
        return value
    try:
        return ObjectId(value)
    except Exception:
        return None


def _delete_attachment_files(attachments: list[str]) -> None:
    for rel_path in attachments or []:
        try:
            file_path = (SUPPLIER_IMPORT_UPLOAD_DIR / rel_path).resolve()
            upload_root = SUPPLIER_IMPORT_UPLOAD_DIR.resolve()
            if str(file_path).startswith(str(upload_root)) and file_path.exists():
                file_path.unlink()
                parent = file_path.parent
                if parent != upload_root and parent.exists() and not any(parent.iterdir()):
                    parent.rmdir()
        except Exception:
            logger.warning("Impossible de supprimer la pièce jointe %s", rel_path, exc_info=True)


def _is_scanner_auto_created(document: Optional[dict]) -> bool:
    if not document:
        return False
    return bool(document.get("auto_created") or document.get("source") in {"scanner", "invoice_scanner"})


async def _revert_stock_movement(company_id: str, movement: dict) -> None:
    product_id = movement.get("product_id")
    warehouse_id = movement.get("warehouse_id")
    quantity = float(movement.get("quantity") or 0)
    if not product_id or not warehouse_id or quantity <= 0:
        return

    stock_level = await db.stock_levels.find_one({
        "warehouse_id": warehouse_id,
        "product_id": product_id
    })
    now = datetime.now(timezone.utc)

    if stock_level:
        current_qty = float(stock_level.get("quantity") or 0)
        new_qty = max(0, current_qty - quantity)
        await db.stock_levels.update_one(
            {"_id": stock_level["_id"]},
            {"$set": {"quantity": new_qty, "updated_at": now}}
        )

    all_levels = await db.stock_levels.find({"product_id": product_id}).to_list(100)
    total_stock = sum(float(level.get("quantity") or 0) for level in all_levels)
    await db.products.update_one(
        {"_id": product_id},
        {"$set": {"quantity_in_stock": total_stock, "stock_quantity": total_stock, "updated_at": now}}
    )


async def _delete_scanner_stock_movements(company_id: str, supplier_invoice: dict, receipt_id=None, receipt_number: Optional[str] = None) -> int:
    company_object_id = ObjectId(company_id)
    receipt_id = _as_object_id(receipt_id)
    product_ids = [_as_object_id(item.get("product_id")) for item in (supplier_invoice.get("items") or [])]
    product_ids = [product_id for product_id in product_ids if product_id]

    references = {
        str(value).strip()
        for value in [
            supplier_invoice.get("supplier_number"),
            supplier_invoice.get("number"),
            receipt_number,
        ]
        if value
    }

    query = {
        "company_id": company_object_id,
        "source": {"$in": ["scanner", "invoice_scanner"]},
    }
    if product_ids:
        query["product_id"] = {"$in": product_ids}

    movement_filters = []
    if receipt_id:
        movement_filters.append({"reference_id": receipt_id})
    if references:
        movement_filters.append({"reference": {"$in": list(references)}})

    created_at = supplier_invoice.get("created_at")
    if not movement_filters and isinstance(created_at, datetime):
        query["created_at"] = {
            "$gte": created_at - timedelta(minutes=5),
            "$lte": created_at + timedelta(minutes=5),
        }
    elif movement_filters:
        query["$or"] = movement_filters
    else:
        return 0

    stock_movements = await db.stock_movements.find(query).to_list(200)
    for movement in stock_movements:
        await _revert_stock_movement(company_id, movement)

    if stock_movements:
        await db.stock_movements.delete_many({
            "_id": {"$in": [movement["_id"] for movement in stock_movements]}
        })
    return len(stock_movements)


async def _delete_auto_created_receipt_chain(company_id: str, supplier_invoice: dict, supplier_invoice_id) -> dict:
    summary = {"deleted_receipt": False, "deleted_stock_movements": 0, "deleted_purchase_order": False}
    company_object_id = ObjectId(company_id)
    receipt_id = _as_object_id(supplier_invoice.get("receipt_id") or (supplier_invoice.get("regulated_purchase_chain") or {}).get("receipt_id"))
    receipt = await db.receipts.find_one({"_id": receipt_id, "company_id": ObjectId(company_id)})
    summary["deleted_stock_movements"] = await _delete_scanner_stock_movements(
        company_id,
        supplier_invoice,
        receipt_id=receipt_id,
        receipt_number=receipt.get("number") if receipt else None
    )

    if receipt_id and receipt and _is_scanner_auto_created(receipt):
        other_invoices = await db.supplier_invoices.count_documents({
            "company_id": company_object_id,
            "receipt_id": receipt_id,
            "_id": {"$ne": supplier_invoice_id}
        })
        if other_invoices == 0:
            await db.receipts.delete_one({"_id": receipt_id})
            summary["deleted_receipt"] = True

    po_id = _as_object_id(
        supplier_invoice.get("purchase_order_id")
        or (supplier_invoice.get("regulated_purchase_chain") or {}).get("purchase_order_id")
        or (receipt or {}).get("purchase_order_id")
    )
    if po_id:
        other_receipts = await db.receipts.count_documents({
            "company_id": company_object_id,
            "purchase_order_id": po_id,
            **({"_id": {"$ne": receipt_id}} if receipt_id else {})
        })
        other_invoices_for_po = await db.supplier_invoices.count_documents({
            "company_id": company_object_id,
            "purchase_order_id": po_id,
            "_id": {"$ne": supplier_invoice_id}
        })
        if other_receipts == 0 and other_invoices_for_po == 0:
            purchase_order = await db.purchase_orders.find_one({"_id": po_id, "company_id": company_object_id})
            if purchase_order and _is_scanner_auto_created(purchase_order):
                await db.purchase_orders.delete_one({"_id": po_id})
                summary["deleted_purchase_order"] = True

    return summary


async def _delete_auto_created_products(company_id: str, supplier_invoice: dict, supplier_invoice_id) -> int:
    company_object_id = ObjectId(company_id)
    candidate_product_ids = [
        _as_object_id(product_id)
        for product_id in (supplier_invoice.get("auto_created_product_ids") or [])
    ]
    candidate_product_ids.extend(
        _as_object_id(item.get("product_id"))
        for item in (supplier_invoice.get("items") or [])
    )

    deleted_count = 0
    seen_ids = set()
    for product_id in candidate_product_ids:
        if not product_id or str(product_id) in seen_ids:
            continue
        seen_ids.add(str(product_id))

        product = await db.products.find_one({"_id": product_id, "company_id": company_object_id})
        if not product or not _is_scanner_auto_created(product):
            continue

        product_id_str = str(product_id)
        other_invoices = await db.supplier_invoices.count_documents({
            "company_id": company_object_id,
            "_id": {"$ne": supplier_invoice_id},
            "items.product_id": product_id_str
        })
        other_receipts = await db.receipts.count_documents({
            "company_id": company_object_id,
            "items.product_id": product_id_str
        })
        other_purchase_orders = await db.purchase_orders.count_documents({
            "company_id": company_object_id,
            "items.product_id": product_id_str
        })
        remaining_stock = await db.stock_levels.count_documents({
            "product_id": product_id,
            "quantity": {"$gt": 0}
        })
        remaining_movements = await db.stock_movements.count_documents({
            "company_id": company_object_id,
            "product_id": product_id
        })

        if other_invoices or other_receipts or other_purchase_orders or remaining_stock or remaining_movements:
            continue

        await db.stock_levels.delete_many({"product_id": product_id})
        await db.products.delete_one({"_id": product_id})
        deleted_count += 1

    return deleted_count


async def _delete_auto_created_supplier(company_id: str, supplier_invoice: dict, supplier_invoice_id) -> bool:
    company_object_id = ObjectId(company_id)
    supplier_id = _as_object_id(supplier_invoice.get("auto_created_supplier_id") or supplier_invoice.get("supplier_id"))
    if not supplier_id:
        return False

    supplier = await db.suppliers.find_one({"_id": supplier_id, "company_id": company_object_id})
    if not supplier:
        return False

    supplier_created_at = supplier.get("created_at")
    invoice_created_at = supplier_invoice.get("created_at")
    is_probably_scanner_supplier = _is_scanner_auto_created(supplier)
    if not is_probably_scanner_supplier:
        is_probably_scanner_supplier = bool(
            supplier_invoice.get("source") == "scanner"
            and isinstance(supplier_created_at, datetime)
            and isinstance(invoice_created_at, datetime)
            and abs((invoice_created_at - supplier_created_at).total_seconds()) <= 600
        )
    if not is_probably_scanner_supplier:
        return False

    other_invoices = await db.supplier_invoices.count_documents({
        "company_id": company_object_id,
        "supplier_id": supplier_id,
        "_id": {"$ne": supplier_invoice_id}
    })
    other_payments = await db.supplier_payments.count_documents({
        "company_id": company_object_id,
        "supplier_id": supplier_id
    })
    other_purchase_orders = await db.purchase_orders.count_documents({
        "company_id": company_object_id,
        "supplier_id": supplier_id
    })
    other_receipts = await db.receipts.count_documents({
        "company_id": company_object_id,
        "supplier_id": supplier_id
    })

    if other_invoices or other_payments or other_purchase_orders or other_receipts:
        return False

    await db.suppliers.delete_one({"_id": supplier_id})
    return True


async def log_action(company_id, user_id, user_name, action, element, ip_address=None):
    await db.access_logs.insert_one({
        "company_id": ObjectId(company_id), "user_id": ObjectId(user_id), "user_name": user_name,
        "category": "Facture fournisseur", "action": action, "element": element,
        "ip_address": ip_address, "created_at": datetime.now(timezone.utc)
    })


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_supplier_invoice(data: SupplierInvoiceCreate, request: Request, company_id: str = Query(...), current_user: dict = Depends(get_current_user)):
    company = await get_current_company(current_user, company_id)
    
    numbering = company.get("numbering", {})
    number = generate_document_number(numbering.get("si_prefix", "FF"), numbering.get("si_next", 1), datetime.now().year)
    
    items = [item.dict() for item in data.items]
    totals = calculate_document_totals(items)
    
    doc_dict = data.dict(exclude={'items'})
    if isinstance(doc_dict.get('date'), str):
        doc_dict['date'] = datetime.fromisoformat(doc_dict['date'].replace('Z', '+00:00'))
    if isinstance(doc_dict.get('due_date'), str):
        doc_dict['due_date'] = datetime.fromisoformat(doc_dict['due_date'].replace('Z', '+00:00'))
    
    doc_dict.update({
        "company_id": ObjectId(company_id), "supplier_id": ObjectId(data.supplier_id),
        "number": number, "items": items, **totals, "amount_paid": 0, "balance_due": totals["total"],
        "status": "received", "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "created_by": current_user["_id"]
    })
    
    if data.purchase_order_id:
        doc_dict["purchase_order_id"] = ObjectId(data.purchase_order_id)
    
    result = await db.supplier_invoices.insert_one(doc_dict)
    await db.companies.update_one({"_id": ObjectId(company_id)}, {"$inc": {"numbering.si_next": 1}})
    
    # Update supplier stats
    await db.suppliers.update_one({"_id": ObjectId(data.supplier_id)}, {"$inc": {"invoice_count": 1, "total_invoiced": totals["total"], "balance": totals["total"]}})
    
    # Update stock - increase for purchased items
    warehouse = await db.warehouses.find_one({"company_id": ObjectId(company_id), "is_default": True})
    if not warehouse:
        warehouse = await db.warehouses.find_one({"company_id": ObjectId(company_id)})
    
    if warehouse:
        for item in items:
            product_id = item.get("product_id")
            if product_id:
                product = await db.products.find_one({"_id": ObjectId(product_id)})
                if product and product.get("type") != "service":
                    current_stock = product.get("quantity_in_stock", 0)
                    qty = item.get("quantity", 0)
                    new_stock = current_stock + qty
                    
                    # Create stock movement (entrée)
                    await db.stock_movements.insert_one({
                        "company_id": ObjectId(company_id),
                        "product_id": ObjectId(product_id),
                        "product_name": product.get("name"),
                        "warehouse_id": warehouse["_id"],
                        "warehouse_name": warehouse.get("name"),
                        "type": "in",
                        "quantity": qty,
                        "unit_cost": item.get("unit_price", product.get("purchase_price", 0)),
                        "total_value": qty * item.get("unit_price", product.get("purchase_price", 0)),
                        "reason": "Achat",
                        "reference": number,
                        "stock_before": current_stock,
                        "stock_after": new_stock,
                        "created_at": datetime.now(timezone.utc),
                        "created_by": current_user["_id"],
                        "created_by_name": current_user.get("full_name", "")
                    })
                    
                    # Update product stock
                    await db.products.update_one(
                        {"_id": ObjectId(product_id)},
                        {"$set": {"quantity_in_stock": new_stock, "updated_at": datetime.now(timezone.utc)}}
                    )
    
    await log_action(company_id, str(current_user["_id"]), current_user.get("full_name", ""), "Créer", number, request.client.host if request.client else None)
    
    # Synchronisation comptable automatique si statut validated
    if doc_dict.get("status") == "validated":
        try:
            await accounting_sync_service.sync_supplier_invoice(str(result.inserted_id))
        except Exception as e:
            logger.error(f"Erreur synchronisation comptable facture fournisseur {result.inserted_id}: {str(e)}")
    
    return {"id": str(result.inserted_id), "number": number, "message": "Supplier invoice created"}


@router.get("/")
async def list_supplier_invoices(company_id: str = Query(...), search: Optional[str] = None, status_filter: Optional[str] = Query(None, alias="status"), current_user: dict = Depends(get_current_user)):
    company = await get_current_company(current_user, company_id)
    
    query = {"company_id": ObjectId(company_id)}
    if search:
        query["$or"] = [{"number": {"$regex": search, "$options": "i"}}, {"supplier_number": {"$regex": search, "$options": "i"}}]
    if status_filter:
        query["status"] = status_filter
    
    docs = await db.supplier_invoices.find(query).sort("created_at", -1).to_list(1000)
    
    for doc in docs:
        if doc.get("supplier_id"):
            supplier = await db.suppliers.find_one({"_id": doc["supplier_id"]})
            doc["supplier_name"] = supplier.get("display_name", "Inconnu") if supplier else "Inconnu"
    
    return [serialize_si(d) for d in docs]


@router.get("/pending")
async def get_pending_invoices(company_id: str = Query(...), supplier_id: Optional[str] = Query(None), current_user: dict = Depends(get_current_user)):
    """Get supplier invoices with outstanding balance for payment allocation"""
    company = await get_current_company(current_user, company_id)
    query = {"company_id": ObjectId(company_id), "balance_due": {"$gt": 0}}
    if supplier_id:
        query["supplier_id"] = ObjectId(supplier_id)
    
    invoices = await db.supplier_invoices.find(query).sort("date", 1).to_list(1000)
    result = []
    for inv in invoices:
        supplier = await db.suppliers.find_one({"_id": inv.get("supplier_id")})
        result.append({
            "id": str(inv["_id"]), "number": inv.get("number"),
            "date": inv["date"].isoformat() if isinstance(inv.get("date"), datetime) else inv.get("date"),
            "supplier_id": str(inv.get("supplier_id")) if inv.get("supplier_id") else None,
            "supplier_name": supplier.get("display_name", "") if supplier else "",
            "total": inv.get("total", 0), "amount_paid": inv.get("amount_paid", 0), "balance_due": inv.get("balance_due", 0)
        })
    return result


@router.get("/{doc_id}")
async def get_supplier_invoice(doc_id: str, company_id: str = Query(...), current_user: dict = Depends(get_current_user)):
    company = await get_current_company(current_user, company_id)
    doc = await db.supplier_invoices.find_one({"_id": ObjectId(doc_id), "company_id": ObjectId(company_id)})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier invoice not found")
    if doc.get("supplier_id"):
        supplier = await db.suppliers.find_one({"_id": doc["supplier_id"]})
        doc["supplier_name"] = supplier.get("display_name", "") if supplier else ""
    return serialize_si(doc)


@router.get("/{doc_id}/attachment")
async def get_supplier_invoice_attachment(
    doc_id: str,
    company_id: str = Query(...),
    index: int = Query(0, ge=0),
    token: str = Query(...)
):
    current_user = await _get_current_user_from_token(token)
    await get_current_company(current_user=current_user, company_id=company_id)

    doc = await db.supplier_invoices.find_one({"_id": ObjectId(doc_id), "company_id": ObjectId(company_id)})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier invoice not found")

    attachments = doc.get("attachments") or []
    if index >= len(attachments):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment not found")

    rel_path = attachments[index]
    file_path = (SUPPLIER_IMPORT_UPLOAD_DIR / rel_path).resolve()
    upload_root = SUPPLIER_IMPORT_UPLOAD_DIR.resolve()
    if not str(file_path).startswith(str(upload_root)) or not file_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment file not found")

    media_type = mimetypes.guess_type(str(file_path))[0] or "application/octet-stream"
    return FileResponse(path=file_path, media_type=media_type, filename=file_path.name)


@router.put("/{doc_id}")
async def update_supplier_invoice(doc_id: str, data: SupplierInvoiceUpdate, request: Request, company_id: str = Query(...), current_user: dict = Depends(get_current_user)):
    company = await get_current_company(current_user, company_id)
    existing = await db.supplier_invoices.find_one({"_id": ObjectId(doc_id)})
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier invoice not found")
    
    update_data = {k: v for k, v in data.dict(exclude_unset=True).items()}
    if 'items' in update_data and update_data['items']:
        items = [item.dict() if hasattr(item, 'dict') else item for item in update_data['items']]
        totals = calculate_document_totals(items)
        update_data.update(totals)
        update_data['items'] = items
        update_data['balance_due'] = totals['total'] - existing.get('amount_paid', 0)
    if 'supplier_id' in update_data and update_data['supplier_id']:
        update_data['supplier_id'] = ObjectId(update_data['supplier_id'])
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.supplier_invoices.update_one({"_id": ObjectId(doc_id), "company_id": ObjectId(company_id)}, {"$set": update_data})
    await log_action(company_id, str(current_user["_id"]), current_user.get("full_name", ""), "Modifier", existing.get("number", ""), request.client.host if request.client else None)
    
    # Synchronisation comptable automatique si changement de statut vers validated
    old_status = existing.get("status")
    new_status = update_data.get("status")
    if new_status == "validated" and old_status != new_status:
        try:
            await accounting_sync_service.sync_supplier_invoice(doc_id)
        except Exception as e:
            logger.error(f"Erreur synchronisation comptable facture fournisseur {doc_id}: {str(e)}")
    
    return {"message": "Supplier invoice updated"}


@router.delete("/{doc_id}")
async def delete_supplier_invoice(doc_id: str, request: Request, company_id: str = Query(...), current_user: dict = Depends(get_current_user)):
    company = await get_current_company(current_user, company_id)
    company_object_id = ObjectId(company_id)
    supplier_invoice_id = ObjectId(doc_id)
    doc = await db.supplier_invoices.find_one({"_id": supplier_invoice_id, "company_id": company_object_id})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier invoice not found")

    deleted_journal_entries = 0
    deleted_payment_entries = 0
    deleted_attachment_count = len(doc.get("attachments") or [])
    deleted_products_count = 0
    deleted_supplier = False

    # Delete accounting entries linked to this invoice import/payment chain.
    invoice_entry_ids = [_as_object_id(entry_id) for entry_id in (doc.get("proposed_journal_entry_ids") or [])]
    invoice_entry_ids = [entry_id for entry_id in invoice_entry_ids if entry_id]
    if invoice_entry_ids:
        result = await db.journal_entries.delete_many({
            "company_id": company_object_id,
            "_id": {"$in": invoice_entry_ids}
        })
        deleted_journal_entries += result.deleted_count

    result = await db.journal_entries.delete_many({
        "company_id": company_object_id,
        "document_type": "supplier_invoice",
        "document_id": supplier_invoice_id
    })
    deleted_journal_entries += result.deleted_count

    result = await db.journal_entries.delete_many({
        "company_id": company_object_id,
        "document_type": "supplier_payment",
        "document_id": supplier_invoice_id
    })
    deleted_payment_entries += result.deleted_count

    # Delete auto-generated receipt / stock / PO even if the stock entry exists without a BR.
    receipt_summary = await _delete_auto_created_receipt_chain(
        company_id,
        doc,
        supplier_invoice_id
    )

    # Update supplier stats
    if doc.get("supplier_id"):
        await db.suppliers.update_one(
            {"_id": doc["supplier_id"]},
            {"$inc": {
                "invoice_count": -1,
                "total_invoiced": -doc.get("total", 0),
                "balance": -doc.get("balance_due", 0),
                "total_paid": -(doc.get("amount_paid", 0) or 0)
            }}
        )

    await db.supplier_invoices.delete_one({"_id": supplier_invoice_id})
    deleted_products_count = await _delete_auto_created_products(company_id, doc, supplier_invoice_id)
    deleted_supplier = await _delete_auto_created_supplier(company_id, doc, supplier_invoice_id)
    _delete_attachment_files(doc.get("attachments") or [])
    await log_action(company_id, str(current_user["_id"]), current_user.get("full_name", ""), "Supprimer", doc.get("number", ""), request.client.host if request.client else None)
    return {
        "message": "Supplier invoice deleted",
        "cascade": {
            "journal_entries_deleted": deleted_journal_entries,
            "payment_entries_deleted": deleted_payment_entries,
            "receipt_deleted": receipt_summary["deleted_receipt"],
            "purchase_order_deleted": receipt_summary["deleted_purchase_order"],
            "stock_movements_deleted": receipt_summary["deleted_stock_movements"],
            "products_deleted": deleted_products_count,
            "supplier_deleted": deleted_supplier,
            "attachments_deleted": deleted_attachment_count,
        }
    }


# ─── Paiement d'une facture fournisseur ───────────────────────────────────────

PAYMENT_METHOD_MAP = {
    "cash":     {"account": "531000", "name": "Caisse"},
    "check":    {"account": "521000", "name": "Banques — Chèque"},
    "transfer": {"account": "521000", "name": "Banques — Virement"},
    "card":     {"account": "521000", "name": "Banques — Carte"},
    "e_dinar":  {"account": "531000", "name": "Caisse — E-Dinar"},
}

@router.post("/{doc_id}/mark-paid")
async def mark_supplier_invoice_paid(
    doc_id: str,
    company_id: str = Query(...),
    payment_method: str = Query("transfer"),
    payment_reference: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """Marquer une facture fournisseur comme payée et créer l'écriture de règlement."""
    company = await get_current_company(current_user, company_id)

    inv = await db.supplier_invoices.find_one({"_id": ObjectId(doc_id), "company_id": ObjectId(company_id)})
    if not inv:
        raise HTTPException(status_code=404, detail="Facture non trouvée")
    if inv.get("status") == "paid":
        raise HTTPException(status_code=400, detail="Facture déjà payée")

    now = datetime.now(timezone.utc)
    amount = inv.get("balance_due") or inv.get("total", 0)
    user_name = current_user.get("full_name") or current_user.get("email", "")
    inv_number = inv.get("number") or str(doc_id)
    supplier_name = inv.get("supplier_name") or ""

    # ── Mise à jour de la facture ──────────────────────────────────────────────
    await db.supplier_invoices.update_one(
        {"_id": ObjectId(doc_id)},
        {"$set": {
            "status": "paid",
            "amount_paid": amount,
            "balance_due": 0,
            "paid_at": now,
            "payment_method": payment_method,
            "payment_reference": payment_reference,
            "updated_at": now
        }}
    )

    # ── Mise à jour solde fournisseur ──────────────────────────────────────────
    if inv.get("supplier_id"):
        await db.suppliers.update_one(
            {"_id": inv["supplier_id"]},
            {"$inc": {"balance": -amount, "total_paid": amount}}
        )

    # ── Écriture comptable de règlement (401 / 521 ou 531) ─────────────────────
    method_info = PAYMENT_METHOD_MAP.get(payment_method, PAYMENT_METHOD_MAP["transfer"])
    treasury_account = method_info["account"]
    treasury_name    = method_info["name"]

    # Trouver le dernier numéro d'écriture
    last = await db.journal_entries.find_one(
        {"company_id": ObjectId(company_id)},
        sort=[("created_at", -1)]
    )
    try:
        last_num = int((last.get("entry_number") or "EC-00000").split("-")[-1])
    except Exception:
        last_num = 0

    entry_number = f"EC-{(last_num + 1):05d}"
    payment_desc = f"Règlement {inv_number} - {supplier_name} ({method_info['name']})"
    if payment_reference:
        payment_desc += f" — Réf: {payment_reference}"

    journal_entry = {
        "company_id": ObjectId(company_id),
        "entry_number": entry_number,
        "date": now,
        "reference": inv_number,
        "payment_reference": payment_reference,
        "description": payment_desc,
        "journal_type": "bank" if payment_method in ("transfer", "check", "card") else "cash",
        "lines": [
            {
                "account_code": "401",
                "account_name": "Fournisseurs",
                "debit": round(amount, 3),
                "credit": 0,
                "description": f"Règlement facture {inv_number}"
            },
            {
                "account_code": treasury_account,
                "account_name": treasury_name,
                "debit": 0,
                "credit": round(amount, 3),
                "description": f"Paiement {method_info['name']}"
            }
        ],
        "total_debit": round(amount, 3),
        "total_credit": round(amount, 3),
        "status": "posted",
        "document_type": "supplier_payment",
        "document_id": ObjectId(doc_id),
        "payment_method": payment_method,
        "created_by": current_user["_id"],
        "created_at": now
    }
    je_result = await db.journal_entries.insert_one(journal_entry)

    # ── Cash register pour paiements en espèces ───────────────────────────────
    if payment_method in ("cash", "e_dinar"):
        try:
            from routes.cash_accounts import auto_record_cash_movement
            await auto_record_cash_movement(
                db=db,
                company_id=company_id,
                amount=-amount,   # sortie de caisse
                description=f"Paiement fournisseur {inv_number} - {supplier_name}",
                reference=inv_number,
                payment_method=payment_method,
                user_id=str(current_user["_id"])
            )
        except Exception as e:
            logger.warning(f"Cash register update failed: {e}")

    await log_action(company_id, str(current_user["_id"]), user_name,
                     "Paiement", f"{inv_number} ({payment_method})")

    return {
        "message": f"Facture {inv_number} marquée payée",
        "payment_method": payment_method,
        "amount": amount,
        "journal_entry_id": str(je_result.inserted_id),
        "entry_number": entry_number
    }


@router.get("/{doc_id}/payments")
async def get_supplier_invoice_payments(
    doc_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Récupère les écritures de paiement liées à une facture fournisseur."""
    await get_current_company(current_user, company_id)
    entries = await db.journal_entries.find({
        "company_id": ObjectId(company_id),
        "document_id": ObjectId(doc_id),
        "document_type": "supplier_payment"
    }).sort("created_at", -1).to_list(20)

    result = []
    for e in entries:
        result.append({
            "id": str(e["_id"]),
            "entry_number": e.get("entry_number"),
            "date": e.get("date").isoformat() if e.get("date") else None,
            "amount": e.get("total_debit", 0),
            "payment_method": e.get("payment_method"),
            "payment_reference": e.get("payment_reference"),
            "description": e.get("description"),
        })
    return result
