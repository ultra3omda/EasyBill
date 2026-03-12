from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime, timezone
from pathlib import Path
import os
import shutil
import uuid
import logging
from typing import List
from models.company import Company, CompanyCreate, CompanyUpdate
from utils.dependencies import get_current_user, get_current_company
from data.tunisian_chart_of_accounts import TUNISIAN_CHART_OF_ACCOUNTS

logger = logging.getLogger(__name__)
UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads" / "logos"
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}

router = APIRouter(prefix="/api/companies", tags=["Companies"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]


async def create_default_taxes(company_id: ObjectId, user_id: ObjectId, user_name: str):
    """Create default taxes for a new company (Tunisia)."""
    default_taxes = [
        {"name": "T.V.A", "rate": 19.0, "description": "TVA 19%", "is_default": True},
        {"name": "T.V.A", "rate": 13.0, "description": "TVA 13%", "is_default": False},
        {"name": "T.V.A", "rate": 7.0, "description": "TVA 7%", "is_default": False},
        {"name": "T.V.A", "rate": 0.0, "description": "TVA 0%", "is_default": False},
        {"name": "Droit de consommation", "rate": 10.0, "description": "Droit de consommation 10%", "is_default": False},
        {"name": "Taxe FODEC", "rate": 1.0, "description": "FODEC 1%", "is_default": False},
    ]
    
    now = datetime.now(timezone.utc)
    for tax in default_taxes:
        tax_doc = {
            **tax,
            "company_id": company_id,
            "is_active": True,
            "created_at": now,
            "updated_at": now
        }
        await db.taxes.insert_one(tax_doc)
        
        # Log action
        await db.access_logs.insert_one({
            "company_id": company_id,
            "user_id": user_id,
            "user_name": user_name,
            "category": "Taxe",
            "action": "Créer",
            "element": tax["name"],
            "created_at": now
        })


async def create_default_additional_entries(company_id: ObjectId, user_id: ObjectId, user_name: str):
    """Create default additional entries for a new company (Tunisia)."""
    default_entries = [
        {
            "title": "Timbre fiscal",
            "value": 1.0,  # 1,000 TND
            "type": "fixed",
            "calculation": "after_tax",
            "sign": "positive",
            "usage": "everywhere"
        }
    ]
    
    now = datetime.now(timezone.utc)
    for entry in default_entries:
        entry_doc = {
            **entry,
            "company_id": company_id,
            "is_active": True,
            "created_at": now,
            "updated_at": now
        }
        await db.additional_entries.insert_one(entry_doc)
        
        # Log action
        await db.access_logs.insert_one({
            "company_id": company_id,
            "user_id": user_id,
            "user_name": user_name,
            "category": "Entrées supplémentaires",
            "action": "Créer",
            "element": entry["title"],
            "created_at": now
        })


async def create_default_payment_methods(company_id: ObjectId):
    """Create default payment methods for a new company."""
    default_methods = [
        {"name": "Espèces", "description": "Paiement en espèces"},
        {"name": "Chèque", "description": "Paiement par chèque"},
        {"name": "Virement bancaire", "description": "Virement bancaire"},
        {"name": "Carte bancaire", "description": "Paiement par carte"},
        {"name": "Effet de commerce", "description": "Effet de commerce"},
    ]
    
    now = datetime.now(timezone.utc)
    for method in default_methods:
        method_doc = {
            **method,
            "company_id": company_id,
            "is_active": True,
            "created_at": now
        }
        await db.payment_methods.insert_one(method_doc)


async def create_default_purchase_categories(company_id: ObjectId):
    """Create default purchase categories for a new company."""
    default_categories = [
        {"name": "Fournitures de bureau", "description": "Fournitures et consommables"},
        {"name": "Matériel informatique", "description": "Ordinateurs, imprimantes, etc."},
        {"name": "Services", "description": "Services et prestations"},
        {"name": "Transport", "description": "Frais de transport et déplacement"},
        {"name": "Loyer", "description": "Loyer et charges locatives"},
        {"name": "Téléphone & Internet", "description": "Communications"},
        {"name": "Électricité & Eau", "description": "Charges d'énergie"},
        {"name": "Autres", "description": "Autres dépenses"},
    ]
    
    now = datetime.now(timezone.utc)
    for category in default_categories:
        category_doc = {
            **category,
            "company_id": company_id,
            "is_active": True,
            "created_at": now
        }
        await db.purchase_categories.insert_one(category_doc)


async def create_default_warehouse(company_id: ObjectId, user_id: ObjectId, user_name: str):
    """Create default principal warehouse for a new company."""
    now = datetime.now(timezone.utc)
    warehouse_doc = {
        "reference": "ENT-001",
        "name": "Entrepôt Principal",
        "address": "",
        "is_active": True,
        "is_principal": True,
        "company_id": company_id,
        "created_at": now,
        "updated_at": now
    }
    await db.warehouses.insert_one(warehouse_doc)
    
    # Log action
    await db.access_logs.insert_one({
        "company_id": company_id,
        "user_id": user_id,
        "user_name": user_name,
        "category": "Entrepôt",
        "action": "Créer",
        "element": "Entrepôt Principal",
        "created_at": now
    })


async def create_default_chart_of_accounts(company_id: ObjectId, user_id: ObjectId, user_name: str):
    """Create default Tunisian chart of accounts for a new company."""
    now = datetime.now(timezone.utc)
    accounts_to_insert = []
    
    for account in TUNISIAN_CHART_OF_ACCOUNTS:
        account_doc = {
            "code": account["code"],
            "name": account["name"],
            "type": account["type"],
            "is_group": account.get("is_group", False),
            "parent_code": account.get("parent_code"),
            "company_id": company_id,
            "is_system": True,
            "is_active": True,
            "balance": 0.0,
            "created_at": now
        }
        accounts_to_insert.append(account_doc)
    
    # Bulk insert for better performance
    if accounts_to_insert:
        await db.chart_of_accounts.insert_many(accounts_to_insert)
    
    # Log action
    await db.access_logs.insert_one({
        "company_id": company_id,
        "user_id": user_id,
        "user_name": user_name,
        "category": "Plan comptable",
        "action": "Créer",
        "element": f"Plan comptable tunisien ({len(accounts_to_insert)} comptes)",
        "created_at": now
    })


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_company(company_data: CompanyCreate, current_user: dict = Depends(get_current_user)):
    company_dict = company_data.dict(exclude_unset=True)
    now = datetime.now(timezone.utc)
    
    company_dict.update({
        "owner_id": current_user["_id"],
        "primary_currency": company_data.primary_currency or "TND",
        "taxes": [],  # Taxes are now stored separately
        "banks": [],
        "numbering": {
            "invoice_prefix": "FAC",
            "invoice_next": 1,
            "quote_prefix": "DEV",
            "quote_next": 1,
            "delivery_prefix": "BL",
            "delivery_next": 1,
            "exit_prefix": "BS",
            "exit_next": 1,
            "credit_prefix": "AV",
            "credit_next": 1,
            "purchase_order_prefix": "BC",
            "purchase_order_next": 1,
            "receipt_prefix": "BR",
            "receipt_next": 1,
            "supplier_invoice_prefix": "FF",
            "supplier_invoice_next": 1,
            "payment_prefix": "PAY",
            "payment_next": 1
        },
        "pdf_settings": {
            "show_logo": True,
            "show_addresses": True,
            "show_product_images": False,
            "show_prices": True,
            "show_bank_details": True,
            "show_stamp": True,
            "template": "classic"
        },
        "collaborators": [],
        "subscription": {
            "plan": "free",
            "status": "active"
        },
        "created_at": now,
        "updated_at": now
    })
    
    result = await db.companies.insert_one(company_dict)
    company_id = result.inserted_id
    user_name = current_user.get("full_name", current_user.get("email", ""))
    
    # Create default data for the new company
    await create_default_taxes(company_id, current_user["_id"], user_name)
    await create_default_additional_entries(company_id, current_user["_id"], user_name)
    await create_default_payment_methods(company_id)
    await create_default_purchase_categories(company_id)
    await create_default_chart_of_accounts(company_id, current_user["_id"], user_name)
    await create_default_warehouse(company_id, current_user["_id"], user_name)
    
    # Log company creation
    await db.access_logs.insert_one({
        "company_id": company_id,
        "user_id": current_user["_id"],
        "user_name": user_name,
        "category": "Entreprise",
        "action": "Créer",
        "element": company_dict["name"],
        "created_at": now
    })
    
    # Return company data with proper serialization
    return {
        "id": str(company_id),
        "name": company_dict["name"],
        "fiscal_id": company_dict.get("fiscal_id"),
        "activity": company_dict.get("activity"),
        "logo": company_dict.get("logo"),
        "address": company_dict.get("address"),
        "primary_currency": company_dict["primary_currency"],
        "numbering": company_dict["numbering"],
        "pdf_settings": company_dict["pdf_settings"],
        "subscription": company_dict["subscription"],
        "created_at": company_dict["created_at"].isoformat(),
        "updated_at": company_dict["updated_at"].isoformat()
    }

def serialize_company(c: dict) -> dict:
    """Serialize company document for JSON response."""
    return {
        "id": str(c["_id"]),
        "name": c.get("name"),
        "fiscal_id": c.get("fiscal_id"),
        "activity": c.get("activity"),
        "logo": c.get("logo"),
        "phone": c.get("phone"),
        "website": c.get("website"),
        "address": c.get("address"),
        "primary_currency": c.get("primary_currency", "TND"),
        "taxes": c.get("taxes", []),
        "banks": c.get("banks", []),
        "numbering": c.get("numbering", {}),
        "pdf_settings": c.get("pdf_settings", {}),
        "fiscal_year": c.get("fiscal_year"),
        "subscription": c.get("subscription", {}),
        "created_at": c["created_at"].isoformat() if c.get("created_at") else None,
        "updated_at": c["updated_at"].isoformat() if c.get("updated_at") else None
    }

@router.get("/")
async def list_companies(current_user: dict = Depends(get_current_user)):
    companies = await db.companies.find(
        {"$or": [
            {"owner_id": current_user["_id"]},
            {"collaborators.user_id": current_user["_id"], "collaborators.status": "active"}
        ]}
    ).to_list(100)
    
    return [serialize_company(c) for c in companies]

@router.get("/{company_id}")
async def get_company(company_id: str, current_user: dict = Depends(get_current_user)):
    company = await get_current_company(current_user, company_id)
    return serialize_company(company)

@router.put("/{company_id}")
async def update_company(company_id: str, company_update: CompanyUpdate, current_user: dict = Depends(get_current_user)):
    company = await get_current_company(current_user, company_id)
    
    # Only owner can update company
    if str(company["owner_id"]) != str(current_user["_id"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only company owner can update company details"
        )
    
    update_data = {k: v for k, v in company_update.dict(exclude_unset=True).items()}
    update_data["updated_at"] = datetime.utcnow()
    
    await db.companies.update_one(
        {"_id": ObjectId(company_id)},
        {"$set": update_data}
    )
    
    return {"message": "Company updated successfully"}

@router.post("/{company_id}/logo")
async def upload_company_logo(
    company_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """Upload company logo; saved in uploads/logos."""
    company = await get_current_company(current_user, company_id)
    if str(company["owner_id"]) != str(current_user["_id"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only company owner can update company logo"
        )
    suffix = Path(file.filename or "logo").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Format non autorisé. Utilisez: jpg, jpeg, png, gif ou webp."
        )
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    name = f"{company_id}_{uuid.uuid4().hex[:8]}{suffix}"
    path = UPLOAD_DIR / name
    try:
        with path.open("wb") as f:
            shutil.copyfileobj(file.file, f)
    except Exception as e:
        logger.error(f"Upload logo error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur lors de l'enregistrement du fichier."
        )
    logo_url = f"/uploads/logos/{name}"
    await db.companies.update_one(
        {"_id": ObjectId(company_id)},
        {"$set": {"logo": logo_url, "updated_at": datetime.now(timezone.utc)}}
    )
    return {"logo": logo_url}

@router.delete("/{company_id}")
async def delete_company(company_id: str, current_user: dict = Depends(get_current_user)):
    company = await get_current_company(current_user, company_id)
    
    # Only owner can delete company
    if str(company["owner_id"]) != str(current_user["_id"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only company owner can delete company"
        )
    
    await db.companies.delete_one({"_id": ObjectId(company_id)})
    
    return {"message": "Company deleted successfully"}

@router.get("/{company_id}/dashboard")
async def get_dashboard(company_id: str, current_user: dict = Depends(get_current_user)):
    company = await get_current_company(current_user, company_id)
    
    # Get dashboard statistics
    total_customers = await db.customers.count_documents({"company_id": ObjectId(company_id)})
    total_suppliers = await db.suppliers.count_documents({"company_id": ObjectId(company_id)})
    total_products = await db.products.count_documents({"company_id": ObjectId(company_id)})
    
    # Get invoice stats
    invoices = await db.invoices.find({"company_id": ObjectId(company_id)}).to_list(1000)
    total_invoiced = sum(inv.get("total", 0) for inv in invoices)
    total_paid = sum(inv.get("amount_paid", 0) for inv in invoices)
    total_due = total_invoiced - total_paid
    
    # Get quotes stats
    quotes = await db.quotes.find({"company_id": ObjectId(company_id)}).to_list(1000)
    total_quotes = sum(q.get("total", 0) for q in quotes)
    
    return {
        "customers": total_customers,
        "suppliers": total_suppliers,
        "products": total_products,
        "invoices": {
            "count": len(invoices),
            "total": total_invoiced,
            "paid": total_paid,
            "due": total_due
        },
        "quotes": {
            "count": len(quotes),
            "total": total_quotes
        }
    }