from pydantic import BaseModel, Field, validator
from typing import Optional, List, Union, Any
from datetime import datetime
from bson import ObjectId
from .user import PyObjectId


def _addr_to_str(v: Any) -> Optional[str]:
    """Convertit une adresse (dict ou str) en string plate."""
    if v is None:
        return None
    if isinstance(v, dict):
        parts = [
            v.get("street") or v.get("line1") or v.get("address", ""),
            v.get("postal_code") or v.get("zip", ""),
            v.get("city", ""),
            v.get("country", ""),
        ]
        return ", ".join(str(p) for p in parts if p) or None
    return str(v) if v else None

class DocumentItem(BaseModel):
    product_id: Optional[str] = None
    description: Optional[str] = ""
    quantity: float = Field(gt=0, default=1)
    unit_price: float = Field(ge=0, default=0)
    tax_rate: float = Field(ge=0, le=100, default=0)
    discount: float = Field(ge=0, le=100, default=0)
    total: Optional[float] = Field(default=None, ge=0)

    class Config:
        extra = "allow"

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
    valid_until: Optional[datetime] = None
    subject: Optional[str] = None
    items: List[DocumentItem]
    payment_terms: Optional[str] = None
    notes: Optional[str] = None
    language: str = "fr"
    watermark: Optional[str] = None
    billing_address: Optional[Any] = None
    shipping_address: Optional[Any] = None

    @validator("billing_address", "shipping_address", pre=True, always=True)
    def coerce_address(cls, v):
        return _addr_to_str(v)
    reference: Optional[str] = None
    terms: Optional[str] = None
    remarks: Optional[str] = None
    discount_type: Optional[str] = "amount"
    discount_value: float = 0
    fiscal_stamp: float = 0
    show_fiscal_stamp: bool = True
    category: Optional[str] = None
    show_description: bool = True
    show_unit: bool = True
    show_ttc_price: bool = False
    show_billing_address: bool = True
    show_shipping_address: bool = False
    show_terms: bool = True
    show_bank_details: bool = True
    number: Optional[str] = None
    status: Optional[str] = "draft"
    subtotal: float = 0
    total_discount: float = 0
    total_tax: float = 0
    total: float = 0

    class Config:
        extra = "allow"

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
    watermark: Optional[str] = None
    billing_address: Optional[Any] = None
    shipping_address: Optional[Any] = None

    @validator("billing_address", "shipping_address", pre=True, always=True)
    def coerce_address(cls, v):
        return _addr_to_str(v)
    reference: Optional[str] = None
    terms: Optional[str] = None
    remarks: Optional[str] = None
    discount_type: Optional[str] = None
    discount_value: Optional[float] = None
    fiscal_stamp: Optional[float] = None
    show_fiscal_stamp: Optional[bool] = None
    show_description: Optional[bool] = None
    show_unit: Optional[bool] = None
    show_ttc_price: Optional[bool] = None
    show_photos: Optional[bool] = None
    show_billing_address: Optional[bool] = None
    show_shipping_address: Optional[bool] = None
    show_terms: Optional[bool] = None
    show_bank_details: Optional[bool] = None
    category: Optional[str] = None
    number: Optional[str] = None
    subtotal: Optional[float] = None
    total_discount: Optional[float] = None
    total_tax: Optional[float] = None
    total: Optional[float] = None

    class Config:
        extra = "allow"