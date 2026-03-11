import re


class BankStatementParserService:
    DATE_RE = re.compile(r"\b\d{2}[/-]\d{2}[/-]\d{2,4}\b")
    AMOUNT_RE = re.compile(r"[-+]?\d[\d\s.]*,\d{2,3}|[-+]?\d[\d\s.]*\.\d{2,3}")

    @classmethod
    def estimate_transaction_count_from_text(cls, text: str) -> int:
        if not text:
            return 0
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        count = 0
        for line in lines:
            if cls.DATE_RE.search(line) and len(cls.AMOUNT_RE.findall(line)) >= 1:
                count += 1
        return count

    @classmethod
    def compute_processing_complexity(cls, line_count: int) -> str:
        if line_count > 300:
            return "too_many_lines"
        if line_count > 120:
            return "dense"
        if line_count > 50:
            return "medium"
        return "light"

    @classmethod
    def suggested_split(cls, line_count: int) -> str | None:
        if line_count > 300:
            return "Par semaine"
        if line_count > 120:
            return "Par quinzaine"
        if line_count > 80:
            return "Par mois"
        return None
