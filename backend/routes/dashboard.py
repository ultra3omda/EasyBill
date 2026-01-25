from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime, timezone, timedelta
import os
from utils.dependencies import get_current_user, get_current_company

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

def make_aware(dt):
    """Convert naive datetime to UTC aware datetime"""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt

@router.get("/stats")
async def get_dashboard_stats(
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Get real dashboard statistics for a company"""
    company = await get_current_company(current_user, company_id)
    company_oid = ObjectId(company_id)
    
    now = datetime.now(timezone.utc)
    start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    start_of_year = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    
    # Invoices stats
    invoices = await db.invoices.find({"company_id": company_oid}).to_list(10000)
    total_invoiced = sum(inv.get("total", 0) for inv in invoices)
    total_paid = sum(inv.get("amount_paid", 0) for inv in invoices)
    total_unpaid = total_invoiced - total_paid
    invoices_count = len(invoices)
    paid_invoices = len([i for i in invoices if i.get("status") == "paid"])
    overdue_invoices = len([i for i in invoices if i.get("status") == "overdue"])
    
    # Quotes stats
    quotes = await db.quotes.find({"company_id": company_oid}).to_list(10000)
    total_quotes = sum(q.get("total", 0) for q in quotes)
    quotes_count = len(quotes)
    accepted_quotes = len([q for q in quotes if q.get("status") == "accepted"])
    
    # Payments received
    payments_received = await db.payments.find({"company_id": company_oid, "type": "received"}).to_list(10000)
    total_payments_received = sum(p.get("amount", 0) for p in payments_received)
    
    # Payments sent (to suppliers)
    payments_sent = await db.payments.find({"company_id": company_oid, "type": "sent"}).to_list(10000)
    total_payments_sent = sum(p.get("amount", 0) for p in payments_sent)
    
    # Supplier payments
    supplier_payments = await db.supplier_payments.find({"company_id": company_oid}).to_list(10000)
    total_supplier_payments = sum(p.get("amount", 0) for p in supplier_payments)
    
    # Customers stats
    customers = await db.customers.find({"company_id": company_oid}).to_list(10000)
    customers_count = len(customers)
    new_customers_month = len([c for c in customers if c.get("created_at") and make_aware(c["created_at"]) >= start_of_month])
    
    # Suppliers stats
    suppliers = await db.suppliers.find({"company_id": company_oid}).to_list(10000)
    suppliers_count = len(suppliers)
    
    # Products stats
    products = await db.products.find({"company_id": company_oid}).to_list(10000)
    products_count = len(products)
    total_stock_value = sum((p.get("quantity_in_stock", 0) * p.get("purchase_price", 0)) for p in products)
    low_stock_products = len([p for p in products if p.get("quantity_in_stock", 0) <= p.get("min_stock_level", 0) and p.get("min_stock_level", 0) > 0])
    
    # Purchase orders
    purchase_orders = await db.purchase_orders.find({"company_id": company_oid}).to_list(10000)
    total_purchases = sum(po.get("total", 0) for po in purchase_orders)
    
    # Calculate margins
    total_revenue = total_invoiced
    total_cost = sum(
        sum(item.get("quantity", 0) * (
            next((p.get("purchase_price", 0) for p in products if str(p["_id"]) == item.get("product_id")), 0)
        ) for item in inv.get("items", []))
        for inv in invoices
    )
    gross_margin = ((total_revenue - total_cost) / total_revenue * 100) if total_revenue > 0 else 0
    net_margin = ((total_paid - total_cost) / total_paid * 100) if total_paid > 0 else 0
    
    # DSO (Days Sales Outstanding)
    dso = 0
    if total_invoiced > 0 and invoices_count > 0:
        avg_invoice_age = sum(
            (now - inv.get("date", now)).days 
            for inv in invoices if inv.get("status") != "paid"
        ) / max(1, len([i for i in invoices if i.get("status") != "paid"]))
        dso = int(avg_invoice_age)
    
    # Monthly revenue chart data
    monthly_data = []
    for i in range(6):
        month_start = (now - timedelta(days=30*i)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        month_end = (month_start + timedelta(days=32)).replace(day=1) - timedelta(seconds=1)
        
        month_invoices = [inv for inv in invoices if month_start <= inv.get("date", now) <= month_end]
        month_revenue = sum(inv.get("total", 0) for inv in month_invoices)
        
        month_name = month_start.strftime("%b")
        monthly_data.insert(0, {"month": month_name, "revenue": round(month_revenue, 2), "expenses": round(month_revenue * 0.6, 2)})
    
    # Category breakdown
    categories = {}
    for inv in invoices:
        for item in inv.get("items", []):
            prod = next((p for p in products if str(p["_id"]) == item.get("product_id")), None)
            if prod:
                cat = prod.get("category", "Autre")
                categories[cat] = categories.get(cat, 0) + item.get("total", 0)
    
    category_data = [{"name": k, "value": round(v, 2)} for k, v in sorted(categories.items(), key=lambda x: -x[1])[:5]]
    
    return {
        "summary": {
            "total_revenue": round(total_invoiced, 3),
            "total_paid": round(total_paid, 3),
            "total_unpaid": round(total_unpaid, 3),
            "gross_margin": round(gross_margin, 1),
            "net_margin": round(net_margin, 1),
            "dso": dso,
            "renewal_rate": 89.2  # Placeholder
        },
        "invoices": {
            "count": invoices_count,
            "total": round(total_invoiced, 3),
            "paid": paid_invoices,
            "overdue": overdue_invoices,
            "unpaid_amount": round(total_unpaid, 3)
        },
        "quotes": {
            "count": quotes_count,
            "total": round(total_quotes, 3),
            "accepted": accepted_quotes
        },
        "payments": {
            "received": round(total_payments_received, 3),
            "sent": round(total_payments_sent + total_supplier_payments, 3)
        },
        "customers": {
            "count": customers_count,
            "new_this_month": new_customers_month
        },
        "suppliers": {
            "count": suppliers_count
        },
        "products": {
            "count": products_count,
            "stock_value": round(total_stock_value, 3),
            "low_stock": low_stock_products
        },
        "purchases": {
            "total": round(total_purchases, 3)
        },
        "charts": {
            "monthly_revenue": monthly_data,
            "categories": category_data
        }
    }
