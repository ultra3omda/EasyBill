from datetime import datetime, timezone
import re

from bson import ObjectId

from services.learning_pattern_service import normalize_pattern


DEFAULT_SUPPLIER_PATTERNS = [
    {"supplier_pattern": "META", "semantic_key": "marketing", "default_account_code": "623", "category": "marketing"},
    {"supplier_pattern": "FACEBOOK", "semantic_key": "marketing", "default_account_code": "623", "category": "marketing"},
    {"supplier_pattern": "GOOGLE ADS", "semantic_key": "marketing", "default_account_code": "623", "category": "marketing"},
    {"supplier_pattern": "OOREDOO", "semantic_key": "telecom", "default_account_code": "626", "category": "telecom"},
    {"supplier_pattern": "ORANGE", "semantic_key": "telecom", "default_account_code": "626", "category": "telecom"},
    {"supplier_pattern": "TELECOM", "semantic_key": "telecom", "default_account_code": "626", "category": "telecom"},
    {"supplier_pattern": "GARAGE", "semantic_key": "repairs", "default_account_code": "615", "category": "repairs"},
    {"supplier_pattern": "REPARATION", "semantic_key": "repairs", "default_account_code": "615", "category": "repairs"},
    {"supplier_pattern": "TOTAL", "semantic_key": "fuel", "default_account_code": "6068", "category": "fuel"},
    {"supplier_pattern": "SHELL", "semantic_key": "fuel", "default_account_code": "6068", "category": "fuel"},
]


class SupplierAccountSuggestionService:
    def __init__(self, db):
        self.db = db

    async def ensure_indexes(self):
        await self.db.supplier_account_mappings.create_index(
            [("company_id", 1), ("normalized_supplier_pattern", 1)],
            name="idx_supplier_mapping_pattern",
        )
        await self.db.supplier_account_mappings.create_index(
            [("company_id", 1), ("supplier_id", 1)],
            name="idx_supplier_mapping_supplier",
            sparse=True,
        )

    async def seed_defaults(self, company_id: ObjectId):
        await self.ensure_indexes()
        now = datetime.now(timezone.utc)
        for mapping in DEFAULT_SUPPLIER_PATTERNS:
            normalized = normalize_pattern(mapping["supplier_pattern"])
            existing = await self.db.supplier_account_mappings.find_one(
                {
                    "company_id": company_id,
                    "normalized_supplier_pattern": normalized,
                    "source": "system",
                }
            )
            if existing:
                continue
            await self.db.supplier_account_mappings.insert_one(
                {
                    "company_id": company_id,
                    "supplier_id": None,
                    "supplier_pattern": mapping["supplier_pattern"],
                    "normalized_supplier_pattern": normalized,
                    "default_expense_account_id": None,
                    "default_expense_account_code": mapping["default_account_code"],
                    "semantic_key": mapping["semantic_key"],
                    "category": mapping["category"],
                    "confidence": "moyen",
                    "source": "system",
                    "times_confirmed": 0,
                    "is_active": True,
                    "created_at": now,
                    "updated_at": now,
                }
            )

    async def suggest_mapping(self, company_id: str, supplier_id: str | None, label: str):
        normalized_label = normalize_pattern(label)
        query = {"company_id": ObjectId(company_id), "is_active": True}
        docs = await self.db.supplier_account_mappings.find(query).sort("times_confirmed", -1).to_list(200)

        if supplier_id:
            for doc in docs:
                if doc.get("supplier_id") and str(doc["supplier_id"]) == str(supplier_id):
                    return doc

        for doc in docs:
            pattern = doc.get("normalized_supplier_pattern")
            if pattern and pattern in normalized_label:
                return doc
        return None

    async def record_confirmation(self, company_id: str, supplier_pattern: str, account_code: str, semantic_key: str | None = None):
        normalized = normalize_pattern(supplier_pattern)
        existing = await self.db.supplier_account_mappings.find_one(
            {"company_id": ObjectId(company_id), "normalized_supplier_pattern": normalized}
        )
        now = datetime.now(timezone.utc)
        if existing:
            await self.db.supplier_account_mappings.update_one(
                {"_id": existing["_id"]},
                {
                    "$set": {
                        "default_expense_account_code": account_code,
                        "semantic_key": semantic_key,
                        "updated_at": now,
                        "confidence": "fort" if existing.get("times_confirmed", 0) >= 5 else "moyen",
                        "is_active": True,
                    },
                    "$inc": {"times_confirmed": 1},
                },
            )
            return str(existing["_id"])

        result = await self.db.supplier_account_mappings.insert_one(
            {
                "company_id": ObjectId(company_id),
                "supplier_id": None,
                "supplier_pattern": supplier_pattern,
                "normalized_supplier_pattern": normalized,
                "default_expense_account_id": None,
                "default_expense_account_code": account_code,
                "semantic_key": semantic_key,
                "category": None,
                "confidence": "faible",
                "source": "learned",
                "times_confirmed": 1,
                "is_active": True,
                "created_at": now,
                "updated_at": now,
            }
        )
        return str(result.inserted_id)
