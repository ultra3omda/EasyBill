"""
Script to seed comprehensive test data for EasyBill application
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime, timezone, timedelta
import os
import random

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
db_name = os.environ.get('DB_NAME', 'easybill')

client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

async def seed_data():
    print("🚀 Starting data seeding...")
    
    # Get all companies
    companies = await db.companies.find({}).to_list(100)
    if not companies:
        print("❌ No companies found. Please create a company first.")
        return
    
    for company in companies:
        company_id = company["_id"]
        company_name = company.get("name", "Unknown")
        print(f"\n📦 Seeding data for company: {company_name}")
        
        # Check if data already exists
        existing_products = await db.products.count_documents({"company_id": company_id})
        if existing_products > 10:
            print(f"   ⏭️ Company already has {existing_products} products, skipping...")
            continue
        
        # Get or create default warehouse
        warehouse = await db.warehouses.find_one({"company_id": company_id})
        if not warehouse:
            warehouse_id = (await db.warehouses.insert_one({
                "company_id": company_id,
                "name": "Entrepôt Principal",
                "code": "ENT001",
                "is_default": True,
                "is_active": True,
                "created_at": datetime.now(timezone.utc)
            })).inserted_id
        else:
            warehouse_id = warehouse["_id"]
        
        now = datetime.now(timezone.utc)
        
        # ============ PRODUCTS ============
        print("   📦 Creating products...")
        products_data = [
            # Produits simples pour la vente
            {"name": "Ordinateur Portable Dell XPS 15", "sku": "DELL-XPS15", "type": "product", "category": "Informatique", "brand": "Dell", "selling_price": 3500.000, "purchase_price": 2800.000, "tax_rate": 19, "quantity_in_stock": 25, "min_stock_level": 5, "destination": "both", "unit": "pièce"},
            {"name": "iPhone 15 Pro Max", "sku": "APPLE-IP15PM", "type": "product", "category": "Électronique", "brand": "Apple", "selling_price": 4200.000, "purchase_price": 3600.000, "tax_rate": 19, "quantity_in_stock": 15, "min_stock_level": 3, "destination": "vente", "unit": "pièce"},
            {"name": "Écran Samsung 27\" 4K", "sku": "SAM-MON27", "type": "product", "category": "Informatique", "brand": "Samsung", "selling_price": 890.000, "purchase_price": 650.000, "tax_rate": 19, "quantity_in_stock": 40, "min_stock_level": 10, "destination": "both", "unit": "pièce"},
            {"name": "Clavier Mécanique Logitech", "sku": "LOG-KB01", "type": "product", "category": "Informatique", "brand": "Logitech", "selling_price": 280.000, "purchase_price": 180.000, "tax_rate": 19, "quantity_in_stock": 60, "min_stock_level": 15, "destination": "both", "unit": "pièce"},
            {"name": "Souris Gaming Razer", "sku": "RAZ-MS01", "type": "product", "category": "Informatique", "brand": "Razer", "selling_price": 150.000, "purchase_price": 95.000, "tax_rate": 19, "quantity_in_stock": 80, "min_stock_level": 20, "destination": "vente", "unit": "pièce"},
            
            # Produits avec stock bas (pour tester alertes)
            {"name": "Imprimante HP LaserJet", "sku": "HP-LJ01", "type": "product", "category": "Informatique", "brand": "HP", "selling_price": 1200.000, "purchase_price": 900.000, "tax_rate": 19, "quantity_in_stock": 2, "min_stock_level": 5, "destination": "both", "unit": "pièce"},
            {"name": "Cartouche d'encre HP", "sku": "HP-INK01", "type": "product", "category": "Fournitures", "brand": "HP", "selling_price": 85.000, "purchase_price": 55.000, "tax_rate": 19, "quantity_in_stock": 3, "min_stock_level": 10, "destination": "both", "unit": "pièce"},
            
            # Services
            {"name": "Installation Système", "sku": "SRV-INST", "type": "service", "category": "Services", "brand": "", "selling_price": 150.000, "purchase_price": 0, "tax_rate": 19, "quantity_in_stock": 0, "destination": "vente", "unit": "heure"},
            {"name": "Maintenance Informatique", "sku": "SRV-MAINT", "type": "service", "category": "Services", "brand": "", "selling_price": 80.000, "purchase_price": 0, "tax_rate": 19, "quantity_in_stock": 0, "destination": "vente", "unit": "heure"},
            {"name": "Formation Utilisateur", "sku": "SRV-FORM", "type": "service", "category": "Services", "brand": "", "selling_price": 200.000, "purchase_price": 0, "tax_rate": 19, "quantity_in_stock": 0, "destination": "vente", "unit": "jour"},
            {"name": "Consultation Technique", "sku": "SRV-CONS", "type": "service", "category": "Services", "brand": "", "selling_price": 250.000, "purchase_price": 0, "tax_rate": 19, "quantity_in_stock": 0, "destination": "vente", "unit": "heure"},
            
            # Produits pour l'achat uniquement (matières premières)
            {"name": "Câble Ethernet Cat6 (100m)", "sku": "MAT-ETH100", "type": "product", "category": "Matériel", "brand": "", "selling_price": 0, "purchase_price": 120.000, "tax_rate": 19, "quantity_in_stock": 5, "min_stock_level": 2, "destination": "raw_material", "unit": "rouleau"},
            {"name": "Vis de fixation (lot 1000)", "sku": "MAT-VIS1K", "type": "product", "category": "Matériel", "brand": "", "selling_price": 0, "purchase_price": 45.000, "tax_rate": 19, "quantity_in_stock": 8, "destination": "raw_material", "unit": "lot"},
            
            # Produits composés
            {"name": "Pack PC Complet", "sku": "PACK-PC01", "type": "product", "category": "Informatique", "brand": "", "selling_price": 4500.000, "purchase_price": 3500.000, "tax_rate": 19, "quantity_in_stock": 5, "destination": "vente", "unit": "pack", "is_composite": True, "quantity_type": "composite"},
            {"name": "Kit Bureau Ergonomique", "sku": "PACK-ERGO", "type": "product", "category": "Mobilier", "brand": "", "selling_price": 1800.000, "purchase_price": 1200.000, "tax_rate": 19, "quantity_in_stock": 3, "destination": "vente", "unit": "kit", "is_composite": True, "quantity_type": "composite"},
        ]
        
        product_ids = []
        for p in products_data:
            p.update({
                "company_id": company_id,
                "warehouse_id": warehouse_id,
                "is_active": True,
                "created_at": now,
                "updated_at": now
            })
            result = await db.products.insert_one(p)
            product_ids.append(result.inserted_id)
        print(f"   ✅ Created {len(products_data)} products")
        
        # ============ CUSTOMERS ============
        print("   👥 Creating customers...")
        customers_data = [
            # Entreprises
            {"name": "Tech Solutions SARL", "email": "contact@techsolutions.tn", "phone": "+216 71 234 567", "customer_type": "entreprise", "tax_id": "1234567ABC", "address": "45 Avenue Habib Bourguiba", "city": "Tunis", "payment_terms": "net_30", "activity": "IT Services"},
            {"name": "Global Trade SA", "email": "info@globaltrade.tn", "phone": "+216 71 345 678", "customer_type": "entreprise", "tax_id": "2345678DEF", "address": "123 Rue de la Liberté", "city": "Sfax", "payment_terms": "net_60", "activity": "Import/Export"},
            {"name": "Digital Agency", "email": "hello@digitalagency.tn", "phone": "+216 71 456 789", "customer_type": "entreprise", "tax_id": "3456789GHI", "address": "78 Avenue Mohamed V", "city": "Sousse", "payment_terms": "immediate", "activity": "Marketing"},
            {"name": "Construction Plus", "email": "contact@constructionplus.tn", "phone": "+216 71 567 890", "customer_type": "entreprise", "tax_id": "4567890JKL", "address": "90 Zone Industrielle", "city": "Bizerte", "payment_terms": "net_30", "activity": "Construction"},
            {"name": "Pharma Distribution", "email": "commandes@pharmadist.tn", "phone": "+216 71 678 901", "customer_type": "entreprise", "tax_id": "5678901MNO", "address": "15 Rue de la Santé", "city": "Tunis", "payment_terms": "net_45", "activity": "Santé"},
            # Particuliers
            {"name": "Ahmed Ben Ali", "email": "ahmed.benali@gmail.com", "phone": "+216 98 123 456", "customer_type": "particulier", "first_name": "Ahmed", "last_name": "Ben Ali", "address": "12 Rue des Oliviers", "city": "Tunis", "national_id": "07123456"},
            {"name": "Fatma Trabelsi", "email": "fatma.trabelsi@yahoo.fr", "phone": "+216 98 234 567", "customer_type": "particulier", "first_name": "Fatma", "last_name": "Trabelsi", "address": "34 Avenue de France", "city": "Ariana", "national_id": "08234567"},
            {"name": "Mohamed Sahli", "email": "m.sahli@outlook.com", "phone": "+216 98 345 678", "customer_type": "particulier", "first_name": "Mohamed", "last_name": "Sahli", "address": "56 Rue Ibn Khaldoun", "city": "La Marsa", "national_id": "09345678"},
        ]
        
        customer_ids = []
        for c in customers_data:
            c.update({
                "company_id": company_id,
                "currency": "TND",
                "total_invoiced": random.uniform(5000, 50000),
                "total_paid": random.uniform(3000, 45000),
                "is_active": True,
                "created_at": now,
                "updated_at": now
            })
            c["total_unpaid"] = c["total_invoiced"] - c["total_paid"]
            result = await db.customers.insert_one(c)
            customer_ids.append(result.inserted_id)
        print(f"   ✅ Created {len(customers_data)} customers")
        
        # ============ SUPPLIERS ============
        print("   🏭 Creating suppliers...")
        suppliers_data = [
            {"name": "TechPro Distribution", "email": "orders@techpro.tn", "phone": "+216 71 111 222", "supplier_type": "entreprise", "tax_id": "SUP001ABC", "address": "Zone Industrielle Ben Arous", "city": "Ben Arous", "payment_terms": "net_30", "activity": "Distribution IT"},
            {"name": "Global Electronics", "email": "supply@globalelec.tn", "phone": "+216 71 222 333", "supplier_type": "entreprise", "tax_id": "SUP002DEF", "address": "45 Rue de l'Industrie", "city": "Tunis", "payment_terms": "net_60", "activity": "Électronique"},
            {"name": "Office Supplies Co", "email": "commandes@officesup.tn", "phone": "+216 71 333 444", "supplier_type": "entreprise", "tax_id": "SUP003GHI", "address": "123 Avenue de Carthage", "city": "Tunis", "payment_terms": "net_30", "activity": "Fournitures"},
            {"name": "Network Solutions", "email": "info@networksol.tn", "phone": "+216 71 444 555", "supplier_type": "entreprise", "tax_id": "SUP004JKL", "address": "78 Technopole", "city": "Sfax", "payment_terms": "immediate", "activity": "Réseaux"},
            {"name": "Import Express", "email": "orders@importexp.tn", "phone": "+216 71 555 666", "supplier_type": "entreprise", "tax_id": "SUP005MNO", "address": "Port de Radès", "city": "Radès", "payment_terms": "net_45", "activity": "Import"},
        ]
        
        supplier_ids = []
        for s in suppliers_data:
            s.update({
                "company_id": company_id,
                "currency": "TND",
                "total_purchased": random.uniform(10000, 100000),
                "total_paid": random.uniform(8000, 90000),
                "is_active": True,
                "created_at": now,
                "updated_at": now
            })
            s["total_unpaid"] = s["total_purchased"] - s["total_paid"]
            result = await db.suppliers.insert_one(s)
            supplier_ids.append(result.inserted_id)
        print(f"   ✅ Created {len(suppliers_data)} suppliers")
        
        # ============ QUOTES ============
        print("   📝 Creating quotes...")
        for i in range(5):
            customer = random.choice(customer_ids)
            items = []
            subtotal = 0
            for j in range(random.randint(1, 4)):
                prod_idx = random.randint(0, len(products_data) - 1)
                qty = random.randint(1, 5)
                price = products_data[prod_idx]["selling_price"]
                total = qty * price
                subtotal += total
                items.append({
                    "product_id": str(product_ids[prod_idx]),
                    "product_name": products_data[prod_idx]["name"],
                    "quantity": qty,
                    "unit_price": price,
                    "tax_rate": 19,
                    "total": total
                })
            
            tax = subtotal * 0.19
            await db.quotes.insert_one({
                "company_id": company_id,
                "customer_id": customer,
                "quote_number": f"DEV-{now.year}-{i+1:04d}",
                "date": now - timedelta(days=random.randint(1, 30)),
                "valid_until": now + timedelta(days=30),
                "items": items,
                "subtotal": subtotal,
                "tax_amount": tax,
                "total": subtotal + tax,
                "status": random.choice(["draft", "sent", "accepted", "rejected"]),
                "notes": "Devis de test",
                "created_at": now,
                "updated_at": now
            })
        print("   ✅ Created 5 quotes")
        
        # ============ INVOICES ============
        print("   🧾 Creating invoices...")
        invoice_ids = []
        for i in range(8):
            customer = random.choice(customer_ids)
            items = []
            subtotal = 0
            for j in range(random.randint(1, 5)):
                prod_idx = random.randint(0, len(products_data) - 1)
                qty = random.randint(1, 3)
                price = products_data[prod_idx]["selling_price"]
                total = qty * price
                subtotal += total
                items.append({
                    "product_id": str(product_ids[prod_idx]),
                    "product_name": products_data[prod_idx]["name"],
                    "quantity": qty,
                    "unit_price": price,
                    "tax_rate": 19,
                    "total": total
                })
            
            tax = subtotal * 0.19
            fiscal_stamp = 1.000
            status = random.choice(["draft", "sent", "paid", "partial", "overdue"])
            paid = subtotal + tax + fiscal_stamp if status == "paid" else (random.uniform(0, subtotal) if status == "partial" else 0)
            
            result = await db.invoices.insert_one({
                "company_id": company_id,
                "customer_id": customer,
                "invoice_number": f"FAC-{now.year}-{i+1:04d}",
                "date": now - timedelta(days=random.randint(1, 60)),
                "due_date": now + timedelta(days=random.randint(-30, 30)),
                "items": items,
                "subtotal": subtotal,
                "tax_amount": tax,
                "fiscal_stamp": fiscal_stamp,
                "total": subtotal + tax + fiscal_stamp,
                "amount_paid": paid,
                "status": status,
                "notes": "Facture de test",
                "created_at": now,
                "updated_at": now
            })
            invoice_ids.append(result.inserted_id)
        print("   ✅ Created 8 invoices")
        
        # ============ PAYMENTS ============
        print("   💰 Creating payments...")
        for i in range(6):
            await db.payments.insert_one({
                "company_id": company_id,
                "invoice_id": random.choice(invoice_ids),
                "customer_id": random.choice(customer_ids),
                "payment_number": f"PAY-{now.year}-{i+1:04d}",
                "date": now - timedelta(days=random.randint(1, 30)),
                "amount": random.uniform(500, 5000),
                "payment_method": random.choice(["cash", "check", "bank_transfer", "card"]),
                "reference": f"REF{random.randint(1000, 9999)}",
                "type": "received",
                "notes": "Paiement de test",
                "created_at": now
            })
        print("   ✅ Created 6 payments")
        
        # ============ PURCHASE ORDERS ============
        print("   📋 Creating purchase orders...")
        for i in range(5):
            supplier = random.choice(supplier_ids)
            items = []
            subtotal = 0
            for j in range(random.randint(1, 4)):
                prod_idx = random.randint(0, len(products_data) - 1)
                qty = random.randint(5, 20)
                price = products_data[prod_idx]["purchase_price"]
                if price > 0:
                    total = qty * price
                    subtotal += total
                    items.append({
                        "product_id": str(product_ids[prod_idx]),
                        "product_name": products_data[prod_idx]["name"],
                        "quantity": qty,
                        "unit_price": price,
                        "tax_rate": 19,
                        "total": total
                    })
            
            if items:
                tax = subtotal * 0.19
                await db.purchase_orders.insert_one({
                    "company_id": company_id,
                    "supplier_id": supplier,
                    "order_number": f"BC-{now.year}-{i+1:04d}",
                    "date": now - timedelta(days=random.randint(1, 45)),
                    "expected_date": now + timedelta(days=random.randint(1, 15)),
                    "items": items,
                    "subtotal": subtotal,
                    "tax_amount": tax,
                    "total": subtotal + tax,
                    "status": random.choice(["draft", "sent", "confirmed", "received"]),
                    "notes": "Commande de test",
                    "created_at": now,
                    "updated_at": now
                })
        print("   ✅ Created 5 purchase orders")
        
        # ============ STOCK MOVEMENTS ============
        print("   📊 Creating stock movements...")
        for i in range(10):
            prod_idx = random.randint(0, len(product_ids) - 1)
            movement_type = random.choice(["in", "out"])
            qty = random.randint(1, 10)
            
            await db.stock_movements.insert_one({
                "company_id": company_id,
                "product_id": product_ids[prod_idx],
                "warehouse_id": warehouse_id,
                "type": movement_type,
                "quantity": qty,
                "reason": random.choice(["Vente", "Achat", "Ajustement", "Retour", "Inventaire"]),
                "reference": f"MVT-{i+1:04d}",
                "previous_stock": random.randint(10, 50),
                "new_stock": random.randint(5, 60),
                "created_at": now - timedelta(days=random.randint(1, 30))
            })
        print("   ✅ Created 10 stock movements")
        
        # ============ JOURNAL ENTRIES ============
        print("   📚 Creating journal entries...")
        accounts = await db.chart_of_accounts.find({"company_id": company_id}).to_list(100)
        if accounts:
            for i in range(5):
                debit_acc = random.choice(accounts)
                credit_acc = random.choice(accounts)
                amount = random.uniform(500, 10000)
                
                await db.journal_entries.insert_one({
                    "company_id": company_id,
                    "entry_number": f"JE-{now.year}-{i+1:04d}",
                    "date": now - timedelta(days=random.randint(1, 30)),
                    "description": f"Écriture comptable de test #{i+1}",
                    "lines": [
                        {"account_id": str(debit_acc["_id"]), "account_code": debit_acc.get("code", ""), "account_name": debit_acc.get("name", ""), "debit": amount, "credit": 0},
                        {"account_id": str(credit_acc["_id"]), "account_code": credit_acc.get("code", ""), "account_name": credit_acc.get("name", ""), "debit": 0, "credit": amount}
                    ],
                    "total_debit": amount,
                    "total_credit": amount,
                    "status": random.choice(["draft", "posted"]),
                    "created_at": now
                })
            print("   ✅ Created 5 journal entries")
        
        print(f"\n✅ Data seeding completed for {company_name}!")

if __name__ == "__main__":
    asyncio.run(seed_data())
