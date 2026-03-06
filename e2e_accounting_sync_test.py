"""
E2E TEST - ACCOUNTING SYNCHRONIZATION
Focused test on accounting synchronization for key business operations
"""

import httpx
import asyncio
import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional

# Configuration
BASE_URL = "https://test-et-implement.preview.emergentagent.com/api"
TEST_EMAIL = f"test-accounting-{int(datetime.now().timestamp())}@easybill.com"
TEST_PASSWORD = "TestAccounting2025!"
COMPANY_NAME = "Test Accounting SARL"

# Global variables
auth_token = None
company_id = None
test_data = {}

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    END = '\033[0m'

def log(message: str, status: str = "INFO"):
    """Log messages with colors"""
    if status == "PASS":
        print(f"{Colors.GREEN}✅ {message}{Colors.END}")
    elif status == "FAIL":
        print(f"{Colors.RED}❌ {message}{Colors.END}")
    elif status == "WARN":
        print(f"{Colors.YELLOW}⚠️  {message}{Colors.END}")
    else:
        print(f"{Colors.CYAN}ℹ️  {message}{Colors.END}")

def print_section(title: str):
    print(f"\n{Colors.BLUE}{'='*80}\n{title}\n{'='*80}{Colors.END}\n")

async def setup():
    """Setup: Register, login, create test data"""
    global auth_token, company_id
    
    print_section("SETUP: Creating test environment")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Register
        response = await client.post(
            f"{BASE_URL}/auth/register",
            json={
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD,
                "full_name": "Test User",
                "company_name": COMPANY_NAME
            }
        )
        
        if response.status_code == 201:
            data = response.json()
            auth_token = data.get("access_token")
            log(f"Registration successful", "PASS")
        else:
            log(f"Registration failed: {response.status_code}", "FAIL")
            return False
        
        # Get company ID
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = await client.get(f"{BASE_URL}/companies/", headers=headers)
        
        if response.status_code == 200:
            companies = response.json()
            if companies:
                company_id = companies[0].get("id")
                log(f"Company ID: {company_id}", "PASS")
            else:
                log("No companies found", "FAIL")
                return False
        else:
            log(f"Failed to get company: {response.status_code}", "FAIL")
            return False
        
        # Create customer
        response = await client.post(
            f"{BASE_URL}/customers/",
            params={"company_id": company_id},
            json={
                "first_name": "Test",
                "last_name": "Customer",
                "company_name": "Test Customer SARL",
                "email": "customer@test.tn",
                "client_type": "entreprise"
            },
            headers=headers
        )
        
        if response.status_code == 201:
            test_data["customer_id"] = response.json().get("id")
            log(f"Customer created: {test_data['customer_id']}", "PASS")
        else:
            log(f"Failed to create customer: {response.status_code}", "FAIL")
            return False
        
        # Create supplier
        response = await client.post(
            f"{BASE_URL}/suppliers/",
            params={"company_id": company_id},
            json={
                "first_name": "Test",
                "last_name": "Supplier",
                "company_name": "Test Supplier SARL",
                "email": "supplier@test.tn",
                "supplier_type": "entreprise"
            },
            headers=headers
        )
        
        if response.status_code == 201:
            test_data["supplier_id"] = response.json().get("id")
            log(f"Supplier created: {test_data['supplier_id']}", "PASS")
        else:
            log(f"Failed to create supplier: {response.status_code}", "FAIL")
            return False
        
        # Create product
        response = await client.post(
            f"{BASE_URL}/products/",
            params={"company_id": company_id},
            json={
                "name": "Test Product",
                "sku": "TEST-001",
                "type": "product",
                "unit_price": 1000.0,
                "tax_rate": 19.0,
                "unit": "pièce",
                "stock_quantity": 100
            },
            headers=headers
        )
        
        if response.status_code == 201:
            test_data["product_id"] = response.json().get("id")
            log(f"Product created: {test_data['product_id']}", "PASS")
        else:
            log(f"Failed to create product: {response.status_code}", "FAIL")
            return False
    
    return True

async def get_journal_entries():
    """Get all journal entries"""
    headers = {"Authorization": f"Bearer {auth_token}"}
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(
            f"{BASE_URL}/journal-entries/",
            params={"company_id": company_id},
            headers=headers
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            log(f"Failed to get journal entries: {response.status_code}", "WARN")
            return []

async def test_invoice_accounting_sync():
    """Test 1: Invoice creation should create accounting entries"""
    print_section("TEST 1: Invoice Creation → Accounting Sync")
    
    headers = {"Authorization": f"Bearer {auth_token}"}
    
    # Get initial journal entries count
    initial_entries = await get_journal_entries()
    initial_count = len(initial_entries)
    log(f"Initial journal entries: {initial_count}")
    
    # Create invoice
    async with httpx.AsyncClient(timeout=30.0) as client:
        invoice_data = {
            "customer_id": test_data["customer_id"],
            "issue_date": datetime.now().isoformat(),
            "due_date": (datetime.now() + timedelta(days=30)).isoformat(),
            "items": [
                {
                    "product_id": test_data["product_id"],
                    "description": "Test Product",
                    "quantity": 2,
                    "unit_price": 1000.0,
                    "tax_rate": 19.0,
                    "discount": 0,
                    "total": 2000.0  # 2 * 1000
                }
            ]
        }
        
        response = await client.post(
            f"{BASE_URL}/invoices/",
            params={"company_id": company_id},
            json=invoice_data,
            headers=headers
        )
        
        if response.status_code == 201:
            result = response.json()
            test_data["invoice_id"] = result.get("id")
            log(f"Invoice created: {test_data['invoice_id']}", "PASS")
            
            # Wait a moment for async processing
            await asyncio.sleep(2)
            
            # Check journal entries
            new_entries = await get_journal_entries()
            new_count = len(new_entries)
            
            log(f"Journal entries after invoice: {new_count}")
            
            if new_count > initial_count:
                log(f"✓ Accounting entries created: {new_count - initial_count} new entries", "PASS")
                
                # Display new entries
                for entry in new_entries[initial_count:]:
                    account = entry.get("account_code", "N/A")
                    debit = entry.get("debit", 0)
                    credit = entry.get("credit", 0)
                    desc = entry.get("description", "")
                    log(f"  Account {account}: Debit={debit:.2f}, Credit={credit:.2f} - {desc}")
                
                # Verify expected accounts
                accounts = [e.get("account_code") for e in new_entries[initial_count:]]
                expected_accounts = ["411", "707", "4366"]  # Clients, Ventes, TVA collectée
                
                for acc in expected_accounts:
                    if acc in accounts:
                        log(f"  ✓ Account {acc} found", "PASS")
                    else:
                        log(f"  ✗ Account {acc} NOT found", "WARN")
                
                return True
            else:
                log("✗ No accounting entries created", "FAIL")
                return False
        else:
            log(f"Failed to create invoice: {response.status_code} - {response.text[:200]}", "FAIL")
            return False

async def test_payment_accounting_sync():
    """Test 2: Payment should create accounting entries"""
    print_section("TEST 2: Payment → Accounting Sync")
    
    if "invoice_id" not in test_data:
        log("Skipping: No invoice available", "WARN")
        return False
    
    headers = {"Authorization": f"Bearer {auth_token}"}
    
    # Get initial journal entries count
    initial_entries = await get_journal_entries()
    initial_count = len(initial_entries)
    log(f"Initial journal entries: {initial_count}")
    
    # Create payment
    async with httpx.AsyncClient(timeout=30.0) as client:
        payment_data = {
            "invoice_id": test_data["invoice_id"],
            "amount": 1000.0,  # Partial payment
            "payment_date": datetime.now().isoformat(),
            "payment_method": "bank_transfer",
            "reference": "TEST-PAYMENT-001"
        }
        
        response = await client.post(
            f"{BASE_URL}/payments/",
            params={"company_id": company_id},
            json=payment_data,
            headers=headers
        )
        
        if response.status_code == 201:
            result = response.json()
            test_data["payment_id"] = result.get("id")
            log(f"Payment created: {test_data['payment_id']}", "PASS")
            
            # Wait a moment for async processing
            await asyncio.sleep(2)
            
            # Check journal entries
            new_entries = await get_journal_entries()
            new_count = len(new_entries)
            
            log(f"Journal entries after payment: {new_count}")
            
            if new_count > initial_count:
                log(f"✓ Accounting entries created: {new_count - initial_count} new entries", "PASS")
                
                # Display new entries
                for entry in new_entries[initial_count:]:
                    account = entry.get("account_code", "N/A")
                    debit = entry.get("debit", 0)
                    credit = entry.get("credit", 0)
                    desc = entry.get("description", "")
                    log(f"  Account {account}: Debit={debit:.2f}, Credit={credit:.2f} - {desc}")
                
                # Verify expected accounts
                accounts = [e.get("account_code") for e in new_entries[initial_count:]]
                expected_accounts = ["532", "411"]  # Banque, Clients
                
                for acc in expected_accounts:
                    if acc in accounts:
                        log(f"  ✓ Account {acc} found", "PASS")
                    else:
                        log(f"  ✗ Account {acc} NOT found", "WARN")
                
                return True
            else:
                log("✗ No accounting entries created", "FAIL")
                return False
        else:
            log(f"Failed to create payment: {response.status_code} - {response.text[:200]}", "FAIL")
            return False

async def test_supplier_invoice_accounting_sync():
    """Test 3: Supplier invoice should create accounting entries"""
    print_section("TEST 3: Supplier Invoice → Accounting Sync")
    
    headers = {"Authorization": f"Bearer {auth_token}"}
    
    # Get initial journal entries count
    initial_entries = await get_journal_entries()
    initial_count = len(initial_entries)
    log(f"Initial journal entries: {initial_count}")
    
    # Create supplier invoice
    async with httpx.AsyncClient(timeout=30.0) as client:
        supplier_invoice_data = {
            "supplier_id": test_data["supplier_id"],
            "invoice_number": "SUPP-INV-001",
            "invoice_date": datetime.now().isoformat(),
            "due_date": (datetime.now() + timedelta(days=30)).isoformat(),
            "items": [
                {
                    "product_id": test_data["product_id"],
                    "description": "Test Product Purchase",
                    "quantity": 5,
                    "unit_price": 800.0,
                    "tax_rate": 19.0,
                    "discount": 0,
                    "total": 4000.0  # 5 * 800
                }
            ]
        }
        
        response = await client.post(
            f"{BASE_URL}/supplier-invoices/",
            params={"company_id": company_id},
            json=supplier_invoice_data,
            headers=headers
        )
        
        if response.status_code == 201:
            result = response.json()
            test_data["supplier_invoice_id"] = result.get("id")
            log(f"Supplier invoice created: {test_data['supplier_invoice_id']}", "PASS")
            
            # Wait a moment for async processing
            await asyncio.sleep(2)
            
            # Check journal entries
            new_entries = await get_journal_entries()
            new_count = len(new_entries)
            
            log(f"Journal entries after supplier invoice: {new_count}")
            
            if new_count > initial_count:
                log(f"✓ Accounting entries created: {new_count - initial_count} new entries", "PASS")
                
                # Display new entries
                for entry in new_entries[initial_count:]:
                    account = entry.get("account_code", "N/A")
                    debit = entry.get("debit", 0)
                    credit = entry.get("credit", 0)
                    desc = entry.get("description", "")
                    log(f"  Account {account}: Debit={debit:.2f}, Credit={credit:.2f} - {desc}")
                
                # Verify expected accounts
                accounts = [e.get("account_code") for e in new_entries[initial_count:]]
                expected_accounts = ["607", "4456", "401"]  # Achats, TVA déductible, Fournisseurs
                
                for acc in expected_accounts:
                    if acc in accounts:
                        log(f"  ✓ Account {acc} found", "PASS")
                    else:
                        log(f"  ✗ Account {acc} NOT found", "WARN")
                
                return True
            else:
                log("✗ No accounting entries created", "FAIL")
                return False
        else:
            log(f"Failed to create supplier invoice: {response.status_code} - {response.text[:200]}", "FAIL")
            return False

async def test_balance_verification():
    """Test 4: Verify accounting balance (Debit = Credit)"""
    print_section("TEST 4: Balance Verification (Debit = Credit)")
    
    entries = await get_journal_entries()
    
    if not entries:
        log("No journal entries found", "WARN")
        return False
    
    log(f"Total journal entries: {len(entries)}")
    
    # Calculate totals
    total_debit = sum(e.get("debit", 0) for e in entries)
    total_credit = sum(e.get("credit", 0) for e in entries)
    
    log(f"Total Debit: {total_debit:.2f} TND")
    log(f"Total Credit: {total_credit:.2f} TND")
    log(f"Difference: {abs(total_debit - total_credit):.2f} TND")
    
    # Allow small rounding errors (< 0.01)
    if abs(total_debit - total_credit) < 0.01:
        log("✓ Balance verified: Debit = Credit", "PASS")
        return True
    else:
        log(f"✗ Balance NOT verified: Debit ({total_debit:.2f}) ≠ Credit ({total_credit:.2f})", "FAIL")
        return False

async def print_summary():
    """Print final summary"""
    print_section("FINAL SUMMARY")
    
    entries = await get_journal_entries()
    
    log(f"Total journal entries created: {len(entries)}")
    
    # Group by account
    accounts = {}
    for entry in entries:
        account = entry.get("account_code", "Unknown")
        if account not in accounts:
            accounts[account] = {"debit": 0, "credit": 0, "count": 0}
        accounts[account]["debit"] += entry.get("debit", 0)
        accounts[account]["credit"] += entry.get("credit", 0)
        accounts[account]["count"] += 1
    
    print(f"\n{Colors.CYAN}ACCOUNTS SUMMARY:{Colors.END}")
    for account, data in sorted(accounts.items()):
        balance = data["debit"] - data["credit"]
        print(f"  Account {account}: Debit={data['debit']:.2f}, Credit={data['credit']:.2f}, Balance={balance:.2f} ({data['count']} entries)")

async def main():
    """Main test execution"""
    print(f"\n{Colors.BLUE}{'='*80}")
    print("E2E TEST - ACCOUNTING SYNCHRONIZATION")
    print("Testing automatic accounting entries for business operations")
    print(f"{'='*80}{Colors.END}\n")
    
    print(f"Base URL: {BASE_URL}")
    print(f"Test Email: {TEST_EMAIL}\n")
    
    # Setup
    if not await setup():
        log("Setup failed, cannot continue", "FAIL")
        return
    
    # Run tests
    results = []
    results.append(await test_invoice_accounting_sync())
    results.append(await test_payment_accounting_sync())
    results.append(await test_supplier_invoice_accounting_sync())
    results.append(await test_balance_verification())
    
    # Print summary
    await print_summary()
    
    # Final results
    print_section("TEST RESULTS")
    passed = sum(1 for r in results if r)
    total = len(results)
    
    log(f"Tests passed: {passed}/{total}")
    log(f"Success rate: {(passed/total*100):.1f}%")
    
    if passed == total:
        log("ALL TESTS PASSED ✓", "PASS")
    else:
        log(f"{total - passed} test(s) failed", "FAIL")

if __name__ == "__main__":
    asyncio.run(main())
