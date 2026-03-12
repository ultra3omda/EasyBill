"""
auto_reconciliation_service.py
Matches bank transactions with invoices, payments, expenses.
Scoring: amount exact +45, date within 7 days +20, reference match +25, label similarity >0.8 +20.
"""
import re
import logging
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
from bson import ObjectId
from difflib import SequenceMatcher

logger = logging.getLogger(__name__)

# Scoring weights
SCORE_AMOUNT_EXACT = 45
SCORE_DATE_PROXIMITY = 20
SCORE_REFERENCE_MATCH = 25
SCORE_LABEL_SIMILARITY = 20
THRESHOLD_STRONG = 85
THRESHOLD_SUGGESTED = 60
DATE_PROXIMITY_DAYS = 7
LABEL_SIMILARITY_THRESHOLD = 0.8


def _normalize_amount(val: Any) -> float:
    if val is None:
        return 0.0
    if isinstance(val, (int, float)):
        return float(val)
    try:
        return float(str(val).replace(",", ".").replace(" ", ""))
    except (ValueError, TypeError):
        return 0.0


def _parse_date(val: Any) -> Optional[datetime]:
    if not val:
        return None
    s = str(val)
    if hasattr(val, "date"):
        return val
    m = re.search(r"(\d{4})[-/](\d{2})[-/](\d{2})", s)
    if m:
        try:
            return datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        except (ValueError, TypeError):
            pass
    return None


def _text_similarity(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    a = a.lower().strip()
    b = b.lower().strip()
    return SequenceMatcher(None, a, b).ratio()


def _reference_in_label(reference: str, label: str) -> bool:
    if not reference or not label:
        return False
    ref_clean = re.sub(r"\s+", "", str(reference).lower())
    label_clean = re.sub(r"\s+", "", str(label).lower())
    return ref_clean in label_clean or label_clean in ref_clean


class AutoReconciliationService:
    """Generate reconciliation suggestions for bank transactions."""

    def __init__(self, db):
        self.db = db

    async def generate_suggestions_for_import(self, import_id: str, company_id: str) -> int:
        """Generate suggestions for all unreconciled transactions of an import."""
        transactions = await self.db.bank_transactions.find({
            "import_id": ObjectId(import_id),
            "company_id": ObjectId(company_id),
            "reconciled": False,
        }).to_list(None)

        count = 0
        for tx in transactions:
            suggestions = await self._find_candidates(tx, company_id)
            for cand_type, cand_id, score, reason in suggestions:
                if score >= THRESHOLD_SUGGESTED:
                    await self._upsert_suggestion(
                        transaction_id=tx["_id"],
                        company_id=company_id,
                        candidate_type=cand_type,
                        candidate_id=cand_id,
                        score=score,
                        reason=reason,
                    )
                    count += 1
        return count

    async def _find_candidates(self, tx: dict, company_id: str) -> List[Tuple[str, str, float, str]]:
        """Find matching candidates for a transaction. Returns [(candidate_type, candidate_id, score, reason), ...]"""
        results = []
        amount = abs(_normalize_amount(tx.get("amount_signed")) or 0)
        txn_date = _parse_date(tx.get("txn_date"))
        label_raw = (tx.get("label_raw") or "").strip()
        reference = (tx.get("reference") or "").strip()

        if amount <= 0:
            return results

        # Supplier invoices (debit = payment out)
        if tx.get("amount_signed", 0) < 0:
            invs = await self.db.supplier_invoices.find({
                "company_id": ObjectId(company_id),
                "status": {"$in": ["received", "partial"]},
                "balance_due": {"$gte": amount - 0.01, "$lte": amount + 0.01},
            }).to_list(50)
            for inv in invs:
                score, reason = self._score_match(
                    amount, amount, txn_date, _parse_date(inv.get("date")),
                    inv.get("number") or inv.get("supplier_number"), label_raw, reference,
                    inv.get("supplier_name", ""),
                )
                results.append(("supplier_invoice", str(inv["_id"]), score, reason))

        # Customer invoices (credit = payment in)
        if tx.get("amount_signed", 0) > 0:
            invs = await self.db.invoices.find({
                "company_id": ObjectId(company_id),
                "status": {"$in": ["sent", "partial"]},
                "balance_due": {"$gte": amount - 0.01, "$lte": amount + 0.01},
            }).to_list(50)
            for inv in invs:
                score, reason = self._score_match(
                    amount, amount, txn_date, _parse_date(inv.get("date")),
                    inv.get("number"), label_raw, reference,
                    inv.get("customer_name", ""),
                )
                results.append(("invoice", str(inv["_id"]), score, reason))

        # Payments (client payments)
        if tx.get("amount_signed", 0) > 0:
            payments = await self.db.payments.find({
                "company_id": ObjectId(company_id),
                "amount": {"$gte": amount - 0.01, "$lte": amount + 0.01},
            }).to_list(50)
            for p in payments:
                score, reason = self._score_match(
                    amount, _normalize_amount(p.get("amount")), txn_date, _parse_date(p.get("date")),
                    p.get("reference"), label_raw, reference, "",
                )
                results.append(("payment", str(p["_id"]), score, reason))

        # Supplier payments
        if tx.get("amount_signed", 0) < 0:
            sps = await self.db.supplier_payments.find({
                "company_id": ObjectId(company_id),
                "amount": {"$gte": amount - 0.01, "$lte": amount + 0.01},
            }).to_list(50)
            for p in sps:
                score, reason = self._score_match(
                    amount, _normalize_amount(p.get("amount")), txn_date, _parse_date(p.get("date")),
                    p.get("reference"), label_raw, reference, "",
                )
                results.append(("supplier_payment", str(p["_id"]), score, reason))

        return sorted(results, key=lambda x: -x[2])[:5]

    def _score_match(
        self,
        tx_amount: float,
        cand_amount: float,
        tx_date: Optional[datetime],
        cand_date: Optional[datetime],
        cand_ref: str,
        label_raw: str,
        tx_ref: str,
        cand_name: str,
    ) -> Tuple[float, str]:
        """Compute score and reason string."""
        score = 0.0
        reasons = []

        if abs(tx_amount - cand_amount) < 0.01:
            score += SCORE_AMOUNT_EXACT
            reasons.append("montant exact")
        else:
            reasons.append("montant différent")

        if tx_date and cand_date:
            delta = abs((tx_date - cand_date).days)
            if delta <= DATE_PROXIMITY_DAYS:
                score += SCORE_DATE_PROXIMITY
                reasons.append(f"date proche ({delta}j)")
            else:
                reasons.append(f"date éloignée ({delta}j)")

        ref_match = _reference_in_label(cand_ref, label_raw) or _reference_in_label(tx_ref, cand_ref)
        if ref_match:
            score += SCORE_REFERENCE_MATCH
            reasons.append("référence correspondante")

        sim = _text_similarity(cand_ref or "", label_raw) or _text_similarity(cand_name, label_raw)
        if sim >= LABEL_SIMILARITY_THRESHOLD:
            score += SCORE_LABEL_SIMILARITY
            reasons.append(f"libellé similaire ({sim:.0%})")

        return score, "; ".join(reasons)

    async def _upsert_suggestion(
        self,
        transaction_id: ObjectId,
        company_id: str,
        candidate_type: str,
        candidate_id: str,
        score: float,
        reason: str,
    ):
        """Insert or update reconciliation suggestion."""
        existing = await self.db.reconciliation_suggestions.find_one({
            "transaction_id": transaction_id,
            "candidate_id": ObjectId(candidate_id),
            "candidate_type": candidate_type,
        })
        if existing:
            await self.db.reconciliation_suggestions.update_one(
                {"_id": existing["_id"]},
                {"$set": {"score": score, "reason": reason, "status": "pending"}},
            )
        else:
            await self.db.reconciliation_suggestions.insert_one({
                "transaction_id": transaction_id,
                "company_id": ObjectId(company_id),
                "candidate_type": candidate_type,
                "candidate_id": ObjectId(candidate_id),
                "score": score,
                "reason": reason,
                "status": "pending",
                "created_at": datetime.utcnow(),
            })

    async def resolve_with_openai(
        self,
        transaction: dict,
        candidates: List[dict],
        openai_api_key: Optional[str] = None,
    ) -> Optional[Dict]:
        """Use OpenAI to resolve ambiguous matches. Returns best match or None."""
        api_key = openai_api_key or __import__("os").environ.get("OPENAI_API_KEY")
        if not api_key or not candidates:
            return None

        try:
            from openai import OpenAI
            client = OpenAI(api_key=api_key)
            txn_date = transaction.get("txn_date", "")
            label = transaction.get("label_raw", "")
            amount = transaction.get("amount_signed", 0)

            cand_list = "\n".join([
                f"- {c.get('candidate_type')} {c.get('candidate_id')}: {c.get('reason', '')} (score {c.get('score', 0)})"
                for c in candidates[:10]
            ])
            prompt = f"""Transaction bancaire:
date: {txn_date}
libellé: {label}
montant: {amount}

Candidats possibles:
{cand_list}

Retourne le meilleur match au format JSON: {{ "candidate_id": "...", "candidate_type": "...", "reasoning": "..." }}
Si aucun bon match, retourne {{ "candidate_id": null }}."""

            resp = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=200,
            )
            text = (resp.choices[0].message.content or "").strip()
            import json
            data = json.loads(text)
            if data.get("candidate_id"):
                return data
        except Exception as e:
            logger.warning("OpenAI reconciliation resolve failed: %s", e)
        return None
