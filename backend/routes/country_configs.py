"""
Module C - Multi-Country Accounting & Tax Configuration
Système de configuration fiscale par pays, extensible.
Tunisia = pays par défaut — aucune rupture de la logique existante.
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
import os
import logging

from utils.dependencies import get_current_user, get_current_company

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/country-config", tags=["Country Configuration"])

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'easybill')]


# ─────────────────────────────────────────────
# Données statiques — pays supportés
# ─────────────────────────────────────────────

SUPPORTED_COUNTRIES: Dict[str, Dict] = {
    "TN": {
        "name": "Tunisie",
        "currency": "TND",
        "currency_symbol": "DT",
        "locale": "fr-TN",
        "tax_system": "tva_tunisie",
        "default_vat_rates": [0, 7, 13, 19],
        "default_vat": 19,
        "has_fodec": True,
        "has_stamp_duty": True,
        "has_withholding_tax": True,
        "fiscal_id_label": "Matricule fiscal",
        "fiscal_id_format": r"^\d{7}[A-Z]/[A-Z]/[A-Z]/\d{3}$",
        "invoice_numbering_prefix": "F",
        "legal_mentions": [
            "Timbre fiscal : 1,000 TND",
            "FODEC : 1%",
        ],
        "chart_template": "tunisian",
    },
    "FR": {
        "name": "France",
        "currency": "EUR",
        "currency_symbol": "€",
        "locale": "fr-FR",
        "tax_system": "tva_france",
        "default_vat_rates": [0, 5.5, 10, 20],
        "default_vat": 20,
        "has_fodec": False,
        "has_stamp_duty": False,
        "has_withholding_tax": False,
        "fiscal_id_label": "SIRET",
        "fiscal_id_format": r"^\d{14}$",
        "invoice_numbering_prefix": "FA",
        "legal_mentions": [
            "En cas de retard de paiement, une pénalité de 3× le taux d'intérêt légal sera appliquée.",
            "Indemnité forfaitaire pour frais de recouvrement : 40 EUR.",
        ],
        "chart_template": "pcg_france",
    },
    "MA": {
        "name": "Maroc",
        "currency": "MAD",
        "currency_symbol": "DH",
        "locale": "fr-MA",
        "tax_system": "tva_maroc",
        "default_vat_rates": [0, 7, 10, 14, 20],
        "default_vat": 20,
        "has_fodec": False,
        "has_stamp_duty": False,
        "has_withholding_tax": True,
        "fiscal_id_label": "ICE",
        "fiscal_id_format": r"^\d{15}$",
        "invoice_numbering_prefix": "F",
        "legal_mentions": [],
        "chart_template": "pcg_maroc",
    },
    "AE": {
        "name": "Émirats Arabes Unis",
        "currency": "AED",
        "currency_symbol": "AED",
        "locale": "en-AE",
        "tax_system": "vat_uae",
        "default_vat_rates": [0, 5],
        "default_vat": 5,
        "has_fodec": False,
        "has_stamp_duty": False,
        "has_withholding_tax": False,
        "fiscal_id_label": "TRN",
        "fiscal_id_format": r"^\d{15}$",
        "invoice_numbering_prefix": "INV",
        "legal_mentions": [],
        "chart_template": "generic",
    },
    "DZ": {
        "name": "Algérie",
        "currency": "DZD",
        "currency_symbol": "DA",
        "locale": "fr-DZ",
        "tax_system": "tva_algerie",
        "default_vat_rates": [0, 9, 19],
        "default_vat": 19,
        "has_fodec": False,
        "has_stamp_duty": False,
        "has_withholding_tax": True,
        "fiscal_id_label": "NIF",
        "fiscal_id_format": r"^\d{15}$",
        "invoice_numbering_prefix": "F",
        "legal_mentions": [],
        "chart_template": "generic",
    },
}


# ─────────────────────────────────────────────
# Schemas
# ─────────────────────────────────────────────

class TaxRateCreate(BaseModel):
    name: str
    rate: float = Field(..., ge=0, le=100)
    is_default: bool = False
    applies_to: str = "all"          # all, products, services
    tax_type: str = "vat"            # vat, withholding, stamp, fodec
    description: Optional[str] = None


class CompanyFiscalSettings(BaseModel):
    country_code: str = "TN"
    currency: Optional[str] = None
    fiscal_year_start_month: int = Field(1, ge=1, le=12)
    default_vat_rate: Optional[float] = None
    enable_fodec: bool = False
    enable_stamp_duty: bool = False
    enable_withholding_tax: bool = False
    custom_tax_rates: List[TaxRateCreate] = []
    invoice_footer_legal: Optional[str] = None
    rounding_mode: str = "3dp"       # 3dp = 3 décimales (TND), 2dp = EUR/MAD


# ─────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────

@router.get("/countries")
async def list_supported_countries():
    """Liste tous les pays supportés avec leur configuration."""
    return {
        "countries": [
            {"code": code, "name": cfg["name"], "currency": cfg["currency"]}
            for code, cfg in SUPPORTED_COUNTRIES.items()
        ]
    }


@router.get("/countries/{country_code}")
async def get_country_config(country_code: str):
    """Retourne la configuration complète d'un pays."""
    code = country_code.upper()
    if code not in SUPPORTED_COUNTRIES:
        raise HTTPException(status_code=404, detail=f"Pays '{code}' non supporté.")
    return SUPPORTED_COUNTRIES[code]


@router.get("/company-settings")
async def get_company_fiscal_settings(
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Retourne les paramètres fiscaux de l'entreprise."""
    company = await get_current_company(current_user, company_id)

    # Les settings fiscaux sont stockés dans company.fiscal_settings
    # ou on déduit depuis les données company existantes
    fiscal = company.get("fiscal_settings") or {}

    country_code = fiscal.get("country_code", "TN")
    country_defaults = SUPPORTED_COUNTRIES.get(country_code, SUPPORTED_COUNTRIES["TN"])

    # Récupère les taxes personnalisées de l'entreprise
    custom_taxes = await db.company_tax_rates.find(
        {"company_id": ObjectId(company_id), "is_active": True}
    ).to_list(50)
    for t in custom_taxes:
        t["id"] = str(t["_id"])
        del t["_id"]
        t["company_id"] = str(t.get("company_id", ""))

    return {
        "company_id": company_id,
        "country_code": country_code,
        "country_name": country_defaults["name"],
        "currency": fiscal.get("currency", country_defaults["currency"]),
        "currency_symbol": country_defaults["currency_symbol"],
        "fiscal_year_start_month": fiscal.get("fiscal_year_start_month", 1),
        "default_vat_rate": fiscal.get("default_vat_rate", country_defaults["default_vat"]),
        "enable_fodec": fiscal.get("enable_fodec", country_defaults["has_fodec"]),
        "enable_stamp_duty": fiscal.get("enable_stamp_duty", country_defaults["has_stamp_duty"]),
        "enable_withholding_tax": fiscal.get("enable_withholding_tax", country_defaults["has_withholding_tax"]),
        "available_vat_rates": country_defaults["default_vat_rates"],
        "legal_mentions": country_defaults["legal_mentions"],
        "custom_tax_rates": custom_taxes,
        "rounding_mode": fiscal.get("rounding_mode", "3dp"),
    }


@router.put("/company-settings")
async def update_company_fiscal_settings(
    data: CompanyFiscalSettings,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Met à jour les paramètres fiscaux de l'entreprise."""
    company = await get_current_company(current_user, company_id)

    country_code = data.country_code.upper()
    if country_code not in SUPPORTED_COUNTRIES:
        raise HTTPException(status_code=400, detail=f"Pays '{country_code}' non supporté.")

    country_defaults = SUPPORTED_COUNTRIES[country_code]

    fiscal_settings = {
        "country_code": country_code,
        "currency": data.currency or country_defaults["currency"],
        "fiscal_year_start_month": data.fiscal_year_start_month,
        "default_vat_rate": data.default_vat_rate if data.default_vat_rate is not None else country_defaults["default_vat"],
        "enable_fodec": data.enable_fodec,
        "enable_stamp_duty": data.enable_stamp_duty,
        "enable_withholding_tax": data.enable_withholding_tax,
        "rounding_mode": data.rounding_mode,
        "invoice_footer_legal": data.invoice_footer_legal,
        "updated_at": datetime.now(timezone.utc),
    }

    await db.companies.update_one(
        {"_id": ObjectId(company_id)},
        {"$set": {"fiscal_settings": fiscal_settings, "primary_currency": fiscal_settings["currency"]}}
    )

    # Crée les taxes personnalisées si fournies
    if data.custom_tax_rates:
        for tax in data.custom_tax_rates:
            existing = await db.company_tax_rates.find_one({
                "company_id": ObjectId(company_id),
                "name": tax.name
            })
            if not existing:
                await db.company_tax_rates.insert_one({
                    "company_id": ObjectId(company_id),
                    "name": tax.name,
                    "rate": tax.rate,
                    "is_default": tax.is_default,
                    "applies_to": tax.applies_to,
                    "tax_type": tax.tax_type,
                    "description": tax.description,
                    "is_active": True,
                    "created_at": datetime.now(timezone.utc),
                })

    return {"message": "Paramètres fiscaux mis à jour", "country_code": country_code}


@router.post("/tax-rates")
async def create_custom_tax_rate(
    data: TaxRateCreate,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Crée un taux de taxe personnalisé pour l'entreprise."""
    await get_current_company(current_user, company_id)

    if data.is_default:
        await db.company_tax_rates.update_many(
            {"company_id": ObjectId(company_id), "tax_type": data.tax_type},
            {"$set": {"is_default": False}}
        )

    doc = {
        "company_id": ObjectId(company_id),
        "name": data.name,
        "rate": data.rate,
        "is_default": data.is_default,
        "applies_to": data.applies_to,
        "tax_type": data.tax_type,
        "description": data.description,
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.company_tax_rates.insert_one(doc)
    return {"id": str(result.inserted_id), "message": "Taux créé"}


@router.get("/tax-rates")
async def list_tax_rates(
    company_id: str = Query(...),
    tax_type: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """Liste les taux de taxe actifs de l'entreprise."""
    await get_current_company(current_user, company_id)

    query: dict = {"company_id": ObjectId(company_id), "is_active": True}
    if tax_type:
        query["tax_type"] = tax_type

    rates = await db.company_tax_rates.find(query).sort("rate", 1).to_list(100)
    for r in rates:
        r["id"] = str(r["_id"])
        del r["_id"]
        r["company_id"] = str(r.get("company_id", ""))
    return rates


@router.post("/initialize/{country_code}")
async def initialize_country_config(
    country_code: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Initialise les paramètres fiscaux et les taux de taxe pour un pays donné.
    Ne modifie pas le plan comptable existant (uniquement les paramètres fiscaux).
    """
    await get_current_company(current_user, company_id)

    code = country_code.upper()
    if code not in SUPPORTED_COUNTRIES:
        raise HTTPException(status_code=400, detail=f"Pays '{code}' non supporté.")

    cfg = SUPPORTED_COUNTRIES[code]

    # Mise à jour des paramètres fiscaux
    await db.companies.update_one(
        {"_id": ObjectId(company_id)},
        {"$set": {
            "fiscal_settings": {
                "country_code": code,
                "currency": cfg["currency"],
                "default_vat_rate": cfg["default_vat"],
                "enable_fodec": cfg["has_fodec"],
                "enable_stamp_duty": cfg["has_stamp_duty"],
                "enable_withholding_tax": cfg["has_withholding_tax"],
                "rounding_mode": "3dp" if code == "TN" else "2dp",
                "updated_at": datetime.now(timezone.utc),
            },
            "primary_currency": cfg["currency"],
        }}
    )

    # Création des taux TVA standards du pays
    created_rates = 0
    for rate_value in cfg["default_vat_rates"]:
        existing = await db.company_tax_rates.find_one({
            "company_id": ObjectId(company_id),
            "rate": rate_value,
            "tax_type": "vat"
        })
        if not existing:
            await db.company_tax_rates.insert_one({
                "company_id": ObjectId(company_id),
                "name": f"TVA {rate_value}%" if rate_value > 0 else "Exonéré",
                "rate": rate_value,
                "is_default": rate_value == cfg["default_vat"],
                "applies_to": "all",
                "tax_type": "vat",
                "is_active": True,
                "created_at": datetime.now(timezone.utc),
            })
            created_rates += 1

    return {
        "message": f"Configuration {cfg['name']} initialisée",
        "country_code": code,
        "currency": cfg["currency"],
        "vat_rates_created": created_rates,
    }
