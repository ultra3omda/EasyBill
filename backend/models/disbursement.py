"""
Modèle pour les Notes de Débours (Disbursement Notes)
Permet de refacturer des frais avancés pour le compte d'un client
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class DisbursementStatus(str, Enum):
    DRAFT = "draft"
    SENT = "sent"
    INVOICED = "invoiced"  # Converti en facture
    CANCELLED = "cancelled"


class DisbursementItem(BaseModel):
    description: str
    date: Optional[datetime] = None
    amount: float
    tax_rate: Optional[float] = 0
    tax_amount: Optional[float] = 0
    total: Optional[float] = None
    category: Optional[str] = None  # Transport, Hébergement, etc.
    receipt_number: Optional[str] = None  # Numéro du justificatif
    notes: Optional[str] = None


class DisbursementCreate(BaseModel):
    number: Optional[str] = None
    date: Optional[datetime] = None
    customer_id: str
    project_id: Optional[str] = None
    items: List[DisbursementItem]
    notes: Optional[str] = None
    payment_terms: Optional[str] = None
    due_date: Optional[datetime] = None


class DisbursementUpdate(BaseModel):
    customer_id: Optional[str] = None
    project_id: Optional[str] = None
    items: Optional[List[DisbursementItem]] = None
    notes: Optional[str] = None
    payment_terms: Optional[str] = None
    due_date: Optional[datetime] = None
    status: Optional[DisbursementStatus] = None


class DisbursementResponse(BaseModel):
    id: str
    number: str
    date: datetime
    customer_id: str
    customer_name: Optional[str] = None
    project_id: Optional[str] = None
    project_name: Optional[str] = None
    items: List[DisbursementItem]
    subtotal: float
    tax_amount: float
    total: float
    status: DisbursementStatus
    notes: Optional[str] = None
    payment_terms: Optional[str] = None
    due_date: Optional[datetime] = None
    invoice_id: Optional[str] = None  # Si converti en facture
    company_id: str
    created_by: str
    created_at: datetime
    updated_at: datetime
