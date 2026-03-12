from datetime import datetime, timezone

from bson import ObjectId


class JournalPostingService:
    def __init__(self, db):
        self.db = db

    async def create_posted_entry(
        self,
        company_id: str,
        date,
        reference: str,
        description: str,
        journal_type: str,
        lines: list,
        document_type: str | None = None,
        document_id: str | ObjectId | None = None,
        created_by=None,
        extra_fields: dict | None = None,
    ):
        total_debit = round(sum(line.get("debit", 0) for line in lines), 3)
        total_credit = round(sum(line.get("credit", 0) for line in lines), 3)
        if abs(total_debit - total_credit) > 0.01:
            raise ValueError(f"Ecriture desequilibree: debit={total_debit} credit={total_credit}")

        now = datetime.now(timezone.utc)
        last_entry = await self.db.journal_entries.find_one(
            {"company_id": ObjectId(company_id)},
            sort=[("entry_number", -1)],
        )
        try:
            last_num = int((last_entry.get("entry_number") or "EC-00000").split("-")[-1]) if last_entry else 0
        except Exception:
            last_num = 0
        entry_number = reference or f"EC-{(last_num + 1):05d}"

        entry = {
            "company_id": ObjectId(company_id),
            "entry_number": entry_number,
            "date": date,
            "reference": entry_number,
            "description": description,
            "journal_type": journal_type,
            "lines": lines,
            "total_debit": total_debit,
            "total_credit": total_credit,
            "status": "posted",
            "posted_at": now,
            "document_type": document_type,
            "document_id": ObjectId(document_id) if document_id and not isinstance(document_id, ObjectId) else document_id,
            "created_by": created_by,
            "created_at": now,
            "auto_generated": True,
        }
        if extra_fields:
            entry.update(extra_fields)
        result = await self.db.journal_entries.insert_one(entry)

        for line in lines:
            account = await self.db.chart_of_accounts.find_one(
                {"company_id": ObjectId(company_id), "code": line.get("account_code")}
            )
            if not account:
                continue
            debit = float(line.get("debit", 0) or 0)
            credit = float(line.get("credit", 0) or 0)
            account_type = account.get("type")
            balance_change = debit - credit if account_type in ["asset", "expense"] else credit - debit
            await self.db.chart_of_accounts.update_one(
                {"_id": account["_id"]},
                {"$inc": {"balance": balance_change}, "$set": {"updated_at": now}},
            )

        return str(result.inserted_id), entry_number
