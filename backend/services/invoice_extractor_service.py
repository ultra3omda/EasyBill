"""
invoice_extractor_service.py
Service d'extraction des données d'une facture depuis image ou PDF.
Stratégie :
  1. Si GEMINI_API_KEY configuré → Gemini Vision (le plus précis)
  2. Sinon pour PDF → pdfplumber (extraction texte)
  3. Fallback → regex sur texte brut
"""
import re
import io
import os
import base64
import logging
from typing import Optional, Dict, Any, List

logger = logging.getLogger(__name__)

# ─── Regex helpers ───────────────────────────────────────────────────────────

AMOUNT_RE = re.compile(r"(\d[\d\s]*[,\.]?\d*)\s*(?:TND|DT|dinars?|EUR|€|\$)?", re.IGNORECASE)
DATE_RE = re.compile(r"(\d{1,2})[/\-\.](\d{1,2})[/\-\.](\d{2,4})")
VAT_RE = re.compile(r"(\d+(?:[,\.]\d+)?)\s*%")
INVOICE_NUM_RE = re.compile(
    r"(?:facture|invoice|n[°o]?\.?\s*facture|ref(?:erence)?|num[eé]ro?|n°)\s*:?\s*([A-Z0-9\-/]{3,30})",
    re.IGNORECASE
)
FISCAL_ID_RE = re.compile(r"(?:MF|matricule fiscal|fiscal id|IF|siret)\s*:?\s*([A-Z0-9\s/\-]{5,20})", re.IGNORECASE)
PHONE_RE = re.compile(r"(?:tel|tél|phone|mob(?:ile)?)\s*:?\s*([\+\d\s\-\(\)]{7,20})", re.IGNORECASE)
EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}", re.IGNORECASE)
SUPPLIER_NAME_RE = re.compile(
    r"(?:fournisseur|vendeur|émis par|de chez|from)\s*:?\s*([^\n\r]{3,60})",
    re.IGNORECASE
)

# Known Tunisian account codes by category
ACCOUNT_TVA = {"19": "43620", "13": "43610", "7": "43611", "0": None}
ACCOUNT_SUPPLIER = "401"
ACCOUNT_PURCHASE = "601"   # Achats de marchandises
ACCOUNT_SERVICES = "611"   # Services extérieurs


def _parse_amount(text: str) -> Optional[float]:
    """Extract the first meaningful amount from text."""
    matches = AMOUNT_RE.findall(text)
    for m in matches:
        raw = m.replace(" ", "").replace(",", ".")
        try:
            val = float(raw)
            if val > 0.01:
                return round(val, 3)
        except Exception:
            pass
    return None


def _parse_date(text: str) -> Optional[str]:
    """Extract date as ISO string."""
    m = DATE_RE.search(text)
    if m:
        day, month, year = m.group(1), m.group(2), m.group(3)
        if len(year) == 2:
            year = "20" + year
        return f"{year}-{month.zfill(2)}-{day.zfill(2)}"
    return None


def _extract_with_regex(text: str) -> Dict[str, Any]:
    """
    Extract invoice data from raw text using regex patterns.
    Returns a dict with best-effort extracted fields.
    """
    lines = [l.strip() for l in text.split("\n") if l.strip()]

    # --- Supplier name (first non-trivial line or explicit label) ---
    supplier_name = None
    m = SUPPLIER_NAME_RE.search(text)
    if m:
        supplier_name = m.group(1).strip()
    else:
        # Heuristic: first long line likely the company name
        for line in lines[:10]:
            if len(line) > 4 and not any(kw in line.lower() for kw in ["facture", "invoice", "date", "total"]):
                supplier_name = line
                break

    # --- Fiscal ID ---
    fiscal_id = None
    m = FISCAL_ID_RE.search(text)
    if m:
        fiscal_id = m.group(1).strip()

    # --- Phone ---
    phone = None
    m = PHONE_RE.search(text)
    if m:
        phone = m.group(1).strip()

    # --- Email ---
    email = None
    m = EMAIL_RE.search(text)
    if m:
        email = m.group(0)

    # --- Invoice number ---
    inv_number = None
    m = INVOICE_NUM_RE.search(text)
    if m:
        inv_number = m.group(1).strip()

    # --- Date ---
    date_str = _parse_date(text)

    # --- Amounts ---
    # Strategy: look for "Total TTC", "Total HT", then compute TVA
    total_ttc = None
    total_ht = None
    tva_amount = None
    tva_rate = 19.0

    # Explicit patterns
    ttc_m = re.search(r"(?:total\s+ttc|total\s+toutes\s+taxes|montant\s+total)\s*:?\s*" + AMOUNT_RE.pattern, text, re.IGNORECASE)
    ht_m = re.search(r"(?:total\s+ht|montant\s+ht|sous.total|subtotal)\s*:?\s*" + AMOUNT_RE.pattern, text, re.IGNORECASE)
    tva_m = re.search(r"(?:tva|taxe\s+sur|tax)\s*(?:\d+\s*%)?\s*:?\s*" + AMOUNT_RE.pattern, text, re.IGNORECASE)
    rate_m = VAT_RE.search(text)

    if ttc_m:
        total_ttc = _parse_amount(ttc_m.group(0))
    if ht_m:
        total_ht = _parse_amount(ht_m.group(0))
    if tva_m:
        tva_amount = _parse_amount(tva_m.group(0))
    if rate_m:
        try:
            tva_rate = float(rate_m.group(1).replace(",", "."))
        except Exception:
            pass

    # Infer missing values
    if total_ttc and not total_ht:
        total_ht = round(total_ttc / (1 + tva_rate / 100), 3)
    elif total_ht and not total_ttc:
        total_ttc = round(total_ht * (1 + tva_rate / 100), 3)

    if total_ht and total_ttc and not tva_amount:
        tva_amount = round(total_ttc - total_ht, 3)

    # If we still have nothing, pick biggest amount
    if not total_ttc:
        amounts = [_parse_amount(m) for m in AMOUNT_RE.findall(text)]
        amounts = [a for a in amounts if a and a > 1]
        if amounts:
            total_ttc = max(amounts)
            total_ht = round(total_ttc / (1 + tva_rate / 100), 3)
            tva_amount = round(total_ttc - total_ht, 3)

    # --- Items (basic: look for description + price lines) ---
    items = []
    item_re = re.compile(r"(.{5,50})\s+(\d+(?:[,\.]\d+)?)\s*(?:x|×)?\s*(\d+(?:[,\.]\d+)?)\s*(?:TND|DT)?", re.IGNORECASE)
    for m in item_re.finditer(text):
        desc = m.group(1).strip()
        try:
            qty = float(m.group(2).replace(",", "."))
            price = float(m.group(3).replace(",", "."))
            if price > 0:
                items.append({
                    "description": desc,
                    "quantity": qty,
                    "unit_price": price,
                    "tax_rate": tva_rate,
                    "discount": 0,
                    "total": round(qty * price * (1 + tva_rate / 100), 3)
                })
        except Exception:
            pass

    # If no items parsed, create a single generic line
    if not items and total_ht:
        items = [{
            "description": "Prestations / Marchandises",
            "quantity": 1,
            "unit_price": total_ht,
            "tax_rate": tva_rate,
            "discount": 0,
            "total": total_ttc or total_ht
        }]

    # Confidence estimation
    found = sum([
        bool(supplier_name), bool(inv_number), bool(date_str),
        bool(total_ttc), bool(total_ht), bool(items)
    ])
    confidence = round(found / 6, 2)

    return {
        "supplier": {
            "name": supplier_name,
            "fiscal_id": fiscal_id,
            "phone": phone,
            "email": email,
        },
        "invoice": {
            "supplier_number": inv_number,
            "date": date_str,
            "items": items,
            "subtotal": total_ht,
            "total_tax": tva_amount,
            "total": total_ttc,
            "tva_rate": tva_rate,
        },
        "confidence": confidence,
        "raw_text_length": len(text),
    }


GEMINI_PROMPT = """
Analyse cette facture fournisseur tunisienne et extrais les informations suivantes au format JSON strict.
Réponds UNIQUEMENT avec du JSON valide, sans markdown, sans commentaires.

Format attendu :
{
  "supplier": {
    "name": "Nom du fournisseur",
    "fiscal_id": "Matricule fiscal (ex: 1234567Y/A/M/000)",
    "phone": "Numéro de téléphone",
    "email": "Email",
    "address": "Adresse complète",
    "bank": "Nom de la banque",
    "rib": "Numéro RIB"
  },
  "invoice": {
    "supplier_number": "Numéro de la facture",
    "date": "YYYY-MM-DD",
    "due_date": "YYYY-MM-DD ou null",
    "items": [
      {
        "code": "Code article ou null",
        "description": "Description du produit ou service",
        "quantity": 1,
        "unit_price": 100.0,
        "tax_rate": 19,
        "discount": 0,
        "total_ht": 100.0,
        "total_ttc": 119.0
      }
    ],
    "subtotal_ht": 100.0,
    "fodec": 1.0,
    "assiette_tva": 101.0,
    "total_tax": 19.19,
    "timbre_fiscal": 1.0,
    "total_ttc": 120.19,
    "net_a_payer": 121.19
  }
}

IMPORTANT pour les factures tunisiennes :
- "fodec" = FODEC (1% du HT net) - cherche "Total FODEC" ou "FODEC" sur la facture
- "timbre_fiscal" = Droit de timbre (généralement 1 TND) - cherche "Timbre" sur la facture
- "assiette_tva" = Base de calcul TVA = HT + FODEC
- "net_a_payer" = Montant final TTC + Timbre fiscal
- Si une information est absente, utilise null ou 0.
- Pour les montants, utilise des nombres décimaux (jamais de chaînes).
"""

# Ordre de préférence des modèles Gemini (du plus récent au plus ancien)
GEMINI_MODELS = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash",
]


async def extract_with_gemini(file_bytes: bytes, mime_type: str, api_key: str) -> Optional[Dict[str, Any]]:
    """
    Use Gemini Vision pour extraire les données de facture.
    Le SDK google.genai est synchrone → on l'exécute dans un thread via asyncio.to_thread()
    pour ne pas bloquer l'event loop FastAPI.
    """
    import json, asyncio, tempfile, os as _os

    def _sync_extract() -> Optional[Dict]:
        """Exécution synchrone dans un thread séparé."""
        try:
            from google import genai

            client = genai.Client(api_key=api_key)
            actual_mime = mime_type if mime_type.startswith("image/") else "application/pdf"

            last_error = None
            for model_name in GEMINI_MODELS:
                try:
                    # ── Prépare le contenu ────────────────────────────────────
                    if actual_mime.startswith("image/"):
                        from google.genai import types as genai_types
                        file_part = genai_types.Part.from_bytes(
                            data=file_bytes,
                            mime_type=actual_mime
                        )
                        contents = [GEMINI_PROMPT, file_part]
                    else:
                        # PDFs : upload via Files API
                        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
                            tmp.write(file_bytes)
                            tmp_path = tmp.name
                        try:
                            uploaded = client.files.upload(
                                file=tmp_path,
                                config={"mime_type": "application/pdf"}
                            )
                            # Attendre ACTIVE (polling synchrone)
                            import time
                            for _ in range(30):
                                file_info = client.files.get(name=uploaded.name)
                                state = getattr(file_info, 'state', None)
                                state_name = state.name if state else str(state)
                                if state_name == "ACTIVE":
                                    break
                                time.sleep(1)
                            contents = [GEMINI_PROMPT, uploaded]
                        finally:
                            try:
                                _os.unlink(tmp_path)
                            except Exception:
                                pass

                    # ── Appel Gemini ──────────────────────────────────────────
                    logger.info(f"Appel Gemini {model_name} (thread)...")
                    from google.genai import types as genai_types
                    response = client.models.generate_content(
                        model=model_name,
                        contents=contents,
                        config=genai_types.GenerateContentConfig(
                            automatic_function_calling=genai_types.AutomaticFunctionCallingConfig(
                                disable=True
                            )
                        )
                    )
                    raw = (response.text or "").strip()

                    if raw.startswith("```"):
                        raw = re.sub(r"^```(?:json)?\n?", "", raw)
                        raw = re.sub(r"\n?```$", "", raw.strip())

                    if not raw:
                        logger.warning(f"{model_name}: réponse vide, essai suivant")
                        continue

                    data = json.loads(raw)
                    data["confidence"] = 0.92
                    data["extraction_method"] = f"gemini_vision ({model_name})"
                    logger.info(f"Gemini OK: {model_name}")
                    return data

                except Exception as e:
                    err_str = str(e)
                    if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                        logger.warning(f"Quota {model_name}, essai suivant...")
                        last_error = e
                        continue
                    elif "404" in err_str or "NOT_FOUND" in err_str:
                        logger.warning(f"Modele {model_name} non disponible, essai suivant...")
                        last_error = e
                        continue
                    else:
                        logger.warning(f"Gemini {model_name} erreur: {e}")
                        last_error = e
                        break

            logger.warning(f"Tous les modeles Gemini ont echoue: {last_error}")
            return None

        except Exception as e:
            logger.warning(f"Gemini extraction echec: {e}")
            return None

    # Lance la fonction synchrone dans un thread avec timeout de 150s
    try:
        import asyncio
        result = await asyncio.wait_for(asyncio.to_thread(_sync_extract), timeout=150.0)
        return result
    except asyncio.TimeoutError:
        logger.warning("Gemini timeout apres 150s")
        return None
    except Exception as e:
        logger.warning(f"asyncio.to_thread echec: {e}")
        return None


async def extract_with_anthropic(file_bytes: bytes, mime_type: str, api_key: str) -> Optional[Dict[str, Any]]:
    """
    Use Anthropic Claude to extract invoice data from PDF/image content.
    """
    import asyncio
    import base64
    import json

    def _sync_extract() -> Optional[Dict]:
        try:
            import anthropic

            client = anthropic.Anthropic(api_key=api_key)
            actual_mime = mime_type if mime_type.startswith("image/") else "application/pdf"
            encoded = base64.standard_b64encode(file_bytes).decode("utf-8")

            if actual_mime.startswith("image/"):
                media_type = actual_mime if actual_mime in ("image/jpeg", "image/png", "image/webp", "image/gif") else "image/jpeg"
                content_blocks = [
                    {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": encoded}},
                    {"type": "text", "text": GEMINI_PROMPT},
                ]
            else:
                content_blocks = [
                    {"type": "document", "source": {"type": "base64", "media_type": "application/pdf", "data": encoded}},
                    {"type": "text", "text": GEMINI_PROMPT},
                ]

            last_error = None
            for model_name in ["claude-3-7-sonnet-latest", "claude-3-5-sonnet-latest"]:
                try:
                    response = client.messages.create(
                        model=model_name,
                        max_tokens=4096,
                        messages=[{"role": "user", "content": content_blocks}],
                    )
                    raw = "".join(
                        block.text for block in getattr(response, "content", [])
                        if getattr(block, "type", "") == "text"
                    ).strip()
                    if raw.startswith("```"):
                        raw = re.sub(r"^```(?:json)?\n?", "", raw)
                        raw = re.sub(r"\n?```$", "", raw.strip())
                    if not raw:
                        continue
                    data = json.loads(raw)
                    data["confidence"] = 0.9
                    data["extraction_method"] = f"anthropic_vision ({model_name})"
                    return data
                except Exception as e:
                    err_str = str(e)
                    if "429" in err_str or "rate" in err_str.lower():
                        logger.warning(f"Anthropic quota {model_name}, essai suivant...")
                        last_error = e
                        continue
                    if "404" in err_str or "not_found" in err_str.lower():
                        logger.warning(f"Modele Anthropic {model_name} non disponible, essai suivant...")
                        last_error = e
                        continue
                    logger.warning(f"Anthropic {model_name} erreur: {e}")
                    last_error = e
                    break

            logger.warning(f"Tous les modeles Anthropic ont echoue: {last_error}")
            return None
        except Exception as e:
            logger.warning(f"Anthropic extraction echec: {e}")
            return None

    try:
        return await asyncio.wait_for(asyncio.to_thread(_sync_extract), timeout=150.0)
    except asyncio.TimeoutError:
        logger.warning("Anthropic timeout apres 150s")
        return None
    except Exception as e:
        logger.warning(f"Anthropic asyncio.to_thread echec: {e}")
        return None


async def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract raw text from PDF using pdfplumber."""
    try:
        import pdfplumber
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            text = "\n".join(
                page.extract_text() or "" for page in pdf.pages
            )
        return text
    except Exception as e:
        logger.warning(f"pdfplumber failed: {e}")
        return ""


def _is_fast_pdf_result_good(result: Dict[str, Any]) -> bool:
    """
    Fast acceptance gate for digital PDFs.
    We keep the regex/native path only when the result is sufficiently complete,
    which avoids expensive LLM calls on clean text-based invoices.
    """
    supplier = result.get("supplier") or {}
    invoice = result.get("invoice") or {}
    items = invoice.get("items") or []
    confidence = float(result.get("confidence") or 0)
    has_supplier = bool(supplier.get("name"))
    has_number = bool(invoice.get("supplier_number"))
    has_date = bool(invoice.get("date"))
    has_total = bool(invoice.get("total"))
    has_items = len(items) > 0
    return confidence >= 0.7 and has_supplier and has_date and has_total and (has_items or has_number)


async def extract_invoice_data(
    file_bytes: bytes,
    filename: str,
    mime_type: str
) -> Dict[str, Any]:
    """
    Main entry point: extract structured invoice data from a file.
    """
    gemini_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_AI_KEY")
    anthropic_key = os.environ.get("ANTHROPIC_API_KEY")
    raw_text = ""
    regex_result = None

    # Fast path for digital PDFs: prefer native text parsing when quality is already good.
    if mime_type == "application/pdf" or filename.lower().endswith(".pdf"):
        raw_text = await extract_text_from_pdf(file_bytes)
        if raw_text.strip():
            regex_result = _extract_with_regex(raw_text)
            regex_result["raw_text_preview"] = raw_text[:500]
            if _is_fast_pdf_result_good(regex_result):
                regex_result["extraction_method"] = "regex_fast_pdf"
                return regex_result

    # Try Gemini Vision first (most accurate)
    if gemini_key:
        result = await extract_with_gemini(file_bytes, mime_type, gemini_key)
        if result:
            result["extraction_method"] = "gemini_vision"
            return result

    # Anthropic fallback for PDFs/images when Gemini is unavailable or fails.
    if anthropic_key:
        result = await extract_with_anthropic(file_bytes, mime_type, anthropic_key)
        if result:
            result["extraction_method"] = "anthropic_vision"
            return result

    # Fallback: extract text then parse with regex
    if not raw_text and (mime_type == "application/pdf" or filename.lower().endswith(".pdf")):
        raw_text = await extract_text_from_pdf(file_bytes)
    elif mime_type.startswith("image/"):
        # For images without Gemini, try basic PIL-based approach
        try:
            # Try pytesseract if available
            import pytesseract
            from PIL import Image
            img = Image.open(io.BytesIO(file_bytes))
            raw_text = pytesseract.image_to_string(img, lang="fra+eng")
        except ImportError:
            # No OCR available: return minimal structure
            logger.warning("pytesseract not available for image OCR")
            raw_text = f"[Image: {filename} - OCR non disponible sans clé Gemini]"

    if not raw_text.strip():
        return {
            "supplier": {"name": None, "fiscal_id": None, "phone": None, "email": None},
            "invoice": {
                "supplier_number": None, "date": None, "items": [],
                "subtotal": None, "total_tax": None, "total": None
            },
            "confidence": 0.0,
            "extraction_method": "none",
            "error": "Impossible d'extraire le texte du document. Vérifiez que le PDF n'est pas scanné ou configurez GEMINI_API_KEY."
        }

    result = regex_result or _extract_with_regex(raw_text)
    result["extraction_method"] = "regex"
    result["raw_text_preview"] = raw_text[:500]
    return result
