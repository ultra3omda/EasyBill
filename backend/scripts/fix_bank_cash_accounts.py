"""
Supprime "Compte Principale" et cree "Caisse principale" pour les entreprises qui n'en ont pas.
"""
import asyncio
import os
import sys
from pathlib import Path
from datetime import datetime, timezone

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / '.env')

from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
db_name = os.environ.get('DB_NAME', 'easybill')

client = AsyncIOMotorClient(mongo_url)
db = client[db_name]


async def fix():
    # 1. Supprimer "Compte Principale"
    r = await db.cash_accounts.delete_many({"name": {"$regex": r"compte principale", "$options": "i"}})
    print(f"Supprime: {r.deleted_count} compte(s) 'Compte Principale'")

    # 2. Pour chaque entreprise, creer "Caisse principale" si pas de compte caisse
    companies = await db.companies.find({}).to_list(100)
    now = datetime.now(timezone.utc)
    created = 0
    for c in companies:
        cid = c["_id"]
        has_cash = await db.cash_accounts.find_one({"company_id": cid, "account_type": "cash"})
        if not has_cash:
            await db.cash_accounts.insert_one({
                "company_id": cid,
                "name": "Caisse principale",
                "currency": "TND",
                "initial_balance": 0.0,
                "balance": 0.0,
                "is_default": True,
                "account_type": "cash",
                "description": "Caisse creee automatiquement",
                "bank_name": None,
                "rib": None,
                "show_in_footer": False,
                "created_at": now,
                "updated_at": now,
                "created_by": c.get("owner_id")
            })
            created += 1
            print(f"  Caisse principale creee pour {c.get('name')}")
    print(f"Caisse principale: {created} creee(s)")


if __name__ == "__main__":
    asyncio.run(fix())
