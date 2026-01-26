"""
Service de génération de rapports comptables
Génère des exports PDF et Excel pour les états comptables
"""

from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime, timezone
from typing import Optional, Dict, List
import os
import pandas as pd
from io import BytesIO
import logging

logger = logging.getLogger(__name__)

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]


class AccountingReportsService:
    """Service pour générer les rapports comptables"""
    
    def __init__(self):
        self.db = db
    
    async def generate_trial_balance_excel(
        self,
        company_id: str,
        date_to: Optional[datetime] = None
    ) -> bytes:
        """Génère la balance des comptes en Excel"""
        
        # Get all accounts
        accounts = await self.db.chart_of_accounts.find({
            "company_id": ObjectId(company_id),
            "is_group": False
        }).sort("code", 1).to_list(2000)
        
        # Calculate balances from journal entries
        query = {
            "company_id": ObjectId(company_id),
            "status": "posted"
        }
        
        if date_to:
            query["date"] = {"$lte": date_to}
        
        entries = await self.db.journal_entries.find(query).to_list(5000)
        
        # Calculate balances
        account_balances = {}
        for entry in entries:
            for line in entry.get("lines", []):
                code = line.get("account_code")
                if code not in account_balances:
                    account_balances[code] = {"debit": 0, "credit": 0}
                account_balances[code]["debit"] += line.get("debit", 0)
                account_balances[code]["credit"] += line.get("credit", 0)
        
        # Prepare data for Excel
        data = []
        total_debit = 0
        total_credit = 0
        
        for account in accounts:
            code = account["code"]
            bal = account_balances.get(code, {"debit": 0, "credit": 0})
            
            if bal["debit"] == 0 and bal["credit"] == 0:
                continue  # Skip accounts with no activity
            
            account_type = account.get("type")
            if account_type in ["asset", "expense"]:
                balance = bal["debit"] - bal["credit"]
                debit_balance = balance if balance > 0 else 0
                credit_balance = -balance if balance < 0 else 0
            else:
                balance = bal["credit"] - bal["debit"]
                credit_balance = balance if balance > 0 else 0
                debit_balance = -balance if balance < 0 else 0
            
            total_debit += debit_balance
            total_credit += credit_balance
            
            data.append({
                "Code": code,
                "Libellé": account["name"],
                "Type": account_type,
                "Mouvement Débit": round(bal["debit"], 3),
                "Mouvement Crédit": round(bal["credit"], 3),
                "Solde Débiteur": round(debit_balance, 3),
                "Solde Créditeur": round(credit_balance, 3)
            })
        
        # Add total row
        data.append({
            "Code": "",
            "Libellé": "TOTAL",
            "Type": "",
            "Mouvement Débit": round(sum(d["Mouvement Débit"] for d in data), 3),
            "Mouvement Crédit": round(sum(d["Mouvement Crédit"] for d in data), 3),
            "Solde Débiteur": round(total_debit, 3),
            "Solde Créditeur": round(total_credit, 3)
        })
        
        # Create Excel file
        df = pd.DataFrame(data)
        
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name='Balance des Comptes', index=False)
            
            # Format the worksheet
            worksheet = writer.sheets['Balance des Comptes']
            for column in worksheet.columns:
                max_length = 0
                column = [cell for cell in column]
                for cell in column:
                    try:
                        if len(str(cell.value)) > max_length:
                            max_length = len(str(cell.value))
                    except:
                        pass
                adjusted_width = min(max_length + 2, 50)
                worksheet.column_dimensions[column[0].column_letter].width = adjusted_width
        
        return output.getvalue()
    
    async def generate_general_ledger_excel(
        self,
        company_id: str,
        account_code: Optional[str] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None
    ) -> bytes:
        """Génère le grand livre en Excel"""
        
        # Build query
        query = {"company_id": ObjectId(company_id), "status": "posted"}
        
        if date_from:
            query["date"] = {"$gte": date_from}
        if date_to:
            if "date" in query:
                query["date"]["$lte"] = date_to
            else:
                query["date"] = {"$lte": date_to}
        
        if account_code:
            query["lines.account_code"] = account_code
        
        entries = await self.db.journal_entries.find(query).sort("date", 1).to_list(5000)
        
        # Group by account
        ledger = {}
        for entry in entries:
            for line in entry.get("lines", []):
                code = line.get("account_code")
                if account_code and code != account_code:
                    continue
                
                if code not in ledger:
                    ledger[code] = {
                        "account_code": code,
                        "account_name": line.get("account_name"),
                        "transactions": []
                    }
                
                ledger[code]["transactions"].append({
                    "Date": entry["date"].strftime("%d/%m/%Y") if entry.get("date") else "",
                    "Référence": entry.get("reference"),
                    "Description": line.get("description"),
                    "Débit": round(line.get("debit", 0), 3),
                    "Crédit": round(line.get("credit", 0), 3)
                })
        
        # Create Excel with multiple sheets (one per account)
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            # Handle empty data case
            if not ledger:
                df_empty = pd.DataFrame([{
                    "Message": "Aucune donnée disponible pour la période sélectionnée"
                }])
                df_empty.to_excel(writer, sheet_name='Aucune donnée', index=False)
            else:
                for code, data in sorted(ledger.items()):
                    df = pd.DataFrame(data["transactions"])
                    
                    # Add totals
                    if not df.empty:
                        totals = {
                            "Date": "",
                            "Référence": "",
                            "Description": "TOTAL",
                            "Débit": df["Débit"].sum(),
                            "Crédit": df["Crédit"].sum()
                        }
                        df = pd.concat([df, pd.DataFrame([totals])], ignore_index=True)
                    
                    sheet_name = f"{code} - {data['account_name'][:20]}"
                    df.to_excel(writer, sheet_name=sheet_name, index=False)
        
        return output.getvalue()
    
    async def generate_auxiliary_ledger_excel(
        self,
        company_id: str,
        ledger_type: str,  # 'customers' or 'suppliers'
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None
    ) -> bytes:
        """Génère le livre de tiers (clients ou fournisseurs) en Excel"""
        
        # Determine account codes based on type
        if ledger_type == 'customers':
            account_codes = ["411", "4111", "4112"]  # Clients
            collection_name = "customers"
        else:  # suppliers
            account_codes = ["401", "4011", "4012"]  # Fournisseurs
            collection_name = "suppliers"
        
        # Build query
        query = {
            "company_id": ObjectId(company_id),
            "status": "posted",
            "lines.account_code": {"$in": account_codes}
        }
        
        if date_from:
            query["date"] = {"$gte": date_from}
        if date_to:
            if "date" in query:
                query["date"]["$lte"] = date_to
            else:
                query["date"] = {"$lte": date_to}
        
        entries = await self.db.journal_entries.find(query).sort("date", 1).to_list(5000)
        
        # Group by third party (customer/supplier)
        third_parties = {}
        
        for entry in entries:
            # Determine customer/supplier from document
            doc_type = entry.get("document_type")
            third_party_id = None
            third_party_name = "Inconnu"
            
            if doc_type == "invoice" and ledger_type == "customers":
                invoice = await self.db.invoices.find_one({"_id": entry.get("document_id")})
                if invoice:
                    third_party_id = str(invoice.get("customer_id"))
                    customer = await self.db.customers.find_one({"_id": invoice.get("customer_id")})
                    if customer:
                        third_party_name = customer.get("display_name", "Inconnu")
            
            elif doc_type == "supplier_invoice" and ledger_type == "suppliers":
                invoice = await self.db.supplier_invoices.find_one({"_id": entry.get("document_id")})
                if invoice:
                    third_party_id = str(invoice.get("supplier_id"))
                    supplier = await self.db.suppliers.find_one({"_id": invoice.get("supplier_id")})
                    if supplier:
                        third_party_name = supplier.get("display_name", "Inconnu")
            
            if not third_party_id:
                continue
            
            if third_party_id not in third_parties:
                third_parties[third_party_id] = {
                    "name": third_party_name,
                    "transactions": []
                }
            
            # Extract relevant lines
            for line in entry.get("lines", []):
                if line.get("account_code") in account_codes:
                    third_parties[third_party_id]["transactions"].append({
                        "Date": entry["date"].strftime("%d/%m/%Y") if entry.get("date") else "",
                        "Référence": entry.get("reference"),
                        "Description": line.get("description"),
                        "Débit": round(line.get("debit", 0), 3),
                        "Crédit": round(line.get("credit", 0), 3)
                    })
        
        # Create Excel with one sheet per third party
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            for third_party_id, data in third_parties.items():
                if not data["transactions"]:
                    continue
                
                df = pd.DataFrame(data["transactions"])
                
                # Add totals
                totals = {
                    "Date": "",
                    "Référence": "",
                    "Description": "TOTAL",
                    "Débit": df["Débit"].sum(),
                    "Crédit": df["Crédit"].sum()
                }
                df = pd.concat([df, pd.DataFrame([totals])], ignore_index=True)
                
                # Add balance
                balance_value = df.iloc[-1]["Débit"] - df.iloc[-1]["Crédit"]
                balance = {
                    "Date": "",
                    "Référence": "",
                    "Description": "SOLDE",
                    "Débit": balance_value if balance_value > 0 else 0,
                    "Crédit": -balance_value if balance_value < 0 else 0
                }
                df = pd.concat([df, pd.DataFrame([balance])], ignore_index=True)
                
                sheet_name = data["name"][:30]  # Excel sheet name limit
                df.to_excel(writer, sheet_name=sheet_name, index=False)
        
        return output.getvalue()


# Create singleton instance
accounting_reports_service = AccountingReportsService()
