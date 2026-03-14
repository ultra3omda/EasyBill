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
    brand: Optional[str] = None
    type: str = "product"
    selling_price: float = Field(ge=0, default=0)
    purchase_price: float = Field(ge=0, default=0)
    # Alias pour compatibilité avec ProductFormModal
    unit_price: Optional[float] = Field(ge=0, default=None)
    tax_rate: float = Field(ge=0, le=100, default=0)
    tax_id: Optional[str] = None
    unit: str = "pièce"
    quantity_in_stock: Optional[int] = Field(default=0, ge=0)
    min_stock_level: Optional[int] = Field(default=0, ge=0)
    stock_quantity: Optional[int] = None  # alias legacy
    min_stock: Optional[int] = None       # alias legacy
    max_stock: Optional[int] = None
    warehouse_id: Optional[str] = None
    destination: str = "both"
    reference_type: str = "disabled"
    quantity_type: str = "simple"
    composite_field_name: Optional[str] = None
    composite_operation: str = "multiply"
    barcode: Optional[str] = None
    is_composite: bool = False
    components: List = []
    images: List[str] = []

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    sku: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    brand: Optional[str] = None
    type: Optional[str] = None
    selling_price: Optional[float] = None
    purchase_price: Optional[float] = None
    unit_price: Optional[float] = None
    tax_rate: Optional[float] = None
    tax_id: Optional[str] = None
    unit: Optional[str] = None
    quantity_in_stock: Optional[int] = None
    min_stock_level: Optional[int] = None
    stock_quantity: Optional[int] = None
    min_stock: Optional[int] = None
    max_stock: Optional[int] = None
    warehouse_id: Optional[str] = None
    destination: Optional[str] = None
    reference_type: Optional[str] = None
    quantity_type: Optional[str] = None
    barcode: Optional[str] = None
    is_composite: Optional[bool] = None
    components: Optional[List] = None
    images: Optional[List[str]] = None
    is_active: Optional[bool] = None