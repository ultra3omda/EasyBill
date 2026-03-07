"""
financial_statements.py
Routes pour les états financiers selon le système comptable tunisien (SCE):
  - Bilan (Balance Sheet)
  - État de résultat (Income Statement / P&L)
  - État des flux de trésorerie (Cash Flow Statement)
  - Vue consolidée (Financial Statements Overview)
"""
from fastapi import APIRouter, HTTPException, status, Depends, Query
from fastapi.responses import StreamingResponse
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime, timezone
from io import BytesIO
import os
from typing import Optional, List, Dict
from utils.dependencies import get_current_user, get_current_company

router = APIRouter(prefix="/api/financial-statements", tags=["Financial Statements"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# ─── Compte de résultat : classification tunisienne SCE ───────────────────────
INCOME_STATEMENT_STRUCTURE = {
    "produits_exploitation": {
        "label": "Produits d'exploitation",
        "prefixes": ["70", "71", "72", "73", "74", "75", "76", "77", "78", "79"],
        "type": "income",
        "sign": 1
    },
    "charges_exploitation": {
        "label": "Charges d'exploitation",
        "prefixes": ["60", "61", "62", "63", "64", "65", "66", "67", "68", "69"],
        "type": "expense",
        "sign": -1
    }
}

# ─── Bilan : classification tunisienne SCE ────────────────────────────────────
BILAN_STRUCTURE = {
    "actif": {
        "label": "ACTIF",
        "sections": [
            {
                "key": "actifs_non_courants",
                "label": "Actifs non courants",
                "items": [
                    {"label": "Immobilisations incorporelles", "prefixes": ["21"]},
                    {"label": "Immobilisations corporelles", "prefixes": ["22", "23", "24", "25"]},
                    {"label": "Immobilisations financières", "prefixes": ["26", "27"]},
                    {"label": "Autres actifs non courants", "prefixes": ["28", "29"]},
                ]
            },
            {
                "key": "actifs_courants",
                "label": "Actifs courants",
                "items": [
                    {"label": "Stocks", "prefixes": ["30", "31", "32", "33", "34", "35", "36", "37", "38", "39"]},
                    {"label": "Clients et comptes rattachés", "prefixes": ["411", "412", "413", "414", "415", "416", "417", "418"]},
                    {"label": "Autres créances", "prefixes": ["42", "43", "44", "45", "46", "47", "48"]},
                    {"label": "Placements et autres actifs financiers", "prefixes": ["50", "51"]},
                    {"label": "Liquidités et équivalents de liquidités", "prefixes": ["52", "53", "54", "59"]},
                ]
            }
        ]
    },
    "passif": {
        "label": "PASSIF",
        "sections": [
            {
                "key": "capitaux_propres",
                "label": "Capitaux propres",
                "items": [
                    {"label": "Capital", "prefixes": ["101", "102", "103"]},
                    {"label": "Réserves", "prefixes": ["11", "12"]},
                    {"label": "Résultat de l'exercice", "prefixes": ["13"]},
                    {"label": "Autres capitaux propres", "prefixes": ["14", "15", "16", "17", "18", "19"]},
                ]
            },
            {
                "key": "passifs_non_courants",
                "label": "Passifs non courants",
                "items": [
                    {"label": "Emprunts et dettes financières", "prefixes": ["162", "163", "164", "165"]},
                    {"label": "Provisions", "prefixes": ["15"]},
                    {"label": "Autres passifs non courants", "prefixes": ["17", "18"]},
                ]
            },
            {
                "key": "passifs_courants",
                "label": "Passifs courants",
                "items": [
                    {"label": "Fournisseurs et comptes rattachés", "prefixes": ["401", "402", "403", "404", "405", "408"]},
                    {"label": "Concours bancaires et dettes financières courantes", "prefixes": ["52"]},
                    {"label": "TVA et taxes", "prefixes": ["43"]},
                    {"label": "Autres passifs courants", "prefixes": ["44", "45", "46", "47", "48", "49"]},
                ]
            }
        ]
    }
}


async def _get_account_balances(company_id: str, date_from: Optional[str] = None, date_to: Optional[str] = None) -> Dict[str, dict]:
    """
    Compute cumulative debit/credit per account code from posted journal entries.
    Returns: dict[account_code] -> {debit, credit, balance, name, type}
    """
    query: dict = {
        "company_id": ObjectId(company_id),
        "status": "posted"
    }
    date_filter = {}
    if date_from:
        date_filter["$gte"] = datetime.fromisoformat(date_from)
    if date_to:
        date_filter["$lte"] = datetime.fromisoformat(date_to + "T23:59:59")
    if date_filter:
        query["date"] = date_filter

    entries = await db.journal_entries.find(query).to_list(10000)

    balances: Dict[str, dict] = {}
    for entry in entries:
        for line in entry.get("lines", []):
            code = line.get("account_code", "")
            if not code:
                continue
            if code not in balances:
                balances[code] = {
                    "account_code": code,
                    "account_name": line.get("account_name", ""),
                    "debit": 0.0,
                    "credit": 0.0,
                }
            balances[code]["debit"] += line.get("debit", 0)
            balances[code]["credit"] += line.get("credit", 0)

    # Enrich with account metadata from chart_of_accounts
    for code, bal in balances.items():
        acct = await db.chart_of_accounts.find_one(
            {"company_id": ObjectId(company_id), "code": code}
        )
        if acct:
            bal["account_name"] = acct.get("name", bal["account_name"])
            bal["type"] = acct.get("type", "asset")
        else:
            # Infer type from code
            first = code[0] if code else "0"
            if first in ["6"]:
                bal["type"] = "expense"
            elif first in ["7"]:
                bal["type"] = "income"
            elif first in ["1"]:
                bal["type"] = "equity"
            elif first in ["4", "5"]:
                bal["type"] = "liability"
            else:
                bal["type"] = "asset"

        # Compute net balance
        t = bal.get("type", "asset")
        if t in ["asset", "expense"]:
            bal["balance"] = bal["debit"] - bal["credit"]
        else:
            bal["balance"] = bal["credit"] - bal["debit"]

    return balances


def _sum_by_prefixes(balances: Dict[str, dict], prefixes: List[str]) -> float:
    """Sum balances for all account codes starting with any of the given prefixes."""
    total = 0.0
    for code, bal in balances.items():
        for pfx in prefixes:
            if code.startswith(pfx):
                total += bal.get("balance", 0)
                break
    return round(total, 3)


def _detail_by_prefixes(balances: Dict[str, dict], prefixes: List[str]) -> List[dict]:
    """Return detailed account rows matching given prefixes."""
    rows = []
    seen = set()
    for code, bal in sorted(balances.items()):
        for pfx in prefixes:
            if code.startswith(pfx) and code not in seen:
                seen.add(code)
                rows.append({
                    "account_code": code,
                    "account_name": bal.get("account_name", ""),
                    "balance": round(bal.get("balance", 0), 3)
                })
                break
    return rows


# ─── BILAN ─────────────────────────────────────────────────────────────────────

@router.get("/bilan")
async def get_bilan(
    company_id: str = Query(...),
    date_to: Optional[str] = None,
    date_from: Optional[str] = None,
    detail: bool = Query(False),
    current_user: dict = Depends(get_current_user)
):
    """Bilan comptable selon le SCE tunisien."""
    await get_current_company(current_user, company_id)

    balances = await _get_account_balances(company_id, date_from, date_to)

    result = {"actif": {}, "passif": {}}

    for side_key, side_data in BILAN_STRUCTURE.items():
        total_side = 0.0
        sections = []
        for section in side_data["sections"]:
            total_section = 0.0
            items = []
            for item in section["items"]:
                amount = _sum_by_prefixes(balances, item["prefixes"])
                rows = _detail_by_prefixes(balances, item["prefixes"]) if detail else []
                items.append({
                    "label": item["label"],
                    "amount": amount,
                    "detail": rows
                })
                total_section += amount
            sections.append({
                "key": section["key"],
                "label": section["label"],
                "items": items,
                "total": round(total_section, 3)
            })
            total_side += total_section

        result[side_key] = {
            "label": side_data["label"],
            "sections": sections,
            "total": round(total_side, 3)
        }

    # Compute net result if not already in capitaux_propres (from income/expense accounts)
    income_total = _sum_by_prefixes(balances, ["7"])
    expense_total = _sum_by_prefixes(balances, ["6"])
    net_result = round(income_total - expense_total, 3)

    return {
        "date_from": date_from,
        "date_to": date_to,
        "actif": result["actif"],
        "passif": result["passif"],
        "equilibre": round(result["actif"]["total"] - result["passif"]["total"], 3),
        "net_result": net_result,
        "income_total": round(income_total, 3),
        "expense_total": round(expense_total, 3),
    }


# ─── ÉTAT DE RÉSULTAT ──────────────────────────────────────────────────────────

@router.get("/income-statement")
async def get_income_statement(
    company_id: str = Query(...),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    detail: bool = Query(False),
    current_user: dict = Depends(get_current_user)
):
    """État de résultat (Compte de résultat) selon le SCE tunisien."""
    await get_current_company(current_user, company_id)

    balances = await _get_account_balances(company_id, date_from, date_to)

    # ── Produits d'exploitation ──
    produits_items = []
    total_produits = 0.0
    for code in sorted(balances.keys()):
        if code.startswith("7"):
            bal = balances[code]
            amount = round(bal.get("balance", 0), 3)
            produits_items.append({
                "account_code": code,
                "account_name": bal.get("account_name", ""),
                "amount": amount
            })
            total_produits += amount

    # Group by prefix 70/71/72/73/74/75/76/77/78/79
    def _group_income(prefix, label):
        total = _sum_by_prefixes(balances, [prefix])
        rows = _detail_by_prefixes(balances, [prefix]) if detail else []
        return {"label": label, "amount": round(total, 3), "detail": rows}

    produits_sections = [
        _group_income("70", "Revenus des activités ordinaires (ventes)"),
        _group_income("71", "Variation des stocks de produits finis"),
        _group_income("72", "Production immobilisée"),
        _group_income("73", "Subventions d'exploitation"),
        _group_income("74", "Autres produits d'exploitation"),
        _group_income("75", "Produits financiers"),
        _group_income("76", "Gains sur cessions d'actifs"),
        _group_income("77", "Produits exceptionnels"),
        _group_income("78", "Reprises sur provisions"),
        _group_income("79", "Transferts de charges"),
    ]
    produits_sections = [s for s in produits_sections if s["amount"] != 0]

    # ── Charges d'exploitation ──
    def _group_expense(prefix, label):
        total = _sum_by_prefixes(balances, [prefix])
        rows = _detail_by_prefixes(balances, [prefix]) if detail else []
        return {"label": label, "amount": round(total, 3), "detail": rows}

    charges_sections = [
        _group_expense("60", "Achats de marchandises et matières premières"),
        _group_expense("61", "Autres achats et charges externes"),
        _group_expense("62", "Services extérieurs"),
        _group_expense("63", "Charges de personnel"),
        _group_expense("64", "Impôts, taxes et versements assimilés"),
        _group_expense("65", "Autres charges d'exploitation"),
        _group_expense("66", "Charges financières"),
        _group_expense("67", "Pertes exceptionnelles"),
        _group_expense("68", "Dotations aux amortissements et provisions"),
        _group_expense("69", "Impôt sur les bénéfices"),
    ]
    charges_sections = [s for s in charges_sections if s["amount"] != 0]

    total_produits = sum(s["amount"] for s in produits_sections)
    total_charges = sum(s["amount"] for s in charges_sections)
    resultat_net = round(total_produits - total_charges, 3)

    # Marge brute = Ventes (70) - Achats (60)
    ventes = _sum_by_prefixes(balances, ["70"])
    achats = _sum_by_prefixes(balances, ["60"])
    marge_brute = round(ventes - achats, 3)
    taux_marge = round((marge_brute / ventes * 100) if ventes != 0 else 0, 2)

    # Résultat d'exploitation = Produits - (Charges hors charges financières)
    charges_fin = _sum_by_prefixes(balances, ["66"])
    resultat_exploitation = round(total_produits - total_charges + charges_fin, 3)
    resultat_financier = round(-charges_fin + _sum_by_prefixes(balances, ["75"]), 3)

    return {
        "date_from": date_from,
        "date_to": date_to,
        "produits": {
            "sections": produits_sections,
            "total": round(total_produits, 3)
        },
        "charges": {
            "sections": charges_sections,
            "total": round(total_charges, 3)
        },
        "resultat_net": resultat_net,
        "marge_brute": marge_brute,
        "taux_marge": taux_marge,
        "resultat_exploitation": resultat_exploitation,
        "resultat_financier": resultat_financier,
        "benefice": resultat_net > 0,
    }


# ─── FLUX DE TRÉSORERIE ────────────────────────────────────────────────────────

@router.get("/cash-flow")
async def get_cash_flow(
    company_id: str = Query(...),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    État des flux de trésorerie (méthode indirecte simplifiée).
    Basé sur les mouvements dans les comptes de trésorerie (52x, 53x).
    """
    await get_current_company(current_user, company_id)

    balances = await _get_account_balances(company_id, date_from, date_to)

    # ── I. Flux liés à l'exploitation ──────────────────────────────────────────
    # Résultat net
    total_produits = _sum_by_prefixes(balances, ["7"])
    total_charges = _sum_by_prefixes(balances, ["6"])
    resultat_net = total_produits - total_charges

    # Charges non décaissables : dotations amortissements (68x)
    dotations = _sum_by_prefixes(balances, ["68"])

    # Variation BFR (simplifié)
    # + variation créances clients (411) : diminution créances = encaissement
    clients = _sum_by_prefixes(balances, ["411", "412", "413"])
    # + variation stocks (3x) : diminution stocks = flux positif
    stocks = _sum_by_prefixes(balances, ["30", "31", "32", "33", "34", "35"])
    # - variation fournisseurs (401) : augmentation fournisseurs = flux positif
    fournisseurs = _sum_by_prefixes(balances, ["401", "402", "403"])
    # - variation TVA (43x)
    tva = _sum_by_prefixes(balances, ["43"])

    # Simplification : variation BFR = -(créances + stocks) + fournisseurs
    variation_bfr = round(-clients - stocks + fournisseurs, 3)

    flux_exploitation = round(resultat_net + dotations + variation_bfr, 3)

    # ── II. Flux liés à l'investissement ───────────────────────────────────────
    # Acquisitions/Cessions d'immobilisations (2x)
    immo_corporelles = -_sum_by_prefixes(balances, ["22", "23", "24", "25"])
    immo_incorporelles = -_sum_by_prefixes(balances, ["21"])
    immo_financieres = -_sum_by_prefixes(balances, ["26", "27"])
    flux_investissement = round(immo_corporelles + immo_incorporelles + immo_financieres, 3)

    # ── III. Flux liés au financement ──────────────────────────────────────────
    # Capitaux propres hors résultat (10x, 11x, 12x)
    capital = _sum_by_prefixes(balances, ["10"])
    reserves = _sum_by_prefixes(balances, ["11", "12"])
    # Emprunts (16x, 17x)
    emprunts = _sum_by_prefixes(balances, ["16", "17"])
    flux_financement = round(capital + reserves + emprunts, 3)

    # ── IV. Trésorerie ─────────────────────────────────────────────────────────
    # Solde trésorerie = Banques (52x) + Caisse (53x)
    banques = _sum_by_prefixes(balances, ["52"])
    caisse = _sum_by_prefixes(balances, ["53"])
    placements = _sum_by_prefixes(balances, ["50", "51"])
    tresorerie_fin = round(banques + caisse + placements, 3)

    # Variation théorique
    variation_theorique = round(flux_exploitation + flux_investissement + flux_financement, 3)

    # Collect account details for treasury
    treasury_accounts = []
    for code, bal in sorted(balances.items()):
        if code.startswith("52") or code.startswith("53") or code.startswith("51"):
            treasury_accounts.append({
                "account_code": code,
                "account_name": bal.get("account_name", ""),
                "balance": round(bal.get("balance", 0), 3)
            })

    return {
        "date_from": date_from,
        "date_to": date_to,
        "flux_exploitation": {
            "label": "Flux nets de trésorerie liés aux activités d'exploitation",
            "total": round(flux_exploitation, 3),
            "detail": [
                {"label": "Résultat net de l'exercice", "amount": round(resultat_net, 3)},
                {"label": "Dotations aux amortissements et provisions", "amount": round(dotations, 3)},
                {"label": "Variation des créances clients", "amount": round(-clients, 3)},
                {"label": "Variation des stocks", "amount": round(-stocks, 3)},
                {"label": "Variation des dettes fournisseurs", "amount": round(fournisseurs, 3)},
            ]
        },
        "flux_investissement": {
            "label": "Flux nets de trésorerie liés aux activités d'investissement",
            "total": round(flux_investissement, 3),
            "detail": [
                {"label": "Acquisitions d'immobilisations corporelles", "amount": round(immo_corporelles, 3)},
                {"label": "Acquisitions d'immobilisations incorporelles", "amount": round(immo_incorporelles, 3)},
                {"label": "Acquisitions d'immobilisations financières", "amount": round(immo_financieres, 3)},
            ]
        },
        "flux_financement": {
            "label": "Flux nets de trésorerie liés aux activités de financement",
            "total": round(flux_financement, 3),
            "detail": [
                {"label": "Augmentation de capital", "amount": round(capital, 3)},
                {"label": "Variation des réserves", "amount": round(reserves, 3)},
                {"label": "Variation des emprunts", "amount": round(emprunts, 3)},
            ]
        },
        "tresorerie": {
            "label": "Trésorerie et équivalents de trésorerie",
            "banques": round(banques, 3),
            "caisse": round(caisse, 3),
            "placements": round(placements, 3),
            "total_fin_periode": tresorerie_fin,
            "accounts": treasury_accounts,
        },
        "variation_tresorerie": variation_theorique,
    }


# ─── VUE D'ENSEMBLE ────────────────────────────────────────────────────────────

@router.get("/overview")
async def get_financial_statements_overview(
    company_id: str = Query(...),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Vue d'ensemble consolidée des états financiers."""
    await get_current_company(current_user, company_id)

    balances = await _get_account_balances(company_id, date_from, date_to)

    # Key indicators
    total_assets = _sum_by_prefixes(balances, ["1", "2", "3", "4", "5"])
    total_income = _sum_by_prefixes(balances, ["7"])
    total_expenses = _sum_by_prefixes(balances, ["6"])
    net_result = round(total_income - total_expenses, 3)
    treasury = round(_sum_by_prefixes(balances, ["52", "53"]), 3)
    clients_balance = round(_sum_by_prefixes(balances, ["411", "412"]), 3)
    suppliers_balance = round(_sum_by_prefixes(balances, ["401", "402"]), 3)

    # Entry stats
    query: dict = {"company_id": ObjectId(company_id), "status": "posted"}
    if date_from:
        query.setdefault("date", {})["$gte"] = datetime.fromisoformat(date_from)
    if date_to:
        query.setdefault("date", {})["$lte"] = datetime.fromisoformat(date_to + "T23:59:59")

    pipeline = [
        {"$match": query},
        {"$group": {
            "_id": "$journal_type",
            "count": {"$sum": 1},
            "total_debit": {"$sum": "$total_debit"}
        }}
    ]
    by_type = await db.journal_entries.aggregate(pipeline).to_list(20)
    total_entries = sum(r["count"] for r in by_type)

    return {
        "date_from": date_from,
        "date_to": date_to,
        "kpis": {
            "net_result": net_result,
            "benefice": net_result >= 0,
            "total_income": round(total_income, 3),
            "total_expenses": round(total_expenses, 3),
            "treasury": treasury,
            "clients_balance": clients_balance,
            "suppliers_balance": suppliers_balance,
            "total_entries": total_entries,
        },
        "by_journal_type": [
            {"journal_type": r["_id"] or "general", "count": r["count"], "total_debit": round(r.get("total_debit", 0) or 0, 3)}
            for r in by_type
        ],
    }
