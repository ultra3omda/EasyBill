from fastapi import FastAPI, APIRouter
from dotenv import load_dotenv
from pathlib import Path
import os

# IMPORTANT: Load .env BEFORE importing routes that use os.environ
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Environment variables must be set in .env file - no fallbacks for production
# Kubernetes will inject the proper values

from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import logging

# Import all routes AFTER loading .env
from routes import auth, companies, customers, suppliers, products, quotes, invoices, payments, projects, settings
from routes import delivery_notes, credit_notes, reminders
from routes import purchase_orders, supplier_invoices, supplier_payments
from routes import warehouses, stock_movements, accounting
from routes import journal_entries, seed, dashboard, inventories, recurring_invoices, accounting_sync, client_portal
from routes import exit_vouchers, receipts, disbursements, withholding_taxes, collaborators
from routes import import_export, treasury, signatures

# ── Nouveaux modules (A-E) ───────────────────────────────────────────────
from routes import cash_accounts           # A - Cash-first payment model
from routes import chatbot                 # B - Chatbot financial interface
from routes import country_configs         # C - Multi-country accounting
from routes import reminder_engine_routes  # D - Reminder engine
from routes import ai_assistant            # E - AI-ready hooks

# PDF routes optionnels (WeasyPrint nécessite Pango/GTK, pas toujours dispo sur Windows)
try:
    from routes import pdf
    _pdf_available = True
except Exception as e:
    _pdf_available = False
    pdf = None
try:
    from routes import receipts_pdf
    _receipts_pdf_available = True
except Exception:
    _receipts_pdf_available = False
    receipts_pdf = None

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
if _pdf_available and pdf:
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
if _receipts_pdf_available and receipts_pdf:
    app.include_router(receipts_pdf.router)
app.include_router(signatures.router)

# ── Nouveaux modules ─────────────────────────────────────────────────────
app.include_router(cash_accounts.router)
app.include_router(chatbot.router)
app.include_router(country_configs.router)
app.include_router(reminder_engine_routes.router)
app.include_router(ai_assistant.router)

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
