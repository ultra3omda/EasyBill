from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from bson import ObjectId
from .user import PyObjectId
from .quote import DocumentItem

class SupplierInvoice(BaseModel):
    """Facture fournisseur"""
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    company_id: PyObjectId
    number: str
    supplier_number: Optional[str] = None  # Numéro de facture du fournisseur
    date: datetime
    due_date: datetime
    supplier_id: PyObjectId
    purchase_order_id: Optional[PyObjectId] = None
    items: List[DocumentItem]
    subtotal: float = 0.0
    total_tax: float = 0.0
    total_discount: float = 0.0
    total: float = 0.0
    amount_paid: float = 0.0
    balance_due: float = 0.0
    notes: Optional[str] = None
    status: str = "draft"  # draft, received, partial, paid, cancelled
    paid_at: Optional[datetime] = None
    attachments: List[str] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: Optional[PyObjectId] = None

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

class SupplierInvoiceCreate(BaseModel):
    supplier_id: str
    supplier_number: Optional[str] = None
    date: datetime = Field(default_factory=datetime.utcnow)
    due_date: datetime
    purchase_order_id: Optional[str] = None
    items: List[DocumentItem]
    notes: Optional[str] = None

class SupplierInvoiceUpdate(BaseModel):
    date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    supplier_id: Optional[str] = None
    supplier_number: Optional[str] = None
    items: Optional[List[DocumentItem]] = None
    notes: Optional[str] = None
    status: Optional[str] = None
