"""
Script pour supprimer toutes les factures, écritures comptables et données liées
à l'entreprise BigDeal. Permet de redémarrer les tests à zéro.
"""
import asyncio
import os
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / '.env')

from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
db_name = os.environ.get('DB_NAME', 'easybill')

client = AsyncIOMotorClient(mongo_url)
db = client[db_name]


async def reset_bigdeal_data():
    """Supprime toutes les données BigDeal: factures, paiements, écritures comptables, etc."""
    # Trouver l'entreprise BigDeal (insensible à la casse, peut contenir "bigdeal")
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
    print(f"[OK] Entreprise trouvee: {company_name} (id: {company_id})")

    # 1. Récupérer les IDs des factures pour les écritures liées
    invoices = await db.invoices.find({"company_id": company_id}).to_list(None)
    invoice_ids = [inv["_id"] for inv in invoices]

    # 2. Récupérer les IDs des paiements
    payments = await db.payments.find({"company_id": company_id}).to_list(None)
    payment_ids = [p["_id"] for p in payments]

    # 3. Récupérer les IDs des factures fournisseur
    supplier_invoices = await db.supplier_invoices.find({"company_id": company_id}).to_list(None)
    supplier_invoice_ids = [si["_id"] for si in supplier_invoices]

    # 4. Récupérer les IDs des paiements fournisseurs
    supplier_payments = await db.supplier_payments.find({"company_id": company_id}).to_list(None)
    supplier_payment_ids = [sp["_id"] for sp in supplier_payments]

    # 5. Récupérer les IDs des avoirs (credit_notes)
    credit_notes = await db.credit_notes.find({"company_id": company_id}).to_list(None)
    credit_note_ids = [cn["_id"] for cn in credit_notes]

    # 6. Supprimer les écritures comptables liées à ces documents
    doc_ids = invoice_ids + payment_ids + supplier_invoice_ids + supplier_payment_ids + credit_note_ids

    # Écritures avec document_id dans les docs
    je_deleted = await db.journal_entries.delete_many({
        "company_id": company_id,
        "$or": [
            {"document_id": {"$in": doc_ids}},
            {"document_type": {"$in": ["invoice", "payment", "supplier_invoice", "supplier_payment", "credit_note"]}}
        ]
    })
    # Aussi supprimer toutes les écritures de l'entreprise (au cas où)
    je_deleted2 = await db.journal_entries.delete_many({"company_id": company_id})
    total_je = je_deleted2.deleted_count
    print(f"   - Ecritures comptables supprimees: {total_je}")

    # 7. Supprimer les paiements
    pay_deleted = await db.payments.delete_many({"company_id": company_id})
    print(f"   - Paiements supprimes: {pay_deleted.deleted_count}")

    # 8. Supprimer les factures
    inv_deleted = await db.invoices.delete_many({"company_id": company_id})
    print(f"   - Factures supprimees: {inv_deleted.deleted_count}")

    # 9. Supprimer les factures fournisseurs
    si_deleted = await db.supplier_invoices.delete_many({"company_id": company_id})
    print(f"   - Factures fournisseurs supprimees: {si_deleted.deleted_count}")

    # 10. Supprimer les paiements fournisseurs
    sp_deleted = await db.supplier_payments.delete_many({"company_id": company_id})
    print(f"   - Paiements fournisseurs supprimes: {sp_deleted.deleted_count}")

    # 11. Supprimer les avoirs (credit notes)
    cn_deleted = await db.credit_notes.delete_many({"company_id": company_id})
    print(f"   - Avoirs supprimes: {cn_deleted.deleted_count}")

    # 12. Supprimer les operations caisse (transactions puis comptes)
    cash_tx_deleted = await db.cash_transactions.delete_many({"company_id": company_id})
    print(f"   - Transactions caisse supprimees: {cash_tx_deleted.deleted_count}")
    cash_acc_deleted = await db.cash_accounts.delete_many({"company_id": company_id})
    print(f"   - Comptes caisse supprimes: {cash_acc_deleted.deleted_count}")

    # 13. Supprimer les clients
    cust_deleted = await db.customers.delete_many({"company_id": company_id})
    print(f"   - Clients supprimes: {cust_deleted.deleted_count}")

    # 14. Supprimer les fournisseurs
    supp_deleted = await db.suppliers.delete_many({"company_id": company_id})
    print(f"   - Fournisseurs supprimes: {supp_deleted.deleted_count}")

    # 15. Reinitialiser la numerotation des factures
    await db.companies.update_one(
        {"_id": company_id},
        {"$set": {"numbering.invoice_next": 1, "numbering.payment_next": 1}}
    )
    print(f"   - Numerotation reinitialisee")

    print(f"\n[OK] Donnees BigDeal supprimees. Vous pouvez redemarrer les tests a zero.")


if __name__ == "__main__":
    asyncio.run(reset_bigdeal_data())
