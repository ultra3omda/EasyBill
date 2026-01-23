from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from bson import ObjectId
from .user import PyObjectId

class Product(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    company_id: PyObjectId
    name: str
    sku: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    type: str = "product"  # product, service
    unit_price: float
    tax_rate: float = 0.0
    unit: str = "Unité"
    stock_quantity: Optional[int] = None
    min_stock: Optional[int] = None
    max_stock: Optional[int] = None
    images: List[str] = []
    barcode: Optional[str] = None
    default_supplier_id: Optional[PyObjectId] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

class ProductCreate(BaseModel):
    name: str = Field(min_length=2)
    sku: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    type: str = "product"
    unit_price: float = Field(ge=0)
    tax_rate: float = Field(ge=0, le=100, default=0)
    unit: str = "Unité"
    stock_quantity: Optional[int] = None
    min_stock: Optional[int] = None
    max_stock: Optional[int] = None
    images: List[str] = []
    barcode: Optional[str] = None

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    sku: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    type: Optional[str] = None
    unit_price: Optional[float] = None
    tax_rate: Optional[float] = None
    unit: Optional[str] = None
    stock_quantity: Optional[int] = None
    min_stock: Optional[int] = None
    max_stock: Optional[int] = None
    images: Optional[List[str]] = None
    barcode: Optional[str] = None
    is_active: Optional[bool] = None