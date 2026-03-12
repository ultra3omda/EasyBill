import re

from services.learning_pattern_service import LearningPatternService, normalize_pattern
from services.supplier_account_suggestion_service import SupplierAccountSuggestionService


class TransactionClassifierService:
    RULES = [
        ("bank_fee", ("FRAIS", "COMMISSION", "AGIOS")),
        ("salary_payment", ("SALAIRE", "PAIE")),
        ("tax_payment", ("TVA", "IMPOT", "CNSS", "RETENUE")),
        ("internal_transfer", ("VIR PROPRE", "VIREMENT INTERNE", "TRANSFERT")),
        ("refund", ("REMBOURSEMENT", "AVOIR", "EXTOURNE")),
    ]

    def __init__(self, db):
        self.db = db
        self.learning_service = LearningPatternService(db)
        self.supplier_mapping_service = SupplierAccountSuggestionService(db)

    async def classify(self, company_id: str, transaction: dict):
        label = transaction.get("label_raw") or transaction.get("label_clean") or transaction.get("description") or ""
        normalized = normalize_pattern(label)
        amount_signed = float(transaction.get("amount_signed") or 0)

        for tx_type, patterns in self.RULES:
            if any(pattern in normalized for pattern in patterns):
                return {
                    "transaction_type": tx_type,
                    "confidence": 92,
                    "reasoning": f"Motif déterministe: {tx_type}",
                    "source": "deterministic_rule",
                }

        learned = await self.learning_service.find_patterns(company_id, "transaction_label", label)
        if learned:
            pattern = learned[0]
            confidence = 70 + min(25, int(pattern.get("times_confirmed", 0)) * 5)
            return {
                "transaction_type": pattern.get("transaction_type", "unknown"),
                "confidence": confidence,
                "reasoning": f"Pattern appris: {pattern.get('raw_pattern')}",
                "source": "learning_pattern",
            }

        supplier_mapping = await self.supplier_mapping_service.suggest_mapping(company_id, None, label)
        if supplier_mapping:
            return {
                "transaction_type": "expense" if amount_signed < 0 else "supplier_payment",
                "confidence": 78,
                "reasoning": f"Mapping fournisseur: {supplier_mapping.get('supplier_pattern')}",
                "source": "supplier_mapping",
                "supplier_mapping": supplier_mapping,
            }

        if amount_signed > 0 and re.search(r"\b(VIR|VMT|VERSEMENT|REMISE)\b", normalized):
            return {
                "transaction_type": "customer_payment",
                "confidence": 72,
                "reasoning": "Entrée d'argent avec libellé de virement",
                "source": "heuristic",
            }
        if amount_signed < 0 and re.search(r"\b(PRLV|PRELEVEMENT|FOURN|FACTURE|VIR)\b", normalized):
            return {
                "transaction_type": "supplier_payment",
                "confidence": 70,
                "reasoning": "Sortie d'argent avec libellé fournisseur/prélèvement",
                "source": "heuristic",
            }

        return {
            "transaction_type": "unknown",
            "confidence": 35,
            "reasoning": "Aucune règle forte trouvée",
            "source": "default",
        }
