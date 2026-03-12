from datetime import datetime, timedelta, timezone
from difflib import SequenceMatcher

from bson import ObjectId

from services.accounting_entry_suggestion_service import AccountingEntrySuggestionService
from services.learning_pattern_service import LearningPatternService, normalize_pattern
from services.supplier_account_suggestion_service import SupplierAccountSuggestionService
from services.transaction_classifier_service import TransactionClassifierService


def _safe_date(value):
    if not value:
        return None
    if hasattr(value, "date"):
        return value
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except Exception:
        return None


def _similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, normalize_pattern(a), normalize_pattern(b)).ratio()


class ReconciliationEngineService:
    DEFAULT_SETTINGS = {
        "softWarningTransactionLines": 120,
        "maxTransactionLinesPerImport": 300,
        "reconciliationChunkSize": 50,
        "maxLLMCallsPerImport": 3,
        "candidateSearchDateWindowDays": 21,
        "candidateAmountTolerance": 0.01,
    }

    def __init__(self, db):
        self.db = db
        self.classifier = TransactionClassifierService(db)
        self.learning = LearningPatternService(db)
        self.supplier_mapping_service = SupplierAccountSuggestionService(db)
        self.entry_suggestion_service = AccountingEntrySuggestionService(db)

    async def get_company_settings(self, company_id: str):
        company = await self.db.companies.find_one({"_id": ObjectId(company_id)})
        accounting_settings = (company or {}).get("accounting_settings") or {}
        result = dict(self.DEFAULT_SETTINGS)
        result.update(accounting_settings.get("processing_controls") or {})
        return result

    async def estimate_complexity(self, transactions: list, company_id: str):
        settings = await self.get_company_settings(company_id)
        line_count = len(transactions or [])
        if line_count > settings["maxTransactionLinesPerImport"]:
            return {
                "estimated_transaction_count": line_count,
                "processing_complexity": "too_many_lines",
                "import_warning": "Extrait trop dense pour un traitement complet automatique.",
                "suggested_split": "Scinder le relevé par semaine ou quinzaine.",
                "status": "too_many_lines",
            }
        if line_count > settings["softWarningTransactionLines"]:
            return {
                "estimated_transaction_count": line_count,
                "processing_complexity": "dense",
                "import_warning": "Le traitement depend surtout du nombre d'operations. Un relevé dense peut être lent.",
                "suggested_split": "Scinder le relevé par semaine ou par quinzaine.",
                "status": "review_required",
            }
        if line_count > 50:
            return {
                "estimated_transaction_count": line_count,
                "processing_complexity": "medium",
                "import_warning": None,
                "suggested_split": None,
                "status": "processing",
            }
        return {
            "estimated_transaction_count": line_count,
            "processing_complexity": "light",
            "import_warning": None,
            "suggested_split": None,
            "status": "processing",
        }

    async def generate_suggestions_for_import(self, import_id: str, company_id: str):
        settings = await self.get_company_settings(company_id)
        transactions = await self.db.bank_transactions.find(
            {
                "import_id": ObjectId(import_id),
                "company_id": ObjectId(company_id),
                "reconciliation_status": {"$nin": ["approved", "ignored"]},
            }
        ).sort("txn_date", 1).to_list(None)

        llm_calls = 0
        suggestion_count = 0
        for tx in transactions:
            suggestions, used_llm = await self._generate_for_transaction(tx, company_id, settings)
            llm_calls += 1 if used_llm else 0
            if llm_calls > settings["maxLLMCallsPerImport"]:
                used_llm = False
            await self.db.reconciliation_suggestions.delete_many({"transaction_id": tx["_id"]})
            for suggestion in suggestions[:5]:
                await self.db.reconciliation_suggestions.insert_one(
                    {
                        "company_id": ObjectId(company_id),
                        "transaction_id": tx["_id"],
                        "import_id": ObjectId(import_id),
                        "candidate_type": suggestion["candidate_type"],
                        "candidate_id": ObjectId(suggestion["candidate_id"]) if suggestion.get("candidate_id") else None,
                        "score": suggestion["score"],
                        "confidence": suggestion["confidence"],
                        "match_pass": suggestion["match_pass"],
                        "reason": suggestion["reason"],
                        "status": "pending",
                        "should_letter": suggestion.get("should_letter", False),
                        "suggested_entry": suggestion.get("suggested_entry"),
                        "matched_entity_type": suggestion.get("candidate_type"),
                        "matched_entity_id": suggestion.get("candidate_id"),
                        "created_at": datetime.now(timezone.utc),
                        "updated_at": datetime.now(timezone.utc),
                    }
                )
                suggestion_count += 1
        await self.db.bank_statement_imports.update_one(
            {"_id": ObjectId(import_id)},
            {
                "$set": {
                    "llm_call_count": llm_calls,
                    "suggestion_count": suggestion_count,
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )
        return suggestion_count

    async def _generate_for_transaction(self, tx: dict, company_id: str, settings: dict):
        classification = await self.classifier.classify(company_id, tx)
        await self.db.bank_transactions.update_one(
            {"_id": tx["_id"]},
            {
                "$set": {
                    "transaction_type": classification["transaction_type"],
                    "confidence": classification["confidence"],
                    "reasoning": classification["reasoning"],
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )

        exact = await self._pass_exact(tx, company_id, settings)
        if exact:
            return exact, False
        strong = await self._pass_strong(tx, company_id, settings)
        if strong and strong[0]["score"] >= 75:
            return strong, False
        learned = await self._pass_learned(tx, company_id)
        if learned:
            return learned, False
        llm = await self._pass_llm_prefilter(tx, company_id, strong[:3] if strong else [])
        return llm or strong or [], bool(llm)

    async def _pass_exact(self, tx: dict, company_id: str, settings: dict):
        amount = abs(float(tx.get("amount_signed") or 0))
        label = tx.get("label_raw") or ""
        ref = tx.get("reference") or ""
        txn_date = _safe_date(tx.get("txn_date"))
        is_credit = float(tx.get("amount_signed") or 0) > 0

        results = []
        collection = self.db.invoices if is_credit else self.db.supplier_invoices
        status_list = ["sent", "partial", "overdue"] if is_credit else ["received", "partial", "validated"]
        docs = await collection.find(
            {
                "company_id": ObjectId(company_id),
                "status": {"$in": status_list},
                "balance_due": {"$gte": amount - settings["candidateAmountTolerance"], "$lte": amount + settings["candidateAmountTolerance"]},
            }
        ).limit(50).to_list(50)
        for doc in docs:
            invoice_ref = doc.get("number") or doc.get("supplier_number") or ""
            partner = doc.get("customer_name") or doc.get("supplier_name") or ""
            if invoice_ref and normalize_pattern(invoice_ref) and normalize_pattern(invoice_ref) in normalize_pattern(f"{label} {ref}"):
                results.append(
                    await self._build_suggestion(
                        company_id,
                        tx,
                        "invoice" if is_credit else "supplier_invoice",
                        doc,
                        96,
                        "pass_exact",
                        "Référence et montant exacts",
                        should_letter=True,
                    )
                )
                continue
            if partner and _similarity(partner, label) >= 0.96 and txn_date and _safe_date(doc.get("date")):
                delta = abs((txn_date - _safe_date(doc.get("date"))).days)
                if delta <= 7:
                    results.append(
                        await self._build_suggestion(
                            company_id,
                            tx,
                            "invoice" if is_credit else "supplier_invoice",
                            doc,
                            91,
                            "pass_exact",
                            "Montant exact et partenaire exact",
                            should_letter=True,
                        )
                    )
        return results

    async def _pass_strong(self, tx: dict, company_id: str, settings: dict):
        amount = abs(float(tx.get("amount_signed") or 0))
        label = tx.get("label_raw") or ""
        txn_date = _safe_date(tx.get("txn_date"))
        is_credit = float(tx.get("amount_signed") or 0) > 0
        results = []
        date_limit = timedelta(days=settings["candidateSearchDateWindowDays"])

        if is_credit:
            sources = [
                ("invoice", self.db.invoices, ["sent", "partial", "overdue"]),
                ("payment", self.db.payments, None),
            ]
        else:
            sources = [
                ("supplier_invoice", self.db.supplier_invoices, ["received", "partial", "validated"]),
                ("supplier_payment", self.db.supplier_payments, None),
            ]

        for candidate_type, collection, statuses in sources:
            query = {"company_id": ObjectId(company_id)}
            if statuses:
                query["status"] = {"$in": statuses}
                query["balance_due"] = {"$gte": max(0, amount - 5), "$lte": amount + 5}
            else:
                query["amount"] = {"$gte": max(0, amount - 5), "$lte": amount + 5}
            docs = await collection.find(query).limit(50).to_list(50)
            for doc in docs:
                candidate_amount = float(doc.get("balance_due") or doc.get("amount") or doc.get("total") or 0)
                score = 0
                reasons = []
                if abs(candidate_amount - amount) <= settings["candidateAmountTolerance"]:
                    score += 45
                    reasons.append("montant exact")
                elif abs(candidate_amount - amount) <= 5:
                    score += 25
                    reasons.append("montant proche")
                candidate_date = _safe_date(doc.get("date"))
                if txn_date and candidate_date and abs(txn_date - candidate_date) <= date_limit:
                    score += 20
                    reasons.append("date proche")
                partner = doc.get("customer_name") or doc.get("supplier_name") or doc.get("reference") or doc.get("number") or ""
                similarity = _similarity(partner, label)
                if similarity >= 0.9:
                    score += 25
                    reasons.append("partenaire fort")
                elif similarity >= 0.75:
                    score += 15
                    reasons.append("libellé proche")
                if score >= 50:
                    results.append(
                        await self._build_suggestion(
                            company_id,
                            tx,
                            candidate_type,
                            doc,
                            min(89, score),
                            "pass_strong",
                            "; ".join(reasons),
                            should_letter=candidate_type in ("invoice", "supplier_invoice"),
                        )
                    )
        return sorted(results, key=lambda item: item["score"], reverse=True)[:5]

    async def _pass_learned(self, tx: dict, company_id: str):
        label = tx.get("label_raw") or ""
        suggestions = []
        learned = await self.learning.find_patterns(company_id, "transaction_label", label)
        if learned:
            top = learned[0]
            candidate_type = top.get("entity_type")
            candidate_id = top.get("entity_id")
            if candidate_type and candidate_id:
                collection = self.db.invoices if candidate_type == "invoice" else self.db.supplier_invoices if candidate_type == "supplier_invoice" else None
                if collection:
                    doc = await collection.find_one({"_id": ObjectId(candidate_id)})
                    if doc:
                        suggestions.append(
                            await self._build_suggestion(
                                company_id,
                                tx,
                                candidate_type,
                                doc,
                                82,
                                "pass_learned",
                                f"Pattern appris: {top.get('raw_pattern')}",
                                should_letter=True,
                            )
                        )

        supplier_mapping = await self.supplier_mapping_service.suggest_mapping(company_id, None, label)
        if supplier_mapping:
            matched_entity = {
                "entity_type": "direct_expense",
                "expense_account": {
                    "code": supplier_mapping.get("default_expense_account_code"),
                    "name": supplier_mapping.get("category") or supplier_mapping.get("supplier_pattern"),
                },
            }
            entry = await self.entry_suggestion_service.suggest_for_transaction(company_id, tx, matched_entity)
            suggestions.append(
                {
                    "candidate_type": "expense",
                    "candidate_id": None,
                    "score": 78,
                    "confidence": "strong_suggestion",
                    "match_pass": "pass_learned",
                    "reason": f"Mapping fournisseur: {supplier_mapping.get('supplier_pattern')}",
                    "should_letter": False,
                    "suggested_entry": entry,
                }
            )
        return suggestions

    async def _pass_llm_prefilter(self, tx: dict, company_id: str, candidates: list):
        if not candidates:
            return []
        top = candidates[0]
        if top["score"] >= 75:
            return []
        suggestion = dict(top)
        suggestion["score"] = max(suggestion["score"], 55)
        suggestion["confidence"] = "manual_review"
        suggestion["match_pass"] = "pass_llm"
        suggestion["reason"] = f"Cas ambigu préfiltré: {top['reason']}"
        return [suggestion]

    async def _build_suggestion(self, company_id: str, tx: dict, candidate_type: str, doc: dict, score: float, match_pass: str, reason: str, should_letter: bool):
        matched_entity = {"entity_type": candidate_type}
        entry = await self.entry_suggestion_service.suggest_for_transaction(company_id, tx, matched_entity)
        confidence = "auto_approvable" if score >= 90 else "strong_suggestion" if score >= 75 else "weak_suggestion"
        return {
            "candidate_type": candidate_type,
            "candidate_id": str(doc["_id"]),
            "score": score,
            "confidence": confidence,
            "match_pass": match_pass,
            "reason": reason,
            "should_letter": should_letter,
            "suggested_entry": entry,
        }

    async def approve_suggestion(self, suggestion: dict, transaction: dict, company_id: str, current_user: dict):
        candidate_type = suggestion.get("candidate_type")
        candidate_id = suggestion.get("candidate_id")
        amount = abs(float(transaction.get("amount_signed") or 0))
        payment_reference = transaction.get("reference") or transaction.get("label_raw") or ""
        txn_date = _safe_date(transaction.get("txn_date")) or datetime.now(timezone.utc)

        if candidate_type == "invoice":
            invoice = await self.db.invoices.find_one({"_id": candidate_id})
            if invoice:
                allocation = {"invoice_id": candidate_id, "amount": min(amount, float(invoice.get("balance_due") or invoice.get("total") or amount))}
                payment_doc = {
                    "company_id": ObjectId(company_id),
                    "type": "received",
                    "date": txn_date,
                    "customer_id": invoice.get("customer_id"),
                    "amount": allocation["amount"],
                    "payment_method": "transfer",
                    "reference": payment_reference,
                    "allocations": [allocation],
                    "status": "completed",
                    "created_at": datetime.now(timezone.utc),
                    "updated_at": datetime.now(timezone.utc),
                    "created_by": current_user["_id"],
                    "auto_created_from_bank": True,
                }
                payment_result = await self.db.payments.insert_one(payment_doc)
                new_amount_paid = float(invoice.get("amount_paid") or 0) + allocation["amount"]
                balance_due = max(0, float(invoice.get("total") or 0) - new_amount_paid)
                await self.db.invoices.update_one(
                    {"_id": candidate_id},
                    {"$set": {"amount_paid": new_amount_paid, "balance_due": balance_due, "status": "paid" if balance_due <= 0 else "partial", "updated_at": datetime.now(timezone.utc)}},
                )
                matched_entity_id = payment_result.inserted_id
            else:
                matched_entity_id = candidate_id
        elif candidate_type == "supplier_invoice":
            invoice = await self.db.supplier_invoices.find_one({"_id": candidate_id})
            if invoice:
                allocation = {"invoice_id": candidate_id, "amount": min(amount, float(invoice.get("balance_due") or invoice.get("total") or amount))}
                payment_doc = {
                    "company_id": ObjectId(company_id),
                    "supplier_id": invoice.get("supplier_id"),
                    "amount": allocation["amount"],
                    "payment_method": "transfer",
                    "reference": payment_reference,
                    "allocations": [allocation],
                    "type": "sent",
                    "date": txn_date,
                    "status": "completed",
                    "created_at": datetime.now(timezone.utc),
                    "updated_at": datetime.now(timezone.utc),
                    "created_by": current_user["_id"],
                    "auto_created_from_bank": True,
                }
                payment_result = await self.db.supplier_payments.insert_one(payment_doc)
                new_amount_paid = float(invoice.get("amount_paid") or 0) + allocation["amount"]
                balance_due = max(0, float(invoice.get("total") or 0) - new_amount_paid)
                await self.db.supplier_invoices.update_one(
                    {"_id": candidate_id},
                    {"$set": {"amount_paid": new_amount_paid, "balance_due": balance_due, "status": "paid" if balance_due <= 0 else "partial", "updated_at": datetime.now(timezone.utc)}},
                )
                matched_entity_id = payment_result.inserted_id
            else:
                matched_entity_id = candidate_id
        else:
            matched_entity_id = candidate_id

        await self.db.bank_transactions.update_one(
            {"_id": transaction["_id"]},
            {
                "$set": {
                    "reconciled": True,
                    "reconciliation_status": "approved",
                    "reconciliation_id": suggestion["_id"],
                    "matched_entity_type": candidate_type,
                    "matched_entity_id": matched_entity_id,
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )
        await self.learning.record_confirmation(
            company_id=company_id,
            pattern_type="transaction_label",
            raw_pattern=transaction.get("label_raw") or "",
            entity_type=candidate_type,
            entity_id=str(candidate_id) if candidate_id else None,
            transaction_type=transaction.get("transaction_type"),
        )
        return {"matched_entity_type": candidate_type, "matched_entity_id": str(matched_entity_id) if matched_entity_id else None}
