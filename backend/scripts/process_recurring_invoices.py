#!/usr/bin/env python3
"""
Script to process recurring invoices
Run this script via cron or scheduler to automatically generate invoices
"""

import asyncio
import sys
import os
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from services.recurring_invoice_service import recurring_invoice_service
from services.email_service import email_service
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]


async def send_invoice_notifications(generated_invoices):
    """Send email notifications for newly generated invoices"""
    for invoice_info in generated_invoices:
        try:
            # Get full invoice details
            invoice = await db.invoices.find_one({"_id": ObjectId(invoice_info["new_id"])})
            if not invoice:
                continue
            
            # Get customer details
            customer = await db.customers.find_one({"_id": invoice["customer_id"]})
            if not customer or not customer.get("email"):
                logger.warning(f"Customer email not found for invoice {invoice['number']}")
                continue
            
            # Get company details
            company = await db.companies.find_one({"_id": invoice["company_id"]})
            if not company:
                continue
            
            # Generate PDF URL (placeholder - implement actual PDF generation)
            pdf_url = f"http://localhost:8000/api/invoices/{invoice_info['new_id']}/pdf"
            
            # Send email
            customer_name = customer.get("display_name") or f"{customer.get('first_name', '')} {customer.get('last_name', '')}".strip()
            
            email_service.send_invoice_email(
                to_email=customer["email"],
                customer_name=customer_name,
                invoice_number=invoice["number"],
                invoice_total=invoice["total"],
                invoice_pdf_url=pdf_url
            )
            
            # Update invoice status to sent
            await db.invoices.update_one(
                {"_id": invoice["_id"]},
                {"$set": {
                    "status": "sent",
                    "sent_at": invoice.get("date")
                }}
            )
            
            logger.info(f"Sent invoice {invoice['number']} to {customer['email']}")
            
        except Exception as e:
            logger.error(f"Failed to send invoice notification: {str(e)}")


async def main():
    """Main function to process recurring invoices"""
    logger.info("Starting recurring invoice processing...")
    
    try:
        # Process recurring invoices
        result = await recurring_invoice_service.process_recurring_invoices()
        
        logger.info(f"Processing complete:")
        logger.info(f"  - Total due: {result['total_due']}")
        logger.info(f"  - Generated: {result['generated']}")
        logger.info(f"  - Failed: {result['failed']}")
        
        # Send email notifications for generated invoices
        if result['invoices']:
            logger.info(f"Sending email notifications for {len(result['invoices'])} invoices...")
            await send_invoice_notifications(result['invoices'])
        
        # Print summary
        if result['generated'] > 0:
            print("\n✅ Generated Invoices:")
            for inv in result['invoices']:
                print(f"  - {inv['new_number']} (from template {inv['template_number']}) - {inv['total']} TND")
        
        if result['failed'] > 0:
            print(f"\n❌ Failed to generate {result['failed']} invoice(s)")
        
        if result['total_due'] == 0:
            print("\n✨ No recurring invoices due at this time")
        
        return 0
        
    except Exception as e:
        logger.error(f"Error processing recurring invoices: {str(e)}", exc_info=True)
        return 1
    finally:
        client.close()


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
