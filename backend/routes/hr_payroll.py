from fastapi import APIRouter, HTTPException, status, Query, Depends
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime, timezone
import os
import logging
from typing import Optional
from pydantic import BaseModel, Field
from utils.dependencies import get_current_user, get_current_company
from services.payroll_engine import calculate_payslip, get_active_config

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/hr/payroll", tags=["HR Payroll"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]


class PayrollCalculateRequest(BaseModel):
    month: int = Field(..., ge=1, le=12)
    year: int = Field(..., ge=2000)


class PayrollValidateRequest(BaseModel):
    month: int = Field(..., ge=1, le=12)
    year: int = Field(..., ge=2000)
    payslips: list


class PayrollConfigUpdate(BaseModel):
    auto_generate_entries: Optional[bool] = None
    default_work_days: Optional[int] = None
    default_work_hours: Optional[float] = None
    overtime_rate: Optional[float] = None
    payment_day: Optional[int] = None


def serialize_payslip(p: dict) -> dict:
    employer_charges = p.get("employer_charges", [])
    employer_charges_total = p.get("employer_charges_total", p.get("total_employer_charges", 0))
    if isinstance(employer_charges, list):
        employer_charges_total = employer_charges_total or sum(item.get("amount", 0) for item in employer_charges)
    return {
        "id": str(p["_id"]),
        "company_id": str(p.get("company_id", "")),
        "employee_id": str(p.get("employee_id", "")),
        "employee_name": p.get("employee_name", ""),
        "matricule": p.get("matricule", ""),
        "month": p.get("month"),
        "year": p.get("year"),
        "base_salary": p.get("base_salary", 0),
        "gross_salary": p.get("gross_salary", 0),
        "net_salary": p.get("net_salary", 0),
        "cnss_employee": p.get("cnss_employee", 0),
        "cnss_employer": p.get("cnss_employer", 0),
        "irpp": p.get("irpp", 0),
        "css": p.get("css", 0),
        "tfp": p.get("tfp", 0),
        "foprolos": p.get("foprolos", 0),
        "deductions": p.get("deductions", []),
        "bonuses": p.get("bonuses", []),
        "total_deductions": p.get("total_deductions", 0),
        "total_bonuses": p.get("total_bonuses", 0),
        "employer_charges": employer_charges_total,
        "employer_charges_detail": employer_charges,
        "department": p.get("department", ""),
        "status": p.get("status", "draft"),
        "created_at": p["created_at"].isoformat() if isinstance(p.get("created_at"), datetime) else p.get("created_at"),
    }


async def generate_payroll_journal_entry(company_id: str, month: int, year: int, payslips: list):
    """Generate accounting journal entry for validated payroll."""
    try:
        from services.accounting_sync_service import accounting_sync_service
        total_gross = sum(p.get("gross_salary", 0) for p in payslips)
        total_net = sum(p.get("net_salary", 0) for p in payslips)
        total_cnss_employee = sum(p.get("cnss_employee", 0) for p in payslips)
        total_cnss_employer = sum(p.get("cnss_employer", 0) for p in payslips)
        total_irpp = sum(p.get("irpp", 0) for p in payslips)

        now = datetime.now(timezone.utc)
        entry = {
            "company_id": ObjectId(company_id),
            "date": now,
            "reference": f"PAIE-{month:02d}/{year}",
            "description": f"Paie du mois {month:02d}/{year}",
            "lines": [
                {"account": "641", "label": "Rémunérations du personnel", "debit": total_gross, "credit": 0},
                {"account": "6451", "label": "Charges CNSS patronales", "debit": total_cnss_employer, "credit": 0},
                {"account": "4211", "label": "Personnel - Rémunérations dues", "debit": 0, "credit": total_net},
                {"account": "4311", "label": "CNSS salariale", "debit": 0, "credit": total_cnss_employee},
                {"account": "4312", "label": "CNSS patronale", "debit": 0, "credit": total_cnss_employer},
                {"account": "4321", "label": "IRPP retenu", "debit": 0, "credit": total_irpp},
            ],
            "source": "payroll",
            "source_id": f"{month:02d}-{year}",
            "status": "draft",
            "created_at": now,
        }
        await db.journal_entries.insert_one(entry)
    except Exception as e:
        logger.error(f"Error generating payroll journal entry: {str(e)}")


@router.post("/calculate")
async def calculate_payroll(
    data: PayrollCalculateRequest,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)

    # Get all active employees
    employees = await db.hr_employees.find({
        "company_id": ObjectId(company_id),
        "status": "active"
    }).to_list(1000)

    if not employees:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active employees found"
        )

    payslips = []

    for emp in employees:
        try:
            payslip = await calculate_payslip(emp, data.month, data.year, company_id)
            payslip["employee_id"] = str(emp["_id"])
            payslip["employee_name"] = f"{emp.get('first_name', '')} {emp.get('last_name', '')}"
            payslip["matricule"] = emp.get("matricule", "")
            payslip["department"] = emp.get("department", "")
            payslips.append(payslip)
        except Exception as e:
            logger.error(f"Error calculating payslip for {emp.get('matricule')}: {str(e)}")
            payslips.append({
                "employee_id": str(emp["_id"]),
                "employee_name": f"{emp.get('first_name', '')} {emp.get('last_name', '')}",
                "matricule": emp.get("matricule", ""),
                "error": str(e),
            })

    return {
        "month": data.month,
        "year": data.year,
        "total_employees": len(employees),
        "payslips": payslips,
    }


@router.post("/validate")
async def validate_payroll(
    data: PayrollValidateRequest,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)

    # Check if already validated for this month
    existing = await db.hr_payslips.find_one({
        "company_id": ObjectId(company_id),
        "month": data.month,
        "year": data.year,
        "status": "validated"
    })
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Payroll for {data.month:02d}/{data.year} is already validated"
        )

    now = datetime.now(timezone.utc)
    saved_payslips = []

    for payslip in data.payslips:
        if payslip.get("error"):
            continue

        payslip_doc = {
            **payslip,
            "company_id": ObjectId(company_id),
            "employee_id": ObjectId(payslip["employee_id"]),
            "month": data.month,
            "year": data.year,
            "status": "validated",
            "validated_by": current_user["_id"],
            "validated_at": now,
            "created_at": now,
        }
        result = await db.hr_payslips.insert_one(payslip_doc)
        payslip_doc["_id"] = result.inserted_id
        saved_payslips.append(payslip_doc)

    # Auto-generate accounting entries if configured
    config = await get_active_config(company_id)
    if config.get("accounting", {}).get("auto_generate_entries", False):
        await generate_payroll_journal_entry(company_id, data.month, data.year, saved_payslips)

    return {
        "message": f"Payroll validated for {data.month:02d}/{data.year}",
        "validated_count": len(saved_payslips),
    }


@router.get("/history")
async def get_payroll_history(
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)

    pipeline = [
        {"$match": {"company_id": ObjectId(company_id), "status": "validated"}},
        {"$group": {
            "_id": {"month": "$month", "year": "$year"},
            "total_gross": {"$sum": "$gross_salary"},
            "total_net": {"$sum": "$net_salary"},
            "total_employer_charges": {"$sum": "$employer_charges_total"},
            "employee_count": {"$sum": 1},
            "validated_at": {"$max": "$validated_at"},
        }},
        {"$sort": {"_id.year": -1, "_id.month": -1}}
    ]

    results = await db.hr_payslips.aggregate(pipeline).to_list(100)

    return [{
        "month": r["_id"]["month"],
        "year": r["_id"]["year"],
        "total_gross": round(r["total_gross"], 3),
        "total_net": round(r["total_net"], 3),
        "total_employer_charges": round(r["total_employer_charges"], 3),
        "employee_count": r["employee_count"],
        "validated_at": r["validated_at"].isoformat() if isinstance(r.get("validated_at"), datetime) else r.get("validated_at"),
    } for r in results]


@router.get("/{payslip_id}")
async def get_payslip(
    payslip_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)

    payslip = await db.hr_payslips.find_one({
        "_id": ObjectId(payslip_id),
        "company_id": ObjectId(company_id)
    })
    if not payslip:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payslip not found")

    return serialize_payslip(payslip)


@router.get("/summary/{month}/{year}")
async def get_payroll_summary(
    month: int,
    year: int,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)

    payslips = await db.hr_payslips.find({
        "company_id": ObjectId(company_id),
        "month": month,
        "year": year,
        "status": "validated"
    }).to_list(1000)

    if not payslips:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No validated payslips for {month:02d}/{year}"
        )

    total_brut = sum(p.get("gross_salary", 0) for p in payslips)
    total_net = sum(p.get("net_salary", 0) for p in payslips)
    total_charges = sum(p.get("employer_charges_total", 0) for p in payslips)

    # By department
    by_department = {}
    for p in payslips:
        dept = p.get("department", "Non défini")
        if dept not in by_department:
            by_department[dept] = {"gross": 0, "net": 0, "charges": 0, "count": 0}
        by_department[dept]["gross"] += p.get("gross_salary", 0)
        by_department[dept]["net"] += p.get("net_salary", 0)
        by_department[dept]["charges"] += p.get("employer_charges_total", 0)
        by_department[dept]["count"] += 1

    return {
        "month": month,
        "year": year,
        "total_brut": round(total_brut, 3),
        "total_net": round(total_net, 3),
        "total_charges": round(total_charges, 3),
        "employee_count": len(payslips),
        "by_department": {k: {dk: round(dv, 3) if isinstance(dv, float) else dv for dk, dv in v.items()} for k, v in by_department.items()},
    }


@router.get("/config")
async def get_payroll_config(
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)

    config = await db.hr_payroll_config.find_one({"company_id": ObjectId(company_id)})
    if not config:
        return {
            "auto_generate_entries": False,
            "default_work_days": 26,
            "default_work_hours": 8,
            "overtime_rate": 1.5,
            "payment_day": 28,
        }

    return {
        "id": str(config["_id"]),
        "auto_generate_entries": config.get("auto_generate_entries", False),
        "default_work_days": config.get("default_work_days", 26),
        "default_work_hours": config.get("default_work_hours", 8),
        "overtime_rate": config.get("overtime_rate", 1.5),
        "payment_day": config.get("payment_day", 28),
    }


@router.put("/config")
async def update_payroll_config(
    config_data: PayrollConfigUpdate,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)

    update_data = {k: v for k, v in config_data.dict(exclude_unset=True).items()}
    update_data["updated_at"] = datetime.now(timezone.utc)

    await db.hr_payroll_config.update_one(
        {"company_id": ObjectId(company_id)},
        {"$set": update_data, "$setOnInsert": {"company_id": ObjectId(company_id), "created_at": datetime.now(timezone.utc)}},
        upsert=True
    )

    return {"message": "Payroll config updated successfully"}
