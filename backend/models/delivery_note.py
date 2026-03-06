from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from bson import ObjectId
from .user import PyObjectId
from .quote import DocumentItem

class DeliveryNote(BaseModel):
    """Bon de livraison"""
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    company_id: PyObjectId
    number: str
    date: datetime
    customer_id: PyObjectId
    invoice_id: Optional[PyObjectId] = None
    quote_id: Optional[PyObjectId] = None
    shipping_address: Optional[dict] = None
    items: List[DocumentItem]
    notes: Optional[str] = None
    status: str = "draft"  # draft, delivered, cancelled
    delivered_at: Optional[datetime] = None
    delivery_person: Optional[str] = None
    signature_url: Optional[str] = None
    attachments: List[str] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: Optional[PyObjectId] = None

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

class DeliveryNoteCreate(BaseModel):
    customer_id: str
    date: datetime = Field(default_factory=datetime.utcnow)
    invoice_id: Optional[str] = None
    quote_id: Optional[str] = None
    shipping_address: Optional[dict] = None
    items: List[DocumentItem]
    notes: Optional[str] = None
    delivery_person: Optional[str] = None

class DeliveryNoteUpdate(BaseModel):
    date: Optional[datetime] = None
    customer_id: Optional[str] = None
    shipping_address: Optional[dict] = None
    items: Optional[List[DocumentItem]] = None
    notes: Optional[str] = None
    status: Optional[str] = None
    delivery_person: Optional[str] = None
