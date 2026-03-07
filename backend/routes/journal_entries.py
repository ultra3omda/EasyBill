from fastapi import APIRouter, HTTPException, status, Depends, Query
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime, timezone
import os
from typing import Optional, List
from models.journal_entry import JournalEntryCreate, JournalEntryUpdate
from utils.dependencies import get_current_user, get_current_company

router = APIRouter(prefix="/api/journal-entries", tags=["Journal Entries"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]


def serialize_entry(e: dict) -> dict:
    # Serialize lines array to convert all ObjectIds
    serialized_lines = []
    for line in e.get("lines", []):
        serialized_line = {
            "account_id": str(line["account_id"]) if isinstance(line.get("account_id"), ObjectId) else line.get("account_id"),
            "account_code": line.get("account_code"),
            "account_name": line.get("account_name"),
            "debit": line.get("debit", 0),
            "credit": line.get("credit", 0),
            "description": line.get("description", "")
        }
        serialized_lines.append(serialized_line)
    
    # Calculer les totaux depuis les lignes si non stockés (compatibilité écritures auto-générées)
    computed_debit = round(sum(l.get("debit", 0) for l in e.get("lines", [])), 3)
    computed_credit = round(sum(l.get("credit", 0) for l in e.get("lines", [])), 3)
    total_debit = e.get("total_debit") or computed_debit
    total_credit = e.get("total_credit") or computed_credit

    # entry_number : utiliser reference si entry_number absent
    entry_number = e.get("entry_number") or e.get("reference")

    return {
        "id": str(e["_id"]),
        "company_id": str(e.get("company_id")) if e.get("company_id") else None,
        "entry_number": entry_number,
        "date": e.get("date").isoformat() if e.get("date") else None,
        "reference": e.get("reference"),
        "description": e.get("description"),
        "journal_type": e.get("journal_type", "general"),
        "lines": serialized_lines,
        "total_debit": total_debit,
        "total_credit": total_credit,
        "status": e.get("status", "draft"),
        "document_type": e.get("document_type"),
        "document_id": str(e.get("document_id")) if isinstance(e.get("document_id"), ObjectId) else e.get("document_id"),
        "created_by": str(e.get("created_by")) if isinstance(e.get("created_by"), ObjectId) else e.get("created_by"),
        "created_at": e.get("created_at").isoformat() if e.get("created_at") else None,
        "posted_at": e.get("posted_at").isoformat() if e.get("posted_at") else None
    }


async def get_next_entry_number(company_id: ObjectId) -> str:
    """Generate next entry number for company"""
    last_entry = await db.journal_entries.find_one(
        {"company_id": company_id},
        sort=[("entry_number", -1)]
    )
    if last_entry and last_entry.get("entry_number"):
        try:
            num = int(last_entry["entry_number"].split("-")[-1])
            return f"EC-{num + 1:05d}"
        except:
            pass
    return "EC-00001"


@router.get("/")
async def list_entries(
    company_id: str = Query(...),
    journal_type: Optional[str] = None,
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    account_code: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """List journal entries with optional filters"""
    company = await get_current_company(current_user, company_id)
    
    query = {"company_id": ObjectId(company_id)}
    
    if journal_type:
        query["journal_type"] = journal_type
    if status:
        query["status"] = status
    if date_from:
        query["date"] = {"$gte": datetime.fromisoformat(date_from)}
    if date_to:
        if "date" in query:
            query["date"]["$lte"] = datetime.fromisoformat(date_to)
        else:
            query["date"] = {"$lte": datetime.fromisoformat(date_to)}
    if account_code:
        query["lines.account_code"] = account_code
    
    entries = await db.journal_entries.find(query).sort("date", -1).to_list(1000)
    return [serialize_entry(e) for e in entries]


@router.get("/stats")
async def get_entry_stats(
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Get journal entry statistics"""
    company = await get_current_company(current_user, company_id)
    
    pipeline = [
        {"$match": {"company_id": ObjectId(company_id)}},
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1},
            "total_debit": {"$sum": "$total_debit"},
            "total_credit": {"$sum": "$total_credit"}
        }}
    ]
    
    results = await db.journal_entries.aggregate(pipeline).to_list(10)
    
    stats = {
        "total_entries": 0,
        "draft": 0,
        "posted": 0,
        "cancelled": 0,
        "total_debit": 0,
        "total_credit": 0
    }
    
    for r in results:
        stats["total_entries"] += r["count"]
        if r["_id"] == "draft":
            stats["draft"] = r["count"]
        elif r["_id"] == "posted":
            stats["posted"] = r["count"]
            stats["total_debit"] += r["total_debit"]
            stats["total_credit"] += r["total_credit"]
        elif r["_id"] == "cancelled":
            stats["cancelled"] = r["count"]
    
    return stats


@router.get("/{entry_id}")
async def get_entry(
    entry_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Get a single journal entry"""
    company = await get_current_company(current_user, company_id)
    
    entry = await db.journal_entries.find_one({
        "_id": ObjectId(entry_id),
        "company_id": ObjectId(company_id)
    })
    
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found")
    
    return serialize_entry(entry)


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_entry(
    data: JournalEntryCreate,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Create a new journal entry"""
    company = await get_current_company(current_user, company_id)
    
    # Validate that debits equal credits
    total_debit = sum(line.debit for line in data.lines)
    total_credit = sum(line.credit for line in data.lines)
    
    if abs(total_debit - total_credit) > 0.01:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Entry is not balanced. Debit: {total_debit}, Credit: {total_credit}"
        )
    
    # Validate account codes exist
    account_codes = [line.account_code for line in data.lines]
    existing_accounts = await db.chart_of_accounts.find({
        "company_id": ObjectId(company_id),
        "code": {"$in": account_codes}
    }).to_list(100)
    
    existing_codes = {a["code"]: a["name"] for a in existing_accounts}
    for code in account_codes:
        if code not in existing_codes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Account code {code} does not exist"
            )
    
    # Prepare lines with account names
    lines = []
    for line in data.lines:
        lines.append({
            "account_code": line.account_code,
            "account_name": existing_codes.get(line.account_code, line.account_name),
            "debit": line.debit,
            "credit": line.credit,
            "description": line.description
        })
    
    now = datetime.now(timezone.utc)
    entry_number = await get_next_entry_number(ObjectId(company_id))
    
    entry_dict = {
        "company_id": ObjectId(company_id),
        "entry_number": entry_number,
        "date": data.date,
        "reference": data.reference,
        "description": data.description,
        "journal_type": data.journal_type,
        "lines": lines,
        "total_debit": total_debit,
        "total_credit": total_credit,
        "status": "draft",
        "document_type": data.document_type,
        "document_id": data.document_id,
        "created_by": str(current_user["_id"]),
        "created_at": now
    }
    
    result = await db.journal_entries.insert_one(entry_dict)
    
    return {
        "id": str(result.inserted_id),
        "entry_number": entry_number,
        "message": "Journal entry created"
    }


@router.put("/{entry_id}")
async def update_entry(
    entry_id: str,
    data: JournalEntryUpdate,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Update a journal entry (only drafts can be updated)"""
    company = await get_current_company(current_user, company_id)
    
    entry = await db.journal_entries.find_one({
        "_id": ObjectId(entry_id),
        "company_id": ObjectId(company_id)
    })
    
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found")
    
    if entry.get("status") == "posted":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot update a posted entry"
        )
    
    update_data = {}
    
    if data.date is not None:
        update_data["date"] = data.date
    if data.reference is not None:
        update_data["reference"] = data.reference
    if data.description is not None:
        update_data["description"] = data.description
    if data.status is not None:
        update_data["status"] = data.status
        if data.status == "posted":
            update_data["posted_at"] = datetime.now(timezone.utc)
    
    if data.lines is not None:
        # Validate balance
        total_debit = sum(line.debit for line in data.lines)
        total_credit = sum(line.credit for line in data.lines)
        
        if abs(total_debit - total_credit) > 0.01:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Entry is not balanced. Debit: {total_debit}, Credit: {total_credit}"
            )
        
        update_data["lines"] = [line.dict() for line in data.lines]
        update_data["total_debit"] = total_debit
        update_data["total_credit"] = total_credit
    
    if update_data:
        await db.journal_entries.update_one(
            {"_id": ObjectId(entry_id)},
            {"$set": update_data}
        )
    
    return {"message": "Entry updated"}


@router.post("/{entry_id}/post")
async def post_entry(
    entry_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Post a journal entry (make it permanent)"""
    company = await get_current_company(current_user, company_id)
    
    entry = await db.journal_entries.find_one({
        "_id": ObjectId(entry_id),
        "company_id": ObjectId(company_id)
    })
    
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found")
    
    if entry.get("status") == "posted":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Entry already posted")
    
    if entry.get("status") == "cancelled":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot post a cancelled entry")
    
    now = datetime.now(timezone.utc)
    
    await db.journal_entries.update_one(
        {"_id": ObjectId(entry_id)},
        {"$set": {"status": "posted", "posted_at": now}}
    )
    
    # Update account balances
    for line in entry.get("lines", []):
        account_code = line.get("account_code")
        debit = line.get("debit", 0)
        credit = line.get("credit", 0)
        
        # Get account type to determine how to update balance
        account = await db.chart_of_accounts.find_one({
            "company_id": ObjectId(company_id),
            "code": account_code
        })
        
        if account:
            account_type = account.get("type")
            # For asset/expense accounts: debit increases, credit decreases
            # For liability/equity/income accounts: credit increases, debit decreases
            if account_type in ["asset", "expense"]:
                balance_change = debit - credit
            else:
                balance_change = credit - debit
            
            await db.chart_of_accounts.update_one(
                {"_id": account["_id"]},
                {"$inc": {"balance": balance_change}}
            )
    
    return {"message": "Entry posted successfully"}


@router.post("/{entry_id}/cancel")
async def cancel_entry(
    entry_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Cancel a journal entry"""
    company = await get_current_company(current_user, company_id)
    
    entry = await db.journal_entries.find_one({
        "_id": ObjectId(entry_id),
        "company_id": ObjectId(company_id)
    })
    
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found")
    
    if entry.get("status") == "cancelled":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Entry already cancelled")
    
    # If posted, reverse the account balances
    if entry.get("status") == "posted":
        for line in entry.get("lines", []):
            account_code = line.get("account_code")
            debit = line.get("debit", 0)
            credit = line.get("credit", 0)
            
            account = await db.chart_of_accounts.find_one({
                "company_id": ObjectId(company_id),
                "code": account_code
            })
            
            if account:
                account_type = account.get("type")
                # Reverse the balance change
                if account_type in ["asset", "expense"]:
                    balance_change = -(debit - credit)
                else:
                    balance_change = -(credit - debit)
                
                await db.chart_of_accounts.update_one(
                    {"_id": account["_id"]},
                    {"$inc": {"balance": balance_change}}
                )
    
    await db.journal_entries.update_one(
        {"_id": ObjectId(entry_id)},
        {"$set": {"status": "cancelled", "cancelled_at": datetime.now(timezone.utc)}}
    )
    
    return {"message": "Entry cancelled"}


@router.delete("/{entry_id}")
async def delete_entry(
    entry_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Delete a journal entry (only drafts can be deleted)"""
    company = await get_current_company(current_user, company_id)
    
    entry = await db.journal_entries.find_one({
        "_id": ObjectId(entry_id),
        "company_id": ObjectId(company_id)
    })
    
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found")
    
    if entry.get("status") != "draft":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only draft entries can be deleted"
        )
    
    await db.journal_entries.delete_one({"_id": ObjectId(entry_id)})
    
    return {"message": "Entry deleted"}



@router.post("/fix-totals")
async def fix_entry_totals(
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Recalcule total_debit, total_credit et entry_number pour les écritures auto-générées"""
    company = await get_current_company(current_user, company_id)

    entries = await db.journal_entries.find({"company_id": ObjectId(company_id)}).to_list(None)
    fixed = 0

    for e in entries:
        updates = {}

        # Recalcul des totaux depuis les lignes
        lines = e.get("lines", [])
        computed_debit = round(sum(l.get("debit", 0) for l in lines), 3)
        computed_credit = round(sum(l.get("credit", 0) for l in lines), 3)

        if e.get("total_debit", 0) != computed_debit or e.get("total_credit", 0) != computed_credit:
            updates["total_debit"] = computed_debit
            updates["total_credit"] = computed_credit

        # Corriger entry_number manquant
        if not e.get("entry_number") and e.get("reference"):
            updates["entry_number"] = e["reference"]

        if updates:
            await db.journal_entries.update_one({"_id": e["_id"]}, {"$set": updates})
            fixed += 1

    return {"fixed": fixed, "total": len(entries)}


@router.post("/fix-paid-invoices")
async def fix_paid_invoices_missing_settlement(
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Analyse les factures payées (status=paid/partial) et génère les écritures de règlement
    manquantes (521/531 → 411) pour celles qui n'ont qu'une écriture de vente.
    """
    from services.accounting_sync_service import accounting_sync_service
    from datetime import timezone

    company = await get_current_company(current_user, company_id)

    # Mapping modes de règlement → comptes
    PAYMENT_METHOD_MAP = {
        "cash":     ("531", "Caisse en monnaie nationale", "cash"),
        "check":    ("521", "Banques - Chèques encaissés", "bank"),
        "transfer": ("521", "Banques - Virements reçus", "bank"),
        "card":     ("521", "Banques - TPE", "bank"),
        "e_dinar":  ("531", "Caisse électronique (e-Dinar)", "cash"),
    }

    # Récupérer toutes les factures payées ou partiellement payées
    invoices = await db.invoices.find({
        "company_id": ObjectId(company_id),
        "status": {"$in": ["paid", "partial"]}
    }).to_list(None)

    results = []

    for invoice in invoices:
        invoice_id = str(invoice["_id"])
        inv_number = invoice.get("number", "")
        amount_paid = invoice.get("amount_paid", 0)

        # ── 1. Vérifier si l'écriture de vente existe ──────────────────────
        sale_entry = await db.journal_entries.find_one({
            "company_id": ObjectId(company_id),
            "document_id": invoice["_id"],
            "document_type": "invoice",
            "lines": {"$elemMatch": {"account_code": "411", "debit": {"$gt": 0}}}
        })

        # Créer l'écriture de vente si manquante
        if not sale_entry and not invoice.get("accounting_entry_id"):
            # Forcer le statut "sent" momentanément pour que sync_invoice accepte
            await db.invoices.update_one(
                {"_id": invoice["_id"]},
                {"$set": {"status": "sent"}}
            )
            await accounting_sync_service.sync_invoice(invoice_id)
            await db.invoices.update_one(
                {"_id": invoice["_id"]},
                {"$set": {"status": invoice.get("status", "paid")}}
            )
            results.append({
                "invoice": inv_number,
                "action": "écriture_vente_créée"
            })

        # ── 2. Vérifier si l'écriture de règlement existe ──────────────────
        # L'écriture de règlement crédite le compte 411 et débite 521/531
        settlement_entry = await db.journal_entries.find_one({
            "company_id": ObjectId(company_id),
            "document_id": invoice["_id"],
            "document_type": {"$in": ["payment", "invoice"]},
            "lines": {"$elemMatch": {"account_code": "411", "credit": {"$gt": 0}}}
        })

        if settlement_entry:
            results.append({
                "invoice": inv_number,
                "action": "règlement_déjà_présent",
                "entry_ref": settlement_entry.get("reference") or settlement_entry.get("entry_number")
            })
            continue

        # ── 3. Déterminer le mode de règlement ─────────────────────────────
        # Chercher dans les paiements liés à cette facture
        payment = await db.payments.find_one({
            "company_id": ObjectId(company_id),
            "allocations.invoice_id": invoice["_id"]
        })

        if payment:
            payment_method = payment.get("payment_method", "cash")
            payment_ref = payment.get("reference") or payment.get("number", "")
            paid_date = payment.get("date", datetime.now(timezone.utc))
        else:
            # Pas de paiement lié → utiliser espèces par défaut (cas mark-paid sans méthode)
            payment_method = "cash"
            payment_ref = inv_number
            paid_date = invoice.get("paid_at") or invoice.get("updated_at") or datetime.now(timezone.utc)

        treasury_account, treasury_name, journal_type = PAYMENT_METHOD_MAP.get(
            payment_method, ("531", "Caisse en monnaie nationale", "cash")
        )

        # Récupérer le nom du client
        customer = await db.customers.find_one({"_id": invoice.get("customer_id")})
        customer_name = customer.get("display_name", "") if customer else ""

        # ── 4. Créer l'écriture de règlement manquante ─────────────────────
        lines = [
            {
                "account_code": treasury_account,
                "account_name": treasury_name,
                "debit": round(amount_paid, 3),
                "credit": 0,
                "description": f"Encaissement facture {inv_number}"
            },
            {
                "account_code": "411",
                "account_name": "Clients",
                "debit": 0,
                "credit": round(amount_paid, 3),
                "description": f"Règlement client facture {inv_number}"
            }
        ]

        entry_id = await accounting_sync_service._create_journal_entry(
            company_id=company_id,
            date=paid_date,
            journal_type=journal_type,
            description=f"Règlement facture {inv_number} - {customer_name} ({payment_method})",
            lines=lines,
            document_type="payment",
            document_id=invoice_id,
            reference=None
        )

        results.append({
            "invoice": inv_number,
            "action": "règlement_créé",
            "payment_method": payment_method,
            "account": treasury_account,
            "amount": amount_paid,
            "entry_id": entry_id
        })

    return {
        "analyzed": len(invoices),
        "details": results
    }


@router.get("/export/excel")
async def export_journal_entries_excel(
    company_id: str = Query(...),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    journal_type: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Exporte les écritures comptables en Excel"""
    from fastapi.responses import StreamingResponse
    import pandas as pd
    from io import BytesIO
    
    company = await get_current_company(current_user, company_id)
    
    # Build query
    query = {"company_id": ObjectId(company_id)}
    
    if date_from:
        query["date"] = {"$gte": datetime.fromisoformat(date_from)}
    if date_to:
        if "date" in query:
            query["date"]["$lte"] = datetime.fromisoformat(date_to)
        else:
            query["date"] = {"$lte": datetime.fromisoformat(date_to)}
    
    if journal_type:
        query["journal_type"] = journal_type
    
    entries = await db.journal_entries.find(query).sort("date", 1).to_list(5000)
    
    # Prepare data - one row per line
    data = []
    for entry in entries:
        for line in entry.get("lines", []):
            data.append({
                "Date": entry["date"].strftime("%d/%m/%Y") if entry.get("date") else "",
                "Référence": entry.get("reference"),
                "Description": entry.get("description"),
                "Compte": line.get("account_code"),
                "Libellé Compte": line.get("account_name"),
                "Débit": round(line.get("debit", 0), 3),
                "Crédit": round(line.get("credit", 0), 3),
                "Type Journal": entry.get("journal_type"),
                "Document": entry.get("document_type")
            })
    
    # Create Excel
    df = pd.DataFrame(data)
    
    # Add totals
    if not df.empty:
        totals = {
            "Date": "",
            "Référence": "",
            "Description": "TOTAL",
            "Compte": "",
            "Libellé Compte": "",
            "Débit": df["Débit"].sum(),
            "Crédit": df["Crédit"].sum(),
            "Type Journal": "",
            "Document": ""
        }
        df = pd.concat([df, pd.DataFrame([totals])], ignore_index=True)
    
    output = BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, sheet_name='Écritures Comptables', index=False)
        
        # Format columns
        worksheet = writer.sheets['Écritures Comptables']
        for column in worksheet.columns:
            max_length = 0
            column = [cell for cell in column]
            for cell in column:
                try:
                    if len(str(cell.value)) > max_length:
                        max_length = len(str(cell.value))
                except:
                    pass
            adjusted_width = min(max_length + 2, 50)
            worksheet.column_dimensions[column[0].column_letter].width = adjusted_width
    
    filename = f"Ecritures_Comptables_{company.get('name', 'EasyBill')}_{datetime.now().strftime('%Y%m%d')}.xlsx"
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

