from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class JournalEntryLine(BaseModel):
    account_code: str
    account_name: Optional[str] = None
    debit: float = 0
    credit: float = 0
    description: Optional[str] = None


class JournalEntryCreate(BaseModel):
    date: datetime
    reference: Optional[str] = None
    description: str
    journal_type: str = "general"  # general, sales, purchases, bank, cash
    lines: List[JournalEntryLine]
    document_type: Optional[str] = None  # invoice, quote, payment, etc.
    document_id: Optional[str] = None


class JournalEntryUpdate(BaseModel):
    date: Optional[datetime] = None
    reference: Optional[str] = None
    description: Optional[str] = None
    lines: Optional[List[JournalEntryLine]] = None
    status: Optional[str] = None  # draft, posted, cancelled
