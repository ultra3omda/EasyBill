"""
Test suite for Accounting Module - Chart of Accounts (Plan Comptable Tunisien)
Tests CRUD operations for accounts, type filtering, search, and system account protection
"""
import pytest
import requests
import os

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


class TestAccountingHealth:
    """Basic connectivity and health tests"""
    
    def test_api_connectivity(self, api_client):
        """Test API is reachable"""
        response = api_client.get(f"{BASE_URL}/api/accounting/account-types")
        assert response.status_code == 200
        
    def test_account_types_endpoint(self, api_client):
        """Test account types returns 7 classes"""
        response = api_client.get(f"{BASE_URL}/api/accounting/account-types")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 7
        # Verify all types present
        types = [t["type"] for t in data]
        assert "equity" in types
        assert "asset" in types
        assert "liability" in types
        assert "expense" in types
        assert "income" in types


class TestListAccounts:
    """Tests for listing and filtering accounts"""
    
    def test_list_all_accounts(self, api_client):
        """Test listing all accounts returns 490 accounts"""
        response = api_client.get(
            f"{BASE_URL}/api/accounting/accounts?company_id={COMPANY_ID}"
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 490
        
    def test_filter_by_type_equity(self, api_client):
        """Test filtering by equity type"""
        response = api_client.get(
            f"{BASE_URL}/api/accounting/accounts?company_id={COMPANY_ID}&type=equity"
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 37
        assert all(a["type"] == "equity" for a in data)
        
    def test_filter_by_type_asset(self, api_client):
        """Test filtering by asset type"""
        response = api_client.get(
            f"{BASE_URL}/api/accounting/accounts?company_id={COMPANY_ID}&type=asset"
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 158
        assert all(a["type"] == "asset" for a in data)
        
    def test_filter_by_type_liability(self, api_client):
        """Test filtering by liability type"""
        response = api_client.get(
            f"{BASE_URL}/api/accounting/accounts?company_id={COMPANY_ID}&type=liability"
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 71
        assert all(a["type"] == "liability" for a in data)
        
    def test_filter_by_type_expense(self, api_client):
        """Test filtering by expense type"""
        response = api_client.get(
            f"{BASE_URL}/api/accounting/accounts?company_id={COMPANY_ID}&type=expense"
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 167
        assert all(a["type"] == "expense" for a in data)
        
    def test_filter_by_type_income(self, api_client):
        """Test filtering by income type"""
        response = api_client.get(
            f"{BASE_URL}/api/accounting/accounts?company_id={COMPANY_ID}&type=income"
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 57
        assert all(a["type"] == "income" for a in data)
        
    def test_search_by_code(self, api_client):
        """Test searching accounts by code"""
        response = api_client.get(
            f"{BASE_URL}/api/accounting/accounts?company_id={COMPANY_ID}&search=101"
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) > 0
        assert any("101" in a["code"] for a in data)
        
    def test_search_by_name(self, api_client):
        """Test searching accounts by name"""
        response = api_client.get(
            f"{BASE_URL}/api/accounting/accounts?company_id={COMPANY_ID}&search=capital"
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) > 0
        assert any("capital" in a["name"].lower() for a in data)


class TestAccountCRUD:
    """Tests for Create, Read, Update, Delete operations"""
    
    def test_create_custom_account(self, api_client):
        """Test creating a custom account"""
        response = api_client.post(
            f"{BASE_URL}/api/accounting/accounts?company_id={COMPANY_ID}",
            json={
                "code": "TEST001",
                "name": "TEST Custom Account",
                "type": "asset",
                "parent_code": "41",
                "is_group": False,
                "notes": "Test account for pytest"
            }
        )
        assert response.status_code == 201
        data = response.json()
        assert "id" in data
        assert data["message"] == "Account created"
        
        # Store ID for cleanup
        TestAccountCRUD.created_account_id = data["id"]
        
    def test_get_created_account(self, api_client):
        """Test retrieving the created account"""
        account_id = getattr(TestAccountCRUD, 'created_account_id', None)
        if not account_id:
            pytest.skip("No account created")
            
        response = api_client.get(
            f"{BASE_URL}/api/accounting/accounts/{account_id}?company_id={COMPANY_ID}"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["code"] == "TEST001"
        assert data["name"] == "TEST Custom Account"
        assert data["type"] == "asset"
        assert data["is_system"] == False
        assert data["notes"] == "Test account for pytest"
        
    def test_update_custom_account(self, api_client):
        """Test updating a custom account"""
        account_id = getattr(TestAccountCRUD, 'created_account_id', None)
        if not account_id:
            pytest.skip("No account created")
            
        response = api_client.put(
            f"{BASE_URL}/api/accounting/accounts/{account_id}?company_id={COMPANY_ID}",
            json={
                "name": "TEST Custom Account - Updated",
                "notes": "Updated notes"
            }
        )
        assert response.status_code == 200
        assert response.json()["message"] == "Account updated"
        
        # Verify update
        get_response = api_client.get(
            f"{BASE_URL}/api/accounting/accounts/{account_id}?company_id={COMPANY_ID}"
        )
        assert get_response.status_code == 200
        data = get_response.json()
        assert data["name"] == "TEST Custom Account - Updated"
        assert data["notes"] == "Updated notes"
        
    def test_delete_custom_account(self, api_client):
        """Test deleting a custom account"""
        account_id = getattr(TestAccountCRUD, 'created_account_id', None)
        if not account_id:
            pytest.skip("No account created")
            
        response = api_client.delete(
            f"{BASE_URL}/api/accounting/accounts/{account_id}?company_id={COMPANY_ID}"
        )
        assert response.status_code == 200
        assert response.json()["message"] == "Account deleted"
        
        # Verify deletion
        get_response = api_client.get(
            f"{BASE_URL}/api/accounting/accounts/{account_id}?company_id={COMPANY_ID}"
        )
        assert get_response.status_code == 404


class TestSystemAccountProtection:
    """Tests for system account protection rules"""
    
    def test_cannot_delete_system_account(self, api_client):
        """Test that system accounts cannot be deleted"""
        # Get a system account
        response = api_client.get(
            f"{BASE_URL}/api/accounting/accounts?company_id={COMPANY_ID}&search=101"
        )
        assert response.status_code == 200
        data = response.json()
        system_account = next((a for a in data if a["code"] == "101" and a["is_system"]), None)
        assert system_account is not None
        
        # Try to delete
        delete_response = api_client.delete(
            f"{BASE_URL}/api/accounting/accounts/{system_account['id']}?company_id={COMPANY_ID}"
        )
        assert delete_response.status_code == 400
        assert "Cannot delete system account" in delete_response.json()["detail"]
        
    def test_can_update_system_account_notes(self, api_client):
        """Test that system account notes can be updated"""
        # Get a system account
        response = api_client.get(
            f"{BASE_URL}/api/accounting/accounts?company_id={COMPANY_ID}&search=101"
        )
        assert response.status_code == 200
        data = response.json()
        system_account = next((a for a in data if a["code"] == "101" and a["is_system"]), None)
        assert system_account is not None
        
        # Update notes
        update_response = api_client.put(
            f"{BASE_URL}/api/accounting/accounts/{system_account['id']}?company_id={COMPANY_ID}",
            json={"notes": "Pytest test notes"}
        )
        assert update_response.status_code == 200


class TestValidation:
    """Tests for input validation"""
    
    def test_duplicate_code_rejected(self, api_client):
        """Test that duplicate account codes are rejected"""
        response = api_client.post(
            f"{BASE_URL}/api/accounting/accounts?company_id={COMPANY_ID}",
            json={
                "code": "101",  # Already exists
                "name": "Duplicate Test",
                "type": "equity"
            }
        )
        assert response.status_code == 400
        assert "already exists" in response.json()["detail"]
        
    def test_get_nonexistent_account(self, api_client):
        """Test getting a non-existent account returns 404"""
        response = api_client.get(
            f"{BASE_URL}/api/accounting/accounts/000000000000000000000000?company_id={COMPANY_ID}"
        )
        assert response.status_code == 404
        
    def test_unauthorized_access(self):
        """Test that unauthenticated requests are rejected"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/accounts?company_id={COMPANY_ID}"
        )
        # API returns 403 Forbidden for unauthenticated requests
        assert response.status_code in [401, 403]


class TestAccountStructure:
    """Tests for account data structure"""
    
    def test_account_has_required_fields(self, api_client):
        """Test that accounts have all required fields"""
        response = api_client.get(
            f"{BASE_URL}/api/accounting/accounts?company_id={COMPANY_ID}"
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) > 0
        
        account = data[0]
        required_fields = ["id", "company_id", "code", "name", "type", "is_group", "is_system", "is_active", "balance", "level"]
        for field in required_fields:
            assert field in account, f"Missing field: {field}"
            
    def test_hierarchical_structure(self, api_client):
        """Test that accounts have proper parent-child relationships"""
        response = api_client.get(
            f"{BASE_URL}/api/accounting/accounts?company_id={COMPANY_ID}"
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check that child accounts have valid parent codes
        account_codes = {a["code"] for a in data}
        for account in data:
            if account.get("parent_code"):
                assert account["parent_code"] in account_codes, f"Invalid parent_code: {account['parent_code']} for account {account['code']}"
