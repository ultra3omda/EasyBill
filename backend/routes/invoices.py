from fastapi import APIRouter, HTTPException, status, Depends, Query, Request
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime, timezone
import os
from typing import Optional
from models.invoice import Invoice, InvoiceCreate, InvoiceUpdate
from utils.dependencies import get_current_user, get_current_company
from utils.helpers import generate_document_number, calculate_document_totals

router = APIRouter(prefix="/api/invoices", tags=["Invoices"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]


def serialize_invoice(inv: dict) -> dict:
    """Serialize invoice document for JSON response."""
    return {
        "id": str(inv["_id"]),
        "company_id": str(inv.get("company_id")) if inv.get("company_id") else None,
        "customer_id": str(inv.get("customer_id")) if inv.get("customer_id") else None,
        "customer_name": inv.get("customer_name", ""),
        "number": inv.get("number"),
        "date": inv["date"].isoformat() if isinstance(inv.get("date"), datetime) else inv.get("date"),
        "due_date": inv["due_date"].isoformat() if isinstance(inv.get("due_date"), datetime) else inv.get("due_date"),
        "subject": inv.get("subject"),
        "items": inv.get("items", []),
        "subtotal": inv.get("subtotal", 0),
        "total_tax": inv.get("total_tax", 0),
        "total_discount": inv.get("total_discount", 0),
        "total": inv.get("total", 0),
        "amount_paid": inv.get("amount_paid", 0),
        "balance_due": inv.get("balance_due", 0),
        "status": inv.get("status", "draft"),
        "notes": inv.get("notes"),
        "payment_terms": inv.get("payment_terms"),
        "created_at": inv["created_at"].isoformat() if isinstance(inv.get("created_at"), datetime) else inv.get("created_at"),
        "updated_at": inv["updated_at"].isoformat() if isinstance(inv.get("updated_at"), datetime) else inv.get("updated_at")
    }


async def log_invoice_action(company_id, user_id, user_name, action, element, ip_address=None):
    """Log invoice action."""
    await db.access_logs.insert_one({
        "company_id": ObjectId(company_id),
        "user_id": ObjectId(user_id),
        "user_name": user_name,
        "category": "Facture",
        "action": action,
        "element": element,
        "ip_address": ip_address,
        "created_at": datetime.now(timezone.utc)
    })


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_invoice(
    invoice_data: InvoiceCreate,
    request: Request,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    # Get numbering settings with defaults
    numbering = company.get("numbering", {})
    invoice_prefix = numbering.get("invoice_prefix", "FAC")
    invoice_next = numbering.get("invoice_next", 1)
    
    # Generate invoice number
    invoice_number = generate_document_number(
        invoice_prefix,
        invoice_next,
        datetime.now().year
    )
    
    # Calculate totals
    items = [item.dict() for item in invoice_data.items]
    totals = calculate_document_totals(items)
    
    invoice_dict = invoice_data.dict(exclude={'items'})
    
    # Convert date strings to datetime if needed
    if isinstance(invoice_dict.get('date'), str):
        invoice_dict['date'] = datetime.fromisoformat(invoice_dict['date'].replace('Z', '+00:00'))
    if isinstance(invoice_dict.get('due_date'), str):
        invoice_dict['due_date'] = datetime.fromisoformat(invoice_dict['due_date'].replace('Z', '+00:00'))
    
    invoice_dict.update({
        "company_id": ObjectId(company_id),
        "customer_id": ObjectId(invoice_data.customer_id),
        "number": invoice_number,
        "items": items,
        **totals,
        "amount_paid": 0.0,
        "balance_due": totals["total"],
        "status": "draft",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "created_by": current_user["_id"]
    })
    
    result = await db.invoices.insert_one(invoice_dict)
    
    # Update company numbering
    await db.companies.update_one(
        {"_id": ObjectId(company_id)},
        {"$inc": {"numbering.invoice_next": 1}}
    )
    
    # Update customer stats
    await db.customers.update_one(
        {"_id": ObjectId(invoice_data.customer_id)},
        {
            "$inc": {
                "invoice_count": 1,
                "total_invoiced": totals["total"],
                "balance": totals["total"]
            }
        }
    )
    
    # Log action
    await log_invoice_action(
        company_id, str(current_user["_id"]), current_user.get("full_name", ""),
        "Créer", invoice_number, request.client.host if request.client else None
    )
    
    return {"id": str(result.inserted_id), "number": invoice_number, "message": "Invoice created successfully"}

@router.get("/")
async def list_invoices(
    company_id: str = Query(...),
    search: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    query = {"company_id": ObjectId(company_id)}
    if search:
        query["$or"] = [
            {"number": {"$regex": search, "$options": "i"}},
            {"subject": {"$regex": search, "$options": "i"}}
        ]
    if status_filter:
        query["status"] = status_filter
    
    invoices = await db.invoices.find(query).sort("created_at", -1).to_list(1000)
    
    # Populate customer names
    for invoice in invoices:
        if invoice.get("customer_id"):
            customer = await db.customers.find_one({"_id": invoice["customer_id"]})
            invoice["customer_name"] = customer.get("display_name", "Inconnu") if customer else "Inconnu"
        else:
            invoice["customer_name"] = "Inconnu"
    
    return [serialize_invoice(inv) for inv in invoices]


@router.get("/{invoice_id}")
async def get_invoice(
    invoice_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    invoice = await db.invoices.find_one({
        "_id": ObjectId(invoice_id),
        "company_id": ObjectId(company_id)
    })
    
    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    
    # Populate customer details
    if invoice.get("customer_id"):
        customer = await db.customers.find_one({"_id": invoice["customer_id"]})
        if customer:
            invoice["customer_name"] = customer.get("display_name", "")
            invoice["customer"] = {
                "id": str(customer["_id"]),
                "display_name": customer.get("display_name"),
                "email": customer.get("email"),
                "phone": customer.get("phone"),
                "address": customer.get("billing_address")
            }
    
    return serialize_invoice(invoice)


@router.put("/{invoice_id}")
async def update_invoice(
    invoice_id: str,
    invoice_update: InvoiceUpdate,
    request: Request,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    # Get existing invoice for logging
    existing = await db.invoices.find_one({"_id": ObjectId(invoice_id)})
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    
    update_data = {k: v for k, v in invoice_update.dict(exclude_unset=True).items()}
    
    # Recalculate totals if items updated
    if 'items' in update_data and update_data['items']:
        items = [item.dict() if hasattr(item, 'dict') else item for item in update_data['items']]
        totals = calculate_document_totals(items)
        update_data.update(totals)
        update_data['items'] = items
        current_paid = existing.get('amount_paid', 0)
        update_data['balance_due'] = totals['total'] - current_paid
    
    # Handle customer_id update
    if 'customer_id' in update_data and update_data['customer_id']:
        update_data['customer_id'] = ObjectId(update_data['customer_id'])
    
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    result = await db.invoices.update_one(
        {"_id": ObjectId(invoice_id), "company_id": ObjectId(company_id)},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    
    # Log action
    await log_invoice_action(
        company_id, str(current_user["_id"]), current_user.get("full_name", ""),
        "Modifier", existing.get("number", ""), request.client.host if request.client else None
    )
    
    return {"message": "Invoice updated successfully"}


@router.delete("/{invoice_id}")
async def delete_invoice(
    invoice_id: str,
    request: Request,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    # Get invoice before deletion for stats update and logging
    invoice = await db.invoices.find_one({
        "_id": ObjectId(invoice_id),
        "company_id": ObjectId(company_id)
    })
    
    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    
    result = await db.invoices.delete_one({
        "_id": ObjectId(invoice_id),
        "company_id": ObjectId(company_id)
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    
    # Update customer stats if customer exists
    if invoice.get("customer_id"):
        await db.customers.update_one(
            {"_id": invoice["customer_id"]},
            {
                "$inc": {
                    "invoice_count": -1,
                    "total_invoiced": -invoice.get("total", 0),
                    "balance": -invoice.get("balance_due", 0)
                }
            }
        )
    
    # Log action
    await log_invoice_action(
        company_id, str(current_user["_id"]), current_user.get("full_name", ""),
        "Supprimer", invoice.get("number", ""), request.client.host if request.client else None
    )
    
    return {"message": "Invoice deleted successfully"}


@router.post("/{invoice_id}/send")
async def send_invoice(
    invoice_id: str,
    request: Request,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Mark invoice as sent and update stock."""
    company = await get_current_company(current_user, company_id)
    
    invoice = await db.invoices.find_one({
        "_id": ObjectId(invoice_id),
        "company_id": ObjectId(company_id)
    })
    
    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    
    # Only update stock if going from draft to sent
    if invoice.get("status") == "draft":
        # Get default warehouse
        warehouse = await db.warehouses.find_one({"company_id": ObjectId(company_id), "is_default": True})
        if not warehouse:
            warehouse = await db.warehouses.find_one({"company_id": ObjectId(company_id)})
        
        if warehouse:
            # Decrement stock for each item
            for item in invoice.get("items", []):
                product_id = item.get("product_id")
                if product_id:
                    # Get current product stock
                    product = await db.products.find_one({"_id": ObjectId(product_id)})
                    if product and product.get("type") != "service":
                        current_stock = product.get("quantity_in_stock", 0)
                        qty = item.get("quantity", 0)
                        new_stock = max(0, current_stock - qty)
                        
                        # Create stock movement
                        await db.stock_movements.insert_one({
                            "company_id": ObjectId(company_id),
                            "product_id": ObjectId(product_id),
                            "product_name": product.get("name"),
                            "warehouse_id": warehouse["_id"],
                            "warehouse_name": warehouse.get("name"),
                            "type": "out",
                            "quantity": qty,
                            "unit_cost": product.get("purchase_price", 0),
                            "total_value": qty * product.get("purchase_price", 0),
                            "reason": "Vente",
                            "reference": invoice.get("number"),
                            "stock_before": current_stock,
                            "stock_after": new_stock,
                            "created_at": datetime.now(timezone.utc),
                            "created_by": current_user["_id"],
                            "created_by_name": current_user.get("full_name", "")
                        })
                        
                        # Update product stock
                        await db.products.update_one(
                            {"_id": ObjectId(product_id)},
                            {"$set": {"quantity_in_stock": new_stock, "updated_at": datetime.now(timezone.utc)}}
                        )
    
    await db.invoices.update_one(
        {"_id": ObjectId(invoice_id)},
        {
            "$set": {
                "status": "sent",
                "sent_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    await log_invoice_action(
        company_id, str(current_user["_id"]), current_user.get("full_name", ""),
        "Envoyer", invoice.get("number", ""), request.client.host if request.client else None
    )
    
    return {"message": "Invoice marked as sent and stock updated"}


@router.post("/{invoice_id}/mark-paid")
async def mark_invoice_paid(
    invoice_id: str,
    request: Request,
    company_id: str = Query(...),
    amount: Optional[float] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """Mark invoice as paid (fully or partially)."""
    company = await get_current_company(current_user, company_id)
    
    invoice = await db.invoices.find_one({
        "_id": ObjectId(invoice_id),
        "company_id": ObjectId(company_id)
    })
    
    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    
    payment_amount = amount if amount is not None else invoice.get("balance_due", 0)
    new_amount_paid = invoice.get("amount_paid", 0) + payment_amount
    new_balance = invoice.get("total", 0) - new_amount_paid
    
    new_status = "paid" if new_balance <= 0 else "partial"
    
    await db.invoices.update_one(
        {"_id": ObjectId(invoice_id)},
        {
            "$set": {
                "amount_paid": new_amount_paid,
                "balance_due": max(0, new_balance),
                "status": new_status,
                "paid_at": datetime.now(timezone.utc) if new_status == "paid" else None,
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    # Update customer balance
    if invoice.get("customer_id"):
        await db.customers.update_one(
            {"_id": invoice["customer_id"]},
            {
                "$inc": {
                    "total_paid": payment_amount,
                    "balance": -payment_amount
                }
            }
        )
    
    await log_invoice_action(
        company_id, str(current_user["_id"]), current_user.get("full_name", ""),
        "Paiement", f"{invoice.get('number', '')} - {payment_amount} TND",
        request.client.host if request.client else None
    )
    
    return {"message": "Payment recorded", "new_status": new_status, "balance_due": max(0, new_balance)}