from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field
from bson import ObjectId

from .user import PyObjectId


class SupplierAccountMapping(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    company_id: PyObjectId
    supplier_id: Optional[PyObjectId] = None
    supplier_pattern: str
    normalized_supplier_pattern: str
    default_expense_account_id: Optional[PyObjectId] = None
    default_expense_account_code: Optional[str] = None
    semantic_key: Optional[str] = None
    category: Optional[str] = None
    confidence: str = "faible"
    source: str = "user"
    times_confirmed: int = 0
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}
