"""
Test Products Import/Export API Endpoints
Tests for: import, export stock, export prices, bulk delete, template download
"""
import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://easybill-25.preview.emergentagent.com')
COMPANY_ID = "697549d9ee757048d6c9c8aa"

# Test credentials
TEST_EMAIL = "test@example.com"
TEST_PASSWORD = "Test123!"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
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


class TestProductsList:
    """Test products list endpoint"""
    
    def test_list_products(self, api_client):
        """Test listing all products"""
        response = api_client.get(f"{BASE_URL}/api/products/?company_id={COMPANY_ID}")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        # Should have at least 2 products (Ordinateur Portable, Clavier USB)
        assert len(data) >= 2
        
        # Verify product structure
        for product in data:
            assert "id" in product
            assert "name" in product
            assert "sku" in product
            assert "selling_price" in product
            assert "purchase_price" in product
            assert "quantity_in_stock" in product


class TestExportTemplate:
    """Test export template endpoint"""
    
    def test_download_template(self, api_client):
        """Test downloading CSV import template"""
        response = api_client.get(f"{BASE_URL}/api/products/export/template?company_id={COMPANY_ID}")
        assert response.status_code == 200
        
        # Check content type
        assert "text/csv" in response.headers.get("Content-Type", "")
        
        # Check content
        content = response.text
        assert "reference" in content.lower()
        assert "titre" in content.lower()
        assert "prix_vente_ht" in content.lower()
        assert "prix_achat_ht" in content.lower()
        
        # Verify it has header and example row
        lines = content.strip().split('\n')
        assert len(lines) >= 2  # Header + at least one example


class TestExportStock:
    """Test export stock state endpoint"""
    
    def test_export_stock_state(self, api_client):
        """Test exporting stock state as CSV"""
        response = api_client.get(f"{BASE_URL}/api/products/export/stock?company_id={COMPANY_ID}")
        assert response.status_code == 200
        
        # Check content type
        assert "text/csv" in response.headers.get("Content-Type", "")
        
        # Check content
        content = response.text
        assert "Reference" in content
        assert "Titre" in content
        assert "Stock Actuel" in content
        assert "Valeur Stock" in content
        
        # Verify data rows exist
        lines = content.strip().split('\n')
        assert len(lines) >= 2  # Header + at least one data row
        
        # Verify existing products are in export
        assert "Ordinateur Portable" in content or "REF-001" in content


class TestExportPrices:
    """Test export price list endpoint"""
    
    def test_export_price_list(self, api_client):
        """Test exporting price list as CSV"""
        response = api_client.get(f"{BASE_URL}/api/products/export/prices?company_id={COMPANY_ID}")
        assert response.status_code == 200
        
        # Check content type
        assert "text/csv" in response.headers.get("Content-Type", "")
        
        # Check content
        content = response.text
        assert "Reference" in content
        assert "Titre" in content
        assert "Prix Vente HT" in content
        assert "Prix Achat HT" in content
        assert "TVA" in content
        assert "Prix Vente TTC" in content
        
        # Verify data rows exist
        lines = content.strip().split('\n')
        assert len(lines) >= 2  # Header + at least one data row


class TestImportProducts:
    """Test import products endpoint"""
    
    def test_import_products_csv(self, auth_token):
        """Test importing products from CSV file"""
        # Create test CSV content
        csv_content = """reference;titre;description;categorie;marque;unite;prix_vente_ht;prix_achat_ht;taux_tva;quantite_stock;stock_minimum;code_barre;type_article;destination
TEST-IMPORT-001;Test Import Article;Description test import;Informatique;HP;pièce;250.000;180.000;19;20;5;111222333;product;both"""
        
        # Create file-like object
        files = {
            'file': ('test_import.csv', csv_content, 'text/csv')
        }
        data = {
            'delimiter': ';',
            'encoding': 'utf-8'
        }
        
        response = requests.post(
            f"{BASE_URL}/api/products/import?company_id={COMPANY_ID}",
            headers={"Authorization": f"Bearer {auth_token}"},
            files=files,
            data=data
        )
        
        assert response.status_code == 200
        result = response.json()
        assert "message" in result
        assert result["imported"] >= 1
        assert "errors" in result
    
    def test_import_products_missing_title(self, auth_token):
        """Test import with missing required title field"""
        csv_content = """reference;titre;description
TEST-MISSING;;Description without title"""
        
        files = {
            'file': ('test_import.csv', csv_content, 'text/csv')
        }
        data = {
            'delimiter': ';',
            'encoding': 'utf-8'
        }
        
        response = requests.post(
            f"{BASE_URL}/api/products/import?company_id={COMPANY_ID}",
            headers={"Authorization": f"Bearer {auth_token}"},
            files=files,
            data=data
        )
        
        assert response.status_code == 200
        result = response.json()
        # Should have errors for missing title
        assert result["imported"] == 0 or len(result.get("errors", [])) > 0
    
    def test_import_without_file(self, auth_token):
        """Test import without file returns error"""
        response = requests.post(
            f"{BASE_URL}/api/products/import?company_id={COMPANY_ID}",
            headers={"Authorization": f"Bearer {auth_token}"},
            data={'delimiter': ';'}
        )
        
        assert response.status_code == 400


class TestBulkDelete:
    """Test bulk delete endpoint"""
    
    def test_bulk_delete_products(self, api_client, auth_token):
        """Test bulk deleting products"""
        # First, get products to find test imports
        response = api_client.get(f"{BASE_URL}/api/products/?company_id={COMPANY_ID}")
        products = response.json()
        
        # Find test import products
        test_ids = [p["id"] for p in products if p.get("sku", "").startswith("TEST-IMPORT")]
        
        if test_ids:
            # Delete test products
            response = requests.delete(
                f"{BASE_URL}/api/products/bulk/delete?company_id={COMPANY_ID}",
                headers={
                    "Authorization": f"Bearer {auth_token}",
                    "Content-Type": "application/json"
                },
                json={"product_ids": test_ids}
            )
            
            assert response.status_code == 200
            result = response.json()
            assert "message" in result
            assert "supprimés" in result["message"]
    
    def test_bulk_delete_empty_list(self, auth_token):
        """Test bulk delete with empty list returns error"""
        response = requests.delete(
            f"{BASE_URL}/api/products/bulk/delete?company_id={COMPANY_ID}",
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json"
            },
            json={"product_ids": []}
        )
        
        assert response.status_code == 400


class TestProductCRUD:
    """Test basic product CRUD operations"""
    
    def test_create_product(self, api_client):
        """Test creating a new product"""
        product_data = {
            "name": "TEST_CRUD_Product",
            "sku": "TEST-CRUD-001",
            "description": "Test product for CRUD",
            "type": "product",
            "category": "Informatique",
            "unit": "pièce",
            "selling_price": 100.0,
            "purchase_price": 80.0,
            "tax_rate": 19,
            "quantity_in_stock": 10,
            "destination": "both"
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/products/?company_id={COMPANY_ID}",
            json=product_data
        )
        
        assert response.status_code == 201
        result = response.json()
        assert "id" in result
        
        # Store ID for cleanup
        TestProductCRUD.created_product_id = result["id"]
    
    def test_get_product(self, api_client):
        """Test getting a single product"""
        product_id = getattr(TestProductCRUD, 'created_product_id', None)
        if not product_id:
            pytest.skip("No product created to get")
        
        response = api_client.get(f"{BASE_URL}/api/products/{product_id}?company_id={COMPANY_ID}")
        assert response.status_code == 200
        
        product = response.json()
        assert product["name"] == "TEST_CRUD_Product"
        assert product["sku"] == "TEST-CRUD-001"
    
    def test_update_product(self, api_client):
        """Test updating a product"""
        product_id = getattr(TestProductCRUD, 'created_product_id', None)
        if not product_id:
            pytest.skip("No product created to update")
        
        update_data = {
            "name": "TEST_CRUD_Product_Updated",
            "selling_price": 120.0
        }
        
        response = api_client.put(
            f"{BASE_URL}/api/products/{product_id}?company_id={COMPANY_ID}",
            json=update_data
        )
        
        assert response.status_code == 200
        
        # Verify update
        response = api_client.get(f"{BASE_URL}/api/products/{product_id}?company_id={COMPANY_ID}")
        product = response.json()
        assert product["name"] == "TEST_CRUD_Product_Updated"
        assert product["selling_price"] == 120.0
    
    def test_delete_product(self, api_client):
        """Test deleting a product"""
        product_id = getattr(TestProductCRUD, 'created_product_id', None)
        if not product_id:
            pytest.skip("No product created to delete")
        
        response = api_client.delete(f"{BASE_URL}/api/products/{product_id}?company_id={COMPANY_ID}")
        assert response.status_code == 200
        
        # Verify deletion
        response = api_client.get(f"{BASE_URL}/api/products/{product_id}?company_id={COMPANY_ID}")
        assert response.status_code == 404


class TestAuthentication:
    """Test authentication requirements"""
    
    def test_list_products_without_auth(self):
        """Test that listing products without auth fails"""
        response = requests.get(f"{BASE_URL}/api/products/?company_id={COMPANY_ID}")
        assert response.status_code == 401
    
    def test_export_without_auth(self):
        """Test that export without auth fails"""
        response = requests.get(f"{BASE_URL}/api/products/export/stock?company_id={COMPANY_ID}")
        assert response.status_code == 401
    
    def test_import_without_auth(self):
        """Test that import without auth fails"""
        response = requests.post(f"{BASE_URL}/api/products/import?company_id={COMPANY_ID}")
        assert response.status_code == 401


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
