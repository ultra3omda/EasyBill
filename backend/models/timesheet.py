from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from bson import ObjectId
from .user import PyObjectId

class Timesheet(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    company_id: PyObjectId
    project_id: PyObjectId
    user_id: PyObjectId
    task_name: Optional[str] = None
    date: datetime
    hours: float = Field(gt=0)
    hourly_rate: float = 0.0
    is_billable: bool = True
    is_billed: bool = False
    invoice_id: Optional[PyObjectId] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

class TimesheetCreate(BaseModel):
    project_id: str
    task_name: Optional[str] = None
    date: datetime = Field(default_factory=datetime.utcnow)
    hours: float = Field(gt=0)
    hourly_rate: float = Field(ge=0, default=0)
    is_billable: bool = True
    notes: Optional[str] = None