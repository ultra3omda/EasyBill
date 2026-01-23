from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from bson import ObjectId
from .user import PyObjectId

class Task(BaseModel):
    name: str
    description: Optional[str] = None
    estimated_hours: float = 0.0
    actual_hours: float = 0.0
    status: str = "pending"  # pending, in_progress, completed
    assigned_to: Optional[PyObjectId] = None

class Project(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    company_id: PyObjectId
    name: str
    customer_id: PyObjectId
    description: Optional[str] = None
    budget: float = 0.0
    spent: float = 0.0
    total_hours: float = 0.0
    start_date: datetime
    end_date: datetime
    status: str = "planning"  # planning, in_progress, completed, cancelled
    billing_type: str = "hourly"  # hourly, fixed, resources
    hourly_rate: float = 0.0
    tasks: List[Task] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: Optional[PyObjectId] = None

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

class ProjectCreate(BaseModel):
    name: str = Field(min_length=2)
    customer_id: str
    description: Optional[str] = None
    budget: float = Field(ge=0, default=0)
    start_date: datetime
    end_date: datetime
    billing_type: str = "hourly"
    hourly_rate: float = Field(ge=0, default=0)
    tasks: List[Task] = []

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    customer_id: Optional[str] = None
    description: Optional[str] = None
    budget: Optional[float] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    status: Optional[str] = None
    billing_type: Optional[str] = None
    hourly_rate: Optional[float] = None
    tasks: Optional[List[Task]] = None