from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from bson import ObjectId
from .user import PyObjectId

class PaymentAllocation(BaseModel):
    invoice_id: PyObjectId
    amount: float = Field(gt=0)

class Payment(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    company_id: PyObjectId
    type: str  # received, sent
    date: datetime
    customer_id: Optional[PyObjectId] = None
    supplier_id: Optional[PyObjectId] = None
    amount: float = Field(gt=0)
    payment_method: str  # cash, check, transfer, card, e_dinar
    reference: Optional[str] = None
    bank_fees: float = 0.0
    allocations: List[PaymentAllocation]
    attachments: List[str] = []
    language: str = "fr"
    pdf_url: Optional[str] = None
    accounting_entry_id: Optional[PyObjectId] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: Optional[PyObjectId] = None

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

class PaymentCreate(BaseModel):
    type: str = "received"
    date: datetime = Field(default_factory=datetime.utcnow)
    customer_id: Optional[str] = None
    supplier_id: Optional[str] = None
    amount: float = Field(gt=0)
    payment_method: str
    reference: Optional[str] = None
    bank_fees: float = 0.0
    allocations: List[PaymentAllocation]
    attachments: List[str] = []
    language: str = "fr"