"""
Script pour corriger la facture FAC-2026-0003 en FAC-2026-00003 (format 5 chiffres).
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


async def fix_invoice_3():
    """Corrige FAC-2026-0003 -> FAC-2026-00003 pour aligner sur le format 5 chiffres."""
    result = await db.invoices.update_many(
        {"number": "FAC-2026-0003"},
        {"$set": {"number": "FAC-2026-00003"}}
    )
    if result.modified_count:
        print(f"[OK] Facture FAC-2026-0003 corrigée en FAC-2026-00003 ({result.modified_count} facture(s))")
    else:
        inv = await db.invoices.find_one({"number": {"$regex": r"FAC-2026-0003$"}})
        if inv:
            new_num = "FAC-2026-00003"
            await db.invoices.update_one(
                {"_id": inv["_id"]},
                {"$set": {"number": new_num}}
            )
            print(f"[OK] Facture {inv['number']} corrigée en {new_num}")
        else:
            print("[INFO] Aucune facture FAC-2026-0003 trouvée (déjà corrigée ou inexistante)")


if __name__ == "__main__":
    asyncio.run(fix_invoice_3())
