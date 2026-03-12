from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
import os

from services.supplier_account_suggestion_service import SupplierAccountSuggestionService
from utils.dependencies import get_current_company, get_current_user


router = APIRouter(prefix="/api/accounting", tags=["Accounting Mappings"])

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]


class SupplierAccountMappingCreate(BaseModel):
    supplier_id: Optional[str] = None
    supplier_pattern: str
    default_expense_account_code: str
    semantic_key: Optional[str] = None
    category: Optional[str] = None
    confidence: str = "faible"
    source: str = "user"
    is_active: bool = True


class SupplierAccountMappingUpdate(BaseModel):
    supplier_pattern: Optional[str] = None
    default_expense_account_code: Optional[str] = None
    semantic_key: Optional[str] = None
    category: Optional[str] = None
    confidence: Optional[str] = None
    is_active: Optional[bool] = None


def serialize_mapping(doc: dict):
    return {
        "id": str(doc["_id"]),
        "company_id": str(doc["company_id"]),
        "supplier_id": str(doc["supplier_id"]) if doc.get("supplier_id") else None,
        "supplier_pattern": doc.get("supplier_pattern"),
        "normalized_supplier_pattern": doc.get("normalized_supplier_pattern"),
        "default_expense_account_id": str(doc["default_expense_account_id"]) if doc.get("default_expense_account_id") else None,
        "default_expense_account_code": doc.get("default_expense_account_code"),
        "semantic_key": doc.get("semantic_key"),
        "category": doc.get("category"),
        "confidence": doc.get("confidence"),
        "source": doc.get("source"),
        "times_confirmed": doc.get("times_confirmed", 0),
        "is_active": doc.get("is_active", True),
        "created_at": doc.get("created_at").isoformat() if doc.get("created_at") else None,
        "updated_at": doc.get("updated_at").isoformat() if doc.get("updated_at") else None,
    }


@router.get("/supplier-mappings")
async def list_supplier_mappings(
    company_id: str = Query(...),
    include_inactive: bool = Query(False),
    current_user: dict = Depends(get_current_user),
):
    await get_current_company(current_user, company_id)
    service = SupplierAccountSuggestionService(db)
    await service.seed_defaults(ObjectId(company_id))
    query = {"company_id": ObjectId(company_id)}
    if not include_inactive:
        query["is_active"] = True
    docs = await db.supplier_account_mappings.find(query).sort("supplier_pattern", 1).to_list(500)
    return [serialize_mapping(doc) for doc in docs]


@router.post("/supplier-mappings", status_code=status.HTTP_201_CREATED)
async def create_supplier_mapping(
    data: SupplierAccountMappingCreate,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user),
):
    await get_current_company(current_user, company_id)
    service = SupplierAccountSuggestionService(db)
    await service.ensure_indexes()
    now = datetime.now(timezone.utc)
    doc = data.dict()
    doc["company_id"] = ObjectId(company_id)
    doc["supplier_id"] = ObjectId(data.supplier_id) if data.supplier_id else None
    doc["normalized_supplier_pattern"] = data.supplier_pattern.upper().strip()
    doc["created_at"] = now
    doc["updated_at"] = now
    doc["times_confirmed"] = 0
    result = await db.supplier_account_mappings.insert_one(doc)
    created = await db.supplier_account_mappings.find_one({"_id": result.inserted_id})
    return serialize_mapping(created)


@router.put("/supplier-mappings/{mapping_id}")
async def update_supplier_mapping(
    mapping_id: str,
    data: SupplierAccountMappingUpdate,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user),
):
    await get_current_company(current_user, company_id)
    update = {k: v for k, v in data.dict(exclude_unset=True).items()}
    if "supplier_pattern" in update:
        update["normalized_supplier_pattern"] = update["supplier_pattern"].upper().strip()
    update["updated_at"] = datetime.now(timezone.utc)
    result = await db.supplier_account_mappings.update_one(
        {"_id": ObjectId(mapping_id), "company_id": ObjectId(company_id)},
        {"$set": update},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Mapping introuvable")
    updated = await db.supplier_account_mappings.find_one({"_id": ObjectId(mapping_id)})
    return serialize_mapping(updated)
