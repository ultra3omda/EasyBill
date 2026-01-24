"""
Test suite for Journal Entries and Advanced Accounting Module
Tests CRUD operations for journal entries, posting, cancellation, dashboard, general ledger, and trial balance
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "comptable@test.com"
TEST_PASSWORD = "Test123!"
COMPANY_ID = "6974f559a9d10a5493c3241a"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    if response.status_code != 200:
        pytest.skip(f"Authentication failed: {response.text}")
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def api_client(auth_token):
    """Create authenticated session"""
    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    })
    return session


# ============== ACCOUNTING DASHBOARD TESTS ==============
class TestAccountingDashboard:
    """Tests for the accounting dashboard endpoint"""
    
    def test_get_dashboard(self, api_client):
        """Test getting accounting dashboard data"""
        response = api_client.get(
            f"{BASE_URL}/api/accounting/dashboard?company_id={COMPANY_ID}"
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify dashboard structure
        assert "classes" in data
        assert "by_type" in data
        assert "entries" in data
        assert "recent_entries" in data
        
    def test_dashboard_by_type_structure(self, api_client):
        """Test dashboard by_type has all account types"""
        response = api_client.get(
            f"{BASE_URL}/api/accounting/dashboard?company_id={COMPANY_ID}"
        )
        assert response.status_code == 200
        data = response.json()
        
        by_type = data["by_type"]
        expected_types = ["equity", "asset", "liability", "expense", "income"]
        for t in expected_types:
            assert t in by_type
            assert "balance" in by_type[t]
            assert "count" in by_type[t]
            
    def test_dashboard_entries_structure(self, api_client):
        """Test dashboard entries stats structure"""
        response = api_client.get(
            f"{BASE_URL}/api/accounting/dashboard?company_id={COMPANY_ID}"
        )
        assert response.status_code == 200
        data = response.json()
        
        entries = data["entries"]
        assert "total" in entries
        assert "total_debit" in entries
        assert "total_credit" in entries


# ============== JOURNAL ENTRIES CRUD TESTS ==============
class TestJournalEntriesList:
    """Tests for listing journal entries"""
    
    def test_list_entries(self, api_client):
        """Test listing all journal entries"""
        response = api_client.get(
            f"{BASE_URL}/api/journal-entries/?company_id={COMPANY_ID}"
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
    def test_list_entries_filter_by_status(self, api_client):
        """Test filtering entries by status"""
        for status in ["draft", "posted", "cancelled"]:
            response = api_client.get(
                f"{BASE_URL}/api/journal-entries/?company_id={COMPANY_ID}&status={status}"
            )
            assert response.status_code == 200
            data = response.json()
            # All returned entries should have the filtered status
            for entry in data:
                assert entry["status"] == status
                
    def test_list_entries_filter_by_journal_type(self, api_client):
        """Test filtering entries by journal type"""
        for journal_type in ["general", "sales", "purchases", "bank", "cash"]:
            response = api_client.get(
                f"{BASE_URL}/api/journal-entries/?company_id={COMPANY_ID}&journal_type={journal_type}"
            )
            assert response.status_code == 200
            
    def test_get_entry_stats(self, api_client):
        """Test getting journal entry statistics"""
        response = api_client.get(
            f"{BASE_URL}/api/journal-entries/stats?company_id={COMPANY_ID}"
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify stats structure
        assert "total_entries" in data
        assert "draft" in data
        assert "posted" in data
        assert "cancelled" in data
        assert "total_debit" in data
        assert "total_credit" in data


class TestJournalEntryCRUD:
    """Tests for Create, Read, Update, Delete operations on journal entries"""
    
    def test_create_journal_entry(self, api_client):
        """Test creating a new journal entry"""
        # Get valid account codes first
        accounts_response = api_client.get(
            f"{BASE_URL}/api/accounting/accounts?company_id={COMPANY_ID}"
        )
        accounts = accounts_response.json()
        
        # Find a liability account (class 4) and an expense account (class 6)
        liability_account = next((a for a in accounts if a["code"].startswith("4") and not a["is_group"]), None)
        expense_account = next((a for a in accounts if a["code"].startswith("6") and not a["is_group"]), None)
        
        if not liability_account or not expense_account:
            pytest.skip("Required accounts not found")
        
        entry_data = {
            "date": datetime.now().isoformat(),
            "reference": "TEST-REF-001",
            "description": "TEST Journal Entry for pytest",
            "journal_type": "general",
            "lines": [
                {
                    "account_code": expense_account["code"],
                    "debit": 1000.0,
                    "credit": 0,
                    "description": "Test debit line"
                },
                {
                    "account_code": liability_account["code"],
                    "debit": 0,
                    "credit": 1000.0,
                    "description": "Test credit line"
                }
            ]
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/journal-entries/?company_id={COMPANY_ID}",
            json=entry_data
        )
        assert response.status_code == 201
        data = response.json()
        assert "id" in data
        assert "entry_number" in data
        assert data["message"] == "Journal entry created"
        
        # Store for later tests
        TestJournalEntryCRUD.created_entry_id = data["id"]
        TestJournalEntryCRUD.created_entry_number = data["entry_number"]
        
    def test_get_created_entry(self, api_client):
        """Test retrieving the created journal entry"""
        entry_id = getattr(TestJournalEntryCRUD, 'created_entry_id', None)
        if not entry_id:
            pytest.skip("No entry created")
            
        response = api_client.get(
            f"{BASE_URL}/api/journal-entries/{entry_id}?company_id={COMPANY_ID}"
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify entry structure
        assert data["id"] == entry_id
        assert data["description"] == "TEST Journal Entry for pytest"
        assert data["reference"] == "TEST-REF-001"
        assert data["status"] == "draft"
        assert len(data["lines"]) == 2
        assert data["total_debit"] == 1000.0
        assert data["total_credit"] == 1000.0
        
    def test_update_draft_entry(self, api_client):
        """Test updating a draft journal entry"""
        entry_id = getattr(TestJournalEntryCRUD, 'created_entry_id', None)
        if not entry_id:
            pytest.skip("No entry created")
            
        response = api_client.put(
            f"{BASE_URL}/api/journal-entries/{entry_id}?company_id={COMPANY_ID}",
            json={
                "description": "TEST Journal Entry - Updated",
                "reference": "TEST-REF-002"
            }
        )
        assert response.status_code == 200
        assert response.json()["message"] == "Entry updated"
        
        # Verify update
        get_response = api_client.get(
            f"{BASE_URL}/api/journal-entries/{entry_id}?company_id={COMPANY_ID}"
        )
        assert get_response.status_code == 200
        data = get_response.json()
        assert data["description"] == "TEST Journal Entry - Updated"
        assert data["reference"] == "TEST-REF-002"


class TestJournalEntryValidation:
    """Tests for journal entry validation rules"""
    
    def test_unbalanced_entry_rejected(self, api_client):
        """Test that unbalanced entries are rejected"""
        # Get valid account codes
        accounts_response = api_client.get(
            f"{BASE_URL}/api/accounting/accounts?company_id={COMPANY_ID}"
        )
        accounts = accounts_response.json()
        account = next((a for a in accounts if not a["is_group"]), None)
        
        if not account:
            pytest.skip("No accounts found")
        
        entry_data = {
            "date": datetime.now().isoformat(),
            "description": "Unbalanced entry test",
            "journal_type": "general",
            "lines": [
                {
                    "account_code": account["code"],
                    "debit": 1000.0,
                    "credit": 0
                },
                {
                    "account_code": account["code"],
                    "debit": 0,
                    "credit": 500.0  # Unbalanced!
                }
            ]
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/journal-entries/?company_id={COMPANY_ID}",
            json=entry_data
        )
        assert response.status_code == 400
        assert "not balanced" in response.json()["detail"]
        
    def test_invalid_account_code_rejected(self, api_client):
        """Test that invalid account codes are rejected"""
        entry_data = {
            "date": datetime.now().isoformat(),
            "description": "Invalid account test",
            "journal_type": "general",
            "lines": [
                {
                    "account_code": "INVALID999",
                    "debit": 1000.0,
                    "credit": 0
                },
                {
                    "account_code": "INVALID888",
                    "debit": 0,
                    "credit": 1000.0
                }
            ]
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/journal-entries/?company_id={COMPANY_ID}",
            json=entry_data
        )
        assert response.status_code == 400
        assert "does not exist" in response.json()["detail"]


class TestJournalEntryPostAndCancel:
    """Tests for posting and cancelling journal entries"""
    
    def test_post_entry(self, api_client):
        """Test posting a journal entry"""
        # First create a new entry to post
        accounts_response = api_client.get(
            f"{BASE_URL}/api/accounting/accounts?company_id={COMPANY_ID}"
        )
        accounts = accounts_response.json()
        
        liability_account = next((a for a in accounts if a["code"].startswith("4") and not a["is_group"]), None)
        expense_account = next((a for a in accounts if a["code"].startswith("6") and not a["is_group"]), None)
        
        if not liability_account or not expense_account:
            pytest.skip("Required accounts not found")
        
        entry_data = {
            "date": datetime.now().isoformat(),
            "description": "TEST Entry to Post",
            "journal_type": "general",
            "lines": [
                {"account_code": expense_account["code"], "debit": 500.0, "credit": 0},
                {"account_code": liability_account["code"], "debit": 0, "credit": 500.0}
            ]
        }
        
        create_response = api_client.post(
            f"{BASE_URL}/api/journal-entries/?company_id={COMPANY_ID}",
            json=entry_data
        )
        assert create_response.status_code == 201
        entry_id = create_response.json()["id"]
        
        # Post the entry
        post_response = api_client.post(
            f"{BASE_URL}/api/journal-entries/{entry_id}/post?company_id={COMPANY_ID}"
        )
        assert post_response.status_code == 200
        assert post_response.json()["message"] == "Entry posted successfully"
        
        # Verify status changed
        get_response = api_client.get(
            f"{BASE_URL}/api/journal-entries/{entry_id}?company_id={COMPANY_ID}"
        )
        assert get_response.status_code == 200
        assert get_response.json()["status"] == "posted"
        
        # Store for cancel test
        TestJournalEntryPostAndCancel.posted_entry_id = entry_id
        
    def test_cannot_update_posted_entry(self, api_client):
        """Test that posted entries cannot be updated"""
        entry_id = getattr(TestJournalEntryPostAndCancel, 'posted_entry_id', None)
        if not entry_id:
            pytest.skip("No posted entry")
            
        response = api_client.put(
            f"{BASE_URL}/api/journal-entries/{entry_id}?company_id={COMPANY_ID}",
            json={"description": "Trying to update posted entry"}
        )
        assert response.status_code == 400
        assert "Cannot update a posted entry" in response.json()["detail"]
        
    def test_cannot_delete_posted_entry(self, api_client):
        """Test that posted entries cannot be deleted"""
        entry_id = getattr(TestJournalEntryPostAndCancel, 'posted_entry_id', None)
        if not entry_id:
            pytest.skip("No posted entry")
            
        response = api_client.delete(
            f"{BASE_URL}/api/journal-entries/{entry_id}?company_id={COMPANY_ID}"
        )
        assert response.status_code == 400
        assert "Only draft entries can be deleted" in response.json()["detail"]
        
    def test_cancel_posted_entry(self, api_client):
        """Test cancelling a posted entry"""
        entry_id = getattr(TestJournalEntryPostAndCancel, 'posted_entry_id', None)
        if not entry_id:
            pytest.skip("No posted entry")
            
        response = api_client.post(
            f"{BASE_URL}/api/journal-entries/{entry_id}/cancel?company_id={COMPANY_ID}"
        )
        assert response.status_code == 200
        assert response.json()["message"] == "Entry cancelled"
        
        # Verify status changed
        get_response = api_client.get(
            f"{BASE_URL}/api/journal-entries/{entry_id}?company_id={COMPANY_ID}"
        )
        assert get_response.status_code == 200
        assert get_response.json()["status"] == "cancelled"
        
    def test_cannot_post_cancelled_entry(self, api_client):
        """Test that cancelled entries cannot be posted"""
        entry_id = getattr(TestJournalEntryPostAndCancel, 'posted_entry_id', None)
        if not entry_id:
            pytest.skip("No cancelled entry")
            
        response = api_client.post(
            f"{BASE_URL}/api/journal-entries/{entry_id}/post?company_id={COMPANY_ID}"
        )
        assert response.status_code == 400
        assert "Cannot post a cancelled entry" in response.json()["detail"]


# ============== GENERAL LEDGER TESTS ==============
class TestGeneralLedger:
    """Tests for the general ledger endpoint"""
    
    def test_get_general_ledger(self, api_client):
        """Test getting general ledger data"""
        response = api_client.get(
            f"{BASE_URL}/api/accounting/general-ledger?company_id={COMPANY_ID}"
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
    def test_general_ledger_structure(self, api_client):
        """Test general ledger entry structure"""
        response = api_client.get(
            f"{BASE_URL}/api/accounting/general-ledger?company_id={COMPANY_ID}"
        )
        assert response.status_code == 200
        data = response.json()
        
        if len(data) > 0:
            entry = data[0]
            assert "account_code" in entry
            assert "account_name" in entry
            assert "transactions" in entry
            assert "total_debit" in entry
            assert "total_credit" in entry
            assert "balance" in entry
            
    def test_general_ledger_filter_by_account(self, api_client):
        """Test filtering general ledger by account code"""
        # Get an account code that has transactions
        ledger_response = api_client.get(
            f"{BASE_URL}/api/accounting/general-ledger?company_id={COMPANY_ID}"
        )
        ledger = ledger_response.json()
        
        if len(ledger) > 0:
            account_code = ledger[0]["account_code"]
            
            response = api_client.get(
                f"{BASE_URL}/api/accounting/general-ledger?company_id={COMPANY_ID}&account_code={account_code}"
            )
            assert response.status_code == 200
            data = response.json()
            
            # Should only return the filtered account
            for entry in data:
                assert entry["account_code"] == account_code
                
    def test_general_ledger_filter_by_date(self, api_client):
        """Test filtering general ledger by date range"""
        date_from = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        date_to = datetime.now().strftime("%Y-%m-%d")
        
        response = api_client.get(
            f"{BASE_URL}/api/accounting/general-ledger?company_id={COMPANY_ID}&date_from={date_from}&date_to={date_to}"
        )
        assert response.status_code == 200


# ============== TRIAL BALANCE TESTS ==============
class TestTrialBalance:
    """Tests for the trial balance endpoint"""
    
    def test_get_trial_balance(self, api_client):
        """Test getting trial balance data"""
        response = api_client.get(
            f"{BASE_URL}/api/accounting/trial-balance?company_id={COMPANY_ID}"
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "accounts" in data
        assert "totals" in data
        
    def test_trial_balance_totals_structure(self, api_client):
        """Test trial balance totals structure"""
        response = api_client.get(
            f"{BASE_URL}/api/accounting/trial-balance?company_id={COMPANY_ID}"
        )
        assert response.status_code == 200
        data = response.json()
        
        totals = data["totals"]
        assert "debit" in totals
        assert "credit" in totals
        assert "balanced" in totals
        
    def test_trial_balance_account_structure(self, api_client):
        """Test trial balance account entry structure"""
        response = api_client.get(
            f"{BASE_URL}/api/accounting/trial-balance?company_id={COMPANY_ID}"
        )
        assert response.status_code == 200
        data = response.json()
        
        if len(data["accounts"]) > 0:
            account = data["accounts"][0]
            assert "code" in account
            assert "name" in account
            assert "type" in account
            assert "debit" in account
            assert "credit" in account
            
    def test_trial_balance_filter_by_date(self, api_client):
        """Test filtering trial balance by date"""
        date_to = datetime.now().strftime("%Y-%m-%d")
        
        response = api_client.get(
            f"{BASE_URL}/api/accounting/trial-balance?company_id={COMPANY_ID}&date_to={date_to}"
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("date") == date_to


# ============== CLEANUP TESTS ==============
class TestCleanup:
    """Cleanup test data"""
    
    def test_delete_draft_entry(self, api_client):
        """Delete the draft entry created in tests"""
        entry_id = getattr(TestJournalEntryCRUD, 'created_entry_id', None)
        if not entry_id:
            pytest.skip("No entry to delete")
            
        response = api_client.delete(
            f"{BASE_URL}/api/journal-entries/{entry_id}?company_id={COMPANY_ID}"
        )
        # Entry might have been posted/cancelled, so accept 200 or 400
        assert response.status_code in [200, 400]


# ============== AUTHENTICATION TESTS ==============
class TestAuthentication:
    """Tests for authentication requirements"""
    
    def test_unauthorized_dashboard_access(self):
        """Test that unauthenticated requests to dashboard are rejected"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/dashboard?company_id={COMPANY_ID}"
        )
        assert response.status_code in [401, 403]
        
    def test_unauthorized_journal_entries_access(self):
        """Test that unauthenticated requests to journal entries are rejected"""
        response = requests.get(
            f"{BASE_URL}/api/journal-entries/?company_id={COMPANY_ID}"
        )
        assert response.status_code in [401, 403]
        
    def test_unauthorized_general_ledger_access(self):
        """Test that unauthenticated requests to general ledger are rejected"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/general-ledger?company_id={COMPANY_ID}"
        )
        assert response.status_code in [401, 403]
        
    def test_unauthorized_trial_balance_access(self):
        """Test that unauthenticated requests to trial balance are rejected"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/trial-balance?company_id={COMPANY_ID}"
        )
        assert response.status_code in [401, 403]
