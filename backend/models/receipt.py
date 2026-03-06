"""
Modèle pour les Bons de Réception (Goods Receipt)
Permet de gérer les entrées de stock depuis les fournisseurs
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class ReceiptStatus(str, Enum):
    DRAFT = "draft"
    VALIDATED = "validated"
    CANCELLED = "cancelled"


class ReceiptItem(BaseModel):
    product_id: str
    product_name: Optional[str] = None
    ordered_quantity: Optional[float] = None  # Quantité commandée
    received_quantity: float  # Quantité reçue
    unit: Optional[str] = "unité"
    unit_price: Optional[float] = None
    warehouse_id: Optional[str] = None
    lot_number: Optional[str] = None
    expiry_date: Optional[datetime] = None
    notes: Optional[str] = None


class ReceiptCreate(BaseModel):
    number: Optional[str] = None
    date: Optional[datetime] = None
    supplier_id: str
    purchase_order_id: Optional[str] = None  # Lien avec bon de commande
    warehouse_id: Optional[str] = None
    items: List[ReceiptItem]
    notes: Optional[str] = None
    delivery_note_number: Optional[str] = None  # Numéro BL fournisseur
    carrier: Optional[str] = None  # Transporteur


class ReceiptUpdate(BaseModel):
    supplier_id: Optional[str] = None
    warehouse_id: Optional[str] = None
    items: Optional[List[ReceiptItem]] = None
    notes: Optional[str] = None
    delivery_note_number: Optional[str] = None
    carrier: Optional[str] = None
    status: Optional[ReceiptStatus] = None


class ReceiptResponse(BaseModel):
    id: str
    number: str
    date: datetime
    supplier_id: str
    supplier_name: Optional[str] = None
    purchase_order_id: Optional[str] = None
    purchase_order_number: Optional[str] = None
    warehouse_id: Optional[str] = None
    warehouse_name: Optional[str] = None
    items: List[ReceiptItem]
    total_items: int
    total_quantity: float
    total_value: Optional[float] = None
    status: ReceiptStatus
    notes: Optional[str] = None
    delivery_note_number: Optional[str] = None
    carrier: Optional[str] = None
    company_id: str
    created_by: str
    created_at: datetime
    updated_at: datetime
    validated_at: Optional[datetime] = None
    validated_by: Optional[str] = None
