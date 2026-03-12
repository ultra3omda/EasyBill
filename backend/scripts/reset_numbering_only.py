"""
Script pour reinitialiser uniquement la numerotation (factures, paiements)
sans supprimer aucune donnee.
"""
import asyncio
import os
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / '.env')

from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
db_name = os.environ.get('DB_NAME', 'easybill')

client = AsyncIOMotorClient(mongo_url)
db = client[db_name]


async def reset_numbering_only():
    """Reinitialise uniquement la numerotation BigDeal (aucune suppression)."""
    company = await db.companies.find_one({
        "name": {"$regex": r"bigdeal", "$options": "i"}
    })

    if not company:
        print("[ERREUR] Entreprise 'BigDeal' non trouvee.")
        companies = await db.companies.find({}, {"name": 1}).to_list(100)
        if companies:
            print("   Entreprises existantes:", [c.get("name") for c in companies])
        return

    company_id = company["_id"]
    company_name = company.get("name", "BigDeal")
    invoice_prefix = company.get("numbering", {}).get("invoice_prefix", "FAC")
    year = datetime.now().year
    print(f"[OK] Entreprise trouvee: {company_name} (id: {company_id})")

    # Renommer FAC-2026-00003 -> FAC-2026-00002
    old_num = f"{invoice_prefix}-{year}-00003"
    new_num = f"{invoice_prefix}-{year}-00002"
    inv_result = await db.invoices.update_one(
        {"company_id": company_id, "number": old_num},
        {"$set": {"number": new_num, "subject": f"Facture {new_num}"}}
    )
    if inv_result.modified_count:
        print(f"   - Facture {old_num} renommee en {new_num}")
    elif inv_result.matched_count == 0:
        print(f"   - Aucune facture {old_num} trouvee (rien a renommer)")

    # Compteur a 3 pour la prochaine facture
    await db.companies.update_one(
        {"_id": company_id},
        {"$set": {"numbering.invoice_next": 3, "numbering.payment_next": 1}}
    )
    print("   - Compteur invoice_next=3, payment_next=1")
    print(f"\n[OK] Termine. La prochaine facture sera {invoice_prefix}-{year}-00003.")


if __name__ == "__main__":
    asyncio.run(reset_numbering_only())
