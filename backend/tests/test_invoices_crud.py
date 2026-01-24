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


def get_auth_data():
    """Get auth token and company_id"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=EXISTING_USER)
    if response.status_code != 200:
        return None
    
    token = response.json()["access_token"]
    
    # Get company (note: trailing slash required to avoid redirect losing auth header)
    companies_response = requests.get(
        f"{BASE_URL}/api/companies/",
        headers={"Authorization": f"Bearer {token}"}
    )
    if companies_response.status_code != 200 or len(companies_response.json()) == 0:
        return None
    
    company_id = companies_response.json()[0]["id"]
    return {"token": token, "company_id": company_id}


def get_or_create_customer(auth_data):
    """Get or create a test customer"""
    # Note: trailing slash required to avoid redirect losing auth header
    response = requests.get(
        f"{BASE_URL}/api/customers/?company_id={auth_data['company_id']}",
        headers={"Authorization": f"Bearer {auth_data['token']}"}
    )
    
    if response.status_code == 200 and len(response.json()) > 0:
        return response.json()[0]["id"]
    
    # Create a new customer
    customer_data = {
        "first_name": "TEST_Invoice",
        "last_name": "TestCustomer",
        "email": f"test_inv_{uuid.uuid4().hex[:8]}@test.com"
    }
    
    create_response = requests.post(
        f"{BASE_URL}/api/customers/?company_id={auth_data['company_id']}",
        headers={"Authorization": f"Bearer {auth_data['token']}"},
        json=customer_data
    )
    
    if create_response.status_code == 201:
        return create_response.json()["id"]
    
    return None


# ============ SETUP TESTS ============
def test_api_reachable():
    """Test API connectivity"""
    response = requests.get(f"{BASE_URL}/api/")
    assert response.status_code == 200
    print(f"✓ API reachable at {BASE_URL}")


def test_login_and_get_company():
    """Verify login and company access"""
    auth_data = get_auth_data()
    assert auth_data is not None, "Could not login"
    assert auth_data["token"] is not None
    assert auth_data["company_id"] is not None
    print(f"✓ Logged in with company_id: {auth_data['company_id']}")


# ============ CUSTOMER TESTS ============
def test_create_customer():
    """Test creating a customer for invoice testing"""
    auth_data = get_auth_data()
    assert auth_data is not None, "Could not login"
    
    customer_data = {
        "first_name": "TEST_Invoice",
        "last_name": "Customer",
        "email": f"test_invoice_customer_{uuid.uuid4().hex[:8]}@test.com",
        "phone": "71234567"
    }
    
    response = requests.post(
        f"{BASE_URL}/api/customers/?company_id={auth_data['company_id']}",
        headers={"Authorization": f"Bearer {auth_data['token']}"},
        json=customer_data
    )
    
    assert response.status_code == 201, f"Create customer failed: {response.text}"
    data = response.json()
    assert "id" in data
    print(f"✓ Customer created: {data['id']}")


def test_list_customers():
    """Test listing customers"""
    auth_data = get_auth_data()
    assert auth_data is not None, "Could not login"
    
    response = requests.get(
        f"{BASE_URL}/api/customers/?company_id={auth_data['company_id']}",
        headers={"Authorization": f"Bearer {auth_data['token']}"}
    )
    
    assert response.status_code == 200, f"List customers failed: {response.text}"
    data = response.json()
    assert isinstance(data, list)
    print(f"✓ Listed {len(data)} customers")


# ============ PRODUCT TESTS ============
def test_create_product():
    """Test creating a product for invoice testing"""
    auth_data = get_auth_data()
    assert auth_data is not None, "Could not login"
    
    product_data = {
        "name": f"TEST_Product_{uuid.uuid4().hex[:8]}",
        "sku": f"SKU-{uuid.uuid4().hex[:6]}",
        "selling_price": 100.00,
        "unit_price": 100.00,  # Required field
        "tax_rate": 19,
        "type": "product"
    }
    
    response = requests.post(
        f"{BASE_URL}/api/products/?company_id={auth_data['company_id']}",
        headers={"Authorization": f"Bearer {auth_data['token']}"},
        json=product_data
    )
    
    assert response.status_code == 201, f"Create product failed: {response.text}"
    data = response.json()
    assert "id" in data
    print(f"✓ Product created: {data['id']}")


def test_list_products():
    """Test listing products"""
    auth_data = get_auth_data()
    assert auth_data is not None, "Could not login"
    
    response = requests.get(
        f"{BASE_URL}/api/products/?company_id={auth_data['company_id']}",
        headers={"Authorization": f"Bearer {auth_data['token']}"}
    )
    
    assert response.status_code == 200, f"List products failed: {response.text}"
    data = response.json()
    assert isinstance(data, list)
    print(f"✓ Listed {len(data)} products")


# ============ INVOICE CRUD TESTS ============
def test_create_invoice():
    """Test creating a new invoice"""
    auth_data = get_auth_data()
    assert auth_data is not None, "Could not login"
    
    customer_id = get_or_create_customer(auth_data)
    assert customer_id is not None, "Could not get/create customer"
    
    invoice_data = {
        "customer_id": customer_id,
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
        f"{BASE_URL}/api/invoices/?company_id={auth_data['company_id']}",
        headers={"Authorization": f"Bearer {auth_data['token']}"},
        json=invoice_data
    )
    
    assert response.status_code == 201, f"Create invoice failed: {response.text}"
    data = response.json()
    
    assert "id" in data, "Response should contain invoice id"
    assert "number" in data, "Response should contain invoice number"
    print(f"✓ Invoice created: {data['number']} (ID: {data['id']})")


def test_list_invoices():
    """Test listing invoices"""
    auth_data = get_auth_data()
    assert auth_data is not None, "Could not login"
    
    response = requests.get(
        f"{BASE_URL}/api/invoices/?company_id={auth_data['company_id']}",
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


def test_get_invoice_by_id():
    """Test getting a specific invoice"""
    auth_data = get_auth_data()
    assert auth_data is not None, "Could not login"
    
    customer_id = get_or_create_customer(auth_data)
    assert customer_id is not None, "Could not get/create customer"
    
    # First create an invoice to get
    invoice_data = {
        "customer_id": customer_id,
        "date": datetime.now().isoformat(),
        "due_date": (datetime.now() + timedelta(days=30)).isoformat(),
        "subject": "TEST_Get Invoice",
        "items": [{"description": "Item", "quantity": 1, "unit_price": 50, "tax_rate": 19, "discount": 0, "total": 59.5}]
    }
    
    create_response = requests.post(
        f"{BASE_URL}/api/invoices/?company_id={auth_data['company_id']}",
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


def test_update_invoice():
    """Test updating an invoice"""
    auth_data = get_auth_data()
    assert auth_data is not None, "Could not login"
    
    customer_id = get_or_create_customer(auth_data)
    assert customer_id is not None, "Could not get/create customer"
    
    # Create invoice first
    invoice_data = {
        "customer_id": customer_id,
        "date": datetime.now().isoformat(),
        "due_date": (datetime.now() + timedelta(days=30)).isoformat(),
        "subject": "TEST_Original Subject",
        "items": [{"description": "Original Item", "quantity": 1, "unit_price": 100, "tax_rate": 19, "discount": 0, "total": 119}]
    }
    
    create_response = requests.post(
        f"{BASE_URL}/api/invoices/?company_id={auth_data['company_id']}",
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


def test_delete_invoice():
    """Test deleting an invoice"""
    auth_data = get_auth_data()
    assert auth_data is not None, "Could not login"
    
    customer_id = get_or_create_customer(auth_data)
    assert customer_id is not None, "Could not get/create customer"
    
    # Create invoice first
    invoice_data = {
        "customer_id": customer_id,
        "date": datetime.now().isoformat(),
        "due_date": (datetime.now() + timedelta(days=30)).isoformat(),
        "subject": "TEST_To Be Deleted",
        "items": [{"description": "Delete Item", "quantity": 1, "unit_price": 50, "tax_rate": 19, "discount": 0, "total": 59.5}]
    }
    
    create_response = requests.post(
        f"{BASE_URL}/api/invoices/?company_id={auth_data['company_id']}",
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


# ============ INVOICE STATUS TESTS ============
def test_send_invoice():
    """Test marking invoice as sent"""
    auth_data = get_auth_data()
    assert auth_data is not None, "Could not login"
    
    customer_id = get_or_create_customer(auth_data)
    assert customer_id is not None, "Could not get/create customer"
    
    # Create invoice
    invoice_data = {
        "customer_id": customer_id,
        "date": datetime.now().isoformat(),
        "due_date": (datetime.now() + timedelta(days=30)).isoformat(),
        "subject": "TEST_Send Invoice",
        "items": [{"description": "Send Test", "quantity": 1, "unit_price": 100, "tax_rate": 19, "discount": 0, "total": 119}]
    }
    
    create_response = requests.post(
        f"{BASE_URL}/api/invoices/?company_id={auth_data['company_id']}",
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


def test_mark_invoice_paid():
    """Test marking invoice as paid"""
    auth_data = get_auth_data()
    assert auth_data is not None, "Could not login"
    
    customer_id = get_or_create_customer(auth_data)
    assert customer_id is not None, "Could not get/create customer"
    
    # Create invoice
    invoice_data = {
        "customer_id": customer_id,
        "date": datetime.now().isoformat(),
        "due_date": (datetime.now() + timedelta(days=30)).isoformat(),
        "subject": "TEST_Paid Invoice",
        "items": [{"description": "Paid Test", "quantity": 1, "unit_price": 200, "tax_rate": 19, "discount": 0, "total": 238}]
    }
    
    create_response = requests.post(
        f"{BASE_URL}/api/invoices/?company_id={auth_data['company_id']}",
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


def test_partial_payment():
    """Test partial payment on invoice"""
    auth_data = get_auth_data()
    assert auth_data is not None, "Could not login"
    
    customer_id = get_or_create_customer(auth_data)
    assert customer_id is not None, "Could not get/create customer"
    
    # Create invoice with known total
    invoice_data = {
        "customer_id": customer_id,
        "date": datetime.now().isoformat(),
        "due_date": (datetime.now() + timedelta(days=30)).isoformat(),
        "subject": "TEST_Partial Payment",
        "items": [{"description": "Partial Test", "quantity": 1, "unit_price": 100, "tax_rate": 0, "discount": 0, "total": 100}]
    }
    
    create_response = requests.post(
        f"{BASE_URL}/api/invoices/?company_id={auth_data['company_id']}",
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


# ============ VALIDATION TESTS ============
def test_create_invoice_without_customer():
    """Test that invoice creation fails without customer_id"""
    auth_data = get_auth_data()
    assert auth_data is not None, "Could not login"
    
    invoice_data = {
        "date": datetime.now().isoformat(),
        "due_date": (datetime.now() + timedelta(days=30)).isoformat(),
        "subject": "No Customer Invoice",
        "items": [{"description": "Item", "quantity": 1, "unit_price": 100, "tax_rate": 19, "discount": 0, "total": 119}]
    }
    
    response = requests.post(
        f"{BASE_URL}/api/invoices/?company_id={auth_data['company_id']}",
        headers={"Authorization": f"Bearer {auth_data['token']}"},
        json=invoice_data
    )
    
    assert response.status_code == 422, f"Expected 422 for missing customer_id, got {response.status_code}"
    print(f"✓ Invoice creation without customer correctly rejected")


def test_get_nonexistent_invoice():
    """Test getting a non-existent invoice"""
    auth_data = get_auth_data()
    assert auth_data is not None, "Could not login"
    
    response = requests.get(
        f"{BASE_URL}/api/invoices/000000000000000000000000?company_id={auth_data['company_id']}",
        headers={"Authorization": f"Bearer {auth_data['token']}"}
    )
    
    assert response.status_code == 404, f"Expected 404, got {response.status_code}"
    print(f"✓ Non-existent invoice returns 404")


def test_invoice_unauthenticated():
    """Test invoice endpoints without authentication"""
    response = requests.get(f"{BASE_URL}/api/invoices/?company_id=test")
    
    assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    print(f"✓ Unauthenticated request correctly rejected")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
