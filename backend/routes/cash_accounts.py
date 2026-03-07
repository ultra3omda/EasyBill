"""
Module A - Cash-First Payment Model
Gestion des comptes caisse, paiements en espèces, soldes clients, rapport journalier.
Étend le flux paiement existant sans le modifier.
"""

from fastapi import APIRouter, HTTPException, status, Depends, Query, Request
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime, timezone, date, timedelta
from typing import Optional, List
from pydantic import BaseModel, Field
from enum import Enum
import os
import logging

from utils.dependencies import get_current_user, get_current_company

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/cash", tags=["Cash Accounts"])

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'easybill')]


# ─────────────────────────────────────────────
# Enums & Schemas
# ─────────────────────────────────────────────

class PaymentMethod(str, Enum):
    CASH = "cash"
    BANK_TRANSFER = "bank_transfer"
    CHECK = "check"
    MOBILE_MONEY = "mobile_money"
    AGENT = "agent"
    CARD = "card"
    OTHER = "other"


class CashAccountCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    currency: str = "TND"
    initial_balance: float = 0.0
    is_default: bool = False
    description: Optional[str] = None


class CashAccountUpdate(BaseModel):
    name: Optional[str] = None
    currency: Optional[str] = None
    is_default: Optional[bool] = None
    description: Optional[str] = None


class CashPaymentCreate(BaseModel):
    """Enregistrement d'un encaissement ou décaissement en espèces."""
    cash_account_id: str
    type: str = Field("in", description="'in' = encaissement, 'out' = décaissement")
    amount: float = Field(..., gt=0)
    date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    payment_method: PaymentMethod = PaymentMethod.CASH
    customer_id: Optional[str] = None
    supplier_id: Optional[str] = None
    invoice_id: Optional[str] = None      # facture cliente liée
    supplier_invoice_id: Optional[str] = None
    label: str = Field(..., min_length=1)  # ex: "Paiement facture F-2025-001"
    reference: Optional[str] = None
    notes: Optional[str] = None


class CashExpenseCreate(BaseModel):
    """Dépense payée en espèces (sans facture fournisseur)."""
    cash_account_id: str
    amount: float = Field(..., gt=0)
    date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    category: str = "divers"             # loyer, transport, repas, fournitures…
    label: str
    reference: Optional[str] = None
    notes: Optional[str] = None


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

def _ser_account(a: dict) -> dict:
    return {
        "id": str(a["_id"]),
        "company_id": str(a.get("company_id", "")),
        "name": a.get("name"),
        "currency": a.get("currency", "TND"),
        "balance": a.get("balance", 0.0),
        "initial_balance": a.get("initial_balance", 0.0),
        "is_default": a.get("is_default", False),
        "description": a.get("description"),
        "created_at": a["created_at"].isoformat() if isinstance(a.get("created_at"), datetime) else a.get("created_at"),
    }


def _ser_transaction(t: dict) -> dict:
    return {
        "id": str(t["_id"]),
        "cash_account_id": str(t.get("cash_account_id", "")),
        "company_id": str(t.get("company_id", "")),
        "type": t.get("type"),
        "amount": t.get("amount", 0),
        "payment_method": t.get("payment_method", "cash"),
        "label": t.get("label"),
        "reference": t.get("reference"),
        "date": t["date"].isoformat() if isinstance(t.get("date"), datetime) else t.get("date"),
        "customer_id": str(t["customer_id"]) if t.get("customer_id") else None,
        "customer_name": t.get("customer_name"),
        "supplier_id": str(t["supplier_id"]) if t.get("supplier_id") else None,
        "invoice_id": str(t["invoice_id"]) if t.get("invoice_id") else None,
        "category": t.get("category"),
        "notes": t.get("notes"),
        "balance_after": t.get("balance_after", 0),
        "created_at": t["created_at"].isoformat() if isinstance(t.get("created_at"), datetime) else t.get("created_at"),
    }


async def _get_cash_account(account_id: str, company_id: str) -> dict:
    acc = await db.cash_accounts.find_one({
        "_id": ObjectId(account_id),
        "company_id": ObjectId(company_id)
    })
    if not acc:
        raise HTTPException(status_code=404, detail="Compte caisse introuvable")
    return acc


async def _update_account_balance(account_id: str, delta: float):
    """Ajoute delta (positif=entrée, négatif=sortie) au solde du compte."""
    await db.cash_accounts.update_one(
        {"_id": ObjectId(account_id)},
        {"$inc": {"balance": delta}, "$set": {"updated_at": datetime.now(timezone.utc)}}
    )


# Modes de paiement traités comme "espèces" dans la caisse
CASH_PAYMENT_METHODS = {"cash", "e_dinar"}


async def auto_record_cash_movement(
    company_id: str,
    amount: float,
    movement_type: str,   # "in" ou "out"
    label: str,
    payment_method: str = "cash",
    customer_id: Optional[str] = None,
    customer_name: Optional[str] = None,
    invoice_id: Optional[str] = None,
    reference: Optional[str] = None,
    notes: Optional[str] = None,
    movement_date: Optional[datetime] = None,
):
    """
    Enregistre automatiquement un mouvement dans le compte caisse par défaut.
    Crée le compte caisse 'Caisse principale' s'il n'existe pas.
    N'agit que pour les modes de paiement en espèces (cash, e_dinar).
    """
    if payment_method not in CASH_PAYMENT_METHODS:
        return None  # Pas un paiement espèces → rien à faire dans la caisse

    # Trouver ou créer le compte caisse par défaut
    cash_account = await db.cash_accounts.find_one({
        "company_id": ObjectId(company_id),
        "is_default": True
    })

    if not cash_account:
        # Prendre le premier compte disponible
        cash_account = await db.cash_accounts.find_one({
            "company_id": ObjectId(company_id)
        })

    if not cash_account:
        # Aucun compte caisse → créer automatiquement "Caisse principale"
        result = await db.cash_accounts.insert_one({
            "company_id": ObjectId(company_id),
            "name": "Caisse principale",
            "currency": "TND",
            "initial_balance": 0.0,
            "balance": 0.0,
            "is_default": True,
            "description": "Compte caisse créé automatiquement",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        })
        cash_account = await db.cash_accounts.find_one({"_id": result.inserted_id})
        logger.info(f"[CAISSE] Compte caisse principal créé automatiquement pour company {company_id}")

    account_id = cash_account["_id"]
    delta = amount if movement_type == "in" else -amount
    new_balance = cash_account["balance"] + delta

    txn_date = movement_date or datetime.now(timezone.utc)

    # Créer la transaction dans cash_transactions
    txn_doc = {
        "company_id": ObjectId(company_id),
        "cash_account_id": account_id,
        "type": movement_type,
        "amount": round(amount, 3),
        "payment_method": payment_method,
        "label": label,
        "reference": reference,
        "date": txn_date,
        "customer_id": ObjectId(customer_id) if customer_id else None,
        "customer_name": customer_name,
        "supplier_id": None,
        "invoice_id": ObjectId(invoice_id) if invoice_id else None,
        "notes": notes,
        "balance_after": round(new_balance, 3),
        "auto_generated": True,
        "created_at": datetime.now(timezone.utc),
    }

    await db.cash_transactions.insert_one(txn_doc)
    await db.cash_accounts.update_one(
        {"_id": account_id},
        {"$inc": {"balance": delta}, "$set": {"updated_at": datetime.now(timezone.utc)}}
    )

    logger.info(f"[CAISSE] Mouvement {movement_type} {amount} TND enregistré — solde: {new_balance} TND")
    return new_balance


# ─────────────────────────────────────────────
# Migration — Factures payées sans transaction caisse
# ─────────────────────────────────────────────

@router.post("/fix-paid-invoices-cash", status_code=200)
async def fix_paid_invoices_cash_transactions(
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Analyse les factures payées (paid/partial) et crée les transactions caisse
    manquantes pour celles réglées en espèces (cash, e_dinar).
    """
    await get_current_company(current_user, company_id)

    # Récupérer toutes les factures payées ou partiellement payées
    invoices = await db.invoices.find({
        "company_id": ObjectId(company_id),
        "status": {"$in": ["paid", "partial"]},
        "amount_paid": {"$gt": 0}
    }).to_list(None)

    results = []

    for invoice in invoices:
        invoice_id = str(invoice["_id"])
        inv_number = invoice.get("number", "")
        amount_paid = invoice.get("amount_paid", 0)

        # Vérifier si une transaction caisse existe déjà pour cette facture
        existing_txn = await db.cash_transactions.find_one({
            "company_id": ObjectId(company_id),
            "invoice_id": invoice["_id"]
        })
        if existing_txn:
            results.append({"invoice": inv_number, "action": "déjà_présent"})
            continue

        # Chercher le paiement lié pour connaître le mode
        payment = await db.payments.find_one({
            "company_id": ObjectId(company_id),
            "allocations.invoice_id": invoice["_id"]
        })
        payment_method = payment.get("payment_method", "cash") if payment else "cash"

        # Seulement pour les paiements en espèces
        if payment_method not in CASH_PAYMENT_METHODS:
            # Vérifier si l'écriture de règlement comptable indique une caisse
            journal_entry = await db.journal_entries.find_one({
                "company_id": ObjectId(company_id),
                "document_id": invoice["_id"],
                "lines": {"$elemMatch": {"account_code": {"$in": ["531"]}, "debit": {"$gt": 0}}}
            })
            if not journal_entry:
                results.append({"invoice": inv_number, "action": "ignoré_non_espèces", "method": payment_method})
                continue
            payment_method = "cash"  # L'écriture 531 confirme que c'est espèces

        # Récupérer le client
        customer = await db.customers.find_one({"_id": invoice.get("customer_id")})
        customer_name = customer.get("display_name", "") if customer else ""
        customer_id_str = str(invoice["customer_id"]) if invoice.get("customer_id") else None

        # Date du paiement
        paid_at = invoice.get("paid_at") or invoice.get("updated_at") or datetime.now(timezone.utc)

        try:
            new_balance = await auto_record_cash_movement(
                company_id=company_id,
                amount=amount_paid,
                movement_type="in",
                label=f"Encaissement facture {inv_number} - {customer_name} (migration)",
                payment_method=payment_method,
                customer_id=customer_id_str,
                customer_name=customer_name,
                invoice_id=invoice_id,
                reference=inv_number,
                notes="Transaction créée par migration automatique",
                movement_date=paid_at,
            )
            results.append({
                "invoice": inv_number,
                "action": "transaction_créée",
                "amount": amount_paid,
                "payment_method": payment_method,
                "new_balance": new_balance
            })
        except Exception as e:
            results.append({"invoice": inv_number, "action": "erreur", "detail": str(e)})

    created = sum(1 for r in results if r["action"] == "transaction_créée")
    return {
        "analyzed": len(invoices),
        "created": created,
        "details": results
    }


# ─────────────────────────────────────────────
# Comptes Caisse — CRUD
# ─────────────────────────────────────────────

@router.post("/accounts", status_code=201)
async def create_cash_account(
    data: CashAccountCreate,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Crée un compte caisse pour l'entreprise."""
    await get_current_company(current_user, company_id)

    if data.is_default:
        # Retire le flag default des autres comptes
        await db.cash_accounts.update_many(
            {"company_id": ObjectId(company_id)},
            {"$set": {"is_default": False}}
        )

    doc = {
        "company_id": ObjectId(company_id),
        "name": data.name,
        "currency": data.currency,
        "initial_balance": data.initial_balance,
        "balance": data.initial_balance,
        "is_default": data.is_default,
        "description": data.description,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "created_by": current_user["_id"]
    }
    result = await db.cash_accounts.insert_one(doc)
    return {"id": str(result.inserted_id), "message": "Compte caisse créé"}


@router.get("/accounts")
async def list_cash_accounts(
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Liste les comptes caisse de l'entreprise."""
    await get_current_company(current_user, company_id)
    accounts = await db.cash_accounts.find(
        {"company_id": ObjectId(company_id)}
    ).sort("name", 1).to_list(100)
    return [_ser_account(a) for a in accounts]


@router.get("/accounts/{account_id}")
async def get_cash_account(
    account_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)
    acc = await _get_cash_account(account_id, company_id)
    return _ser_account(acc)


@router.put("/accounts/{account_id}")
async def update_cash_account(
    account_id: str,
    data: CashAccountUpdate,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    await get_current_company(current_user, company_id)
    acc = await _get_cash_account(account_id, company_id)

    update = {k: v for k, v in data.dict(exclude_unset=True).items() if v is not None}
    if "is_default" in update and update["is_default"]:
        await db.cash_accounts.update_many(
            {"company_id": ObjectId(company_id)},
            {"$set": {"is_default": False}}
        )
    update["updated_at"] = datetime.now(timezone.utc)
    await db.cash_accounts.update_one({"_id": ObjectId(account_id)}, {"$set": update})
    return {"message": "Compte mis à jour"}


# ─────────────────────────────────────────────
# Encaissements & Décaissements
# ─────────────────────────────────────────────

@router.post("/transactions", status_code=201)
async def record_cash_transaction(
    data: CashPaymentCreate,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Enregistre un mouvement de caisse (entrée ou sortie)."""
    await get_current_company(current_user, company_id)
    acc = await _get_cash_account(data.cash_account_id, company_id)

    delta = data.amount if data.type == "in" else -data.amount
    new_balance = acc["balance"] + delta

    # Résolution du nom client/fournisseur
    customer_name = None
    if data.customer_id:
        c = await db.customers.find_one({"_id": ObjectId(data.customer_id)})
        customer_name = c.get("display_name") if c else None

    # Si lié à une facture cliente, met à jour amount_paid
    if data.type == "in" and data.invoice_id:
        invoice = await db.invoices.find_one({"_id": ObjectId(data.invoice_id)})
        if invoice:
            new_amount_paid = invoice.get("amount_paid", 0) + data.amount
            new_balance_due = max(0, invoice["total"] - new_amount_paid)
            new_status = "paid" if new_balance_due <= 0 else "partial"
            await db.invoices.update_one(
                {"_id": ObjectId(data.invoice_id)},
                {"$set": {
                    "amount_paid": new_amount_paid,
                    "balance_due": new_balance_due,
                    "status": new_status,
                    "updated_at": datetime.now(timezone.utc)
                }}
            )
            # Mise à jour solde client
            if data.customer_id:
                await db.customers.update_one(
                    {"_id": ObjectId(data.customer_id)},
                    {"$inc": {"balance": -data.amount, "total_paid": data.amount}}
                )

    doc = {
        "company_id": ObjectId(company_id),
        "cash_account_id": ObjectId(data.cash_account_id),
        "type": data.type,
        "amount": data.amount,
        "payment_method": data.payment_method,
        "label": data.label,
        "reference": data.reference,
        "date": data.date if isinstance(data.date, datetime) else datetime.fromisoformat(str(data.date)),
        "customer_id": ObjectId(data.customer_id) if data.customer_id else None,
        "customer_name": customer_name,
        "supplier_id": ObjectId(data.supplier_id) if data.supplier_id else None,
        "invoice_id": ObjectId(data.invoice_id) if data.invoice_id else None,
        "notes": data.notes,
        "balance_after": new_balance,
        "created_at": datetime.now(timezone.utc),
        "created_by": current_user["_id"]
    }
    result = await db.cash_transactions.insert_one(doc)
    await _update_account_balance(data.cash_account_id, delta)

    return {"id": str(result.inserted_id), "balance_after": new_balance, "message": "Transaction enregistrée"}


@router.post("/expenses", status_code=201)
async def record_cash_expense(
    data: CashExpenseCreate,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Enregistre une dépense payée en espèces (sans facture)."""
    await get_current_company(current_user, company_id)
    acc = await _get_cash_account(data.cash_account_id, company_id)

    new_balance = acc["balance"] - data.amount
    doc = {
        "company_id": ObjectId(company_id),
        "cash_account_id": ObjectId(data.cash_account_id),
        "type": "out",
        "amount": data.amount,
        "payment_method": "cash",
        "label": data.label,
        "reference": data.reference,
        "date": data.date,
        "category": data.category,
        "notes": data.notes,
        "balance_after": new_balance,
        "created_at": datetime.now(timezone.utc),
        "created_by": current_user["_id"]
    }
    result = await db.cash_transactions.insert_one(doc)
    await _update_account_balance(data.cash_account_id, -data.amount)

    return {"id": str(result.inserted_id), "balance_after": new_balance, "message": "Dépense enregistrée"}


@router.get("/transactions")
async def list_cash_transactions(
    company_id: str = Query(...),
    cash_account_id: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    type_filter: Optional[str] = Query(None, alias="type"),
    limit: int = Query(200, le=1000),
    current_user: dict = Depends(get_current_user)
):
    """Liste les mouvements de caisse avec filtres optionnels."""
    await get_current_company(current_user, company_id)

    query: dict = {"company_id": ObjectId(company_id)}
    if cash_account_id:
        query["cash_account_id"] = ObjectId(cash_account_id)
    if type_filter:
        query["type"] = type_filter
    if date_from or date_to:
        date_filter = {}
        if date_from:
            date_filter["$gte"] = datetime.fromisoformat(date_from)
        if date_to:
            date_filter["$lte"] = datetime.fromisoformat(date_to) + timedelta(days=1)
        query["date"] = date_filter

    txns = await db.cash_transactions.find(query).sort("date", -1).limit(limit).to_list(limit)
    return [_ser_transaction(t) for t in txns]


# ─────────────────────────────────────────────
# Soldes clients (créances)
# ─────────────────────────────────────────────

@router.get("/customer-balances")
async def get_customer_balances(
    company_id: str = Query(...),
    min_balance: float = Query(0.01),
    limit: int = Query(100, le=500),
    current_user: dict = Depends(get_current_user)
):
    """
    Retourne les clients ayant un solde impayé.
    Le solde est calculé dynamiquement depuis les factures.
    """
    await get_current_company(current_user, company_id)

    pipeline = [
        {"$match": {"company_id": ObjectId(company_id), "balance_due": {"$gt": min_balance}}},
        {"$group": {
            "_id": "$customer_id",
            "total_due": {"$sum": "$balance_due"},
            "invoice_count": {"$sum": 1},
            "oldest_invoice_date": {"$min": "$date"}
        }},
        {"$sort": {"total_due": -1}},
        {"$limit": limit}
    ]
    rows = await db.invoices.aggregate(pipeline).to_list(limit)

    result = []
    for row in rows:
        if not row["_id"]:
            continue
        customer = await db.customers.find_one({"_id": row["_id"]})
        if customer:
            overdue_days = 0
            if row.get("oldest_invoice_date"):
                overdue_days = (datetime.now(timezone.utc) - row["oldest_invoice_date"].replace(tzinfo=timezone.utc)).days
            result.append({
                "customer_id": str(row["_id"]),
                "customer_name": customer.get("display_name", ""),
                "phone": customer.get("phone", ""),
                "email": customer.get("email", ""),
                "total_due": round(row["total_due"], 3),
                "invoice_count": row["invoice_count"],
                "overdue_days": overdue_days,
            })
    return result


@router.get("/unpaid-invoices")
async def get_unpaid_invoices(
    company_id: str = Query(...),
    customer_id: Optional[str] = Query(None),
    overdue_only: bool = Query(False),
    limit: int = Query(200, le=1000),
    current_user: dict = Depends(get_current_user)
):
    """Factures impayées ou partiellement payées."""
    await get_current_company(current_user, company_id)

    query: dict = {
        "company_id": ObjectId(company_id),
        "balance_due": {"$gt": 0},
        "status": {"$in": ["sent", "partial", "overdue"]}
    }
    if customer_id:
        query["customer_id"] = ObjectId(customer_id)
    if overdue_only:
        query["due_date"] = {"$lt": datetime.now(timezone.utc)}

    invoices = await db.invoices.find(query).sort("due_date", 1).limit(limit).to_list(limit)
    result = []
    for inv in invoices:
        customer = await db.customers.find_one({"_id": inv.get("customer_id")})
        due_date = inv.get("due_date")
        days_overdue = 0
        if due_date:
            if isinstance(due_date, datetime):
                days_overdue = max(0, (datetime.now(timezone.utc) - due_date.replace(tzinfo=timezone.utc)).days)

        result.append({
            "id": str(inv["_id"]),
            "number": inv.get("number"),
            "date": inv["date"].isoformat() if isinstance(inv.get("date"), datetime) else inv.get("date"),
            "due_date": due_date.isoformat() if isinstance(due_date, datetime) else due_date,
            "customer_id": str(inv["customer_id"]) if inv.get("customer_id") else None,
            "customer_name": customer.get("display_name", "") if customer else "",
            "total": inv.get("total", 0),
            "amount_paid": inv.get("amount_paid", 0),
            "balance_due": inv.get("balance_due", 0),
            "status": inv.get("status"),
            "days_overdue": days_overdue,
        })
    return result


# ─────────────────────────────────────────────
# Rapport journalier de caisse
# ─────────────────────────────────────────────

@router.get("/daily-report")
async def get_daily_cash_report(
    company_id: str = Query(...),
    report_date: Optional[str] = Query(None, description="Date YYYY-MM-DD (défaut: aujourd'hui)"),
    cash_account_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """
    Rapport de caisse pour une journée donnée :
    - Solde d'ouverture
    - Total encaissements
    - Total décaissements
    - Solde de clôture
    - Détail des transactions
    """
    await get_current_company(current_user, company_id)

    target_date = datetime.fromisoformat(report_date) if report_date else datetime.now(timezone.utc)
    day_start = target_date.replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=timezone.utc)
    day_end = day_start + timedelta(days=1)

    query: dict = {
        "company_id": ObjectId(company_id),
        "date": {"$gte": day_start, "$lt": day_end}
    }
    if cash_account_id:
        query["cash_account_id"] = ObjectId(cash_account_id)

    txns = await db.cash_transactions.find(query).sort("date", 1).to_list(2000)

    total_in = sum(t["amount"] for t in txns if t.get("type") == "in")
    total_out = sum(t["amount"] for t in txns if t.get("type") == "out")

    # Solde d'ouverture = solde actuel du compte - mouvements du jour
    opening_balance = 0.0
    if cash_account_id:
        acc = await _get_cash_account(cash_account_id, company_id)
        opening_balance = acc["balance"] - total_in + total_out
    else:
        accounts = await db.cash_accounts.find({"company_id": ObjectId(company_id)}).to_list(50)
        total_now = sum(a.get("balance", 0) for a in accounts)
        opening_balance = total_now - total_in + total_out

    return {
        "date": target_date.date().isoformat(),
        "opening_balance": round(opening_balance, 3),
        "total_in": round(total_in, 3),
        "total_out": round(total_out, 3),
        "closing_balance": round(opening_balance + total_in - total_out, 3),
        "transaction_count": len(txns),
        "transactions": [_ser_transaction(t) for t in txns]
    }
