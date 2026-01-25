import os
from datetime import datetime, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import logging
from typing import List, Dict

logger = logging.getLogger(__name__)

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]


class RecurringInvoiceService:
    """Service for managing recurring invoices"""
    
    @staticmethod
    async def get_due_recurring_invoices() -> List[Dict]:
        """
        Get all recurring invoices that are due for generation
        
        Returns:
            List of invoices that need to be generated
        """
        now = datetime.utcnow()
        
        # Find recurring invoices where next_date is due
        cursor = db.invoices.find({
            "is_recurring": True,
            "recurrence.next_date": {"$lte": now},
            "status": {"$ne": "cancelled"}
        })
        
        invoices = await cursor.to_list(length=None)
        return invoices
    
    @staticmethod
    def calculate_next_date(current_date: datetime, frequency: str, interval: int = 1) -> datetime:
        """
        Calculate the next invoice date based on frequency
        
        Args:
            current_date: Current invoice date
            frequency: daily, weekly, monthly, yearly
            interval: Number of periods (e.g., 2 for bi-monthly)
        
        Returns:
            Next invoice date
        """
        if frequency == "daily":
            return current_date + timedelta(days=interval)
        elif frequency == "weekly":
            return current_date + timedelta(weeks=interval)
        elif frequency == "monthly":
            # Add months (approximate with 30 days, will be refined)
            month = current_date.month + interval
            year = current_date.year + (month - 1) // 12
            month = ((month - 1) % 12) + 1
            try:
                return current_date.replace(year=year, month=month)
            except ValueError:
                # Handle day overflow (e.g., Jan 31 -> Feb 28)
                if month == 2:
                    day = 28 if year % 4 != 0 else 29
                else:
                    day = 30
                return current_date.replace(year=year, month=month, day=day)
        elif frequency == "yearly":
            try:
                return current_date.replace(year=current_date.year + interval)
            except ValueError:
                # Handle Feb 29 on non-leap years
                return current_date.replace(year=current_date.year + interval, day=28)
        else:
            raise ValueError(f"Invalid frequency: {frequency}")
    
    @staticmethod
    async def generate_next_invoice(template_invoice: Dict) -> Dict:
        """
        Generate a new invoice from a recurring template
        
        Args:
            template_invoice: The recurring invoice template
        
        Returns:
            The newly created invoice
        """
        company_id = template_invoice["company_id"]
        
        # Get company for numbering
        company = await db.companies.find_one({"_id": company_id})
        if not company:
            logger.error(f"Company not found: {company_id}")
            return None
        
        # Generate new invoice number
        invoice_prefix = company.get("numbering", {}).get("invoice_prefix", "INV")
        invoice_next = company.get("numbering", {}).get("invoice_next", 1)
        new_number = f"{invoice_prefix}-{invoice_next:04d}"
        
        # Calculate dates
        now = datetime.utcnow()
        recurrence = template_invoice.get("recurrence", {})
        frequency = recurrence.get("frequency", "monthly")
        interval = recurrence.get("interval", 1)
        
        # Calculate due date (same offset as original)
        original_date = template_invoice["date"]
        original_due_date = template_invoice["due_date"]
        due_offset = (original_due_date - original_date).days
        new_due_date = now + timedelta(days=due_offset)
        
        # Create new invoice
        new_invoice = {
            "company_id": company_id,
            "number": new_number,
            "date": now,
            "due_date": new_due_date,
            "customer_id": template_invoice["customer_id"],
            "subject": template_invoice.get("subject"),
            "items": template_invoice["items"],
            "subtotal": template_invoice["subtotal"],
            "total_tax": template_invoice["total_tax"],
            "total_discount": template_invoice["total_discount"],
            "total": template_invoice["total"],
            "amount_paid": 0.0,
            "balance_due": template_invoice["total"],
            "payment_terms": template_invoice.get("payment_terms"),
            "notes": template_invoice.get("notes"),
            "language": template_invoice.get("language", "fr"),
            "watermark": template_invoice.get("watermark"),
            "status": "draft",
            "pdf_url": None,
            "attachments": [],
            "sent_at": None,
            "paid_at": None,
            "is_recurring": False,  # Generated invoices are not recurring themselves
            "recurrence": None,
            "quote_id": template_invoice.get("quote_id"),
            "delivery_id": template_invoice.get("delivery_id"),
            "accounting_entry_id": None,
            "created_at": now,
            "updated_at": now,
            "created_by": template_invoice.get("created_by"),
            "parent_recurring_invoice_id": template_invoice["_id"]  # Link to template
        }
        
        # Insert new invoice
        result = await db.invoices.insert_one(new_invoice)
        new_invoice["_id"] = result.inserted_id
        
        # Update company numbering
        await db.companies.update_one(
            {"_id": company_id},
            {"$set": {"numbering.invoice_next": invoice_next + 1}}
        )
        
        # Update template's next_date
        next_date = RecurringInvoiceService.calculate_next_date(now, frequency, interval)
        await db.invoices.update_one(
            {"_id": template_invoice["_id"]},
            {"$set": {
                "recurrence.next_date": next_date,
                "updated_at": now
            }}
        )
        
        logger.info(f"Generated recurring invoice {new_number} from template {template_invoice['number']}")
        
        return new_invoice
    
    @staticmethod
    async def process_recurring_invoices() -> Dict:
        """
        Process all due recurring invoices
        
        Returns:
            Summary of processed invoices
        """
        due_invoices = await RecurringInvoiceService.get_due_recurring_invoices()
        
        generated_count = 0
        failed_count = 0
        generated_invoices = []
        
        for template in due_invoices:
            try:
                new_invoice = await RecurringInvoiceService.generate_next_invoice(template)
                if new_invoice:
                    generated_count += 1
                    generated_invoices.append({
                        "template_id": str(template["_id"]),
                        "template_number": template["number"],
                        "new_id": str(new_invoice["_id"]),
                        "new_number": new_invoice["number"],
                        "customer_id": str(new_invoice["customer_id"]),
                        "total": new_invoice["total"]
                    })
                else:
                    failed_count += 1
            except Exception as e:
                logger.error(f"Failed to generate invoice from template {template['_id']}: {str(e)}")
                failed_count += 1
        
        return {
            "processed_at": datetime.utcnow(),
            "total_due": len(due_invoices),
            "generated": generated_count,
            "failed": failed_count,
            "invoices": generated_invoices
        }
    
    @staticmethod
    async def create_recurring_invoice(invoice_data: Dict) -> Dict:
        """
        Create a new recurring invoice template
        
        Args:
            invoice_data: Invoice data with recurrence settings
        
        Returns:
            Created invoice
        """
        if not invoice_data.get("is_recurring"):
            raise ValueError("Invoice must have is_recurring=True")
        
        recurrence = invoice_data.get("recurrence")
        if not recurrence:
            raise ValueError("Recurrence settings are required")
        
        # Calculate first next_date
        frequency = recurrence.get("frequency")
        interval = recurrence.get("interval", 1)
        
        if not frequency:
            raise ValueError("Frequency is required")
        
        invoice_date = invoice_data.get("date", datetime.utcnow())
        next_date = RecurringInvoiceService.calculate_next_date(invoice_date, frequency, interval)
        
        # Set next_date in recurrence
        invoice_data["recurrence"]["next_date"] = next_date
        
        # Insert invoice
        result = await db.invoices.insert_one(invoice_data)
        invoice_data["_id"] = result.inserted_id
        
        logger.info(f"Created recurring invoice template {invoice_data['number']} with frequency {frequency}")
        
        return invoice_data
    
    @staticmethod
    async def cancel_recurring_invoice(invoice_id: str) -> bool:
        """
        Cancel a recurring invoice (stop generating new invoices)
        
        Args:
            invoice_id: ID of the recurring invoice to cancel
        
        Returns:
            True if cancelled successfully
        """
        result = await db.invoices.update_one(
            {"_id": ObjectId(invoice_id), "is_recurring": True},
            {"$set": {
                "status": "cancelled",
                "updated_at": datetime.utcnow()
            }}
        )
        
        if result.modified_count > 0:
            logger.info(f"Cancelled recurring invoice {invoice_id}")
            return True
        return False
    
    @staticmethod
    async def get_recurring_invoice_history(template_id: str) -> List[Dict]:
        """
        Get all invoices generated from a recurring template
        
        Args:
            template_id: ID of the recurring invoice template
        
        Returns:
            List of generated invoices
        """
        cursor = db.invoices.find({
            "parent_recurring_invoice_id": ObjectId(template_id)
        }).sort("date", -1)
        
        invoices = await cursor.to_list(length=None)
        return invoices


# Create singleton instance
recurring_invoice_service = RecurringInvoiceService()
