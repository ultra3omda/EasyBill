from fastapi import FastAPI, APIRouter
from dotenv import load_dotenv
from pathlib import Path
import os

# IMPORTANT: Load .env BEFORE importing routes that use os.environ
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Set default values if not in .env
if 'MONGO_URL' not in os.environ:
    os.environ['MONGO_URL'] = 'mongodb://localhost:27017'
if 'DB_NAME' not in os.environ:
    os.environ['DB_NAME'] = 'easybill'
if 'JWT_SECRET' not in os.environ:
    os.environ['JWT_SECRET'] = 'easybill_super_secret_key_2026'

from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import logging

# Import all routes AFTER loading .env
from routes import auth, companies, customers, suppliers, products, quotes, invoices, payments, projects, settings
from routes import delivery_notes, credit_notes, reminders
from routes import purchase_orders, supplier_invoices, supplier_payments
from routes import warehouses, stock_movements, accounting
from routes import journal_entries, pdf, seed, dashboard, inventories, recurring_invoices, accounting_sync, client_portal
from routes import exit_vouchers, receipts, disbursements, withholding_taxes, collaborators
from routes import import_export, treasury, receipts_pdf, signatures

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI(title="EasyBill API", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all routers
app.include_router(auth.router)
app.include_router(companies.router)
app.include_router(customers.router)
app.include_router(suppliers.router)
app.include_router(products.router)
app.include_router(quotes.router)
app.include_router(invoices.router)
app.include_router(recurring_invoices.router)
app.include_router(payments.router)
app.include_router(projects.router)
app.include_router(settings.router, prefix="/api")
app.include_router(delivery_notes.router)
app.include_router(credit_notes.router)
app.include_router(reminders.router)
app.include_router(purchase_orders.router)
app.include_router(supplier_invoices.router)
app.include_router(supplier_payments.router)
app.include_router(warehouses.router)
app.include_router(stock_movements.router)
app.include_router(accounting.router)
app.include_router(accounting_sync.router)
app.include_router(client_portal.router)
app.include_router(journal_entries.router)
app.include_router(pdf.router)
app.include_router(seed.router)
app.include_router(dashboard.router)
app.include_router(exit_vouchers.router)
app.include_router(receipts.router)
app.include_router(disbursements.router)
app.include_router(withholding_taxes.router)
app.include_router(collaborators.router)
app.include_router(import_export.router)
app.include_router(treasury.router)
app.include_router(receipts_pdf.router)
app.include_router(signatures.router)

# Root endpoint
@app.get("/")
async def root():
    return {"message": "EasyBill API - Full Stack Invoicing Solution", "version": "1.0.0"}

@app.get("/api/")
async def api_root():
    return {"message": "EasyBill API is running", "status": "operational"}

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
