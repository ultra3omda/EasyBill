"""
bank_statement_extraction_service.py
Extracts transactions from bank statement PDFs/images using Google Document AI only.
No Gemini fallback - use the lettrage bancaire module for that.
"""
import os
import re
import hashlib
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime

logger = logging.getLogger(__name__)


def _repair_json(raw: str) -> Optional[Dict]:
    """Attempt to repair malformed JSON from Gemini (truncated, missing brackets, etc.)."""
    import json
    for attempt in [raw, raw + "}", raw + "]}", raw + "]}}"]:
        try:
            return json.loads(attempt)
        except json.JSONDecodeError:
            pass
    tx_match = re.search(r'"transactions"\s*:\s*\[', raw)
    if tx_match:
        start = tx_match.start()
        bracket_pos = raw.index('[', start)
        depth = 0
        last_complete = bracket_pos
        for i in range(bracket_pos, len(raw)):
            if raw[i] == '[':
                depth += 1
            elif raw[i] == ']':
                depth -= 1
                if depth == 0:
                    last_complete = i
                    break
            elif raw[i] == '}' and depth == 1:
                last_complete = i
        truncated = raw[:last_complete + 1]
        for suffix in ["}", "]}", "]}}"]:
            try:
                return json.loads(truncated + suffix)
            except json.JSONDecodeError:
                pass
        last_brace = truncated.rfind('}')
        if last_brace > bracket_pos:
            trimmed = truncated[:last_brace + 1] + "]}"
            try:
                return json.loads(trimmed)
            except json.JSONDecodeError:
                pass
    return None


def _compute_hash_unique(date: str, amount_signed: float, label_raw: str) -> str:
    """hashUnique = sha1(date + amountSigned + labelRaw)"""
    payload = f"{date}|{amount_signed}|{(label_raw or '').strip()}"
    return hashlib.sha1(payload.encode("utf-8")).hexdigest()


def _normalize_amount(val: Any) -> float:
    """Parse amount. Tunisian format: 1 234,56 or 1.234,56 (space/dot milliers, virgule décimales)."""
    if val is None:
        return 0.0
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val).strip()
    if "," in s and re.search(r",\d{1,}\s*$|,\d{1,}$", s):
        s = s.replace(" ", "").replace(".", "").replace(",", ".")
    else:
        s = s.replace(",", ".").replace(" ", "")
    try:
        return float(re.sub(r"[^\d.\-]", "", s) or 0)
    except (ValueError, TypeError):
        return 0.0


def _parse_date(val: Any) -> Optional[str]:
    if not val:
        return None
    s = str(val).strip()
    # YYYY-MM-DD
    m = re.search(r"(\d{4})[-/](\d{2})[-/](\d{2})", s)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    # DD/MM/YYYY
    m = re.search(r"(\d{1,2})[-/](\d{1,2})[-/](\d{4})", s)
    if m:
        d, mo, y = m.group(1), m.group(2), m.group(3)
        return f"{y}-{mo.zfill(2)}-{d.zfill(2)}"
    return None


def _clean_label(raw: str) -> str:
    if not raw:
        return ""
    return re.sub(r"\s+", " ", raw.strip())


def _get_text_from_anchor(text_anchor, doc_text: str) -> str:
    """Extract text from Document AI text_anchor using document.text."""
    if not text_anchor or not doc_text:
        return ""
    segments = getattr(text_anchor, "text_segments", None) or []
    if not segments:
        return ""
    parts = []
    for seg in segments:
        start = getattr(seg, "start_index", 0) or 0
        end = getattr(seg, "end_index", 0) or 0
        if 0 <= start < end <= len(doc_text):
            parts.append(doc_text[start:end])
    return " ".join(parts).strip() if parts else ""


def _get_date_from_normalized_value(norm_val) -> Optional[str]:
    """Extract YYYY-MM-DD from Document AI normalized_value.date_value."""
    if not norm_val:
        return None
    dv = getattr(norm_val, "date_value", None)
    if not dv:
        return None
    y = getattr(dv, "year", 0) or 0
    m = getattr(dv, "month", 0) or 0
    d = getattr(dv, "day", 0) or 0
    if y and m and d:
        return f"{y}-{str(m).zfill(2)}-{str(d).zfill(2)}"
    return None


def _get_amount_from_normalized_value(norm_val) -> float:
    """Extract amount from Document AI normalized_value.money_value."""
    if not norm_val:
        return 0.0
    mv = getattr(norm_val, "money_value", None)
    if not mv:
        return 0.0
    units = getattr(mv, "units", 0) or 0
    nanos = getattr(mv, "nanos", 0) or 0
    return float(units) + (float(nanos) / 1e9)


class BankStatementExtractionService:
    """Extract transactions from bank statements using Document AI only."""

    def __init__(self):
        self.project_id = os.environ.get("GOOGLE_CLOUD_PROJECT") or os.environ.get("DOCUMENT_AI_PROJECT_ID")
        self.location = os.environ.get("DOCUMENT_AI_LOCATION", "eu")
        self.processor_id = os.environ.get("DOCUMENT_AI_BANK_STATEMENT_PROCESSOR_ID") or os.environ.get("DOCUMENT_AI_PROCESSOR_ID")
        self.ocr_processor_id = os.environ.get("DOCUMENT_AI_OCR_PROCESSOR_ID")
        self.use_ocr_only = os.environ.get("DOCUMENT_AI_USE_OCR_ONLY", "").lower() in ("1", "true", "yes")
        self.use_document_ai = bool(self.project_id and (self.processor_id or self.ocr_processor_id))

    def _is_low_quality_extraction(self, result: Dict) -> bool:
        """Qualité insuffisante : libellés vides, débit/crédit mal classés."""
        txs = result.get("transactions") or []
        if len(txs) < 5:
            return True
        desc_ok = sum(1 for t in txs if len((t.get("description") or t.get("label_raw") or "").strip()) >= 4)
        has_debit = sum(1 for t in txs if (t.get("debit") or 0) > 0)
        if desc_ok < len(txs) * 0.4:
            logger.info("Document AI: qualité faible (%.0f%% libellés vides/courts)", (1 - desc_ok / len(txs)) * 100)
            return True
        if has_debit < len(txs) * 0.1:
            logger.info("Document AI: qualité faible (%.0f%% sans débit)", (1 - has_debit / len(txs)) * 100)
            return True
        return False

    async def extract_from_file(self, file_path: str, company_id: str) -> Dict[str, Any]:
        """
        Extract transactions from a bank statement file.
        Strategy: Document AI (if <= 30 pages) -> Gemini fallback -> pdfplumber fallback.
        Returns: { transactions: [...], bank_name, account_number, period_start, period_end, ... }
        """
        result = None
        page_count = self._get_pdf_page_count(file_path)

        if self.use_document_ai and page_count <= 30:
            try:
                result = await self._extract_document_ai(file_path)
            except Exception as e:
                logger.warning("Document AI extraction failed: %s", e)
        elif self.use_document_ai and page_count > 30:
            logger.info("PDF has %d pages (> 30 limit), skipping Document AI", page_count)

        if not result or len(result.get("transactions") or []) < 10 or self._is_low_quality_extraction(result or {}):
            gemini_result = await self._extract_gemini_fallback(file_path, company_id)
            if gemini_result and (gemini_result.get("transactions") or []):
                logger.info("Fallback Gemini: %d transactions (libellés + débit/crédit)", len(gemini_result.get("transactions") or []))
                gemini_result.setdefault("ocr_provider", "gemini")
                gemini_result.setdefault("ocr_raw", None)
                gemini_result.setdefault("parsing_warnings", [])
                return gemini_result

        if not result or len(result.get("transactions") or []) < 3:
            pdfplumber_result = self._extract_pdfplumber(file_path)
            if pdfplumber_result and (pdfplumber_result.get("transactions") or []):
                logger.info("Fallback pdfplumber: %d transactions", len(pdfplumber_result["transactions"]))
                pdfplumber_result.setdefault("ocr_provider", "pdfplumber")
                pdfplumber_result.setdefault("ocr_raw", None)
                pdfplumber_result.setdefault("parsing_warnings", [])
                return pdfplumber_result

        if not result:
            raise RuntimeError(
                "Extraction impossible. Document AI, Gemini et pdfplumber ont tous échoué."
            )
        result.setdefault("ocr_provider", "document_ai")
        result.setdefault("ocr_raw", None)
        result.setdefault("parsing_warnings", [])
        return result

    @staticmethod
    def _get_pdf_page_count(file_path: str) -> int:
        """Count pages in a PDF file."""
        if not file_path.lower().endswith(".pdf"):
            return 1
        try:
            import pdfplumber
            with pdfplumber.open(file_path) as pdf:
                return len(pdf.pages)
        except Exception:
            return 0

    def _extract_pdfplumber(self, file_path: str) -> Optional[Dict[str, Any]]:
        """Extract transactions from PDF using pdfplumber text extraction."""
        if not file_path.lower().endswith(".pdf"):
            return None
        try:
            import pdfplumber
            full_text = ""
            with pdfplumber.open(file_path) as pdf:
                for page in pdf.pages:
                    full_text += (page.extract_text() or "") + "\n"
            if not full_text.strip():
                return None
            transactions = self._parse_text_fallback(full_text)
            meta = self._extract_metadata_from_text(full_text)
            return {
                "transactions": transactions,
                "bank_name": meta.get("bank_name"),
                "account_number": meta.get("account_number"),
                "period_start": meta.get("period_start"),
                "period_end": meta.get("period_end"),
                "currency": meta.get("currency", "TND"),
                "opening_balance": meta.get("opening_balance", 0),
                "closing_balance": meta.get("closing_balance", 0),
                "ocr_text": full_text,
                "ocr_provider": "pdfplumber",
                "parsing_warnings": [],
            }
        except Exception as e:
            logger.warning("pdfplumber extraction failed: %s", e)
            return None

    @staticmethod
    def _extract_metadata_from_text(text: str) -> Dict[str, Any]:
        """Extract bank metadata from raw text."""
        meta = {}
        text_upper = text.upper()
        for bank in ["AMEN BANK", "BIAT", "BNA", "STB", "BH BANK", "UIB", "ATTIJARI",
                      "BT", "UBCI", "ABC", "ZITOUNA", "WIFAK", "QNB", "CITIBANK",
                      "BANQUE DE TUNISIE", "BTK", "TSB", "BTL", "BTE", "BFPME"]:
            if bank in text_upper:
                meta["bank_name"] = bank
                break
        acc = re.search(r"(?:COMPTE|ACCOUNT|N°|RIB)[:\s]*([0-9\-\s]{8,})", text, re.I)
        if acc:
            meta["account_number"] = acc.group(1).strip()
        return meta

    async def _extract_document_ai(self, file_path: str) -> Dict[str, Any]:
        """Extract using Google Document AI - OCR for text, then parse."""
        import asyncio
        try:
            from google.cloud import documentai_v1
            from google.api_core.client_options import ClientOptions
        except ImportError:
            raise RuntimeError("google-cloud-documentai not installed. pip install google-cloud-documentai")

        with open(file_path, "rb") as f:
            content = f.read()

        proc_id = self.ocr_processor_id or self.processor_id
        if not proc_id:
            raise RuntimeError("DOCUMENT_AI_PROCESSOR_ID ou DOCUMENT_AI_OCR_PROCESSOR_ID requis")

        opts = ClientOptions(api_endpoint=f"{self.location}-documentai.googleapis.com")
        dai_client = documentai_v1.DocumentProcessorServiceClient(client_options=opts)
        name = f"projects/{self.project_id}/locations/{self.location}/processors/{proc_id}"
        mime = "application/pdf" if file_path.lower().endswith(".pdf") else "image/jpeg"
        raw_document = documentai_v1.RawDocument(content=content, mime_type=mime)
        request = documentai_v1.ProcessRequest(name=name, raw_document=raw_document)
        try:
            result = await asyncio.wait_for(
                asyncio.to_thread(dai_client.process_document, request=request),
                timeout=120.0
            )
        except asyncio.TimeoutError:
            logger.warning("Document AI timeout after 120s for %s", file_path)
            raise RuntimeError("Document AI timeout (120s)")
        document = result.document

        transactions = []
        doc_text = getattr(document, "text", None) or ""

        if self.use_ocr_only:
            transactions = self._parse_text_fallback(doc_text)
        else:
            entities = getattr(document, "entities", None) or []
            for entity in entities:
                etype = getattr(entity, "type_", None) or getattr(entity, "type", None) or ""
                etype_lower = str(etype).lower()
                if etype == "line_item" or etype == "table_item" or "transaction" in etype_lower:
                    row = self._parse_document_ai_entity(entity, doc_text)
                    if row:
                        transactions.append(row)
                elif etype == "table":
                    props = getattr(entity, "properties", None) or []
                    for row_entity in props:
                        row = self._parse_document_ai_entity(row_entity, doc_text)
                        if row:
                            transactions.append(row)
            if not transactions and doc_text:
                transactions = self._parse_text_fallback(doc_text)

        meta = self._extract_metadata(document)
        return {
            "transactions": transactions,
            "bank_name": meta.get("bank_name"),
            "account_number": meta.get("account_number"),
            "period_start": meta.get("period_start"),
            "period_end": meta.get("period_end"),
            "currency": meta.get("currency", "TND"),
            "opening_balance": meta.get("opening_balance", 0),
            "closing_balance": meta.get("closing_balance", 0),
            "ocr_text": doc_text,
            "ocr_provider": "document_ai",
            "ocr_raw": document.to_dict() if hasattr(document, "to_dict") else None,
            "parsing_warnings": [],
        }

    def _parse_document_ai_entity(self, entity, doc_text: str = "") -> Optional[Dict]:
        """Parse a Document AI entity into transaction dict."""
        eprops = getattr(entity, "properties", None) or []
        etype = getattr(entity, "type_", None) or getattr(entity, "type", None) or ""
        mention = getattr(entity, "mention_text", None) or ""
        props = {}
        for p in eprops:
            ptype = getattr(p, "type_", None) or getattr(p, "type", "") or ""
            pval = getattr(p, "mention_text", None) or ""
            if not pval and doc_text:
                ta = getattr(p, "text_anchor", None)
                if ta:
                    pval = _get_text_from_anchor(ta, doc_text)
            props[ptype] = pval or ""
            if "/" in ptype:
                short_key = ptype.split("/")[-1]
                if short_key not in props or not props[short_key]:
                    props[short_key] = pval or ""
        props[etype] = mention or ""

        def _get_prop(*keys):
            for k in keys:
                v = props.get(k)
                if v:
                    return v
            for pk, pv in props.items():
                if "/" in pk and pk.split("/")[-1] in keys and pv:
                    return pv
            return ""

        date_val = _get_prop("date", "transaction_date", "transaction_withdrawal_date", "transaction_deposit_date")
        debit_val = _normalize_amount(_get_prop("debit", "withdrawal", "transaction_withdrawal"))
        credit_val = _normalize_amount(_get_prop("credit", "deposit", "transaction_deposit"))
        desc = _get_prop("description", "label", "line_item", "transaction_description", "line_item_description", "line", "transaction_line")
        balance_val = _normalize_amount(props.get("balance"))

        if not desc and doc_text:
            ta = getattr(entity, "text_anchor", None)
            if ta:
                desc = _get_text_from_anchor(ta, doc_text)
        if not desc:
            desc = mention or ""

        norm_val = getattr(entity, "normalized_value", None)
        if norm_val:
            nv_date = _get_date_from_normalized_value(norm_val)
            if nv_date:
                date_val = nv_date
            nv_amount = _get_amount_from_normalized_value(norm_val)
            if nv_amount and not debit_val and not credit_val:
                credit_val = nv_amount if nv_amount > 0 else 0
                debit_val = -nv_amount if nv_amount < 0 else 0

        for p in eprops:
            pnorm = getattr(p, "normalized_value", None)
            if pnorm:
                ptype = (getattr(p, "type_", None) or getattr(p, "type", "") or "").lower()
                if "date" in ptype and not date_val:
                    date_val = _get_date_from_normalized_value(pnorm) or date_val
                if ("withdrawal" in ptype or "debit" in ptype) and not debit_val:
                    debit_val = _get_amount_from_normalized_value(pnorm) or debit_val
                if ("deposit" in ptype or "credit" in ptype) and not credit_val:
                    credit_val = _get_amount_from_normalized_value(pnorm) or credit_val

        if not (debit_val or credit_val):
            return None

        txn_date = _parse_date(date_val) or (_get_date_from_normalized_value(norm_val) if norm_val else None)
        txn_date = txn_date or datetime.now().strftime("%Y-%m-%d")
        amount_signed = credit_val if credit_val > 0 else -debit_val if debit_val > 0 else 0
        label_raw = _clean_label(desc)
        hash_unique = _compute_hash_unique(txn_date, amount_signed, label_raw)

        return {
            "date": txn_date,
            "value_date": txn_date,
            "description": label_raw,
            "debit": debit_val,
            "credit": credit_val,
            "balance": balance_val if balance_val else None,
            "amount_signed": amount_signed,
            "label_raw": label_raw,
            "label_clean": label_raw,
            "hash_unique": hash_unique,
            "reference": _get_prop("reference") or props.get("reference") or None,
        }

    def _extract_metadata(self, document) -> Dict:
        """Extract bank metadata from document."""
        meta = {}
        entities = getattr(document, "entities", None) or []
        for entity in entities:
            t = (getattr(entity, "type_", None) or getattr(entity, "type", "") or "").lower()
            v = getattr(entity, "mention_text", None) or ""
            if "bank" in t:
                meta["bank_name"] = v
            elif "account" in t:
                meta["account_number"] = v
            elif "period" in t or "date" in t:
                if "start" in t or "from" in t:
                    meta["period_start"] = _parse_date(v) or v
                elif "end" in t or "to" in t:
                    meta["period_end"] = _parse_date(v) or v
            elif "balance" in t:
                meta["opening_balance"] = _normalize_amount(v)
            elif "closing" in t:
                meta["closing_balance"] = _normalize_amount(v)
        return meta

    def _parse_tn_amount(self, s: str) -> float:
        """Parse montant tunisien: 25.350,694 ou 119,000 ou 15,000,000."""
        s = (s or "").strip().replace(" ", "")
        if not s:
            return 0.0
        if "." in s and "," in s:
            try:
                return round(float(s.replace(".", "").replace(",", ".")), 3)
            except Exception:
                return 0.0
        parts = s.split(",")
        if len(parts) == 2:
            left, right = parts[0], parts[1].ljust(3, "0")[:3]
            if right == "000":
                return float(int(left or 0) * 1000)
            try:
                return round(int(left) + int(right) / 1000, 3)
            except Exception:
                pass
        if len(parts) >= 3:
            try:
                return float("".join(parts))
            except Exception:
                pass
        try:
            return round(float(s.replace(",", ".")), 3)
        except Exception:
            return 0.0

    def _parse_text_fallback(self, text: str) -> List[Dict]:
        """Parse transaction lines from OCR text. Format tunisien: DD/MM Libellé Débit Crédit (comme lettrage bancaire)."""
        def _is_credit_tx(desc: str) -> bool:
            u = (desc or "").upper()
            return any(k in u for k in [
                "VIR RECU", "RECU", "CREDIT", "REMISE", "EXTOURNE",
                "ALIMENTATION", "PROVISION C", "ENTRANT", "REMBOURSEMENT"
            ])

        TN_AMT_PAT = r"(\d[\d\.]*(?:\.\d{3})*,\d{3}|\d[\d,]*,\d{3})"
        TN_AMT_RE = re.compile(TN_AMT_PAT)
        TX_LINE_RE = re.compile(r"^(\d{1,2}/\d{1,2})\s+(.*)")
        FRAG_NUM_RE = re.compile(r"\d+\.\s*$")
        transactions = []
        opening_balance = 0.0
        year = datetime.now().strftime("%Y")

        for m in re.finditer(r"du\s*[:\s]+(\d{2}/\d{2}/\d{4})\s+au\s+(\d{2}/\d{2}/\d{4})", text, re.I):
            year = m.group(2).split("/")[2] if len(m.group(2).split("/")) >= 3 else year
            break
        for m in re.finditer(r"solde\s+(?:v[ei]ille|pr[eé]c|initial)\s*[:\s]+([\d,\.\s]+)", text, re.I):
            opening_balance = self._parse_tn_amount(m.group(1).strip().split()[0])
            break

        raw_lines = text.split("\n")
        joined_lines = []
        i = 0
        while i < len(raw_lines):
            line = raw_lines[i]
            if i + 1 < len(raw_lines) and FRAG_NUM_RE.search(line.rstrip()) and re.match(r"^\d[\d,]+", raw_lines[i + 1].strip()):
                line = line.rstrip() + raw_lines[i + 1].strip()
                i += 1
            joined_lines.append(line)
            i += 1

        current_tx = None
        for raw_line in joined_lines:
            line_s = raw_line.strip()
            if not line_s:
                continue
            m_tx = TX_LINE_RE.match(line_s)
            if m_tx:
                if current_tx:
                    transactions.append(current_tx)
                tx_date_raw = m_tx.group(1)
                rest = m_tx.group(2).strip()
                if re.match(r"^solde\s+(?:v[ei]ille|pr[eé]c|initial|cl[oô]ture|final)", rest, re.I):
                    continue
                amounts_found = []
                work = rest
                for _ in range(2):
                    m_amt = None
                    for candidate in TN_AMT_RE.finditer(work):
                        m_amt = candidate
                    if not m_amt:
                        break
                    cval = m_amt.group(1)
                    last_comma_idx = cval.rfind(",")
                    if last_comma_idx >= 0 and len(cval) - last_comma_idx - 1 == 3:
                        amounts_found.insert(0, self._parse_tn_amount(cval))
                        work = work[:m_amt.start()].rstrip()
                    else:
                        break
                work = re.sub(r"\s+\d{1,2}/\d{1,2}(?:/\d{2,4})?\s*$", "", work).strip()
                work = re.sub(r"\s+\d{1,6}\s*$", "", work).strip()
                description = _clean_label(work)
                debit = credit = 0.0
                amounts_clean = [a for a in amounts_found if abs(a - opening_balance) > 0.01]
                if not amounts_clean and amounts_found:
                    amounts_clean = amounts_found
                if len(amounts_clean) == 2:
                    debit = amounts_clean[0]
                    credit = amounts_clean[1]
                elif len(amounts_clean) == 1:
                    if _is_credit_tx(description):
                        credit = amounts_clean[0]
                    else:
                        debit = amounts_clean[0]
                amount_signed = credit if credit > 0 else -debit if debit > 0 else 0
                if amount_signed == 0:
                    continue
                dp = tx_date_raw.split("/")
                iso_date = f"{year}-{dp[1].zfill(2)}-{dp[0].zfill(2)}"
                if not description:
                    description = "Transaction"
                hash_unique = _compute_hash_unique(iso_date, amount_signed, description)
                current_tx = {
                    "date": iso_date,
                    "value_date": iso_date,
                    "description": description,
                    "debit": debit,
                    "credit": credit,
                    "balance": None,
                    "amount_signed": amount_signed,
                    "label_raw": description,
                    "label_clean": description,
                    "hash_unique": hash_unique,
                    "reference": None,
                }
            else:
                if current_tx and not re.match(r"^[\d\s,\./%]+$", line_s) and not re.match(r"^(page|solde|date|lib|ref|d[eé]bit|cr[eé]dit)", line_s, re.I) and len(line_s) > 2:
                    current_tx["description"] = _clean_label((current_tx.get("description") or "") + " " + line_s)
                    current_tx["label_raw"] = current_tx["description"]
                    current_tx["label_clean"] = current_tx["description"]
        if current_tx:
            transactions.append(current_tx)
        return transactions

    async def _extract_gemini_fallback(self, file_path: str, company_id: str) -> Dict[str, Any]:
        """Fallback to Gemini Vision for bank statement extraction.
        For large PDFs (>15 pages), splits into chunks and merges results."""
        import asyncio
        import json
        import tempfile
        import os as _os

        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            return {"transactions": [], "bank_name": None, "account_number": None}

        mime = "application/pdf" if file_path.lower().endswith(".pdf") else "image/jpeg"
        page_count = self._get_pdf_page_count(file_path)

        if mime == "application/pdf" and page_count > 15:
            raw_result = await self._extract_gemini_chunked(file_path, page_count, api_key)
            return self._normalize_gemini_result(raw_result)

        with open(file_path, "rb") as f:
            content = f.read()

        result = await asyncio.to_thread(self._gemini_extract_single, content, mime, api_key)
        if not result:
            return {"transactions": [], "bank_name": None, "account_number": None}
        return self._normalize_gemini_result(result)

    async def _extract_gemini_chunked(self, file_path: str, total_pages: int, api_key: str) -> Dict[str, Any]:
        """Split PDF into chunks of ~15 pages and extract each with Gemini, then merge."""
        import asyncio
        import tempfile
        import os as _os

        chunk_size = 15
        all_transactions = []
        metadata = {}

        try:
            import pdfplumber
            from reportlab.lib.pagesizes import letter
            from reportlab.pdfgen import canvas as rl_canvas
        except ImportError:
            pass

        try:
            from PyPDF2 import PdfReader, PdfWriter
        except ImportError:
            try:
                from pypdf import PdfReader, PdfWriter
            except ImportError:
                logger.warning("PyPDF2/pypdf not installed, cannot split PDF. Trying full file.")
                with open(file_path, "rb") as f:
                    content = f.read()
                result = await asyncio.to_thread(self._gemini_extract_single, content, "application/pdf", api_key)
                return result or {"transactions": [], "bank_name": None, "account_number": None}

        reader = PdfReader(file_path)
        num_chunks = (len(reader.pages) + chunk_size - 1) // chunk_size
        logger.info("Splitting %d-page PDF into %d chunks of ~%d pages", len(reader.pages), num_chunks, chunk_size)

        for chunk_idx in range(num_chunks):
            start_page = chunk_idx * chunk_size
            end_page = min(start_page + chunk_size, len(reader.pages))
            writer = PdfWriter()
            for p in range(start_page, end_page):
                writer.add_page(reader.pages[p])

            tmp_path = None
            try:
                with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
                    writer.write(tmp)
                    tmp_path = tmp.name
                with open(tmp_path, "rb") as f:
                    chunk_content = f.read()

                logger.info("Processing chunk %d/%d (pages %d-%d)", chunk_idx + 1, num_chunks, start_page + 1, end_page)
                chunk_result = await asyncio.to_thread(
                    self._gemini_extract_single, chunk_content, "application/pdf", api_key
                )
                if chunk_result:
                    chunk_txs = chunk_result.get("transactions") or []
                    all_transactions.extend(chunk_txs)
                    logger.info("Chunk %d/%d: %d transactions", chunk_idx + 1, num_chunks, len(chunk_txs))
                    if not metadata.get("bank_name") and chunk_result.get("bank_name"):
                        metadata["bank_name"] = chunk_result["bank_name"]
                    if not metadata.get("account_number") and chunk_result.get("account_number"):
                        metadata["account_number"] = chunk_result["account_number"]
                    if chunk_idx == 0:
                        metadata["period_start"] = chunk_result.get("period_start")
                        metadata["opening_balance"] = chunk_result.get("opening_balance", 0)
                    if chunk_idx == num_chunks - 1:
                        metadata["period_end"] = chunk_result.get("period_end")
                        metadata["closing_balance"] = chunk_result.get("closing_balance", 0)
            finally:
                if tmp_path:
                    try:
                        _os.unlink(tmp_path)
                    except Exception:
                        pass

        logger.info("Total from %d chunks: %d transactions", num_chunks, len(all_transactions))
        return {
            "transactions": all_transactions,
            "bank_name": metadata.get("bank_name"),
            "account_number": metadata.get("account_number"),
            "period_start": metadata.get("period_start"),
            "period_end": metadata.get("period_end"),
            "currency": metadata.get("currency", "TND"),
            "opening_balance": metadata.get("opening_balance", 0),
            "closing_balance": metadata.get("closing_balance", 0),
        }

    def _gemini_extract_single(self, content: bytes, mime: str, api_key: str) -> Optional[Dict]:
        """Extract transactions from a single file/chunk using Gemini. Synchronous."""
        import json
        import tempfile
        import os as _os

        prompt = """Extract ALL bank statement transactions. Return ONLY valid JSON, no markdown:
{ "bank_name": "...", "account_number": "...", "period_start": "YYYY-MM-DD", "period_end": "YYYY-MM-DD",
  "currency": "TND", "opening_balance": 0, "closing_balance": 0,
  "transactions": [ {"date": "YYYY-MM-DD", "value_date": "YYYY-MM-DD", "description": "...", "debit": 0, "credit": 0, "balance": 0 } ] }

RÈGLES CRITIQUES:
- "description": libellé COMPLET de chaque transaction (VIR, virement, prélèvement, etc.) — jamais vide
- "debit": montant sortie (retrait, virement émis, prélèvement, commission) — 0 si crédit
- "credit": montant entrée (virement reçu, versement) — 0 si débit
- Chaque ligne = une transaction avec date, libellé complet, et montant en debit (sortie) ou credit (entrée)
- Extrais TOUTES les transactions sans exception"""

        try:
            from google import genai
            from google.genai import types as genai_types
            client = genai.Client(api_key=api_key)
            if mime.startswith("image/"):
                file_part = genai_types.Part.from_bytes(data=content, mime_type=mime)
                contents = [prompt, file_part]
            else:
                with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
                    tmp.write(content)
                    tmp_path = tmp.name
                try:
                    uploaded = client.files.upload(file=tmp_path, config={"mime_type": "application/pdf"})
                    import time
                    for _ in range(30):
                        fi = client.files.get(name=uploaded.name)
                        st = getattr(fi, "state", None)
                        if st and getattr(st, "name", None) == "ACTIVE":
                            break
                        time.sleep(1)
                    contents = [prompt, uploaded]
                finally:
                    try:
                        _os.unlink(tmp_path)
                    except Exception:
                        pass
            GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"]
            last_err = None
            for model_name in GEMINI_MODELS:
                try:
                    resp = client.models.generate_content(
                        model=model_name,
                        contents=contents,
                        config=genai_types.GenerateContentConfig(
                            automatic_function_calling=genai_types.AutomaticFunctionCallingConfig(disable=True),
                            max_output_tokens=65536,
                        ),
                    )
                    raw = (resp.text or "").strip()
                    if raw.startswith("```"):
                        raw = re.sub(r"^```(?:json)?\n?", "", raw)
                        raw = re.sub(r"\n?```$", "", raw.strip())
                    if not raw:
                        continue
                    try:
                        return json.loads(raw)
                    except json.JSONDecodeError:
                        repaired = _repair_json(raw)
                        if repaired:
                            logger.info("Gemini %s: JSON repaired successfully", model_name)
                            return repaired
                        logger.warning("Gemini %s: JSON malformed and unrepairable, trying next model", model_name)
                        last_err = ValueError(f"JSON malformed from {model_name}")
                        continue
                except Exception as e:
                    last_err = e
                    if "404" in str(e) or "NOT_FOUND" in str(e):
                        logger.warning("Gemini model %s unavailable, trying next: %s", model_name, e)
                        continue
                    if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
                        logger.warning("Gemini %s rate limited, trying next: %s", model_name, e)
                        continue
                    raise
            logger.warning("Gemini bank extraction failed (all models): %s", last_err)
            return None
        except Exception as e:
            logger.warning("Gemini bank extraction failed: %s", e)
            return None

    def _normalize_gemini_result(self, result: Dict) -> Dict:
        """Normalize transactions from Gemini extraction."""
        txs = result.get("transactions") or []
        normalized = []
        for t in txs:
            debit = _normalize_amount(t.get("debit"))
            credit = _normalize_amount(t.get("credit"))
            amount_signed = credit if credit > 0 else -debit
            date_str = _parse_date(t.get("date")) or datetime.now().strftime("%Y-%m-%d")
            label = _clean_label(t.get("description") or "")
            hash_unique = _compute_hash_unique(date_str, amount_signed, label)
            normalized.append({
                "date": date_str,
                "value_date": _parse_date(t.get("value_date")) or date_str,
                "description": label,
                "debit": debit,
                "credit": credit,
                "balance": _normalize_amount(t.get("balance")) or None,
                "amount_signed": amount_signed,
                "label_raw": label,
                "label_clean": label,
                "hash_unique": hash_unique,
                "reference": t.get("reference"),
            })
        result["transactions"] = normalized
        return result

    @staticmethod
    def normalize_transaction(t: Dict, import_id: str, company_id: str) -> Dict:
        """Normalize extracted transaction for DB insertion."""
        debit = _normalize_amount(t.get("debit"))
        credit = _normalize_amount(t.get("credit"))
        amount_signed = credit if credit > 0 else -debit
        date_str = _parse_date(t.get("date")) or datetime.now().strftime("%Y-%m-%d")
        label = _clean_label(t.get("description") or t.get("label_raw") or "")
        hash_unique = _compute_hash_unique(date_str, amount_signed, label)
        return {
            "import_id": import_id,
            "company_id": company_id,
            "txn_date": date_str,
            "value_date": _parse_date(t.get("value_date")) or date_str,
            "label_raw": label,
            "label_clean": label,
            "debit": debit,
            "credit": credit,
            "amount_signed": amount_signed,
            "balance": _normalize_amount(t.get("balance")) if t.get("balance") is not None else None,
            "currency": t.get("currency") or "TND",
            "reference": t.get("reference"),
            "hash_unique": hash_unique,
            "reconciled": False,
        }


bank_statement_extraction_service = BankStatementExtractionService()
