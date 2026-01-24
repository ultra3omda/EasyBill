from fastapi import FastAPI, APIRouter
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path

# Import all routes
from routes import auth, companies, customers, suppliers, products, quotes, invoices, payments, projects, settings
from routes import delivery_notes, credit_notes, reminders

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

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
app.include_router(payments.router)
app.include_router(projects.router)
app.include_router(settings.router, prefix="/api")

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