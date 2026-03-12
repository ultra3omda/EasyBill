"""
Script pour corriger le solde initial du compte bancaire : 51 936,927 au lieu de 119.
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

NEW_BALANCE = 51936.927


async def fix_bank_account_balance():
    """Corrige le solde du compte bancaire ayant 119 en 51 936,927."""
    # Trouver le compte bancaire avec balance 119
    acc = await db.cash_accounts.find_one({
        "account_type": "bank",
        "balance": 119
    })
    if acc:
        result = await db.cash_accounts.update_one(
            {"_id": acc["_id"]},
            {"$set": {"initial_balance": NEW_BALANCE, "balance": NEW_BALANCE}}
        )
        if result.modified_count:
            print(f"[OK] Compte bancaire '{acc.get('name')}' : solde corrigé 119 -> {NEW_BALANCE}")
        return
    # Sinon chercher par balance proche (119.0 ou 119)
    acc = await db.cash_accounts.find_one({
        "account_type": "bank",
        "$or": [{"balance": 119}, {"balance": 119.0}]
    })
    if acc:
        result = await db.cash_accounts.update_one(
            {"_id": acc["_id"]},
            {"$set": {"initial_balance": NEW_BALANCE, "balance": NEW_BALANCE}}
        )
        if result.modified_count:
            print(f"[OK] Compte bancaire '{acc.get('name')}' : solde corrigé 119 -> {NEW_BALANCE}")
        return
    # Lister tous les comptes bancaires pour debug
    accounts = await db.cash_accounts.find({"account_type": "bank"}).to_list(20)
    if not accounts:
        print("[INFO] Aucun compte bancaire trouvé.")
        return
    print("[INFO] Comptes bancaires existants :")
    for a in accounts:
        print(f"  - {a.get('name')}: balance={a.get('balance')}, initial_balance={a.get('initial_balance')}")
    # Mettre à jour le premier compte bancaire si c'est le seul ou si balance=119
    for a in accounts:
        if a.get("balance") == 119 or a.get("balance") == 119.0:
            await db.cash_accounts.update_one(
                {"_id": a["_id"]},
                {"$set": {"initial_balance": NEW_BALANCE, "balance": NEW_BALANCE}}
            )
            print(f"[OK] Compte '{a.get('name')}' : solde corrigé -> {NEW_BALANCE}")
            return
    print("[INFO] Aucun compte avec balance 119 trouvé. Indiquez le nom du compte à corriger.")


if __name__ == "__main__":
    asyncio.run(fix_bank_account_balance())
