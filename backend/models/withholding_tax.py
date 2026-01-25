"""
Modèle pour les Retenues à la Source (Withholding Tax)
Conformité fiscale tunisienne - Gestion des retenues à la source
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class WithholdingTaxType(str, Enum):
    RS_HONORAIRES = "rs_honoraires"  # Retenue sur honoraires (15%)
    RS_LOYERS = "rs_loyers"  # Retenue sur loyers (15%)
    RS_COMMISSIONS = "rs_commissions"  # Retenue sur commissions (15%)
    RS_REDEVANCES = "rs_redevances"  # Retenue sur redevances (15%)
    RS_INTERETS = "rs_interets"  # Retenue sur intérêts (20%)
    RS_DIVIDENDES = "rs_dividendes"  # Retenue sur dividendes (10%)
    RS_MARCHES = "rs_marches"  # Retenue sur marchés (1.5%)
    RS_SERVICES = "rs_services"  # Retenue sur services (3%)
    RS_AUTRES = "rs_autres"  # Autres retenues


class WithholdingTaxStatus(str, Enum):
    DRAFT = "draft"
    VALIDATED = "validated"
    DECLARED = "declared"  # Déclaré aux impôts
    PAID = "paid"  # Payé aux impôts
    CANCELLED = "cancelled"


# Taux de retenue par défaut selon la législation tunisienne
WITHHOLDING_TAX_RATES = {
    "rs_honoraires": 15.0,
    "rs_loyers": 15.0,
    "rs_commissions": 15.0,
    "rs_redevances": 15.0,
    "rs_interets": 20.0,
    "rs_dividendes": 10.0,
    "rs_marches": 1.5,
    "rs_services": 3.0,
    "rs_autres": 0.0
}


class WithholdingTaxCreate(BaseModel):
    number: Optional[str] = None
    date: Optional[datetime] = None
    supplier_id: str
    supplier_invoice_id: Optional[str] = None  # Lien avec facture fournisseur
    payment_id: Optional[str] = None  # Lien avec paiement
    tax_type: WithholdingTaxType
    base_amount: float  # Montant de base soumis à retenue
    tax_rate: Optional[float] = None  # Taux de retenue (si différent du défaut)
    tax_amount: Optional[float] = None  # Montant de la retenue (calculé si non fourni)
    fiscal_year: Optional[int] = None
    fiscal_quarter: Optional[int] = None  # 1, 2, 3 ou 4
    notes: Optional[str] = None


class WithholdingTaxUpdate(BaseModel):
    supplier_id: Optional[str] = None
    tax_type: Optional[WithholdingTaxType] = None
    base_amount: Optional[float] = None
    tax_rate: Optional[float] = None
    tax_amount: Optional[float] = None
    fiscal_year: Optional[int] = None
    fiscal_quarter: Optional[int] = None
    notes: Optional[str] = None
    status: Optional[WithholdingTaxStatus] = None


class WithholdingTaxResponse(BaseModel):
    id: str
    number: str
    date: datetime
    supplier_id: str
    supplier_name: Optional[str] = None
    supplier_tax_id: Optional[str] = None  # Matricule fiscal
    supplier_invoice_id: Optional[str] = None
    supplier_invoice_number: Optional[str] = None
    payment_id: Optional[str] = None
    tax_type: WithholdingTaxType
    tax_type_label: Optional[str] = None
    base_amount: float
    tax_rate: float
    tax_amount: float
    fiscal_year: int
    fiscal_quarter: int
    status: WithholdingTaxStatus
    notes: Optional[str] = None
    declaration_date: Optional[datetime] = None
    payment_date: Optional[datetime] = None
    company_id: str
    created_by: str
    created_at: datetime
    updated_at: datetime


# Labels pour les types de retenue
WITHHOLDING_TAX_LABELS = {
    "rs_honoraires": "Retenue sur honoraires",
    "rs_loyers": "Retenue sur loyers",
    "rs_commissions": "Retenue sur commissions",
    "rs_redevances": "Retenue sur redevances",
    "rs_interets": "Retenue sur intérêts",
    "rs_dividendes": "Retenue sur dividendes",
    "rs_marches": "Retenue sur marchés",
    "rs_services": "Retenue sur services",
    "rs_autres": "Autres retenues"
}
