"""
Test complet du module comptabilité EasyBill
Tests de toutes les routes comptables + exports Excel
"""

import httpx
import asyncio
import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional

# Configuration
BASE_URL = "https://test-et-implement.preview.emergentagent.com/api"
TEST_EMAIL = "testuser@easybill.com"
TEST_PASSWORD = "TestPass123!"
COMPANY_ID = "69774dbbdb057f6d21416ad8"

# Global variables
auth_token = None
test_results = {
    "passed": [],
    "failed": [],
    "warnings": []
}


class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    MAGENTA = '\033[95m'
    END = '\033[0m'


def log_test(test_name: str, status: str, message: str = ""):
    """Log test results with colors"""
    if status == "PASS":
        print(f"{Colors.GREEN}✅ {test_name}: PASS{Colors.END}")
        if message:
            print(f"   {message}")
        test_results["passed"].append(test_name)
    elif status == "FAIL":
        print(f"{Colors.RED}❌ {test_name}: FAIL{Colors.END}")
        if message:
            print(f"   {message}")
        test_results["failed"].append({"test": test_name, "error": message})
    elif status == "WARN":
        print(f"{Colors.YELLOW}⚠️  {test_name}: WARNING{Colors.END}")
        if message:
            print(f"   {message}")
        test_results["warnings"].append({"test": test_name, "message": message})


def print_section(title: str):
    """Print section header"""
    print(f"\n{Colors.CYAN}{'='*80}")
    print(f"{title}")
    print(f"{'='*80}{Colors.END}\n")


async def login() -> Optional[str]:
    """Login and get auth token"""
    print_section("🔐 AUTHENTICATION - LOGIN")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.post(
                f"{BASE_URL}/auth/login",
                json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
            )
            
            if response.status_code == 200:
                data = response.json()
                token = data.get("access_token")
                log_test("Login", "PASS", f"Token obtained successfully")
                return token
            else:
                log_test("Login", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
                return None
                
        except Exception as e:
            log_test("Login", "FAIL", f"Exception: {str(e)}")
            return None


async def test_chart_of_accounts():
    """Test A: Plan Comptable (Chart of Accounts)"""
    print_section("A. PLAN COMPTABLE (Chart of Accounts)")
    
    headers = {"Authorization": f"Bearer {auth_token}"}
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # 1. GET /api/accounting/accounts (liste des comptes)
        try:
            response = await client.get(
                f"{BASE_URL}/accounting/accounts",
                params={"company_id": COMPANY_ID},
                headers=headers
            )
            
            if response.status_code == 200:
                accounts = response.json()
                log_test("GET /accounting/accounts", "PASS", f"Found {len(accounts)} accounts")
                
                # Store first account for detail test
                if accounts:
                    account_id = accounts[0].get("id")
                    account_code = accounts[0].get("code")
                    
                    # 2. GET /api/accounting/accounts/{id} (détail compte)
                    try:
                        response = await client.get(
                            f"{BASE_URL}/accounting/accounts/{account_id}",
                            params={"company_id": COMPANY_ID},
                            headers=headers
                        )
                        
                        if response.status_code == 200:
                            account = response.json()
                            log_test("GET /accounting/accounts/{id}", "PASS", f"Account {account_code}: {account.get('name')}")
                        else:
                            log_test("GET /accounting/accounts/{id}", "FAIL", f"Status: {response.status_code}")
                    except Exception as e:
                        log_test("GET /accounting/accounts/{id}", "FAIL", f"Exception: {str(e)}")
            else:
                log_test("GET /accounting/accounts", "FAIL", f"Status: {response.status_code}, Response: {response.text[:200]}")
                
        except Exception as e:
            log_test("GET /accounting/accounts", "FAIL", f"Exception: {str(e)}")
        
        # 3. GET /api/accounting/account-types (types de comptes)
        try:
            response = await client.get(
                f"{BASE_URL}/accounting/account-types",
                headers=headers
            )
            
            if response.status_code == 200:
                types = response.json()
                log_test("GET /accounting/account-types", "PASS", f"Found {len(types)} account types")
            else:
                log_test("GET /accounting/account-types", "FAIL", f"Status: {response.status_code}")
                
        except Exception as e:
            log_test("GET /accounting/account-types", "FAIL", f"Exception: {str(e)}")
        
        # 4. POST /api/accounting/accounts (créer compte)
        try:
            test_account_code = f"9999{datetime.now().strftime('%H%M%S')}"
            response = await client.post(
                f"{BASE_URL}/accounting/accounts",
                params={"company_id": COMPANY_ID},
                headers=headers,
                json={
                    "code": test_account_code,
                    "name": "Compte Test Automatique",
                    "type": "expense",
                    "is_group": False,
                    "notes": "Créé par test automatique"
                }
            )
            
            if response.status_code == 201:
                data = response.json()
                created_account_id = data.get("id")
                log_test("POST /accounting/accounts", "PASS", f"Account created: {test_account_code}")
                
                # 5. PUT /api/accounting/accounts/{id} (modifier compte)
                try:
                    response = await client.put(
                        f"{BASE_URL}/accounting/accounts/{created_account_id}",
                        params={"company_id": COMPANY_ID},
                        headers=headers,
                        json={
                            "name": "Compte Test Modifié",
                            "notes": "Modifié par test automatique"
                        }
                    )
                    
                    if response.status_code == 200:
                        log_test("PUT /accounting/accounts/{id}", "PASS", "Account updated successfully")
                    else:
                        log_test("PUT /accounting/accounts/{id}", "FAIL", f"Status: {response.status_code}")
                except Exception as e:
                    log_test("PUT /accounting/accounts/{id}", "FAIL", f"Exception: {str(e)}")
                
                # 6. DELETE /api/accounting/accounts/{id} (supprimer compte)
                try:
                    response = await client.delete(
                        f"{BASE_URL}/accounting/accounts/{created_account_id}",
                        params={"company_id": COMPANY_ID},
                        headers=headers
                    )
                    
                    if response.status_code == 200:
                        log_test("DELETE /accounting/accounts/{id}", "PASS", "Account deleted successfully")
                    else:
                        log_test("DELETE /accounting/accounts/{id}", "FAIL", f"Status: {response.status_code}")
                except Exception as e:
                    log_test("DELETE /accounting/accounts/{id}", "FAIL", f"Exception: {str(e)}")
            else:
                log_test("POST /accounting/accounts", "FAIL", f"Status: {response.status_code}, Response: {response.text[:200]}")
                
        except Exception as e:
            log_test("POST /accounting/accounts", "FAIL", f"Exception: {str(e)}")


async def test_journal_entries():
    """Test B: Écritures Comptables (Journal Entries)"""
    print_section("B. ÉCRITURES COMPTABLES (Journal Entries)")
    
    headers = {"Authorization": f"Bearer {auth_token}"}
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # 1. GET /api/journal-entries/ (liste écritures)
        try:
            response = await client.get(
                f"{BASE_URL}/journal-entries/",
                params={"company_id": COMPANY_ID},
                headers=headers
            )
            
            if response.status_code == 200:
                entries = response.json()
                log_test("GET /journal-entries/", "PASS", f"Found {len(entries)} journal entries")
                
                # Store first entry for detail test
                if entries:
                    entry_id = entries[0].get("id")
                    
                    # 2. GET /api/journal-entries/{id} (détail écriture)
                    try:
                        response = await client.get(
                            f"{BASE_URL}/journal-entries/{entry_id}",
                            params={"company_id": COMPANY_ID},
                            headers=headers
                        )
                        
                        if response.status_code == 200:
                            entry = response.json()
                            log_test("GET /journal-entries/{id}", "PASS", f"Entry {entry.get('entry_number')}: {entry.get('description')}")
                        else:
                            log_test("GET /journal-entries/{id}", "FAIL", f"Status: {response.status_code}")
                    except Exception as e:
                        log_test("GET /journal-entries/{id}", "FAIL", f"Exception: {str(e)}")
            else:
                log_test("GET /journal-entries/", "FAIL", f"Status: {response.status_code}, Response: {response.text[:200]}")
                
        except Exception as e:
            log_test("GET /journal-entries/", "FAIL", f"Exception: {str(e)}")
        
        # 3. POST /api/journal-entries/ (créer écriture manuelle)
        try:
            response = await client.post(
                f"{BASE_URL}/journal-entries/",
                params={"company_id": COMPANY_ID},
                headers=headers,
                json={
                    "date": datetime.now().isoformat(),
                    "reference": f"TEST-{datetime.now().strftime('%Y%m%d%H%M%S')}",
                    "description": "Écriture de test automatique",
                    "journal_type": "general",
                    "lines": [
                        {
                            "account_code": "607",
                            "account_name": "Achats de marchandises",
                            "debit": 1000.0,
                            "credit": 0.0,
                            "description": "Test débit"
                        },
                        {
                            "account_code": "521",
                            "account_name": "Banques",
                            "debit": 0.0,
                            "credit": 1000.0,
                            "description": "Test crédit"
                        }
                    ]
                }
            )
            
            if response.status_code == 201:
                data = response.json()
                created_entry_id = data.get("id")
                log_test("POST /journal-entries/", "PASS", f"Entry created: {data.get('entry_number')}")
                
                # 4. PUT /api/journal-entries/{id} (modifier écriture)
                try:
                    response = await client.put(
                        f"{BASE_URL}/journal-entries/{created_entry_id}",
                        params={"company_id": COMPANY_ID},
                        headers=headers,
                        json={
                            "description": "Écriture de test modifiée",
                            "reference": f"TEST-MODIFIED-{datetime.now().strftime('%H%M%S')}"
                        }
                    )
                    
                    if response.status_code == 200:
                        log_test("PUT /journal-entries/{id}", "PASS", "Entry updated successfully")
                    else:
                        log_test("PUT /journal-entries/{id}", "FAIL", f"Status: {response.status_code}")
                except Exception as e:
                    log_test("PUT /journal-entries/{id}", "FAIL", f"Exception: {str(e)}")
                
                # 5. DELETE /api/journal-entries/{id} (supprimer écriture)
                try:
                    response = await client.delete(
                        f"{BASE_URL}/journal-entries/{created_entry_id}",
                        params={"company_id": COMPANY_ID},
                        headers=headers
                    )
                    
                    if response.status_code == 200:
                        log_test("DELETE /journal-entries/{id}", "PASS", "Entry deleted successfully")
                    else:
                        log_test("DELETE /journal-entries/{id}", "FAIL", f"Status: {response.status_code}")
                except Exception as e:
                    log_test("DELETE /journal-entries/{id}", "FAIL", f"Exception: {str(e)}")
            else:
                log_test("POST /journal-entries/", "FAIL", f"Status: {response.status_code}, Response: {response.text[:200]}")
                
        except Exception as e:
            log_test("POST /journal-entries/", "FAIL", f"Exception: {str(e)}")
        
        # 6. ✨ GET /api/journal-entries/export/excel (NOUVEAU - export Excel)
        try:
            response = await client.get(
                f"{BASE_URL}/journal-entries/export/excel",
                params={"company_id": COMPANY_ID},
                headers=headers
            )
            
            if response.status_code == 200:
                content_type = response.headers.get("content-type")
                content_disposition = response.headers.get("content-disposition")
                
                if "spreadsheet" in content_type and "attachment" in content_disposition:
                    log_test("GET /journal-entries/export/excel", "PASS", f"Excel file downloaded ({len(response.content)} bytes)")
                else:
                    log_test("GET /journal-entries/export/excel", "WARN", f"Response headers incorrect: {content_type}")
            else:
                log_test("GET /journal-entries/export/excel", "FAIL", f"Status: {response.status_code}")
                
        except Exception as e:
            log_test("GET /journal-entries/export/excel", "FAIL", f"Exception: {str(e)}")


async def test_general_ledger():
    """Test C: Grand Livre (General Ledger)"""
    print_section("C. GRAND LIVRE (General Ledger)")
    
    headers = {"Authorization": f"Bearer {auth_token}"}
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # 1. GET /api/accounting/general-ledger (transactions par compte)
        try:
            response = await client.get(
                f"{BASE_URL}/accounting/general-ledger",
                params={"company_id": COMPANY_ID},
                headers=headers
            )
            
            if response.status_code == 200:
                ledger = response.json()
                log_test("GET /accounting/general-ledger", "PASS", f"Found {len(ledger)} accounts with transactions")
                
                # Verify structure
                if ledger and len(ledger) > 0:
                    first_account = ledger[0]
                    if "account_code" in first_account and "transactions" in first_account:
                        log_test("General Ledger Structure", "PASS", f"Account {first_account['account_code']}: {len(first_account['transactions'])} transactions")
            else:
                log_test("GET /accounting/general-ledger", "FAIL", f"Status: {response.status_code}, Response: {response.text[:200]}")
                
        except Exception as e:
            log_test("GET /accounting/general-ledger", "FAIL", f"Exception: {str(e)}")
        
        # 2. ✨ GET /api/accounting/general-ledger/export/excel (NOUVEAU - export Excel)
        try:
            response = await client.get(
                f"{BASE_URL}/accounting/general-ledger/export/excel",
                params={"company_id": COMPANY_ID},
                headers=headers
            )
            
            if response.status_code == 200:
                content_type = response.headers.get("content-type")
                content_disposition = response.headers.get("content-disposition")
                
                if "spreadsheet" in content_type and "attachment" in content_disposition:
                    log_test("GET /accounting/general-ledger/export/excel", "PASS", f"Excel file downloaded ({len(response.content)} bytes)")
                else:
                    log_test("GET /accounting/general-ledger/export/excel", "WARN", f"Response headers incorrect: {content_type}")
            else:
                log_test("GET /accounting/general-ledger/export/excel", "FAIL", f"Status: {response.status_code}")
                
        except Exception as e:
            log_test("GET /accounting/general-ledger/export/excel", "FAIL", f"Exception: {str(e)}")


async def test_trial_balance():
    """Test D: Balance des Comptes (Trial Balance)"""
    print_section("D. BALANCE DES COMPTES (Trial Balance)")
    
    headers = {"Authorization": f"Bearer {auth_token}"}
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # 1. GET /api/accounting/trial-balance (balance générale)
        try:
            response = await client.get(
                f"{BASE_URL}/accounting/trial-balance",
                params={"company_id": COMPANY_ID},
                headers=headers
            )
            
            if response.status_code == 200:
                balance = response.json()
                accounts = balance.get("accounts", [])
                totals = balance.get("totals", {})
                
                total_debit = totals.get("debit", 0)
                total_credit = totals.get("credit", 0)
                is_balanced = totals.get("balanced", False)
                
                if is_balanced:
                    log_test("GET /accounting/trial-balance", "PASS", f"Balance équilibrée: {total_debit:.2f} TND (débit = crédit)")
                else:
                    log_test("GET /accounting/trial-balance", "WARN", f"Balance NON équilibrée: Débit {total_debit:.2f} ≠ Crédit {total_credit:.2f}")
                
                log_test("Trial Balance Accounts", "PASS", f"Found {len(accounts)} accounts with balances")
            else:
                log_test("GET /accounting/trial-balance", "FAIL", f"Status: {response.status_code}, Response: {response.text[:200]}")
                
        except Exception as e:
            log_test("GET /accounting/trial-balance", "FAIL", f"Exception: {str(e)}")
        
        # 2. ✨ GET /api/accounting/trial-balance/export/excel (NOUVEAU - export Excel)
        try:
            response = await client.get(
                f"{BASE_URL}/accounting/trial-balance/export/excel",
                params={"company_id": COMPANY_ID},
                headers=headers
            )
            
            if response.status_code == 200:
                content_type = response.headers.get("content-type")
                content_disposition = response.headers.get("content-disposition")
                
                if "spreadsheet" in content_type and "attachment" in content_disposition:
                    log_test("GET /accounting/trial-balance/export/excel", "PASS", f"Excel file downloaded ({len(response.content)} bytes)")
                else:
                    log_test("GET /accounting/trial-balance/export/excel", "WARN", f"Response headers incorrect: {content_type}")
            else:
                log_test("GET /accounting/trial-balance/export/excel", "FAIL", f"Status: {response.status_code}")
                
        except Exception as e:
            log_test("GET /accounting/trial-balance/export/excel", "FAIL", f"Exception: {str(e)}")


async def test_auxiliary_ledger():
    """Test E: Livre de Tiers (Auxiliary Ledger)"""
    print_section("E. LIVRE DE TIERS (Auxiliary Ledger)")
    
    headers = {"Authorization": f"Bearer {auth_token}"}
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # 1. ✨ GET /api/accounting/auxiliary-ledger/export/excel?ledger_type=customers (NOUVEAU)
        try:
            response = await client.get(
                f"{BASE_URL}/accounting/auxiliary-ledger/export/excel",
                params={"company_id": COMPANY_ID, "ledger_type": "customers"},
                headers=headers
            )
            
            if response.status_code == 200:
                content_type = response.headers.get("content-type")
                content_disposition = response.headers.get("content-disposition")
                
                if "spreadsheet" in content_type and "attachment" in content_disposition:
                    log_test("GET /auxiliary-ledger/export/excel?ledger_type=customers", "PASS", f"Excel file downloaded ({len(response.content)} bytes)")
                else:
                    log_test("GET /auxiliary-ledger/export/excel?ledger_type=customers", "WARN", f"Response headers incorrect: {content_type}")
            else:
                log_test("GET /auxiliary-ledger/export/excel?ledger_type=customers", "FAIL", f"Status: {response.status_code}")
                
        except Exception as e:
            log_test("GET /auxiliary-ledger/export/excel?ledger_type=customers", "FAIL", f"Exception: {str(e)}")
        
        # 2. ✨ GET /api/accounting/auxiliary-ledger/export/excel?ledger_type=suppliers (NOUVEAU)
        try:
            response = await client.get(
                f"{BASE_URL}/accounting/auxiliary-ledger/export/excel",
                params={"company_id": COMPANY_ID, "ledger_type": "suppliers"},
                headers=headers
            )
            
            if response.status_code == 200:
                content_type = response.headers.get("content-type")
                content_disposition = response.headers.get("content-disposition")
                
                if "spreadsheet" in content_type and "attachment" in content_disposition:
                    log_test("GET /auxiliary-ledger/export/excel?ledger_type=suppliers", "PASS", f"Excel file downloaded ({len(response.content)} bytes)")
                else:
                    log_test("GET /auxiliary-ledger/export/excel?ledger_type=suppliers", "WARN", f"Response headers incorrect: {content_type}")
            else:
                log_test("GET /auxiliary-ledger/export/excel?ledger_type=suppliers", "FAIL", f"Status: {response.status_code}")
                
        except Exception as e:
            log_test("GET /auxiliary-ledger/export/excel?ledger_type=suppliers", "FAIL", f"Exception: {str(e)}")


async def test_accounting_dashboard():
    """Test F: Dashboard Comptable"""
    print_section("F. DASHBOARD COMPTABLE")
    
    headers = {"Authorization": f"Bearer {auth_token}"}
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # GET /api/accounting/dashboard (métriques comptables)
        try:
            response = await client.get(
                f"{BASE_URL}/accounting/dashboard",
                params={"company_id": COMPANY_ID},
                headers=headers
            )
            
            if response.status_code == 200:
                dashboard = response.json()
                
                classes = dashboard.get("classes", [])
                by_type = dashboard.get("by_type", {})
                entries = dashboard.get("entries", {})
                recent_entries = dashboard.get("recent_entries", [])
                
                log_test("GET /accounting/dashboard", "PASS", f"Dashboard loaded successfully")
                log_test("Dashboard - Account Classes", "PASS", f"Found {len(classes)} account classes")
                log_test("Dashboard - Journal Entries", "PASS", f"Total entries: {entries.get('total', 0)}, Debit: {entries.get('total_debit', 0):.2f}, Credit: {entries.get('total_credit', 0):.2f}")
                log_test("Dashboard - Recent Entries", "PASS", f"Found {len(recent_entries)} recent entries")
            else:
                log_test("GET /accounting/dashboard", "FAIL", f"Status: {response.status_code}, Response: {response.text[:200]}")
                
        except Exception as e:
            log_test("GET /accounting/dashboard", "FAIL", f"Exception: {str(e)}")


async def test_accounting_sync():
    """Test G: Synchronisation Automatique"""
    print_section("G. SYNCHRONISATION COMPTABLE AUTOMATIQUE")
    
    headers = {"Authorization": f"Bearer {auth_token}"}
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Verify that journal entries exist from previous E2E tests
        try:
            response = await client.get(
                f"{BASE_URL}/journal-entries/",
                params={"company_id": COMPANY_ID},
                headers=headers
            )
            
            if response.status_code == 200:
                entries = response.json()
                
                # Count entries by document type
                invoice_entries = [e for e in entries if e.get("document_type") == "invoice"]
                payment_entries = [e for e in entries if e.get("document_type") == "payment"]
                supplier_invoice_entries = [e for e in entries if e.get("document_type") == "supplier_invoice"]
                supplier_payment_entries = [e for e in entries if e.get("document_type") == "supplier_payment"]
                credit_note_entries = [e for e in entries if e.get("document_type") == "credit_note"]
                
                log_test("Accounting Sync - Total Entries", "PASS", f"Found {len(entries)} total journal entries")
                
                if len(invoice_entries) > 0:
                    log_test("Accounting Sync - Customer Invoices", "PASS", f"{len(invoice_entries)} invoice entries created automatically")
                else:
                    log_test("Accounting Sync - Customer Invoices", "WARN", "No invoice entries found")
                
                if len(payment_entries) > 0:
                    log_test("Accounting Sync - Customer Payments", "PASS", f"{len(payment_entries)} payment entries created automatically")
                else:
                    log_test("Accounting Sync - Customer Payments", "WARN", "No payment entries found")
                
                if len(supplier_invoice_entries) > 0:
                    log_test("Accounting Sync - Supplier Invoices", "PASS", f"{len(supplier_invoice_entries)} supplier invoice entries created automatically")
                else:
                    log_test("Accounting Sync - Supplier Invoices", "WARN", "No supplier invoice entries found")
                
                if len(supplier_payment_entries) > 0:
                    log_test("Accounting Sync - Supplier Payments", "PASS", f"{len(supplier_payment_entries)} supplier payment entries created automatically")
                else:
                    log_test("Accounting Sync - Supplier Payments", "WARN", "No supplier payment entries found")
                
                if len(credit_note_entries) > 0:
                    log_test("Accounting Sync - Credit Notes", "PASS", f"{len(credit_note_entries)} credit note entries created automatically")
                else:
                    log_test("Accounting Sync - Credit Notes", "WARN", "No credit note entries found")
                
                # Verify all entries are balanced
                unbalanced = [e for e in entries if abs(e.get("total_debit", 0) - e.get("total_credit", 0)) > 0.01]
                if len(unbalanced) == 0:
                    log_test("Accounting Sync - Balance Verification", "PASS", "All journal entries are balanced (debit = credit)")
                else:
                    log_test("Accounting Sync - Balance Verification", "FAIL", f"{len(unbalanced)} unbalanced entries found")
            else:
                log_test("Accounting Sync Verification", "FAIL", f"Status: {response.status_code}")
                
        except Exception as e:
            log_test("Accounting Sync Verification", "FAIL", f"Exception: {str(e)}")


def print_summary():
    """Print test summary"""
    print_section("📊 TEST SUMMARY - MODULE COMPTABILITÉ")
    
    total_tests = len(test_results["passed"]) + len(test_results["failed"]) + len(test_results["warnings"])
    
    print(f"{Colors.GREEN}✅ PASSED: {len(test_results['passed'])}{Colors.END}")
    print(f"{Colors.RED}❌ FAILED: {len(test_results['failed'])}{Colors.END}")
    print(f"{Colors.YELLOW}⚠️  WARNINGS: {len(test_results['warnings'])}{Colors.END}")
    print(f"\n{Colors.BLUE}TOTAL TESTS: {total_tests}{Colors.END}")
    
    if test_results["failed"]:
        print(f"\n{Colors.RED}{'='*80}")
        print("FAILED TESTS:")
        print(f"{'='*80}{Colors.END}")
        for failure in test_results["failed"]:
            print(f"{Colors.RED}❌ {failure['test']}{Colors.END}")
            print(f"   Error: {failure['error'][:300]}")
            print()
    
    if test_results["warnings"]:
        print(f"\n{Colors.YELLOW}{'='*80}")
        print("WARNINGS:")
        print(f"{'='*80}{Colors.END}")
        for warning in test_results["warnings"]:
            print(f"{Colors.YELLOW}⚠️  {warning['test']}{Colors.END}")
            print(f"   {warning['message'][:300]}")
            print()
    
    # Calculate success rate
    if total_tests > 0:
        success_rate = (len(test_results["passed"]) / total_tests) * 100
        
        if success_rate >= 90:
            color = Colors.GREEN
        elif success_rate >= 70:
            color = Colors.YELLOW
        else:
            color = Colors.RED
        
        print(f"\n{color}{'='*80}")
        print(f"SUCCESS RATE: {success_rate:.1f}%")
        print(f"{'='*80}{Colors.END}\n")


async def main():
    """Main test execution"""
    global auth_token
    
    print(f"\n{Colors.MAGENTA}{'='*80}")
    print("🧪 TEST COMPLET MODULE COMPTABILITÉ EASYBILL")
    print("Testing all accounting routes + Excel exports")
    print(f"{'='*80}{Colors.END}\n")
    
    print(f"Base URL: {BASE_URL}")
    print(f"Test Email: {TEST_EMAIL}")
    print(f"Company ID: {COMPANY_ID}\n")
    
    # Login first
    auth_token = await login()
    
    if not auth_token:
        print(f"\n{Colors.RED}CRITICAL: Cannot proceed without authentication token{Colors.END}")
        return
    
    # Run all accounting tests
    await test_chart_of_accounts()
    await test_journal_entries()
    await test_general_ledger()
    await test_trial_balance()
    await test_auxiliary_ledger()
    await test_accounting_dashboard()
    await test_accounting_sync()
    
    # Print summary
    print_summary()


if __name__ == "__main__":
    asyncio.run(main())
