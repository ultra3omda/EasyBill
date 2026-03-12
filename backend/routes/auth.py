
from fastapi import APIRouter, HTTPException, status, Depends, Header, UploadFile, File, Body
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime, timedelta, timezone
from pathlib import Path
import os
import logging
import shutil
import uuid

logger = logging.getLogger(__name__)
from models.user import UserCreate, UserLogin, User, UserUpdate, PasswordUpdate, ForgotPassword, ResetPassword
from utils.auth import get_password_hash, verify_password, create_access_token
from utils.helpers import generate_random_token
from utils.dependencies import get_current_user
from models.company import CompanyCreate
from services.email_service import email_service
from services.chart_of_accounts_service import ChartOfAccountsService
from services.supplier_account_suggestion_service import SupplierAccountSuggestionService

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

#test
async def create_default_chart_of_accounts_for_company(company_id: ObjectId):
    """Initialize default chart of accounts for new company."""
    service = ChartOfAccountsService(db)
    result = await service.initialize_default_chart(company_id=company_id, created_by=None)
    await SupplierAccountSuggestionService(db).seed_defaults(company_id)
    return result.get("count", 0)

@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate):
    # Vérifier si un compte existe déjà avec cet email (réponse 200 pour éviter erreur console frontend)
    existing_user = await db.users.find_one({"email": user_data.email.lower().strip()})
    if existing_user:
        return {
            "alreadyRegistered": True,
            "message": "Un compte existe déjà avec cet email. Vous pouvez vous connecter directement."
        }
    
    # Create user
    verification_token = generate_random_token(32)
    email_normalized = user_data.email.lower().strip()
    user_dict = {
        "email": email_normalized,
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
            "fiscal_settings": {"country_code": "TN"},
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
            "accounting_settings": {
                "processing_controls": {
                    "softWarningTransactionLines": 120,
                    "maxTransactionLinesPerImport": 300,
                    "reconciliationChunkSize": 50,
                    "maxLLMCallsPerImport": 3,
                    "candidateSearchDateWindowDays": 21,
                    "candidateAmountTolerance": 0.01
                },
                "configuration_warnings": []
            },
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        company_result = await db.companies.insert_one(company_dict)
        
        # Initialize Tunisian chart of accounts (490 accounts)
        await create_default_chart_of_accounts_for_company(company_result.inserted_id)
    
    # Ne pas retourner de token : l'utilisateur doit d'abord vérifier son email
    return {
        "message": "Compte créé. Un email de vérification a été envoyé à votre adresse. Consultez votre boîte mail pour activer votre compte.",
        "requires_verification": True
    }

@router.post("/login")
async def login(user_data: UserLogin):
    # Find user (email normalisé pour cohérence avec l'inscription)
    email_normalized = user_data.email.lower().strip()
    user = await db.users.find_one({"email": email_normalized})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    # Compte créé via OAuth (pas de mot de passe défini)
    if not user.get("password_hash"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Ce compte a été créé via Google ou Facebook. Utilisez le bouton correspondant pour vous connecter."
        )

    # Verify password
    if not verify_password(user_data.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect"
        )
    
    # Exiger la vérification de l'email avant de se connecter
    if not user.get("email_verified"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Veuillez vérifier votre adresse email avant de vous connecter. Consultez votre boîte mail (et les spams) pour le lien de vérification."
        )
    
    # Create access token
    access_token = create_access_token(data={"sub": str(user["_id"])})
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"last_login": datetime.utcnow(), "updated_at": datetime.utcnow()}}
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": str(user["_id"]),
            "email": user["email"],
            "full_name": user["full_name"],
            "photo": user.get("photo")
        }
    }

@router.post("/google")
async def google_login(token: dict = Body(...)):
    """
    Google OAuth login
    Expects: {"credential": "google_id_token"} — JWT signé par Google
    Vérifie le token via google-auth si GOOGLE_CLIENT_ID est défini dans .env.
    """
    credential = token.get("credential")
    access_token_google = token.get("access_token")

    if not credential and not access_token_google:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google credential ou access_token est requis"
        )
    
    google_client_id = os.environ.get("GOOGLE_CLIENT_ID")
    email = None
    name = None
    google_id = None
    picture = None

    if access_token_google:
        # Approche access_token → appel async à /userinfo Google (évite de bloquer l'event loop)
        try:
            import httpx
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    "https://www.googleapis.com/oauth2/v2/userinfo",
                    headers={"Authorization": f"Bearer {access_token_google}"},
                )
            if resp.status_code != 200:
                logger.error(f"[Google Auth] userinfo failed: {resp.status_code} {resp.text}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=f"Token Google invalide (userinfo: {resp.status_code})"
                )
            user_info = resp.json()
            logger.info(f"[Google Auth] userinfo OK: email={user_info.get('email')}")
            email = user_info.get("email")
            name = user_info.get("name")
            google_id = user_info.get("id")
            picture = user_info.get("picture")

            if not email:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email non fourni par Google"
                )
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[Google Auth] ERREUR userinfo : {type(e).__name__}: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Échec vérification token Google : {str(e)}"
            )
    elif credential and google_client_id and not credential.startswith("mock_"):
        # Vérification ID token (fallback)
        try:
            import base64, json as _json
            parts = credential.split(".")
            if len(parts) == 3:
                pad = parts[1] + "=" * (4 - len(parts[1]) % 4)
                payload = _json.loads(base64.urlsafe_b64decode(pad))
                logger.info(f"[Google Auth] ID token: aud={payload.get('aud')} email={payload.get('email')}")

            from google.oauth2 import id_token as google_id_token
            from google.auth.transport import requests as google_requests
            import requests as req_lib

            request_session = google_requests.Request(session=req_lib.Session())
            idinfo = google_id_token.verify_oauth2_token(
                credential,
                request_session,
                google_client_id,
                clock_skew_in_seconds=30
            )
            email = idinfo.get("email")
            name = idinfo.get("name")
            google_id = idinfo.get("sub")
            picture = idinfo.get("picture")

            if not email:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email non fourni par Google"
                )
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[Google Auth] ERREUR verify_oauth2_token : {type(e).__name__}: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Échec vérification token Google : {str(e)}"
            )
    elif not google_client_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GOOGLE_CLIENT_ID non configuré sur le serveur. Ajoutez-le dans backend/.env"
        )
    else:
        # credential commence par "mock_" : usage local de test uniquement
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
    await db.users.update_one(
        {"_id": user_id},
        {"$set": {"last_login": datetime.utcnow(), "updated_at": datetime.utcnow()}}
    )
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
async def facebook_login(token: dict = Body(...)):
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
        "phone": current_user.get("phone"),
        "photo": current_user.get("photo"),
        "email_verified": current_user.get("email_verified", False),
        "preferences": current_user.get("preferences", {}),
        "created_at": current_user.get("created_at"),
        "last_login": current_user.get("last_login"),
        "has_password": bool(current_user.get("password_hash")),
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

UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads" / "avatars"
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}

@router.post("/me/photo")
async def upload_photo(current_user: dict = Depends(get_current_user), file: UploadFile = File(...)):
    """Upload profile photo; saved in project uploads/avatars."""
    suffix = Path(file.filename or "photo").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Format non autorisé. Utilisez: jpg, jpeg, png, gif ou webp."
        )
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    name = f"{current_user['_id']}_{uuid.uuid4().hex[:8]}{suffix}"
    path = UPLOAD_DIR / name
    try:
        with path.open("wb") as f:
            shutil.copyfileobj(file.file, f)
    except Exception as e:
        logger.error(f"Upload photo error: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Erreur lors de l'enregistrement du fichier.")
    photo_url = f"/uploads/avatars/{name}"
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$set": {"photo": photo_url, "updated_at": datetime.utcnow()}}
    )
    return {"photo": photo_url}

@router.put("/password")
async def update_password(password_data: PasswordUpdate, current_user: dict = Depends(get_current_user)):
    # Verify passwords match
    if password_data.new_password != password_data.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Les mots de passe ne correspondent pas."
        )
    
    has_existing_password = bool(current_user.get("password_hash"))
    
    if has_existing_password:
        # Compte email/mot de passe : exiger et vérifier l'ancien mot de passe
        if not password_data.old_password or not password_data.old_password.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Veuillez saisir votre mot de passe actuel."
            )
        if not verify_password(password_data.old_password, current_user["password_hash"]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ancien mot de passe incorrect."
            )
    else:
        # Compte social (sans mot de passe) : ne pas accepter d'ancien mot de passe
        if password_data.old_password and password_data.old_password.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Compte connecté via un réseau social. Laissez le champ « Ancien mot de passe » vide pour définir un mot de passe."
            )
    
    # Update password
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$set": {
            "password_hash": get_password_hash(password_data.new_password),
            "updated_at": datetime.utcnow()
        }}
    )
    
    return {"message": "Mot de passe modifié avec succès."}

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
    
    return {
        "message": "If the email exists, a reset link has been sent"
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
    return {
        "message": "Verification email sent"
    }