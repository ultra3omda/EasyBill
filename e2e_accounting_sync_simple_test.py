"""
E2E Test Simplifié - Test Synchronisation Comptable
Test rapide pour vérifier que les écritures comptables sont créées automatiquement
"""

import httpx
import asyncio
from datetime import datetime

BASE_URL = "https://test-et-implement.preview.emergentagent.com/api"

# Utiliser un compte existant
TEST_EMAIL = "testuser@easybill.com"
TEST_PASSWORD = "TestPass123!"
COMPANY_ID = "69774dbbdb057f6d21416ad8"

# Créer un nouveau compte pour le test
async def main():
    print("\n" + "="*80)
    print("TEST SYNCHRONISATION COMPTABLE - VERSION SIMPLIFIÉE")
    print("="*80 + "\n")
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        # 1. Inscription
        print("1. Inscription...")
        email = f"test-sync-{int(datetime.now().timestamp())}@easybill.com"
        password = "TestSync2025!"
        
        response = await client.post(
            f"{BASE_URL}/auth/register",
            json={
                "email": email,
                "password": password,
                "company_name": "Test Sync Company",
                "full_name": "Test Sync User"
            }
        )
        
        if response.status_code not in [200, 201]:
            print(f"❌ Échec inscription: {response.status_code}")
            return
        
        token = response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Récupérer company_id
        response = await client.get(f"{BASE_URL}/companies/", headers=headers)
        if response.status_code != 200 or not response.json():
            print("❌ Échec récupération company")
            return
        
        company_id = response.json()[0]["id"]
        print(f"✅ Utilisateur créé: {email}")
        print(f"   Company ID: {company_id}")
        
        # 2. Créer un client
        print("\n2. Création d'un client...")
        customer_data = {
            "first_name": "Test",
            "last_name": "Customer",
            "company_name": "Test Company",
            "email": "test@example.com",
            "phone": "+216 71 123 456"
        }
        
        response = await client.post(
            f"{BASE_URL}/customers/",
            params={"company_id": company_id},
            json=customer_data,
            headers=headers
        )
        
        if response.status_code not in [200, 201]:
            print(f"❌ Échec création client: {response.status_code}")
            return
        
        customer = response.json()
        customer_name = customer.get("display_name") or f"{customer.get('first_name', '')} {customer.get('last_name', '')}".strip()
        print(f"✅ Client créé: {customer_name}")
        
        # 3. Vérifier les écritures comptables existantes
        print("\n3. Vérification des écritures comptables existantes...")
        response = await client.get(
            f"{BASE_URL}/journal-entries/",
            params={"company_id": company_id},
            headers=headers
        )
        
        if response.status_code == 200:
            entries = response.json()
            print(f"✅ {len(entries)} écritures comptables trouvées (devrait être 0 pour nouveau compte)")
        else:
            print(f"❌ Échec récupération écritures: {response.status_code} - {response.text}")
            return
        
        # 4. Créer une facture simple pour tester la synchronisation
        print("\n4. Création d'une facture de test...")
        
        # Créer une facture
        invoice_data = {
            "customer_id": customer["id"],
            "customer_name": customer_name,
            "date": datetime.now().isoformat(),
            "due_date": datetime.now().isoformat(),
            "items": [
                {
                    "product_name": "Test Product",
                    "description": "Test de synchronisation comptable",
                    "quantity": 1,
                    "unit_price": 100.0,
                    "tax_rate": 19.0
                }
            ],
            "notes": "Facture de test pour synchronisation comptable",
            "status": "draft"
        }
        
        response = await client.post(
            f"{BASE_URL}/invoices/",
            params={"company_id": company_id},
            json=invoice_data,
            headers=headers
        )
        
        if response.status_code not in [200, 201]:
            print(f"❌ Échec création facture: {response.status_code} - {response.text}")
            return
        
        invoice = response.json()
        invoice_id = invoice["id"]
        print(f"✅ Facture créée: {invoice.get('number')} - Total: {invoice.get('total')} TND")
        print(f"   Status: {invoice.get('status')} - Aucune écriture comptable attendue (draft)")
        
        # 4. Mettre à jour la facture en "sent" pour déclencher la synchronisation
        print("\n4. Mise à jour facture → Status 'sent' (déclenchement synchronisation)...")
        
        response = await client.put(
            f"{BASE_URL}/invoices/{invoice_id}",
            params={"company_id": COMPANY_ID},
            json={"status": "sent"},
            headers=headers
        )
        
        if response.status_code != 200:
            print(f"❌ Échec mise à jour facture: {response.status_code} - {response.text}")
            return
        
        print("✅ Facture mise à jour: Status = 'sent'")
        
        # Attendre un peu pour la synchronisation
        await asyncio.sleep(3)
        
        # 5. Vérifier si l'écriture comptable a été créée
        print("\n5. Vérification de la création de l'écriture comptable...")
        
        response = await client.get(
            f"{BASE_URL}/journal-entries/",
            params={"company_id": COMPANY_ID},
            headers=headers
        )
        
        if response.status_code != 200:
            print(f"❌ Échec récupération écritures: {response.status_code}")
            return
        
        entries = response.json()
        invoice_entries = [e for e in entries if e.get("document_type") == "invoice" and e.get("document_id") == invoice_id]
        
        if invoice_entries:
            entry = invoice_entries[0]
            print(f"✅ SUCCÈS: Écriture comptable créée automatiquement!")
            print(f"\n  Référence: {entry.get('reference')}")
            print(f"  Description: {entry.get('description')}")
            print(f"  Date: {entry.get('date')}")
            print(f"  Type journal: {entry.get('journal_type')}")
            print(f"\n  Lignes d'écriture:")
            
            total_debit = 0
            total_credit = 0
            
            for line in entry.get('lines', []):
                if line.get('debit') > 0:
                    print(f"    Débit  {line.get('account_code')} ({line.get('account_name')}): {line.get('debit'):.3f} TND")
                    total_debit += line.get('debit', 0)
                if line.get('credit') > 0:
                    print(f"    Crédit {line.get('account_code')} ({line.get('account_name')}): {line.get('credit'):.3f} TND")
                    total_credit += line.get('credit', 0)
            
            print(f"\n  Total Débit: {total_debit:.3f} TND")
            print(f"  Total Crédit: {total_credit:.3f} TND")
            
            if abs(total_debit - total_credit) < 0.01:
                print(f"  ✅ Équilibre vérifié: Débit = Crédit")
            else:
                print(f"  ❌ DÉSÉQUILIBRE: Débit ≠ Crédit")
            
            print("\n" + "="*80)
            print("✅ TEST RÉUSSI: LA SYNCHRONISATION COMPTABLE FONCTIONNE!")
            print("="*80)
        else:
            print(f"❌ ÉCHEC: Aucune écriture comptable trouvée pour la facture!")
            print(f"   Nombre total d'écritures: {len(entries)}")
            print(f"   Facture ID: {invoice_id}")
            
            # Vérifier si la facture a bien l'accounting_entry_id
            response = await client.get(
                f"{BASE_URL}/invoices/{invoice_id}",
                params={"company_id": COMPANY_ID},
                headers=headers
            )
            
            if response.status_code == 200:
                invoice_check = response.json()
                print(f"   Facture accounting_entry_id: {invoice_check.get('accounting_entry_id')}")
            
            print("\n" + "="*80)
            print("❌ TEST ÉCHOUÉ: LA SYNCHRONISATION COMPTABLE NE FONCTIONNE PAS")
            print("="*80)

if __name__ == "__main__":
    asyncio.run(main())
