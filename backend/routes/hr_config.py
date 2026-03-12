from fastapi import APIRouter, HTTPException, status, Query, Depends
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime, timezone
import os
import logging
from typing import Optional, List
from pydantic import BaseModel, Field
from utils.dependencies import get_current_user, get_current_company
from data.tunisian_hr_config import (
    CONTRACT_TYPES, LEAVE_TYPES, PROFESSIONAL_CATEGORIES,
    FINANCE_LAW_PRESETS, PAYROLL_RUBRICS, PUBLIC_HOLIDAYS,
)
from services.payroll_engine import get_active_config, initialize_default_config

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/hr/config", tags=["HR Config"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]


# ── Pydantic Models ─────────────────────────────────────────────────────────

class IRPPBracket(BaseModel):
    min: float
    max: Optional[float] = None
    rate: float = Field(..., ge=0, le=100)


class IRPPUpdate(BaseModel):
    brackets: Optional[List[IRPPBracket]] = None
    css_rate: Optional[float] = Field(None, ge=0, le=100)
    family_deduction_per_child: Optional[float] = None
    max_children_deduction: Optional[int] = None
    head_of_family_deduction: Optional[float] = None
    reason: Optional[str] = None


class CNSSUpdate(BaseModel):
    employee_rate: Optional[float] = Field(None, ge=0, le=100)
    employer_rate: Optional[float] = Field(None, ge=0, le=100)
    ceiling: Optional[float] = None
    reason: Optional[str] = None


class ParafiscalUpdate(BaseModel):
    tfp_rate: Optional[float] = Field(None, ge=0, le=100)
    foprolos_rate: Optional[float] = Field(None, ge=0, le=100)
    reason: Optional[str] = None


class MinimumWagesUpdate(BaseModel):
    smig_hourly: Optional[float] = None
    smig_monthly: Optional[float] = None
    smag_daily: Optional[float] = None
    reason: Optional[str] = None


class ContractTypeToggle(BaseModel):
    is_active: Optional[bool] = None


class CustomContractType(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    max_duration_months: Optional[int] = None
    renewable: bool = True


class LeaveTypeToggle(BaseModel):
    is_active: Optional[bool] = None
    max_days: Optional[int] = None


class CustomLeaveType(BaseModel):
    code: str
    name: str
    max_days: int
    paid: bool = True
    description: Optional[str] = None


class RubricToggle(BaseModel):
    is_active: Optional[bool] = None


class CustomRubric(BaseModel):
    code: str
    name: str
    type: str  # earning / deduction
    calculation: Optional[str] = None
    rate: Optional[float] = None
    amount: Optional[float] = None
    taxable: bool = True
    description: Optional[str] = None


class AccountingConfigUpdate(BaseModel):
    auto_generate_entries: Optional[bool] = None
    salary_account: Optional[str] = None
    cnss_employee_account: Optional[str] = None
    cnss_employer_account: Optional[str] = None
    irpp_account: Optional[str] = None
    net_salary_account: Optional[str] = None
    reason: Optional[str] = None


class HolidayCreate(BaseModel):
    name: str
    date: str
    recurring: bool = True


# ── Helpers ──────────────────────────────────────────────────────────────────

async def record_change(company_id: str, user_id, user_name: str, section: str, old_value, new_value, reason: Optional[str] = None):
    """Record a change in config history and increment version."""
    now = datetime.now(timezone.utc)
    await db.hr_config.update_one(
        {"company_id": ObjectId(company_id)},
        {
            "$push": {
                "change_history": {
                    "date": now,
                    "user_id": user_id,
                    "user_name": user_name,
                    "section": section,
                    "old_value": old_value,
                    "new_value": new_value,
                    "reason": reason,
                }
            },
            "$inc": {"version": 1},
            "$set": {"last_updated": now, "updated_by": user_name},
        }
    )


# ── Full Config ──────────────────────────────────────────────────────────────

@router.get("/")
async def get_full_config(
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)
    config = await get_active_config(company_id)
    if config and "_id" in config:
        config["id"] = str(config.pop("_id"))
    if config and "company_id" in config:
        config["company_id"] = str(config["company_id"])
    return config


# ── IRPP ─────────────────────────────────────────────────────────────────────

@router.get("/irpp")
async def get_irpp_config(
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)
    config = await get_active_config(company_id)
    return config.get("irpp", {})


@router.put("/irpp")
async def update_irpp_config(
    data: IRPPUpdate,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)
    config = await get_active_config(company_id)
    old_value = config.get("irpp", {})

    update_fields = {}
    update_data = data.dict(exclude_unset=True)
    reason = update_data.pop("reason", None)

    if "brackets" in update_data:
        update_fields["irpp.brackets"] = [b.dict() for b in data.brackets]
    for field in ["css_rate", "family_deduction_per_child", "max_children_deduction", "head_of_family_deduction"]:
        if field in update_data:
            update_fields[f"irpp.{field}"] = update_data[field]

    if not update_fields:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")

    update_fields["last_updated"] = datetime.now(timezone.utc)
    await db.hr_config.update_one(
        {"company_id": ObjectId(company_id)},
        {"$set": update_fields}
    )

    user_name = current_user.get("full_name", current_user.get("email", ""))
    await record_change(company_id, current_user["_id"], user_name, "irpp", old_value, update_data, reason)

    return {"message": "IRPP config updated successfully"}


# ── CNSS ─────────────────────────────────────────────────────────────────────

@router.get("/cnss")
async def get_cnss_config(
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)
    config = await get_active_config(company_id)
    return config.get("cnss", {})


@router.put("/cnss")
async def update_cnss_config(
    data: CNSSUpdate,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)
    config = await get_active_config(company_id)
    old_value = config.get("cnss", {})

    update_data = data.dict(exclude_unset=True)
    reason = update_data.pop("reason", None)
    update_fields = {f"cnss.{k}": v for k, v in update_data.items()}

    if not update_fields:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")

    update_fields["last_updated"] = datetime.now(timezone.utc)
    await db.hr_config.update_one(
        {"company_id": ObjectId(company_id)},
        {"$set": update_fields}
    )

    user_name = current_user.get("full_name", current_user.get("email", ""))
    await record_change(company_id, current_user["_id"], user_name, "cnss", old_value, update_data, reason)

    return {"message": "CNSS config updated successfully"}


# ── Parafiscal (TFP / FOPROLOS) ─────────────────────────────────────────────

@router.get("/parafiscal")
async def get_parafiscal_config(
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)
    config = await get_active_config(company_id)
    return config.get("parafiscal", {})


@router.put("/parafiscal")
async def update_parafiscal_config(
    data: ParafiscalUpdate,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)
    config = await get_active_config(company_id)
    old_value = config.get("parafiscal", {})

    update_data = data.dict(exclude_unset=True)
    reason = update_data.pop("reason", None)
    update_fields = {f"parafiscal.{k}": v for k, v in update_data.items()}

    if not update_fields:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")

    update_fields["last_updated"] = datetime.now(timezone.utc)
    await db.hr_config.update_one(
        {"company_id": ObjectId(company_id)},
        {"$set": update_fields}
    )

    user_name = current_user.get("full_name", current_user.get("email", ""))
    await record_change(company_id, current_user["_id"], user_name, "parafiscal", old_value, update_data, reason)

    return {"message": "Parafiscal config updated successfully"}


# ── Minimum Wages ────────────────────────────────────────────────────────────

@router.get("/minimum-wages")
async def get_minimum_wages(
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)
    config = await get_active_config(company_id)
    return config.get("minimum_wages", {})


@router.put("/minimum-wages")
async def update_minimum_wages(
    data: MinimumWagesUpdate,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)
    config = await get_active_config(company_id)
    old_value = config.get("minimum_wages", {})

    update_data = data.dict(exclude_unset=True)
    reason = update_data.pop("reason", None)
    update_fields = {f"minimum_wages.{k}": v for k, v in update_data.items()}

    if not update_fields:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")

    update_fields["last_updated"] = datetime.now(timezone.utc)
    await db.hr_config.update_one(
        {"company_id": ObjectId(company_id)},
        {"$set": update_fields}
    )

    user_name = current_user.get("full_name", current_user.get("email", ""))
    await record_change(company_id, current_user["_id"], user_name, "minimum_wages", old_value, update_data, reason)

    return {"message": "Minimum wages updated successfully"}


# ── Contract Types ───────────────────────────────────────────────────────────

@router.get("/contract-types")
async def get_contract_types(
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)
    config = await get_active_config(company_id)
    return config.get("contract_types", CONTRACT_TYPES)


@router.put("/contract-types/{code}")
async def toggle_contract_type(
    code: str,
    data: ContractTypeToggle,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)
    config = await get_active_config(company_id)
    contract_types = config.get("contract_types", [])

    found = False
    for ct in contract_types:
        if ct.get("code") == code:
            if data.is_active is not None:
                ct["is_active"] = data.is_active
            found = True
            break

    if not found:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contract type not found")

    await db.hr_config.update_one(
        {"company_id": ObjectId(company_id)},
        {"$set": {"contract_types": contract_types, "last_updated": datetime.now(timezone.utc)}}
    )

    user_name = current_user.get("full_name", current_user.get("email", ""))
    await record_change(company_id, current_user["_id"], user_name, "contract_types", code, {"is_active": data.is_active})

    return {"message": "Contract type updated"}


@router.post("/contract-types/custom", status_code=status.HTTP_201_CREATED)
async def add_custom_contract_type(
    data: CustomContractType,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)
    config = await get_active_config(company_id)
    contract_types = config.get("contract_types", [])

    # Check duplicate code
    if any(ct.get("code") == data.code for ct in contract_types):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Contract type code already exists")

    new_ct = data.dict()
    new_ct["is_active"] = True
    new_ct["is_custom"] = True
    contract_types.append(new_ct)

    await db.hr_config.update_one(
        {"company_id": ObjectId(company_id)},
        {"$set": {"contract_types": contract_types, "last_updated": datetime.now(timezone.utc)}}
    )

    user_name = current_user.get("full_name", current_user.get("email", ""))
    await record_change(company_id, current_user["_id"], user_name, "contract_types", None, new_ct, "Custom type added")

    return {"message": "Custom contract type added"}


@router.delete("/contract-types/custom/{code}")
async def remove_custom_contract_type(
    code: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)
    config = await get_active_config(company_id)
    contract_types = config.get("contract_types", [])

    original_len = len(contract_types)
    contract_types = [ct for ct in contract_types if not (ct.get("code") == code and ct.get("is_custom"))]

    if len(contract_types) == original_len:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Custom contract type not found")

    await db.hr_config.update_one(
        {"company_id": ObjectId(company_id)},
        {"$set": {"contract_types": contract_types, "last_updated": datetime.now(timezone.utc)}}
    )

    user_name = current_user.get("full_name", current_user.get("email", ""))
    await record_change(company_id, current_user["_id"], user_name, "contract_types", code, None, "Custom type removed")

    return {"message": "Custom contract type removed"}


# ── Leave Types ──────────────────────────────────────────────────────────────

@router.get("/leave-types")
async def get_leave_types(
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)
    config = await get_active_config(company_id)
    return config.get("leave_types", LEAVE_TYPES)


@router.put("/leave-types/{code}")
async def toggle_leave_type(
    code: str,
    data: LeaveTypeToggle,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)
    config = await get_active_config(company_id)
    leave_types = config.get("leave_types", [])

    found = False
    for lt in leave_types:
        if lt.get("code") == code:
            if data.is_active is not None:
                lt["is_active"] = data.is_active
            if data.max_days is not None:
                lt["max_days"] = data.max_days
            found = True
            break

    if not found:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave type not found")

    await db.hr_config.update_one(
        {"company_id": ObjectId(company_id)},
        {"$set": {"leave_types": leave_types, "last_updated": datetime.now(timezone.utc)}}
    )

    user_name = current_user.get("full_name", current_user.get("email", ""))
    await record_change(company_id, current_user["_id"], user_name, "leave_types", code, data.dict(exclude_unset=True))

    return {"message": "Leave type updated"}


@router.post("/leave-types/custom", status_code=status.HTTP_201_CREATED)
async def add_custom_leave_type(
    data: CustomLeaveType,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)
    config = await get_active_config(company_id)
    leave_types = config.get("leave_types", [])

    if any(lt.get("code") == data.code for lt in leave_types):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Leave type code already exists")

    new_lt = data.dict()
    new_lt["is_active"] = True
    new_lt["is_custom"] = True
    leave_types.append(new_lt)

    await db.hr_config.update_one(
        {"company_id": ObjectId(company_id)},
        {"$set": {"leave_types": leave_types, "last_updated": datetime.now(timezone.utc)}}
    )

    user_name = current_user.get("full_name", current_user.get("email", ""))
    await record_change(company_id, current_user["_id"], user_name, "leave_types", None, new_lt, "Custom leave type added")

    return {"message": "Custom leave type added"}


@router.delete("/leave-types/custom/{code}")
async def remove_custom_leave_type(
    code: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)
    config = await get_active_config(company_id)
    leave_types = config.get("leave_types", [])

    original_len = len(leave_types)
    leave_types = [lt for lt in leave_types if not (lt.get("code") == code and lt.get("is_custom"))]

    if len(leave_types) == original_len:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Custom leave type not found")

    await db.hr_config.update_one(
        {"company_id": ObjectId(company_id)},
        {"$set": {"leave_types": leave_types, "last_updated": datetime.now(timezone.utc)}}
    )

    user_name = current_user.get("full_name", current_user.get("email", ""))
    await record_change(company_id, current_user["_id"], user_name, "leave_types", code, None, "Custom leave type removed")

    return {"message": "Custom leave type removed"}


# ── Payroll Rubrics ──────────────────────────────────────────────────────────

@router.get("/rubrics")
async def get_rubrics(
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)
    config = await get_active_config(company_id)
    return config.get("rubrics", PAYROLL_RUBRICS)


@router.put("/rubrics/{code}")
async def toggle_rubric(
    code: str,
    data: RubricToggle,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)
    config = await get_active_config(company_id)
    rubrics = config.get("rubrics", [])

    found = False
    for r in rubrics:
        if r.get("code") == code:
            if data.is_active is not None:
                r["is_active"] = data.is_active
            found = True
            break

    if not found:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rubric not found")

    await db.hr_config.update_one(
        {"company_id": ObjectId(company_id)},
        {"$set": {"rubrics": rubrics, "last_updated": datetime.now(timezone.utc)}}
    )

    user_name = current_user.get("full_name", current_user.get("email", ""))
    await record_change(company_id, current_user["_id"], user_name, "rubrics", code, {"is_active": data.is_active})

    return {"message": "Rubric updated"}


@router.post("/rubrics/custom", status_code=status.HTTP_201_CREATED)
async def add_custom_rubric(
    data: CustomRubric,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)
    config = await get_active_config(company_id)
    rubrics = config.get("rubrics", [])

    if any(r.get("code") == data.code for r in rubrics):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Rubric code already exists")

    new_rubric = data.dict()
    new_rubric["is_active"] = True
    new_rubric["is_custom"] = True
    rubrics.append(new_rubric)

    await db.hr_config.update_one(
        {"company_id": ObjectId(company_id)},
        {"$set": {"rubrics": rubrics, "last_updated": datetime.now(timezone.utc)}}
    )

    user_name = current_user.get("full_name", current_user.get("email", ""))
    await record_change(company_id, current_user["_id"], user_name, "rubrics", None, new_rubric, "Custom rubric added")

    return {"message": "Custom rubric added"}


@router.delete("/rubrics/custom/{code}")
async def remove_custom_rubric(
    code: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)
    config = await get_active_config(company_id)
    rubrics = config.get("rubrics", [])

    original_len = len(rubrics)
    rubrics = [r for r in rubrics if not (r.get("code") == code and r.get("is_custom"))]

    if len(rubrics) == original_len:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Custom rubric not found")

    await db.hr_config.update_one(
        {"company_id": ObjectId(company_id)},
        {"$set": {"rubrics": rubrics, "last_updated": datetime.now(timezone.utc)}}
    )

    user_name = current_user.get("full_name", current_user.get("email", ""))
    await record_change(company_id, current_user["_id"], user_name, "rubrics", code, None, "Custom rubric removed")

    return {"message": "Custom rubric removed"}


# ── Accounting Config ────────────────────────────────────────────────────────

@router.get("/accounting")
async def get_accounting_config(
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)
    config = await get_active_config(company_id)
    return config.get("accounting", {})


@router.put("/accounting")
async def update_accounting_config(
    data: AccountingConfigUpdate,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)
    config = await get_active_config(company_id)
    old_value = config.get("accounting", {})

    update_data = data.dict(exclude_unset=True)
    reason = update_data.pop("reason", None)
    update_fields = {f"accounting.{k}": v for k, v in update_data.items()}

    if not update_fields:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")

    update_fields["last_updated"] = datetime.now(timezone.utc)
    await db.hr_config.update_one(
        {"company_id": ObjectId(company_id)},
        {"$set": update_fields}
    )

    user_name = current_user.get("full_name", current_user.get("email", ""))
    await record_change(company_id, current_user["_id"], user_name, "accounting", old_value, update_data, reason)

    return {"message": "Accounting config updated successfully"}


# ── Public Holidays ──────────────────────────────────────────────────────────

@router.get("/holidays")
async def get_holidays(
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)
    config = await get_active_config(company_id)
    return config.get("holidays", PUBLIC_HOLIDAYS)


@router.post("/holidays", status_code=status.HTTP_201_CREATED)
async def add_holiday(
    data: HolidayCreate,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)
    config = await get_active_config(company_id)
    holidays = config.get("holidays", [])

    new_holiday = data.dict()
    new_holiday["id"] = str(ObjectId())
    new_holiday["is_custom"] = True
    holidays.append(new_holiday)

    await db.hr_config.update_one(
        {"company_id": ObjectId(company_id)},
        {"$set": {"holidays": holidays, "last_updated": datetime.now(timezone.utc)}}
    )

    user_name = current_user.get("full_name", current_user.get("email", ""))
    await record_change(company_id, current_user["_id"], user_name, "holidays", None, new_holiday, "Holiday added")

    return {"message": "Holiday added", "id": new_holiday["id"]}


@router.delete("/holidays/{id}")
async def remove_holiday(
    id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)
    config = await get_active_config(company_id)
    holidays = config.get("holidays", [])

    original_len = len(holidays)
    holidays = [h for h in holidays if h.get("id") != id]

    if len(holidays) == original_len:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Holiday not found")

    await db.hr_config.update_one(
        {"company_id": ObjectId(company_id)},
        {"$set": {"holidays": holidays, "last_updated": datetime.now(timezone.utc)}}
    )

    user_name = current_user.get("full_name", current_user.get("email", ""))
    await record_change(company_id, current_user["_id"], user_name, "holidays", id, None, "Holiday removed")

    return {"message": "Holiday removed"}


# ── Finance Law Presets ──────────────────────────────────────────────────────

@router.get("/finance-laws")
async def get_finance_law_presets(
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)
    return FINANCE_LAW_PRESETS


@router.post("/finance-laws/apply/{code}")
async def apply_finance_law_preset(
    code: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)

    preset = None
    for p in FINANCE_LAW_PRESETS:
        if p.get("code") == code:
            preset = p
            break

    if not preset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Finance law preset not found")

    config = await get_active_config(company_id)
    old_irpp = config.get("irpp", {})
    old_cnss = config.get("cnss", {})
    old_parafiscal = config.get("parafiscal", {})
    old_minimum_wages = config.get("minimum_wages", {})

    update_fields = {}
    if "irpp" in preset:
        update_fields["irpp"] = preset["irpp"]
    if "cnss" in preset:
        update_fields["cnss"] = preset["cnss"]
    if "parafiscal" in preset:
        update_fields["parafiscal"] = preset["parafiscal"]
    if "minimum_wages" in preset:
        update_fields["minimum_wages"] = preset["minimum_wages"]

    update_fields["last_updated"] = datetime.now(timezone.utc)
    update_fields["applied_preset"] = code

    await db.hr_config.update_one(
        {"company_id": ObjectId(company_id)},
        {"$set": update_fields}
    )

    user_name = current_user.get("full_name", current_user.get("email", ""))
    await record_change(
        company_id, current_user["_id"], user_name, "finance_law",
        {"irpp": old_irpp, "cnss": old_cnss, "parafiscal": old_parafiscal, "minimum_wages": old_minimum_wages},
        {"preset_code": code, "preset_name": preset.get("name", "")},
        f"Applied finance law preset: {preset.get('name', code)}"
    )

    return {"message": f"Finance law preset '{preset.get('name', code)}' applied successfully"}


# ── Initialize / Reset ──────────────────────────────────────────────────────

@router.post("/initialize")
async def initialize_config(
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)

    existing = await db.hr_config.find_one({"company_id": ObjectId(company_id)})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Config already initialized. Use reset to restore defaults."
        )

    await initialize_default_config(company_id)

    return {"message": "HR config initialized with defaults"}


@router.post("/reset/{section}")
async def reset_section(
    section: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)

    defaults = {
        "irpp": None,
        "cnss": None,
        "parafiscal": None,
        "minimum_wages": None,
        "contract_types": CONTRACT_TYPES,
        "leave_types": LEAVE_TYPES,
        "rubrics": PAYROLL_RUBRICS,
        "holidays": PUBLIC_HOLIDAYS,
    }

    if section not in defaults:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unknown section: {section}")

    config = await get_active_config(company_id)
    old_value = config.get(section)

    # For sections without static defaults, re-initialize from preset
    if defaults[section] is None:
        default_config = {}
        for preset in FINANCE_LAW_PRESETS:
            if preset.get("code") == "LF_2025" or True:
                default_config = preset
                break
        reset_value = default_config.get(section, {})
    else:
        reset_value = defaults[section]

    await db.hr_config.update_one(
        {"company_id": ObjectId(company_id)},
        {"$set": {section: reset_value, "last_updated": datetime.now(timezone.utc)}}
    )

    user_name = current_user.get("full_name", current_user.get("email", ""))
    await record_change(company_id, current_user["_id"], user_name, section, old_value, "reset_to_defaults", "Section reset to defaults")

    return {"message": f"Section '{section}' reset to defaults"}


# ── Change History ───────────────────────────────────────────────────────────

@router.get("/history")
async def get_change_history(
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)
    config = await db.hr_config.find_one({"company_id": ObjectId(company_id)})
    if not config:
        return []

    history = config.get("change_history", [])
    # Serialize ObjectIds and datetimes
    for entry in history:
        if isinstance(entry.get("date"), datetime):
            entry["date"] = entry["date"].isoformat()
        if entry.get("user_id"):
            entry["user_id"] = str(entry["user_id"])

    return history


@router.get("/history/{section}")
async def get_section_history(
    section: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)
    config = await db.hr_config.find_one({"company_id": ObjectId(company_id)})
    if not config:
        return []

    history = config.get("change_history", [])
    filtered = [e for e in history if e.get("section") == section]

    for entry in filtered:
        if isinstance(entry.get("date"), datetime):
            entry["date"] = entry["date"].isoformat()
        if entry.get("user_id"):
            entry["user_id"] = str(entry["user_id"])

    return filtered
