"""
Script pour definir des donnees bancaires de test sur le compte "Compte Principale".
"""
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / '.env')

from motor.motor_asyncio import AsyncIOMotorClient

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
db_name = os.environ.get('DB_NAME', 'easybill')

client = AsyncIOMotorClient(mongo_url)
db = client[db_name]


async def set_test_data():
    result = await db.cash_accounts.update_one(
        {"name": "Compte Principale"},
        {"$set": {
            "bank_name": "BIAT",
            "rib": "08006000661006230813",
            "show_in_footer": True
        }}
    )
    if result.modified_count:
        print("OK: Donnees bancaires definies (BIAT, RIB 08006000661006230813)")
    else:
        print("Compte 'Compte Principale' non trouve ou deja a jour.")


if __name__ == "__main__":
    asyncio.run(set_test_data())
