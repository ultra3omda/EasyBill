"""
Routes API pour la Signature Électronique
"""

from fastapi import APIRouter, HTTPException, Depends, Query, Request
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime
from typing import Optional
from pydantic import BaseModel
import os
import logging

from services.signature_service import SignatureService
from utils.dependencies import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/signatures", tags=["Signatures"])

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'easybill')]


class SignatureRequestCreate(BaseModel):
    document_type: str  # delivery_note, quote
    document_id: str
    signer_name: str
    signer_email: Optional[str] = None
    signer_phone: Optional[str] = None
    expires_in_hours: int = 72


class SignatureSubmit(BaseModel):
    signature_data: str  # Base64 encoded signature image
    notes: Optional[str] = None


@router.post("/request")
async def create_signature_request(
    request_data: SignatureRequestCreate,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Crée une demande de signature pour un document
    """
    
    # Vérifier que le document existe
    collection_map = {
        "delivery_note": "delivery_notes",
        "quote": "quotes"
    }
    
    collection_name = collection_map.get(request_data.document_type)
    if not collection_name:
        raise HTTPException(status_code=400, detail="Type de document non supporté")
    
    document = await db[collection_name].find_one({
        "_id": ObjectId(request_data.document_id),
        "company_id": ObjectId(company_id)
    })
    
    if not document:
        raise HTTPException(status_code=404, detail="Document non trouvé")
    
    # Vérifier si le document n'est pas déjà signé
    if document.get("signature_status") == "signed":
        raise HTTPException(status_code=400, detail="Ce document est déjà signé")
    
    service = SignatureService(db)
    result = await service.create_signature_request(
        document_type=request_data.document_type,
        document_id=request_data.document_id,
        company_id=company_id,
        signer_name=request_data.signer_name,
        signer_email=request_data.signer_email,
        signer_phone=request_data.signer_phone,
        expires_in_hours=request_data.expires_in_hours
    )
    
    # Générer l'URL complète de signature
    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
    result["full_signature_url"] = f"{frontend_url}/sign/{result['token']}"
    
    return result


@router.get("/verify-token/{token}")
async def verify_signature_token(token: str):
    """
    Vérifie un token de signature (endpoint public)
    """
    
    service = SignatureService(db)
    result = await service.verify_signature_token(token)
    
    if not result:
        raise HTTPException(status_code=404, detail="Token invalide ou expiré")
    
    return result


@router.post("/submit/{token}")
async def submit_signature(
    token: str,
    signature: SignatureSubmit,
    request: Request
):
    """
    Soumet une signature (endpoint public)
    """
    
    # Récupérer les informations du client
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    
    service = SignatureService(db)
    
    try:
        result = await service.submit_signature(
            token=token,
            signature_data=signature.signature_data,
            signer_ip=client_ip,
            signer_user_agent=user_agent,
            notes=signature.notes
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{signature_id}")
async def get_signature(
    signature_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Récupère les détails d'une signature
    """
    
    service = SignatureService(db)
    result = await service.get_signature(signature_id, company_id)
    
    if not result:
        raise HTTPException(status_code=404, detail="Signature non trouvée")
    
    return result


@router.get("/{signature_id}/verify")
async def verify_signature(
    signature_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Vérifie l'authenticité d'une signature
    """
    
    service = SignatureService(db)
    result = await service.verify_signature(signature_id, company_id)
    
    return result


@router.get("/")
async def list_signatures(
    company_id: str = Query(...),
    document_type: Optional[str] = None,
    document_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """
    Liste les signatures d'une entreprise
    """
    
    service = SignatureService(db)
    result = await service.list_signatures(
        company_id=company_id,
        document_type=document_type,
        document_id=document_id,
        skip=skip,
        limit=limit
    )
    
    return result


@router.delete("/request/{request_id}")
async def cancel_signature_request(
    request_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Annule une demande de signature en attente
    """
    
    request = await db.signature_requests.find_one({
        "_id": ObjectId(request_id),
        "company_id": ObjectId(company_id),
        "status": "pending"
    })
    
    if not request:
        raise HTTPException(status_code=404, detail="Demande de signature non trouvée ou déjà traitée")
    
    await db.signature_requests.update_one(
        {"_id": ObjectId(request_id)},
        {"$set": {"status": "cancelled", "cancelled_at": datetime.now()}}
    )
    
    return {"message": "Demande de signature annulée"}
