from fastapi import APIRouter, HTTPException, status, Depends, Query
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime, timezone
import os
from typing import Optional, List
from pydantic import BaseModel
from utils.dependencies import get_current_user, get_current_company

router = APIRouter(prefix="/api/accounting", tags=["Accounting"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]


class AccountCreate(BaseModel):
    code: str
    name: str
    type: str  # asset, liability, equity, income, expense
    parent_code: Optional[str] = None
    is_group: bool = False
    notes: Optional[str] = None


class AccountUpdate(BaseModel):
    name: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


def serialize_account(a: dict) -> dict:
    return {
        "id": str(a["_id"]),
        "company_id": str(a.get("company_id")) if a.get("company_id") else None,
        "code": a.get("code"),
        "name": a.get("name"),
        "type": a.get("type"),
        "parent_code": a.get("parent_code"),
        "is_group": a.get("is_group", False),
        "is_system": a.get("is_system", False),
        "is_active": a.get("is_active", True),
        "balance": a.get("balance", 0),
        "notes": a.get("notes"),
        "level": len(a.get("code", "")) // 2 if a.get("code") else 0
    }


@router.get("/accounts")
async def list_accounts(company_id: str = Query(...), type_filter: Optional[str] = Query(None, alias="type"), search: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    company = await get_current_company(current_user, company_id)
    
    query = {"company_id": ObjectId(company_id)}
    if type_filter:
        query["type"] = type_filter
    if search:
        query["$or"] = [
            {"code": {"$regex": search, "$options": "i"}},
            {"name": {"$regex": search, "$options": "i"}}
        ]
    
    accounts = await db.chart_of_accounts.find(query).sort("code", 1).to_list(2000)
    return [serialize_account(a) for a in accounts]


@router.get("/accounts/{account_id}")
async def get_account(account_id: str, company_id: str = Query(...), current_user: dict = Depends(get_current_user)):
    company = await get_current_company(current_user, company_id)
    account = await db.chart_of_accounts.find_one({"_id": ObjectId(account_id), "company_id": ObjectId(company_id)})
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    return serialize_account(account)


@router.post("/accounts", status_code=status.HTTP_201_CREATED)
async def create_account(data: AccountCreate, company_id: str = Query(...), current_user: dict = Depends(get_current_user)):
    company = await get_current_company(current_user, company_id)
    
    # Check if code already exists
    existing = await db.chart_of_accounts.find_one({"company_id": ObjectId(company_id), "code": data.code})
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Account code already exists")
    
    account_dict = data.dict()
    account_dict.update({
        "company_id": ObjectId(company_id),
        "is_system": False,
        "is_active": True,
        "balance": 0,
        "created_at": datetime.now(timezone.utc)
    })
    
    result = await db.chart_of_accounts.insert_one(account_dict)
    return {"id": str(result.inserted_id), "message": "Account created"}


@router.put("/accounts/{account_id}")
async def update_account(account_id: str, data: AccountUpdate, company_id: str = Query(...), current_user: dict = Depends(get_current_user)):
    company = await get_current_company(current_user, company_id)
    
    account = await db.chart_of_accounts.find_one({"_id": ObjectId(account_id)})
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    
    if account.get("is_system"):
        # Only allow updating notes for system accounts
        update_data = {}
        if data.notes is not None:
            update_data["notes"] = data.notes
    else:
        update_data = {k: v for k, v in data.dict(exclude_unset=True).items()}
    
    if update_data:
        await db.chart_of_accounts.update_one({"_id": ObjectId(account_id)}, {"$set": update_data})
    
    return {"message": "Account updated"}


@router.delete("/accounts/{account_id}")
async def delete_account(account_id: str, company_id: str = Query(...), current_user: dict = Depends(get_current_user)):
    company = await get_current_company(current_user, company_id)
    
    account = await db.chart_of_accounts.find_one({"_id": ObjectId(account_id), "company_id": ObjectId(company_id)})
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    
    if account.get("is_system"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete system account")
    
    # Check if account has entries
    entries_count = await db.journal_entries.count_documents({"$or": [{"debit_account": account["code"]}, {"credit_account": account["code"]}], "company_id": ObjectId(company_id)})
    if entries_count > 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete account with journal entries")
    
    await db.chart_of_accounts.delete_one({"_id": ObjectId(account_id)})
    return {"message": "Account deleted"}


@router.get("/account-types")
async def get_account_types():
    """Get available account types with their class codes"""
    return [
        {"code": "1", "type": "equity", "name": "Comptes de capitaux propres et passifs non courants"},
        {"code": "2", "type": "asset", "name": "Comptes d'actifs non courants"},
        {"code": "3", "type": "asset", "name": "Comptes de stocks"},
        {"code": "4", "type": "liability", "name": "Comptes de tiers"},
        {"code": "5", "type": "asset", "name": "Comptes financiers"},
        {"code": "6", "type": "expense", "name": "Comptes de charges"},
        {"code": "7", "type": "income", "name": "Comptes de produits"}
    ]


@router.post("/seed-chart-of-accounts")
async def seed_chart_of_accounts(company_id: str = Query(...), current_user: dict = Depends(get_current_user)):
    """Seed the Tunisian chart of accounts for an existing company (if not already seeded)."""
    from data.tunisian_chart_of_accounts import TUNISIAN_CHART_OF_ACCOUNTS
    
    company = await get_current_company(current_user, company_id)
    
    # Check if already seeded
    existing_count = await db.chart_of_accounts.count_documents({"company_id": ObjectId(company_id)})
    if existing_count > 0:
        return {"message": f"Plan comptable déjà présent ({existing_count} comptes)", "count": existing_count, "seeded": False}
    
    # Seed the chart of accounts
    now = datetime.now(timezone.utc)
    accounts_to_insert = []
    
    for account in TUNISIAN_CHART_OF_ACCOUNTS:
        account_doc = {
            "code": account["code"],
            "name": account["name"],
            "type": account["type"],
            "is_group": account.get("is_group", False),
            "parent_code": account.get("parent_code"),
            "company_id": ObjectId(company_id),
            "is_system": True,
            "is_active": True,
            "balance": 0.0,
            "created_at": now
        }
        accounts_to_insert.append(account_doc)
    
    if accounts_to_insert:
        await db.chart_of_accounts.insert_many(accounts_to_insert)
    
    # Log action
    user_name = current_user.get("full_name", current_user.get("email", ""))
    await db.access_logs.insert_one({
        "company_id": ObjectId(company_id),
        "user_id": current_user["_id"],
        "user_name": user_name,
        "category": "Plan comptable",
        "action": "Seed",
        "element": f"Plan comptable tunisien ({len(accounts_to_insert)} comptes)",
        "created_at": now
    })
    
    return {"message": f"Plan comptable tunisien créé avec succès", "count": len(accounts_to_insert), "seeded": True}
