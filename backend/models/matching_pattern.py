from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field
from bson import ObjectId

from .user import PyObjectId


class MatchingPattern(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    company_id: PyObjectId
    pattern_type: str
    raw_pattern: str
    normalized_pattern: str
    transaction_type: Optional[str] = None
    supplier_id: Optional[PyObjectId] = None
    entity_type: Optional[str] = None
    entity_id: Optional[PyObjectId] = None
    default_account_code: Optional[str] = None
    suggested_debit_account_code: Optional[str] = None
    suggested_credit_account_code: Optional[str] = None
    confidence: str = "faible"
    times_confirmed: int = 0
    source: str = "user"
    is_active: bool = True
    last_used_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}
