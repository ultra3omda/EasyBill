from datetime import datetime, timezone
import re

from bson import ObjectId


def normalize_pattern(value: str | None) -> str:
    raw = (value or "").upper().strip()
    raw = re.sub(r"[^A-Z0-9\s]", " ", raw)
    raw = re.sub(r"\s+", " ", raw).strip()
    return raw


class LearningPatternService:
    def __init__(self, db):
        self.db = db

    async def ensure_indexes(self):
        await self.db.matching_patterns.create_index(
            [("company_id", 1), ("pattern_type", 1), ("normalized_pattern", 1)],
            name="idx_matching_patterns_lookup",
        )
        await self.db.matching_patterns.create_index(
            [("company_id", 1), ("times_confirmed", -1)],
            name="idx_matching_patterns_strength",
        )

    @staticmethod
    def confidence_from_confirmations(times_confirmed: int) -> str:
        if times_confirmed >= 6:
            return "fort"
        if times_confirmed >= 3:
            return "moyen"
        return "faible"

    async def record_confirmation(
        self,
        company_id: str,
        pattern_type: str,
        raw_pattern: str,
        source: str = "user",
        **payload,
    ):
        await self.ensure_indexes()
        normalized_pattern = normalize_pattern(raw_pattern)
        now = datetime.now(timezone.utc)
        query = {
            "company_id": ObjectId(company_id),
            "pattern_type": pattern_type,
            "normalized_pattern": normalized_pattern,
        }
        existing = await self.db.matching_patterns.find_one(query)
        if existing:
            times_confirmed = int(existing.get("times_confirmed", 0)) + 1
            confidence = self.confidence_from_confirmations(times_confirmed)
            await self.db.matching_patterns.update_one(
                {"_id": existing["_id"]},
                {
                    "$set": {
                        **payload,
                        "raw_pattern": raw_pattern,
                        "confidence": confidence,
                        "last_used_at": now,
                        "source": source,
                        "updated_at": now,
                        "is_active": True,
                    },
                    "$inc": {"times_confirmed": 1},
                },
            )
            return str(existing["_id"])

        doc = {
            "company_id": ObjectId(company_id),
            "pattern_type": pattern_type,
            "raw_pattern": raw_pattern,
            "normalized_pattern": normalized_pattern,
            "confidence": "faible",
            "times_confirmed": 1,
            "last_used_at": now,
            "source": source,
            "is_active": True,
            "created_at": now,
            "updated_at": now,
            **payload,
        }
        result = await self.db.matching_patterns.insert_one(doc)
        return str(result.inserted_id)

    async def record_rejection(self, company_id: str, pattern_type: str, raw_pattern: str):
        normalized_pattern = normalize_pattern(raw_pattern)
        existing = await self.db.matching_patterns.find_one(
            {
                "company_id": ObjectId(company_id),
                "pattern_type": pattern_type,
                "normalized_pattern": normalized_pattern,
            }
        )
        if not existing:
            return None
        times_confirmed = max(0, int(existing.get("times_confirmed", 0)) - 1)
        confidence = self.confidence_from_confirmations(times_confirmed)
        await self.db.matching_patterns.update_one(
            {"_id": existing["_id"]},
            {
                "$set": {
                    "times_confirmed": times_confirmed,
                    "confidence": confidence,
                    "updated_at": datetime.now(timezone.utc),
                    "is_active": times_confirmed > 0,
                }
            },
        )
        return str(existing["_id"])

    async def find_patterns(self, company_id: str, pattern_type: str, text: str):
        normalized = normalize_pattern(text)
        docs = await self.db.matching_patterns.find(
            {
                "company_id": ObjectId(company_id),
                "pattern_type": pattern_type,
                "is_active": True,
            }
        ).sort("times_confirmed", -1).to_list(100)
        return [
            doc
            for doc in docs
            if doc.get("normalized_pattern") and doc["normalized_pattern"] in normalized
        ]
