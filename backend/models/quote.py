from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from bson import ObjectId
from .user import PyObjectId

class DocumentItem(BaseModel):
    product_id: Optional[PyObjectId] = None
    description: str
    quantity: float = Field(gt=0)
    unit_price: float = Field(ge=0)
    tax_rate: float = Field(ge=0, le=100, default=0)
    discount: float = Field(ge=0, le=100, default=0)
    total: Optional[float] = Field(default=None, ge=0)  # Optional, auto-calculated if not provided

class Quote(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    company_id: PyObjectId
    number: str
    date: datetime
    valid_until: datetime
    customer_id: PyObjectId
    subject: Optional[str] = None
    items: List[DocumentItem]
    subtotal: float = 0.0
    total_tax: float = 0.0
    total_discount: float = 0.0
    total: float = 0.0
    payment_terms: Optional[str] = None
    notes: Optional[str] = None
    language: str = "fr"
    watermark: Optional[str] = None
    status: str = "draft"  # draft, sent, accepted, rejected, expired
    pdf_url: Optional[str] = None
    attachments: List[str] = []
    sent_at: Optional[datetime] = None
    converted_to_invoice: bool = False
    invoice_id: Optional[PyObjectId] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: Optional[PyObjectId] = None

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

class QuoteCreate(BaseModel):
    customer_id: str
    date: datetime = Field(default_factory=datetime.utcnow)
    valid_until: datetime
    subject: Optional[str] = None
    items: List[DocumentItem]
    payment_terms: Optional[str] = None
    notes: Optional[str] = None
    language: str = "fr"
    watermark: Optional[str] = None

class QuoteUpdate(BaseModel):
    date: Optional[datetime] = None
    valid_until: Optional[datetime] = None
    customer_id: Optional[str] = None
    subject: Optional[str] = None
    items: Optional[List[DocumentItem]] = None
    payment_terms: Optional[str] = None
    notes: Optional[str] = None
    language: Optional[str] = None
    status: Optional[str] = None