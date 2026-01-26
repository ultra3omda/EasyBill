"""
E2E Test - Simulation Q1 2025 (Version 2 - Avec Corrections)
Test complet du cycle comptable avec synchronisation automatique
"""

import httpx
import asyncio
import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import sys

# Configuration
BASE_URL = "https://test-et-implement.preview.emergentagent.com/api"

# Global variables
auth_token = None
company_id = None
test_data = {
    "user": {},
    "customers": [],
    "suppliers": [],
    "products": [],
    "invoices": [],
    "payments": [],
    "supplier_invoices": [],
    "supplier_payments": [],
    "credit_notes": [],
    "journal_entries": []
}

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    MAGENTA = '\033[95m'
    END = '\033[0m'

def print_header(title: str):
    """Print section header"""
    print(f"\n{Colors.BLUE}{'='*80}")
    print(f"{title}")
    print(f"{'='*80}{Colors.END}\n")

def print_success(message: str):
    print(f"{Colors.GREEN}✅ {message}{Colors.END}")

def print_error(message: str):
    print(f"{Colors.RED}❌ {message}{Colors.END}")

def print_warning(message: str):
    print(f"{Colors.YELLOW}⚠️  {message}{Colors.END}")

def print_info(message: str):
    print(f"{Colors.CYAN}ℹ️  {message}{Colors.END}")


async def phase1_setup():
    """Phase 1: Setup - Inscription et création des données de base"""
    global auth_token, company_id
    
    print_header("PHASE 1: SETUP (5 minutes)")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # 1. Inscription
        print_info("1. Inscription utilisateur...")
        email = f"test-e2e-v2-{int(datetime.now().timestamp())}@easybill.com"
        password = "TestE2E2025!"
        
        try:
            response = await client.post(
                f"{BASE_URL}/auth/register",
                json={
                    "email": email,
                    "password": password,
                    "company_name": "EasyBill Test Q1 2025",
                    "full_name": "Test E2E User"
                }
            )
            
            if response.status_code in [200, 201]:
                data = response.json()
                auth_token = data.get("access_token")
                test_data["user"] = {"email": email, "password": password}
                print_success(f"Utilisateur créé: {email}")
                
                # Fetch company ID
                headers = {"Authorization": f"Bearer {auth_token}"}
                response = await client.get(f"{BASE_URL}/companies/", headers=headers)
                
                if response.status_code == 200:
                    companies = response.json()
                    if companies and len(companies) > 0:
                        company_id = companies[0]["id"]
                        print_info(f"Company ID: {company_id}")
                    else:
                        print_error("Aucune entreprise trouvée")
                        return False
                else:
                    print_error(f"Échec récupération entreprise: {response.status_code}")
                    return False
            else:
                print_error(f"Échec inscription: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            print_error(f"Exception inscription: {str(e)}")
            return False
        
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # 2. Créer 2 clients
        print_info("\n2. Création des clients...")
        customers_data = [
            {
                "first_name": "Client",
                "last_name": "Pro",
                "company_name": "Client Pro SA",
                "email": "contact@clientpro.tn",
                "phone": "+216 71 123 456",
                "billing_address": {
                    "street": "Avenue Habib Bourguiba",
                    "city": "Tunis",
                    "postal_code": "1000",
                    "country": "Tunisia"
                },
                "fiscal_id": "1234567A",
                "client_type": "entreprise"
            },
            {
                "first_name": "Client",
                "last_name": "Particulier",
                "email": "particulier@email.tn",
                "phone": "+216 98 765 432",
                "billing_address": {
                    "street": "Rue de la République",
                    "city": "Sfax",
                    "postal_code": "3000",
                    "country": "Tunisia"
                },
                "client_type": "particulier"
            }
        ]
        
        for customer_data in customers_data:
            try:
                response = await client.post(
                    f"{BASE_URL}/customers/",
                    params={"company_id": company_id},
                    json=customer_data,
                    headers=headers
                )
                
                if response.status_code in [200, 201]:
                    customer = response.json()
                    test_data["customers"].append(customer)
                    print_success(f"Client créé: {customer_data['name']}")
                else:
                    print_error(f"Échec création client {customer_data['name']}: {response.status_code}")
            except Exception as e:
                print_error(f"Exception création client: {str(e)}")
        
        # 3. Créer 1 fournisseur
        print_info("\n3. Création du fournisseur...")
        supplier_data = {
            "first_name": "Fournisseur",
            "last_name": "Tech",
            "company_name": "Fournisseur Tech SARL",
            "email": "contact@fournisseurtech.tn",
            "phone": "+216 71 987 654",
            "billing_address": {
                "street": "Zone Industrielle",
                "city": "Ariana",
                "postal_code": "2080",
                "country": "Tunisia"
            },
            "fiscal_id": "9876543B",
            "supplier_type": "entreprise"
        }
        
        try:
            response = await client.post(
                f"{BASE_URL}/suppliers/",
                params={"company_id": company_id},
                json=supplier_data,
                headers=headers
            )
            
            if response.status_code in [200, 201]:
                supplier = response.json()
                test_data["suppliers"].append(supplier)
                print_success(f"Fournisseur créé: {supplier_data['name']}")
            else:
                print_error(f"Échec création fournisseur: {response.status_code}")
        except Exception as e:
            print_error(f"Exception création fournisseur: {str(e)}")
        
        # 4. Créer 3 produits
        print_info("\n4. Création des produits...")
        products_data = [
            {
                "name": "Laptop",
                "description": "Ordinateur portable professionnel",
                "unit_price": 1200.0,
                "tax_rate": 19.0,
                "unit": "pièce",
                "sku": "LAP-001",
                "type": "product"
            },
            {
                "name": "Support",
                "description": "Support technique mensuel",
                "unit_price": 500.0,
                "tax_rate": 19.0,
                "unit": "mois",
                "sku": "SUP-001",
                "type": "service"
            },
            {
                "name": "Licence",
                "description": "Licence logicielle annuelle",
                "unit_price": 300.0,
                "tax_rate": 19.0,
                "unit": "licence",
                "sku": "LIC-001",
                "type": "product"
            }
        ]
        
        for product_data in products_data:
            try:
                response = await client.post(
                    f"{BASE_URL}/products/",
                    params={"company_id": company_id},
                    json=product_data,
                    headers=headers
                )
                
                if response.status_code in [200, 201]:
                    product = response.json()
                    test_data["products"].append(product)
                    print_success(f"Produit créé: {product_data['name']} - {product_data['price']} TND")
                else:
                    print_error(f"Échec création produit {product_data['name']}: {response.status_code}")
            except Exception as e:
                print_error(f"Exception création produit: {str(e)}")
    
    print_success(f"\n✅ PHASE 1 TERMINÉE: {len(test_data['customers'])} clients, {len(test_data['suppliers'])} fournisseur, {len(test_data['products'])} produits créés")
    return True


async def phase2_sales_cycle():
    """Phase 2: Cycle de vente complet"""
    global auth_token, company_id
    
    print_header("PHASE 2: CYCLE VENTE COMPLET (15 minutes)")
    
    headers = {"Authorization": f"Bearer {auth_token}"}
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Vente 1 - Avec processus complet Devis → Facture
        print_info("5. Créer Devis #1 (Client Pro, 2x Laptop + 1x Support)...")
        
        customer_pro = test_data["customers"][0]
        laptop = test_data["products"][0]
        support = test_data["products"][1]
        
        # Get customer display name
        customer_name = customer_pro.get("display_name") or f"{customer_pro.get('first_name', '')} {customer_pro.get('last_name', '')}".strip() or customer_pro.get("company_name", "")
        
        quote_data = {
            "customer_id": customer_pro["id"],
            "customer_name": customer_name,
            "date": "2025-01-15",
            "valid_until": "2025-02-15",
            "items": [
                {
                    "product_id": laptop["id"],
                    "product_name": laptop["name"],
                    "description": laptop["description"],
                    "quantity": 2,
                    "unit_price": laptop["unit_price"],
                    "tax_rate": laptop["tax_rate"]
                },
                {
                    "product_id": support["id"],
                    "product_name": support["name"],
                    "description": support["description"],
                    "quantity": 1,
                    "unit_price": support["unit_price"],
                    "tax_rate": support["tax_rate"]
                }
            ],
            "notes": "Devis pour équipement informatique"
        }
        
        try:
            response = await client.post(
                f"{BASE_URL}/quotes/",
                params={"company_id": company_id},
                json=quote_data,
                headers=headers
            )
            
            if response.status_code in [200, 201]:
                quote = response.json()
                print_success(f"Devis créé: {quote.get('number')} - Total TTC: {quote.get('total', 0)} TND")
                print_info(f"Status: {quote.get('status')} - Aucune écriture comptable attendue ✓")
                
                # 6. Convertir Devis → Facture #1
                print_info("\n6. Convertir Devis → Facture #1...")
                
                # Créer la facture manuellement avec les mêmes données
                invoice_data = {
                    "customer_id": customer_pro["id"],
                    "customer_name": customer_name,
                    "date": "2025-01-20",
                    "due_date": "2025-02-20",
                    "items": quote_data["items"],
                    "notes": "Facture convertie depuis devis",
                    "status": "draft"
                }
                
                response = await client.post(
                    f"{BASE_URL}/invoices/",
                    params={"company_id": company_id},
                    json=invoice_data,
                    headers=headers
                )
                
                if response.status_code in [200, 201]:
                    invoice = response.json()
                    test_data["invoices"].append(invoice)
                    invoice_id = invoice["id"]
                    print_success(f"Facture créée: {invoice.get('number')} - Total TTC: {invoice.get('total', 0)} TND")
                    print_info(f"Status: draft - Aucune écriture comptable encore ✓")
                    
                    # 7. Mettre à jour Facture #1 → Status "sent"
                    print_info("\n7. Mettre à jour Facture #1 → Status 'sent'...")
                    
                    response = await client.put(
                        f"{BASE_URL}/invoices/{invoice_id}",
                        params={"company_id": company_id},
                        json={"status": "sent"},
                        headers=headers
                    )
                    
                    if response.status_code == 200:
                        print_success("Facture mise à jour: Status = 'sent'")
                        
                        # Attendre un peu pour la synchronisation
                        await asyncio.sleep(2)
                        
                        # Vérifier les écritures comptables
                        print_info("Vérification des écritures comptables créées...")
                        response = await client.get(
                            f"{BASE_URL}/journal-entries/",
                            params={"company_id": company_id},
                            headers=headers
                        )
                        
                        if response.status_code == 200:
                            entries = response.json()
                            invoice_entries = [e for e in entries if e.get("document_type") == "invoice" and e.get("document_id") == invoice_id]
                            
                            if invoice_entries:
                                entry = invoice_entries[0]
                                print_success(f"✅ Écriture comptable créée: {entry.get('reference')}")
                                print_info(f"   Description: {entry.get('description')}")
                                
                                for line in entry.get("lines", []):
                                    if line.get("debit") > 0:
                                        print_info(f"   Débit {line.get('account_code')} ({line.get('account_name')}): {line.get('debit')} TND")
                                    if line.get("credit") > 0:
                                        print_info(f"   Crédit {line.get('account_code')} ({line.get('account_name')}): {line.get('credit')} TND")
                                
                                test_data["journal_entries"].append(entry)
                            else:
                                print_error("❌ AUCUNE écriture comptable trouvée pour la facture!")
                        else:
                            print_error(f"Échec récupération écritures: {response.status_code}")
                    else:
                        print_error(f"Échec mise à jour facture: {response.status_code}")
                    
                    # 8. Enregistrer Paiement partiel (2000 TND)
                    print_info("\n8. Enregistrer Paiement partiel (2000 TND)...")
                    
                    payment_data = {
                        "invoice_id": invoice_id,
                        "customer_id": customer_pro["id"],
                        "customer_name": customer_pro["name"],
                        "amount": 2000.0,
                        "date": "2025-01-25",
                        "payment_method": "bank",
                        "reference": "VIR-2025-001",
                        "notes": "Paiement partiel facture #1"
                    }
                    
                    response = await client.post(
                        f"{BASE_URL}/payments/",
                        params={"company_id": company_id},
                        json=payment_data,
                        headers=headers
                    )
                    
                    if response.status_code in [200, 201]:
                        payment = response.json()
                        test_data["payments"].append(payment)
                        payment_id = payment["id"]
                        print_success(f"Paiement enregistré: {payment.get('reference')} - {payment.get('amount')} TND")
                        
                        # Attendre et vérifier les écritures
                        await asyncio.sleep(2)
                        
                        response = await client.get(
                            f"{BASE_URL}/journal-entries/",
                            params={"company_id": company_id},
                            headers=headers
                        )
                        
                        if response.status_code == 200:
                            entries = response.json()
                            payment_entries = [e for e in entries if e.get("document_type") == "payment" and e.get("document_id") == payment_id]
                            
                            if payment_entries:
                                entry = payment_entries[0]
                                print_success(f"✅ Écriture comptable créée: {entry.get('reference')}")
                                
                                for line in entry.get("lines", []):
                                    if line.get("debit") > 0:
                                        print_info(f"   Débit {line.get('account_code')} ({line.get('account_name')}): {line.get('debit')} TND")
                                    if line.get("credit") > 0:
                                        print_info(f"   Crédit {line.get('account_code')} ({line.get('account_name')}): {line.get('credit')} TND")
                                
                                test_data["journal_entries"].append(entry)
                            else:
                                print_error("❌ AUCUNE écriture comptable trouvée pour le paiement!")
                    else:
                        print_error(f"Échec enregistrement paiement: {response.status_code}")
                else:
                    print_error(f"Échec création facture: {response.status_code}")
            else:
                print_error(f"Échec création devis: {response.status_code}")
        except Exception as e:
            print_error(f"Exception cycle vente 1: {str(e)}")
        
        # Vente 2 - Facture directe
        print_info("\n9. Créer Facture #2 (Client Particulier, 1x Licence)...")
        
        customer_part = test_data["customers"][1]
        licence = test_data["products"][2]
        
        invoice_data = {
            "customer_id": customer_part["id"],
            "customer_name": customer_part["name"],
            "date": "2025-02-10",
            "due_date": "2025-03-10",
            "items": [
                {
                    "product_id": licence["id"],
                    "product_name": licence["name"],
                    "description": licence["description"],
                    "quantity": 1,
                    "unit_price": licence["price"],
                    "tax_rate": licence["tax_rate"]
                }
            ],
            "notes": "Licence logicielle",
            "status": "draft"
        }
        
        try:
            response = await client.post(
                f"{BASE_URL}/invoices/",
                params={"company_id": company_id},
                json=invoice_data,
                headers=headers
            )
            
            if response.status_code in [200, 201]:
                invoice = response.json()
                test_data["invoices"].append(invoice)
                invoice_id = invoice["id"]
                print_success(f"Facture créée: {invoice.get('number')} - Total TTC: {invoice.get('total', 0)} TND")
                
                # 10. Mettre à jour → Status "sent"
                print_info("\n10. Mettre à jour Facture #2 → Status 'sent'...")
                
                response = await client.put(
                    f"{BASE_URL}/invoices/{invoice_id}",
                    params={"company_id": company_id},
                    json={"status": "sent"},
                    headers=headers
                )
                
                if response.status_code == 200:
                    print_success("Facture mise à jour: Status = 'sent'")
                    await asyncio.sleep(2)
                    
                    # Vérifier écritures
                    response = await client.get(
                        f"{BASE_URL}/journal-entries/",
                        params={"company_id": company_id},
                        headers=headers
                    )
                    
                    if response.status_code == 200:
                        entries = response.json()
                        invoice_entries = [e for e in entries if e.get("document_type") == "invoice" and e.get("document_id") == invoice_id]
                        
                        if invoice_entries:
                            print_success(f"✅ Écriture comptable créée pour Facture #2")
                            test_data["journal_entries"].append(invoice_entries[0])
                        else:
                            print_error("❌ AUCUNE écriture comptable trouvée!")
                
                # 11. Paiement complet (357 TND)
                print_info("\n11. Paiement complet Facture #2...")
                
                payment_data = {
                    "invoice_id": invoice_id,
                    "customer_id": customer_part["id"],
                    "customer_name": customer_part["name"],
                    "amount": invoice.get("total", 0),
                    "date": "2025-02-15",
                    "payment_method": "bank",
                    "reference": "VIR-2025-002",
                    "notes": "Paiement complet facture #2"
                }
                
                response = await client.post(
                    f"{BASE_URL}/payments/",
                    params={"company_id": company_id},
                    json=payment_data,
                    headers=headers
                )
                
                if response.status_code in [200, 201]:
                    payment = response.json()
                    test_data["payments"].append(payment)
                    print_success(f"Paiement enregistré: {payment.get('amount')} TND")
                    
                    await asyncio.sleep(2)
                    
                    response = await client.get(
                        f"{BASE_URL}/journal-entries/",
                        params={"company_id": company_id},
                        headers=headers
                    )
                    
                    if response.status_code == 200:
                        entries = response.json()
                        payment_entries = [e for e in entries if e.get("document_type") == "payment" and e.get("document_id") == payment["id"]]
                        
                        if payment_entries:
                            print_success(f"✅ Écriture comptable créée pour Paiement #2")
                            test_data["journal_entries"].append(payment_entries[0])
                        else:
                            print_error("❌ AUCUNE écriture comptable trouvée!")
            else:
                print_error(f"Échec création facture #2: {response.status_code}")
        except Exception as e:
            print_error(f"Exception vente 2: {str(e)}")
    
    print_success(f"\n✅ PHASE 2 TERMINÉE: {len(test_data['invoices'])} factures, {len(test_data['payments'])} paiements créés")
    return True


async def phase3_purchase_cycle():
    """Phase 3: Cycle d'achat complet"""
    global auth_token, company_id
    
    print_header("PHASE 3: CYCLE ACHAT COMPLET (10 minutes)")
    
    headers = {"Authorization": f"Bearer {auth_token}"}
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # 13. Créer Facture Fournisseur #1
        print_info("13. Créer Facture Fournisseur #1 (7140 TND TTC)...")
        
        supplier = test_data["suppliers"][0]
        laptop = test_data["products"][0]
        
        supplier_invoice_data = {
            "supplier_id": supplier["id"],
            "supplier_name": supplier["name"],
            "number": "FACH-2025-001",
            "date": "2025-02-01",
            "due_date": "2025-03-01",
            "items": [
                {
                    "description": f"Achat {laptop['name']}",
                    "quantity": 5,
                    "unit_price": 1200.0,
                    "tax_rate": 19.0
                }
            ],
            "notes": "Achat stock laptops",
            "status": "validated"
        }
        
        try:
            response = await client.post(
                f"{BASE_URL}/supplier-invoices/",
                params={"company_id": company_id},
                json=supplier_invoice_data,
                headers=headers
            )
            
            if response.status_code in [200, 201]:
                supplier_invoice = response.json()
                test_data["supplier_invoices"].append(supplier_invoice)
                supplier_invoice_id = supplier_invoice["id"]
                print_success(f"Facture fournisseur créée: {supplier_invoice.get('number')} - Total TTC: {supplier_invoice.get('total', 0)} TND")
                
                # Attendre et vérifier écritures
                await asyncio.sleep(2)
                
                response = await client.get(
                    f"{BASE_URL}/journal-entries/",
                    params={"company_id": company_id},
                    headers=headers
                )
                
                if response.status_code == 200:
                    entries = response.json()
                    supplier_entries = [e for e in entries if e.get("document_type") == "supplier_invoice" and e.get("document_id") == supplier_invoice_id]
                    
                    if supplier_entries:
                        entry = supplier_entries[0]
                        print_success(f"✅ Écriture comptable créée: {entry.get('reference')}")
                        
                        for line in entry.get("lines", []):
                            if line.get("debit") > 0:
                                print_info(f"   Débit {line.get('account_code')} ({line.get('account_name')}): {line.get('debit')} TND")
                            if line.get("credit") > 0:
                                print_info(f"   Crédit {line.get('account_code')} ({line.get('account_name')}): {line.get('credit')} TND")
                        
                        test_data["journal_entries"].append(entry)
                    else:
                        print_error("❌ AUCUNE écriture comptable trouvée pour la facture fournisseur!")
                else:
                    print_error(f"Échec récupération écritures: {response.status_code}")
                
                # 14. Enregistrer Paiement Fournisseur
                print_info("\n14. Enregistrer Paiement Fournisseur (7140 TND)...")
                
                supplier_payment_data = {
                    "supplier_invoice_id": supplier_invoice_id,
                    "supplier_id": supplier["id"],
                    "supplier_name": supplier["name"],
                    "amount": supplier_invoice.get("total", 0),
                    "date": "2025-02-05",
                    "payment_method": "bank",
                    "reference": "CHQ-2025-001",
                    "notes": "Paiement facture fournisseur"
                }
                
                response = await client.post(
                    f"{BASE_URL}/supplier-payments/",
                    params={"company_id": company_id},
                    json=supplier_payment_data,
                    headers=headers
                )
                
                if response.status_code in [200, 201]:
                    supplier_payment = response.json()
                    test_data["supplier_payments"].append(supplier_payment)
                    print_success(f"Paiement fournisseur enregistré: {supplier_payment.get('amount')} TND")
                    
                    await asyncio.sleep(2)
                    
                    response = await client.get(
                        f"{BASE_URL}/journal-entries/",
                        params={"company_id": company_id},
                        headers=headers
                    )
                    
                    if response.status_code == 200:
                        entries = response.json()
                        payment_entries = [e for e in entries if e.get("document_type") == "supplier_payment" and e.get("document_id") == supplier_payment["id"]]
                        
                        if payment_entries:
                            entry = payment_entries[0]
                            print_success(f"✅ Écriture comptable créée: {entry.get('reference')}")
                            
                            for line in entry.get("lines", []):
                                if line.get("debit") > 0:
                                    print_info(f"   Débit {line.get('account_code')} ({line.get('account_name')}): {line.get('debit')} TND")
                                if line.get("credit") > 0:
                                    print_info(f"   Crédit {line.get('account_code')} ({line.get('account_name')}): {line.get('credit')} TND")
                            
                            test_data["journal_entries"].append(entry)
                        else:
                            print_error("❌ AUCUNE écriture comptable trouvée pour le paiement fournisseur!")
                else:
                    print_error(f"Échec paiement fournisseur: {response.status_code}")
            else:
                print_error(f"Échec création facture fournisseur: {response.status_code} - {response.text}")
        except Exception as e:
            print_error(f"Exception cycle achat: {str(e)}")
    
    print_success(f"\n✅ PHASE 3 TERMINÉE: {len(test_data['supplier_invoices'])} facture fournisseur, {len(test_data['supplier_payments'])} paiement créés")
    return True


async def phase4_corrections():
    """Phase 4: Corrections (Avoir)"""
    global auth_token, company_id
    
    print_header("PHASE 4: CORRECTIONS (5 minutes)")
    
    headers = {"Authorization": f"Bearer {auth_token}"}
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # 15. Créer Facture d'Avoir
        print_info("15. Créer Facture d'Avoir pour Facture #1 (Retour 1x Laptop)...")
        
        if len(test_data["invoices"]) > 0:
            invoice = test_data["invoices"][0]
            laptop = test_data["products"][0]
            
            credit_note_data = {
                "invoice_id": invoice["id"],
                "customer_id": invoice["customer_id"],
                "customer_name": invoice["customer_name"],
                "date": "2025-03-01",
                "items": [
                    {
                        "product_id": laptop["id"],
                        "product_name": laptop["name"],
                        "description": "Retour laptop défectueux",
                        "quantity": 1,
                        "unit_price": laptop["price"],
                        "tax_rate": laptop["tax_rate"]
                    }
                ],
                "reason": "Produit défectueux",
                "status": "validated"
            }
            
            try:
                response = await client.post(
                    f"{BASE_URL}/credit-notes/",
                    params={"company_id": company_id},
                    json=credit_note_data,
                    headers=headers
                )
                
                if response.status_code in [200, 201]:
                    credit_note = response.json()
                    test_data["credit_notes"].append(credit_note)
                    credit_note_id = credit_note["id"]
                    print_success(f"Avoir créé: {credit_note.get('number')} - Total TTC: {credit_note.get('total', 0)} TND")
                    
                    # Attendre et vérifier écritures
                    await asyncio.sleep(2)
                    
                    response = await client.get(
                        f"{BASE_URL}/journal-entries/",
                        params={"company_id": company_id},
                        headers=headers
                    )
                    
                    if response.status_code == 200:
                        entries = response.json()
                        credit_entries = [e for e in entries if e.get("document_type") == "credit_note" and e.get("document_id") == credit_note_id]
                        
                        if credit_entries:
                            entry = credit_entries[0]
                            print_success(f"✅ Écriture comptable d'annulation créée: {entry.get('reference')}")
                            
                            for line in entry.get("lines", []):
                                if line.get("debit") > 0:
                                    print_info(f"   Débit {line.get('account_code')} ({line.get('account_name')}): {line.get('debit')} TND")
                                if line.get("credit") > 0:
                                    print_info(f"   Crédit {line.get('account_code')} ({line.get('account_name')}): {line.get('credit')} TND")
                            
                            test_data["journal_entries"].append(entry)
                        else:
                            print_error("❌ AUCUNE écriture comptable trouvée pour l'avoir!")
                    else:
                        print_error(f"Échec récupération écritures: {response.status_code}")
                else:
                    print_error(f"Échec création avoir: {response.status_code} - {response.text}")
            except Exception as e:
                print_error(f"Exception création avoir: {str(e)}")
        else:
            print_warning("Aucune facture disponible pour créer un avoir")
    
    print_success(f"\n✅ PHASE 4 TERMINÉE: {len(test_data['credit_notes'])} avoir créé")
    return True


async def phase5_final_report():
    """Phase 5: Bilan final et rapport financier"""
    global auth_token, company_id
    
    print_header("PHASE 5: BILAN FINAL (10 minutes)")
    
    headers = {"Authorization": f"Bearer {auth_token}"}
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # 16. Récupérer toutes les écritures comptables
        print_info("16. Récupération de toutes les écritures comptables...")
        
        try:
            response = await client.get(
                f"{BASE_URL}/journal-entries/",
                params={"company_id": company_id},
                headers=headers
            )
            
            if response.status_code == 200:
                all_entries = response.json()
                print_success(f"Total écritures comptables: {len(all_entries)}")
                
                # Calculer les totaux par compte
                account_balances = {}
                total_debit = 0
                total_credit = 0
                
                for entry in all_entries:
                    for line in entry.get("lines", []):
                        account_code = line.get("account_code")
                        account_name = line.get("account_name")
                        debit = line.get("debit", 0)
                        credit = line.get("credit", 0)
                        
                        if account_code not in account_balances:
                            account_balances[account_code] = {
                                "name": account_name,
                                "debit": 0,
                                "credit": 0
                            }
                        
                        account_balances[account_code]["debit"] += debit
                        account_balances[account_code]["credit"] += credit
                        
                        total_debit += debit
                        total_credit += credit
                
                # 17. Générer le rapport financier
                print_header("RAPPORT FINANCIER Q1 2025")
                
                print(f"\n{Colors.CYAN}{'='*80}")
                print("BALANCE GÉNÉRALE")
                print(f"{'='*80}{Colors.END}\n")
                
                print(f"{'Compte':<10} {'Nom du compte':<40} {'Débit':>15} {'Crédit':>15}")
                print("-" * 80)
                
                for account_code in sorted(account_balances.keys()):
                    balance = account_balances[account_code]
                    print(f"{account_code:<10} {balance['name']:<40} {balance['debit']:>15.3f} {balance['credit']:>15.3f}")
                
                print("-" * 80)
                print(f"{'TOTAL':<50} {total_debit:>15.3f} {total_credit:>15.3f}")
                
                # Vérifier l'équilibre
                if abs(total_debit - total_credit) < 0.01:
                    print_success(f"\n✅ ÉQUILIBRE COMPTABLE VÉRIFIÉ: Débit = Crédit")
                else:
                    print_error(f"\n❌ DÉSÉQUILIBRE COMPTABLE: Débit ({total_debit}) ≠ Crédit ({total_credit})")
                
                # Calculer les indicateurs financiers
                print(f"\n{Colors.CYAN}{'='*80}")
                print("INDICATEURS FINANCIERS Q1 2025")
                print(f"{'='*80}{Colors.END}\n")
                
                # Ventes
                ventes_ht = account_balances.get("707", {}).get("credit", 0)
                tva_collectee = account_balances.get("4351", {}).get("credit", 0) - account_balances.get("4351", {}).get("debit", 0)
                ventes_ttc = ventes_ht * 1.19
                
                print(f"{Colors.GREEN}VENTES:{Colors.END}")
                print(f"  - Ventes HT: {ventes_ht:.3f} TND")
                print(f"  - TVA Collectée: {tva_collectee:.3f} TND")
                print(f"  - Ventes TTC: {ventes_ttc:.3f} TND")
                
                # Achats
                achats_ht = account_balances.get("607", {}).get("debit", 0)
                tva_deductible = account_balances.get("4362", {}).get("debit", 0)
                achats_ttc = achats_ht * 1.19
                
                print(f"\n{Colors.RED}ACHATS:{Colors.END}")
                print(f"  - Achats HT: {achats_ht:.3f} TND")
                print(f"  - TVA Déductible: {tva_deductible:.3f} TND")
                print(f"  - Achats TTC: {achats_ttc:.3f} TND")
                
                # Trésorerie
                banque_debit = account_balances.get("521", {}).get("debit", 0)
                banque_credit = account_balances.get("521", {}).get("credit", 0)
                solde_banque = banque_debit - banque_credit
                
                print(f"\n{Colors.BLUE}TRÉSORERIE:{Colors.END}")
                print(f"  - Encaissements: {banque_debit:.3f} TND")
                print(f"  - Décaissements: {banque_credit:.3f} TND")
                print(f"  - Solde Banque: {solde_banque:.3f} TND")
                
                # Créances et dettes
                clients_debit = account_balances.get("411", {}).get("debit", 0)
                clients_credit = account_balances.get("411", {}).get("credit", 0)
                creances = clients_debit - clients_credit
                
                fournisseurs_debit = account_balances.get("401", {}).get("debit", 0)
                fournisseurs_credit = account_balances.get("401", {}).get("credit", 0)
                dettes = fournisseurs_credit - fournisseurs_debit
                
                print(f"\n{Colors.YELLOW}CRÉANCES ET DETTES:{Colors.END}")
                print(f"  - Créances clients: {creances:.3f} TND")
                print(f"  - Dettes fournisseurs: {dettes:.3f} TND")
                
                # TVA
                tva_a_payer = tva_collectee - tva_deductible
                
                print(f"\n{Colors.MAGENTA}TVA:{Colors.END}")
                print(f"  - TVA Collectée: {tva_collectee:.3f} TND")
                print(f"  - TVA Déductible: {tva_deductible:.3f} TND")
                if tva_a_payer > 0:
                    print(f"  - TVA À PAYER: {tva_a_payer:.3f} TND")
                else:
                    print(f"  - TVA À RÉCUPÉRER: {abs(tva_a_payer):.3f} TND")
                
                # Résultat
                resultat = ventes_ht - achats_ht
                
                print(f"\n{Colors.CYAN}RÉSULTAT:{Colors.END}")
                print(f"  - Chiffre d'affaires HT: {ventes_ht:.3f} TND")
                print(f"  - Achats HT: {achats_ht:.3f} TND")
                if resultat >= 0:
                    print(f"  - RÉSULTAT BRUT: +{resultat:.3f} TND (bénéficiaire)")
                else:
                    print(f"  - RÉSULTAT BRUT: {resultat:.3f} TND (déficitaire)")
                
                # Résumé des documents
                print(f"\n{Colors.CYAN}{'='*80}")
                print("RÉSUMÉ DES DOCUMENTS")
                print(f"{'='*80}{Colors.END}\n")
                
                print(f"  - Factures clients: {len(test_data['invoices'])}")
                print(f"  - Paiements clients: {len(test_data['payments'])}")
                print(f"  - Factures fournisseurs: {len(test_data['supplier_invoices'])}")
                print(f"  - Paiements fournisseurs: {len(test_data['supplier_payments'])}")
                print(f"  - Avoirs: {len(test_data['credit_notes'])}")
                print(f"  - Écritures comptables: {len(all_entries)}")
                
                # Validation finale
                print(f"\n{Colors.CYAN}{'='*80}")
                print("VALIDATION FINALE")
                print(f"{'='*80}{Colors.END}\n")
                
                checks = []
                checks.append(("Écritures comptables générées automatiquement", len(all_entries) > 0))
                checks.append(("Équilibre comptable vérifié", abs(total_debit - total_credit) < 0.01))
                checks.append(("Cycle Devis → Facture → Paiement fonctionnel", len(test_data['invoices']) > 0 and len(test_data['payments']) > 0))
                checks.append(("Cycle Achat → Paiement fonctionnel", len(test_data['supplier_invoices']) > 0 and len(test_data['supplier_payments']) > 0))
                checks.append(("Avoir fonctionnel", len(test_data['credit_notes']) > 0))
                
                all_passed = True
                for check_name, check_result in checks:
                    if check_result:
                        print_success(f"{check_name}")
                    else:
                        print_error(f"{check_name}")
                        all_passed = False
                
                if all_passed:
                    print(f"\n{Colors.GREEN}{'='*80}")
                    print("✅ TOUS LES TESTS SONT PASSÉS - SYNCHRONISATION COMPTABLE FONCTIONNELLE")
                    print(f"{'='*80}{Colors.END}\n")
                else:
                    print(f"\n{Colors.RED}{'='*80}")
                    print("❌ CERTAINS TESTS ONT ÉCHOUÉ - VÉRIFIER LA SYNCHRONISATION COMPTABLE")
                    print(f"{'='*80}{Colors.END}\n")
                
                # Sauvegarder le rapport
                report_file = "/app/rapport_financier_q1_2025.txt"
                with open(report_file, "w", encoding="utf-8") as f:
                    f.write("="*80 + "\n")
                    f.write("RAPPORT FINANCIER Q1 2025 - EASYBILL\n")
                    f.write("="*80 + "\n\n")
                    
                    f.write("BALANCE GÉNÉRALE\n")
                    f.write("-"*80 + "\n")
                    f.write(f"{'Compte':<10} {'Nom du compte':<40} {'Débit':>15} {'Crédit':>15}\n")
                    f.write("-"*80 + "\n")
                    
                    for account_code in sorted(account_balances.keys()):
                        balance = account_balances[account_code]
                        f.write(f"{account_code:<10} {balance['name']:<40} {balance['debit']:>15.3f} {balance['credit']:>15.3f}\n")
                    
                    f.write("-"*80 + "\n")
                    f.write(f"{'TOTAL':<50} {total_debit:>15.3f} {total_credit:>15.3f}\n\n")
                    
                    f.write(f"ÉQUILIBRE: {'✅ OUI' if abs(total_debit - total_credit) < 0.01 else '❌ NON'}\n\n")
                    
                    f.write("INDICATEURS FINANCIERS\n")
                    f.write("-"*80 + "\n")
                    f.write(f"Ventes HT: {ventes_ht:.3f} TND\n")
                    f.write(f"Achats HT: {achats_ht:.3f} TND\n")
                    f.write(f"Résultat: {resultat:.3f} TND\n")
                    f.write(f"Solde Banque: {solde_banque:.3f} TND\n")
                    f.write(f"Créances: {creances:.3f} TND\n")
                    f.write(f"Dettes: {dettes:.3f} TND\n")
                    f.write(f"TVA: {tva_a_payer:.3f} TND\n\n")
                    
                    f.write("DOCUMENTS\n")
                    f.write("-"*80 + "\n")
                    f.write(f"Factures clients: {len(test_data['invoices'])}\n")
                    f.write(f"Paiements clients: {len(test_data['payments'])}\n")
                    f.write(f"Factures fournisseurs: {len(test_data['supplier_invoices'])}\n")
                    f.write(f"Paiements fournisseurs: {len(test_data['supplier_payments'])}\n")
                    f.write(f"Avoirs: {len(test_data['credit_notes'])}\n")
                    f.write(f"Écritures comptables: {len(all_entries)}\n")
                
                print_success(f"Rapport sauvegardé: {report_file}")
                
            else:
                print_error(f"Échec récupération écritures: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            print_error(f"Exception génération rapport: {str(e)}")
            return False
    
    return True


async def main():
    """Main test execution"""
    print(f"\n{Colors.BLUE}{'='*80}")
    print("E2E TEST - SIMULATION Q1 2025 (VERSION 2 - AVEC CORRECTIONS)")
    print("Test complet du cycle comptable avec synchronisation automatique")
    print(f"{'='*80}{Colors.END}\n")
    
    print(f"Backend URL: {BASE_URL}\n")
    
    # Exécuter les phases
    success = True
    
    success = success and await phase1_setup()
    if not success:
        print_error("Phase 1 échouée - Arrêt du test")
        return
    
    success = success and await phase2_sales_cycle()
    if not success:
        print_error("Phase 2 échouée - Arrêt du test")
        return
    
    success = success and await phase3_purchase_cycle()
    if not success:
        print_error("Phase 3 échouée - Arrêt du test")
        return
    
    success = success and await phase4_corrections()
    if not success:
        print_error("Phase 4 échouée - Arrêt du test")
        return
    
    success = success and await phase5_final_report()
    
    if success:
        print(f"\n{Colors.GREEN}{'='*80}")
        print("✅ TEST E2E Q1 2025 TERMINÉ AVEC SUCCÈS")
        print(f"{'='*80}{Colors.END}\n")
    else:
        print(f"\n{Colors.RED}{'='*80}")
        print("❌ TEST E2E Q1 2025 TERMINÉ AVEC DES ERREURS")
        print(f"{'='*80}{Colors.END}\n")


if __name__ == "__main__":
    asyncio.run(main())
