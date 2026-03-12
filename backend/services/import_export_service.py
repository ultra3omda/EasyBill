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
import re

logger = logging.getLogger(__name__)


class ImportExportService:
    """Service pour l'import et l'export de contacts"""
    
    # Mapping des colonnes pour les clients (inclut aliases Odoo)
    CUSTOMER_COLUMNS = {
        "company_name": ["company_name", "entreprise", "société", "nom entreprise", "raison sociale",
                         "partner", "client", "customer", "contact", "partner_id", "name"],
        "first_name": ["first_name", "prénom", "prenom"],
        "last_name": ["last_name", "nom", "nom de famille"],
        "email": ["email", "e-mail", "courriel", "mail"],
        "phone": ["phone", "téléphone", "telephone", "tel", "mobile"],
        "tax_id": ["tax_id", "matricule fiscal", "mf", "identifiant fiscal", "vat", "siret"],
        "address": ["address", "adresse", "rue", "street"],
        "city": ["city", "ville", "gouvernorat"],
        "postal_code": ["postal_code", "code postal", "cp", "zip"],
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
                    
                    # Vérifier si le client existe déjà (par email, matricule fiscal ou nom)
                    existing = None
                    if customer_data.get("email"):
                        existing = await self.db.customers.find_one({
                            "company_id": ObjectId(company_id),
                            "email": customer_data["email"].lower()
                        })
                    if not existing and customer_data.get("tax_id"):
                        existing = await self.db.customers.find_one({
                            "company_id": ObjectId(company_id),
                            "fiscal_id": customer_data["tax_id"]
                        })
                    if not existing and customer_data.get("company_name"):
                        existing = await self.db.customers.find_one({
                            "company_id": ObjectId(company_id),
                            "$or": [
                                {"display_name": {"$regex": customer_data["company_name"].strip(), "$options": "i"}},
                                {"company_name": {"$regex": customer_data["company_name"].strip(), "$options": "i"}}
                            ]
                        })
                    
                    if existing:
                        if update_existing:
                            display_name = customer_data.get("company_name") or customer_data.get("last_name") or customer_data.get("first_name", "Client")
                            if customer_data.get("last_name") and customer_data.get("first_name") and not customer_data.get("company_name"):
                                display_name = f"{customer_data['last_name']}, {customer_data['first_name']}"
                            customer_data["display_name"] = display_name
                            if "tax_id" in customer_data:
                                customer_data["fiscal_id"] = customer_data.pop("tax_id")
                            customer_data["updated_at"] = datetime.now(timezone.utc)
                            customer_data.pop("type", None)
                            await self.db.customers.update_one(
                                {"_id": existing["_id"]},
                                {"$set": customer_data}
                            )
                            results["updated"] += 1
                        else:
                            results["skipped"] += 1
                    else:
                        # Créer un nouveau client
                        display_name = customer_data.get("company_name") or customer_data.get("last_name") or customer_data.get("first_name", "Client")
                        if customer_data.get("last_name") and customer_data.get("first_name") and not customer_data.get("company_name"):
                            display_name = f"{customer_data['last_name']}, {customer_data['first_name']}"
                        elif customer_data.get("company_name"):
                            display_name = customer_data["company_name"]
                        customer_data["display_name"] = display_name
                        if "tax_id" in customer_data:
                            customer_data["fiscal_id"] = customer_data.pop("tax_id")
                        customer_data["company_id"] = ObjectId(company_id)
                        customer_data["created_by"] = ObjectId(user_id)
                        customer_data["created_at"] = datetime.now(timezone.utc)
                        customer_data["updated_at"] = datetime.now(timezone.utc)
                        customer_data["balance"] = 0.0
                        customer_data["total_invoiced"] = 0.0
                        customer_data["total_paid"] = 0.0
                        customer_data["invoice_count"] = 0
                        customer_data["quote_count"] = 0
                        customer_data["country"] = customer_data.get("country", "Tunisie")
                        customer_data["currency"] = "TND"
                        addr = customer_data.pop("address", "") or ""
                        customer_data["billing_address"] = {"street": addr, "city": customer_data.get("city", ""), "postal_code": customer_data.get("postal_code", ""), "country": customer_data.get("country", "Tunisie")}
                        if customer_data.get("email"):
                            customer_data["email"] = customer_data["email"].lower()
                        customer_data.pop("type", None)
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
    
    # Mapping des colonnes pour l'import Odoo (factures)
    INVOICE_COLUMNS = {
        "invoice_number": ["name", "number", "reference", "invoice_number", "numéro", "numero", "invoice"],
        "customer_name": ["partner", "partner_id", "partner id", "client", "customer", "contact", "customer_name"],
        "date": ["date", "date_invoice", "invoice_date", "date facture"],
        "due_date": ["date_due", "due_date", "date_due", "date échéance", "echeance"],
        "subtotal": ["amount_untaxed", "untaxed_amount", "subtotal", "montant ht", "ht"],
        "total_tax": ["amount_tax", "tax", "total_tax", "tva", "montant tva"],
        "total": ["amount_total", "total", "amount_total", "montant ttc", "ttc"],
        "amount_paid": ["amount_paid", "paid", "montant paye"],
        "status": ["state", "status", "statut"],
        "description": ["description", "product", "product_name", "name", "designation"],
        "quantity": ["quantity", "qty", "quantite"],
        "unit_price": ["price_unit", "unit_price", "prix unitaire"],
        "line_subtotal": ["price_subtotal", "subtotal", "amount", "montant"],
        "tax_rate": ["tax_rate", "tax", "taux tva"],
    }

    async def import_odoo_invoices_csv(
        self,
        csv_content: str,
        company_id: str,
        user_id: str,
        use_odoo_number: bool = True,
        default_status: str = "sent"
    ) -> Dict[str, Any]:
        """
        Importe des factures Odoo (clients + factures) depuis un fichier CSV.
        Crée d'abord les clients manquants, puis les factures avec leurs lignes.
        Supporte le format Odoo : une ligne par facture ou une ligne par ligne de facture.
        """
        results = {"customers_created": 0, "invoices_created": 0, "invoices_skipped": 0, "errors": []}
        try:
            delimiter = self._detect_delimiter(csv_content)
            reader = csv.DictReader(io.StringIO(csv_content), delimiter=delimiter)
            column_mapping = {}
            for header in reader.fieldnames or []:
                mapped = self._map_column(header, self.INVOICE_COLUMNS)
                if mapped:
                    column_mapping[header] = mapped

            if not column_mapping.get("invoice_number") and not column_mapping.get("customer_name"):
                results["errors"].append("Colonnes requises: numéro de facture et client (Partner)")
                return results

            rows = list(reader)
            invoices_by_number: Dict[str, List[Dict]] = {}
            for row in rows:
                inv_num = self._get_mapped_value(row, column_mapping, "invoice_number")
                cust_name = self._get_mapped_value(row, column_mapping, "customer_name")
                if not inv_num or not cust_name:
                    continue
                inv_num = str(inv_num).strip()
                data = {k: self._get_mapped_value(row, column_mapping, k) for k in [
                    "invoice_number", "customer_name", "date", "due_date",
                    "subtotal", "total_tax", "total", "amount_paid", "status",
                    "description", "quantity", "unit_price", "line_subtotal", "tax_rate"
                ]}
                data["_raw"] = row
                if inv_num not in invoices_by_number:
                    invoices_by_number[inv_num] = []
                invoices_by_number[inv_num].append(data)

            company_oid = ObjectId(company_id)
            user_oid = ObjectId(user_id)
            numbering = await self._get_invoice_numbering(company_oid)
            customer_cache: Dict[str, ObjectId] = {}

            for inv_num, lines in invoices_by_number.items():
                try:
                    first = lines[0]
                    cust_name = str(first.get("customer_name", "")).strip()
                    if not cust_name:
                        results["invoices_skipped"] += 1
                        continue

                    customer_id = await self._get_or_create_customer(
                        company_oid, user_oid, cust_name, first.get("_raw", {}), customer_cache, results
                    )
                    if not customer_id:
                        results["invoices_skipped"] += 1
                        continue

                    inv_date = self._parse_date(first.get("date"))
                    due_date = self._parse_date(first.get("due_date")) or inv_date
                    if not inv_date:
                        inv_date = datetime.now(timezone.utc)

                    items = []
                    total_from_lines = 0.0
                    for line in lines:
                        qty = self._parse_float(line.get("quantity"), 1.0)
                        unit_price = self._parse_float(line.get("unit_price"))
                        desc = str(line.get("description", "")).strip() or "Ligne importée"
                        line_sub = self._parse_float(line.get("line_subtotal"))
                        tax_rate = self._parse_float(line.get("tax_rate"), 0)
                        if unit_price is None and line_sub is not None and qty > 0:
                            unit_price = line_sub / qty
                        if unit_price is None:
                            unit_price = 0.0
                        total_from_lines += (qty * unit_price) * (1 + tax_rate / 100) if tax_rate else qty * unit_price
                        items.append({
                            "description": desc,
                            "quantity": qty,
                            "unit_price": unit_price,
                            "tax_rate": tax_rate,
                            "discount": 0,
                            "total": round(qty * unit_price * (1 + tax_rate / 100), 3)
                        })

                    if not items:
                        total_val = self._parse_float(first.get("total")) or 0.0
                        subtotal_val = self._parse_float(first.get("subtotal")) or total_val
                        tax_val = self._parse_float(first.get("total_tax")) or 0.0
                        items = [{
                            "description": f"Facture {inv_num}",
                            "quantity": 1,
                            "unit_price": round(subtotal_val, 3),
                            "tax_rate": round(tax_val / subtotal_val * 100, 2) if subtotal_val else 0,
                            "discount": 0,
                            "total": round(total_val, 3)
                        }]

                    subtotal = sum(it["quantity"] * it["unit_price"] for it in items)
                    total_tax = sum((it["quantity"] * it["unit_price"]) * (it.get("tax_rate", 0) / 100) for it in items)
                    total = round(subtotal + total_tax, 3)
                    amount_paid = self._parse_float(first.get("amount_paid")) or 0.0
                    balance_due = max(0, total - amount_paid)
                    status = str(first.get("status", default_status)).lower()
                    if status not in ["draft", "sent", "partial", "paid", "overdue", "cancelled"]:
                        status = "paid" if amount_paid >= total else ("partial" if amount_paid > 0 else default_status)

                    invoice_number = inv_num if use_odoo_number else self._next_invoice_number(numbering)
                    if not use_odoo_number:
                        numbering["next"] += 1

                    inv_doc = {
                        "company_id": company_oid,
                        "customer_id": customer_id,
                        "number": invoice_number,
                        "date": inv_date,
                        "due_date": due_date,
                        "subject": f"Facture {invoice_number}",
                        "items": items,
                        "subtotal": round(subtotal, 3),
                        "total_tax": round(total_tax, 3),
                        "total_discount": 0,
                        "total": total,
                        "amount_paid": round(amount_paid, 3),
                        "balance_due": round(balance_due, 3),
                        "status": status,
                        "created_at": datetime.now(timezone.utc),
                        "updated_at": datetime.now(timezone.utc),
                        "created_by": user_oid,
                        "paid_at": datetime.now(timezone.utc) if status == "paid" else None
                    }
                    await self.db.invoices.insert_one(inv_doc)
                    await self.db.customers.update_one(
                        {"_id": customer_id},
                        {"$inc": {"invoice_count": 1, "total_invoiced": total, "balance": balance_due, "total_paid": amount_paid}}
                    )
                    if not use_odoo_number:
                        await self.db.companies.update_one(
                            {"_id": company_oid},
                            {"$inc": {"numbering.invoice_next": 1}}
                        )
                    results["invoices_created"] += 1
                except Exception as e:
                    results["errors"].append(f"Facture {inv_num}: {str(e)}")
                    results["invoices_skipped"] += 1

        except Exception as e:
            results["errors"].append(f"Erreur: {str(e)}")
        return results

    def _get_mapped_value(self, row: Dict, mapping: Dict, field: str) -> Optional[str]:
        for csv_col, f in mapping.items():
            if f == field:
                v = row.get(csv_col, "")
                return str(v).strip() if v else None
        return None

    def _parse_float(self, val: Any, default: Optional[float] = None) -> Optional[float]:
        if val is None or val == "":
            return default
        try:
            s = str(val).replace(",", ".").replace(" ", "")
            return float(re.sub(r"[^\d.\-]", "", s))
        except (ValueError, TypeError):
            return default

    def _parse_date(self, val: Any) -> Optional[datetime]:
        if not val:
            return None
        s = str(val).strip()
        for fmt in ["%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%Y/%m/%d", "%d.%m.%Y"]:
            try:
                return datetime.strptime(s[:10], fmt).replace(tzinfo=timezone.utc)
            except ValueError:
                continue
        return None

    async def _get_invoice_numbering(self, company_oid: ObjectId) -> Dict:
        company = await self.db.companies.find_one({"_id": company_oid})
        numbering = company.get("numbering", {}) or {}
        return {
            "prefix": numbering.get("invoice_prefix", "FAC"),
            "next": numbering.get("invoice_next", 1),
            "year": datetime.now().year
        }

    def _next_invoice_number(self, numbering: Dict) -> str:
        return f"{numbering['prefix']}-{numbering['year']}-{numbering['next']:05d}"

    async def _get_or_create_customer(
        self,
        company_oid: ObjectId,
        user_oid: ObjectId,
        name: str,
        raw_row: Dict,
        cache: Dict[str, ObjectId],
        results: Dict
    ) -> Optional[ObjectId]:
        if name in cache:
            return cache[name]
        existing = await self.db.customers.find_one({
            "company_id": company_oid,
            "$or": [
                {"display_name": {"$regex": re.escape(name), "$options": "i"}},
                {"company_name": {"$regex": re.escape(name), "$options": "i"}}
            ]
        })
        if existing:
            cache[name] = existing["_id"]
            return existing["_id"]
        display_name = name
        parts = name.split(",", 1)
        first_name = parts[0].strip() if parts else name
        last_name = parts[1].strip() if len(parts) > 1 else ""
        if not last_name:
            last_name = first_name
            first_name = ""
        customer_data = {
            "company_id": company_oid,
            "display_name": display_name,
            "first_name": first_name or "Client",
            "last_name": last_name,
            "company_name": name if " " in name or len(name) > 20 else None,
            "email": raw_row.get("Email") or raw_row.get("email") or "",
            "phone": raw_row.get("Phone") or raw_row.get("phone") or raw_row.get("Téléphone") or "",
            "fiscal_id": raw_row.get("VAT") or raw_row.get("vat") or raw_row.get("Matricule fiscal") or "",
            "billing_address": {"street": "", "city": "", "postal_code": "", "country": "Tunisie"},
            "balance": 0, "total_invoiced": 0, "total_paid": 0, "invoice_count": 0, "quote_count": 0,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            "created_by": user_oid
        }
        for k, v in raw_row.items():
            k_lower = str(k).lower()
            if "email" in k_lower and not customer_data["email"] and v:
                customer_data["email"] = str(v).strip()
            elif ("phone" in k_lower or "tel" in k_lower) and not customer_data["phone"] and v:
                customer_data["phone"] = str(v).strip()
            elif ("vat" in k_lower or "matricule" in k_lower) and not customer_data["fiscal_id"] and v:
                customer_data["fiscal_id"] = str(v).strip()
        if customer_data["email"]:
            customer_data["email"] = customer_data["email"].lower()
        result = await self.db.customers.insert_one(customer_data)
        cache[name] = result.inserted_id
        results["customers_created"] = results.get("customers_created", 0) + 1
        return result.inserted_id

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
