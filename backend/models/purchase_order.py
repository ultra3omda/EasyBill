from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from bson import ObjectId
from .user import PyObjectId
from .quote import DocumentItem

class PurchaseOrder(BaseModel):
    """Bon de commande fournisseur"""
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    company_id: PyObjectId
    number: str
    date: datetime
    expected_date: Optional[datetime] = None
    supplier_id: PyObjectId
    items: List[DocumentItem]
    subtotal: float = 0.0
    total_tax: float = 0.0
    total_discount: float = 0.0
    total: float = 0.0
    notes: Optional[str] = None
    status: str = "draft"  # draft, sent, confirmed, received, cancelled
    sent_at: Optional[datetime] = None
    confirmed_at: Optional[datetime] = None
    received_at: Optional[datetime] = None
    attachments: List[str] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: Optional[PyObjectId] = None

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

class PurchaseOrderCreate(BaseModel):
    supplier_id: str
    date: datetime = Field(default_factory=datetime.utcnow)
    expected_date: Optional[datetime] = None
    items: List[DocumentItem]
    notes: Optional[str] = None

class PurchaseOrderUpdate(BaseModel):
    date: Optional[datetime] = None
    expected_date: Optional[datetime] = None
    supplier_id: Optional[str] = None
    items: Optional[List[DocumentItem]] = None
    notes: Optional[str] = None
    status: Optional[str] = None
