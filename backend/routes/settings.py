from fastapi import APIRouter, HTTPException, status, Depends, Request
from typing import List, Optional
from datetime import datetime, timezone
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
import os

from utils.dependencies import get_current_user

# Database connection
mongo_url = os.environ.get('MONGO_URL')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'easybill')]

router = APIRouter(prefix="/settings", tags=["settings"])


# ==================== PYDANTIC MODELS ====================

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

class PaymentMethodCreate(BaseModel):
    name: str
    description: Optional[str] = None

class PurchaseCategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None

class WithholdingTypeCreate(BaseModel):
    name: str
    rate: float
    description: Optional[str] = None


# ==================== HELPER FUNCTIONS ====================


# Helper function to log actions
async def log_action(company_id: str, user_id: str, user_name: str, category: str, action: str, element: str, ip_address: str = None):
    log_entry = {
        "company_id": ObjectId(company_id),
        "user_id": ObjectId(user_id),
        "user_name": user_name,
        "category": category,
        "action": action,
        "element": element,
        "ip_address": ip_address,
        "created_at": datetime.now(timezone.utc)
    }
    await db.access_logs.insert_one(log_entry)


def serialize_doc(doc: dict) -> dict:
    """Serialize MongoDB document for JSON response."""
    if doc is None:
        return None
    result = {k: v for k, v in doc.items() if k != "_id"}
    result["id"] = str(doc["_id"])
    if "company_id" in result:
        result["company_id"] = str(result["company_id"])
    if "user_id" in result:
        result["user_id"] = str(result["user_id"])
    if "created_at" in result and result["created_at"]:
        result["created_at"] = result["created_at"].isoformat()
    if "updated_at" in result and result["updated_at"]:
        result["updated_at"] = result["updated_at"].isoformat()
    return result


# ==================== TAXES ====================

@router.get("/taxes/{company_id}", response_model=List[dict])
async def list_taxes(company_id: str, current_user: dict = Depends(get_current_user)):
    taxes = await db.taxes.find({"company_id": ObjectId(company_id)}).to_list(100)
    return [serialize_doc(t) for t in taxes]


@router.post("/taxes/{company_id}", status_code=status.HTTP_201_CREATED)
async def create_tax(company_id: str, tax: TaxCreate, request: Request, current_user: dict = Depends(get_current_user)):
    tax_dict = {
        **tax.dict(),
        "company_id": ObjectId(company_id),
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    result = await db.taxes.insert_one(tax_dict)
    
    # Log action
    await log_action(
        company_id, str(current_user["_id"]), current_user.get("full_name", ""),
        "Taxe", "Créer", tax.name, request.client.host if request.client else None
    )
    
    return {"id": str(result.inserted_id), **tax.dict()}


@router.put("/taxes/{tax_id}")
async def update_tax(tax_id: str, tax: TaxUpdate, request: Request, current_user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in tax.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    result = await db.taxes.find_one_and_update(
        {"_id": ObjectId(tax_id)},
        {"$set": update_data},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Tax not found")
    
    await log_action(
        str(result["company_id"]), str(current_user["_id"]), current_user.get("full_name", ""),
        "Taxe", "Mise à jour", result["name"], request.client.host if request.client else None
    )
    
    return serialize_doc(result)


@router.delete("/taxes/{tax_id}")
async def delete_tax(tax_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    tax = await db.taxes.find_one({"_id": ObjectId(tax_id)})
    if not tax:
        raise HTTPException(status_code=404, detail="Tax not found")
    
    await db.taxes.delete_one({"_id": ObjectId(tax_id)})
    
    await log_action(
        str(tax["company_id"]), str(current_user["_id"]), current_user.get("full_name", ""),
        "Taxe", "Supprimer", tax["name"], request.client.host if request.client else None
    )
    
    return {"message": "Tax deleted successfully"}


# ==================== ADDITIONAL ENTRIES ====================

@router.get("/additional-entries/{company_id}", response_model=List[dict])
async def list_additional_entries(company_id: str, current_user: dict = Depends(get_current_user)):
    entries = await db.additional_entries.find({"company_id": ObjectId(company_id)}).to_list(100)
    return [serialize_doc(e) for e in entries]


@router.post("/additional-entries/{company_id}", status_code=status.HTTP_201_CREATED)
async def create_additional_entry(company_id: str, entry: AdditionalEntryCreate, request: Request, current_user: dict = Depends(get_current_user)):
    entry_dict = {
        **entry.dict(),
        "company_id": ObjectId(company_id),
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    result = await db.additional_entries.insert_one(entry_dict)
    
    await log_action(
        company_id, str(current_user["_id"]), current_user.get("full_name", ""),
        "Entrées supplémentaires", "Créer", entry.title, request.client.host if request.client else None
    )
    
    return {"id": str(result.inserted_id), **entry.dict()}


@router.put("/additional-entries/{entry_id}")
async def update_additional_entry(entry_id: str, entry: AdditionalEntryUpdate, request: Request, current_user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in entry.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    result = await db.additional_entries.find_one_and_update(
        {"_id": ObjectId(entry_id)},
        {"$set": update_data},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Additional entry not found")
    
    await log_action(
        str(result["company_id"]), str(current_user["_id"]), current_user.get("full_name", ""),
        "Entrées supplémentaires", "Mise à jour", result["title"], request.client.host if request.client else None
    )
    
    return serialize_doc(result)


@router.delete("/additional-entries/{entry_id}")
async def delete_additional_entry(entry_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    entry = await db.additional_entries.find_one({"_id": ObjectId(entry_id)})
    if not entry:
        raise HTTPException(status_code=404, detail="Additional entry not found")
    
    await db.additional_entries.delete_one({"_id": ObjectId(entry_id)})
    
    await log_action(
        str(entry["company_id"]), str(current_user["_id"]), current_user.get("full_name", ""),
        "Entrées supplémentaires", "Supprimer", entry["title"], request.client.host if request.client else None
    )
    
    return {"message": "Additional entry deleted successfully"}


# ==================== BANKS ====================

@router.get("/banks/{company_id}", response_model=List[dict])
async def list_banks(company_id: str, current_user: dict = Depends(get_current_user)):
    banks = await db.banks.find({"company_id": ObjectId(company_id)}).to_list(100)
    return [serialize_doc(b) for b in banks]


@router.post("/banks/{company_id}", status_code=status.HTTP_201_CREATED)
async def create_bank(company_id: str, bank: BankCreate, request: Request, current_user: dict = Depends(get_current_user)):
    bank_dict = {
        **bank.dict(),
        "company_id": ObjectId(company_id),
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    result = await db.banks.insert_one(bank_dict)
    
    await log_action(
        company_id, str(current_user["_id"]), current_user.get("full_name", ""),
        "Banque", "Créer", bank.name, request.client.host if request.client else None
    )
    
    return {"id": str(result.inserted_id), **bank.dict()}


@router.put("/banks/{bank_id}")
async def update_bank(bank_id: str, bank: BankUpdate, request: Request, current_user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in bank.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    result = await db.banks.find_one_and_update(
        {"_id": ObjectId(bank_id)},
        {"$set": update_data},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Bank not found")
    
    return serialize_doc(result)


@router.delete("/banks/{bank_id}")
async def delete_bank(bank_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    bank = await db.banks.find_one({"_id": ObjectId(bank_id)})
    if not bank:
        raise HTTPException(status_code=404, detail="Bank not found")
    
    await db.banks.delete_one({"_id": ObjectId(bank_id)})
    return {"message": "Bank deleted successfully"}


# ==================== PAYMENT METHODS ====================

@router.get("/payment-methods/{company_id}", response_model=List[dict])
async def list_payment_methods(company_id: str, current_user: dict = Depends(get_current_user)):
    methods = await db.payment_methods.find({"company_id": ObjectId(company_id)}).to_list(100)
    return [serialize_doc(m) for m in methods]


@router.post("/payment-methods/{company_id}", status_code=status.HTTP_201_CREATED)
async def create_payment_method(company_id: str, method: PaymentMethodCreate, request: Request, current_user: dict = Depends(get_current_user)):
    method_dict = {
        **method.dict(),
        "company_id": ObjectId(company_id),
        "is_active": True,
        "created_at": datetime.now(timezone.utc)
    }
    result = await db.payment_methods.insert_one(method_dict)
    return {"id": str(result.inserted_id), **method.dict()}


@router.delete("/payment-methods/{method_id}")
async def delete_payment_method(method_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.payment_methods.delete_one({"_id": ObjectId(method_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Payment method not found")
    return {"message": "Payment method deleted successfully"}


# ==================== PURCHASE CATEGORIES ====================

@router.get("/purchase-categories/{company_id}", response_model=List[dict])
async def list_purchase_categories(company_id: str, current_user: dict = Depends(get_current_user)):
    categories = await db.purchase_categories.find({"company_id": ObjectId(company_id)}).to_list(100)
    return [serialize_doc(c) for c in categories]


@router.post("/purchase-categories/{company_id}", status_code=status.HTTP_201_CREATED)
async def create_purchase_category(company_id: str, category: PurchaseCategoryCreate, request: Request, current_user: dict = Depends(get_current_user)):
    category_dict = {
        **category.dict(),
        "company_id": ObjectId(company_id),
        "is_active": True,
        "created_at": datetime.now(timezone.utc)
    }
    result = await db.purchase_categories.insert_one(category_dict)
    return {"id": str(result.inserted_id), **category.dict()}


@router.delete("/purchase-categories/{category_id}")
async def delete_purchase_category(category_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.purchase_categories.delete_one({"_id": ObjectId(category_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Purchase category not found")
    return {"message": "Purchase category deleted successfully"}


# ==================== WITHHOLDING TYPES ====================

@router.get("/withholding-types/{company_id}", response_model=List[dict])
async def list_withholding_types(company_id: str, current_user: dict = Depends(get_current_user)):
    types = await db.withholding_types.find({"company_id": ObjectId(company_id)}).to_list(100)
    return [serialize_doc(t) for t in types]


@router.post("/withholding-types/{company_id}", status_code=status.HTTP_201_CREATED)
async def create_withholding_type(company_id: str, wtype: WithholdingTypeCreate, request: Request, current_user: dict = Depends(get_current_user)):
    type_dict = {
        **wtype.dict(),
        "company_id": ObjectId(company_id),
        "is_active": True,
        "created_at": datetime.now(timezone.utc)
    }
    result = await db.withholding_types.insert_one(type_dict)
    return {"id": str(result.inserted_id), **wtype.dict()}


@router.delete("/withholding-types/{type_id}")
async def delete_withholding_type(type_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.withholding_types.delete_one({"_id": ObjectId(type_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Withholding type not found")
    return {"message": "Withholding type deleted successfully"}


# ==================== ACCESS LOGS ====================

@router.get("/access-logs/{company_id}", response_model=List[dict])
async def list_access_logs(company_id: str, limit: int = 50, current_user: dict = Depends(get_current_user)):
    logs = await db.access_logs.find(
        {"company_id": ObjectId(company_id)}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    return [serialize_doc(l) for l in logs]
