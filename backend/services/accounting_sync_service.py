"""
Service de Synchronisation Comptable Automatique
Génère automatiquement les écritures comptables pour toutes les opérations transactionnelles
Conforme aux normes comptables tunisiennes
"""

from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime, timezone
from typing import Optional, Dict, List
import os
import logging

logger = logging.getLogger(__name__)
from services.account_resolution_service import AccountResolutionService
from services.journal_posting_service import JournalPostingService

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]


class AccountingSyncService:
    """Service de synchronisation comptable automatique"""
    
    # Mapping des types de journaux
    JOURNAL_TYPES = {
        "sales": "VE",  # Ventes
        "purchases": "AC",  # Achats
        "bank": "BQ",  # Banque
        "cash": "CA",  # Caisse
        "stock": "ST",  # Stock
        "general": "OD"  # Opérations Diverses
    }
    
    def __init__(self):
        self.db = db
        self.account_resolution = AccountResolutionService(self.db)
        self.journal_posting = JournalPostingService(self.db)
    
    async def _get_next_entry_number(self, company_id: str, journal_type: str, year: int) -> str:
        """Génère le prochain numéro d'écriture comptable"""
        prefix = f"{journal_type}-{year}-"
        
        # Trouver le dernier numéro
        last_entry = await self.db.journal_entries.find_one(
            {
                "company_id": ObjectId(company_id),
                "reference": {"$regex": f"^{prefix}"}
            },
            sort=[("reference", -1)]
        )
        
        if last_entry and last_entry.get("reference"):
            try:
                last_num = int(last_entry["reference"].split("-")[-1])
                next_num = last_num + 1
            except:
                next_num = 1
        else:
            next_num = 1
        
        return f"{prefix}{next_num:04d}"
    
    async def _create_journal_entry(
        self,
        company_id: str,
        date: datetime,
        journal_type: str,
        description: str,
        lines: List[Dict],
        document_type: str,
        document_id: str,
        reference: Optional[str] = None
    ) -> Optional[str]:
        """Crée une écriture comptable"""
        
        try:
            logger.info(f"[SYNC] Création écriture pour {document_type} {document_id}")
            logger.info(f"[SYNC] Lignes: {len(lines)} lignes comptables")
            
            # Vérifier l'équilibre débit/crédit
            total_debit = sum(line.get("debit", 0) for line in lines)
            total_credit = sum(line.get("credit", 0) for line in lines)
            
            logger.info(f"[SYNC] Totaux - Débit: {total_debit}, Crédit: {total_credit}, Différence: {abs(total_debit - total_credit)}")
            
            if abs(total_debit - total_credit) > 0.01:  # Tolérance de 1 centime
                logger.error(f"[SYNC] ❌ Écriture déséquilibrée: Débit={total_debit}, Crédit={total_credit}")
                logger.error(f"[SYNC] Lignes détaillées: {lines}")
                return None
            
            # Générer la référence si non fournie
            if not reference:
                year = date.year
                journal_code = self.JOURNAL_TYPES.get(journal_type, "OD")
                reference = await self._get_next_entry_number(company_id, journal_code, year)
            
            logger.info(f"[SYNC] Référence générée: {reference}")
            
            entry_id, _ = await self.journal_posting.create_posted_entry(
                company_id=company_id,
                date=date,
                reference=reference,
                description=description,
                journal_type=journal_type,
                lines=lines,
                document_type=document_type,
                document_id=document_id,
                extra_fields={"auto_generated": True},
            )
            logger.info(f"[SYNC] ✅ Écriture comptable créée: {reference} pour {document_type} {document_id}")
            return str(entry_id)
            
        except Exception as e:
            logger.error(f"[SYNC] ❌ Erreur création écriture comptable: {str(e)}")
            import traceback
            logger.error(f"[SYNC] Traceback: {traceback.format_exc()}")
            return None
    
    async def sync_invoice(self, invoice_id: str) -> Optional[str]:
        """
        Synchronise une facture client
        Génère l'écriture: Débit 411 Clients / Crédit 707 Ventes + 4351 TVA
        """
        
        try:
            invoice = await self.db.invoices.find_one({"_id": ObjectId(invoice_id)})
            
            if not invoice:
                logger.error(f"Facture {invoice_id} non trouvée")
                return None
            
            # Ne synchroniser que les factures envoyées, partiellement payées ou payées
            if invoice.get("status") not in ["sent", "paid", "partial"]:
                logger.info(f"Facture {invoice_id} en statut {invoice.get('status')}, pas de synchronisation")
                return None
            
            # Vérifier si déjà synchronisée
            if invoice.get("accounting_entry_id"):
                logger.info(f"Facture {invoice_id} déjà synchronisée")
                return invoice.get("accounting_entry_id")
            
            company_id = str(invoice["company_id"])
            
            # Calculer les montants
            subtotal = invoice.get("subtotal", 0)
            tax_amount = invoice.get("total_tax", invoice.get("tax_amount", 0))
            total = invoice.get("total", 0)
            discount = invoice.get("discount", 0)
            
            receivable = await self.account_resolution.resolve_account(company_id, "customer_receivable", "Clients")
            revenue_goods = await self.account_resolution.resolve_account(company_id, "revenue_goods", "Ventes de marchandises")
            revenue_services = await self.account_resolution.resolve_account(company_id, "revenue_services", "Prestations de services")
            vat_collectible = await self.account_resolution.resolve_account(company_id, "vat_collectible", "TVA collectee")
            sales_account = revenue_goods["code"] or "707"
            sales_label = revenue_goods["name"] or "Ventes de marchandises"
            
            # Analyser les items pour déterminer le type
            items = invoice.get("items", [])
            if items:
                first_item = items[0]
                # Si c'est un service, utiliser 706
                if "service" in first_item.get("product_name", "").lower():
                    sales_account = revenue_services["code"] or "706"
                    sales_label = revenue_services["name"] or "Prestations de services"
            
            # Construire les lignes d'écriture
            lines = [
                {
                    "account_code": receivable["code"] or "411",
                    "account_name": receivable["name"] or "Clients",
                    "debit": round(total, 3),
                    "credit": 0,
                    "description": f"Facture {invoice.get('number', '')}"
                }
            ]
            
            # Ligne de vente (HT)
            if subtotal > 0:
                lines.append({
                    "account_code": sales_account,
                    "account_name": sales_label,
                    "debit": 0,
                    "credit": round(subtotal, 3),
                    "description": f"Vente facture {invoice.get('number', '')}"
                })
            
            # Ligne de remise si applicable
            if discount > 0:
                lines.append({
                    "account_code": "709",
                    "account_name": "Rabais, remises et ristournes accordés",
                    "debit": round(discount, 3),
                    "credit": 0,
                    "description": f"Remise facture {invoice.get('number', '')}"
                })
            
            # Ligne TVA
            if tax_amount > 0:
                lines.append({
                    "account_code": vat_collectible["code"] or "4351",
                    "account_name": vat_collectible["name"] or "État - TVA à payer",
                    "debit": 0,
                    "credit": round(tax_amount, 3),
                    "description": f"TVA facture {invoice.get('number', '')}"
                })
            
            # Créer l'écriture
            entry_id = await self._create_journal_entry(
                company_id=company_id,
                date=invoice.get("date", datetime.now(timezone.utc)),
                journal_type="sales",
                description=f"Facture client {invoice.get('number', '')} - {invoice.get('customer_name', '')}",
                lines=lines,
                document_type="invoice",
                document_id=invoice_id
            )
            
            if entry_id:
                # Mettre à jour la facture avec l'ID de l'écriture
                await self.db.invoices.update_one(
                    {"_id": ObjectId(invoice_id)},
                    {"$set": {"accounting_entry_id": entry_id}}
                )
            
            return entry_id
            
        except Exception as e:
            logger.error(f"Erreur sync facture {invoice_id}: {str(e)}")
            return None
    
    # Mapping complet des modes de règlement vers les comptes comptables tunisiens
    PAYMENT_METHOD_MAP = {
        "cash":     ("531", "Caisse en monnaie nationale", "cash"),
        "check":    ("521", "Banques - Chèques encaissés", "bank"),
        "transfer": ("521", "Banques - Virements reçus", "bank"),
        "card":     ("521", "Banques - TPE", "bank"),
        "e_dinar":  ("531", "Caisse électronique (e-Dinar)", "cash"),
    }

    async def sync_payment(self, payment_id: str) -> Optional[str]:
        """
        Synchronise un paiement client.
        Génère l'écriture de règlement selon le mode de paiement :
          - Espèces  : Débit 531 Caisse       / Crédit 411 Clients
          - Chèque   : Débit 521 Banques      / Crédit 411 Clients
          - Virement : Débit 521 Banques      / Crédit 411 Clients
          - Carte    : Débit 521 Banques-TPE  / Crédit 411 Clients
          - e-Dinar  : Débit 531 Caisse élec. / Crédit 411 Clients
        """
        try:
            payment = await self.db.payments.find_one({"_id": ObjectId(payment_id)})

            if not payment:
                logger.error(f"Paiement {payment_id} non trouvé")
                return None

            # Vérifier si déjà synchronisé
            if payment.get("accounting_entry_id"):
                logger.info(f"Paiement {payment_id} déjà synchronisé")
                return payment.get("accounting_entry_id")

            company_id = str(payment["company_id"])
            amount = payment.get("amount", 0)
            payment_method = payment.get("payment_method", "transfer")
            ref = payment.get("reference") or payment.get("number", "")
            customer_receivable = await self.account_resolution.resolve_account(company_id, "customer_receivable", "Clients")
            cash = await self.account_resolution.resolve_account(company_id, "cash", "Caisse")
            bank = await self.account_resolution.resolve_account(company_id, "bank", "Banques")

            # Résoudre le compte de trésorerie
            treasury_account, treasury_name, journal_type = self.PAYMENT_METHOD_MAP.get(
                payment_method,
                (bank["code"] or "521", bank["name"] or "Banques", "bank"),
            )
            if payment_method in ("cash", "e_dinar"):
                treasury_account = cash["code"] or treasury_account
                treasury_name = cash["name"] or treasury_name

            # Construire les lignes d'écriture
            lines = [
                {
                    "account_code": treasury_account,
                    "account_name": treasury_name,
                    "debit": round(amount, 3),
                    "credit": 0,
                    "description": f"Encaissement {ref}"
                },
                {
                    "account_code": customer_receivable["code"] or "411",
                    "account_name": customer_receivable["name"] or "Clients",
                    "debit": 0,
                    "credit": round(amount, 3),
                    "description": f"Règlement client {ref}"
                }
            ]

            entry_id = await self._create_journal_entry(
                company_id=company_id,
                date=payment.get("date", datetime.now(timezone.utc)),
                journal_type=journal_type,
                description=f"Règlement client {ref} - {payment.get('customer_name', '')} ({payment_method})",
                lines=lines,
                document_type="payment",
                document_id=payment_id
            )

            if entry_id:
                await self.db.payments.update_one(
                    {"_id": ObjectId(payment_id)},
                    {"$set": {"accounting_entry_id": entry_id}}
                )

            return entry_id

        except Exception as e:
            logger.error(f"Erreur sync paiement {payment_id}: {str(e)}")
            return None
    
    async def sync_supplier_invoice(self, invoice_id: str) -> Optional[str]:
        """
        Synchronise une facture fournisseur
        Génère l'écriture: Débit 607 Achats + 4362 TVA / Crédit 401 Fournisseurs
        """
        
        try:
            logger.info(f"[SYNC] === DÉBUT sync_supplier_invoice {invoice_id} ===")
            
            invoice = await self.db.supplier_invoices.find_one({"_id": ObjectId(invoice_id)})
            
            if not invoice:
                logger.error(f"[SYNC] ❌ Facture fournisseur {invoice_id} non trouvée")
                return None
            
            logger.info(f"[SYNC] Facture trouvée, status: {invoice.get('status')}")
            
            # Ne synchroniser que les factures validées
            if invoice.get("status") != "validated":
                logger.info(f"[SYNC] ⏭️ Facture fournisseur {invoice_id} en statut {invoice.get('status')}, pas de synchronisation")
                return None
            
            # Vérifier si déjà synchronisée
            if invoice.get("accounting_entry_id"):
                logger.info(f"[SYNC] ⏭️ Facture fournisseur {invoice_id} déjà synchronisée")
                return invoice.get("accounting_entry_id")
            
            company_id = str(invoice["company_id"])
            
            # Calculer les montants
            subtotal = invoice.get("subtotal", 0)
            tax_amount = invoice.get("total_tax", invoice.get("tax_amount", 0))
            total = invoice.get("total", 0)
            
            logger.info(f"[SYNC] Montants - Subtotal: {subtotal}, Tax: {tax_amount}, Total: {total}")
            supplier_payable = await self.account_resolution.resolve_account(company_id, "supplier_payable", "Fournisseurs")
            vat_deductible = await self.account_resolution.resolve_account(company_id, "vat_deductible", "TVA deductibile")
            purchases = await self.account_resolution.resolve_account(company_id, "purchases", "Achats")
            
            # Déterminer le compte d'achat
            purchase_account = purchases["code"] or "607"
            purchase_label = purchases["name"] or "Achats"
            
            # Analyser les items pour déterminer le type
            items = invoice.get("items", [])
            if items:
                first_item = items[0]
                # Si c'est un service, utiliser 604
                if "service" in first_item.get("description", "").lower():
                    purchase_account = purchases["code"] or "604"
                    purchase_label = purchases["name"] or "Achats de services"
                # Si c'est une matière première, utiliser 601
                elif "matière" in first_item.get("description", "").lower():
                    purchase_account = purchases["code"] or "601"
            
            logger.info(f"[SYNC] Compte d'achat déterminé: {purchase_account}")
            
            # Construire les lignes d'écriture
            lines = []
            
            # Ligne d'achat (HT)
            if subtotal > 0:
                lines.append({
                    "account_code": purchase_account,
                    "account_name": purchase_label,
                    "debit": round(subtotal, 3),
                    "credit": 0,
                    "description": f"Achat facture {invoice.get('number', '')}"
                })
            
            # Ligne TVA déductible
            if tax_amount > 0:
                lines.append({
                    "account_code": vat_deductible["code"] or "4362",
                    "account_name": vat_deductible["name"] or "TVA récupérable sur achats et charges",
                    "debit": round(tax_amount, 3),
                    "credit": 0,
                    "description": f"TVA déductible facture {invoice.get('number', '')}"
                })
            
            # Ligne fournisseur (TTC)
            lines.append({
                "account_code": supplier_payable["code"] or "401",
                "account_name": supplier_payable["name"] or "Fournisseurs d'exploitation",
                "debit": 0,
                "credit": round(total, 3),
                "description": f"Facture fournisseur {invoice.get('number', '')}"
            })
            
            logger.info(f"[SYNC] {len(lines)} lignes créées")
            for i, line in enumerate(lines):
                logger.info(f"[SYNC] Ligne {i+1}: {line['account_code']} - Débit: {line['debit']}, Crédit: {line['credit']}")
            
            # Créer l'écriture
            entry_id = await self._create_journal_entry(
                company_id=company_id,
                date=invoice.get("date", datetime.now(timezone.utc)),
                journal_type="purchases",
                description=f"Facture fournisseur {invoice.get('number', '')} - {invoice.get('supplier_name', '')}",
                lines=lines,
                document_type="supplier_invoice",
                document_id=invoice_id
            )
            
            if entry_id:
                logger.info(f"[SYNC] ✅ Écriture créée avec ID: {entry_id}")
                # Mettre à jour la facture avec l'ID de l'écriture
                await self.db.supplier_invoices.update_one(
                    {"_id": ObjectId(invoice_id)},
                    {"$set": {"accounting_entry_id": entry_id}}
                )
            else:
                logger.error(f"[SYNC] ❌ Échec création écriture pour facture fournisseur {invoice_id}")
            
            logger.info(f"[SYNC] === FIN sync_supplier_invoice {invoice_id} ===")
            return entry_id
            
        except Exception as e:
            logger.error(f"[SYNC] ❌ Erreur sync facture fournisseur {invoice_id}: {str(e)}")
            import traceback
            logger.error(f"[SYNC] Traceback: {traceback.format_exc()}")
            return None
    
    async def sync_supplier_payment(self, payment_id: str) -> Optional[str]:
        """
        Synchronise un paiement fournisseur
        Génère l'écriture: Débit 401 Fournisseurs / Crédit 521 Banque (ou 531 Caisse)
        """
        
        try:
            payment = await self.db.supplier_payments.find_one({"_id": ObjectId(payment_id)})
            
            if not payment:
                logger.error(f"Paiement fournisseur {payment_id} non trouvé")
                return None
            
            # Vérifier si déjà synchronisé
            if payment.get("accounting_entry_id"):
                logger.info(f"Paiement fournisseur {payment_id} déjà synchronisé")
                return payment.get("accounting_entry_id")
            
            company_id = str(payment["company_id"])
            amount = payment.get("amount", 0)
            payment_method = payment.get("payment_method", "transfer")
            ref = payment.get("reference") or payment.get("number", "")
            supplier_payable = await self.account_resolution.resolve_account(company_id, "supplier_payable", "Fournisseurs")
            cash = await self.account_resolution.resolve_account(company_id, "cash", "Caisse")
            bank = await self.account_resolution.resolve_account(company_id, "bank", "Banques")

            # Résoudre le compte de trésorerie (même mapping que pour les clients)
            treasury_account, treasury_name, journal_type = self.PAYMENT_METHOD_MAP.get(
                payment_method, (bank["code"] or "521", bank["name"] or "Banques", "bank")
            )
            if payment_method in ("cash", "e_dinar"):
                treasury_account = cash["code"] or treasury_account
                treasury_name = cash["name"] or treasury_name

            # Construire les lignes d'écriture
            lines = [
                {
                    "account_code": supplier_payable["code"] or "401",
                    "account_name": supplier_payable["name"] or "Fournisseurs d'exploitation",
                    "debit": round(amount, 3),
                    "credit": 0,
                    "description": f"Règlement fournisseur {ref}"
                },
                {
                    "account_code": treasury_account,
                    "account_name": treasury_name,
                    "debit": 0,
                    "credit": round(amount, 3),
                    "description": f"Décaissement {ref}"
                }
            ]
            
            # Créer l'écriture
            entry_id = await self._create_journal_entry(
                company_id=company_id,
                date=payment.get("date", datetime.now(timezone.utc)),
                journal_type=journal_type,
                description=f"Règlement fournisseur {ref} - {payment.get('supplier_name', '')} ({payment_method})",
                lines=lines,
                document_type="supplier_payment",
                document_id=payment_id
            )
            
            if entry_id:
                # Mettre à jour le paiement avec l'ID de l'écriture
                await self.db.supplier_payments.update_one(
                    {"_id": ObjectId(payment_id)},
                    {"$set": {"accounting_entry_id": entry_id}}
                )
            
            return entry_id
            
        except Exception as e:
            logger.error(f"Erreur sync paiement fournisseur {payment_id}: {str(e)}")
            return None
    
    async def sync_stock_movement(self, movement_id: str) -> Optional[str]:
        """
        Synchronise un mouvement de stock
        Entrée: Débit 370 Stock / Crédit 6087 Variation
        Sortie: Débit 6087 Variation / Crédit 370 Stock
        """
        
        try:
            movement = await self.db.stock_movements.find_one({"_id": ObjectId(movement_id)})
            
            if not movement:
                logger.error(f"Mouvement de stock {movement_id} non trouvé")
                return None
            
            # Vérifier si déjà synchronisé
            if movement.get("accounting_entry_id"):
                logger.info(f"Mouvement de stock {movement_id} déjà synchronisé")
                return movement.get("accounting_entry_id")
            
            company_id = str(movement["company_id"])
            movement_type = movement.get("type", "")
            quantity = movement.get("quantity", 0)
            unit_cost = movement.get("unit_cost", 0)
            total_value = quantity * unit_cost
            
            if total_value <= 0:
                logger.info(f"Mouvement de stock {movement_id} sans valeur, pas de synchronisation")
                return None
            
            # Construire les lignes selon le type de mouvement
            if movement_type == "in":
                # Entrée de stock
                lines = [
                    {
                        "account_code": "370",
                        "account_name": "Stock de marchandises",
                        "debit": round(total_value, 3),
                        "credit": 0,
                        "description": f"Entrée stock {movement.get('reference', '')}"
                    },
                    {
                        "account_code": "6087",
                        "account_name": "Variation des stocks de marchandises",
                        "debit": 0,
                        "credit": round(total_value, 3),
                        "description": f"Variation stock {movement.get('reference', '')}"
                    }
                ]
            elif movement_type == "out":
                # Sortie de stock
                lines = [
                    {
                        "account_code": "6087",
                        "account_name": "Variation des stocks de marchandises",
                        "debit": round(total_value, 3),
                        "credit": 0,
                        "description": f"Variation stock {movement.get('reference', '')}"
                    },
                    {
                        "account_code": "370",
                        "account_name": "Stock de marchandises",
                        "debit": 0,
                        "credit": round(total_value, 3),
                        "description": f"Sortie stock {movement.get('reference', '')}"
                    }
                ]
            else:
                logger.info(f"Type de mouvement {movement_type} non supporté")
                return None
            
            # Créer l'écriture
            entry_id = await self._create_journal_entry(
                company_id=company_id,
                date=movement.get("date", datetime.now(timezone.utc)),
                journal_type="stock",
                description=f"Mouvement stock {movement.get('reference', '')} - {movement.get('product_name', '')}",
                lines=lines,
                document_type="stock_movement",
                document_id=movement_id
            )
            
            if entry_id:
                # Mettre à jour le mouvement avec l'ID de l'écriture
                await self.db.stock_movements.update_one(
                    {"_id": ObjectId(movement_id)},
                    {"$set": {"accounting_entry_id": entry_id}}
                )
            
            return entry_id
            
        except Exception as e:
            logger.error(f"Erreur sync mouvement stock {movement_id}: {str(e)}")
            return None
    
    async def sync_credit_note(self, credit_note_id: str) -> Optional[str]:
        """
        Synchronise un avoir client (note de crédit)
        Génère l'écriture inverse de la facture: Débit 707 Ventes + 4351 TVA / Crédit 411 Clients
        """
        
        try:
            credit_note = await self.db.credit_notes.find_one({"_id": ObjectId(credit_note_id)})
            
            if not credit_note:
                logger.error(f"Avoir {credit_note_id} non trouvé")
                return None
            
            # Ne synchroniser que les avoirs validés
            if credit_note.get("status") != "validated":
                logger.info(f"Avoir {credit_note_id} en statut {credit_note.get('status')}, pas de synchronisation")
                return None
            
            # Vérifier si déjà synchronisé
            if credit_note.get("accounting_entry_id"):
                logger.info(f"Avoir {credit_note_id} déjà synchronisé")
                return credit_note.get("accounting_entry_id")
            
            company_id = str(credit_note["company_id"])
            
            # Calculer les montants
            subtotal = credit_note.get("subtotal", 0)
            # Le champ peut être 'tax_amount' ou 'total_tax' selon le document
            tax_amount = credit_note.get("tax_amount", credit_note.get("total_tax", 0))
            total = credit_note.get("total", 0)
            
            logger.info(f"[SYNC] Credit note amounts - Subtotal: {subtotal}, Tax: {tax_amount}, Total: {total}")
            
            # Déterminer le compte de vente
            sales_account = "707"
            
            # Construire les lignes d'écriture (inverse de la facture)
            lines = []
            
            # Ligne de vente (HT) - DÉBIT car c'est une annulation
            if subtotal > 0:
                lines.append({
                    "account_code": sales_account,
                    "account_name": "Ventes de marchandises",
                    "debit": round(subtotal, 3),
                    "credit": 0,
                    "description": f"Avoir {credit_note.get('number', '')}"
                })
            
            # Ligne TVA - DÉBIT car c'est une annulation
            if tax_amount > 0:
                lines.append({
                    "account_code": "4351",
                    "account_name": "État - TVA à payer",
                    "debit": round(tax_amount, 3),
                    "credit": 0,
                    "description": f"TVA avoir {credit_note.get('number', '')}"
                })
            
            # Ligne client (TTC) - CRÉDIT
            lines.append({
                "account_code": "411",
                "account_name": "Clients",
                "debit": 0,
                "credit": round(total, 3),
                "description": f"Avoir client {credit_note.get('number', '')}"
            })
            
            # Créer l'écriture
            entry_id = await self._create_journal_entry(
                company_id=company_id,
                date=credit_note.get("date", datetime.now(timezone.utc)),
                journal_type="sales",
                description=f"Avoir client {credit_note.get('number', '')} - {credit_note.get('customer_name', '')}",
                lines=lines,
                document_type="credit_note",
                document_id=credit_note_id
            )
            
            if entry_id:
                # Mettre à jour l'avoir avec l'ID de l'écriture
                await self.db.credit_notes.update_one(
                    {"_id": ObjectId(credit_note_id)},
                    {"$set": {"accounting_entry_id": entry_id}}
                )
            
            return entry_id
            
        except Exception as e:
            logger.error(f"Erreur sync avoir {credit_note_id}: {str(e)}")
            return None
    
    async def resync_all_documents(self, company_id: str, document_type: Optional[str] = None):
        """
        Re-synchronise tous les documents d'une entreprise
        Utile pour corriger les écritures manquantes
        """
        
        results = {
            "invoices": {"total": 0, "synced": 0, "errors": 0},
            "payments": {"total": 0, "synced": 0, "errors": 0},
            "supplier_invoices": {"total": 0, "synced": 0, "errors": 0},
            "supplier_payments": {"total": 0, "synced": 0, "errors": 0},
            "stock_movements": {"total": 0, "synced": 0, "errors": 0},
            "credit_notes": {"total": 0, "synced": 0, "errors": 0}
        }
        
        company_oid = ObjectId(company_id)
        
        # Factures clients
        if not document_type or document_type == "invoices":
            invoices = await self.db.invoices.find({
                "company_id": company_oid,
                "status": {"$in": ["sent", "paid"]}
            }).to_list(None)
            
            results["invoices"]["total"] = len(invoices)
            
            for invoice in invoices:
                entry_id = await self.sync_invoice(str(invoice["_id"]))
                if entry_id:
                    results["invoices"]["synced"] += 1
                else:
                    results["invoices"]["errors"] += 1
        
        # Paiements clients
        if not document_type or document_type == "payments":
            payments = await self.db.payments.find({
                "company_id": company_oid
            }).to_list(None)
            
            results["payments"]["total"] = len(payments)
            
            for payment in payments:
                entry_id = await self.sync_payment(str(payment["_id"]))
                if entry_id:
                    results["payments"]["synced"] += 1
                else:
                    results["payments"]["errors"] += 1
        
        # Factures fournisseurs
        if not document_type or document_type == "supplier_invoices":
            supplier_invoices = await self.db.supplier_invoices.find({
                "company_id": company_oid,
                "status": "validated"
            }).to_list(None)
            
            results["supplier_invoices"]["total"] = len(supplier_invoices)
            
            for invoice in supplier_invoices:
                entry_id = await self.sync_supplier_invoice(str(invoice["_id"]))
                if entry_id:
                    results["supplier_invoices"]["synced"] += 1
                else:
                    results["supplier_invoices"]["errors"] += 1
        
        # Paiements fournisseurs
        if not document_type or document_type == "supplier_payments":
            supplier_payments = await self.db.supplier_payments.find({
                "company_id": company_oid
            }).to_list(None)
            
            results["supplier_payments"]["total"] = len(supplier_payments)
            
            for payment in supplier_payments:
                entry_id = await self.sync_supplier_payment(str(payment["_id"]))
                if entry_id:
                    results["supplier_payments"]["synced"] += 1
                else:
                    results["supplier_payments"]["errors"] += 1
        
        # Mouvements de stock
        if not document_type or document_type == "stock_movements":
            stock_movements = await self.db.stock_movements.find({
                "company_id": company_oid
            }).to_list(None)
            
            results["stock_movements"]["total"] = len(stock_movements)
            
            for movement in stock_movements:
                entry_id = await self.sync_stock_movement(str(movement["_id"]))
                if entry_id:
                    results["stock_movements"]["synced"] += 1
                else:
                    results["stock_movements"]["errors"] += 1
        
        # Avoirs
        if not document_type or document_type == "credit_notes":
            credit_notes = await self.db.credit_notes.find({
                "company_id": company_oid,
                "status": "validated"
            }).to_list(None)
            
            results["credit_notes"]["total"] = len(credit_notes)
            
            for credit_note in credit_notes:
                entry_id = await self.sync_credit_note(str(credit_note["_id"]))
                if entry_id:
                    results["credit_notes"]["synced"] += 1
                else:
                    results["credit_notes"]["errors"] += 1
        
        return results


# Instance globale du service
accounting_sync_service = AccountingSyncService()
