from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime
from bson import ObjectId
from .user import PyObjectId
from .company import Address

class PublicAccess(BaseModel):
    enabled: bool = False
    token: Optional[str] = None
    invited_at: Optional[datetime] = None

class Customer(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    company_id: PyObjectId
    first_name: str = Field(min_length=3, max_length=30)
    last_name: Optional[str] = Field(None, min_length=3, max_length=30)
    company_name: Optional[str] = None
    display_name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    fiscal_id: Optional[str] = None
    activity: Optional[str] = None
    currency: str = "TND"
    billing_address: Address = Field(default_factory=Address)
    shipping_address: Address = Field(default_factory=Address)
    notes: Optional[str] = None
    balance: float = 0.0
    total_invoiced: float = 0.0
    total_paid: float = 0.0
    invoice_count: int = 0
    quote_count: int = 0
    public_access: PublicAccess = Field(default_factory=PublicAccess)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: Optional[PyObjectId] = None

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

class CustomerCreate(BaseModel):
    first_name: str = Field(min_length=3, max_length=30)
    last_name: Optional[str] = Field(None, min_length=3, max_length=30)
    company_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    fiscal_id: Optional[str] = None
    activity: Optional[str] = None
    currency: str = "TND"
    billing_address: Optional[Address] = None
    shipping_address: Optional[Address] = None
    notes: Optional[str] = None

class CustomerUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    company_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    fiscal_id: Optional[str] = None
    activity: Optional[str] = None
    currency: Optional[str] = None
    billing_address: Optional[Address] = None
    shipping_address: Optional[Address] = None
    notes: Optional[str] = None