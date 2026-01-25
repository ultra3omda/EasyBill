"""
Service d'Import/Export de Contacts (CSV/Excel)
Permet d'importer et exporter les clients et fournisseurs
"""

import csv
import io
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Tuple
from bson import ObjectId
import logging

logger = logging.getLogger(__name__)


class ImportExportService:
    """Service pour l'import et l'export de contacts"""
    
    # Mapping des colonnes pour les clients
    CUSTOMER_COLUMNS = {
        "company_name": ["company_name", "entreprise", "société", "nom entreprise", "raison sociale"],
        "first_name": ["first_name", "prénom", "prenom"],
        "last_name": ["last_name", "nom", "nom de famille"],
        "email": ["email", "e-mail", "courriel", "mail"],
        "phone": ["phone", "téléphone", "telephone", "tel", "mobile"],
        "tax_id": ["tax_id", "matricule fiscal", "mf", "identifiant fiscal"],
        "address": ["address", "adresse", "rue"],
        "city": ["city", "ville", "gouvernorat"],
        "postal_code": ["postal_code", "code postal", "cp"],
        "country": ["country", "pays"],
        "website": ["website", "site web", "site internet", "url"],
        "notes": ["notes", "remarques", "commentaires"]
    }
    
    # Mapping des colonnes pour les fournisseurs
    SUPPLIER_COLUMNS = {
        "company_name": ["company_name", "entreprise", "société", "nom entreprise", "raison sociale"],
        "contact_name": ["contact_name", "contact", "nom contact"],
        "email": ["email", "e-mail", "courriel", "mail"],
        "phone": ["phone", "téléphone", "telephone", "tel", "mobile"],
        "tax_id": ["tax_id", "matricule fiscal", "mf", "identifiant fiscal"],
        "address": ["address", "adresse", "rue"],
        "city": ["city", "ville", "gouvernorat"],
        "postal_code": ["postal_code", "code postal", "cp"],
        "country": ["country", "pays"],
        "website": ["website", "site web", "site internet", "url"],
        "payment_terms": ["payment_terms", "conditions paiement", "délai paiement"],
        "notes": ["notes", "remarques", "commentaires"]
    }
    
    def __init__(self, db):
        self.db = db
    
    def _normalize_header(self, header: str) -> str:
        """Normalise un en-tête de colonne"""
        return header.lower().strip().replace("_", " ")
    
    def _map_column(self, header: str, mapping: Dict[str, List[str]]) -> Optional[str]:
        """Trouve le champ correspondant à un en-tête"""
        normalized = self._normalize_header(header)
        for field, aliases in mapping.items():
            if normalized in [a.lower() for a in aliases]:
                return field
        return None
    
    def _detect_delimiter(self, content: str) -> str:
        """Détecte le délimiteur CSV (virgule ou point-virgule)"""
        first_line = content.split('\n')[0] if '\n' in content else content
        semicolons = first_line.count(';')
        commas = first_line.count(',')
        return ';' if semicolons > commas else ','
    
    async def import_customers_csv(
        self,
        csv_content: str,
        company_id: str,
        user_id: str,
        update_existing: bool = False
    ) -> Dict[str, Any]:
        """
        Importe des clients depuis un fichier CSV
        
        Returns:
            Dict avec les résultats: created, updated, errors, skipped
        """
        results = {
            "created": 0,
            "updated": 0,
            "skipped": 0,
            "errors": [],
            "total_rows": 0
        }
        
        try:
            # Détecter le délimiteur
            delimiter = self._detect_delimiter(csv_content)
            
            # Parser le CSV
            reader = csv.DictReader(io.StringIO(csv_content), delimiter=delimiter)
            
            # Mapper les colonnes
            column_mapping = {}
            for header in reader.fieldnames or []:
                mapped = self._map_column(header, self.CUSTOMER_COLUMNS)
                if mapped:
                    column_mapping[header] = mapped
            
            if not column_mapping:
                results["errors"].append("Aucune colonne reconnue dans le fichier CSV")
                return results
            
            # Traiter chaque ligne
            for row_num, row in enumerate(reader, start=2):
                results["total_rows"] += 1
                
                try:
                    # Extraire les données mappées
                    customer_data = {}
                    for csv_col, field in column_mapping.items():
                        value = row.get(csv_col, "").strip()
                        if value:
                            customer_data[field] = value
                    
                    # Vérifier les champs obligatoires
                    if not customer_data.get("company_name") and not customer_data.get("last_name"):
                        results["errors"].append(f"Ligne {row_num}: Nom d'entreprise ou nom de famille requis")
                        results["skipped"] += 1
                        continue
                    
                    # Vérifier si le client existe déjà (par email ou matricule fiscal)
                    existing = None
                    if customer_data.get("email"):
                        existing = await self.db.customers.find_one({
                            "company_id": ObjectId(company_id),
                            "email": customer_data["email"].lower()
                        })
                    
                    if not existing and customer_data.get("tax_id"):
                        existing = await self.db.customers.find_one({
                            "company_id": ObjectId(company_id),
                            "tax_id": customer_data["tax_id"]
                        })
                    
                    if existing:
                        if update_existing:
                            # Mettre à jour le client existant
                            customer_data["updated_at"] = datetime.now(timezone.utc)
                            await self.db.customers.update_one(
                                {"_id": existing["_id"]},
                                {"$set": customer_data}
                            )
                            results["updated"] += 1
                        else:
                            results["skipped"] += 1
                    else:
                        # Créer un nouveau client
                        customer_data["company_id"] = ObjectId(company_id)
                        customer_data["created_by"] = ObjectId(user_id)
                        customer_data["created_at"] = datetime.now(timezone.utc)
                        customer_data["updated_at"] = datetime.now(timezone.utc)
                        customer_data["type"] = "company" if customer_data.get("company_name") else "individual"
                        customer_data["country"] = customer_data.get("country", "Tunisie")
                        customer_data["currency"] = "TND"
                        
                        if customer_data.get("email"):
                            customer_data["email"] = customer_data["email"].lower()
                        
                        await self.db.customers.insert_one(customer_data)
                        results["created"] += 1
                
                except Exception as e:
                    results["errors"].append(f"Ligne {row_num}: {str(e)}")
                    results["skipped"] += 1
        
        except Exception as e:
            results["errors"].append(f"Erreur de parsing CSV: {str(e)}")
        
        return results
    
    async def import_suppliers_csv(
        self,
        csv_content: str,
        company_id: str,
        user_id: str,
        update_existing: bool = False
    ) -> Dict[str, Any]:
        """
        Importe des fournisseurs depuis un fichier CSV
        """
        results = {
            "created": 0,
            "updated": 0,
            "skipped": 0,
            "errors": [],
            "total_rows": 0
        }
        
        try:
            delimiter = self._detect_delimiter(csv_content)
            reader = csv.DictReader(io.StringIO(csv_content), delimiter=delimiter)
            
            column_mapping = {}
            for header in reader.fieldnames or []:
                mapped = self._map_column(header, self.SUPPLIER_COLUMNS)
                if mapped:
                    column_mapping[header] = mapped
            
            if not column_mapping:
                results["errors"].append("Aucune colonne reconnue dans le fichier CSV")
                return results
            
            for row_num, row in enumerate(reader, start=2):
                results["total_rows"] += 1
                
                try:
                    supplier_data = {}
                    for csv_col, field in column_mapping.items():
                        value = row.get(csv_col, "").strip()
                        if value:
                            supplier_data[field] = value
                    
                    if not supplier_data.get("company_name"):
                        results["errors"].append(f"Ligne {row_num}: Nom d'entreprise requis")
                        results["skipped"] += 1
                        continue
                    
                    existing = None
                    if supplier_data.get("email"):
                        existing = await self.db.suppliers.find_one({
                            "company_id": ObjectId(company_id),
                            "email": supplier_data["email"].lower()
                        })
                    
                    if not existing and supplier_data.get("tax_id"):
                        existing = await self.db.suppliers.find_one({
                            "company_id": ObjectId(company_id),
                            "tax_id": supplier_data["tax_id"]
                        })
                    
                    if existing:
                        if update_existing:
                            supplier_data["updated_at"] = datetime.now(timezone.utc)
                            await self.db.suppliers.update_one(
                                {"_id": existing["_id"]},
                                {"$set": supplier_data}
                            )
                            results["updated"] += 1
                        else:
                            results["skipped"] += 1
                    else:
                        supplier_data["company_id"] = ObjectId(company_id)
                        supplier_data["created_by"] = ObjectId(user_id)
                        supplier_data["created_at"] = datetime.now(timezone.utc)
                        supplier_data["updated_at"] = datetime.now(timezone.utc)
                        supplier_data["country"] = supplier_data.get("country", "Tunisie")
                        supplier_data["currency"] = "TND"
                        
                        if supplier_data.get("email"):
                            supplier_data["email"] = supplier_data["email"].lower()
                        
                        await self.db.suppliers.insert_one(supplier_data)
                        results["created"] += 1
                
                except Exception as e:
                    results["errors"].append(f"Ligne {row_num}: {str(e)}")
                    results["skipped"] += 1
        
        except Exception as e:
            results["errors"].append(f"Erreur de parsing CSV: {str(e)}")
        
        return results
    
    async def export_customers_csv(
        self,
        company_id: str,
        filters: Optional[Dict] = None
    ) -> str:
        """
        Exporte les clients vers un fichier CSV
        """
        query = {"company_id": ObjectId(company_id)}
        if filters:
            query.update(filters)
        
        customers = await self.db.customers.find(query).to_list(None)
        
        output = io.StringIO()
        fieldnames = [
            "company_name", "first_name", "last_name", "email", "phone",
            "tax_id", "address", "city", "postal_code", "country",
            "website", "notes", "type", "currency"
        ]
        
        writer = csv.DictWriter(output, fieldnames=fieldnames, delimiter=';')
        writer.writeheader()
        
        for customer in customers:
            row = {field: customer.get(field, "") for field in fieldnames}
            writer.writerow(row)
        
        return output.getvalue()
    
    async def export_suppliers_csv(
        self,
        company_id: str,
        filters: Optional[Dict] = None
    ) -> str:
        """
        Exporte les fournisseurs vers un fichier CSV
        """
        query = {"company_id": ObjectId(company_id)}
        if filters:
            query.update(filters)
        
        suppliers = await self.db.suppliers.find(query).to_list(None)
        
        output = io.StringIO()
        fieldnames = [
            "company_name", "contact_name", "email", "phone",
            "tax_id", "address", "city", "postal_code", "country",
            "website", "payment_terms", "notes", "currency"
        ]
        
        writer = csv.DictWriter(output, fieldnames=fieldnames, delimiter=';')
        writer.writeheader()
        
        for supplier in suppliers:
            row = {field: supplier.get(field, "") for field in fieldnames}
            writer.writerow(row)
        
        return output.getvalue()
    
    def get_csv_template_customers(self) -> str:
        """Retourne un template CSV pour l'import de clients"""
        output = io.StringIO()
        fieldnames = [
            "company_name", "first_name", "last_name", "email", "phone",
            "tax_id", "address", "city", "postal_code", "country", "website", "notes"
        ]
        
        writer = csv.DictWriter(output, fieldnames=fieldnames, delimiter=';')
        writer.writeheader()
        
        # Ajouter une ligne d'exemple
        writer.writerow({
            "company_name": "ABC SARL",
            "first_name": "Mohamed",
            "last_name": "Ben Ali",
            "email": "contact@abc.tn",
            "phone": "+216 71 123 456",
            "tax_id": "1234567ABC",
            "address": "123 Avenue Habib Bourguiba",
            "city": "Tunis",
            "postal_code": "1000",
            "country": "Tunisie",
            "website": "www.abc.tn",
            "notes": "Client VIP"
        })
        
        return output.getvalue()
    
    def get_csv_template_suppliers(self) -> str:
        """Retourne un template CSV pour l'import de fournisseurs"""
        output = io.StringIO()
        fieldnames = [
            "company_name", "contact_name", "email", "phone",
            "tax_id", "address", "city", "postal_code", "country",
            "website", "payment_terms", "notes"
        ]
        
        writer = csv.DictWriter(output, fieldnames=fieldnames, delimiter=';')
        writer.writeheader()
        
        writer.writerow({
            "company_name": "Fournisseur XYZ",
            "contact_name": "Ahmed Trabelsi",
            "email": "contact@xyz.tn",
            "phone": "+216 71 987 654",
            "tax_id": "9876543XYZ",
            "address": "456 Rue de la Liberté",
            "city": "Sfax",
            "postal_code": "3000",
            "country": "Tunisie",
            "website": "www.xyz.tn",
            "payment_terms": "30 jours",
            "notes": "Fournisseur principal"
        })
        
        return output.getvalue()
