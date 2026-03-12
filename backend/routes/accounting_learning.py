from bson import ObjectId
from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorClient
import os

from utils.dependencies import get_current_company, get_current_user


router = APIRouter(prefix="/api/accounting", tags=["Accounting Learning"])

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]


def serialize_pattern(doc: dict):
    return {
        "id": str(doc["_id"]),
        "company_id": str(doc["company_id"]),
        "pattern_type": doc.get("pattern_type"),
        "raw_pattern": doc.get("raw_pattern"),
        "normalized_pattern": doc.get("normalized_pattern"),
        "transaction_type": doc.get("transaction_type"),
        "supplier_id": str(doc["supplier_id"]) if doc.get("supplier_id") else None,
        "entity_type": doc.get("entity_type"),
        "entity_id": str(doc["entity_id"]) if doc.get("entity_id") else None,
        "default_account_code": doc.get("default_account_code"),
        "suggested_debit_account_code": doc.get("suggested_debit_account_code"),
        "suggested_credit_account_code": doc.get("suggested_credit_account_code"),
        "confidence": doc.get("confidence"),
        "times_confirmed": doc.get("times_confirmed", 0),
        "last_used_at": doc.get("last_used_at").isoformat() if doc.get("last_used_at") else None,
        "source": doc.get("source"),
        "is_active": doc.get("is_active", True),
        "created_at": doc.get("created_at").isoformat() if doc.get("created_at") else None,
        "updated_at": doc.get("updated_at").isoformat() if doc.get("updated_at") else None,
    }


@router.get("/learning-patterns")
async def list_learning_patterns(
    company_id: str = Query(...),
    pattern_type: str | None = Query(None),
    include_inactive: bool = Query(False),
    current_user: dict = Depends(get_current_user),
):
    await get_current_company(current_user, company_id)
    query = {"company_id": ObjectId(company_id)}
    if pattern_type:
        query["pattern_type"] = pattern_type
    if not include_inactive:
        query["is_active"] = True
    docs = await db.matching_patterns.find(query).sort("times_confirmed", -1).to_list(500)
    return [serialize_pattern(doc) for doc in docs]
