from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field
from bson import ObjectId

from .user import PyObjectId


class ChartOfAccountsConfig(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    company_id: PyObjectId
    country_code: str = "TN"
    code_system: str = "SCE_TN"
    chart_initialized: bool = False
    configuration_warnings: list[str] = []
    processing_controls: dict = {}
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}
