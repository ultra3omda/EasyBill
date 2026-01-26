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
    
    return {
        "id": str(e["_id"]),
        "company_id": str(e.get("company_id")) if e.get("company_id") else None,
        "entry_number": e.get("entry_number"),
        "date": e.get("date").isoformat() if e.get("date") else None,
        "reference": e.get("reference"),
        "description": e.get("description"),
        "journal_type": e.get("journal_type", "general"),
        "lines": serialized_lines,
        "total_debit": e.get("total_debit", 0),
        "total_credit": e.get("total_credit", 0),
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
