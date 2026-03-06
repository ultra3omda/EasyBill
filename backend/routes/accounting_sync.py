from fastapi import APIRouter, HTTPException, status, Query, Depends
from typing import Optional
import logging
from utils.dependencies import get_current_user, get_current_company
from services.accounting_sync_service import accounting_sync_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/accounting-sync", tags=["Accounting Sync"])


@router.post("/sync-invoice/{invoice_id}")
async def sync_invoice(
    invoice_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Synchroniser manuellement une facture client"""
    company = await get_current_company(current_user, company_id)
    
    try:
        entry_id = await accounting_sync_service.sync_invoice(invoice_id)
        
        if entry_id:
            return {
                "message": "Facture synchronisée avec succès",
                "entry_id": entry_id
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Impossible de synchroniser la facture (statut invalide ou déjà synchronisée)"
            )
    except Exception as e:
        logger.error(f"Erreur sync facture {invoice_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur de synchronisation: {str(e)}"
        )


@router.post("/sync-payment/{payment_id}")
async def sync_payment(
    payment_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Synchroniser manuellement un paiement client"""
    company = await get_current_company(current_user, company_id)
    
    try:
        entry_id = await accounting_sync_service.sync_payment(payment_id)
        
        if entry_id:
            return {
                "message": "Paiement synchronisé avec succès",
                "entry_id": entry_id
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Impossible de synchroniser le paiement (déjà synchronisé)"
            )
    except Exception as e:
        logger.error(f"Erreur sync paiement {payment_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur de synchronisation: {str(e)}"
        )


@router.post("/sync-supplier-invoice/{invoice_id}")
async def sync_supplier_invoice(
    invoice_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Synchroniser manuellement une facture fournisseur"""
    company = await get_current_company(current_user, company_id)
    
    try:
        entry_id = await accounting_sync_service.sync_supplier_invoice(invoice_id)
        
        if entry_id:
            return {
                "message": "Facture fournisseur synchronisée avec succès",
                "entry_id": entry_id
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Impossible de synchroniser la facture (statut invalide ou déjà synchronisée)"
            )
    except Exception as e:
        logger.error(f"Erreur sync facture fournisseur {invoice_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur de synchronisation: {str(e)}"
        )


@router.post("/sync-supplier-payment/{payment_id}")
async def sync_supplier_payment(
    payment_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Synchroniser manuellement un paiement fournisseur"""
    company = await get_current_company(current_user, company_id)
    
    try:
        entry_id = await accounting_sync_service.sync_supplier_payment(payment_id)
        
        if entry_id:
            return {
                "message": "Paiement fournisseur synchronisé avec succès",
                "entry_id": entry_id
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Impossible de synchroniser le paiement (déjà synchronisé)"
            )
    except Exception as e:
        logger.error(f"Erreur sync paiement fournisseur {payment_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur de synchronisation: {str(e)}"
        )


@router.post("/sync-stock-movement/{movement_id}")
async def sync_stock_movement(
    movement_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Synchroniser manuellement un mouvement de stock"""
    company = await get_current_company(current_user, company_id)
    
    try:
        entry_id = await accounting_sync_service.sync_stock_movement(movement_id)
        
        if entry_id:
            return {
                "message": "Mouvement de stock synchronisé avec succès",
                "entry_id": entry_id
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Impossible de synchroniser le mouvement (déjà synchronisé ou sans valeur)"
            )
    except Exception as e:
        logger.error(f"Erreur sync mouvement stock {movement_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur de synchronisation: {str(e)}"
        )


@router.post("/sync-credit-note/{credit_note_id}")
async def sync_credit_note(
    credit_note_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Synchroniser manuellement un avoir client"""
    company = await get_current_company(current_user, company_id)
    
    try:
        entry_id = await accounting_sync_service.sync_credit_note(credit_note_id)
        
        if entry_id:
            return {
                "message": "Avoir synchronisé avec succès",
                "entry_id": entry_id
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Impossible de synchroniser l'avoir (statut invalide ou déjà synchronisé)"
            )
    except Exception as e:
        logger.error(f"Erreur sync avoir {credit_note_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur de synchronisation: {str(e)}"
        )


@router.post("/resync-all")
async def resync_all(
    company_id: str = Query(...),
    document_type: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """
    Re-synchroniser tous les documents d'une entreprise
    
    document_type: invoices, payments, supplier_invoices, supplier_payments, stock_movements, credit_notes
    Si non spécifié, tous les types sont re-synchronisés
    """
    company = await get_current_company(current_user, company_id)
    
    try:
        results = await accounting_sync_service.resync_all_documents(company_id, document_type)
        
        total_synced = sum(r["synced"] for r in results.values())
        total_errors = sum(r["errors"] for r in results.values())
        total_docs = sum(r["total"] for r in results.values())
        
        return {
            "message": f"Re-synchronisation terminée: {total_synced}/{total_docs} documents synchronisés, {total_errors} erreurs",
            "results": results,
            "summary": {
                "total": total_docs,
                "synced": total_synced,
                "errors": total_errors
            }
        }
    except Exception as e:
        logger.error(f"Erreur re-synchronisation entreprise {company_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur de re-synchronisation: {str(e)}"
        )
