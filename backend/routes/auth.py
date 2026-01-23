from fastapi import APIRouter, HTTPException, status, Depends, Header
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime, timedelta
import os
from models.user import UserCreate, UserLogin, User, UserUpdate, PasswordUpdate, ForgotPassword, ResetPassword
from utils.auth import get_password_hash, verify_password, create_access_token
from utils.helpers import generate_random_token
from utils.dependencies import get_current_user
from models.company import CompanyCreate

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create user
    user_dict = {
        "email": user_data.email,
        "password_hash": get_password_hash(user_data.password),
        "full_name": user_data.full_name,
        "email_verified": True,  # Mock: auto-verify for now
        "verification_token": generate_random_token(),
        "referral_code": generate_random_token(8),
        "referral_earnings": 0.0,
        "api_quota": 100,
        "social_accounts": [],
        "preferences": {
            "notifications": {
                "login": True,
                "company_ending": True,
                "invitation_expired": True,
                "subscription_ending": True,
                "support": True,
                "news_updates": True
            },
            "language": "fr"
        },
        "sessions": [],
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    result = await db.users.insert_one(user_dict)
    user_id = result.inserted_id
    
    # Create default company if company_name provided
    if user_data.company_name:
        company_dict = {
            "name": user_data.company_name,
            "owner_id": user_id,
            "primary_currency": "TND",
            "address": {"country": "Tunisia"},
            "taxes": [{"name": "TVA", "rate": 19.0, "default": True}],
            "banks": [],
            "numbering": {
                "invoice_prefix": "INV",
                "invoice_next": 1,
                "quote_prefix": "QUO",
                "quote_next": 1,
                "delivery_prefix": "BL",
                "delivery_next": 1,
                "exit_prefix": "BS",
                "exit_next": 1,
                "credit_prefix": "AV",
                "credit_next": 1,
                "purchase_order_prefix": "BC",
                "purchase_order_next": 1
            },
            "pdf_settings": {
                "show_logo": True,
                "show_addresses": True,
                "show_product_images": False,
                "show_prices": True
            },
            "collaborators": [],
            "subscription": {
                "plan": "free",
                "status": "active"
            },
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        await db.companies.insert_one(company_dict)
    
    # Create access token
    access_token = create_access_token(data={"sub": str(user_id)})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": str(user_id),
            "email": user_data.email,
            "full_name": user_data.full_name
        }
    }

@router.post("/login")
async def login(user_data: UserLogin):
    # Find user
    user = await db.users.find_one({"email": user_data.email})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    # Verify password
    if not verify_password(user_data.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    # Create access token
    access_token = create_access_token(data={"sub": str(user["_id"])})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": str(user["_id"]),
            "email": user["email"],
            "full_name": user["full_name"]
        }
    }

@router.post("/google")
async def google_login(token: dict):
    # Mock Google OAuth - In production, verify token with Google
    # For now, create/login user with mock data
    email = token.get("email", "google@example.com")
    name = token.get("name", "Google User")
    
    # Check if user exists
    user = await db.users.find_one({"email": email})
    
    if not user:
        # Create new user
        user_dict = {
            "email": email,
            "full_name": name,
            "email_verified": True,
            "social_accounts": [{"provider": "google", "provider_id": "mock_google_id"}],
            "referral_code": generate_random_token(8),
            "preferences": {"notifications": {}, "language": "fr"},
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        result = await db.users.insert_one(user_dict)
        user_id = result.inserted_id
    else:
        user_id = user["_id"]
    
    # Create access token
    access_token = create_access_token(data={"sub": str(user_id)})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": str(user_id),
            "email": email,
            "full_name": name
        }
    }

@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "id": str(current_user["_id"]),
        "email": current_user["email"],
        "full_name": current_user["full_name"],
        "photo": current_user.get("photo"),
        "preferences": current_user.get("preferences", {})
    }

@router.put("/me")
async def update_me(user_update: UserUpdate, current_user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in user_update.dict(exclude_unset=True).items()}
    update_data["updated_at"] = datetime.utcnow()
    
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$set": update_data}
    )
    
    return {"message": "Profile updated successfully"}

@router.put("/password")
async def update_password(password_data: PasswordUpdate, current_user: dict = Depends(get_current_user)):
    # Verify passwords match
    if password_data.new_password != password_data.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passwords do not match"
        )
    
    # Verify old password if user has password
    if current_user.get("password_hash") and password_data.old_password:
        if not verify_password(password_data.old_password, current_user["password_hash"]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Incorrect old password"
            )
    
    # Update password
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$set": {
            "password_hash": get_password_hash(password_data.new_password),
            "updated_at": datetime.utcnow()
        }}
    )
    
    return {"message": "Password updated successfully"}

@router.post("/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    # In a real app, you might want to blacklist the token
    return {"message": "Logged out successfully"}