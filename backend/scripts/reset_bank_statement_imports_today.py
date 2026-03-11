"""
Script pour supprimer les imports d'extraits bancaires créés aujourd'hui
et leurs transactions/suggestions associées.
"""
import asyncio
import os
import sys
from pathlib import Path
from datetime import datetime, timezone, timedelta

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / '.env')

from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
db_name = os.environ.get('DB_NAME', 'easybill')

client = AsyncIOMotorClient(mongo_url)
db = client[db_name]


async def reset_bank_statement_imports_today():
    """Supprime les imports créés aujourd'hui et leurs données liées."""
    now = datetime.now(timezone.utc)
    start_of_today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    end_of_today = start_of_today + timedelta(days=1)

    imports = await db.bank_statement_imports.find({
        "created_at": {"$gte": start_of_today, "$lt": end_of_today}
    }).to_list(None)

    if not imports:
        print("[OK] Aucun import avec date aujourd'hui.")
        return

    import_ids = [imp["_id"] for imp in imports]
    print(f"[OK] {len(import_ids)} import(s) trouve(s) avec date aujourd'hui.")

    transaction_ids = []
    txns = await db.bank_transactions.find({"import_id": {"$in": import_ids}}).to_list(None)
    transaction_ids = [t["_id"] for t in txns]

    recon_deleted = await db.reconciliation_suggestions.delete_many({
        "transaction_id": {"$in": transaction_ids}
    })
    print(f"   - Suggestions de rapprochement supprimees: {recon_deleted.deleted_count}")

    txn_deleted = await db.bank_transactions.delete_many({
        "import_id": {"$in": import_ids}
    })
    print(f"   - Transactions supprimees: {txn_deleted.deleted_count}")

    imp_deleted = await db.bank_statement_imports.delete_many({
        "_id": {"$in": import_ids}
    })
    print(f"   - Imports supprimes: {imp_deleted.deleted_count}")

    print("[OK] Termine. Vous pouvez reimporter pour tester.")


if __name__ == "__main__":
    asyncio.run(reset_bank_statement_imports_today())
