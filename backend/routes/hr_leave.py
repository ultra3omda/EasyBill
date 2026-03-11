from fastapi import APIRouter, HTTPException, status, Query, Depends
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime, timezone, timedelta
import os
import logging
from typing import Optional
from pydantic import BaseModel
from utils.dependencies import get_current_user, get_current_company
from data.tunisian_hr_config import LEAVE_TYPES

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/hr/leaves", tags=["HR Leave"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]


class LeaveCreate(BaseModel):
    employee_id: str
    leave_type: str
    start_date: str
    end_date: str
    reason: Optional[str] = None


class LeaveUpdate(BaseModel):
    leave_type: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    reason: Optional[str] = None


class LeaveReject(BaseModel):
    reason: str


def count_business_days(start_date_str: str, end_date_str: str) -> int:
    """Count business days between two dates (excluding weekends)."""
    start = datetime.strptime(start_date_str, "%Y-%m-%d")
    end = datetime.strptime(end_date_str, "%Y-%m-%d")
    if end < start:
        return 0
    days = 0
    current = start
    while current <= end:
        if current.weekday() < 5:  # Monday to Friday
            days += 1
        current += timedelta(days=1)
    return days


def serialize_leave(l: dict) -> dict:
    return {
        "id": str(l["_id"]),
        "company_id": str(l.get("company_id", "")),
        "employee_id": str(l.get("employee_id", "")),
        "employee_name": l.get("employee_name", ""),
        "leave_type": l.get("leave_type"),
        "start_date": l.get("start_date"),
        "end_date": l.get("end_date"),
        "business_days": l.get("business_days", 0),
        "reason": l.get("reason"),
        "status": l.get("status", "pending"),
        "rejection_reason": l.get("rejection_reason"),
        "approved_by": str(l.get("approved_by")) if l.get("approved_by") else None,
        "created_at": l["created_at"].isoformat() if isinstance(l.get("created_at"), datetime) else l.get("created_at"),
        "updated_at": l["updated_at"].isoformat() if isinstance(l.get("updated_at"), datetime) else l.get("updated_at"),
    }


@router.get("/")
async def list_leaves(
    company_id: str = Query(...),
    status_filter: Optional[str] = Query(None, alias="status"),
    employee_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)

    query = {"company_id": ObjectId(company_id)}
    if status_filter:
        query["status"] = status_filter
    if employee_id:
        query["employee_id"] = ObjectId(employee_id)

    leaves = await db.hr_leaves.find(query).sort("created_at", -1).to_list(1000)
    return [serialize_leave(l) for l in leaves]


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_leave(
    leave_data: LeaveCreate,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)

    # Verify employee exists
    employee = await db.hr_employees.find_one({
        "_id": ObjectId(leave_data.employee_id),
        "company_id": ObjectId(company_id)
    })
    if not employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    business_days = count_business_days(leave_data.start_date, leave_data.end_date)
    if business_days <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End date must be after start date"
        )

    now = datetime.now(timezone.utc)
    leave_dict = leave_data.dict()
    leave_dict.update({
        "company_id": ObjectId(company_id),
        "employee_id": ObjectId(leave_data.employee_id),
        "employee_name": f"{employee.get('first_name', '')} {employee.get('last_name', '')}",
        "business_days": business_days,
        "status": "pending",
        "created_at": now,
        "updated_at": now,
        "created_by": current_user["_id"],
    })

    result = await db.hr_leaves.insert_one(leave_dict)

    return {
        "id": str(result.inserted_id),
        "business_days": business_days,
        "message": "Leave request submitted successfully"
    }


@router.get("/types")
async def get_leave_types(
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)

    # Check for company-specific config first
    config = await db.hr_config.find_one({"company_id": ObjectId(company_id)})
    if config and config.get("leave_types"):
        return config["leave_types"]

    return LEAVE_TYPES


@router.get("/calendar")
async def get_leave_calendar(
    company_id: str = Query(...),
    month: int = Query(...),
    year: int = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)

    # Build date range for the month
    start_of_month = f"{year}-{month:02d}-01"
    if month == 12:
        end_of_month = f"{year + 1}-01-01"
    else:
        end_of_month = f"{year}-{month + 1:02d}-01"

    leaves = await db.hr_leaves.find({
        "company_id": ObjectId(company_id),
        "status": "approved",
        "$or": [
            {"start_date": {"$gte": start_of_month, "$lt": end_of_month}},
            {"end_date": {"$gte": start_of_month, "$lt": end_of_month}},
            {"start_date": {"$lt": start_of_month}, "end_date": {"$gte": end_of_month}},
        ]
    }).to_list(1000)

    return [serialize_leave(l) for l in leaves]


@router.get("/balance/{employee_id}")
async def get_leave_balance(
    employee_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)

    employee = await db.hr_employees.find_one({
        "_id": ObjectId(employee_id),
        "company_id": ObjectId(company_id)
    })
    if not employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    # Get balance from hr_leave_balances or compute from approved leaves
    balance_doc = await db.hr_leave_balances.find_one({
        "employee_id": ObjectId(employee_id),
        "company_id": ObjectId(company_id)
    })

    if balance_doc:
        balances = balance_doc.get("balances", {})
    else:
        # Default allocation based on LEAVE_TYPES
        balances = {}
        for lt in LEAVE_TYPES:
            if lt.get("paid", True):
                balances[lt["code"]] = {
                    "allocated": lt.get("max_days", 0),
                    "used": 0,
                    "remaining": lt.get("max_days", 0),
                }

    # Calculate used days from approved leaves for current year
    current_year = datetime.now().year
    year_start = f"{current_year}-01-01"
    year_end = f"{current_year}-12-31"

    approved_leaves = await db.hr_leaves.find({
        "employee_id": ObjectId(employee_id),
        "company_id": ObjectId(company_id),
        "status": "approved",
        "start_date": {"$gte": year_start, "$lte": year_end}
    }).to_list(1000)

    used_by_type = {}
    for leave in approved_leaves:
        lt = leave.get("leave_type", "")
        used_by_type[lt] = used_by_type.get(lt, 0) + leave.get("business_days", 0)

    # Merge used days into balances
    for code, used in used_by_type.items():
        if code in balances:
            balances[code]["used"] = used
            balances[code]["remaining"] = balances[code]["allocated"] - used

    return {
        "employee_id": employee_id,
        "employee_name": f"{employee.get('first_name', '')} {employee.get('last_name', '')}",
        "year": current_year,
        "balances": balances,
    }


@router.get("/{id}")
async def get_leave(
    id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)

    leave = await db.hr_leaves.find_one({
        "_id": ObjectId(id),
        "company_id": ObjectId(company_id)
    })
    if not leave:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave request not found")

    return serialize_leave(leave)


@router.put("/{id}")
async def update_leave(
    id: str,
    leave_data: LeaveUpdate,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)

    leave = await db.hr_leaves.find_one({
        "_id": ObjectId(id),
        "company_id": ObjectId(company_id)
    })
    if not leave:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave request not found")

    if leave.get("status") != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only pending leave requests can be updated"
        )

    update_data = {k: v for k, v in leave_data.dict(exclude_unset=True).items()}

    # Recalculate business days if dates changed
    start = update_data.get("start_date", leave.get("start_date"))
    end = update_data.get("end_date", leave.get("end_date"))
    if "start_date" in update_data or "end_date" in update_data:
        update_data["business_days"] = count_business_days(start, end)

    update_data["updated_at"] = datetime.now(timezone.utc)

    await db.hr_leaves.update_one(
        {"_id": ObjectId(id)},
        {"$set": update_data}
    )

    return {"message": "Leave request updated successfully"}


@router.post("/{id}/approve")
async def approve_leave(
    id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)

    leave = await db.hr_leaves.find_one({
        "_id": ObjectId(id),
        "company_id": ObjectId(company_id)
    })
    if not leave:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave request not found")

    if leave.get("status") != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only pending leave requests can be approved"
        )

    await db.hr_leaves.update_one(
        {"_id": ObjectId(id)},
        {"$set": {
            "status": "approved",
            "approved_by": current_user["_id"],
            "updated_at": datetime.now(timezone.utc),
        }}
    )

    # Decrement leave balance
    leave_type = leave.get("leave_type", "")
    business_days = leave.get("business_days", 0)
    await db.hr_leave_balances.update_one(
        {
            "employee_id": leave["employee_id"],
            "company_id": ObjectId(company_id),
        },
        {
            "$inc": {
                f"balances.{leave_type}.used": business_days,
                f"balances.{leave_type}.remaining": -business_days,
            }
        }
    )

    return {"message": "Leave request approved"}


@router.post("/{id}/reject")
async def reject_leave(
    id: str,
    data: LeaveReject,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)

    leave = await db.hr_leaves.find_one({
        "_id": ObjectId(id),
        "company_id": ObjectId(company_id)
    })
    if not leave:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave request not found")

    if leave.get("status") != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only pending leave requests can be rejected"
        )

    await db.hr_leaves.update_one(
        {"_id": ObjectId(id)},
        {"$set": {
            "status": "rejected",
            "rejection_reason": data.reason,
            "updated_at": datetime.now(timezone.utc),
        }}
    )

    return {"message": "Leave request rejected"}


@router.delete("/{id}")
async def cancel_leave(
    id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)

    leave = await db.hr_leaves.find_one({
        "_id": ObjectId(id),
        "company_id": ObjectId(company_id)
    })
    if not leave:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave request not found")

    if leave.get("status") != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only pending leave requests can be cancelled"
        )

    await db.hr_leaves.delete_one({"_id": ObjectId(id)})

    return {"message": "Leave request cancelled"}
