from fastapi import APIRouter, HTTPException, status, Depends, Query
from fastapi.responses import StreamingResponse
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime, timezone
import os
import io
from typing import Optional
from utils.dependencies import get_current_user, get_current_company
from services.pdf_generator import (
    generate_invoice_pdf,
    generate_quote_pdf,
    generate_delivery_note_pdf
)

router = APIRouter(prefix="/api/pdf", tags=["PDF Generation"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]


@router.get("/invoice/{invoice_id}")
async def get_invoice_pdf(
    invoice_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Generate and return PDF for an invoice"""
    company = await get_current_company(current_user, company_id)
    
    # Get invoice
    invoice = await db.invoices.find_one({
        "_id": ObjectId(invoice_id),
        "company_id": ObjectId(company_id)
    })
    
    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    
    # Get customer
    customer = {}
    if invoice.get("customer_id"):
        customer = await db.customers.find_one({"_id": invoice["customer_id"]}) or {}
    
    # Get company details
    company_doc = await db.companies.find_one({"_id": ObjectId(company_id)})
    
    # Bank accounts to display in footer (from cash_accounts with show_in_footer)
    bank_accounts_raw = await db.cash_accounts.find({
        "company_id": ObjectId(company_id),
        "show_in_footer": True
    }).to_list(10)
    bank_accounts = [{"bank_name": b.get("bank_name", ""), "rib": b.get("rib", "")} for b in bank_accounts_raw if b.get("bank_name") or b.get("rib")]
    
    # Serialize for PDF
    invoice_data = {
        "number": invoice.get("number", ""),
        "date": invoice.get("date"),
        "due_date": invoice.get("due_date"),
        "status": invoice.get("status", "draft"),
        "items": invoice.get("items", []),
        "subtotal": invoice.get("subtotal", 0),
        "total_discount": invoice.get("total_discount", 0),
        "total_tax": invoice.get("total_tax", 0),
        "fiscal_stamp": invoice.get("fiscal_stamp", 0),
        "total": invoice.get("total", 0),
        "notes": invoice.get("notes", ""),
        "payment_terms": invoice.get("payment_terms", "À réception"),
        "show_bank_details": invoice.get("show_bank_details", True),
    }
    
    customer_data = {
        "display_name": customer.get("display_name", customer.get("name", "")),
        "name": customer.get("name", ""),
        "address": customer.get("address", ""),
        "city": customer.get("city", ""),
        "postal_code": customer.get("postal_code", ""),
        "tax_id": customer.get("tax_id", ""),
    }
    
    company_data = {
        "name": company_doc.get("name", ""),
        "address": company_doc.get("address", ""),
        "city": company_doc.get("city", ""),
        "postal_code": company_doc.get("postal_code", ""),
        "phone": company_doc.get("phone", ""),
        "email": company_doc.get("email", ""),
        "tax_id": company_doc.get("tax_id", ""),
        "legal_form": company_doc.get("legal_form", ""),
        "capital": company_doc.get("capital", ""),
        "rc_number": company_doc.get("rc_number", ""),
        "bank_accounts": bank_accounts if bank_accounts else [{"bank_name": company_doc.get("bank_name", ""), "rib": company_doc.get("bank_rib", "") or company_doc.get("bank_iban", "")}],
    }
    
    # Generate PDF
    pdf_bytes = generate_invoice_pdf(invoice_data, company_data, customer_data)
    
    # Return as streaming response
    filename = f"Facture_{invoice.get('number', 'N')}.pdf"
    
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Length": str(len(pdf_bytes))
        }
    )


@router.get("/quote/{quote_id}")
async def get_quote_pdf(
    quote_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Generate and return PDF for a quote"""
    company = await get_current_company(current_user, company_id)
    
    # Get quote
    quote = await db.quotes.find_one({
        "_id": ObjectId(quote_id),
        "company_id": ObjectId(company_id)
    })
    
    if not quote:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quote not found")
    
    # Get customer
    customer = {}
    if quote.get("customer_id"):
        customer = await db.customers.find_one({"_id": quote["customer_id"]}) or {}
    
    # Get company details
    company_doc = await db.companies.find_one({"_id": ObjectId(company_id)})
    
    # Serialize for PDF
    quote_data = {
        "number": quote.get("number", ""),
        "date": quote.get("date"),
        "valid_until": quote.get("valid_until"),
        "status": quote.get("status", "draft"),
        "items": quote.get("items", []),
        "subtotal": quote.get("subtotal", 0),
        "total_discount": quote.get("total_discount", 0),
        "total_tax": quote.get("total_tax", 0),
        "total": quote.get("total", 0),
        "notes": quote.get("notes", ""),
    }
    
    customer_data = {
        "display_name": customer.get("display_name", customer.get("name", "")),
        "name": customer.get("name", ""),
        "address": customer.get("address", ""),
        "city": customer.get("city", ""),
        "postal_code": customer.get("postal_code", ""),
        "tax_id": customer.get("tax_id", ""),
    }
    
    company_data = {
        "name": company_doc.get("name", ""),
        "address": company_doc.get("address", ""),
        "city": company_doc.get("city", ""),
        "postal_code": company_doc.get("postal_code", ""),
        "phone": company_doc.get("phone", ""),
        "email": company_doc.get("email", ""),
        "tax_id": company_doc.get("tax_id", ""),
        "legal_form": company_doc.get("legal_form", ""),
        "capital": company_doc.get("capital", ""),
        "rc_number": company_doc.get("rc_number", ""),
    }
    
    # Generate PDF
    pdf_bytes = generate_quote_pdf(quote_data, company_data, customer_data)
    
    # Return as streaming response
    filename = f"Devis_{quote.get('number', 'N')}.pdf"
    
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Length": str(len(pdf_bytes))
        }
    )


@router.get("/delivery-note/{delivery_id}")
async def get_delivery_note_pdf(
    delivery_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Generate and return PDF for a delivery note"""
    company = await get_current_company(current_user, company_id)
    
    # Get delivery note
    delivery = await db.delivery_notes.find_one({
        "_id": ObjectId(delivery_id),
        "company_id": ObjectId(company_id)
    })
    
    if not delivery:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery note not found")
    
    # Get customer
    customer = {}
    if delivery.get("customer_id"):
        customer = await db.customers.find_one({"_id": delivery["customer_id"]}) or {}
    
    # Get company details
    company_doc = await db.companies.find_one({"_id": ObjectId(company_id)})
    
    # Serialize for PDF
    delivery_data = {
        "number": delivery.get("number", ""),
        "date": delivery.get("date"),
        "status": delivery.get("status", "draft"),
        "items": delivery.get("items", []),
        "shipping_address": delivery.get("shipping_address", ""),
        "delivery_person": delivery.get("delivery_person", ""),
        "delivered_at": delivery.get("delivered_at"),
        "notes": delivery.get("notes", ""),
    }
    
    customer_data = {
        "display_name": customer.get("display_name", customer.get("name", "")),
        "name": customer.get("name", ""),
        "address": customer.get("address", ""),
        "city": customer.get("city", ""),
        "postal_code": customer.get("postal_code", ""),
    }
    
    company_data = {
        "name": company_doc.get("name", ""),
        "address": company_doc.get("address", ""),
        "city": company_doc.get("city", ""),
        "postal_code": company_doc.get("postal_code", ""),
        "phone": company_doc.get("phone", ""),
        "tax_id": company_doc.get("tax_id", ""),
    }
    
    # Generate PDF
    pdf_bytes = generate_delivery_note_pdf(delivery_data, company_data, customer_data)
    
    # Return as streaming response
    filename = f"BL_{delivery.get('number', 'N')}.pdf"
    
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Length": str(len(pdf_bytes))
        }
    )
