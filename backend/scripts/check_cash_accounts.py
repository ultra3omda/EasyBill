"""
Script pour verifier les donnees des comptes caisse dans la base.
"""
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / '.env')

from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
db_name = os.environ.get('DB_NAME', 'easybill')

client = AsyncIOMotorClient(mongo_url)
db = client[db_name]


async def check_cash_accounts():
    """Affiche le contenu des comptes caisse."""
    accounts = await db.cash_accounts.find({}).to_list(100)
    print(f"\n=== {len(accounts)} compte(s) caisse trouve(s) ===\n")
    for a in accounts:
        print(f"ID: {a['_id']}")
        print(f"  name: {a.get('name')}")
        print(f"  account_type: {a.get('account_type')}")
        print(f"  bank_name: {repr(a.get('bank_name'))}")
        print(f"  rib: {repr(a.get('rib'))}")
        print(f"  show_in_footer: {a.get('show_in_footer')}")
        print(f"  company_id: {a.get('company_id')}")
        print(f"  keys: {list(a.keys())}")
        print()


if __name__ == "__main__":
    asyncio.run(check_cash_accounts())
