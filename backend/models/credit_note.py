from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from bson import ObjectId
from .user import PyObjectId
from .quote import DocumentItem

class CreditNote(BaseModel):
    """Facture d'avoir"""
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    company_id: PyObjectId
    number: str
    date: datetime
    customer_id: PyObjectId
    invoice_id: Optional[PyObjectId] = None  # Facture d'origine
    reason: str  # return, discount, error, other
    items: List[DocumentItem]
    subtotal: float = 0.0
    total_tax: float = 0.0
    total_discount: float = 0.0
    total: float = 0.0
    notes: Optional[str] = None
    status: str = "draft"  # draft, issued, applied, cancelled
    applied_at: Optional[datetime] = None
    refund_method: Optional[str] = None  # credit, refund, offset
    refund_amount: float = 0.0
    attachments: List[str] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: Optional[PyObjectId] = None

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

class CreditNoteCreate(BaseModel):
    customer_id: str
    date: datetime = Field(default_factory=datetime.utcnow)
    invoice_id: Optional[str] = None
    reason: str = "return"
    items: List[DocumentItem]
    notes: Optional[str] = None
    refund_method: Optional[str] = None

class CreditNoteUpdate(BaseModel):
    date: Optional[datetime] = None
    customer_id: Optional[str] = None
    invoice_id: Optional[str] = None
    reason: Optional[str] = None
    items: Optional[List[DocumentItem]] = None
    notes: Optional[str] = None
    status: Optional[str] = None
    refund_method: Optional[str] = None
