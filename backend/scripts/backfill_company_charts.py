import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient


ROOT_DIR = Path(__file__).resolve().parents[1]
load_dotenv(ROOT_DIR / ".env")
sys.path.insert(0, str(ROOT_DIR))

from services.chart_of_accounts_service import ChartOfAccountsService
from services.supplier_account_suggestion_service import SupplierAccountSuggestionService


async def main():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    chart_service = ChartOfAccountsService(db)
    mapping_service = SupplierAccountSuggestionService(db)
    companies = await db.companies.find({}).to_list(None)
    for company in companies:
        result = await chart_service.ensure_chart_for_company(company["_id"])
        await mapping_service.seed_defaults(company["_id"])
        print(
            f"{company.get('name')}: chart_created={result.get('created')} "
            f"count={result.get('count')} country={result.get('country_code')}"
        )
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
