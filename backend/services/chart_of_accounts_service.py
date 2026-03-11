from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId

from services.chart_template_factory import ChartTemplateFactory


class ChartOfAccountsService:
    def __init__(self, db):
        self.db = db

    async def ensure_indexes(self):
        await self.db.chart_of_accounts.create_index(
            [("company_id", 1), ("code", 1)],
            unique=True,
            name="uniq_company_account_code",
        )
        await self.db.chart_of_accounts.create_index(
            [("company_id", 1), ("semantic_key", 1)],
            name="idx_company_semantic_key",
            sparse=True,
        )

    @staticmethod
    def infer_company_country(company: Optional[dict]) -> str:
        fiscal = ((company or {}).get("fiscal_settings") or {}).get("country_code")
        if fiscal:
            return ChartTemplateFactory.normalize_country_code(fiscal)
        address_country = ((company or {}).get("address") or {}).get("country")
        return ChartTemplateFactory.normalize_country_code(address_country)

    async def initialize_default_chart(
        self,
        company_id: ObjectId,
        country_code: Optional[str] = None,
        created_by: Optional[ObjectId] = None,
        force: bool = False,
    ):
        await self.ensure_indexes()
        existing_count = await self.db.chart_of_accounts.count_documents({"company_id": company_id})
        if existing_count and not force:
            return {"created": False, "count": existing_count, "country_code": country_code or "TN"}

        if force and existing_count:
            await self.db.chart_of_accounts.delete_many({"company_id": company_id})

        company = await self.db.companies.find_one({"_id": company_id})
        normalized_country = ChartTemplateFactory.normalize_country_code(
            country_code or self.infer_company_country(company)
        )
        template = ChartTemplateFactory.build_default_chart(normalized_country)

        now = datetime.now(timezone.utc)
        docs = []
        for account in template:
            docs.append(
                {
                    "code": account["code"],
                    "name": account["name"],
                    "label": account["name"],
                    "type": account["type"],
                    "class": account["code"][:1],
                    "category": account.get("type"),
                    "parent_code": account.get("parent_code"),
                    "is_group": account.get("is_group", False),
                    "company_id": company_id,
                    "country_code": normalized_country,
                    "code_system": account.get("code_system"),
                    "semantic_key": account.get("semantic_key"),
                    "is_system": True,
                    "is_system_default": account.get("is_system_default", True),
                    "is_user_editable": account.get("is_user_editable", True),
                    "protected": account.get("protected", False),
                    "is_active": True,
                    "balance": 0.0,
                    "metadata": account.get("metadata", {}),
                    "created_at": now,
                    "updated_at": now,
                    "created_by": created_by,
                }
            )

        if docs:
            await self.db.chart_of_accounts.insert_many(docs)

        await self.db.companies.update_one(
            {"_id": company_id},
            {
                "$set": {
                    "accounting_settings.chart_initialized": True,
                    "accounting_settings.active_chart_country_code": normalized_country,
                    "accounting_settings.active_chart_code_system": docs[0]["code_system"] if docs else None,
                    "accounting_settings.chart_initialized_at": now,
                    "updated_at": now,
                }
            },
        )
        return {"created": True, "count": len(docs), "country_code": normalized_country}

    async def ensure_chart_for_company(self, company_id: ObjectId, created_by: Optional[ObjectId] = None):
        company = await self.db.companies.find_one({"_id": company_id})
        return await self.initialize_default_chart(
            company_id=company_id,
            country_code=self.infer_company_country(company),
            created_by=created_by,
            force=False,
        )
