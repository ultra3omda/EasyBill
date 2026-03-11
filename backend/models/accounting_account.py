from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field
from bson import ObjectId

from .user import PyObjectId


class AccountingAccount(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    company_id: PyObjectId
    code: str
    name: str
    label: Optional[str] = None
    type: str
    class_name: Optional[str] = Field(default=None, alias="class")
    category: Optional[str] = None
    parent_code: Optional[str] = None
    semantic_key: Optional[str] = None
    country_code: Optional[str] = None
    code_system: Optional[str] = None
    is_group: bool = False
    is_system: bool = False
    is_system_default: bool = False
    is_user_editable: bool = True
    protected: bool = False
    is_active: bool = True
    balance: float = 0.0
    metadata: dict = {}
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}
