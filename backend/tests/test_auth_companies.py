"""
Backend API Tests for Iberis Invoice App
Tests: Authentication (register, login) and Companies CRUD
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test data
TEST_USER_EMAIL = f"test_user_{uuid.uuid4().hex[:8]}@test.com"
TEST_USER_PASSWORD = "testpass123"
TEST_USER_NAME = "Test User"
TEST_COMPANY_NAME = "Test Company"

# Existing test users from credentials
EXISTING_USER_WITH_COMPANY = {"email": "onboard_test@test.com", "password": "testpass123"}
EXISTING_USER_WITHOUT_COMPANY = {"email": "onboard_only@test.com", "password": "testpass123"}


class TestHealthCheck:
    """Basic connectivity tests"""
    
    def test_api_reachable(self):
        """Test that API is reachable"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "wrongpass"
        })
        # Should get 401 (unauthorized) not connection error
        assert response.status_code in [401, 200], f"API not reachable: {response.status_code}"
        print(f"✓ API is reachable at {BASE_URL}")


class TestAuthRegister:
    """Registration endpoint tests"""
    
    def test_register_new_user_with_company(self):
        """Test registering a new user with company name"""
        unique_email = f"test_reg_{uuid.uuid4().hex[:8]}@test.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "testpass123",
            "full_name": "New Test User",
            "company_name": "New Test Company"
        })
        
        assert response.status_code == 201, f"Registration failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "access_token" in data, "Missing access_token in response"
        assert "user" in data, "Missing user in response"
        assert data["user"]["email"] == unique_email
        assert data["user"]["full_name"] == "New Test User"
        print(f"✓ User registered successfully: {unique_email}")
        
        # Verify company was created
        token = data["access_token"]
        companies_response = requests.get(
            f"{BASE_URL}/api/companies/",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert companies_response.status_code == 200
        companies = companies_response.json()
        assert len(companies) > 0, "Company was not created during registration"
        assert any(c["name"] == "New Test Company" for c in companies)
        print(f"✓ Company created during registration")
    
    def test_register_new_user_without_company(self):
        """Test registering a new user without company name"""
        unique_email = f"test_noreg_{uuid.uuid4().hex[:8]}@test.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "testpass123",
            "full_name": "No Company User"
        })
        
        assert response.status_code == 201, f"Registration failed: {response.text}"
        data = response.json()
        
        assert "access_token" in data
        assert data["user"]["email"] == unique_email
        print(f"✓ User registered without company: {unique_email}")
    
    def test_register_duplicate_email(self):
        """Test that duplicate email registration fails"""
        # First registration
        unique_email = f"test_dup_{uuid.uuid4().hex[:8]}@test.com"
        requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "testpass123",
            "full_name": "First User"
        })
        
        # Second registration with same email
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "testpass123",
            "full_name": "Second User"
        })
        
        assert response.status_code == 400, f"Expected 400 for duplicate email, got {response.status_code}"
        print(f"✓ Duplicate email registration correctly rejected")


class TestAuthLogin:
    """Login endpoint tests"""
    
    def test_login_existing_user_with_company(self):
        """Test login with existing user who has a company"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=EXISTING_USER_WITH_COMPANY)
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == EXISTING_USER_WITH_COMPANY["email"]
        print(f"✓ Login successful for user with company")
    
    def test_login_existing_user_without_company(self):
        """Test login with existing user who has no company"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=EXISTING_USER_WITHOUT_COMPANY)
        
        # This might return 401 if user doesn't exist, or 200 if exists
        if response.status_code == 200:
            data = response.json()
            assert "access_token" in data
            print(f"✓ Login successful for user without company")
        elif response.status_code == 401:
            print(f"⚠ User without company doesn't exist yet (expected for fresh DB)")
        else:
            pytest.fail(f"Unexpected status code: {response.status_code}")
    
    def test_login_invalid_credentials(self):
        """Test login with wrong password"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": EXISTING_USER_WITH_COMPANY["email"],
            "password": "wrongpassword"
        })
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"✓ Invalid credentials correctly rejected")
    
    def test_login_nonexistent_user(self):
        """Test login with non-existent email"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "nonexistent@test.com",
            "password": "testpass123"
        })
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"✓ Non-existent user correctly rejected")


class TestAuthMe:
    """Get current user endpoint tests"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=EXISTING_USER_WITH_COMPANY)
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Could not get auth token")
    
    def test_get_me_authenticated(self, auth_token):
        """Test getting current user info"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200, f"Get me failed: {response.text}"
        data = response.json()
        
        assert "id" in data
        assert "email" in data
        assert data["email"] == EXISTING_USER_WITH_COMPANY["email"]
        print(f"✓ Get current user successful")
    
    def test_get_me_unauthenticated(self):
        """Test getting current user without token"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"✓ Unauthenticated request correctly rejected")


class TestCompaniesAPI:
    """Companies CRUD endpoint tests"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=EXISTING_USER_WITH_COMPANY)
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Could not get auth token")
    
    @pytest.fixture
    def new_user_token(self):
        """Create a new user and get token"""
        unique_email = f"test_company_{uuid.uuid4().hex[:8]}@test.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "testpass123",
            "full_name": "Company Test User"
        })
        if response.status_code == 201:
            return response.json()["access_token"]
        pytest.skip("Could not create new user")
    
    def test_list_companies(self, auth_token):
        """Test listing companies for authenticated user"""
        response = requests.get(
            f"{BASE_URL}/api/companies/",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200, f"List companies failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ List companies successful, found {len(data)} companies")
    
    def test_create_company(self, new_user_token):
        """Test creating a new company"""
        company_data = {
            "name": f"TEST_Company_{uuid.uuid4().hex[:8]}",
            "fiscal_id": "1234567A/B/C/000",
            "activity": "Informatique",
            "phone": "71559882",
            "website": "https://test.com",
            "address": {
                "street": "123 Test Street",
                "city": "Tunis",
                "postal_code": "2000",
                "country": "Tunisie"
            },
            "primary_currency": "TND",
            "fiscal_year": {
                "start_date": "2026-01-01",
                "end_date": "2026-12-31"
            }
        }
        
        response = requests.post(
            f"{BASE_URL}/api/companies/",
            headers={"Authorization": f"Bearer {new_user_token}"},
            json=company_data
        )
        
        assert response.status_code == 201, f"Create company failed: {response.text}"
        data = response.json()
        
        assert "id" in data, "Response should contain company id"
        assert data["name"] == company_data["name"]
        assert data["primary_currency"] == "TND"
        print(f"✓ Company created successfully: {data['name']}")
        
        # Verify company was persisted by listing
        list_response = requests.get(
            f"{BASE_URL}/api/companies/",
            headers={"Authorization": f"Bearer {new_user_token}"}
        )
        assert list_response.status_code == 200
        companies = list_response.json()
        assert any(c["name"] == company_data["name"] for c in companies)
        print(f"✓ Company persisted and retrievable")
    
    def test_create_company_unauthenticated(self):
        """Test creating company without authentication"""
        response = requests.post(
            f"{BASE_URL}/api/companies/",
            json={"name": "Unauthorized Company"}
        )
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"✓ Unauthenticated company creation correctly rejected")
    
    def test_get_company_by_id(self, auth_token):
        """Test getting a specific company by ID"""
        # First list companies to get an ID
        list_response = requests.get(
            f"{BASE_URL}/api/companies/",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        if list_response.status_code != 200 or len(list_response.json()) == 0:
            pytest.skip("No companies available to test")
        
        company_id = list_response.json()[0]["id"]
        
        response = requests.get(
            f"{BASE_URL}/api/companies/{company_id}/",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200, f"Get company failed: {response.text}"
        data = response.json()
        assert data["id"] == company_id
        print(f"✓ Get company by ID successful")


class TestOnboardingFlow:
    """Test the complete onboarding flow"""
    
    def test_full_registration_to_company_flow(self):
        """Test complete flow: register -> check no company -> create company -> verify"""
        unique_email = f"test_flow_{uuid.uuid4().hex[:8]}@test.com"
        
        # Step 1: Register without company
        reg_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "testpass123",
            "full_name": "Flow Test User"
        })
        
        assert reg_response.status_code == 201, f"Registration failed: {reg_response.text}"
        token = reg_response.json()["access_token"]
        print(f"✓ Step 1: User registered")
        
        # Step 2: Check companies (should be empty)
        companies_response = requests.get(
            f"{BASE_URL}/api/companies/",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert companies_response.status_code == 200
        companies = companies_response.json()
        initial_count = len(companies)
        print(f"✓ Step 2: Companies listed, count: {initial_count}")
        
        # Step 3: Create company via onboarding
        company_data = {
            "name": f"TEST_Onboarding_Company_{uuid.uuid4().hex[:8]}",
            "activity": "E-commerce",
            "address": {
                "street": "456 Onboarding St",
                "city": "Sfax",
                "postal_code": "3000",
                "country": "Tunisie"
            },
            "primary_currency": "TND",
            "fiscal_year": {
                "start_date": "2026-01-01",
                "end_date": "2026-12-31"
            }
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/companies/",
            headers={"Authorization": f"Bearer {token}"},
            json=company_data
        )
        
        assert create_response.status_code == 201, f"Company creation failed: {create_response.text}"
        created_company = create_response.json()
        print(f"✓ Step 3: Company created: {created_company['name']}")
        
        # Step 4: Verify company exists
        final_companies_response = requests.get(
            f"{BASE_URL}/api/companies/",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert final_companies_response.status_code == 200
        final_companies = final_companies_response.json()
        assert len(final_companies) > initial_count, "Company count should have increased"
        assert any(c["name"] == company_data["name"] for c in final_companies)
        print(f"✓ Step 4: Company verified in list")
        
        print(f"✓ Full onboarding flow completed successfully!")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
