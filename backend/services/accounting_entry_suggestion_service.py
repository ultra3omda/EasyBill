from services.account_resolution_service import AccountResolutionService


class AccountingEntrySuggestionService:
    def __init__(self, db):
        self.db = db
        self.account_resolution = AccountResolutionService(db)

    async def suggest_for_transaction(self, company_id: str, transaction: dict, matched_entity: dict | None = None):
        tx_type = transaction.get("transaction_type") or "unknown"
        amount = abs(float(transaction.get("amount_signed") or 0))
        label = transaction.get("label_raw") or transaction.get("description") or ""

        bank = await self.account_resolution.resolve_account(company_id, "bank", "Banque")
        supplier = await self.account_resolution.resolve_account(company_id, "supplier_payable", "Fournisseurs")
        customer = await self.account_resolution.resolve_account(company_id, "customer_receivable", "Clients")
        bank_fee = await self.account_resolution.resolve_account(company_id, "bank_fee", "Frais bancaires")
        suspense = await self.account_resolution.resolve_account(company_id, "suspense", "Compte d'attente")

        if matched_entity and matched_entity.get("entity_type") == "supplier_invoice":
            return {
                "journal_code": "BQ",
                "reasoning": "Règlement facture fournisseur existante",
                "lines": [
                    {"account_code": supplier["code"], "account_name": supplier["name"], "debit": amount, "credit": 0, "description": label},
                    {"account_code": bank["code"], "account_name": bank["name"], "debit": 0, "credit": amount, "description": label},
                ],
            }
        if matched_entity and matched_entity.get("entity_type") == "invoice":
            return {
                "journal_code": "BQ",
                "reasoning": "Encaissement facture client existante",
                "lines": [
                    {"account_code": bank["code"], "account_name": bank["name"], "debit": amount, "credit": 0, "description": label},
                    {"account_code": customer["code"], "account_name": customer["name"], "debit": 0, "credit": amount, "description": label},
                ],
            }
        if tx_type == "bank_fee":
            return {
                "journal_code": "BQ",
                "reasoning": "Frais bancaires",
                "lines": [
                    {"account_code": bank_fee["code"], "account_name": bank_fee["name"], "debit": amount, "credit": 0, "description": label},
                    {"account_code": bank["code"], "account_name": bank["name"], "debit": 0, "credit": amount, "description": label},
                ],
            }
        if tx_type == "customer_payment":
            return {
                "journal_code": "BQ",
                "reasoning": "Règlement client suggéré",
                "lines": [
                    {"account_code": bank["code"], "account_name": bank["name"], "debit": amount, "credit": 0, "description": label},
                    {"account_code": customer["code"], "account_name": customer["name"], "debit": 0, "credit": amount, "description": label},
                ],
            }
        if tx_type in ("supplier_payment", "expense"):
            expense_account = matched_entity.get("expense_account") if matched_entity else None
            if expense_account:
                return {
                    "journal_code": "BQ",
                    "reasoning": "Décaissement fournisseur sans facture, charge directe",
                    "lines": [
                        {"account_code": expense_account["code"], "account_name": expense_account["name"], "debit": amount, "credit": 0, "description": label},
                        {"account_code": bank["code"], "account_name": bank["name"], "debit": 0, "credit": amount, "description": label},
                    ],
                }
            return {
                "journal_code": "BQ",
                "reasoning": "Règlement fournisseur suggéré",
                "lines": [
                    {"account_code": supplier["code"], "account_name": supplier["name"], "debit": amount, "credit": 0, "description": label},
                    {"account_code": bank["code"], "account_name": bank["name"], "debit": 0, "credit": amount, "description": label},
                ],
            }
        return {
            "journal_code": "BQ",
            "reasoning": "Flux non identifié, compte d'attente",
            "lines": [
                {"account_code": suspense["code"], "account_name": suspense["name"], "debit": amount if float(transaction.get("amount_signed") or 0) < 0 else 0, "credit": amount if float(transaction.get("amount_signed") or 0) > 0 else 0, "description": label},
                {"account_code": bank["code"], "account_name": bank["name"], "debit": amount if float(transaction.get("amount_signed") or 0) > 0 else 0, "credit": amount if float(transaction.get("amount_signed") or 0) < 0 else 0, "description": label},
            ],
        }
