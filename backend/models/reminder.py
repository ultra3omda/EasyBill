from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from bson import ObjectId
from .user import PyObjectId

class Reminder(BaseModel):
    """Rappel de paiement"""
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    company_id: PyObjectId
    number: str
    date: datetime
    customer_id: PyObjectId
    invoice_ids: List[PyObjectId] = []
    level: int = 1  # 1, 2, 3 (relance 1, 2, 3)
    total_due: float = 0.0
    late_fees: float = 0.0
    message: Optional[str] = None
    status: str = "draft"  # draft, sent, acknowledged, resolved
    sent_at: Optional[datetime] = None
    sent_via: Optional[str] = None  # email, sms, mail
    response_date: Optional[datetime] = None
    response_notes: Optional[str] = None
    next_reminder_date: Optional[datetime] = None
    attachments: List[str] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: Optional[PyObjectId] = None

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

class ReminderCreate(BaseModel):
    customer_id: str
    date: datetime = Field(default_factory=datetime.utcnow)
    invoice_ids: List[str] = []
    level: int = 1
    late_fees: float = 0.0
    message: Optional[str] = None
    sent_via: Optional[str] = None
    next_reminder_date: Optional[datetime] = None

class ReminderUpdate(BaseModel):
    date: Optional[datetime] = None
    invoice_ids: Optional[List[str]] = None
    level: Optional[int] = None
    late_fees: Optional[float] = None
    message: Optional[str] = None
    status: Optional[str] = None
    sent_via: Optional[str] = None
    response_notes: Optional[str] = None
    next_reminder_date: Optional[datetime] = None
