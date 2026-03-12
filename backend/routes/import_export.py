"""
Routes API pour l'Import/Export de Contacts
"""

from fastapi import APIRouter, HTTPException, Depends, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime
from typing import Optional
import os
import io
import csv
import logging

from services.import_export_service import ImportExportService
from utils.dependencies import get_current_user, get_current_company

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/import-export", tags=["Import/Export"])

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'easybill')]


@router.post("/customers/import")
async def import_customers(
    file: UploadFile = File(...),
    company_id: str = Query(...),
    update_existing: bool = Query(False, description="Mettre à jour les clients existants"),
    current_user: dict = Depends(get_current_user)
):
    """
    Importe des clients depuis un fichier CSV
    
    Le fichier CSV doit contenir au moins une des colonnes suivantes:
    - company_name / entreprise / société
    - last_name / nom
    
    Colonnes optionnelles:
    - first_name, email, phone, tax_id, address, city, postal_code, country, website, notes
    """
    
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Le fichier doit être au format CSV")
    
    try:
        content = await file.read()
        csv_content = content.decode('utf-8-sig')  # Support BOM
    except UnicodeDecodeError:
        try:
            csv_content = content.decode('latin-1')
        except:
            raise HTTPException(status_code=400, detail="Impossible de lire le fichier. Vérifiez l'encodage (UTF-8 recommandé)")
    
    service = ImportExportService(db)
    results = await service.import_customers_csv(
        csv_content=csv_content,
        company_id=company_id,
        user_id=current_user["id"],
        update_existing=update_existing
    )
    
    return {
        "message": f"Import terminé: {results['created']} créés, {results['updated']} mis à jour, {results['skipped']} ignorés",
        "results": results
    }


@router.post("/suppliers/import")
async def import_suppliers(
    file: UploadFile = File(...),
    company_id: str = Query(...),
    update_existing: bool = Query(False, description="Mettre à jour les fournisseurs existants"),
    current_user: dict = Depends(get_current_user)
):
    """
    Importe des fournisseurs depuis un fichier CSV
    
    Le fichier CSV doit contenir au moins:
    - company_name / entreprise / société
    
    Colonnes optionnelles:
    - contact_name, email, phone, tax_id, address, city, postal_code, country, website, payment_terms, notes
    """
    
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Le fichier doit être au format CSV")
    
    try:
        content = await file.read()
        csv_content = content.decode('utf-8-sig')
    except UnicodeDecodeError:
        try:
            csv_content = content.decode('latin-1')
        except:
            raise HTTPException(status_code=400, detail="Impossible de lire le fichier. Vérifiez l'encodage (UTF-8 recommandé)")
    
    service = ImportExportService(db)
    results = await service.import_suppliers_csv(
        csv_content=csv_content,
        company_id=company_id,
        user_id=current_user["id"],
        update_existing=update_existing
    )
    
    return {
        "message": f"Import terminé: {results['created']} créés, {results['updated']} mis à jour, {results['skipped']} ignorés",
        "results": results
    }


@router.get("/customers/export")
async def export_customers(
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Exporte tous les clients vers un fichier CSV
    """
    
    service = ImportExportService(db)
    csv_content = await service.export_customers_csv(company_id)
    
    # Créer le fichier de réponse
    output = io.BytesIO()
    output.write(csv_content.encode('utf-8-sig'))  # Avec BOM pour Excel
    output.seek(0)
    
    filename = f"clients_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    
    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )


@router.get("/suppliers/export")
async def export_suppliers(
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Exporte tous les fournisseurs vers un fichier CSV
    """
    
    service = ImportExportService(db)
    csv_content = await service.export_suppliers_csv(company_id)
    
    output = io.BytesIO()
    output.write(csv_content.encode('utf-8-sig'))
    output.seek(0)
    
    filename = f"fournisseurs_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    
    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )


@router.get("/customers/template")
async def get_customers_template(
    current_user: dict = Depends(get_current_user)
):
    """
    Télécharge un template CSV pour l'import de clients
    """
    
    service = ImportExportService(db)
    csv_content = service.get_csv_template_customers()
    
    output = io.BytesIO()
    output.write(csv_content.encode('utf-8-sig'))
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=template_clients.csv"
        }
    )


@router.post("/odoo-invoices/import")
async def import_odoo_invoices(
    file: UploadFile = File(...),
    company_id: str = Query(...),
    use_odoo_number: bool = Query(True, description="Conserver les numéros de facture Odoo"),
    default_status: str = Query("sent", description="Statut par défaut (sent, paid, draft)"),
    current_user: dict = Depends(get_current_user)
):
    """
    Importe des factures de vente depuis un export Odoo (CSV).
    Crée automatiquement les clients manquants.
    Colonnes Odoo supportées: Name/Reference, Partner/Client, Date, Due Date,
    Amount Untaxed, Amount Tax, Amount Total, Amount Paid, State, etc.
    """
    await get_current_company(current_user, company_id)
    if not file.filename.lower().endswith('.csv'):
        raise HTTPException(status_code=400, detail="Le fichier doit être au format CSV")
    try:
        content = await file.read()
        csv_content = content.decode('utf-8-sig')
    except UnicodeDecodeError:
        try:
            csv_content = content.decode('latin-1')
        except Exception:
            raise HTTPException(status_code=400, detail="Encodage non supporté. Utilisez UTF-8.")
    service = ImportExportService(db)
    results = await service.import_odoo_invoices_csv(
        csv_content=csv_content,
        company_id=company_id,
        user_id=current_user["id"],
        use_odoo_number=use_odoo_number,
        default_status=default_status
    )
    return {
        "message": f"Import terminé: {results.get('customers_created', 0)} clients créés, "
                   f"{results.get('invoices_created', 0)} factures créées, "
                   f"{results.get('invoices_skipped', 0)} ignorées",
        "results": results
    }


@router.get("/odoo-invoices/template")
async def get_odoo_invoices_template(
    current_user: dict = Depends(get_current_user)
):
    """Télécharge un template CSV pour l'import de factures Odoo"""
    output = io.StringIO()
    fieldnames = [
        "name", "partner_id", "date_invoice", "date_due",
        "amount_untaxed", "amount_tax", "amount_total", "amount_paid", "state",
        "description", "quantity", "price_unit", "price_subtotal"
    ]
    writer = csv.DictWriter(output, fieldnames=fieldnames, delimiter=';')
    writer.writeheader()
    writer.writerow({
        "name": "INV/2024/00001",
        "partner_id": "Client ABC SARL",
        "date_invoice": "2024-01-15",
        "date_due": "2024-02-15",
        "amount_untaxed": "1000.00",
        "amount_tax": "190.00",
        "amount_total": "1190.00",
        "amount_paid": "1190.00",
        "state": "paid",
        "description": "Produit ou service",
        "quantity": "1",
        "price_unit": "1000.00",
        "price_subtotal": "1000.00"
    })
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode('utf-8-sig')),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=template_factures_odoo.csv"}
    )


@router.get("/suppliers/template")
async def get_suppliers_template(
    current_user: dict = Depends(get_current_user)
):
    """
    Télécharge un template CSV pour l'import de fournisseurs
    """
    
    service = ImportExportService(db)
    csv_content = service.get_csv_template_suppliers()
    
    output = io.BytesIO()
    output.write(csv_content.encode('utf-8-sig'))
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=template_fournisseurs.csv"
        }
    )
