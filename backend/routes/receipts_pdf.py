"""
Routes API pour la Génération de Reçus PDF
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import StreamingResponse
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime
from typing import Optional
import os
import io
import logging

from services.receipt_pdf_service import ReceiptPDFService
from utils.dependencies import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/receipts-pdf", tags=["Receipts PDF"])

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'easybill')]


@router.get("/payment/{payment_id}")
async def generate_payment_receipt_pdf(
    payment_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Génère un reçu PDF pour un paiement client
    """
    
    try:
        service = ReceiptPDFService(db)
        pdf_content = await service.generate_payment_receipt(payment_id, company_id)
        
        # Créer le nom du fichier
        payment = await db.payments.find_one({"_id": ObjectId(payment_id)})
        reference = payment.get("reference", payment_id[-8:]) if payment else payment_id[-8:]
        filename = f"recu_paiement_{reference}_{datetime.now().strftime('%Y%m%d')}.pdf"
        
        return StreamingResponse(
            io.BytesIO(pdf_content),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
    
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Erreur génération reçu PDF: {str(e)}")
        raise HTTPException(status_code=500, detail="Erreur lors de la génération du reçu")


@router.get("/supplier-payment/{payment_id}")
async def generate_supplier_payment_receipt_pdf(
    payment_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Génère un reçu PDF pour un paiement fournisseur
    """
    
    try:
        service = ReceiptPDFService(db)
        pdf_content = await service.generate_supplier_payment_receipt(payment_id, company_id)
        
        payment = await db.supplier_payments.find_one({"_id": ObjectId(payment_id)})
        reference = payment.get("reference", payment_id[-8:]) if payment else payment_id[-8:]
        filename = f"ordre_paiement_{reference}_{datetime.now().strftime('%Y%m%d')}.pdf"
        
        return StreamingResponse(
            io.BytesIO(pdf_content),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
    
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Erreur génération ordre de paiement PDF: {str(e)}")
        raise HTTPException(status_code=500, detail="Erreur lors de la génération de l'ordre de paiement")


@router.get("/preview/payment/{payment_id}")
async def preview_payment_receipt(
    payment_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Prévisualise un reçu de paiement (retourne le PDF inline)
    """
    
    try:
        service = ReceiptPDFService(db)
        pdf_content = await service.generate_payment_receipt(payment_id, company_id)
        
        return StreamingResponse(
            io.BytesIO(pdf_content),
            media_type="application/pdf",
            headers={
                "Content-Disposition": "inline"
            }
        )
    
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Erreur prévisualisation reçu: {str(e)}")
        raise HTTPException(status_code=500, detail="Erreur lors de la prévisualisation")
