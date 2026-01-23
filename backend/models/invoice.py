from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from bson import ObjectId
from .user import PyObjectId
from .quote import DocumentItem

class Recurrence(BaseModel):
    frequency: str  # daily, weekly, monthly, yearly
    interval: int = 1
    next_date: Optional[datetime] = None

class Invoice(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    company_id: PyObjectId
    number: str
    date: datetime
    due_date: datetime
    customer_id: PyObjectId
    subject: Optional[str] = None
    items: List[DocumentItem]
    subtotal: float = 0.0
    total_tax: float = 0.0
    total_discount: float = 0.0
    total: float = 0.0
    amount_paid: float = 0.0
    balance_due: float = 0.0
    payment_terms: Optional[str] = None
    notes: Optional[str] = None
    language: str = "fr"
    watermark: Optional[str] = None
    status: str = "draft"  # draft, sent, partial, paid, overdue, cancelled
    pdf_url: Optional[str] = None
    attachments: List[str] = []
    sent_at: Optional[datetime] = None
    paid_at: Optional[datetime] = None
    is_recurring: bool = False
    recurrence: Optional[Recurrence] = None
    quote_id: Optional[PyObjectId] = None
    delivery_id: Optional[PyObjectId] = None
    accounting_entry_id: Optional[PyObjectId] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: Optional[PyObjectId] = None

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

class InvoiceCreate(BaseModel):
    customer_id: str
    date: datetime = Field(default_factory=datetime.utcnow)
    due_date: datetime
    subject: Optional[str] = None
    items: List[DocumentItem]
    payment_terms: Optional[str] = None
    notes: Optional[str] = None
    language: str = "fr"
    watermark: Optional[str] = None
    is_recurring: bool = False
    recurrence: Optional[Recurrence] = None

class InvoiceUpdate(BaseModel):
    date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    customer_id: Optional[str] = None
    subject: Optional[str] = None
    items: Optional[List[DocumentItem]] = None
    payment_terms: Optional[str] = None
    notes: Optional[str] = None
    language: Optional[str] = None
    status: Optional[str] = None
    is_recurring: Optional[bool] = None
    recurrence: Optional[Recurrence] = None