from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from bson import ObjectId
from .user import PyObjectId

class Address(BaseModel):
    street: Optional[str] = None
    city: Optional[str] = None
    postal_code: Optional[str] = None
    country: str = "Tunisia"

class Tax(BaseModel):
    name: str
    rate: float
    default: bool = False

class Bank(BaseModel):
    name: str
    iban: Optional[str] = None
    bic: Optional[str] = None
    is_default: bool = False

class DocumentNumbering(BaseModel):
    invoice_prefix: str = "INV"
    invoice_next: int = 1
    quote_prefix: str = "QUO"
    quote_next: int = 1
    delivery_prefix: str = "BL"
    delivery_next: int = 1
    exit_prefix: str = "BS"
    exit_next: int = 1
    credit_prefix: str = "AV"
    credit_next: int = 1
    purchase_order_prefix: str = "BC"
    purchase_order_next: int = 1

class PDFSettings(BaseModel):
    show_logo: bool = True
    show_addresses: bool = True
    show_product_images: bool = False
    show_prices: bool = True
    footer_text: Optional[str] = None

class FiscalYear(BaseModel):
    start_date: datetime
    end_date: datetime

class Collaborator(BaseModel):
    user_id: PyObjectId
    role: str = "user"  # admin, manager, user
    permissions: List[str] = []
    invited_at: datetime = Field(default_factory=datetime.utcnow)
    accepted_at: Optional[datetime] = None
    status: str = "pending"  # pending, active, revoked

class Subscription(BaseModel):
    plan: str = "free"  # free, premium
    status: str = "active"  # active, expired, canceled
    expires_at: Optional[datetime] = None
    auto_renew: bool = False

class Company(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    name: str
    fiscal_id: Optional[str] = None
    activity: Optional[str] = None
    logo: Optional[str] = None
    slogan: Optional[str] = None
    address: Address = Field(default_factory=Address)
    primary_currency: str = "TND"
    taxes: List[Tax] = []
    banks: List[Bank] = []
    numbering: DocumentNumbering = Field(default_factory=DocumentNumbering)
    pdf_settings: PDFSettings = Field(default_factory=PDFSettings)
    fiscal_year: Optional[FiscalYear] = None
    owner_id: PyObjectId
    collaborators: List[Collaborator] = []
    subscription: Subscription = Field(default_factory=Subscription)
    fiscal_settings: Optional[dict] = None
    accounting_settings: Optional[dict] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

class CompanyCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    fiscal_id: Optional[str] = None
    activity: Optional[str] = None
    logo: Optional[str] = None
    address: Optional[Address] = None
    primary_currency: str = "TND"
    fiscal_settings: Optional[dict] = None

class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    fiscal_id: Optional[str] = None
    activity: Optional[str] = None
    logo: Optional[str] = None
    slogan: Optional[str] = None
    address: Optional[Address] = None
    primary_currency: Optional[str] = None
    taxes: Optional[List[Tax]] = None
    banks: Optional[List[Bank]] = None
    pdf_settings: Optional[PDFSettings] = None
    fiscal_year: Optional[FiscalYear] = None
    fiscal_settings: Optional[dict] = None
    accounting_settings: Optional[dict] = None