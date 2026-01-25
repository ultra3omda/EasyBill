"""
Service de Signature Électronique
Gère les signatures électroniques pour les bons de livraison et autres documents
"""

from datetime import datetime, timezone
from typing import Optional, Dict, Any
from bson import ObjectId
import hashlib
import base64
import logging

logger = logging.getLogger(__name__)


class SignatureService:
    """Service pour gérer les signatures électroniques"""
    
    def __init__(self, db):
        self.db = db
    
    async def create_signature_request(
        self,
        document_type: str,
        document_id: str,
        company_id: str,
        signer_name: str,
        signer_email: Optional[str] = None,
        signer_phone: Optional[str] = None,
        expires_in_hours: int = 72
    ) -> Dict[str, Any]:
        """
        Crée une demande de signature pour un document
        
        Args:
            document_type: Type de document (delivery_note, quote, etc.)
            document_id: ID du document
            company_id: ID de l'entreprise
            signer_name: Nom du signataire
            signer_email: Email du signataire (optionnel)
            signer_phone: Téléphone du signataire (optionnel)
            expires_in_hours: Durée de validité de la demande
            
        Returns:
            Dict avec les détails de la demande de signature
        """
        import secrets
        from datetime import timedelta
        
        # Générer un token unique pour la signature
        signature_token = secrets.token_urlsafe(32)
        
        # Calculer la date d'expiration
        expires_at = datetime.now(timezone.utc) + timedelta(hours=expires_in_hours)
        
        # Créer la demande de signature
        signature_request = {
            "document_type": document_type,
            "document_id": ObjectId(document_id),
            "company_id": ObjectId(company_id),
            "signer_name": signer_name,
            "signer_email": signer_email,
            "signer_phone": signer_phone,
            "token": signature_token,
            "token_hash": hashlib.sha256(signature_token.encode()).hexdigest(),
            "status": "pending",
            "expires_at": expires_at,
            "created_at": datetime.now(timezone.utc)
        }
        
        result = await self.db.signature_requests.insert_one(signature_request)
        
        return {
            "id": str(result.inserted_id),
            "token": signature_token,
            "expires_at": expires_at.isoformat(),
            "signature_url": f"/sign/{signature_token}"
        }
    
    async def verify_signature_token(self, token: str) -> Optional[Dict[str, Any]]:
        """
        Vérifie un token de signature et retourne les détails de la demande
        """
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        
        request = await self.db.signature_requests.find_one({
            "token_hash": token_hash,
            "status": "pending"
        })
        
        if not request:
            return None
        
        # Vérifier l'expiration
        if request.get("expires_at") < datetime.now(timezone.utc):
            await self.db.signature_requests.update_one(
                {"_id": request["_id"]},
                {"$set": {"status": "expired"}}
            )
            return None
        
        # Récupérer le document
        document = None
        if request.get("document_type") == "delivery_note":
            document = await self.db.delivery_notes.find_one({"_id": request["document_id"]})
        elif request.get("document_type") == "quote":
            document = await self.db.quotes.find_one({"_id": request["document_id"]})
        
        # Récupérer l'entreprise
        company = await self.db.companies.find_one({"_id": request["company_id"]})
        
        return {
            "id": str(request["_id"]),
            "document_type": request.get("document_type"),
            "document_id": str(request.get("document_id")),
            "document_number": document.get("number") if document else None,
            "company_name": company.get("name") if company else None,
            "signer_name": request.get("signer_name"),
            "expires_at": request.get("expires_at").isoformat() if request.get("expires_at") else None
        }
    
    async def submit_signature(
        self,
        token: str,
        signature_data: str,
        signer_ip: Optional[str] = None,
        signer_user_agent: Optional[str] = None,
        notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Soumet une signature pour un document
        
        Args:
            token: Token de signature
            signature_data: Données de signature (base64 de l'image de signature)
            signer_ip: Adresse IP du signataire
            signer_user_agent: User-Agent du navigateur
            notes: Notes ou commentaires du signataire
            
        Returns:
            Dict avec les détails de la signature
        """
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        
        request = await self.db.signature_requests.find_one({
            "token_hash": token_hash,
            "status": "pending"
        })
        
        if not request:
            raise ValueError("Demande de signature invalide ou expirée")
        
        # Vérifier l'expiration
        if request.get("expires_at") < datetime.now(timezone.utc):
            await self.db.signature_requests.update_one(
                {"_id": request["_id"]},
                {"$set": {"status": "expired"}}
            )
            raise ValueError("La demande de signature a expiré")
        
        # Générer un hash unique de la signature
        signature_hash = hashlib.sha256(signature_data.encode()).hexdigest()
        
        # Créer l'enregistrement de signature
        signature_record = {
            "request_id": request["_id"],
            "document_type": request.get("document_type"),
            "document_id": request.get("document_id"),
            "company_id": request.get("company_id"),
            "signer_name": request.get("signer_name"),
            "signer_email": request.get("signer_email"),
            "signature_data": signature_data,
            "signature_hash": signature_hash,
            "signer_ip": signer_ip,
            "signer_user_agent": signer_user_agent,
            "notes": notes,
            "signed_at": datetime.now(timezone.utc)
        }
        
        result = await self.db.signatures.insert_one(signature_record)
        
        # Mettre à jour la demande de signature
        await self.db.signature_requests.update_one(
            {"_id": request["_id"]},
            {
                "$set": {
                    "status": "signed",
                    "signature_id": result.inserted_id,
                    "signed_at": datetime.now(timezone.utc)
                }
            }
        )
        
        # Mettre à jour le document avec la signature
        update_data = {
            "signature_id": result.inserted_id,
            "signed_at": datetime.now(timezone.utc),
            "signed_by": request.get("signer_name"),
            "signature_status": "signed"
        }
        
        if request.get("document_type") == "delivery_note":
            await self.db.delivery_notes.update_one(
                {"_id": request["document_id"]},
                {"$set": update_data}
            )
        elif request.get("document_type") == "quote":
            await self.db.quotes.update_one(
                {"_id": request["document_id"]},
                {"$set": update_data}
            )
        
        return {
            "id": str(result.inserted_id),
            "signed_at": signature_record["signed_at"].isoformat(),
            "signature_hash": signature_hash,
            "message": "Document signé avec succès"
        }
    
    async def get_signature(self, signature_id: str, company_id: str) -> Optional[Dict[str, Any]]:
        """
        Récupère les détails d'une signature
        """
        signature = await self.db.signatures.find_one({
            "_id": ObjectId(signature_id),
            "company_id": ObjectId(company_id)
        })
        
        if not signature:
            return None
        
        return {
            "id": str(signature["_id"]),
            "document_type": signature.get("document_type"),
            "document_id": str(signature.get("document_id")),
            "signer_name": signature.get("signer_name"),
            "signer_email": signature.get("signer_email"),
            "signature_hash": signature.get("signature_hash"),
            "signed_at": signature.get("signed_at").isoformat() if signature.get("signed_at") else None,
            "signer_ip": signature.get("signer_ip")
        }
    
    async def verify_signature(self, signature_id: str, company_id: str) -> Dict[str, Any]:
        """
        Vérifie l'authenticité d'une signature
        """
        signature = await self.db.signatures.find_one({
            "_id": ObjectId(signature_id),
            "company_id": ObjectId(company_id)
        })
        
        if not signature:
            return {
                "valid": False,
                "error": "Signature non trouvée"
            }
        
        # Vérifier le hash
        calculated_hash = hashlib.sha256(signature.get("signature_data", "").encode()).hexdigest()
        stored_hash = signature.get("signature_hash")
        
        if calculated_hash != stored_hash:
            return {
                "valid": False,
                "error": "La signature a été modifiée"
            }
        
        return {
            "valid": True,
            "signer_name": signature.get("signer_name"),
            "signed_at": signature.get("signed_at").isoformat() if signature.get("signed_at") else None,
            "signature_hash": stored_hash
        }
    
    async def list_signatures(
        self,
        company_id: str,
        document_type: Optional[str] = None,
        document_id: Optional[str] = None,
        skip: int = 0,
        limit: int = 50
    ) -> Dict[str, Any]:
        """
        Liste les signatures d'une entreprise
        """
        query = {"company_id": ObjectId(company_id)}
        
        if document_type:
            query["document_type"] = document_type
        if document_id:
            query["document_id"] = ObjectId(document_id)
        
        signatures = await self.db.signatures.find(query).sort("signed_at", -1).skip(skip).limit(limit).to_list(limit)
        total = await self.db.signatures.count_documents(query)
        
        items = []
        for sig in signatures:
            items.append({
                "id": str(sig["_id"]),
                "document_type": sig.get("document_type"),
                "document_id": str(sig.get("document_id")),
                "signer_name": sig.get("signer_name"),
                "signed_at": sig.get("signed_at").isoformat() if sig.get("signed_at") else None
            })
        
        return {
            "items": items,
            "total": total,
            "skip": skip,
            "limit": limit
        }
