"""
Backend API Tests for EasyBill Invoice Module
Tests: Invoices CRUD, Send, Mark Paid, Customer/Product dependencies
"""
import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from previous iteration
EXISTING_USER = {"email": "onboard_test@test.com", "password": "testpass123"}


class TestInvoicesSetup:
    """Setup tests - verify prerequisites"""
    
    @pytest.fixture(scope="class")
    def auth_data(self):
        """Get auth token and company_id"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=EXISTING_USER)
        if response.status_code != 200:
            pytest.skip(f"Could not login: {response.text}")
        
        token = response.json()["access_token"]
        
        # Get company
        companies_response = requests.get(
            f"{BASE_URL}/api/companies/",
            headers={"Authorization": f"Bearer {token}"}
        )
        if companies_response.status_code != 200 or len(companies_response.json()) == 0:
            pytest.skip("No companies available")
        
        company_id = companies_response.json()[0]["id"]
        return {"token": token, "company_id": company_id}
    
    def test_api_reachable(self):
        """Test API connectivity"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        print(f"✓ API reachable at {BASE_URL}")
    
    def test_login_and_get_company(self, auth_data):
        """Verify login and company access"""
        assert auth_data["token"] is not None
        assert auth_data["company_id"] is not None
        print(f"✓ Logged in with company_id: {auth_data['company_id']}")


class TestCustomersAPI:
    """Customer API tests - required for invoice creation"""
    
    @pytest.fixture(scope="class")
    def auth_data(self):
        """Get auth token and company_id"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=EXISTING_USER)
        if response.status_code != 200:
            pytest.skip(f"Could not login: {response.text}")
        
        token = response.json()["access_token"]
        companies_response = requests.get(
            f"{BASE_URL}/api/companies/",
            headers={"Authorization": f"Bearer {token}"}
        )
        if companies_response.status_code != 200 or len(companies_response.json()) == 0:
            pytest.skip("No companies available")
        
        company_id = companies_response.json()[0]["id"]
        return {"token": token, "company_id": company_id}
    
    def test_create_customer(self, auth_data):
        """Test creating a customer for invoice testing"""
        customer_data = {
            "first_name": "TEST_Invoice",
            "last_name": "Customer",
            "email": f"test_invoice_customer_{uuid.uuid4().hex[:8]}@test.com",
            "phone": "71234567"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/customers?company_id={auth_data['company_id']}",
            headers={"Authorization": f"Bearer {auth_data['token']}"},
            json=customer_data
        )
        
        assert response.status_code == 201, f"Create customer failed: {response.text}"
        data = response.json()
        assert "id" in data
        print(f"✓ Customer created: {data['id']}")
    
    def test_list_customers(self, auth_data):
        """Test listing customers"""
        response = requests.get(
            f"{BASE_URL}/api/customers?company_id={auth_data['company_id']}",
            headers={"Authorization": f"Bearer {auth_data['token']}"}
        )
        
        assert response.status_code == 200, f"List customers failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Listed {len(data)} customers")


class TestProductsAPI:
    """Product API tests - helpful for invoice line items"""
    
    @pytest.fixture(scope="class")
    def auth_data(self):
        """Get auth token and company_id"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=EXISTING_USER)
        if response.status_code != 200:
            pytest.skip(f"Could not login: {response.text}")
        
        token = response.json()["access_token"]
        companies_response = requests.get(
            f"{BASE_URL}/api/companies/",
            headers={"Authorization": f"Bearer {token}"}
        )
        if companies_response.status_code != 200 or len(companies_response.json()) == 0:
            pytest.skip("No companies available")
        
        company_id = companies_response.json()[0]["id"]
        return {"token": token, "company_id": company_id}
    
    def test_create_product(self, auth_data):
        """Test creating a product for invoice testing"""
        product_data = {
            "name": f"TEST_Product_{uuid.uuid4().hex[:8]}",
            "sku": f"SKU-{uuid.uuid4().hex[:6]}",
            "selling_price": 100.00,
            "tax_rate": 19,
            "type": "product"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/products?company_id={auth_data['company_id']}",
            headers={"Authorization": f"Bearer {auth_data['token']}"},
            json=product_data
        )
        
        assert response.status_code == 201, f"Create product failed: {response.text}"
        data = response.json()
        assert "id" in data
        print(f"✓ Product created: {data['id']}")
    
    def test_list_products(self, auth_data):
        """Test listing products"""
        response = requests.get(
            f"{BASE_URL}/api/products?company_id={auth_data['company_id']}",
            headers={"Authorization": f"Bearer {auth_data['token']}"}
        )
        
        assert response.status_code == 200, f"List products failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Listed {len(data)} products")


class TestInvoicesCRUD:
    """Invoice CRUD operations tests"""
    
    @pytest.fixture(scope="class")
    def auth_data(self):
        """Get auth token and company_id"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=EXISTING_USER)
        if response.status_code != 200:
            pytest.skip(f"Could not login: {response.text}")
        
        token = response.json()["access_token"]
        companies_response = requests.get(
            f"{BASE_URL}/api/companies/",
            headers={"Authorization": f"Bearer {token}"}
        )
        if companies_response.status_code != 200 or len(companies_response.json()) == 0:
            pytest.skip("No companies available")
        
        company_id = companies_response.json()[0]["id"]
        return {"token": token, "company_id": company_id}
    
    @pytest.fixture(scope="class")
    def test_customer_id(self, auth_data):
        """Create or get a test customer for invoice tests"""
        # First try to list existing customers
        response = requests.get(
            f"{BASE_URL}/api/customers?company_id={auth_data['company_id']}",
            headers={"Authorization": f"Bearer {auth_data['token']}"}
        )
        
        if response.status_code == 200 and len(response.json()) > 0:
            return response.json()[0]["id"]
        
        # Create a new customer if none exist
        customer_data = {
            "first_name": "TEST_Invoice",
            "last_name": "TestCustomer",
            "email": f"test_inv_{uuid.uuid4().hex[:8]}@test.com"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/customers?company_id={auth_data['company_id']}",
            headers={"Authorization": f"Bearer {auth_data['token']}"},
            json=customer_data
        )
        
        if create_response.status_code == 201:
            return create_response.json()["id"]
        
        pytest.skip("Could not create or find a customer for testing")
    
    def test_create_invoice(self, auth_data, test_customer_id):
        """Test creating a new invoice"""
        invoice_data = {
            "customer_id": test_customer_id,
            "date": datetime.now().isoformat(),
            "due_date": (datetime.now() + timedelta(days=30)).isoformat(),
            "subject": "TEST_Invoice Subject",
            "items": [
                {
                    "description": "Test Service",
                    "quantity": 2,
                    "unit_price": 100.00,
                    "tax_rate": 19,
                    "discount": 0,
                    "total": 238.00
                }
            ],
            "notes": "Test invoice notes"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/invoices?company_id={auth_data['company_id']}",
            headers={"Authorization": f"Bearer {auth_data['token']}"},
            json=invoice_data
        )
        
        assert response.status_code == 201, f"Create invoice failed: {response.text}"
        data = response.json()
        
        assert "id" in data, "Response should contain invoice id"
        assert "number" in data, "Response should contain invoice number"
        print(f"✓ Invoice created: {data['number']} (ID: {data['id']})")
        
        # Store for later tests
        auth_data["created_invoice_id"] = data["id"]
        auth_data["created_invoice_number"] = data["number"]
    
    def test_list_invoices(self, auth_data):
        """Test listing invoices"""
        response = requests.get(
            f"{BASE_URL}/api/invoices?company_id={auth_data['company_id']}",
            headers={"Authorization": f"Bearer {auth_data['token']}"}
        )
        
        assert response.status_code == 200, f"List invoices failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ Listed {len(data)} invoices")
        
        # Verify invoice structure
        if len(data) > 0:
            invoice = data[0]
            assert "id" in invoice, "Invoice should have id"
            assert "number" in invoice, "Invoice should have number"
            assert "customer_name" in invoice, "Invoice should have customer_name"
            assert "total" in invoice, "Invoice should have total"
            assert "status" in invoice, "Invoice should have status"
            print(f"✓ Invoice structure validated")
    
    def test_get_invoice_by_id(self, auth_data, test_customer_id):
        """Test getting a specific invoice"""
        # First create an invoice to get
        invoice_data = {
            "customer_id": test_customer_id,
            "date": datetime.now().isoformat(),
            "due_date": (datetime.now() + timedelta(days=30)).isoformat(),
            "subject": "TEST_Get Invoice",
            "items": [{"description": "Item", "quantity": 1, "unit_price": 50, "tax_rate": 19, "discount": 0, "total": 59.5}]
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/invoices?company_id={auth_data['company_id']}",
            headers={"Authorization": f"Bearer {auth_data['token']}"},
            json=invoice_data
        )
        
        assert create_response.status_code == 201
        invoice_id = create_response.json()["id"]
        
        # Now get the invoice
        response = requests.get(
            f"{BASE_URL}/api/invoices/{invoice_id}?company_id={auth_data['company_id']}",
            headers={"Authorization": f"Bearer {auth_data['token']}"}
        )
        
        assert response.status_code == 200, f"Get invoice failed: {response.text}"
        data = response.json()
        
        assert data["id"] == invoice_id
        assert data["subject"] == "TEST_Get Invoice"
        print(f"✓ Got invoice by ID: {invoice_id}")
    
    def test_update_invoice(self, auth_data, test_customer_id):
        """Test updating an invoice"""
        # Create invoice first
        invoice_data = {
            "customer_id": test_customer_id,
            "date": datetime.now().isoformat(),
            "due_date": (datetime.now() + timedelta(days=30)).isoformat(),
            "subject": "TEST_Original Subject",
            "items": [{"description": "Original Item", "quantity": 1, "unit_price": 100, "tax_rate": 19, "discount": 0, "total": 119}]
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/invoices?company_id={auth_data['company_id']}",
            headers={"Authorization": f"Bearer {auth_data['token']}"},
            json=invoice_data
        )
        
        assert create_response.status_code == 201
        invoice_id = create_response.json()["id"]
        
        # Update the invoice
        update_data = {
            "subject": "TEST_Updated Subject",
            "notes": "Updated notes"
        }
        
        update_response = requests.put(
            f"{BASE_URL}/api/invoices/{invoice_id}?company_id={auth_data['company_id']}",
            headers={"Authorization": f"Bearer {auth_data['token']}"},
            json=update_data
        )
        
        assert update_response.status_code == 200, f"Update invoice failed: {update_response.text}"
        print(f"✓ Invoice updated: {invoice_id}")
        
        # Verify update persisted
        get_response = requests.get(
            f"{BASE_URL}/api/invoices/{invoice_id}?company_id={auth_data['company_id']}",
            headers={"Authorization": f"Bearer {auth_data['token']}"}
        )
        
        assert get_response.status_code == 200
        updated_invoice = get_response.json()
        assert updated_invoice["subject"] == "TEST_Updated Subject"
        assert updated_invoice["notes"] == "Updated notes"
        print(f"✓ Update verified via GET")
    
    def test_delete_invoice(self, auth_data, test_customer_id):
        """Test deleting an invoice"""
        # Create invoice first
        invoice_data = {
            "customer_id": test_customer_id,
            "date": datetime.now().isoformat(),
            "due_date": (datetime.now() + timedelta(days=30)).isoformat(),
            "subject": "TEST_To Be Deleted",
            "items": [{"description": "Delete Item", "quantity": 1, "unit_price": 50, "tax_rate": 19, "discount": 0, "total": 59.5}]
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/invoices?company_id={auth_data['company_id']}",
            headers={"Authorization": f"Bearer {auth_data['token']}"},
            json=invoice_data
        )
        
        assert create_response.status_code == 201
        invoice_id = create_response.json()["id"]
        
        # Delete the invoice
        delete_response = requests.delete(
            f"{BASE_URL}/api/invoices/{invoice_id}?company_id={auth_data['company_id']}",
            headers={"Authorization": f"Bearer {auth_data['token']}"}
        )
        
        assert delete_response.status_code == 200, f"Delete invoice failed: {delete_response.text}"
        print(f"✓ Invoice deleted: {invoice_id}")
        
        # Verify deletion
        get_response = requests.get(
            f"{BASE_URL}/api/invoices/{invoice_id}?company_id={auth_data['company_id']}",
            headers={"Authorization": f"Bearer {auth_data['token']}"}
        )
        
        assert get_response.status_code == 404, "Deleted invoice should return 404"
        print(f"✓ Deletion verified - invoice not found")


class TestInvoiceStatusActions:
    """Test invoice status change actions (send, mark paid)"""
    
    @pytest.fixture(scope="class")
    def auth_data(self):
        """Get auth token and company_id"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=EXISTING_USER)
        if response.status_code != 200:
            pytest.skip(f"Could not login: {response.text}")
        
        token = response.json()["access_token"]
        companies_response = requests.get(
            f"{BASE_URL}/api/companies/",
            headers={"Authorization": f"Bearer {token}"}
        )
        if companies_response.status_code != 200 or len(companies_response.json()) == 0:
            pytest.skip("No companies available")
        
        company_id = companies_response.json()[0]["id"]
        return {"token": token, "company_id": company_id}
    
    @pytest.fixture(scope="class")
    def test_customer_id(self, auth_data):
        """Get a test customer"""
        response = requests.get(
            f"{BASE_URL}/api/customers?company_id={auth_data['company_id']}",
            headers={"Authorization": f"Bearer {auth_data['token']}"}
        )
        
        if response.status_code == 200 and len(response.json()) > 0:
            return response.json()[0]["id"]
        
        # Create customer if none exist
        customer_data = {
            "first_name": "TEST_Status",
            "last_name": "Customer",
            "email": f"test_status_{uuid.uuid4().hex[:8]}@test.com"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/customers?company_id={auth_data['company_id']}",
            headers={"Authorization": f"Bearer {auth_data['token']}"},
            json=customer_data
        )
        
        if create_response.status_code == 201:
            return create_response.json()["id"]
        
        pytest.skip("Could not get customer for testing")
    
    def test_send_invoice(self, auth_data, test_customer_id):
        """Test marking invoice as sent"""
        # Create invoice
        invoice_data = {
            "customer_id": test_customer_id,
            "date": datetime.now().isoformat(),
            "due_date": (datetime.now() + timedelta(days=30)).isoformat(),
            "subject": "TEST_Send Invoice",
            "items": [{"description": "Send Test", "quantity": 1, "unit_price": 100, "tax_rate": 19, "discount": 0, "total": 119}]
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/invoices?company_id={auth_data['company_id']}",
            headers={"Authorization": f"Bearer {auth_data['token']}"},
            json=invoice_data
        )
        
        assert create_response.status_code == 201
        invoice_id = create_response.json()["id"]
        
        # Send the invoice
        send_response = requests.post(
            f"{BASE_URL}/api/invoices/{invoice_id}/send?company_id={auth_data['company_id']}",
            headers={"Authorization": f"Bearer {auth_data['token']}"}
        )
        
        assert send_response.status_code == 200, f"Send invoice failed: {send_response.text}"
        print(f"✓ Invoice marked as sent: {invoice_id}")
        
        # Verify status changed
        get_response = requests.get(
            f"{BASE_URL}/api/invoices/{invoice_id}?company_id={auth_data['company_id']}",
            headers={"Authorization": f"Bearer {auth_data['token']}"}
        )
        
        assert get_response.status_code == 200
        invoice = get_response.json()
        assert invoice["status"] == "sent", f"Expected status 'sent', got '{invoice['status']}'"
        print(f"✓ Status verified as 'sent'")
    
    def test_mark_invoice_paid(self, auth_data, test_customer_id):
        """Test marking invoice as paid"""
        # Create invoice
        invoice_data = {
            "customer_id": test_customer_id,
            "date": datetime.now().isoformat(),
            "due_date": (datetime.now() + timedelta(days=30)).isoformat(),
            "subject": "TEST_Paid Invoice",
            "items": [{"description": "Paid Test", "quantity": 1, "unit_price": 200, "tax_rate": 19, "discount": 0, "total": 238}]
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/invoices?company_id={auth_data['company_id']}",
            headers={"Authorization": f"Bearer {auth_data['token']}"},
            json=invoice_data
        )
        
        assert create_response.status_code == 201
        invoice_id = create_response.json()["id"]
        
        # Mark as paid
        paid_response = requests.post(
            f"{BASE_URL}/api/invoices/{invoice_id}/mark-paid?company_id={auth_data['company_id']}",
            headers={"Authorization": f"Bearer {auth_data['token']}"}
        )
        
        assert paid_response.status_code == 200, f"Mark paid failed: {paid_response.text}"
        data = paid_response.json()
        assert data["new_status"] == "paid"
        print(f"✓ Invoice marked as paid: {invoice_id}")
        
        # Verify status changed
        get_response = requests.get(
            f"{BASE_URL}/api/invoices/{invoice_id}?company_id={auth_data['company_id']}",
            headers={"Authorization": f"Bearer {auth_data['token']}"}
        )
        
        assert get_response.status_code == 200
        invoice = get_response.json()
        assert invoice["status"] == "paid", f"Expected status 'paid', got '{invoice['status']}'"
        assert invoice["balance_due"] == 0, "Balance due should be 0 after full payment"
        print(f"✓ Status verified as 'paid' with balance_due=0")
    
    def test_partial_payment(self, auth_data, test_customer_id):
        """Test partial payment on invoice"""
        # Create invoice with known total
        invoice_data = {
            "customer_id": test_customer_id,
            "date": datetime.now().isoformat(),
            "due_date": (datetime.now() + timedelta(days=30)).isoformat(),
            "subject": "TEST_Partial Payment",
            "items": [{"description": "Partial Test", "quantity": 1, "unit_price": 100, "tax_rate": 0, "discount": 0, "total": 100}]
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/invoices?company_id={auth_data['company_id']}",
            headers={"Authorization": f"Bearer {auth_data['token']}"},
            json=invoice_data
        )
        
        assert create_response.status_code == 201
        invoice_id = create_response.json()["id"]
        
        # Make partial payment (50 out of 100)
        paid_response = requests.post(
            f"{BASE_URL}/api/invoices/{invoice_id}/mark-paid?company_id={auth_data['company_id']}&amount=50",
            headers={"Authorization": f"Bearer {auth_data['token']}"}
        )
        
        assert paid_response.status_code == 200, f"Partial payment failed: {paid_response.text}"
        data = paid_response.json()
        assert data["new_status"] == "partial", f"Expected 'partial', got '{data['new_status']}'"
        print(f"✓ Partial payment recorded: {invoice_id}")
        
        # Verify balance
        get_response = requests.get(
            f"{BASE_URL}/api/invoices/{invoice_id}?company_id={auth_data['company_id']}",
            headers={"Authorization": f"Bearer {auth_data['token']}"}
        )
        
        assert get_response.status_code == 200
        invoice = get_response.json()
        assert invoice["status"] == "partial"
        assert invoice["amount_paid"] == 50
        print(f"✓ Partial payment verified - amount_paid: {invoice['amount_paid']}, balance_due: {invoice['balance_due']}")


class TestInvoiceValidation:
    """Test invoice validation and error handling"""
    
    @pytest.fixture(scope="class")
    def auth_data(self):
        """Get auth token and company_id"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=EXISTING_USER)
        if response.status_code != 200:
            pytest.skip(f"Could not login: {response.text}")
        
        token = response.json()["access_token"]
        companies_response = requests.get(
            f"{BASE_URL}/api/companies/",
            headers={"Authorization": f"Bearer {token}"}
        )
        if companies_response.status_code != 200 or len(companies_response.json()) == 0:
            pytest.skip("No companies available")
        
        company_id = companies_response.json()[0]["id"]
        return {"token": token, "company_id": company_id}
    
    def test_create_invoice_without_customer(self, auth_data):
        """Test that invoice creation fails without customer_id"""
        invoice_data = {
            "date": datetime.now().isoformat(),
            "due_date": (datetime.now() + timedelta(days=30)).isoformat(),
            "subject": "No Customer Invoice",
            "items": [{"description": "Item", "quantity": 1, "unit_price": 100, "tax_rate": 19, "discount": 0, "total": 119}]
        }
        
        response = requests.post(
            f"{BASE_URL}/api/invoices?company_id={auth_data['company_id']}",
            headers={"Authorization": f"Bearer {auth_data['token']}"},
            json=invoice_data
        )
        
        assert response.status_code == 422, f"Expected 422 for missing customer_id, got {response.status_code}"
        print(f"✓ Invoice creation without customer correctly rejected")
    
    def test_create_invoice_with_invalid_customer(self, auth_data):
        """Test invoice creation with non-existent customer"""
        invoice_data = {
            "customer_id": "000000000000000000000000",  # Invalid ObjectId
            "date": datetime.now().isoformat(),
            "due_date": (datetime.now() + timedelta(days=30)).isoformat(),
            "subject": "Invalid Customer Invoice",
            "items": [{"description": "Item", "quantity": 1, "unit_price": 100, "tax_rate": 19, "discount": 0, "total": 119}]
        }
        
        response = requests.post(
            f"{BASE_URL}/api/invoices?company_id={auth_data['company_id']}",
            headers={"Authorization": f"Bearer {auth_data['token']}"},
            json=invoice_data
        )
        
        # Should either fail with 404 (customer not found) or succeed (depends on implementation)
        # The important thing is it doesn't crash with 500
        assert response.status_code != 500, f"Server error: {response.text}"
        print(f"✓ Invalid customer handled gracefully (status: {response.status_code})")
    
    def test_get_nonexistent_invoice(self, auth_data):
        """Test getting a non-existent invoice"""
        response = requests.get(
            f"{BASE_URL}/api/invoices/000000000000000000000000?company_id={auth_data['company_id']}",
            headers={"Authorization": f"Bearer {auth_data['token']}"}
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"✓ Non-existent invoice returns 404")
    
    def test_invoice_unauthenticated(self):
        """Test invoice endpoints without authentication"""
        response = requests.get(f"{BASE_URL}/api/invoices?company_id=test")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ Unauthenticated request correctly rejected")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
