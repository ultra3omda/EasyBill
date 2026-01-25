"""
Modèle pour les Bons de Sortie (Exit Vouchers)
Permet de gérer les sorties de stock sans facturation
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class ExitVoucherStatus(str, Enum):
    DRAFT = "draft"
    VALIDATED = "validated"
    CANCELLED = "cancelled"


class ExitVoucherItem(BaseModel):
    product_id: str
    product_name: Optional[str] = None
    quantity: float
    unit: Optional[str] = "unité"
    warehouse_id: Optional[str] = None
    notes: Optional[str] = None


class ExitVoucherCreate(BaseModel):
    number: Optional[str] = None
    date: Optional[datetime] = None
    reason: str = Field(..., description="Raison de la sortie (usage interne, don, perte, etc.)")
    destination: Optional[str] = None  # Département, personne, etc.
    warehouse_id: Optional[str] = None
    items: List[ExitVoucherItem]
    notes: Optional[str] = None
    reference: Optional[str] = None  # Référence externe


class ExitVoucherUpdate(BaseModel):
    reason: Optional[str] = None
    destination: Optional[str] = None
    warehouse_id: Optional[str] = None
    items: Optional[List[ExitVoucherItem]] = None
    notes: Optional[str] = None
    reference: Optional[str] = None
    status: Optional[ExitVoucherStatus] = None


class ExitVoucherResponse(BaseModel):
    id: str
    number: str
    date: datetime
    reason: str
    destination: Optional[str] = None
    warehouse_id: Optional[str] = None
    warehouse_name: Optional[str] = None
    items: List[ExitVoucherItem]
    total_items: int
    total_quantity: float
    status: ExitVoucherStatus
    notes: Optional[str] = None
    reference: Optional[str] = None
    company_id: str
    created_by: str
    created_at: datetime
    updated_at: datetime
    validated_at: Optional[datetime] = None
    validated_by: Optional[str] = None
