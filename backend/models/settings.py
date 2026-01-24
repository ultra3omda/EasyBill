from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from bson import ObjectId
from .user import PyObjectId

class AdditionalEntry(BaseModel):
    """Entrée supplémentaire (Timbre fiscal, etc.)"""
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    company_id: PyObjectId
    title: str
    value: float  # Valeur par défaut
    type: str = "fixed"  # "fixed" ou "percentage"
    calculation: str = "after_tax"  # "before_tax" ou "after_tax"
    sign: str = "positive"  # "positive" ou "negative"
    usage: str = "everywhere"  # "manual", "everywhere", "country_specific", "currency_specific"
    country_condition: Optional[str] = None  # Si usage = country_specific
    currency_condition: Optional[str] = None  # Si usage = currency_specific
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

class AdditionalEntryCreate(BaseModel):
    title: str
    value: float
    type: str = "fixed"
    calculation: str = "after_tax"
    sign: str = "positive"
    usage: str = "everywhere"
    country_condition: Optional[str] = None
    currency_condition: Optional[str] = None

class AdditionalEntryUpdate(BaseModel):
    title: Optional[str] = None
    value: Optional[float] = None
    type: Optional[str] = None
    calculation: Optional[str] = None
    sign: Optional[str] = None
    usage: Optional[str] = None
    country_condition: Optional[str] = None
    currency_condition: Optional[str] = None
    is_active: Optional[bool] = None


class Tax(BaseModel):
    """Taxe (TVA, FODEC, etc.)"""
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    company_id: PyObjectId
    name: str
    rate: float
    description: Optional[str] = None
    is_default: bool = False
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

class TaxCreate(BaseModel):
    name: str
    rate: float
    description: Optional[str] = None
    is_default: bool = False

class TaxUpdate(BaseModel):
    name: Optional[str] = None
    rate: Optional[float] = None
    description: Optional[str] = None
    is_default: Optional[bool] = None
    is_active: Optional[bool] = None


class Bank(BaseModel):
    """Banque"""
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    company_id: PyObjectId
    name: str
    rib: Optional[str] = None
    iban: Optional[str] = None
    bic: Optional[str] = None
    is_default: bool = False
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

class BankCreate(BaseModel):
    name: str
    rib: Optional[str] = None
    iban: Optional[str] = None
    bic: Optional[str] = None
    is_default: bool = False

class BankUpdate(BaseModel):
    name: Optional[str] = None
    rib: Optional[str] = None
    iban: Optional[str] = None
    bic: Optional[str] = None
    is_default: Optional[bool] = None
    is_active: Optional[bool] = None


class PaymentMethod(BaseModel):
    """Méthode de paiement"""
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    company_id: PyObjectId
    name: str
    description: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

class PaymentMethodCreate(BaseModel):
    name: str
    description: Optional[str] = None


class PurchaseCategory(BaseModel):
    """Catégorie d'achat"""
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    company_id: PyObjectId
    name: str
    description: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

class PurchaseCategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None


class WithholdingType(BaseModel):
    """Type de retenue à la source"""
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    company_id: PyObjectId
    name: str
    rate: float
    description: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

class WithholdingTypeCreate(BaseModel):
    name: str
    rate: float
    description: Optional[str] = None


class AccessLog(BaseModel):
    """Journal d'accès"""
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    company_id: PyObjectId
    user_id: PyObjectId
    user_name: str
    category: str  # Entreprise, Taxe, Client, Facture, etc.
    action: str  # Créer, Mise à jour, Supprimer
    element: str  # Nom de l'élément
    ip_address: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}
