from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime
from bson import ObjectId

class PyObjectId(str):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(str(v)):
            raise ValueError("Invalid ObjectId")
        return str(v)
    
    @classmethod
    def __get_pydantic_core_schema__(cls, _source_type, _handler):
        from pydantic_core import core_schema
        return core_schema.union_schema([
            core_schema.is_instance_schema(ObjectId),
            core_schema.chain_schema([
                core_schema.str_schema(),
                core_schema.no_info_plain_validator_function(cls.validate),
            ])
        ],
        serialization=core_schema.plain_serializer_function_ser_schema(
            lambda x: str(x)
        )
        )

class SocialAccount(BaseModel):
    provider: str  # google, facebook
    provider_id: str

class Session(BaseModel):
    device: str
    ip: str
    user_agent: str
    last_activity: datetime = Field(default_factory=datetime.utcnow)

class NotificationPreferences(BaseModel):
    login: bool = True
    company_ending: bool = True
    invitation_expired: bool = True
    subscription_ending: bool = True
    support: bool = True
    news_updates: bool = True

class UserPreferences(BaseModel):
    notifications: NotificationPreferences = Field(default_factory=NotificationPreferences)
    language: str = "fr"

class User(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    email: EmailStr
    password_hash: Optional[str] = None
    full_name: str
    phone: Optional[str] = None
    photo: Optional[str] = None
    birth_date: Optional[datetime] = None
    gender: Optional[str] = None
    social_accounts: List[SocialAccount] = []
    referral_code: Optional[str] = None
    referral_earnings: float = 0.0
    api_key: Optional[str] = None
    api_quota: int = 100
    email_verified: bool = False
    verification_token: Optional[str] = None
    reset_token: Optional[str] = None
    reset_token_expiry: Optional[datetime] = None
    preferences: UserPreferences = Field(default_factory=UserPreferences)
    sessions: List[Session] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    full_name: str = Field(min_length=3, max_length=100)
    company_name: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    photo: Optional[str] = None
    birth_date: Optional[datetime] = None
    gender: Optional[str] = None
    preferences: Optional[UserPreferences] = None

class PasswordUpdate(BaseModel):
    old_password: Optional[str] = None
    new_password: str = Field(min_length=6)
    confirm_password: str

class ForgotPassword(BaseModel):
    email: EmailStr

class ResetPassword(BaseModel):
    token: str
    new_password: str = Field(min_length=6)
    confirm_password: str