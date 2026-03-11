"""
Migration: ajoute bank_name, rib, show_in_footer aux comptes caisse qui ne les ont pas.
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


async def migrate():
    accounts = await db.cash_accounts.find({}).to_list(100)
    modified = 0
    for a in accounts:
        updates = {}
        if "bank_name" not in a:
            updates["bank_name"] = None
        if "rib" not in a:
            updates["rib"] = None
        if "show_in_footer" not in a:
            updates["show_in_footer"] = False
        if "account_type" not in a:
            updates["account_type"] = "bank" if (a.get("bank_name") or a.get("rib")) else "cash"
        if updates:
            await db.cash_accounts.update_one({"_id": a["_id"]}, {"$set": updates})
            modified += 1
    print(f"Migration: {modified} compte(s) mis a jour.")


if __name__ == "__main__":
    asyncio.run(migrate())
