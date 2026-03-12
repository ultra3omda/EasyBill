from fastapi import APIRouter, HTTPException, status, Query, Depends
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime, timezone
import os
import logging
from typing import Optional
from pydantic import BaseModel, Field
from utils.dependencies import get_current_user, get_current_company

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/hr/declarations", tags=["HR Declarations"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]


QUARTER_MONTHS = {
    1: [1, 2, 3],
    2: [4, 5, 6],
    3: [7, 8, 9],
    4: [10, 11, 12],
}


def serialize_declaration(d: dict) -> dict:
    return {
        "id": str(d["_id"]),
        "company_id": str(d.get("company_id", "")),
        "type": d.get("type"),
        "period": d.get("period"),
        "quarter": d.get("quarter"),
        "month": d.get("month"),
        "year": d.get("year"),
        "data": d.get("data", {}),
        "totals": d.get("totals", {}),
        "status": d.get("status", "draft"),
        "created_at": d["created_at"].isoformat() if isinstance(d.get("created_at"), datetime) else d.get("created_at"),
        "created_by": str(d.get("created_by")) if d.get("created_by") else None,
    }


# ── CNSS (DS7) ──────────────────────────────────────────────────────────────

@router.post("/cnss/generate")
async def generate_cnss_declaration(
    quarter: int = Query(..., ge=1, le=4),
    year: int = Query(..., ge=2000),
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)

    months = QUARTER_MONTHS.get(quarter)
    if not months:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid quarter")

    # Fetch validated payslips for the quarter
    payslips = await db.hr_payslips.find({
        "company_id": ObjectId(company_id),
        "year": year,
        "month": {"$in": months},
        "status": "validated"
    }).to_list(5000)

    if not payslips:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No validated payslips found for Q{quarter} {year}"
        )

    # Aggregate by employee
    employee_data = {}
    for p in payslips:
        eid = str(p["employee_id"])
        if eid not in employee_data:
            employee_data[eid] = {
                "employee_id": eid,
                "employee_name": p.get("employee_name", ""),
                "matricule": p.get("matricule", ""),
                "total_gross": 0,
                "total_cnss_employee": 0,
                "total_cnss_employer": 0,
                "months_worked": 0,
            }
        employee_data[eid]["total_gross"] += p.get("gross_salary", 0)
        employee_data[eid]["total_cnss_employee"] += p.get("cnss_employee", 0)
        employee_data[eid]["total_cnss_employer"] += p.get("cnss_employer", 0)
        employee_data[eid]["months_worked"] += 1

    employees_list = list(employee_data.values())
    totals = {
        "total_gross": round(sum(e["total_gross"] for e in employees_list), 3),
        "total_cnss_employee": round(sum(e["total_cnss_employee"] for e in employees_list), 3),
        "total_cnss_employer": round(sum(e["total_cnss_employer"] for e in employees_list), 3),
        "employee_count": len(employees_list),
    }

    now = datetime.now(timezone.utc)
    declaration = {
        "company_id": ObjectId(company_id),
        "type": "cnss_ds7",
        "period": f"Q{quarter}-{year}",
        "quarter": quarter,
        "year": year,
        "data": {"employees": employees_list},
        "totals": totals,
        "status": "draft",
        "created_at": now,
        "created_by": current_user["_id"],
    }

    result = await db.hr_declarations.insert_one(declaration)

    return {
        "id": str(result.inserted_id),
        "period": f"Q{quarter}-{year}",
        "totals": totals,
        "employees": employees_list,
        "message": "CNSS declaration generated successfully"
    }


@router.get("/cnss/history")
async def get_cnss_history(
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)

    declarations = await db.hr_declarations.find({
        "company_id": ObjectId(company_id),
        "type": "cnss_ds7"
    }).sort("created_at", -1).to_list(100)

    return [serialize_declaration(d) for d in declarations]


# ── IRPP / TFP / FOPROLOS ───────────────────────────────────────────────────

@router.post("/irpp/generate")
async def generate_irpp_declaration(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2000),
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)

    payslips = await db.hr_payslips.find({
        "company_id": ObjectId(company_id),
        "year": year,
        "month": month,
        "status": "validated"
    }).to_list(5000)

    if not payslips:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No validated payslips found for {month:02d}/{year}"
        )

    total_irpp = sum(p.get("irpp", 0) for p in payslips)
    total_css = sum(p.get("css", 0) for p in payslips)
    total_tfp = sum(p.get("tfp", 0) for p in payslips)
    total_foprolos = sum(p.get("foprolos", 0) for p in payslips)
    total_gross = sum(p.get("gross_salary", 0) for p in payslips)

    totals = {
        "total_irpp": round(total_irpp, 3),
        "total_css": round(total_css, 3),
        "total_tfp": round(total_tfp, 3),
        "total_foprolos": round(total_foprolos, 3),
        "total_gross": round(total_gross, 3),
        "employee_count": len(payslips),
    }

    now = datetime.now(timezone.utc)
    declaration = {
        "company_id": ObjectId(company_id),
        "type": "irpp_monthly",
        "period": f"{month:02d}/{year}",
        "month": month,
        "year": year,
        "data": {
            "employees": [{
                "employee_id": str(p["employee_id"]),
                "employee_name": p.get("employee_name", ""),
                "gross_salary": p.get("gross_salary", 0),
                "irpp": p.get("irpp", 0),
                "css": p.get("css", 0),
            } for p in payslips]
        },
        "totals": totals,
        "status": "draft",
        "created_at": now,
        "created_by": current_user["_id"],
    }

    result = await db.hr_declarations.insert_one(declaration)

    return {
        "id": str(result.inserted_id),
        "period": f"{month:02d}/{year}",
        "totals": totals,
        "message": "IRPP declaration generated successfully"
    }


@router.get("/irpp/history")
async def get_irpp_history(
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)

    declarations = await db.hr_declarations.find({
        "company_id": ObjectId(company_id),
        "type": "irpp_monthly"
    }).sort("created_at", -1).to_list(100)

    return [serialize_declaration(d) for d in declarations]


# ── Annual Declaration ───────────────────────────────────────────────────────

@router.post("/annual/generate")
async def generate_annual_declaration(
    year: int = Query(..., ge=2000),
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)

    payslips = await db.hr_payslips.find({
        "company_id": ObjectId(company_id),
        "year": year,
        "status": "validated"
    }).to_list(10000)

    if not payslips:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No validated payslips found for {year}"
        )

    # Aggregate by employee
    employee_annual = {}
    for p in payslips:
        eid = str(p["employee_id"])
        if eid not in employee_annual:
            employee_annual[eid] = {
                "employee_id": eid,
                "employee_name": p.get("employee_name", ""),
                "matricule": p.get("matricule", ""),
                "total_gross": 0,
                "total_net": 0,
                "total_cnss_employee": 0,
                "total_cnss_employer": 0,
                "total_irpp": 0,
                "total_css": 0,
                "months_worked": 0,
            }
        employee_annual[eid]["total_gross"] += p.get("gross_salary", 0)
        employee_annual[eid]["total_net"] += p.get("net_salary", 0)
        employee_annual[eid]["total_cnss_employee"] += p.get("cnss_employee", 0)
        employee_annual[eid]["total_cnss_employer"] += p.get("cnss_employer", 0)
        employee_annual[eid]["total_irpp"] += p.get("irpp", 0)
        employee_annual[eid]["total_css"] += p.get("css", 0)
        employee_annual[eid]["months_worked"] += 1

    employees_list = list(employee_annual.values())
    # Round all float values
    for emp in employees_list:
        for key in ["total_gross", "total_net", "total_cnss_employee", "total_cnss_employer", "total_irpp", "total_css"]:
            emp[key] = round(emp[key], 3)

    totals = {
        "total_gross": round(sum(e["total_gross"] for e in employees_list), 3),
        "total_net": round(sum(e["total_net"] for e in employees_list), 3),
        "total_cnss_employee": round(sum(e["total_cnss_employee"] for e in employees_list), 3),
        "total_cnss_employer": round(sum(e["total_cnss_employer"] for e in employees_list), 3),
        "total_irpp": round(sum(e["total_irpp"] for e in employees_list), 3),
        "employee_count": len(employees_list),
    }

    now = datetime.now(timezone.utc)
    declaration = {
        "company_id": ObjectId(company_id),
        "type": "annual",
        "period": str(year),
        "year": year,
        "data": {"employees": employees_list},
        "totals": totals,
        "status": "draft",
        "created_at": now,
        "created_by": current_user["_id"],
    }

    result = await db.hr_declarations.insert_one(declaration)

    return {
        "id": str(result.inserted_id),
        "year": year,
        "totals": totals,
        "employees": employees_list,
        "message": "Annual declaration generated successfully"
    }


@router.get("/annual/{year}")
async def get_annual_declaration(
    year: int,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)

    declaration = await db.hr_declarations.find_one({
        "company_id": ObjectId(company_id),
        "type": "annual",
        "year": year
    })
    if not declaration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No annual declaration found for {year}"
        )

    return serialize_declaration(declaration)


# ── Withholding Certificate ──────────────────────────────────────────────────

@router.post("/certificate/{employee_id}/{year}")
async def generate_withholding_certificate(
    employee_id: str,
    year: int,
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

    payslips = await db.hr_payslips.find({
        "company_id": ObjectId(company_id),
        "employee_id": ObjectId(employee_id),
        "year": year,
        "status": "validated"
    }).to_list(12)

    if not payslips:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No validated payslips found for employee in {year}"
        )

    total_gross = round(sum(p.get("gross_salary", 0) for p in payslips), 3)
    total_net = round(sum(p.get("net_salary", 0) for p in payslips), 3)
    total_cnss = round(sum(p.get("cnss_employee", 0) for p in payslips), 3)
    total_irpp = round(sum(p.get("irpp", 0) for p in payslips), 3)
    total_css = round(sum(p.get("css", 0) for p in payslips), 3)

    return {
        "employee_id": employee_id,
        "employee_name": f"{employee.get('first_name', '')} {employee.get('last_name', '')}",
        "matricule": employee.get("matricule", ""),
        "cin": employee.get("cin", ""),
        "cnss_number": employee.get("cnss_number", ""),
        "year": year,
        "months_worked": len(payslips),
        "total_gross": total_gross,
        "total_cnss": total_cnss,
        "total_irpp": total_irpp,
        "total_css": total_css,
        "total_net": total_net,
    }
