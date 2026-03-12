from collections import defaultdict
from datetime import datetime, timezone

from bson import ObjectId


class AccountResolutionService:
    LEGACY_FALLBACKS = {
        "TN": {
            "bank": "521",
            "cash": "531",
            "suspense": "471",
            "customer_receivable": "411",
            "supplier_payable": "401",
            "bank_fee": "627",
            "marketing": "623",
            "telecom": "626",
            "repairs": "615",
            "travel": "625",
            "purchases": "606",
            "utilities": "6061",
            "fuel": "6068",
            "salaries": "641",
            "employee_payable": "421",
            "social_charges": "431",
            "vat_collectible": "4351",
            "vat_deductible": "4362",
            "revenue_services": "706",
            "revenue_goods": "707",
        },
        "FR": {
            "bank": "512",
            "cash": "531",
            "suspense": "471",
            "customer_receivable": "411",
            "supplier_payable": "401",
            "bank_fee": "627",
            "marketing": "623",
            "telecom": "626",
            "repairs": "615",
            "travel": "625",
            "purchases": "606",
            "salaries": "641",
            "employee_payable": "421",
            "social_charges": "431",
            "vat_collectible": "44571",
            "vat_deductible": "44566",
            "revenue_services": "706",
            "revenue_goods": "707",
        },
    }

    def __init__(self, db):
        self.db = db
        self._cache = defaultdict(dict)

    async def resolve_company_country(self, company_id: str | ObjectId) -> str:
        object_id = ObjectId(company_id) if not isinstance(company_id, ObjectId) else company_id
        company = await self.db.companies.find_one({"_id": object_id})
        fiscal = ((company or {}).get("fiscal_settings") or {}).get("country_code")
        if fiscal:
            return str(fiscal).upper()
        address_country = ((company or {}).get("address") or {}).get("country") or "TN"
        if str(address_country).upper() in ("FRANCE", "FR"):
            return "FR"
        return "TN"

    async def resolve_account(self, company_id: str | ObjectId, semantic_key: str, fallback_label: str | None = None):
        company_id_str = str(company_id)
        cached = self._cache.get(company_id_str, {}).get(semantic_key)
        if cached:
            return cached

        object_id = ObjectId(company_id) if not isinstance(company_id, ObjectId) else company_id
        account = await self.db.chart_of_accounts.find_one(
            {
                "company_id": object_id,
                "semantic_key": semantic_key,
                "is_active": {"$ne": False},
            }
        )
        if account:
            resolved = {
                "id": str(account["_id"]),
                "code": account["code"],
                "name": account.get("name") or account.get("label"),
                "semantic_key": semantic_key,
                "source": "configured",
                "warning": None,
            }
            self._cache[company_id_str][semantic_key] = resolved
            return resolved

        country = await self.resolve_company_country(object_id)
        fallback_code = self.LEGACY_FALLBACKS.get(country, self.LEGACY_FALLBACKS["TN"]).get(semantic_key)
        if fallback_code:
            fallback = await self.db.chart_of_accounts.find_one(
                {
                    "company_id": object_id,
                    "code": fallback_code,
                    "is_active": {"$ne": False},
                }
            )
            if fallback:
                resolved = {
                    "id": str(fallback["_id"]),
                    "code": fallback["code"],
                    "name": fallback.get("name") or fallback.get("label"),
                    "semantic_key": semantic_key,
                    "source": "fallback_code",
                    "warning": None,
                }
                self._cache[company_id_str][semantic_key] = resolved
                return resolved

        warning = f"Compte sémantique manquant: {semantic_key}"
        resolved = {
            "id": None,
            "code": None,
            "name": fallback_label or semantic_key,
            "semantic_key": semantic_key,
            "source": "missing",
            "warning": warning,
        }
        await self.db.companies.update_one(
            {"_id": object_id},
            {
                "$set": {"updated_at": datetime.now(timezone.utc)},
                "$addToSet": {"accounting_settings.configuration_warnings": warning},
            },
        )
        return resolved
