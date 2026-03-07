from fastapi import APIRouter, HTTPException, status, Depends, Query
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime, timezone, date
from typing import Optional
from pydantic import BaseModel
import os
from utils.dependencies import get_current_user, get_current_company

router = APIRouter(prefix="/api/fiscal-years", tags=["Fiscal Years"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]


class FiscalYearCreate(BaseModel):
    name: str                   # ex: "Exercice 2025"
    start_date: str             # ISO date "2025-01-01"
    end_date: str               # ISO date "2025-12-31"
    notes: Optional[str] = None


class FiscalYearUpdate(BaseModel):
    name: Optional[str] = None
    notes: Optional[str] = None


def serialize_fy(fy: dict) -> dict:
    return {
        "id": str(fy["_id"]),
        "company_id": str(fy.get("company_id")) if fy.get("company_id") else None,
        "name": fy.get("name"),
        "start_date": fy.get("start_date").date().isoformat() if fy.get("start_date") else None,
        "end_date": fy.get("end_date").date().isoformat() if fy.get("end_date") else None,
        "status": fy.get("status", "open"),        # open | closed | locked
        "is_current": fy.get("is_current", False),
        "notes": fy.get("notes"),
        "closed_at": fy.get("closed_at").isoformat() if fy.get("closed_at") else None,
        "closed_by": fy.get("closed_by"),
        "created_at": fy.get("created_at").isoformat() if fy.get("created_at") else None,
        # Statistics (populated separately)
        "entry_count": fy.get("entry_count", 0),
        "total_debit": fy.get("total_debit", 0),
        "total_credit": fy.get("total_credit", 0),
    }


async def _compute_fy_stats(company_id: str, start_date: datetime, end_date: datetime) -> dict:
    """Compute journal entry stats for a fiscal year period."""
    pipeline = [
        {"$match": {
            "company_id": ObjectId(company_id),
            "status": "posted",
            "date": {"$gte": start_date, "$lte": end_date}
        }},
        {"$group": {
            "_id": None,
            "count": {"$sum": 1},
            "total_debit": {"$sum": "$total_debit"},
            "total_credit": {"$sum": "$total_credit"}
        }}
    ]
    agg = await db.journal_entries.aggregate(pipeline).to_list(1)
    if agg:
        return {
            "entry_count": agg[0]["count"],
            "total_debit": round(agg[0].get("total_debit", 0) or 0, 3),
            "total_credit": round(agg[0].get("total_credit", 0) or 0, 3),
        }
    return {"entry_count": 0, "total_debit": 0, "total_credit": 0}


@router.get("/")
async def list_fiscal_years(
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)
    fys = await db.fiscal_years.find({"company_id": ObjectId(company_id)}).sort("start_date", -1).to_list(50)

    result = []
    for fy in fys:
        s = serialize_fy(fy)
        if fy.get("start_date") and fy.get("end_date"):
            stats = await _compute_fy_stats(company_id, fy["start_date"], fy["end_date"])
            s.update(stats)
        result.append(s)
    return result


@router.get("/current")
async def get_current_fiscal_year(
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)
    fy = await db.fiscal_years.find_one(
        {"company_id": ObjectId(company_id), "is_current": True}
    )
    if not fy:
        # Try to find the most recent open one
        fy = await db.fiscal_years.find_one(
            {"company_id": ObjectId(company_id), "status": "open"},
            sort=[("start_date", -1)]
        )
    if not fy:
        return None
    return serialize_fy(fy)


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_fiscal_year(
    data: FiscalYearCreate,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)

    start_dt = datetime.fromisoformat(data.start_date).replace(tzinfo=timezone.utc)
    end_dt = datetime.fromisoformat(data.end_date).replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)

    if start_dt >= end_dt:
        raise HTTPException(status_code=400, detail="La date de début doit être antérieure à la date de fin")

    # Check for overlapping fiscal years
    overlap = await db.fiscal_years.find_one({
        "company_id": ObjectId(company_id),
        "$or": [
            {"start_date": {"$lte": end_dt}, "end_date": {"$gte": start_dt}}
        ]
    })
    if overlap:
        raise HTTPException(status_code=400, detail="Cet exercice chevauche un exercice existant")

    # Count existing FYs to determine if this is the first
    existing_count = await db.fiscal_years.count_documents({"company_id": ObjectId(company_id)})
    is_current = existing_count == 0

    now = datetime.now(timezone.utc)
    doc = {
        "company_id": ObjectId(company_id),
        "name": data.name,
        "start_date": start_dt,
        "end_date": end_dt,
        "status": "open",
        "is_current": is_current,
        "notes": data.notes,
        "created_at": now,
        "created_by": str(current_user["_id"])
    }

    result = await db.fiscal_years.insert_one(doc)
    return {"id": str(result.inserted_id), "message": "Exercice comptable créé"}


@router.put("/{fy_id}")
async def update_fiscal_year(
    fy_id: str,
    data: FiscalYearUpdate,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)

    fy = await db.fiscal_years.find_one({"_id": ObjectId(fy_id), "company_id": ObjectId(company_id)})
    if not fy:
        raise HTTPException(status_code=404, detail="Exercice non trouvé")
    if fy.get("status") == "locked":
        raise HTTPException(status_code=400, detail="Cet exercice est verrouillé et ne peut pas être modifié")

    update = {k: v for k, v in data.dict(exclude_unset=True).items() if v is not None}
    if update:
        await db.fiscal_years.update_one({"_id": ObjectId(fy_id)}, {"$set": update})
    return {"message": "Exercice mis à jour"}


@router.post("/{fy_id}/set-current")
async def set_current_fiscal_year(
    fy_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Mark a fiscal year as the current active one."""
    await get_current_company(current_user, company_id)

    fy = await db.fiscal_years.find_one({"_id": ObjectId(fy_id), "company_id": ObjectId(company_id)})
    if not fy:
        raise HTTPException(status_code=404, detail="Exercice non trouvé")
    if fy.get("status") == "closed":
        raise HTTPException(status_code=400, detail="Impossible de définir un exercice clôturé comme courant")

    # Unset all current flags
    await db.fiscal_years.update_many(
        {"company_id": ObjectId(company_id)},
        {"$set": {"is_current": False}}
    )
    # Set this one
    await db.fiscal_years.update_one(
        {"_id": ObjectId(fy_id)},
        {"$set": {"is_current": True}}
    )
    return {"message": "Exercice courant défini"}


@router.post("/{fy_id}/close")
async def close_fiscal_year(
    fy_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Close a fiscal year. Creates closing entries if needed."""
    await get_current_company(current_user, company_id)

    fy = await db.fiscal_years.find_one({"_id": ObjectId(fy_id), "company_id": ObjectId(company_id)})
    if not fy:
        raise HTTPException(status_code=404, detail="Exercice non trouvé")
    if fy.get("status") in ["closed", "locked"]:
        raise HTTPException(status_code=400, detail="Cet exercice est déjà clôturé")

    # Check for unposted entries in the period
    unposted_count = await db.journal_entries.count_documents({
        "company_id": ObjectId(company_id),
        "status": "draft",
        "date": {"$gte": fy["start_date"], "$lte": fy["end_date"]}
    })

    now = datetime.now(timezone.utc)
    user_name = current_user.get("full_name") or current_user.get("email", "")

    await db.fiscal_years.update_one(
        {"_id": ObjectId(fy_id)},
        {"$set": {
            "status": "closed",
            "is_current": False,
            "closed_at": now,
            "closed_by": user_name,
            "unposted_entries_at_close": unposted_count
        }}
    )

    # If this was current, try to find the next open fiscal year
    if fy.get("is_current"):
        next_fy = await db.fiscal_years.find_one(
            {"company_id": ObjectId(company_id), "status": "open"},
            sort=[("start_date", -1)]
        )
        if next_fy:
            await db.fiscal_years.update_one(
                {"_id": next_fy["_id"]},
                {"$set": {"is_current": True}}
            )

    return {
        "message": "Exercice clôturé avec succès",
        "warnings": f"{unposted_count} écriture(s) non validée(s) au moment de la clôture" if unposted_count else None
    }


@router.post("/{fy_id}/reopen")
async def reopen_fiscal_year(
    fy_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Reopen a closed fiscal year (requires special permission in real scenario)."""
    await get_current_company(current_user, company_id)

    fy = await db.fiscal_years.find_one({"_id": ObjectId(fy_id), "company_id": ObjectId(company_id)})
    if not fy:
        raise HTTPException(status_code=404, detail="Exercice non trouvé")
    if fy.get("status") == "locked":
        raise HTTPException(status_code=400, detail="Cet exercice est verrouillé")
    if fy.get("status") == "open":
        raise HTTPException(status_code=400, detail="Cet exercice est déjà ouvert")

    await db.fiscal_years.update_one(
        {"_id": ObjectId(fy_id)},
        {"$set": {"status": "open", "closed_at": None, "closed_by": None}}
    )
    return {"message": "Exercice réouvert"}


@router.delete("/{fy_id}")
async def delete_fiscal_year(
    fy_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)

    fy = await db.fiscal_years.find_one({"_id": ObjectId(fy_id), "company_id": ObjectId(company_id)})
    if not fy:
        raise HTTPException(status_code=404, detail="Exercice non trouvé")
    if fy.get("status") in ["closed", "locked"]:
        raise HTTPException(status_code=400, detail="Impossible de supprimer un exercice clôturé")

    await db.fiscal_years.delete_one({"_id": ObjectId(fy_id)})
    return {"message": "Exercice supprimé"}


@router.get("/{fy_id}/stats")
async def get_fiscal_year_stats(
    fy_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Get detailed stats for a fiscal year (by journal type)."""
    await get_current_company(current_user, company_id)

    fy = await db.fiscal_years.find_one({"_id": ObjectId(fy_id), "company_id": ObjectId(company_id)})
    if not fy:
        raise HTTPException(status_code=404, detail="Exercice non trouvé")

    start = fy["start_date"]
    end = fy["end_date"]

    # Stats by journal type
    pipeline = [
        {"$match": {
            "company_id": ObjectId(company_id),
            "date": {"$gte": start, "$lte": end}
        }},
        {"$group": {
            "_id": "$journal_type",
            "count": {"$sum": 1},
            "total_debit": {"$sum": "$total_debit"},
            "total_credit": {"$sum": "$total_credit"}
        }},
        {"$sort": {"_id": 1}}
    ]
    by_journal = await db.journal_entries.aggregate(pipeline).to_list(20)

    # Stats by status
    status_pipeline = [
        {"$match": {"company_id": ObjectId(company_id), "date": {"$gte": start, "$lte": end}}},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    by_status = await db.journal_entries.aggregate(status_pipeline).to_list(10)

    return {
        "fiscal_year": serialize_fy(fy),
        "by_journal_type": [
            {
                "journal_type": row["_id"] or "general",
                "count": row["count"],
                "total_debit": round(row.get("total_debit", 0) or 0, 3),
                "total_credit": round(row.get("total_credit", 0) or 0, 3),
            }
            for row in by_journal
        ],
        "by_status": {row["_id"]: row["count"] for row in by_status},
    }
