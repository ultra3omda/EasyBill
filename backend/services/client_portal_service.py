"""
Service de Portail Client Public
Permet aux clients de consulter leurs factures, devis et paiements via un lien sécurisé
"""

from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime, timezone, timedelta
import os
import secrets
import hashlib
import logging

logger = logging.getLogger(__name__)

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]


class ClientPortalService:
    """Service de gestion du portail client"""
    
    @staticmethod
    def generate_secure_token(length: int = 32) -> str:
        """Génère un token sécurisé aléatoire"""
        return secrets.token_urlsafe(length)
    
    @staticmethod
    def hash_token(token: str) -> str:
        """Hash un token pour le stockage en base"""
        return hashlib.sha256(token.encode()).hexdigest()
    
    async def create_customer_portal_access(
        self,
        customer_id: str,
        company_id: str,
        expires_in_days: int = 90
    ) -> dict:
        """
        Crée un accès portail pour un client
        Retourne le token et l'URL d'accès
        """
        
        try:
            # Vérifier que le client existe
            customer = await db.customers.find_one({
                "_id": ObjectId(customer_id),
                "company_id": ObjectId(company_id)
            })
            
            if not customer:
                logger.error(f"Client {customer_id} non trouvé")
                return None
            
            # Générer le token
            token = self.generate_secure_token()
            token_hash = self.hash_token(token)
            
            # Date d'expiration
            expires_at = datetime.now(timezone.utc) + timedelta(days=expires_in_days)
            
            # Créer ou mettre à jour l'accès portail
            portal_access = {
                "customer_id": ObjectId(customer_id),
                "company_id": ObjectId(company_id),
                "token_hash": token_hash,
                "expires_at": expires_at,
                "created_at": datetime.now(timezone.utc),
                "last_accessed_at": None,
                "access_count": 0,
                "is_active": True
            }
            
            # Vérifier si un accès existe déjà
            existing = await db.customer_portal_access.find_one({
                "customer_id": ObjectId(customer_id),
                "company_id": ObjectId(company_id)
            })
            
            if existing:
                # Mettre à jour l'accès existant
                await db.customer_portal_access.update_one(
                    {"_id": existing["_id"]},
                    {"$set": portal_access}
                )
                access_id = str(existing["_id"])
            else:
                # Créer un nouvel accès
                result = await db.customer_portal_access.insert_one(portal_access)
                access_id = str(result.inserted_id)
            
            # Construire l'URL du portail
            frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
            portal_url = f"{frontend_url}/portal/{token}"
            
            logger.info(f"Accès portail créé pour client {customer_id}")
            
            return {
                "access_id": access_id,
                "token": token,
                "portal_url": portal_url,
                "expires_at": expires_at.isoformat(),
                "customer_name": customer.get("display_name", "")
            }
            
        except Exception as e:
            logger.error(f"Erreur création accès portail: {str(e)}")
            return None
    
    async def verify_portal_token(self, token: str) -> dict:
        """
        Vérifie un token de portail et retourne les informations d'accès
        """
        
        try:
            token_hash = self.hash_token(token)
            
            # Trouver l'accès correspondant
            access = await db.customer_portal_access.find_one({
                "token_hash": token_hash,
                "is_active": True
            })
            
            if not access:
                logger.warning(f"Token invalide ou inactif")
                return None
            
            # Vérifier l'expiration
            if access["expires_at"] < datetime.now(timezone.utc):
                logger.warning(f"Token expiré pour client {access['customer_id']}")
                return None
            
            # Mettre à jour les statistiques d'accès
            await db.customer_portal_access.update_one(
                {"_id": access["_id"]},
                {
                    "$set": {"last_accessed_at": datetime.now(timezone.utc)},
                    "$inc": {"access_count": 1}
                }
            )
            
            # Récupérer les informations du client et de l'entreprise
            customer = await db.customers.find_one({"_id": access["customer_id"]})
            company = await db.companies.find_one({"_id": access["company_id"]})
            
            if not customer or not company:
                logger.error(f"Client ou entreprise non trouvé")
                return None
            
            return {
                "customer_id": str(access["customer_id"]),
                "company_id": str(access["company_id"]),
                "customer": {
                    "id": str(customer["_id"]),
                    "display_name": customer.get("display_name", ""),
                    "email": customer.get("email", ""),
                    "phone": customer.get("phone", ""),
                    "address": customer.get("address", {}),
                    "balance": customer.get("balance", 0),
                    "total_invoiced": customer.get("total_invoiced", 0),
                    "total_paid": customer.get("total_paid", 0)
                },
                "company": {
                    "id": str(company["_id"]),
                    "name": company.get("name", ""),
                    "email": company.get("email", ""),
                    "phone": company.get("phone", ""),
                    "address": company.get("address", {}),
                    "logo": company.get("logo", "")
                },
                "expires_at": access["expires_at"].isoformat()
            }
            
        except Exception as e:
            logger.error(f"Erreur vérification token portail: {str(e)}")
            return None
    
    async def get_customer_invoices(self, customer_id: str, company_id: str) -> list:
        """
        Récupère toutes les factures d'un client
        """
        
        try:
            invoices = await db.invoices.find({
                "customer_id": ObjectId(customer_id),
                "company_id": ObjectId(company_id),
                "status": {"$in": ["sent", "paid", "partial", "overdue"]}
            }).sort("date", -1).to_list(1000)
            
            result = []
            for invoice in invoices:
                result.append({
                    "id": str(invoice["_id"]),
                    "number": invoice.get("number", ""),
                    "date": invoice["date"].isoformat() if isinstance(invoice.get("date"), datetime) else invoice.get("date"),
                    "due_date": invoice["due_date"].isoformat() if isinstance(invoice.get("due_date"), datetime) else invoice.get("due_date"),
                    "subject": invoice.get("subject", ""),
                    "subtotal": invoice.get("subtotal", 0),
                    "total_tax": invoice.get("total_tax", 0),
                    "total": invoice.get("total", 0),
                    "amount_paid": invoice.get("amount_paid", 0),
                    "balance_due": invoice.get("balance_due", 0),
                    "status": invoice.get("status", ""),
                    "items": invoice.get("items", [])
                })
            
            return result
            
        except Exception as e:
            logger.error(f"Erreur récupération factures client: {str(e)}")
            return []
    
    async def get_customer_quotes(self, customer_id: str, company_id: str) -> list:
        """
        Récupère tous les devis d'un client
        """
        
        try:
            quotes = await db.quotes.find({
                "customer_id": ObjectId(customer_id),
                "company_id": ObjectId(company_id),
                "status": {"$in": ["sent", "accepted", "rejected"]}
            }).sort("date", -1).to_list(1000)
            
            result = []
            for quote in quotes:
                result.append({
                    "id": str(quote["_id"]),
                    "number": quote.get("number", ""),
                    "date": quote["date"].isoformat() if isinstance(quote.get("date"), datetime) else quote.get("date"),
                    "valid_until": quote["valid_until"].isoformat() if isinstance(quote.get("valid_until"), datetime) else quote.get("valid_until"),
                    "subject": quote.get("subject", ""),
                    "subtotal": quote.get("subtotal", 0),
                    "total_tax": quote.get("total_tax", 0),
                    "total": quote.get("total", 0),
                    "status": quote.get("status", ""),
                    "items": quote.get("items", [])
                })
            
            return result
            
        except Exception as e:
            logger.error(f"Erreur récupération devis client: {str(e)}")
            return []
    
    async def get_customer_payments(self, customer_id: str, company_id: str) -> list:
        """
        Récupère tous les paiements d'un client
        """
        
        try:
            payments = await db.payments.find({
                "customer_id": ObjectId(customer_id),
                "company_id": ObjectId(company_id),
                "type": "received"
            }).sort("date", -1).to_list(1000)
            
            result = []
            for payment in payments:
                # Récupérer les numéros de factures associées
                invoice_numbers = []
                for allocation in payment.get("allocations", []):
                    invoice_id = allocation.get("invoice_id")
                    if invoice_id:
                        invoice = await db.invoices.find_one({"_id": invoice_id})
                        if invoice:
                            invoice_numbers.append(invoice.get("number", ""))
                
                result.append({
                    "id": str(payment["_id"]),
                    "number": payment.get("number", ""),
                    "date": payment["date"].isoformat() if isinstance(payment.get("date"), datetime) else payment.get("date"),
                    "amount": payment.get("amount", 0),
                    "payment_method": payment.get("payment_method", ""),
                    "reference": payment.get("reference", ""),
                    "invoice_numbers": invoice_numbers,
                    "notes": payment.get("notes", "")
                })
            
            return result
            
        except Exception as e:
            logger.error(f"Erreur récupération paiements client: {str(e)}")
            return []
    
    async def revoke_portal_access(self, customer_id: str, company_id: str) -> bool:
        """
        Révoque l'accès portail d'un client
        """
        
        try:
            result = await db.customer_portal_access.update_one(
                {
                    "customer_id": ObjectId(customer_id),
                    "company_id": ObjectId(company_id)
                },
                {"$set": {"is_active": False}}
            )
            
            if result.modified_count > 0:
                logger.info(f"Accès portail révoqué pour client {customer_id}")
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"Erreur révocation accès portail: {str(e)}")
            return False
    
    async def send_portal_link_email(self, customer_id: str, company_id: str):
        """
        Envoie l'email avec le lien du portail client
        """
        
        try:
            # Créer l'accès portail
            access = await self.create_customer_portal_access(customer_id, company_id)
            
            if not access:
                return False
            
            # Récupérer les informations
            customer = await db.customers.find_one({"_id": ObjectId(customer_id)})
            company = await db.companies.find_one({"_id": ObjectId(company_id)})
            
            if not customer or not company:
                return False
            
            # Importer le service d'email
            from services.email_service import email_service
            
            # Envoyer l'email
            success = await email_service.send_portal_link_email(
                to_email=customer.get("email", ""),
                customer_name=customer.get("display_name", ""),
                company_name=company.get("name", ""),
                portal_url=access["portal_url"],
                expires_at=access["expires_at"]
            )
            
            return success
            
        except Exception as e:
            logger.error(f"Erreur envoi email portail: {str(e)}")
            return False


# Instance globale du service
client_portal_service = ClientPortalService()
