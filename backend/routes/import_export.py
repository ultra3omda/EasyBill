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
import logging

from services.import_export_service import ImportExportService
from utils.dependencies import get_current_user

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
