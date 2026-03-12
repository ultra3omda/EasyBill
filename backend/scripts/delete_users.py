"""
Supprimer les utilisateurs de la base MongoDB locale.
Usage (depuis le dossier backend):
  python scripts/delete_users.py              # supprime tous les utilisateurs
  python scripts/delete_users.py user@mail.com  # supprime un utilisateur par email
"""
import asyncio
import os
import sys
from pathlib import Path

# Charger .env depuis le dossier backend
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))
from dotenv import load_dotenv
load_dotenv(backend_dir / ".env")

from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "easybill")


async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    email_arg = sys.argv[1] if len(sys.argv) > 1 else None

    if email_arg:
        r = await db.users.delete_one({"email": email_arg.lower().strip()})
        if r.deleted_count:
            print(f"Utilisateur supprimé : {email_arg}")
        else:
            print(f"Aucun utilisateur trouvé avec l'email : {email_arg}")
    else:
        n = await db.users.count_documents({})
        if n == 0:
            print("Aucun utilisateur dans la base.")
            return
        await db.users.delete_many({})
        print(f"{n} utilisateur(s) supprimé(s).")

    client.close()


if __name__ == "__main__":
    asyncio.run(main())
