"""
Routes API pour le Module Trésorerie
Suivi des flux de trésorerie, prévisions et rapports
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from pydantic import BaseModel
from enum import Enum
import os
import logging

from utils.dependencies import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/treasury", tags=["Treasury"])

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'easybill')]


class TransactionType(str, Enum):
    INCOME = "income"  # Entrée
    EXPENSE = "expense"  # Sortie
    TRANSFER = "transfer"  # Virement interne


class TransactionCategory(str, Enum):
    CUSTOMER_PAYMENT = "customer_payment"
    SUPPLIER_PAYMENT = "supplier_payment"
    SALARY = "salary"
    TAX = "tax"
    BANK_FEE = "bank_fee"
    LOAN = "loan"
    INVESTMENT = "investment"
    OTHER = "other"


class BankAccountCreate(BaseModel):
    name: str
    bank_name: str
    account_number: Optional[str] = None
    iban: Optional[str] = None
    bic: Optional[str] = None
    initial_balance: float = 0
    currency: str = "TND"
    is_default: bool = False


class BankAccountUpdate(BaseModel):
    name: Optional[str] = None
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    iban: Optional[str] = None
    bic: Optional[str] = None
    currency: Optional[str] = None
    is_default: Optional[bool] = None
    is_active: Optional[bool] = None


class CashFlowEntryCreate(BaseModel):
    date: Optional[datetime] = None
    type: TransactionType
    category: TransactionCategory
    amount: float
    description: str
    bank_account_id: str
    reference: Optional[str] = None
    related_document_type: Optional[str] = None  # invoice, payment, expense
    related_document_id: Optional[str] = None


class CashFlowForecastCreate(BaseModel):
    date: datetime
    type: TransactionType
    category: TransactionCategory
    amount: float
    description: str
    probability: float = 100  # Probabilité de réalisation (%)
    is_recurring: bool = False
    recurrence_frequency: Optional[str] = None  # weekly, monthly, yearly


# ==================== BANK ACCOUNTS ====================

@router.get("/bank-accounts")
async def list_bank_accounts(
    company_id: str = Query(...),
    include_inactive: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """Liste tous les comptes bancaires"""
    
    query = {"company_id": ObjectId(company_id)}
    if not include_inactive:
        query["is_active"] = True
    
    accounts = await db.bank_accounts.find(query).sort("is_default", -1).to_list(None)
    
    for account in accounts:
        account["id"] = str(account["_id"])
        # Calculer le solde actuel
        balance = await calculate_account_balance(str(account["_id"]), company_id)
        account["current_balance"] = balance
    
    return {"items": accounts}


@router.post("/bank-accounts")
async def create_bank_account(
    account: BankAccountCreate,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Crée un nouveau compte bancaire"""
    
    # Si c'est le compte par défaut, retirer le défaut des autres
    if account.is_default:
        await db.bank_accounts.update_many(
            {"company_id": ObjectId(company_id)},
            {"$set": {"is_default": False}}
        )
    
    account_data = {
        **account.dict(),
        "company_id": ObjectId(company_id),
        "is_active": True,
        "created_by": ObjectId(current_user["id"]),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    result = await db.bank_accounts.insert_one(account_data)
    
    # Créer l'entrée de solde initial si > 0
    if account.initial_balance != 0:
        entry_type = "income" if account.initial_balance > 0 else "expense"
        await db.cash_flow_entries.insert_one({
            "date": datetime.now(timezone.utc),
            "type": entry_type,
            "category": "other",
            "amount": abs(account.initial_balance),
            "description": "Solde initial",
            "bank_account_id": result.inserted_id,
            "company_id": ObjectId(company_id),
            "created_by": ObjectId(current_user["id"]),
            "created_at": datetime.now(timezone.utc)
        })
    
    return {
        "id": str(result.inserted_id),
        "message": "Compte bancaire créé avec succès"
    }


@router.put("/bank-accounts/{account_id}")
async def update_bank_account(
    account_id: str,
    account: BankAccountUpdate,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Met à jour un compte bancaire"""
    
    existing = await db.bank_accounts.find_one({
        "_id": ObjectId(account_id),
        "company_id": ObjectId(company_id)
    })
    
    if not existing:
        raise HTTPException(status_code=404, detail="Compte bancaire non trouvé")
    
    update_data = {k: v for k, v in account.dict().items() if v is not None}
    
    if update_data.get("is_default"):
        await db.bank_accounts.update_many(
            {"company_id": ObjectId(company_id)},
            {"$set": {"is_default": False}}
        )
    
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.bank_accounts.update_one(
        {"_id": ObjectId(account_id)},
        {"$set": update_data}
    )
    
    return {"message": "Compte bancaire mis à jour avec succès"}


@router.delete("/bank-accounts/{account_id}")
async def delete_bank_account(
    account_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Désactive un compte bancaire (soft delete)"""
    
    existing = await db.bank_accounts.find_one({
        "_id": ObjectId(account_id),
        "company_id": ObjectId(company_id)
    })
    
    if not existing:
        raise HTTPException(status_code=404, detail="Compte bancaire non trouvé")
    
    await db.bank_accounts.update_one(
        {"_id": ObjectId(account_id)},
        {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc)}}
    )
    
    return {"message": "Compte bancaire désactivé avec succès"}


# ==================== CASH FLOW ENTRIES ====================

async def calculate_account_balance(account_id: str, company_id: str) -> float:
    """Calcule le solde actuel d'un compte"""
    
    pipeline = [
        {"$match": {
            "bank_account_id": ObjectId(account_id),
            "company_id": ObjectId(company_id)
        }},
        {"$group": {
            "_id": "$type",
            "total": {"$sum": "$amount"}
        }}
    ]
    
    results = await db.cash_flow_entries.aggregate(pipeline).to_list(None)
    
    balance = 0
    for r in results:
        if r["_id"] == "income":
            balance += r["total"]
        elif r["_id"] == "expense":
            balance -= r["total"]
    
    return round(balance, 3)


@router.get("/cash-flow")
async def list_cash_flow_entries(
    company_id: str = Query(...),
    bank_account_id: Optional[str] = None,
    type: Optional[str] = None,
    category: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Liste les mouvements de trésorerie"""
    
    query = {"company_id": ObjectId(company_id)}
    
    if bank_account_id:
        query["bank_account_id"] = ObjectId(bank_account_id)
    if type:
        query["type"] = type
    if category:
        query["category"] = category
    if start_date:
        query["date"] = {"$gte": start_date}
    if end_date:
        query.setdefault("date", {})["$lte"] = end_date
    
    entries = await db.cash_flow_entries.find(query).sort("date", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.cash_flow_entries.count_documents(query)
    
    for entry in entries:
        entry["id"] = str(entry["_id"])
        if entry.get("bank_account_id"):
            account = await db.bank_accounts.find_one({"_id": entry["bank_account_id"]})
            entry["bank_account_name"] = account.get("name") if account else None
    
    return {
        "items": entries,
        "total": total,
        "skip": skip,
        "limit": limit
    }


@router.post("/cash-flow")
async def create_cash_flow_entry(
    entry: CashFlowEntryCreate,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Crée un nouveau mouvement de trésorerie"""
    
    # Vérifier que le compte existe
    account = await db.bank_accounts.find_one({
        "_id": ObjectId(entry.bank_account_id),
        "company_id": ObjectId(company_id)
    })
    
    if not account:
        raise HTTPException(status_code=404, detail="Compte bancaire non trouvé")
    
    entry_data = {
        "date": entry.date or datetime.now(timezone.utc),
        "type": entry.type.value,
        "category": entry.category.value,
        "amount": abs(entry.amount),
        "description": entry.description,
        "bank_account_id": ObjectId(entry.bank_account_id),
        "reference": entry.reference,
        "related_document_type": entry.related_document_type,
        "related_document_id": ObjectId(entry.related_document_id) if entry.related_document_id else None,
        "company_id": ObjectId(company_id),
        "created_by": ObjectId(current_user["id"]),
        "created_at": datetime.now(timezone.utc)
    }
    
    result = await db.cash_flow_entries.insert_one(entry_data)
    
    return {
        "id": str(result.inserted_id),
        "message": "Mouvement de trésorerie créé avec succès"
    }


# ==================== DASHBOARD & REPORTS ====================

@router.get("/dashboard")
async def get_treasury_dashboard(
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Tableau de bord de la trésorerie"""
    
    now = datetime.now(timezone.utc)
    start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    start_of_year = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    
    # Soldes des comptes
    accounts = await db.bank_accounts.find({
        "company_id": ObjectId(company_id),
        "is_active": True
    }).to_list(None)
    
    total_balance = 0
    accounts_summary = []
    for account in accounts:
        balance = await calculate_account_balance(str(account["_id"]), company_id)
        total_balance += balance
        accounts_summary.append({
            "id": str(account["_id"]),
            "name": account.get("name"),
            "bank_name": account.get("bank_name"),
            "balance": balance,
            "currency": account.get("currency", "TND")
        })
    
    # Flux du mois
    pipeline_month = [
        {"$match": {
            "company_id": ObjectId(company_id),
            "date": {"$gte": start_of_month}
        }},
        {"$group": {
            "_id": "$type",
            "total": {"$sum": "$amount"}
        }}
    ]
    
    month_flows = await db.cash_flow_entries.aggregate(pipeline_month).to_list(None)
    month_income = sum(f["total"] for f in month_flows if f["_id"] == "income")
    month_expense = sum(f["total"] for f in month_flows if f["_id"] == "expense")
    
    # Flux de l'année
    pipeline_year = [
        {"$match": {
            "company_id": ObjectId(company_id),
            "date": {"$gte": start_of_year}
        }},
        {"$group": {
            "_id": "$type",
            "total": {"$sum": "$amount"}
        }}
    ]
    
    year_flows = await db.cash_flow_entries.aggregate(pipeline_year).to_list(None)
    year_income = sum(f["total"] for f in year_flows if f["_id"] == "income")
    year_expense = sum(f["total"] for f in year_flows if f["_id"] == "expense")
    
    # Factures en attente de paiement
    pending_invoices = await db.invoices.aggregate([
        {"$match": {
            "company_id": ObjectId(company_id),
            "status": {"$in": ["sent", "overdue"]}
        }},
        {"$group": {
            "_id": None,
            "total": {"$sum": "$total"},
            "count": {"$sum": 1}
        }}
    ]).to_list(None)
    
    pending_receivables = pending_invoices[0] if pending_invoices else {"total": 0, "count": 0}
    
    # Factures fournisseurs en attente
    pending_supplier_invoices = await db.supplier_invoices.aggregate([
        {"$match": {
            "company_id": ObjectId(company_id),
            "status": {"$in": ["validated", "overdue"]}
        }},
        {"$group": {
            "_id": None,
            "total": {"$sum": "$total"},
            "count": {"$sum": 1}
        }}
    ]).to_list(None)
    
    pending_payables = pending_supplier_invoices[0] if pending_supplier_invoices else {"total": 0, "count": 0}
    
    return {
        "total_balance": total_balance,
        "accounts": accounts_summary,
        "month": {
            "income": month_income,
            "expense": month_expense,
            "net": month_income - month_expense
        },
        "year": {
            "income": year_income,
            "expense": year_expense,
            "net": year_income - year_expense
        },
        "pending_receivables": {
            "amount": pending_receivables.get("total", 0),
            "count": pending_receivables.get("count", 0)
        },
        "pending_payables": {
            "amount": pending_payables.get("total", 0),
            "count": pending_payables.get("count", 0)
        },
        "net_position": total_balance + pending_receivables.get("total", 0) - pending_payables.get("total", 0)
    }


@router.get("/forecast")
async def get_cash_flow_forecast(
    company_id: str = Query(...),
    days: int = Query(30, ge=7, le=365),
    current_user: dict = Depends(get_current_user)
):
    """Prévisions de trésorerie"""
    
    now = datetime.now(timezone.utc)
    end_date = now + timedelta(days=days)
    
    # Solde actuel
    accounts = await db.bank_accounts.find({
        "company_id": ObjectId(company_id),
        "is_active": True
    }).to_list(None)
    
    current_balance = 0
    for account in accounts:
        balance = await calculate_account_balance(str(account["_id"]), company_id)
        current_balance += balance
    
    # Prévisions d'encaissements (factures en attente)
    expected_income = await db.invoices.aggregate([
        {"$match": {
            "company_id": ObjectId(company_id),
            "status": {"$in": ["sent", "overdue"]},
            "due_date": {"$lte": end_date}
        }},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$due_date"}},
            "total": {"$sum": "$total"},
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ]).to_list(None)
    
    # Prévisions de décaissements (factures fournisseurs en attente)
    expected_expense = await db.supplier_invoices.aggregate([
        {"$match": {
            "company_id": ObjectId(company_id),
            "status": {"$in": ["validated", "overdue"]},
            "due_date": {"$lte": end_date}
        }},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$due_date"}},
            "total": {"$sum": "$total"},
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ]).to_list(None)
    
    # Construire la prévision jour par jour
    forecast = []
    running_balance = current_balance
    
    for i in range(days):
        date = now + timedelta(days=i)
        date_str = date.strftime("%Y-%m-%d")
        
        day_income = next((e["total"] for e in expected_income if e["_id"] == date_str), 0)
        day_expense = next((e["total"] for e in expected_expense if e["_id"] == date_str), 0)
        
        running_balance = running_balance + day_income - day_expense
        
        forecast.append({
            "date": date_str,
            "income": day_income,
            "expense": day_expense,
            "balance": running_balance
        })
    
    return {
        "current_balance": current_balance,
        "forecast_end_balance": running_balance,
        "total_expected_income": sum(e["total"] for e in expected_income),
        "total_expected_expense": sum(e["total"] for e in expected_expense),
        "daily_forecast": forecast
    }


@router.get("/report/monthly")
async def get_monthly_report(
    company_id: str = Query(...),
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    current_user: dict = Depends(get_current_user)
):
    """Rapport mensuel de trésorerie"""
    
    start_date = datetime(year, month, 1, tzinfo=timezone.utc)
    if month == 12:
        end_date = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        end_date = datetime(year, month + 1, 1, tzinfo=timezone.utc)
    
    # Flux par catégorie
    pipeline = [
        {"$match": {
            "company_id": ObjectId(company_id),
            "date": {"$gte": start_date, "$lt": end_date}
        }},
        {"$group": {
            "_id": {"type": "$type", "category": "$category"},
            "total": {"$sum": "$amount"},
            "count": {"$sum": 1}
        }}
    ]
    
    results = await db.cash_flow_entries.aggregate(pipeline).to_list(None)
    
    income_by_category = {}
    expense_by_category = {}
    total_income = 0
    total_expense = 0
    
    for r in results:
        category = r["_id"]["category"]
        amount = r["total"]
        
        if r["_id"]["type"] == "income":
            income_by_category[category] = amount
            total_income += amount
        else:
            expense_by_category[category] = amount
            total_expense += amount
    
    return {
        "year": year,
        "month": month,
        "income": {
            "total": total_income,
            "by_category": income_by_category
        },
        "expense": {
            "total": total_expense,
            "by_category": expense_by_category
        },
        "net": total_income - total_expense
    }
