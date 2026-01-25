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
from services.email_service import email_service

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
    verification_token = generate_random_token(32)
    
    user_dict = {
        "email": user_data.email,
        "password_hash": get_password_hash(user_data.password),
        "full_name": user_data.full_name,
        "email_verified": False,  # Require email verification
        "verification_token": verification_token,
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
    
    # Send verification email
    email_service.send_verification_email(
        to_email=user_data.email,
        full_name=user_data.full_name,
        token=verification_token
    )
    
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
    """
    Google OAuth login
    Expects: {"credential": "google_id_token"}
    In production, verify token with Google API
    """
    credential = token.get("credential")
    
    if not credential:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google credential is required"
        )
    
    # TODO: In production, verify token with Google:
    # from google.oauth2 import id_token
    # from google.auth.transport import requests
    # idinfo = id_token.verify_oauth2_token(credential, requests.Request(), GOOGLE_CLIENT_ID)
    
    # For now, extract email and name from token (mock)
    # In production, get from verified idinfo
    email = token.get("email", "google@example.com")
    name = token.get("name", "Google User")
    google_id = token.get("sub", "mock_google_id")
    picture = token.get("picture")
    
    # Check if user exists
    user = await db.users.find_one({"email": email})
    
    if not user:
        # Create new user
        user_dict = {
            "email": email,
            "full_name": name,
            "photo": picture,
            "email_verified": True,
            "social_accounts": [{"provider": "google", "provider_id": google_id}],
            "referral_code": generate_random_token(8),
            "referral_earnings": 0.0,
            "api_quota": 100,
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
    else:
        user_id = user["_id"]
        # Update social account if not already linked
        if not any(acc.get("provider") == "google" for acc in user.get("social_accounts", [])):
            await db.users.update_one(
                {"_id": user_id},
                {"$push": {"social_accounts": {"provider": "google", "provider_id": google_id}}}
            )
    
    # Create access token
    access_token = create_access_token(data={"sub": str(user_id)})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": str(user_id),
            "email": email,
            "full_name": name,
            "photo": picture
        }
    }

@router.post("/facebook")
async def facebook_login(token: dict):
    """
    Facebook OAuth login
    Expects: {"accessToken": "facebook_access_token"}
    In production, verify token with Facebook Graph API
    """
    access_token = token.get("accessToken")
    
    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Facebook access token is required"
        )
    
    # TODO: In production, verify token with Facebook Graph API:
    # import requests
    # response = requests.get(
    #     f"https://graph.facebook.com/me?fields=id,name,email,picture&access_token={access_token}"
    # )
    # user_data = response.json()
    
    # For now, extract data from token (mock)
    # In production, get from Facebook Graph API response
    email = token.get("email")
    name = token.get("name", "Facebook User")
    facebook_id = token.get("userID", "mock_facebook_id")
    picture_url = token.get("picture", {}).get("data", {}).get("url")
    
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is required from Facebook"
        )
    
    # Check if user exists
    user = await db.users.find_one({"email": email})
    
    if not user:
        # Create new user
        user_dict = {
            "email": email,
            "full_name": name,
            "photo": picture_url,
            "email_verified": True,
            "social_accounts": [{"provider": "facebook", "provider_id": facebook_id}],
            "referral_code": generate_random_token(8),
            "referral_earnings": 0.0,
            "api_quota": 100,
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
    else:
        user_id = user["_id"]
        # Update social account if not already linked
        if not any(acc.get("provider") == "facebook" for acc in user.get("social_accounts", [])):
            await db.users.update_one(
                {"_id": user_id},
                {"$push": {"social_accounts": {"provider": "facebook", "provider_id": facebook_id}}}
            )
    
    # Create access token
    access_token = create_access_token(data={"sub": str(user_id)})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": str(user_id),
            "email": email,
            "full_name": name,
            "photo": picture_url
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

@router.post("/forgot-password")
async def forgot_password(forgot_data: ForgotPassword):
    """Send password reset email to user"""
    # Find user by email
    user = await db.users.find_one({"email": forgot_data.email})
    if not user:
        # Don't reveal if email exists for security
        return {"message": "If the email exists, a reset link has been sent"}
    
    # Generate reset token (valid for 30 minutes)
    reset_token = generate_random_token(32)
    reset_token_expiry = datetime.utcnow() + timedelta(minutes=30)
    
    # Save token to database
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {
            "reset_token": reset_token,
            "reset_token_expiry": reset_token_expiry,
            "updated_at": datetime.utcnow()
        }}
    )
    
    # Send password reset email
    email_sent = email_service.send_password_reset_email(
        to_email=user["email"],
        full_name=user.get("full_name", "User"),
        token=reset_token
    )
    
    if not email_sent:
        # Log error but don't reveal to user
        print(f"Failed to send reset email to {user['email']}")
    
    # For development: return link in response (remove in production)
    reset_link = f"http://localhost:3000/reset-password?token={reset_token}"
    
    return {
        "message": "If the email exists, a reset link has been sent",
        "reset_link": reset_link,  # Remove in production
        "token": reset_token  # Remove in production
    }

@router.post("/reset-password")
async def reset_password(reset_data: ResetPassword):
    """Reset password using token"""
    # Verify passwords match
    if reset_data.new_password != reset_data.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passwords do not match"
        )
    
    # Find user by reset token
    user = await db.users.find_one({
        "reset_token": reset_data.token,
        "reset_token_expiry": {"$gt": datetime.utcnow()}
    })
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )
    
    # Update password and clear reset token
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {
            "password_hash": get_password_hash(reset_data.new_password),
            "reset_token": None,
            "reset_token_expiry": None,
            "updated_at": datetime.utcnow()
        }}
    )
    
    return {"message": "Password reset successfully"}

@router.post("/verify-email/{token}")
async def verify_email(token: str):
    """Verify user email with token"""
    # Find user by verification token
    user = await db.users.find_one({"verification_token": token})
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification token"
        )
    
    # Mark email as verified
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {
            "email_verified": True,
            "verification_token": None,
            "updated_at": datetime.utcnow()
        }}
    )
    
    return {"message": "Email verified successfully"}

@router.post("/resend-verification")
async def resend_verification(email_data: ForgotPassword):
    """Resend verification email"""
    # Find user by email
    user = await db.users.find_one({"email": email_data.email})
    
    if not user:
        return {"message": "If the email exists, a verification link has been sent"}
    
    if user.get("email_verified"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already verified"
        )
    
    # Generate new verification token
    verification_token = generate_random_token(32)
    
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {
            "verification_token": verification_token,
            "updated_at": datetime.utcnow()
        }}
    )
    
    # Send verification email
    email_service.send_verification_email(
        to_email=user["email"],
        full_name=user.get("full_name", "User"),
        token=verification_token
    )
    
    # For development: return link in response (remove in production)
    verification_link = f"http://localhost:3000/verify-email?token={verification_token}"
    
    return {
        "message": "Verification email sent",
        "verification_link": verification_link,  # Remove in production
        "token": verification_token  # Remove in production
    }