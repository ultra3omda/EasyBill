from fastapi import APIRouter, HTTPException, status, Depends, Query
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime, timezone
from io import BytesIO
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


@router.get("/dashboard")
async def get_accounting_dashboard(company_id: str = Query(...), current_user: dict = Depends(get_current_user)):
    """Get accounting dashboard data with balances by account class"""
    company = await get_current_company(current_user, company_id)
    
    # Get balances grouped by account class (first digit of code)
    pipeline = [
        {"$match": {"company_id": ObjectId(company_id), "code": {"$regex": "^[1-7]$"}}},
        {"$project": {
            "code": 1,
            "name": 1,
            "type": 1,
            "balance": 1
        }}
    ]
    
    class_accounts = await db.chart_of_accounts.aggregate(pipeline).to_list(10)
    
    # Get totals by type
    type_pipeline = [
        {"$match": {"company_id": ObjectId(company_id)}},
        {"$group": {
            "_id": "$type",
            "total_balance": {"$sum": "$balance"},
            "count": {"$sum": 1}
        }}
    ]
    
    type_totals = await db.chart_of_accounts.aggregate(type_pipeline).to_list(10)
    type_map = {t["_id"]: {"balance": t["total_balance"], "count": t["count"]} for t in type_totals}
    
    # Get journal entry stats
    entry_pipeline = [
        {"$match": {"company_id": ObjectId(company_id), "status": "posted"}},
        {"$group": {
            "_id": None,
            "total_entries": {"$sum": 1},
            "total_debit": {"$sum": "$total_debit"},
            "total_credit": {"$sum": "$total_credit"}
        }}
    ]
    
    entry_stats = await db.journal_entries.aggregate(entry_pipeline).to_list(1)
    
    # Get recent entries
    recent_entries = await db.journal_entries.find(
        {"company_id": ObjectId(company_id)}
    ).sort("created_at", -1).limit(5).to_list(5)
    
    return {
        "classes": [
            {
                "code": a["code"],
                "name": a["name"],
                "type": a["type"],
                "balance": a.get("balance", 0)
            } for a in class_accounts
        ],
        "by_type": {
            "equity": type_map.get("equity", {"balance": 0, "count": 0}),
            "asset": type_map.get("asset", {"balance": 0, "count": 0}),
            "liability": type_map.get("liability", {"balance": 0, "count": 0}),
            "expense": type_map.get("expense", {"balance": 0, "count": 0}),
            "income": type_map.get("income", {"balance": 0, "count": 0})
        },
        "entries": {
            "total": entry_stats[0]["total_entries"] if entry_stats else 0,
            "total_debit": entry_stats[0]["total_debit"] if entry_stats else 0,
            "total_credit": entry_stats[0]["total_credit"] if entry_stats else 0
        },
        "recent_entries": [
            {
                "id": str(e["_id"]),
                "entry_number": e.get("entry_number"),
                "date": e.get("date").isoformat() if e.get("date") else None,
                "description": e.get("description"),
                "total_debit": e.get("total_debit", 0),
                "status": e.get("status")
            } for e in recent_entries
        ]
    }


@router.get("/general-ledger")
async def get_general_ledger(
    company_id: str = Query(...),
    account_code: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get general ledger (grand livre) - transactions by account"""
    company = await get_current_company(current_user, company_id)
    
    # Build query for journal entries
    query = {"company_id": ObjectId(company_id), "status": "posted"}
    
    if date_from:
        query["date"] = {"$gte": datetime.fromisoformat(date_from)}
    if date_to:
        if "date" in query:
            query["date"]["$lte"] = datetime.fromisoformat(date_to)
        else:
            query["date"] = {"$lte": datetime.fromisoformat(date_to)}
    
    if account_code:
        query["lines.account_code"] = account_code
    
    entries = await db.journal_entries.find(query).sort("date", 1).to_list(2000)
    
    # Group by account
    ledger = {}
    for entry in entries:
        for line in entry.get("lines", []):
            code = line.get("account_code")
            if account_code and code != account_code:
                continue
            
            if code not in ledger:
                ledger[code] = {
                    "account_code": code,
                    "account_name": line.get("account_name"),
                    "transactions": [],
                    "total_debit": 0,
                    "total_credit": 0,
                    "balance": 0
                }
            
            debit = line.get("debit", 0)
            credit = line.get("credit", 0)
            
            ledger[code]["transactions"].append({
                "entry_id": str(entry["_id"]),
                "entry_number": entry.get("entry_number"),
                "date": entry.get("date").isoformat() if entry.get("date") else None,
                "description": entry.get("description"),
                "line_description": line.get("description"),
                "debit": debit,
                "credit": credit
            })
            
            ledger[code]["total_debit"] += debit
            ledger[code]["total_credit"] += credit
    
    # Calculate running balances and get account types
    result = []
    for code, data in sorted(ledger.items()):
        # Get account type
        account = await db.chart_of_accounts.find_one({
            "company_id": ObjectId(company_id),
            "code": code
        })
        
        account_type = account.get("type") if account else "asset"
        
        # Calculate balance based on account type
        if account_type in ["asset", "expense"]:
            data["balance"] = data["total_debit"] - data["total_credit"]
        else:
            data["balance"] = data["total_credit"] - data["total_debit"]
        
        data["account_type"] = account_type
        result.append(data)
    
    return result


@router.get("/trial-balance")
async def get_trial_balance(
    company_id: str = Query(...),
    date_to: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get trial balance (balance des comptes)"""
    company = await get_current_company(current_user, company_id)
    
    # Get all accounts with their balances
    accounts = await db.chart_of_accounts.find({
        "company_id": ObjectId(company_id),
        "is_group": False  # Only detail accounts
    }).sort("code", 1).to_list(2000)
    
    # Calculate balances from journal entries if date filter is provided
    if date_to:
        query = {
            "company_id": ObjectId(company_id),
            "status": "posted",
            "date": {"$lte": datetime.fromisoformat(date_to)}
        }
        
        entries = await db.journal_entries.find(query).to_list(5000)
        
        # Recalculate balances
        account_balances = {}
        for entry in entries:
            for line in entry.get("lines", []):
                code = line.get("account_code")
                if code not in account_balances:
                    account_balances[code] = {"debit": 0, "credit": 0}
                account_balances[code]["debit"] += line.get("debit", 0)
                account_balances[code]["credit"] += line.get("credit", 0)
        
        balance_data = []
        total_debit = 0
        total_credit = 0
        
        for account in accounts:
            code = account["code"]
            bal = account_balances.get(code, {"debit": 0, "credit": 0})
            
            account_type = account.get("type")
            if account_type in ["asset", "expense"]:
                balance = bal["debit"] - bal["credit"]
                debit_balance = balance if balance > 0 else 0
                credit_balance = -balance if balance < 0 else 0
            else:
                balance = bal["credit"] - bal["debit"]
                credit_balance = balance if balance > 0 else 0
                debit_balance = -balance if balance < 0 else 0
            
            if debit_balance != 0 or credit_balance != 0:
                balance_data.append({
                    "code": code,
                    "name": account.get("name"),
                    "type": account_type,
                    "debit": debit_balance,
                    "credit": credit_balance
                })
                total_debit += debit_balance
                total_credit += credit_balance
    else:
        # Use current balances from accounts
        balance_data = []
        total_debit = 0
        total_credit = 0
        
        for account in accounts:
            balance = account.get("balance", 0)
            account_type = account.get("type")
            
            if balance != 0:
                if account_type in ["asset", "expense"]:
                    debit_balance = balance if balance > 0 else 0
                    credit_balance = -balance if balance < 0 else 0
                else:
                    credit_balance = balance if balance > 0 else 0
                    debit_balance = -balance if balance < 0 else 0
                
                balance_data.append({
                    "code": account["code"],
                    "name": account.get("name"),
                    "type": account_type,
                    "debit": debit_balance,
                    "credit": credit_balance
                })
                total_debit += debit_balance
                total_credit += credit_balance
    
    return {
        "accounts": balance_data,
        "totals": {
            "debit": total_debit,
            "credit": total_credit,
            "balanced": abs(total_debit - total_credit) < 0.01
        },
        "date": date_to
    }


@router.get("/trial-balance/export/excel")
async def export_trial_balance_excel(
    company_id: str = Query(...),
    date_to: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Exporte la balance des comptes en Excel"""
    from fastapi.responses import StreamingResponse
    from services.accounting_reports_service import accounting_reports_service
    
    company = await get_current_company(current_user, company_id)
    
    date_to_dt = datetime.fromisoformat(date_to) if date_to else None
    
    excel_data = await accounting_reports_service.generate_trial_balance_excel(
        company_id=company_id,
        date_to=date_to_dt
    )
    
    filename = f"Balance_Comptes_{company.get('name', 'EasyBill')}_{datetime.now().strftime('%Y%m%d')}.xlsx"
    
    return StreamingResponse(
        BytesIO(excel_data),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/general-ledger/export/excel")
async def export_general_ledger_excel(
    company_id: str = Query(...),
    account_code: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Exporte le grand livre en Excel"""
    from fastapi.responses import StreamingResponse
    from services.accounting_reports_service import accounting_reports_service
    
    company = await get_current_company(current_user, company_id)
    
    date_from_dt = datetime.fromisoformat(date_from) if date_from else None
    date_to_dt = datetime.fromisoformat(date_to) if date_to else None
    
    excel_data = await accounting_reports_service.generate_general_ledger_excel(
        company_id=company_id,
        account_code=account_code,
        date_from=date_from_dt,
        date_to=date_to_dt
    )
    
    filename = f"Grand_Livre_{company.get('name', 'EasyBill')}_{datetime.now().strftime('%Y%m%d')}.xlsx"
    
    return StreamingResponse(
        BytesIO(excel_data),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/auxiliary-ledger/export/excel")
async def export_auxiliary_ledger_excel(
    company_id: str = Query(...),
    ledger_type: str = Query(...),  # 'customers' or 'suppliers'
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Exporte le livre de tiers (clients ou fournisseurs) en Excel"""
    from fastapi.responses import StreamingResponse
    from services.accounting_reports_service import accounting_reports_service
    
    company = await get_current_company(current_user, company_id)
    
    date_from_dt = datetime.fromisoformat(date_from) if date_from else None
    date_to_dt = datetime.fromisoformat(date_to) if date_to else None
    
    excel_data = await accounting_reports_service.generate_auxiliary_ledger_excel(
        company_id=company_id,
        ledger_type=ledger_type,
        date_from=date_from_dt,
        date_to=date_to_dt
    )
    
    type_label = "Clients" if ledger_type == "customers" else "Fournisseurs"
    filename = f"Livre_{type_label}_{company.get('name', 'EasyBill')}_{datetime.now().strftime('%Y%m%d')}.xlsx"
    
    return StreamingResponse(
        BytesIO(excel_data),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

                total_debit += debit_balance
                total_credit += credit_balance
    
    return {
        "accounts": balance_data,
        "totals": {
            "debit": total_debit,
            "credit": total_credit,
            "balanced": abs(total_debit - total_credit) < 0.01
        },
        "date": date_to
    }
