from fastapi import APIRouter, HTTPException, status, Query, Depends
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime, timezone, timedelta
import os
import logging
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from utils.dependencies import get_current_user, get_current_company
from data.tunisian_hr_config import CONTRACT_TYPES, PROFESSIONAL_CATEGORIES
from services.payroll_engine import get_active_config
from services.payroll_salary_solver import build_salary_breakdown, parse_number, solve_base_salary_from_net_target

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/hr", tags=["HR Employees"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]


class EmployeeCreate(BaseModel):
    first_name: str
    last_name: str
    cin: Optional[str] = ""
    base_salary: Optional[float] = 0
    net_target: Optional[float] = 0
    hire_date: Optional[str] = ""
    department: Optional[str] = ""
    position: Optional[str] = ""
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    cnss_number: Optional[str] = None
    bank_account: Optional[str] = None
    bank_name: Optional[str] = None
    rib: Optional[str] = None
    category: Optional[str] = None
    professional_category: Optional[str] = None
    marital_status: Optional[str] = None
    children_count: int = 0
    work_regime: Optional[str] = "48h"
    payment_method: Optional[str] = "virement"
    salary_input_mode: Optional[str] = "net_target"
    primes: List[Dict[str, Any]] = Field(default_factory=list)


class EmployeeUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    cin: Optional[str] = None
    base_salary: Optional[float] = None
    net_target: Optional[float] = None
    department: Optional[str] = None
    position: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    cnss_number: Optional[str] = None
    bank_account: Optional[str] = None
    bank_name: Optional[str] = None
    rib: Optional[str] = None
    category: Optional[str] = None
    professional_category: Optional[str] = None
    marital_status: Optional[str] = None
    children_count: Optional[int] = None
    hire_date: Optional[str] = None
    work_regime: Optional[str] = None
    payment_method: Optional[str] = None
    salary_input_mode: Optional[str] = None
    primes: Optional[List[Dict[str, Any]]] = None


class EmployeeSalaryPreviewRequest(BaseModel):
    base_salary: Optional[float] = 0
    net_target: Optional[float] = 0
    hire_date: Optional[str] = None
    work_regime: Optional[str] = "48h"
    professional_category: Optional[str] = None
    category: Optional[str] = None
    marital_status: Optional[str] = None
    children_count: int = 0
    salary_input_mode: Optional[str] = "net_target"
    primes: List[Dict[str, Any]] = Field(default_factory=list)


class ContractCreate(BaseModel):
    type: str
    start_date: str
    end_date: Optional[str] = None
    salary: float


class ContractUpdate(BaseModel):
    type: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    salary: Optional[float] = None


class ContractTerminate(BaseModel):
    end_date: str
    termination_reason: str


def serialize_employee(e: dict) -> dict:
    return {
        "id": str(e["_id"]),
        "company_id": str(e.get("company_id", "")),
        "matricule": e.get("matricule"),
        "first_name": e.get("first_name"),
        "last_name": e.get("last_name"),
        "cin": e.get("cin"),
        "email": e.get("email"),
        "phone": e.get("phone"),
        "address": e.get("address"),
        "date_of_birth": e.get("date_of_birth"),
        "gender": e.get("gender"),
        "department": e.get("department"),
        "position": e.get("position"),
        "category": e.get("category"),
        "professional_category": e.get("professional_category"),
        "base_salary": e.get("base_salary", 0),
        "base_salary_gross": e.get("base_salary_gross", e.get("base_salary", 0)),
        "net_target": e.get("net_target", 0),
        "salary_input_mode": e.get("salary_input_mode", "gross_base"),
        "hire_date": e.get("hire_date"),
        "status": e.get("status", "active"),
        "cnss_number": e.get("cnss_number"),
        "bank_account": e.get("bank_account"),
        "bank_name": e.get("bank_name"),
        "rib": e.get("rib"),
        "work_regime": e.get("work_regime"),
        "payment_method": e.get("payment_method"),
        "marital_status": e.get("marital_status"),
        "children_count": e.get("children_count", 0),
        "primes": e.get("primes", []),
        "mandatory_primes": e.get("mandatory_primes", []),
        "salary_breakdown_snapshot": e.get("salary_breakdown_snapshot", {}),
        "convention_collective_code": e.get("convention_collective_code"),
        "created_at": e["created_at"].isoformat() if isinstance(e.get("created_at"), datetime) else e.get("created_at"),
        "updated_at": e["updated_at"].isoformat() if isinstance(e.get("updated_at"), datetime) else e.get("updated_at"),
    }


def serialize_employee_summary(e: dict) -> dict:
    return {
        "id": str(e["_id"]),
        "matricule": e.get("matricule"),
        "first_name": e.get("first_name"),
        "last_name": e.get("last_name"),
        "position": e.get("position"),
        "department": e.get("department"),
        "status": e.get("status", "active"),
        "base_salary": e.get("base_salary", 0),
        "net_target": e.get("net_target", 0),
        "salary_input_mode": e.get("salary_input_mode", "gross_base"),
        "hire_date": e.get("hire_date"),
    }


def serialize_contract(c: dict) -> dict:
    return {
        "id": str(c["_id"]),
        "employee_id": str(c.get("employee_id", "")),
        "type": c.get("type"),
        "start_date": c.get("start_date"),
        "end_date": c.get("end_date"),
        "salary": c.get("salary", 0),
        "status": c.get("status", "active"),
        "termination_reason": c.get("termination_reason"),
        "created_at": c["created_at"].isoformat() if isinstance(c.get("created_at"), datetime) else c.get("created_at"),
        "updated_at": c["updated_at"].isoformat() if isinstance(c.get("updated_at"), datetime) else c.get("updated_at"),
    }


async def compute_employee_salary(company_id: str, employee_payload: Dict[str, Any]) -> Dict[str, Any]:
    config = await get_active_config(company_id)
    normalized_payload = dict(employee_payload)
    normalized_payload["primes"] = normalized_payload.get("primes") or []
    normalized_payload["professional_category"] = normalized_payload.get("professional_category") or normalized_payload.get("category")
    normalized_payload["category"] = normalized_payload.get("professional_category") or normalized_payload.get("category")
    normalized_payload["bank_account"] = normalized_payload.get("bank_account") or normalized_payload.get("rib")

    net_target = parse_number(normalized_payload.get("net_target"))
    base_salary = parse_number(normalized_payload.get("base_salary"))
    salary_mode = normalized_payload.get("salary_input_mode") or ("net_target" if net_target > 0 else "gross_base")

    if salary_mode == "net_target" and net_target <= 0 and base_salary <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Le net cible doit être supérieur à 0")

    if (salary_mode == "net_target" and net_target > 0) or (net_target > 0 and base_salary <= 0):
        breakdown = solve_base_salary_from_net_target(normalized_payload, config, net_target)
    else:
        breakdown = build_salary_breakdown(normalized_payload, config)

    normalized_payload.update({
        "salary_input_mode": "net_target" if net_target > 0 or salary_mode == "net_target" else "gross_base",
        "base_salary": breakdown["base_salary_gross"],
        "base_salary_gross": breakdown["base_salary_gross"],
        "net_target": breakdown.get("net_target", net_target),
        "primes": breakdown["primes"],
        "mandatory_primes": breakdown["mandatory_primes"],
        "monthly_primes": breakdown["total_primes"],
        "salary_breakdown_snapshot": breakdown["salary_breakdown_snapshot"],
        "convention_collective_code": breakdown["convention_profile"].get("code"),
    })
    return normalized_payload


@router.get("/employees")
async def list_employees(
    company_id: str = Query(...),
    status_filter: Optional[str] = Query(None, alias="status"),
    department: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)

    query = {"company_id": ObjectId(company_id)}
    if status_filter:
        query["status"] = status_filter
    if department:
        query["department"] = department

    employees = await db.hr_employees.find(query).sort("created_at", -1).to_list(1000)
    return [serialize_employee(e) for e in employees]


@router.post("/employees", status_code=status.HTTP_201_CREATED)
async def create_employee(
    employee_data: EmployeeCreate,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)

    # Auto-generate matricule
    last_employee = await db.hr_employees.find(
        {"company_id": ObjectId(company_id)}
    ).sort("matricule", -1).limit(1).to_list(1)

    if last_employee and last_employee[0].get("matricule"):
        try:
            last_num = int(last_employee[0]["matricule"].split("-")[1])
            next_num = last_num + 1
        except (IndexError, ValueError):
            next_num = 1
    else:
        next_num = 1

    matricule = f"EMP-{next_num:03d}"

    now = datetime.now(timezone.utc)
    employee_dict = await compute_employee_salary(company_id, employee_data.dict())
    employee_dict.update({
        "company_id": ObjectId(company_id),
        "matricule": matricule,
        "status": "active",
        "created_at": now,
        "updated_at": now,
        "created_by": current_user["_id"],
    })

    result = await db.hr_employees.insert_one(employee_dict)

    return {
        "id": str(result.inserted_id),
        "matricule": matricule,
        "message": "Employee created successfully"
    }


@router.post("/employees/salary-preview")
async def preview_employee_salary(
    payload: EmployeeSalaryPreviewRequest,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)
    employee_payload = await compute_employee_salary(company_id, payload.dict())
    return employee_payload.get("salary_breakdown_snapshot", {})


@router.get("/employees/{id}")
async def get_employee(
    id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)

    employee = await db.hr_employees.find_one({
        "_id": ObjectId(id),
        "company_id": ObjectId(company_id)
    })
    if not employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    return serialize_employee(employee)


@router.put("/employees/{id}")
async def update_employee(
    id: str,
    employee_data: EmployeeUpdate,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)

    employee = await db.hr_employees.find_one({
        "_id": ObjectId(id),
        "company_id": ObjectId(company_id)
    })
    if not employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    update_data = {k: v for k, v in employee_data.dict(exclude_unset=True).items()}
    computed_employee = await compute_employee_salary(company_id, {**employee, **update_data})
    fields_to_keep = {
        "first_name", "last_name", "cin", "email", "phone", "address",
        "date_of_birth", "gender", "department", "position", "category",
        "professional_category", "base_salary", "base_salary_gross", "net_target",
        "salary_input_mode", "hire_date", "cnss_number", "bank_account",
        "bank_name", "rib", "work_regime", "payment_method", "marital_status",
        "children_count", "primes", "mandatory_primes", "monthly_primes",
        "salary_breakdown_snapshot", "convention_collective_code",
    }
    update_data = {k: v for k, v in computed_employee.items() if k in fields_to_keep}
    update_data["updated_at"] = datetime.now(timezone.utc)

    await db.hr_employees.update_one(
        {"_id": ObjectId(id)},
        {"$set": update_data}
    )

    return {"message": "Employee updated successfully"}


@router.delete("/employees/{id}")
async def delete_employee(
    id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)

    employee = await db.hr_employees.find_one({
        "_id": ObjectId(id),
        "company_id": ObjectId(company_id)
    })
    if not employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    await db.hr_employees.update_one(
        {"_id": ObjectId(id)},
        {"$set": {"status": "terminated", "updated_at": datetime.now(timezone.utc)}}
    )

    return {"message": "Employee terminated successfully"}


@router.post("/employees/{id}/contracts", status_code=status.HTTP_201_CREATED)
async def add_contract(
    id: str,
    contract_data: ContractCreate,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)

    employee = await db.hr_employees.find_one({
        "_id": ObjectId(id),
        "company_id": ObjectId(company_id)
    })
    if not employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    now = datetime.now(timezone.utc)
    contract_dict = contract_data.dict()
    contract_dict.update({
        "employee_id": ObjectId(id),
        "company_id": ObjectId(company_id),
        "status": "active",
        "created_at": now,
        "updated_at": now,
    })

    result = await db.hr_contracts.insert_one(contract_dict)

    return {"id": str(result.inserted_id), "message": "Contract added successfully"}


@router.get("/employees/{id}/contracts")
async def list_contracts(
    id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)

    employee = await db.hr_employees.find_one({
        "_id": ObjectId(id),
        "company_id": ObjectId(company_id)
    })
    if not employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    contracts = await db.hr_contracts.find(
        {"employee_id": ObjectId(id), "company_id": ObjectId(company_id)}
    ).sort("created_at", -1).to_list(100)

    return [serialize_contract(c) for c in contracts]


@router.put("/contracts/{contract_id}")
async def update_contract(
    contract_id: str,
    contract_data: ContractUpdate,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)

    contract = await db.hr_contracts.find_one({
        "_id": ObjectId(contract_id),
        "company_id": ObjectId(company_id)
    })
    if not contract:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contract not found")

    update_data = {k: v for k, v in contract_data.dict(exclude_unset=True).items()}
    update_data["updated_at"] = datetime.now(timezone.utc)

    await db.hr_contracts.update_one(
        {"_id": ObjectId(contract_id)},
        {"$set": update_data}
    )

    return {"message": "Contract updated successfully"}


@router.post("/contracts/{contract_id}/terminate")
async def terminate_contract(
    contract_id: str,
    data: ContractTerminate,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)

    contract = await db.hr_contracts.find_one({
        "_id": ObjectId(contract_id),
        "company_id": ObjectId(company_id)
    })
    if not contract:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contract not found")

    await db.hr_contracts.update_one(
        {"_id": ObjectId(contract_id)},
        {"$set": {
            "end_date": data.end_date,
            "termination_reason": data.termination_reason,
            "status": "terminated",
            "updated_at": datetime.now(timezone.utc),
        }}
    )

    return {"message": "Contract terminated successfully"}


@router.get("/contract-types")
async def get_contract_types(
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)
    return CONTRACT_TYPES


@router.get("/categories")
async def get_categories(
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)
    return PROFESSIONAL_CATEGORIES


@router.get("/dashboard")
async def get_hr_dashboard(
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)

    cid = ObjectId(company_id)

    # Total employees by status
    pipeline_status = [
        {"$match": {"company_id": cid}},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    status_results = await db.hr_employees.aggregate(pipeline_status).to_list(100)
    employees_by_status = {r["_id"]: r["count"] for r in status_results}

    total_active = employees_by_status.get("active", 0)

    # Average salary
    pipeline_salary = [
        {"$match": {"company_id": cid, "status": "active"}},
        {"$group": {"_id": None, "avg_salary": {"$avg": "$base_salary"}}}
    ]
    salary_result = await db.hr_employees.aggregate(pipeline_salary).to_list(1)
    avg_salary = round(salary_result[0]["avg_salary"], 3) if salary_result else 0

    # Contracts expiring within 30 days
    now = datetime.now(timezone.utc)
    thirty_days = (now + timedelta(days=30)).strftime("%Y-%m-%d")
    today_str = now.strftime("%Y-%m-%d")

    expiring_contracts = await db.hr_contracts.count_documents({
        "company_id": cid,
        "status": "active",
        "end_date": {"$gte": today_str, "$lte": thirty_days}
    })

    # Leaves in progress
    leaves_in_progress = await db.hr_leaves.count_documents({
        "company_id": cid,
        "status": "approved",
        "start_date": {"$lte": today_str},
        "end_date": {"$gte": today_str}
    })

    return {
        "employees_by_status": employees_by_status,
        "total_active": total_active,
        "average_salary": avg_salary,
        "contracts_expiring_soon": expiring_contracts,
        "leaves_in_progress": leaves_in_progress,
    }
