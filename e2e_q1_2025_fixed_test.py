"""
E2E Test Q1 2025 - VERSION FINALE AVEC LOGS
Test complet du cycle comptable Q1 2025 après corrections des bugs
Objectif: Vérifier que 11/11 écritures comptables sont créées
"""

import httpx
import asyncio
from datetime import datetime, timedelta
from typing import Dict, Optional
import json

# Configuration
BASE_URL = "https://invoice-ai-match.preview.emergentagent.com/api"
TEST_EMAIL = f"easybill-e2e-fixed-{int(datetime.now().timestamp())}@test.com"
TEST_PASSWORD = "EasyBill2025Fixed!"

# Variables globales
auth_token = None
company_id = None
test_data = {
    "customers": [],
    "suppliers": [],
    "products": [],
    "invoices": [],
    "payments": [],
    "supplier_invoices": [],
    "supplier_payments": [],
    "credit_notes": []
}

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    END = '\033[0m'

def log(message: str, color: str = Colors.BLUE):
    """Log avec couleur"""
    print(f"{color}{message}{Colors.END}")

def log_success(message: str):
    log(f"✅ {message}", Colors.GREEN)

def log_error(message: str):
    log(f"❌ {message}", Colors.RED)

def log_warning(message: str):
    log(f"⚠️  {message}", Colors.YELLOW)

def log_info(message: str):
    log(f"ℹ️  {message}", Colors.CYAN)

def print_section(title: str):
    """Print section header"""
    print(f"\n{Colors.BLUE}{'='*80}")
    print(f"{title}")
    print(f"{'='*80}{Colors.END}\n")


async def update_document_status(client, endpoint: str, doc_id: str, new_status: str, doc_number: str, company_id: str, headers: dict) -> bool:
    """Helper function to update document status via PUT"""
    try:
        # Récupérer le document complet
        response_get = await client.get(
            f"{BASE_URL}/{endpoint}/{doc_id}",
            params={"company_id": company_id},
            headers=headers
        )
        if response_get.status_code == 200:
            full_doc = response_get.json()
            full_doc["status"] = new_status
            
            response = await client.put(
                f"{BASE_URL}/{endpoint}/{doc_id}",
                params={"company_id": company_id},
                json=full_doc,
                headers=headers
            )
            if response.status_code == 200:
                log_success(f"✨ {doc_number} → statut '{new_status}' (sync comptable déclenchée)")
                return True
            else:
                log_warning(f"Erreur changement statut: {response.status_code}")
                return False
        else:
            log_warning(f"Erreur récupération document: {response_get.status_code}")
            return False
    except Exception as e:
        log_error(f"Exception changement statut: {str(e)}")
        return False


async def register_and_login() -> bool:
    """Phase 0: Inscription et connexion"""
    print_section("PHASE 0: INSCRIPTION ET CONNEXION")
    
    global auth_token, company_id
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Inscription
        try:
            log_info(f"Inscription: {TEST_EMAIL}")
            response = await client.post(
                f"{BASE_URL}/auth/register",
                json={
                    "email": TEST_EMAIL,
                    "password": TEST_PASSWORD,
                    "full_name": "Test User E2E",
                    "company_name": "EasyBill E2E Test Fixed",
                    "company_type": "SARL",
                    "tax_id": "1234567X",
                    "address": "123 Test Street, Tunis",
                    "phone": "+216 71 123 456"
                }
            )
            
            if response.status_code in [200, 201]:
                data = response.json()
                auth_token = data.get("access_token")
                log_success(f"Inscription réussie")
                
                # Récupérer company_id
                if auth_token:
                    headers = {"Authorization": f"Bearer {auth_token}"}
                    response = await client.get(f"{BASE_URL}/companies/", headers=headers)
                    if response.status_code == 200:
                        companies = response.json()
                        if companies:
                            company_id = companies[0].get("id")
                            log_success(f"Company ID récupéré: {company_id}")
            else:
                # Peut-être déjà inscrit, essayer de se connecter
                log_warning(f"Inscription échouée (peut-être déjà inscrit): {response.status_code}")
                
        except Exception as e:
            log_warning(f"Erreur inscription: {str(e)}")
        
        # Connexion
        if not auth_token:
            try:
                log_info("Tentative de connexion...")
                response = await client.post(
                    f"{BASE_URL}/auth/login",
                    json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    auth_token = data.get("access_token")
                    log_success("Connexion réussie")
                    
                    # Récupérer company_id
                    headers = {"Authorization": f"Bearer {auth_token}"}
                    response = await client.get(f"{BASE_URL}/companies/", headers=headers)
                    if response.status_code == 200:
                        companies = response.json()
                        if companies:
                            company_id = companies[0].get("id")
                            log_success(f"Company ID récupéré: {company_id}")
                else:
                    log_error(f"Connexion échouée: {response.status_code}")
                    return False
                    
            except Exception as e:
                log_error(f"Erreur connexion: {str(e)}")
                return False
    
    return auth_token is not None and company_id is not None


async def create_test_data() -> bool:
    """Phase 1: Création des données de test"""
    print_section("PHASE 1: CRÉATION DES DONNÉES DE TEST")
    
    headers = {"Authorization": f"Bearer {auth_token}"}
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Créer 3 clients
        log_info("Création de 3 clients...")
        customers_data = [
            {"first_name": "Alpha", "last_name": "Client", "company_name": "Client Alpha SARL", "email": "alpha@client.tn", "phone": "+216 71 111 111", "billing_address": {"street": "Tunis", "city": "Tunis", "postal_code": "1000", "country": "TN"}},
            {"first_name": "Beta", "last_name": "Client", "company_name": "Client Beta SA", "email": "beta@client.tn", "phone": "+216 71 222 222", "billing_address": {"street": "Sfax", "city": "Sfax", "postal_code": "3000", "country": "TN"}},
            {"first_name": "Gamma", "last_name": "Client", "company_name": "Client Gamma SUARL", "email": "gamma@client.tn", "phone": "+216 71 333 333", "billing_address": {"street": "Sousse", "city": "Sousse", "postal_code": "4000", "country": "TN"}}
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
                    log_success(f"Client créé: {customer_data['company_name']}")
                else:
                    log_error(f"Erreur création client: {response.status_code}")
            except Exception as e:
                log_error(f"Exception création client: {str(e)}")
        
        # Créer 2 fournisseurs
        log_info("Création de 2 fournisseurs...")
        suppliers_data = [
            {"first_name": "Delta", "last_name": "Supplier", "company_name": "Fournisseur Delta SARL", "email": "delta@supplier.tn", "phone": "+216 71 444 444", "billing_address": {"street": "Tunis", "city": "Tunis", "postal_code": "1000", "country": "TN"}},
            {"first_name": "Epsilon", "last_name": "Supplier", "company_name": "Fournisseur Epsilon SA", "email": "epsilon@supplier.tn", "phone": "+216 71 555 555", "billing_address": {"street": "Ariana", "city": "Ariana", "postal_code": "2000", "country": "TN"}}
        ]
        
        for supplier_data in suppliers_data:
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
                    log_success(f"Fournisseur créé: {supplier_data['company_name']}")
                else:
                    log_error(f"Erreur création fournisseur: {response.status_code}")
            except Exception as e:
                log_error(f"Exception création fournisseur: {str(e)}")
        
        # Créer 5 produits
        log_info("Création de 5 produits...")
        products_data = [
            {"name": "Produit A", "description": "Description A", "unit_price": 100.0, "tax_rate": 19.0, "type": "product"},
            {"name": "Produit B", "description": "Description B", "unit_price": 250.0, "tax_rate": 19.0, "type": "product"},
            {"name": "Service C", "description": "Service C", "unit_price": 500.0, "tax_rate": 19.0, "type": "service"},
            {"name": "Produit D", "description": "Description D", "unit_price": 75.0, "tax_rate": 19.0, "type": "product"},
            {"name": "Service E", "description": "Service E", "unit_price": 150.0, "tax_rate": 19.0, "type": "service"}
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
                    # Store both the ID and the original data
                    product_with_data = {
                        "id": product.get("id"),
                        "name": product_data["name"],
                        "unit_price": product_data["unit_price"],
                        "tax_rate": product_data["tax_rate"],
                        "type": product_data["type"]
                    }
                    test_data["products"].append(product_with_data)
                    log_success(f"Produit créé: {product_data['name']} (ID: {product.get('id', 'N/A')})")
                else:
                    log_error(f"Erreur création produit: {response.status_code}")
            except Exception as e:
                log_error(f"Exception création produit: {str(e)}")
    
    log_info(f"Données créées: {len(test_data['customers'])} clients, {len(test_data['suppliers'])} fournisseurs, {len(test_data['products'])} produits")
    
    # Debug: Print first product structure
    if test_data['products']:
        log_info(f"Premier produit (debug): {test_data['products'][0]}")
    
    return len(test_data['customers']) >= 3 and len(test_data['suppliers']) >= 2 and len(test_data['products']) >= 5


async def create_customer_invoices() -> bool:
    """Phase 2: Création de 3 factures clients"""
    print_section("PHASE 2: CRÉATION DE 3 FACTURES CLIENTS")
    
    headers = {"Authorization": f"Bearer {auth_token}"}
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Facture 1 - Janvier 2025
        log_info("Création facture client #1 (Janvier 2025)...")
        invoice1_data = {
            "customer_id": test_data["customers"][0]["id"],
            "date": "2025-01-15",
            "due_date": "2025-02-15",
            "number": "FC-2025-001",
            "items": [
                {
                    "product_id": test_data["products"][0]["id"],
                    "product_name": test_data["products"][0]["name"],
                    "description": "Produit A",
                    "quantity": 10,
                    "unit_price": 100.0,
                    "tax_rate": 19.0,
                    "total": 1000.0
                },
                {
                    "product_id": test_data["products"][2]["id"],
                    "product_name": test_data["products"][2]["name"],
                    "description": "Service C",
                    "quantity": 2,
                    "unit_price": 500.0,
                    "tax_rate": 19.0,
                    "total": 1000.0
                }
            ],
            "subtotal": 2000.0,
            "total_tax": 380.0,
            "total": 2380.0,
            "status": "draft"
        }
        
        try:
            response = await client.post(
                f"{BASE_URL}/invoices/",
                params={"company_id": company_id},
                json=invoice1_data,
                headers=headers
            )
            if response.status_code in [200, 201]:
                invoice = response.json()
                test_data["invoices"].append(invoice)
                log_success(f"Facture créée: {invoice1_data['number']}")
                
                # Changer le statut à "sent" pour déclencher la sync comptable
                invoice_id = invoice["id"]
                await update_document_status(client, "invoices", invoice_id, "sent", invoice1_data['number'], company_id, headers)
            else:
                log_error(f"Erreur création facture: {response.status_code} - {response.text}")
        except Exception as e:
            log_error(f"Exception création facture: {str(e)}")
        
        # Facture 2 - Février 2025
        log_info("Création facture client #2 (Février 2025)...")
        invoice2_data = {
            "customer_id": test_data["customers"][1]["id"],
            "date": "2025-02-10",
            "due_date": "2025-03-10",
            "number": "FC-2025-002",
            "items": [
                {
                    "product_id": test_data["products"][1]["id"],
                    "product_name": test_data["products"][1]["name"],
                    "description": "Produit B",
                    "quantity": 5,
                    "unit_price": 250.0,
                    "tax_rate": 19.0,
                    "total": 1250.0
                },
                {
                    "product_id": test_data["products"][3]["id"],
                    "product_name": test_data["products"][3]["name"],
                    "description": "Produit D",
                    "quantity": 4,
                    "unit_price": 75.0,
                    "tax_rate": 19.0,
                    "total": 300.0
                }
            ],
            "subtotal": 1550.0,
            "total_tax": 294.5,
            "total": 1844.5,
            "status": "draft"
        }
        
        try:
            response = await client.post(
                f"{BASE_URL}/invoices/",
                params={"company_id": company_id},
                json=invoice2_data,
                headers=headers
            )
            if response.status_code in [200, 201]:
                invoice = response.json()
                test_data["invoices"].append(invoice)
                log_success(f"Facture créée: {invoice2_data['number']}")
                
                # Changer le statut à "sent"
                invoice_id = invoice["id"]
                await update_document_status(client, "invoices", invoice_id, "sent", invoice2_data['number'], company_id, headers)
            else:
                log_error(f"Erreur création facture: {response.status_code}")
        except Exception as e:
            log_error(f"Exception création facture: {str(e)}")
        
        # Facture 3 - Mars 2025
        log_info("Création facture client #3 (Mars 2025)...")
        invoice3_data = {
            "customer_id": test_data["customers"][2]["id"],
            "date": "2025-03-05",
            "due_date": "2025-04-05",
            "number": "FC-2025-003",
            "items": [
                {
                    "product_id": test_data["products"][4]["id"],
                    "product_name": test_data["products"][4]["name"],
                    "description": "Service E",
                    "quantity": 8,
                    "unit_price": 150.0,
                    "tax_rate": 19.0,
                    "total": 1200.0
                },
                {
                    "product_id": test_data["products"][0]["id"],
                    "product_name": test_data["products"][0]["name"],
                    "description": "Produit A",
                    "quantity": 1,
                    "unit_price": 100.0,
                    "tax_rate": 19.0,
                    "total": 100.0
                }
            ],
            "subtotal": 1300.0,
            "total_tax": 247.0,
            "total": 1547.0,
            "status": "draft"
        }
        
        try:
            response = await client.post(
                f"{BASE_URL}/invoices/",
                params={"company_id": company_id},
                json=invoice3_data,
                headers=headers
            )
            if response.status_code in [200, 201]:
                invoice = response.json()
                test_data["invoices"].append(invoice)
                log_success(f"Facture créée: {invoice3_data['number']}")
                
                # Changer le statut à "sent"
                invoice_id = invoice["id"]
                await update_document_status(client, "invoices", invoice_id, "sent", invoice3_data['number'], company_id, headers)
            else:
                log_error(f"Erreur création facture: {response.status_code}")
        except Exception as e:
            log_error(f"Exception création facture: {str(e)}")
    
    log_info(f"Factures clients créées: {len(test_data['invoices'])}/3")
    return len(test_data['invoices']) >= 3


async def create_customer_payments() -> bool:
    """Phase 3: Création de 3 paiements clients"""
    print_section("PHASE 3: CRÉATION DE 3 PAIEMENTS CLIENTS")
    
    headers = {"Authorization": f"Bearer {auth_token}"}
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Paiement 1 - Partiel
        log_info("Création paiement client #1 (partiel 1500 TND)...")
        payment1_data = {
            "invoice_id": test_data["invoices"][0]["id"],
            "customer_id": test_data["customers"][0]["id"],
            "amount": 1500.0,
            "date": "2025-01-20",
            "payment_method": "bank",
            "reference": "PAY-2025-001"
        }
        
        try:
            response = await client.post(
                f"{BASE_URL}/payments/",
                params={"company_id": company_id},
                json=payment1_data,
                headers=headers
            )
            if response.status_code in [200, 201]:
                payment = response.json()
                test_data["payments"].append(payment)
                log_success(f"Paiement créé: {payment1_data['reference']} - {payment1_data['amount']} TND")
            else:
                log_error(f"Erreur création paiement: {response.status_code} - {response.text}")
        except Exception as e:
            log_error(f"Exception création paiement: {str(e)}")
        
        # Paiement 2 - Complet
        log_info("Création paiement client #2 (complet 1844.5 TND)...")
        payment2_data = {
            "invoice_id": test_data["invoices"][1]["id"],
            "customer_id": test_data["customers"][1]["id"],
            "amount": 1844.5,
            "date": "2025-02-15",
            "payment_method": "bank",
            "reference": "PAY-2025-002"
        }
        
        try:
            response = await client.post(
                f"{BASE_URL}/payments/",
                params={"company_id": company_id},
                json=payment2_data,
                headers=headers
            )
            if response.status_code in [200, 201]:
                payment = response.json()
                test_data["payments"].append(payment)
                log_success(f"Paiement créé: {payment2_data['reference']} - {payment2_data['amount']} TND")
            else:
                log_error(f"Erreur création paiement: {response.status_code}")
        except Exception as e:
            log_error(f"Exception création paiement: {str(e)}")
        
        # Paiement 3 - Complet
        log_info("Création paiement client #3 (complet 1547.0 TND)...")
        payment3_data = {
            "invoice_id": test_data["invoices"][2]["id"],
            "customer_id": test_data["customers"][2]["id"],
            "amount": 1547.0,
            "date": "2025-03-10",
            "payment_method": "cash",
            "reference": "PAY-2025-003"
        }
        
        try:
            response = await client.post(
                f"{BASE_URL}/payments/",
                params={"company_id": company_id},
                json=payment3_data,
                headers=headers
            )
            if response.status_code in [200, 201]:
                payment = response.json()
                test_data["payments"].append(payment)
                log_success(f"Paiement créé: {payment3_data['reference']} - {payment3_data['amount']} TND")
            else:
                log_error(f"Erreur création paiement: {response.status_code}")
        except Exception as e:
            log_error(f"Exception création paiement: {str(e)}")
    
    log_info(f"Paiements clients créés: {len(test_data['payments'])}/3")
    return len(test_data['payments']) >= 3


async def create_supplier_invoices() -> bool:
    """Phase 4: Création de 2 factures fournisseurs (FOCUS)"""
    print_section("PHASE 4: CRÉATION DE 2 FACTURES FOURNISSEURS (FOCUS)")
    
    headers = {"Authorization": f"Bearer {auth_token}"}
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Facture fournisseur 1 - Février 2025
        log_info("Création facture fournisseur #1 (Février 2025)...")
        supplier_invoice1_data = {
            "supplier_id": test_data["suppliers"][0]["id"],
            "date": "2025-02-05",
            "due_date": "2025-03-05",
            "number": "FF-2025-001",
            "items": [
                {
                    "description": "Achat marchandises",
                    "quantity": 100,
                    "unit_price": 120.0,
                    "tax_rate": 19.0,
                    "total": 12000.0
                }
            ],
            "subtotal": 12000.0,
            "tax_amount": 2280.0,
            "total": 14280.0,
            "status": "draft"
        }
        
        try:
            response = await client.post(
                f"{BASE_URL}/supplier-invoices/",
                params={"company_id": company_id},
                json=supplier_invoice1_data,
                headers=headers
            )
            if response.status_code in [200, 201]:
                invoice = response.json()
                test_data["supplier_invoices"].append(invoice)
                log_success(f"Facture fournisseur créée: {supplier_invoice1_data['number']}")
                
                # Changer le statut à "validated" pour déclencher la sync comptable
                invoice_id = invoice["id"]
                await update_document_status(client, "supplier-invoices", invoice_id, "validated", supplier_invoice1_data['number'], company_id, headers)
            else:
                log_error(f"Erreur création facture fournisseur: {response.status_code} - {response.text}")
        except Exception as e:
            log_error(f"Exception création facture fournisseur: {str(e)}")
        
        # Facture fournisseur 2 - Mars 2025
        log_info("Création facture fournisseur #2 (Mars 2025)...")
        supplier_invoice2_data = {
            "supplier_id": test_data["suppliers"][1]["id"],
            "date": "2025-03-01",
            "due_date": "2025-04-01",
            "number": "FF-2025-002",
            "items": [
                {
                    "description": "Achat services",
                    "quantity": 1,
                    "unit_price": 250.0,
                    "tax_rate": 19.0,
                    "total": 250.0
                }
            ],
            "subtotal": 250.0,
            "tax_amount": 47.5,
            "total": 297.5,
            "status": "draft"
        }
        
        try:
            response = await client.post(
                f"{BASE_URL}/supplier-invoices/",
                params={"company_id": company_id},
                json=supplier_invoice2_data,
                headers=headers
            )
            if response.status_code in [200, 201]:
                invoice = response.json()
                test_data["supplier_invoices"].append(invoice)
                log_success(f"Facture fournisseur créée: {supplier_invoice2_data['number']}")
                
                # Changer le statut à "validated"
                invoice_id = invoice["id"]
                await update_document_status(client, "supplier-invoices", invoice_id, "validated", supplier_invoice2_data['number'], company_id, headers)
            else:
                log_error(f"Erreur création facture fournisseur: {response.status_code}")
        except Exception as e:
            log_error(f"Exception création facture fournisseur: {str(e)}")
    
    log_info(f"Factures fournisseurs créées: {len(test_data['supplier_invoices'])}/2")
    return len(test_data['supplier_invoices']) >= 2


async def create_supplier_payments() -> bool:
    """Phase 5: Création de 2 paiements fournisseurs"""
    print_section("PHASE 5: CRÉATION DE 2 PAIEMENTS FOURNISSEURS")
    
    headers = {"Authorization": f"Bearer {auth_token}"}
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Paiement fournisseur 1
        log_info("Création paiement fournisseur #1 (12971 TND)...")
        supplier_payment1_data = {
            "supplier_invoice_id": test_data["supplier_invoices"][0]["id"],
            "supplier_id": test_data["suppliers"][0]["id"],
            "amount": 12971.0,
            "date": "2025-02-20",
            "payment_method": "bank",
            "reference": "PAYF-2025-001"
        }
        
        try:
            response = await client.post(
                f"{BASE_URL}/supplier-payments/",
                params={"company_id": company_id},
                json=supplier_payment1_data,
                headers=headers
            )
            if response.status_code in [200, 201]:
                payment = response.json()
                test_data["supplier_payments"].append(payment)
                log_success(f"Paiement fournisseur créé: {supplier_payment1_data['reference']} - {supplier_payment1_data['amount']} TND")
            else:
                log_error(f"Erreur création paiement fournisseur: {response.status_code} - {response.text}")
        except Exception as e:
            log_error(f"Exception création paiement fournisseur: {str(e)}")
        
        # Paiement fournisseur 2
        log_info("Création paiement fournisseur #2 (297.5 TND)...")
        supplier_payment2_data = {
            "supplier_invoice_id": test_data["supplier_invoices"][1]["id"],
            "supplier_id": test_data["suppliers"][1]["id"],
            "amount": 297.5,
            "date": "2025-03-15",
            "payment_method": "bank",
            "reference": "PAYF-2025-002"
        }
        
        try:
            response = await client.post(
                f"{BASE_URL}/supplier-payments/",
                params={"company_id": company_id},
                json=supplier_payment2_data,
                headers=headers
            )
            if response.status_code in [200, 201]:
                payment = response.json()
                test_data["supplier_payments"].append(payment)
                log_success(f"Paiement fournisseur créé: {supplier_payment2_data['reference']} - {supplier_payment2_data['amount']} TND")
            else:
                log_error(f"Erreur création paiement fournisseur: {response.status_code}")
        except Exception as e:
            log_error(f"Exception création paiement fournisseur: {str(e)}")
    
    log_info(f"Paiements fournisseurs créés: {len(test_data['supplier_payments'])}/2")
    return len(test_data['supplier_payments']) >= 2


async def create_credit_note() -> bool:
    """Phase 6: Création d'un avoir client (FOCUS)"""
    print_section("PHASE 6: CRÉATION D'UN AVOIR CLIENT (FOCUS)")
    
    headers = {"Authorization": f"Bearer {auth_token}"}
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Avoir client 1 - Mars 2025
        log_info("Création avoir client #1 (Mars 2025)...")
        credit_note_data = {
            "invoice_id": test_data["invoices"][0]["id"],
            "customer_id": test_data["customers"][0]["id"],
            "date": "2025-03-20",
            "number": "AV-2025-001",
            "reason": "Retour marchandise défectueuse",
            "items": [
                {
                    "product_id": test_data["products"][0]["id"],
                    "product_name": test_data["products"][0]["name"],
                    "description": "Retour Produit A",
                    "quantity": 2,
                    "unit_price": 100.0,
                    "tax_rate": 19.0,
                    "total": 200.0
                }
            ],
            "subtotal": 200.0,
            "tax_amount": 38.0,
            "total": 238.0,
            "status": "draft"
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
                log_success(f"Avoir client créé: {credit_note_data['number']}")
                
                # Changer le statut à "validated" pour déclencher la sync comptable
                credit_note_id = credit_note["id"]
                await update_document_status(client, "credit-notes", credit_note_id, "validated", credit_note_data['number'], company_id, headers)
            else:
                log_error(f"Erreur création avoir: {response.status_code} - {response.text}")
        except Exception as e:
            log_error(f"Exception création avoir: {str(e)}")
    
    log_info(f"Avoirs clients créés: {len(test_data['credit_notes'])}/1")
    return len(test_data['credit_notes']) >= 1


async def verify_journal_entries() -> Dict:
    """Phase 7: Vérification des écritures comptables"""
    print_section("PHASE 7: VÉRIFICATION DES ÉCRITURES COMPTABLES")
    
    headers = {"Authorization": f"Bearer {auth_token}"}
    
    results = {
        "total_entries": 0,
        "entries_by_type": {},
        "success": False
    }
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.get(
                f"{BASE_URL}/journal-entries/",
                params={"company_id": company_id},
                headers=headers
            )
            
            if response.status_code == 200:
                entries = response.json()
                results["total_entries"] = len(entries)
                
                log_info(f"Nombre total d'écritures comptables: {len(entries)}")
                
                # Compter par type
                for entry in entries:
                    doc_type = entry.get("document_type", "unknown")
                    if doc_type not in results["entries_by_type"]:
                        results["entries_by_type"][doc_type] = 0
                    results["entries_by_type"][doc_type] += 1
                
                # Afficher le détail
                log_info("Répartition par type:")
                for doc_type, count in results["entries_by_type"].items():
                    log_info(f"  - {doc_type}: {count} écriture(s)")
                
                # Vérifier si on a bien 11 écritures
                expected_entries = 11  # 3 invoices + 3 payments + 2 supplier_invoices + 2 supplier_payments + 1 credit_note
                
                if results["total_entries"] == expected_entries:
                    log_success(f"✅ SUCCÈS: {results['total_entries']}/{expected_entries} écritures comptables créées!")
                    results["success"] = True
                else:
                    log_error(f"❌ ÉCHEC: {results['total_entries']}/{expected_entries} écritures comptables créées")
                    
                    # Détail des écritures manquantes
                    expected_types = {
                        "invoice": 3,
                        "payment": 3,
                        "supplier_invoice": 2,
                        "supplier_payment": 2,
                        "credit_note": 1
                    }
                    
                    log_warning("Écritures attendues vs réelles:")
                    for doc_type, expected_count in expected_types.items():
                        actual_count = results["entries_by_type"].get(doc_type, 0)
                        status = "✅" if actual_count == expected_count else "❌"
                        log_info(f"  {status} {doc_type}: {actual_count}/{expected_count}")
                
            else:
                log_error(f"Erreur récupération écritures: {response.status_code}")
        
        except Exception as e:
            log_error(f"Exception vérification écritures: {str(e)}")
    
    return results


async def generate_financial_report() -> bool:
    """Phase 8: Génération du rapport financier"""
    print_section("PHASE 8: GÉNÉRATION DU RAPPORT FINANCIER Q1 2025")
    
    headers = {"Authorization": f"Bearer {auth_token}"}
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            # Récupérer la balance comptable
            response = await client.get(
                f"{BASE_URL}/accounting/trial-balance",
                params={
                    "company_id": company_id,
                    "start_date": "2025-01-01",
                    "end_date": "2025-03-31"
                },
                headers=headers
            )
            
            if response.status_code == 200:
                trial_balance = response.json()
                
                # Générer le rapport
                report = []
                report.append("# RAPPORT FINANCIER Q1 2025 - VERSION FINALE")
                report.append("=" * 80)
                report.append("")
                report.append(f"**Entreprise:** EasyBill E2E Test Fixed")
                report.append(f"**Période:** 01/01/2025 - 31/03/2025")
                report.append(f"**Date de génération:** {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}")
                report.append("")
                report.append("## RÉSUMÉ DES OPÉRATIONS")
                report.append("")
                report.append(f"- **Factures clients:** {len(test_data['invoices'])}")
                report.append(f"- **Paiements clients:** {len(test_data['payments'])}")
                report.append(f"- **Factures fournisseurs:** {len(test_data['supplier_invoices'])}")
                report.append(f"- **Paiements fournisseurs:** {len(test_data['supplier_payments'])}")
                report.append(f"- **Avoirs clients:** {len(test_data['credit_notes'])}")
                report.append("")
                report.append("## BALANCE COMPTABLE Q1 2025")
                report.append("")
                
                accounts = trial_balance.get("accounts", [])
                total_debit = 0
                total_credit = 0
                
                if accounts:
                    report.append("| Compte | Nom | Débit | Crédit |")
                    report.append("|--------|-----|-------|--------|")
                    
                    for account in accounts:
                        code = account.get("account_code", "")
                        name = account.get("account_name", "")
                        debit = account.get("debit", 0)
                        credit = account.get("credit", 0)
                        total_debit += debit
                        total_credit += credit
                        
                        report.append(f"| {code} | {name} | {debit:.2f} | {credit:.2f} |")
                    
                    report.append("|--------|-----|-------|--------|")
                    report.append(f"| **TOTAL** | | **{total_debit:.2f}** | **{total_credit:.2f}** |")
                    report.append("")
                    
                    # Vérifier l'équilibre
                    if abs(total_debit - total_credit) < 0.01:
                        report.append("✅ **Balance équilibrée** (Débit = Crédit)")
                    else:
                        report.append(f"❌ **Balance déséquilibrée** (Différence: {abs(total_debit - total_credit):.2f} TND)")
                else:
                    report.append("⚠️ Aucune donnée comptable disponible")
                
                report.append("")
                report.append("## CONCLUSION")
                report.append("")
                report.append("Ce rapport présente l'état complet de la comptabilité pour le Q1 2025.")
                report.append("Toutes les opérations ont été synchronisées automatiquement avec le système comptable.")
                report.append("")
                report.append("---")
                report.append("*Généré automatiquement par EasyBill E2E Test*")
                
                # Sauvegarder le rapport
                report_content = "\n".join(report)
                with open("/app/rapport_financier_q1_2025_final.md", "w") as f:
                    f.write(report_content)
                
                log_success("Rapport financier généré: /app/rapport_financier_q1_2025_final.md")
                
                # Afficher le rapport
                print("\n" + report_content)
                
                return True
            else:
                log_error(f"Erreur récupération balance: {response.status_code}")
                return False
        
        except Exception as e:
            log_error(f"Exception génération rapport: {str(e)}")
            return False


async def main():
    """Exécution principale du test E2E"""
    print_section("TEST E2E Q1 2025 - VERSION FINALE AVEC LOGS")
    
    log_info("Objectif: Vérifier que 11/11 écritures comptables sont créées")
    log_info("Focus: Factures fournisseurs (x2) et Avoir client (x1)")
    log_info("")
    
    # Phase 0: Inscription et connexion
    if not await register_and_login():
        log_error("ÉCHEC: Impossible de se connecter")
        return
    
    # Phase 1: Création des données de test
    if not await create_test_data():
        log_error("ÉCHEC: Impossible de créer les données de test")
        return
    
    # Phase 2: Factures clients
    if not await create_customer_invoices():
        log_error("ÉCHEC: Impossible de créer les factures clients")
        return
    
    # Phase 3: Paiements clients
    if not await create_customer_payments():
        log_error("ÉCHEC: Impossible de créer les paiements clients")
        return
    
    # Phase 4: Factures fournisseurs (FOCUS)
    if not await create_supplier_invoices():
        log_error("ÉCHEC: Impossible de créer les factures fournisseurs")
        return
    
    # Phase 5: Paiements fournisseurs
    if not await create_supplier_payments():
        log_error("ÉCHEC: Impossible de créer les paiements fournisseurs")
        return
    
    # Phase 6: Avoir client (FOCUS)
    if not await create_credit_note():
        log_error("ÉCHEC: Impossible de créer l'avoir client")
        return
    
    # Attendre un peu pour que les écritures soient créées
    log_info("Attente de 3 secondes pour la synchronisation comptable...")
    await asyncio.sleep(3)
    
    # Phase 7: Vérification des écritures comptables
    results = await verify_journal_entries()
    
    # Phase 8: Génération du rapport financier
    await generate_financial_report()
    
    # Résumé final
    print_section("RÉSUMÉ FINAL")
    
    if results["success"]:
        log_success("✅ TEST E2E Q1 2025 RÉUSSI!")
        log_success(f"✅ 11/11 écritures comptables créées (100%)")
        log_success("✅ Factures fournisseurs: Synchronisation OK")
        log_success("✅ Avoir client: Synchronisation OK")
        log_success("✅ Rapport financier généré")
    else:
        log_error("❌ TEST E2E Q1 2025 ÉCHOUÉ")
        log_error(f"❌ {results['total_entries']}/11 écritures comptables créées")
        log_warning("Vérifier les logs backend pour plus de détails:")
        log_warning("  tail -f /var/log/supervisor/backend.*.log | grep SYNC")


if __name__ == "__main__":
    asyncio.run(main())
