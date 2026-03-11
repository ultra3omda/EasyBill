"""
bank_statement_import.py
API routes for bank statement import, transactions, and reconciliation.
"""
import os
import asyncio
import uuid
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, Query, UploadFile, File, BackgroundTasks
from bson import ObjectId
from pydantic import BaseModel

from motor.motor_asyncio import AsyncIOMotorClient
from utils.dependencies import get_current_user, get_current_company
from services.bank_statement_extraction_service import (
    bank_statement_extraction_service,
    BankStatementExtractionService,
)
from services.bank_statement_parser_service import BankStatementParserService
from services.reconciliation_engine_service import ReconciliationEngineService
from services.journal_posting_service import JournalPostingService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/bank-statement-import", tags=["Bank Statement Import"])

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

UPLOAD_DIR = Path(__file__).parent.parent / "uploads" / "bank_statement_imports"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


class ApproveReconciliationRequest(BaseModel):
    suggestion_id: str
    transaction_id: str


class ManualEntryRequest(BaseModel):
    transaction_id: str
    account_code: str
    account_name: str
    direction: Optional[str] = None


# ─── Background job helpers ───────────────────────────────────────────────────

async def _run_import_job(import_id: str, company_id: str, file_path: str, user_id: str):
    """Background: extract transactions and generate suggestions."""
    try:
        if not Path(file_path).exists():
            raise FileNotFoundError(f"Fichier introuvable: {file_path}")
        await db.bank_statement_imports.update_one(
            {"_id": ObjectId(import_id)},
            {"$set": {"status": "processing", "updated_at": datetime.now(timezone.utc)}},
        )
        extracted = await asyncio.wait_for(
            bank_statement_extraction_service.extract_from_file(file_path, company_id),
            timeout=600.0
        )
        transactions = extracted.get("transactions") or []
        recon_engine = ReconciliationEngineService(db)
        complexity = await recon_engine.estimate_complexity(transactions, company_id)
        parser_estimate = BankStatementParserService.estimate_transaction_count_from_text(extracted.get("ocr_text") or "")
        estimated_count = max(len(transactions), parser_estimate)

        status_after_extraction = complexity["status"]
        if status_after_extraction == "too_many_lines":
            await db.bank_statement_imports.update_one(
                {"_id": ObjectId(import_id)},
                {
                    "$set": {
                        "status": "needs_split",
                        "transaction_count": 0,
                        "estimated_transaction_count": estimated_count,
                        "processing_complexity": complexity["processing_complexity"],
                        "import_warning": complexity["import_warning"],
                        "suggested_split": complexity["suggested_split"],
                        "ocr_provider": extracted.get("ocr_provider"),
                        "ocr_raw": extracted.get("ocr_raw"),
                        "ocr_text": extracted.get("ocr_text"),
                        "parsing_warnings": extracted.get("parsing_warnings", []),
                        "updated_at": datetime.now(timezone.utc),
                    }
                },
            )
            return

        seen_hashes = set()
        inserted = 0
        for t in transactions:
            norm = BankStatementExtractionService.normalize_transaction(
                t, ObjectId(import_id), ObjectId(company_id)
            )
            if norm["hash_unique"] in seen_hashes:
                continue
            seen_hashes.add(norm["hash_unique"])
            existing = await db.bank_transactions.find_one({
                "company_id": ObjectId(company_id),
                "hash_unique": norm["hash_unique"],
            })
            if existing:
                continue
            norm["created_at"] = datetime.now(timezone.utc)
            norm["updated_at"] = datetime.now(timezone.utc)
            norm["direction"] = "credit" if norm.get("amount_signed", 0) > 0 else "debit"
            norm["status"] = "review_required" if status_after_extraction == "review_required" else "pending"
            norm["reconciliation_status"] = "pending"
            await db.bank_transactions.insert_one(norm)
            inserted += 1
        await db.bank_statement_imports.update_one(
            {"_id": ObjectId(import_id)},
            {
                "$set": {
                    "status": "review_required" if status_after_extraction == "review_required" else "processed",
                    "transaction_count": inserted,
                    "estimated_transaction_count": estimated_count,
                    "processing_complexity": complexity["processing_complexity"],
                    "import_warning": complexity["import_warning"],
                    "suggested_split": complexity["suggested_split"],
                    "ocr_provider": extracted.get("ocr_provider"),
                    "ocr_raw": extracted.get("ocr_raw"),
                    "ocr_text": extracted.get("ocr_text"),
                    "parsing_warnings": extracted.get("parsing_warnings", []),
                    "processed_at": datetime.now(timezone.utc),
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )
        await recon_engine.generate_suggestions_for_import(import_id, company_id)
    except asyncio.TimeoutError:
        logger.warning("Import job timeout: %s", import_id)
        await db.bank_statement_imports.update_one(
            {"_id": ObjectId(import_id)},
            {
                "$set": {
                    "status": "failed",
                    "error_message": "Timeout extraction (10 min). Réessayez.",
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )
    except Exception as e:
        logger.exception("Import job failed: %s", e)
        await db.bank_statement_imports.update_one(
            {"_id": ObjectId(import_id)},
            {
                "$set": {
                    "status": "failed",
                    "error_message": str(e)[:500],
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.post("/upload")
async def upload_bank_statement(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user),
):
    """Upload bank statement PDF/image. Starts background extraction."""
    await get_current_company(current_user, company_id)
    fn = file.filename or "statement"
    ext = Path(fn).suffix or ".pdf"
    safe_name = f"{uuid.uuid4().hex}{ext}"
    file_path = UPLOAD_DIR / safe_name
    content = await file.read()
    if len(content) > 15 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Fichier trop volumineux (max 15 Mo)")
    with open(file_path, "wb") as f:
        f.write(content)
    doc = {
        "company_id": ObjectId(company_id),
        "file_path": str(file_path),
        "file_name": fn,
        "original_file_name": fn,
        "mime_type": file.content_type,
        "provider": "document_ai",
        "ocr_provider": None,
        "status": "pending",
        "transaction_count": 0,
        "estimated_transaction_count": 0,
        "processing_complexity": "queued",
        "import_warning": None,
        "suggested_split": None,
        "parsing_warnings": [],
        "ocr_raw": None,
        "ocr_text": None,
        "llm_call_count": 0,
        "suggestion_count": 0,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "created_by": ObjectId(current_user["_id"]),
    }
    result = await db.bank_statement_imports.insert_one(doc)
    import_id = str(result.inserted_id)
    background_tasks.add_task(_run_import_job, import_id, company_id, str(file_path), str(current_user["_id"]))
    return {
        "id": import_id,
        "status": "pending",
        "message": "Import en cours de traitement",
    }


@router.get("/imports")
async def list_imports(
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user),
):
    """List bank statement imports."""
    await get_current_company(current_user, company_id)
    stale_threshold = datetime.now(timezone.utc) - timedelta(minutes=15)
    await db.bank_statement_imports.update_many(
        {
            "company_id": ObjectId(company_id),
            "status": "processing",
            "created_at": {"$lt": stale_threshold},
        },
        {"$set": {"status": "failed", "error_message": "Timeout ou serveur redémarré", "updated_at": datetime.now(timezone.utc)}}
    )
    docs = await db.bank_statement_imports.find(
        {"company_id": ObjectId(company_id)}
    ).sort("created_at", -1).to_list(50)
    return [
        {
            "id": str(d["_id"]),
            "file_name": d.get("file_name"),
            "original_file_name": d.get("original_file_name"),
            "mime_type": d.get("mime_type"),
            "status": d.get("status", "pending"),
            "transaction_count": d.get("transaction_count", 0),
            "estimated_transaction_count": d.get("estimated_transaction_count", 0),
            "processing_complexity": d.get("processing_complexity"),
            "import_warning": d.get("import_warning"),
            "suggested_split": d.get("suggested_split"),
            "ocr_provider": d.get("ocr_provider") or d.get("provider"),
            "parsing_warnings": d.get("parsing_warnings", []),
            "llm_call_count": d.get("llm_call_count", 0),
            "suggestion_count": d.get("suggestion_count", 0),
            "error_message": d.get("error_message"),
            "created_at": d["created_at"].isoformat() if d.get("created_at") else None,
            "processed_at": d["processed_at"].isoformat() if d.get("processed_at") else None,
        }
        for d in docs
    ]


@router.get("/transactions")
async def list_transactions(
    company_id: str = Query(...),
    import_id: Optional[str] = Query(None),
    reconciled: Optional[bool] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    """List bank transactions, optionally filtered by import or reconciliation status."""
    await get_current_company(current_user, company_id)
    query = {"company_id": ObjectId(company_id)}
    if import_id:
        query["import_id"] = ObjectId(import_id)
    if reconciled is not None:
        query["reconciled"] = reconciled
    docs = await db.bank_transactions.find(query).sort("txn_date", -1).to_list(500)
    return [
        {
            "id": str(d["_id"]),
            "import_id": str(d["import_id"]),
            "txn_date": d.get("txn_date"),
            "value_date": d.get("value_date"),
            "label_raw": d.get("label_raw"),
            "label_clean": d.get("label_clean"),
            "debit": d.get("debit", 0),
            "credit": d.get("credit", 0),
            "amount_signed": d.get("amount_signed", 0),
            "balance": d.get("balance"),
            "currency": d.get("currency", "TND"),
            "reference": d.get("reference"),
            "direction": d.get("direction"),
            "transaction_type": d.get("transaction_type"),
            "status": d.get("status"),
            "confidence": d.get("confidence"),
            "matched_entity_type": d.get("matched_entity_type"),
            "matched_entity_id": str(d.get("matched_entity_id")) if d.get("matched_entity_id") else None,
            "reasoning": d.get("reasoning"),
            "reconciliation_status": d.get("reconciliation_status", "pending"),
            "reconciled": d.get("reconciled", False),
            "created_at": d["created_at"].isoformat() if d.get("created_at") else None,
        }
        for d in docs
    ]


@router.get("/imports/{import_id}")
async def get_import_detail(
    import_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user),
):
    await get_current_company(current_user, company_id)
    doc = await db.bank_statement_imports.find_one(
        {"_id": ObjectId(import_id), "company_id": ObjectId(company_id)}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Import non trouvé")
    unresolved_count = await db.bank_transactions.count_documents(
        {
            "company_id": ObjectId(company_id),
            "import_id": ObjectId(import_id),
            "reconciliation_status": {"$nin": ["approved", "ignored"]},
        }
    )
    return {
        "id": str(doc["_id"]),
        "file_name": doc.get("file_name"),
        "status": doc.get("status"),
        "transaction_count": doc.get("transaction_count", 0),
        "estimated_transaction_count": doc.get("estimated_transaction_count", 0),
        "processing_complexity": doc.get("processing_complexity"),
        "import_warning": doc.get("import_warning"),
        "suggested_split": doc.get("suggested_split"),
        "ocr_provider": doc.get("ocr_provider") or doc.get("provider"),
        "parsing_warnings": doc.get("parsing_warnings", []),
        "ocr_text_preview": (doc.get("ocr_text") or "")[:4000],
        "unresolved_lines_count": unresolved_count,
        "created_at": doc.get("created_at").isoformat() if doc.get("created_at") else None,
        "processed_at": doc.get("processed_at").isoformat() if doc.get("processed_at") else None,
    }


@router.get("/reconciliation-suggestions")
async def list_reconciliation_suggestions(
    company_id: str = Query(...),
    transaction_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    """List reconciliation suggestions."""
    await get_current_company(current_user, company_id)
    query = {"company_id": ObjectId(company_id)}
    if transaction_id:
        query["transaction_id"] = ObjectId(transaction_id)
    if status:
        query["status"] = status
    docs = await db.reconciliation_suggestions.find(query).sort("score", -1).to_list(200)
    result = []
    for d in docs:
        cand = None
        if d.get("candidate_type") == "invoice" and d.get("candidate_id"):
            cand = await db.invoices.find_one({"_id": d["candidate_id"]})
        elif d.get("candidate_type") == "supplier_invoice" and d.get("candidate_id"):
            cand = await db.supplier_invoices.find_one({"_id": d["candidate_id"]})
        elif d.get("candidate_type") == "payment" and d.get("candidate_id"):
            cand = await db.payments.find_one({"_id": d["candidate_id"]})
        elif d.get("candidate_type") == "supplier_payment" and d.get("candidate_id"):
            cand = await db.supplier_payments.find_one({"_id": d["candidate_id"]})
        result.append({
            "id": str(d["_id"]),
            "transaction_id": str(d["transaction_id"]),
            "candidate_type": d.get("candidate_type"),
            "candidate_id": str(d["candidate_id"]) if d.get("candidate_id") else None,
            "candidate_summary": _candidate_summary(cand, d.get("candidate_type")),
            "score": d.get("score", 0),
            "confidence": d.get("confidence"),
            "match_pass": d.get("match_pass"),
            "reason": d.get("reason"),
            "status": d.get("status", "pending"),
            "should_letter": d.get("should_letter", False),
            "suggested_entry": d.get("suggested_entry"),
            "created_at": d["created_at"].isoformat() if d.get("created_at") else None,
        })
    return result


def _candidate_summary(cand: Optional[dict], ctype: str) -> str:
    if not cand:
        return ""
    if ctype == "invoice":
        return f"Facture {cand.get('number', '')} - {cand.get('total', 0)} TND"
    if ctype == "supplier_invoice":
        return f"Facture F {cand.get('number', cand.get('supplier_number', ''))} - {cand.get('total', 0)} TND"
    if ctype in ("payment", "supplier_payment"):
        return f"Paiement {cand.get('number', '')} - {cand.get('amount', 0)} TND"
    if ctype == "expense":
        return "Charge directe suggérée"
    return str(cand.get("number", cand.get("id", "")))


def _parse_txn_date(value):
    if isinstance(value, datetime):
        return value
    if not value:
        return datetime.now(timezone.utc)
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except Exception:
        try:
            return datetime.strptime(str(value), "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except Exception:
            return datetime.now(timezone.utc)


@router.post("/reconciliation/approve")
async def approve_reconciliation(
    data: ApproveReconciliationRequest,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user),
):
    """Approve a reconciliation suggestion and apply settlement logic."""
    await get_current_company(current_user, company_id)
    sugg = await db.reconciliation_suggestions.find_one({
        "_id": ObjectId(data.suggestion_id),
        "company_id": ObjectId(company_id),
        "status": "pending",
    })
    if not sugg:
        raise HTTPException(status_code=404, detail="Suggestion non trouvée")
    if str(sugg.get("transaction_id")) != data.transaction_id:
        raise HTTPException(status_code=400, detail="La suggestion ne correspond pas à la transaction")
    tx = await db.bank_transactions.find_one({
        "_id": ObjectId(data.transaction_id),
        "company_id": ObjectId(company_id),
    })
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction introuvable")
    now = datetime.now(timezone.utc)
    approval = await ReconciliationEngineService(db).approve_suggestion(sugg, tx, company_id, current_user)
    await db.reconciliation_suggestions.update_one(
        {"_id": ObjectId(data.suggestion_id)},
        {"$set": {"status": "approved", "approved_at": now, "approved_by": ObjectId(current_user["_id"])}},
    )
    await db.reconciliation_suggestions.update_many(
        {"transaction_id": sugg["transaction_id"], "_id": {"$ne": sugg["_id"]}},
        {"$set": {"status": "superseded", "updated_at": now}},
    )
    await db.bank_transactions.update_one(
        {"_id": ObjectId(data.transaction_id), "company_id": ObjectId(company_id)},
        {"$set": {"reconciled": True, "reconciliation_id": sugg["_id"]}},
    )
    return {"message": "Rapprochement approuvé", **approval}


@router.post("/reconciliation/reject")
async def reject_reconciliation(
    suggestion_id: str = Query(...),
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user),
):
    """Reject a reconciliation suggestion."""
    await get_current_company(current_user, company_id)
    sugg = await db.reconciliation_suggestions.find_one(
        {"_id": ObjectId(suggestion_id), "company_id": ObjectId(company_id)}
    )
    result = await db.reconciliation_suggestions.update_one(
        {"_id": ObjectId(suggestion_id), "company_id": ObjectId(company_id)},
        {"$set": {"status": "rejected", "updated_at": datetime.now(timezone.utc)}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Suggestion non trouvée")
    if sugg:
        tx = await db.bank_transactions.find_one({"_id": sugg["transaction_id"]})
        if tx:
            await ReconciliationEngineService(db).learning.record_rejection(
                company_id,
                "transaction_label",
                tx.get("label_raw") or "",
            )
    return {"message": "Suggestion rejetée"}


@router.post("/reconciliation/ignore")
async def ignore_transaction(
    transaction_id: str = Query(...),
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user),
):
    """Mark transaction as ignored (no reconciliation)."""
    await get_current_company(current_user, company_id)
    await db.bank_transactions.update_one(
        {"_id": ObjectId(transaction_id), "company_id": ObjectId(company_id)},
        {"$set": {"reconciled": False, "reconciliation_status": "ignored", "status": "ignored", "updated_at": datetime.now(timezone.utc)}},
    )
    await db.reconciliation_suggestions.update_many(
        {"transaction_id": ObjectId(transaction_id)},
        {"$set": {"status": "ignored", "updated_at": datetime.now(timezone.utc)}},
    )
    return {"message": "Transaction ignorée"}


@router.post("/retry/{import_id}")
async def retry_import(
    import_id: str,
    background_tasks: BackgroundTasks,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user),
):
    """Retry a failed or stuck import."""
    await get_current_company(current_user, company_id)
    doc = await db.bank_statement_imports.find_one({
        "_id": ObjectId(import_id),
        "company_id": ObjectId(company_id),
    })
    if not doc:
        raise HTTPException(status_code=404, detail="Import non trouvé")
    if doc.get("status") not in ("failed", "processing"):
        raise HTTPException(status_code=400, detail="Cet import ne peut pas être relancé")
    file_path = doc.get("file_path", "")
    if not file_path or not Path(file_path).exists():
        raise HTTPException(status_code=400, detail="Fichier source introuvable")
    await db.bank_statement_imports.update_one(
        {"_id": ObjectId(import_id)},
        {"$set": {"status": "pending", "error_message": None, "updated_at": datetime.now(timezone.utc)}},
    )
    background_tasks.add_task(_run_import_job, import_id, company_id, file_path, str(current_user["_id"]))
    return {"message": "Import relancé", "status": "pending"}


@router.post("/reconciliation/manual-entry")
async def create_manual_entry_from_transaction(
    data: ManualEntryRequest,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user),
):
    await get_current_company(current_user, company_id)
    tx = await db.bank_transactions.find_one(
        {"_id": ObjectId(data.transaction_id), "company_id": ObjectId(company_id)}
    )
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction introuvable")
    amount = abs(float(tx.get("amount_signed") or 0))
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Montant invalide")
    bank_code = "521"
    bank_name = "Banques"
    if float(tx.get("amount_signed") or 0) > 0:
        lines = [
            {"account_code": bank_code, "account_name": bank_name, "debit": amount, "credit": 0, "description": tx.get("label_raw")},
            {"account_code": data.account_code, "account_name": data.account_name, "debit": 0, "credit": amount, "description": tx.get("label_raw")},
        ]
    else:
        lines = [
            {"account_code": data.account_code, "account_name": data.account_name, "debit": amount, "credit": 0, "description": tx.get("label_raw")},
            {"account_code": bank_code, "account_name": bank_name, "debit": 0, "credit": amount, "description": tx.get("label_raw")},
        ]
    entry_id, entry_number = await JournalPostingService(db).create_posted_entry(
        company_id=company_id,
        date=_parse_txn_date(tx.get("txn_date")),
        reference=None,
        description=f"Saisie manuelle banque - {tx.get('label_raw')}",
        journal_type="bank",
        lines=lines,
        document_type="bank_transaction_manual",
        document_id=tx["_id"],
        created_by=current_user["_id"],
        extra_fields={"bank_transaction_id": tx["_id"]},
    )
    await db.bank_transactions.update_one(
        {"_id": tx["_id"]},
        {
            "$set": {
                "reconciled": True,
                "reconciliation_status": "manual_entry",
                "status": "manual_entry",
                "suggested_entry_id": ObjectId(entry_id),
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )
    return {"message": "Écriture manuelle créée", "entry_id": entry_id, "entry_number": entry_number}
