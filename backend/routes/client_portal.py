from fastapi import APIRouter, HTTPException, status, Query, Depends
from typing import Optional
import logging
from utils.dependencies import get_current_user, get_current_company
from services.client_portal_service import client_portal_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/client-portal", tags=["Client Portal"])


@router.post("/create-access")
async def create_portal_access(
    customer_id: str,
    company_id: str = Query(...),
    expires_in_days: int = Query(90),
    send_email: bool = Query(True),
    current_user: dict = Depends(get_current_user)
):
    """
    Créer un accès portail pour un client
    Génère un lien sécurisé et optionnellement envoie l'email
    """
    company = await get_current_company(current_user, company_id)
    
    try:
        # Créer l'accès portail
        access = await client_portal_service.create_customer_portal_access(
            customer_id=customer_id,
            company_id=company_id,
            expires_in_days=expires_in_days
        )
        
        if not access:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Impossible de créer l'accès portail"
            )
        
        # Envoyer l'email si demandé
        email_sent = False
        if send_email:
            email_sent = await client_portal_service.send_portal_link_email(
                customer_id=customer_id,
                company_id=company_id
            )
        
        return {
            "message": "Accès portail créé avec succès",
            "access_id": access["access_id"],
            "portal_url": access["portal_url"],
            "expires_at": access["expires_at"],
            "email_sent": email_sent
        }
        
    except Exception as e:
        logger.error(f"Erreur création accès portail: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur de création d'accès: {str(e)}"
        )


@router.post("/send-link")
async def send_portal_link(
    customer_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Envoyer (ou renvoyer) le lien du portail client par email
    """
    company = await get_current_company(current_user, company_id)
    
    try:
        success = await client_portal_service.send_portal_link_email(
            customer_id=customer_id,
            company_id=company_id
        )
        
        if success:
            return {"message": "Email envoyé avec succès"}
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Erreur d'envoi de l'email"
            )
        
    except Exception as e:
        logger.error(f"Erreur envoi lien portail: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur d'envoi: {str(e)}"
        )


@router.post("/revoke-access")
async def revoke_portal_access(
    customer_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Révoquer l'accès portail d'un client
    """
    company = await get_current_company(current_user, company_id)
    
    try:
        success = await client_portal_service.revoke_portal_access(
            customer_id=customer_id,
            company_id=company_id
        )
        
        if success:
            return {"message": "Accès portail révoqué avec succès"}
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Aucun accès portail trouvé pour ce client"
            )
        
    except Exception as e:
        logger.error(f"Erreur révocation accès portail: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur de révocation: {str(e)}"
        )


# Routes publiques (sans authentification)

@router.get("/verify/{token}")
async def verify_portal_token(token: str):
    """
    Vérifier un token de portail et retourner les informations d'accès
    Route publique
    """
    
    try:
        access_info = await client_portal_service.verify_portal_token(token)
        
        if not access_info:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token invalide ou expiré"
            )
        
        return access_info
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur vérification token portail: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur de vérification"
        )


@router.get("/invoices/{token}")
async def get_portal_invoices(token: str):
    """
    Récupérer les factures d'un client via le portail
    Route publique
    """
    
    try:
        # Vérifier le token
        access_info = await client_portal_service.verify_portal_token(token)
        
        if not access_info:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token invalide ou expiré"
            )
        
        # Récupérer les factures
        invoices = await client_portal_service.get_customer_invoices(
            customer_id=access_info["customer_id"],
            company_id=access_info["company_id"]
        )
        
        return {
            "invoices": invoices,
            "customer": access_info["customer"],
            "company": access_info["company"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur récupération factures portail: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur de récupération des factures"
        )


@router.get("/quotes/{token}")
async def get_portal_quotes(token: str):
    """
    Récupérer les devis d'un client via le portail
    Route publique
    """
    
    try:
        # Vérifier le token
        access_info = await client_portal_service.verify_portal_token(token)
        
        if not access_info:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token invalide ou expiré"
            )
        
        # Récupérer les devis
        quotes = await client_portal_service.get_customer_quotes(
            customer_id=access_info["customer_id"],
            company_id=access_info["company_id"]
        )
        
        return {
            "quotes": quotes,
            "customer": access_info["customer"],
            "company": access_info["company"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur récupération devis portail: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur de récupération des devis"
        )


@router.get("/payments/{token}")
async def get_portal_payments(token: str):
    """
    Récupérer les paiements d'un client via le portail
    Route publique
    """
    
    try:
        # Vérifier le token
        access_info = await client_portal_service.verify_portal_token(token)
        
        if not access_info:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token invalide ou expiré"
            )
        
        # Récupérer les paiements
        payments = await client_portal_service.get_customer_payments(
            customer_id=access_info["customer_id"],
            company_id=access_info["company_id"]
        )
        
        return {
            "payments": payments,
            "customer": access_info["customer"],
            "company": access_info["company"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur récupération paiements portail: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur de récupération des paiements"
        )


@router.get("/dashboard/{token}")
async def get_portal_dashboard(token: str):
    """
    Récupérer le tableau de bord complet du portail client
    Route publique
    """
    
    try:
        # Vérifier le token
        access_info = await client_portal_service.verify_portal_token(token)
        
        if not access_info:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token invalide ou expiré"
            )
        
        customer_id = access_info["customer_id"]
        company_id = access_info["company_id"]
        
        # Récupérer toutes les données
        invoices = await client_portal_service.get_customer_invoices(customer_id, company_id)
        quotes = await client_portal_service.get_customer_quotes(customer_id, company_id)
        payments = await client_portal_service.get_customer_payments(customer_id, company_id)
        
        # Calculer les statistiques
        total_invoices = len(invoices)
        total_quotes = len(quotes)
        total_payments = len(payments)
        
        pending_invoices = [inv for inv in invoices if inv["status"] in ["sent", "partial", "overdue"]]
        paid_invoices = [inv for inv in invoices if inv["status"] == "paid"]
        
        total_due = sum(inv["balance_due"] for inv in pending_invoices)
        total_paid = sum(inv["amount_paid"] for inv in invoices)
        
        return {
            "customer": access_info["customer"],
            "company": access_info["company"],
            "statistics": {
                "total_invoices": total_invoices,
                "total_quotes": total_quotes,
                "total_payments": total_payments,
                "pending_invoices": len(pending_invoices),
                "paid_invoices": len(paid_invoices),
                "total_due": total_due,
                "total_paid": total_paid
            },
            "recent_invoices": invoices[:5],  # 5 dernières factures
            "recent_payments": payments[:5],  # 5 derniers paiements
            "pending_quotes": [q for q in quotes if q["status"] == "sent"][:3]  # 3 devis en attente
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur récupération dashboard portail: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur de récupération du dashboard"
        )
