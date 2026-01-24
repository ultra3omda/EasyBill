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
    title: Optional[str] = "mr"
    first_name: str = Field(min_length=1, max_length=50)
    last_name: Optional[str] = Field(None, max_length=50)
    company_name: Optional[str] = None
    display_name: str
    reference: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    website: Optional[str] = None
    client_type: str = "entreprise"  # "entreprise" or "particulier"
    fiscal_id: Optional[str] = None
    identity_number: Optional[str] = None  # For particulier
    activity: Optional[str] = None
    price_grid: Optional[str] = "default"
    currency: str = "TND"
    payment_terms: Optional[str] = "immediate"
    birthday: Optional[str] = None  # For particulier
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
    title: Optional[str] = "mr"
    first_name: str = Field(min_length=1, max_length=50)
    last_name: Optional[str] = Field(None, max_length=50)
    company_name: Optional[str] = None
    display_name: Optional[str] = None
    reference: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    website: Optional[str] = None
    client_type: Optional[str] = "entreprise"
    fiscal_id: Optional[str] = None
    identity_number: Optional[str] = None
    activity: Optional[str] = None
    price_grid: Optional[str] = "default"
    currency: str = "TND"
    payment_terms: Optional[str] = "immediate"
    birthday: Optional[str] = None
    billing_address: Optional[Address] = None
    shipping_address: Optional[Address] = None
    notes: Optional[str] = None

class CustomerUpdate(BaseModel):
    title: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    company_name: Optional[str] = None
    display_name: Optional[str] = None
    reference: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    website: Optional[str] = None
    client_type: Optional[str] = None
    fiscal_id: Optional[str] = None
    identity_number: Optional[str] = None
    activity: Optional[str] = None
    price_grid: Optional[str] = None
    currency: Optional[str] = None
    payment_terms: Optional[str] = None
    birthday: Optional[str] = None
    billing_address: Optional[Address] = None
    shipping_address: Optional[Address] = None
    notes: Optional[str] = None
