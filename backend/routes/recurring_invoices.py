from fastapi import APIRouter, HTTPException, status, Depends
from bson import ObjectId
from datetime import datetime
from typing import List
import os
from motor.motor_asyncio import AsyncIOMotorClient
from services.recurring_invoice_service import recurring_invoice_service
from utils.dependencies import get_current_user

router = APIRouter(prefix="/api/recurring-invoices", tags=["Recurring Invoices"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]


@router.get("/")
async def list_recurring_invoices(
    company_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all recurring invoice templates for a company"""
    try:
        cursor = db.invoices.find({
            "company_id": ObjectId(company_id),
            "is_recurring": True
        }).sort("created_at", -1)
        
        invoices = await cursor.to_list(length=None)
        
        # Convert ObjectId to string for JSON serialization
        for invoice in invoices:
            invoice["_id"] = str(invoice["_id"])
            invoice["company_id"] = str(invoice["company_id"])
            invoice["customer_id"] = str(invoice["customer_id"])
            if invoice.get("created_by"):
                invoice["created_by"] = str(invoice["created_by"])
        
        return {"invoices": invoices, "count": len(invoices)}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching recurring invoices: {str(e)}"
        )


@router.get("/{invoice_id}")
async def get_recurring_invoice(
    invoice_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific recurring invoice template"""
    try:
        invoice = await db.invoices.find_one({
            "_id": ObjectId(invoice_id),
            "is_recurring": True
        })
        
        if not invoice:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Recurring invoice not found"
            )
        
        # Convert ObjectId to string
        invoice["_id"] = str(invoice["_id"])
        invoice["company_id"] = str(invoice["company_id"])
        invoice["customer_id"] = str(invoice["customer_id"])
        if invoice.get("created_by"):
            invoice["created_by"] = str(invoice["created_by"])
        
        return invoice
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching recurring invoice: {str(e)}"
        )


@router.get("/{invoice_id}/history")
async def get_recurring_invoice_history(
    invoice_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all invoices generated from a recurring template"""
    try:
        invoices = await recurring_invoice_service.get_recurring_invoice_history(invoice_id)
        
        # Convert ObjectId to string
        for invoice in invoices:
            invoice["_id"] = str(invoice["_id"])
            invoice["company_id"] = str(invoice["company_id"])
            invoice["customer_id"] = str(invoice["customer_id"])
            if invoice.get("created_by"):
                invoice["created_by"] = str(invoice["created_by"])
            if invoice.get("parent_recurring_invoice_id"):
                invoice["parent_recurring_invoice_id"] = str(invoice["parent_recurring_invoice_id"])
        
        return {"invoices": invoices, "count": len(invoices)}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching invoice history: {str(e)}"
        )


@router.post("/{invoice_id}/cancel")
async def cancel_recurring_invoice(
    invoice_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Cancel a recurring invoice (stop generating new invoices)"""
    try:
        success = await recurring_invoice_service.cancel_recurring_invoice(invoice_id)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Recurring invoice not found"
            )
        
        return {"message": "Recurring invoice cancelled successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error cancelling recurring invoice: {str(e)}"
        )


@router.post("/{invoice_id}/generate-now")
async def generate_invoice_now(
    invoice_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Manually trigger generation of next invoice from recurring template"""
    try:
        # Get template
        template = await db.invoices.find_one({
            "_id": ObjectId(invoice_id),
            "is_recurring": True
        })
        
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Recurring invoice template not found"
            )
        
        # Generate invoice
        new_invoice = await recurring_invoice_service.generate_next_invoice(template)
        
        if not new_invoice:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to generate invoice"
            )
        
        # Convert ObjectId to string
        new_invoice["_id"] = str(new_invoice["_id"])
        new_invoice["company_id"] = str(new_invoice["company_id"])
        new_invoice["customer_id"] = str(new_invoice["customer_id"])
        if new_invoice.get("created_by"):
            new_invoice["created_by"] = str(new_invoice["created_by"])
        if new_invoice.get("parent_recurring_invoice_id"):
            new_invoice["parent_recurring_invoice_id"] = str(new_invoice["parent_recurring_invoice_id"])
        
        return {
            "message": "Invoice generated successfully",
            "invoice": new_invoice
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating invoice: {str(e)}"
        )


@router.post("/process")
async def process_recurring_invoices_manually(
    current_user: dict = Depends(get_current_user)
):
    """
    Manually trigger processing of all due recurring invoices
    (Normally run by cron job)
    """
    try:
        result = await recurring_invoice_service.process_recurring_invoices()
        
        return {
            "message": "Recurring invoices processed successfully",
            "result": result
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing recurring invoices: {str(e)}"
        )
