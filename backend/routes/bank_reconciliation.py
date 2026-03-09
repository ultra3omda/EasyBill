"""
bank_reconciliation.py
Module de lettrage bancaire :
  1. Upload d'un extrait de compte bancaire (PDF/image)
  2. Extraction des lignes via Gemini
  3. Proposition d'écritures comptables pour chaque ligne
  4. Validation des écritures par l'utilisateur
  5. Lettrage (rapprochement) des paiements fournisseurs par virement
"""
from fastapi import APIRouter, HTTPException, status, Depends, Query, UploadFile, File
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
import io
import json
import tempfile
import os
import logging
import re

from utils.dependencies import get_current_user, get_current_company
from services.invoice_extractor_service import extract_with_gemini

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/bank-reconciliation", tags=["Bank Reconciliation"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

BANK_STATEMENT_PROMPT = """
Analyse cet extrait de compte bancaire (relevé bancaire) et extrais chaque ligne de transaction.
Réponds UNIQUEMENT avec du JSON valide, sans markdown, sans commentaires.

Format attendu :
{
  "bank_name": "Nom de la banque",
  "account_number": "Numéro de compte ou null",
  "period_start": "YYYY-MM-DD ou null",
  "period_end": "YYYY-MM-DD ou null",
  "currency": "TND",
  "opening_balance": 0.0,
  "closing_balance": 0.0,
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "value_date": "YYYY-MM-DD ou null",
      "reference": "Référence/numéro ou null",
      "description": "Libellé complet de la transaction",
      "debit": 0.0,
      "credit": 0.0,
      "balance": 0.0,
      "type": "virement|cheque|prelevement|commission|interets|autre"
    }
  ]
}

RÈGLES IMPORTANTES :
- "debit" = sortie d'argent (débit du compte), "credit" = entrée d'argent (crédit du compte)
- Mettre 0.0 si la colonne est vide, jamais null pour debit/credit
- Pour le "type" : utiliser "virement" si le libellé mentionne VIR, VIREMENT, SWIFT ; "cheque" si CHQ, CHEQUE ; "prelevement" si PRLV, PRELEVEMENT ; "commission" pour les frais et commissions ; "interets" pour les intérêts ; "autre" sinon
- Si une information est absente, utiliser null
- Tous les montants en nombres décimaux
- CRITIQUE : Extrais TOUTES les lignes de transaction sans exception. Ne limite jamais à 50 ou 100. Le document peut contenir des centaines de transactions — chacune doit apparaître dans le tableau "transactions".
"""


# ─── Pydantic models ──────────────────────────────────────────────────────────

class BankTransactionLine(BaseModel):
    date: Optional[str] = None
    value_date: Optional[str] = None
    reference: Optional[str] = None
    description: str = ""
    debit: float = 0
    credit: float = 0
    balance: Optional[float] = None
    transaction_type: str = "autre"
    # Champs ajoutés après traitement
    suggested_account_debit: Optional[str] = None
    suggested_account_credit: Optional[str] = None
    suggested_account_debit_name: Optional[str] = None
    suggested_account_credit_name: Optional[str] = None
    matched_invoice_id: Optional[str] = None
    matched_invoice_number: Optional[str] = None
    validated: bool = False
    id: Optional[str] = None

    class Config:
        extra = "allow"


class ValidateEntriesRequest(BaseModel):
    company_id: str
    statement_id: str
    lines: List[BankTransactionLine]


class LettrageRequest(BaseModel):
    company_id: str
    statement_id: str
    line_index: int
    invoice_id: str
    payment_reference: Optional[str] = None


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _suggest_accounts(transaction: dict) -> dict:
    """
    Propose les comptes comptables basés sur le libellé et le type de transaction.
    Retourne aussi is_cash_operation=True si c'est un retrait espèces/carte GAB
    → nécessite une opération en caisse en plus de l'écriture bancaire.
    """
    desc = (transaction.get("description") or "").upper()
    t_type = transaction.get("type") or transaction.get("transaction_type") or "autre"
    debit = float(transaction.get("debit") or 0)
    credit = float(transaction.get("credit") or 0)

    # Détection retraits espèces ou opérations carte → alimentent la caisse
    is_cash_operation = any(k in desc for k in [
        "RETRAIT ESP", "RETRAIT ESPECE", "RETRAIT GAB", "RETRAIT GUICHET",
        "RETRAIT DAB", "RETRAIT AUTOMATIQUE", "VERSEMENT ESP", "VERSEMENT ESPECE",
        "ALIMENTAT", "DOTATION CAISSE"
    ])
    is_card_operation = any(k in desc for k in [
        "PAIEMENT CARTE", "PAI CARTE", "TPE", "TERMINAL", "ACHATS CARTE",
        "RETRAIT CARTE"
    ])

    # Default: 521 Banques
    acc_debit = "521"
    acc_debit_name = "Banques"
    acc_credit = "521"
    acc_credit_name = "Banques"

    if credit > 0:  # Entrée d'argent
        acc_debit = "521"
        acc_debit_name = "Banques"
        if is_cash_operation:
            acc_credit = "531"
            acc_credit_name = "Caisse (versement espèces)"
        elif any(k in desc for k in ["CLIENT", "VENTE", "FACTURE", "REG CLIENT", "RECOUVREMENT"]):
            acc_credit = "411"
            acc_credit_name = "Clients"
        elif any(k in desc for k in ["INTERET", "INTERETS", "AGIOS"]):
            acc_credit = "756"
            acc_credit_name = "Produits financiers — Intérêts"
        elif any(k in desc for k in ["TVA", "REMBT TVA"]):
            acc_credit = "4366"
            acc_credit_name = "TVA à récupérer"
        else:
            acc_credit = "411"
            acc_credit_name = "Clients / Recette à identifier"

    elif debit > 0:  # Sortie d'argent
        acc_credit = "521"
        acc_credit_name = "Banques"
        if is_cash_operation:
            # Retrait espèces : Débit 531 Caisse / Crédit 521 Banques
            acc_debit = "531"
            acc_debit_name = "Caisse (retrait espèces)"
        elif is_card_operation:
            acc_debit = "531"
            acc_debit_name = "Caisse / Achats par carte"
        elif any(k in desc for k in ["FOURNISSEUR", "FOURN", "FRNS", "VIR FOUR"]):
            acc_debit = "401"
            acc_debit_name = "Fournisseurs"
        elif any(k in desc for k in ["SALAIRE", "PERSONNEL", "PAIE"]):
            acc_debit = "641"
            acc_debit_name = "Rémunérations du personnel"
        elif any(k in desc for k in ["LOYER", "LOCATION"]):
            acc_debit = "612"
            acc_debit_name = "Loyers et charges locatives"
        elif any(k in desc for k in ["IMPOT", "TAXE", "CNSS", "COTIS"]):
            acc_debit = "645"
            acc_debit_name = "Charges sociales et fiscales"
        elif any(k in desc for k in ["COMMISSION", "FRAIS", "AGIOS", "TENUED"]):
            acc_debit = "627"
            acc_debit_name = "Services bancaires — Frais et commissions"
        elif any(k in desc for k in ["ELECTRICITE", "ELEC", "SONEDE", "EAU", "GAZ"]):
            acc_debit = "605"
            acc_debit_name = "Achats non stockés (eau, énergie)"
        elif any(k in desc for k in ["ASSURANCE"]):
            acc_debit = "616"
            acc_debit_name = "Primes d'assurance"
        elif any(k in desc for k in ["TELEPHONE", "TEL", "OOREDOO", "TUNISIE TELECOM"]):
            acc_debit = "626"
            acc_debit_name = "Frais postaux et de télécommunications"
        elif t_type == "virement":
            acc_debit = "401"
            acc_debit_name = "Fournisseurs (à identifier)"
        else:
            acc_debit = "401"
            acc_debit_name = "Fournisseurs / Charge à identifier"

    return {
        "account_debit": acc_debit,
        "account_debit_name": acc_debit_name,
        "account_credit": acc_credit,
        "account_credit_name": acc_credit_name,
        "is_cash_operation": is_cash_operation,
        "is_card_operation": is_card_operation,
    }


# ─── Routes ──────────────────────────────────────────────────────────────────

@router.post("/parse")
async def parse_bank_statement(
    file: UploadFile = File(...),
    company_id: str = Query(...),
    provider: str = Query(
        "auto",
        description="Provider d'extraction: auto (défaut), pdfplumber, gemini, openai, benchmark (teste tous)"
    ),
    current_user: dict = Depends(get_current_user)
):
    """Upload et analyse d'un extrait bancaire."""
    await get_current_company(current_user, company_id)

    content_type = file.content_type or ""
    fn = (file.filename or "").lower()
    if not content_type:
        if fn.endswith(".pdf"):
            content_type = "application/pdf"
        elif fn.endswith((".jpg", ".jpeg")):
            content_type = "image/jpeg"
        elif fn.endswith(".png"):
            content_type = "image/png"

    allowed = {"application/pdf", "image/jpeg", "image/jpg", "image/png", "image/webp"}
    if content_type not in allowed:
        raise HTTPException(status_code=400, detail="Format non supporté. Utilisez PDF, JPEG ou PNG.")

    file_bytes = await file.read()
    if len(file_bytes) > 15 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Fichier trop volumineux (max 15 Mo)")

    # Réduire la taille des images pour accélérer Gemini (moins de tokens = réponse plus rapide)
    if content_type and content_type.startswith("image/"):
        try:
            from PIL import Image
            img = Image.open(io.BytesIO(file_bytes))
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")
            w, h = img.size
            max_side = 1536  # Suffisant pour lire un extrait bancaire, réduit tokens
            if max(w, h) > max_side:
                ratio = max_side / max(w, h)
                new_size = (int(w * ratio), int(h * ratio))
                img = img.resize(new_size, Image.Resampling.LANCZOS)
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=85, optimize=True)
            file_bytes = buf.getvalue()
            content_type = "image/jpeg"
        except Exception as e:
            logger.warning(f"Redimensionnement image ignoré: {e}")

    import asyncio, tempfile, json

    # ══════════════════════════════════════════════════════════════════════════
    # STRATÉGIE D'EXTRACTION :
    #   provider=auto : PDF→pdfplumber, Image→Gemini
    #   provider=pdfplumber|gemini|openai : forcer un seul
    #   provider=benchmark : exécuter tous et retourner timing + comparaison
    # ══════════════════════════════════════════════════════════════════════════

    def _sync_extract_bank(skip_ai=False, force_provider=None):
        """Si skip_ai=True: pdfplumber uniquement. force_provider: pdfplumber|gemini|openai|benchmark."""
        import os as _os, time, json as _json

        def _run_pdfplumber_extract():
            """Extraction complète via pdfplumber — TOUTES les lignes, sans limite."""
            try:
                import pdfplumber
                all_text = []
                with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
                    for page in pdf.pages:
                        txt = page.extract_text() or ""
                        all_text.append(txt)
                raw_text = "\n".join(all_text)
                if not raw_text.strip():
                    return {"error": "PDF vide ou non textuel", "transactions": []}
                return _parse_bank_text(raw_text)
            except Exception as e:
                logger.warning(f"pdfplumber erreur: {e}")
                return None

        def _parse_bank_text(raw_text):
            """Parse le texte brut extrait du PDF en transactions."""
            def _parse_tn_amount(s):
                """
                Parse montant bancaire tunisien. Deux formats :
                - Format B (point+virgule) : 25.350,694 = 25350.694 (point=milliers, virgule=décimales)
                - Format A (virgule seule) :
                  * XXX,000 → milliers : 119,000 = 119000
                  * XXX,YYY (YYY≠000) → décimal : 173,641 = 173.641
                  * X,YYY,ZZZ → milliers : 15,000,000 = 15000000
                """
                s = s.strip().replace(" ", "")
                if not s:
                    return 0.0
                # Format B : point ET virgule → européen (25.350,694)
                if "." in s and "," in s:
                    try:
                        return round(float(s.replace(".", "").replace(",", ".")), 3)
                    except Exception:
                        return 0.0
                # Format A : virgule(s) uniquement
                parts = s.split(",")
                if len(parts) == 2:
                    left, right = parts[0], parts[1].ljust(3, "0")[:3]
                    if right == "000":
                        return float(int(left or 0) * 1000)  # 119,000 = 119000
                    try:
                        return round(int(left) + int(right) / 1000, 3)  # 173,641 = 173.641
                    except Exception:
                        pass
                if len(parts) >= 3:
                    try:
                        return float("".join(parts))  # 15,000,000 = 15000000
                    except Exception:
                        pass
                try:
                    return round(float(s.replace(",", ".")), 3)
                except Exception:
                    return 0.0

            def _classify_tx(desc):
                u = desc.upper()
                if any(k in u for k in ["VIR", "VIREMENT", "SWIFT"]):
                    return "virement"
                if any(k in u for k in ["CHQ", "CHEQUE", "REGLEMENT CHEQUE"]):
                    return "cheque"
                if any(k in u for k in ["PRLV", "PRELEVEMENT"]):
                    return "prelevement"
                if any(k in u for k in ["COM ", "COMMISSION", "AGIOS", "FRAIS", "DEPASSEMENT"]):
                    return "commission"
                if any(k in u for k in ["ABT", "INTERET", "INT ", "DONT TVA"]):
                    return "interets"
                if any(k in u for k in ["RECU", "ALIMENTATION", "REMBOURSEMENT", "EXTOURNE"]):
                    return "credit_entrant"
                return "autre"

            def _is_credit_tx(desc):
                u = desc.upper()
                return any(k in u for k in [
                    "VIR RECU", "RECU", "CREDIT", "REMISE", "EXTOURNE",
                    "ALIMENTATION", "PROVISION C", "ENTRANT", "REMBOURSEMENT"
                ])

            TN_AMT_PAT = r"(\d[\d\.]*(?:\.\d{3})*,\d{3}|\d[\d,]*,\d{3})"
            TN_AMT_RE = re.compile(TN_AMT_PAT)
            TX_LINE_RE = re.compile(r"^(\d{1,2}/\d{1,2})\s+(.*)")
            FRAG_NUM_RE = re.compile(r"\d+\.\s*$")

            transactions = []
            bank_name = None
            period_start = None
            period_end = None
            account_number = None
            opening_balance = 0.0
            closing_balance = 0.0

            for line in raw_text.split("\n")[:40]:
                ls = line.strip()
                m = re.search(r"du\s*[:\s]+(\d{2}/\d{2}/\d{4})\s+au\s+(\d{2}/\d{2}/\d{4})", ls, re.I)
                if m:
                    def _fr2iso(d):
                        p = d.split("/")
                        return f"{p[2]}-{p[1].zfill(2)}-{p[0].zfill(2)}"
                    period_start = _fr2iso(m.group(1))
                    period_end = _fr2iso(m.group(2))
                m2 = re.search(r"compte\s*[:\s]+([\d\w]+)", ls, re.I)
                if m2:
                    account_number = m2.group(1)
                m3 = re.search(r"(agence|banque|bna|biat|stb|attijari|amen|zitouna|bh|ubci|abc|mag)\s+[\w\s]{2,30}", ls, re.I)
                if m3 and not bank_name:
                    bank_name = m3.group(0).strip()
                m4 = re.search(r"solde\s+(?:v[ei]ille|pr[eé]c|initial)\s*[:\s]+([\d,\.\s]+)", ls, re.I)
                if m4:
                    opening_balance = _parse_tn_amount(m4.group(1).strip().split()[0])
                m5 = re.search(r"solde\s+(?:cl[oô]ture|final|nouveau|actuel)\s*[:\s]+([\d,\.\s]+)", ls, re.I)
                if m5:
                    closing_balance = _parse_tn_amount(m5.group(1).strip().split()[0])

            year = (period_end or "2025-01-01")[:4] if period_end else "2025"

            raw_lines = raw_text.split("\n")
            joined_lines = []
            i = 0
            while i < len(raw_lines):
                line = raw_lines[i]
                if i + 1 < len(raw_lines) and FRAG_NUM_RE.search(line.rstrip()) and re.match(r"^\d[\d,]+", raw_lines[i + 1].strip()):
                    line = line.rstrip() + raw_lines[i + 1].strip()
                    i += 1
                joined_lines.append(line)
                i += 1
            raw_lines = joined_lines

            current_tx = None
            for raw_line in raw_lines:
                line_s = raw_line.strip()
                if not line_s:
                    continue
                m_tx = TX_LINE_RE.match(line_s)
                if m_tx:
                    if current_tx:
                        transactions.append(current_tx)
                    tx_date_raw = m_tx.group(1)
                    rest = m_tx.group(2).strip()
                    # Ignorer les lignes de solde (pas des transactions)
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
                            amounts_found.insert(0, _parse_tn_amount(cval))
                            work = work[:m_amt.start()].rstrip()
                        else:
                            break
                    work = re.sub(r"\s+\d{1,2}/\d{1,2}(?:/\d{2,4})?\s*$", "", work).strip()
                    work = re.sub(r"\s+\d{1,6}\s*$", "", work).strip()
                    description = work
                    debit = credit = 0.0
                    # Exclure le solde d'ouverture si présent (évite 119,000 sur AGIOS au lieu de 173,641)
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
                    dp = tx_date_raw.split("/")
                    iso_date = f"{year}-{dp[1].zfill(2)}-{dp[0].zfill(2)}"
                    tx_type = _classify_tx(description)
                    if tx_type == "credit_entrant":
                        tx_type = "virement" if "VIR" in description.upper() else "autre"
                    current_tx = {
                        "date": iso_date,
                        "description": description,
                        "debit": debit,
                        "credit": credit,
                        "type": tx_type,
                        "reference": None
                    }
                else:
                    if current_tx and not re.match(r"^[\d\s,\./%]+$", line_s) and not re.match(r"^(page|solde|date|lib|ref|d[eé]bit|cr[eé]dit)", line_s, re.I) and len(line_s) > 2:
                        current_tx["description"] += " " + line_s
            if current_tx:
                transactions.append(current_tx)

            return {
                "bank_name": bank_name or file.filename,
                "account_number": account_number,
                "period_start": period_start,
                "period_end": period_end,
                "currency": "TND",
                "opening_balance": opening_balance,
                "closing_balance": closing_balance,
                "transactions": transactions,
                "extraction_method": "pdfplumber_regex"
            }

        def _extract_pdf_text():
            try:
                import pdfplumber as _pl
                txt = ""
                with _pl.open(io.BytesIO(file_bytes)) as pdf:
                    for page in pdf.pages:
                        txt += (page.extract_text() or "") + "\n"
                return txt.strip()
            except Exception:
                return ""

        def _run_gemini_extract():
            key = _os.environ.get("GEMINI_API_KEY", "")
            if not key:
                return None
            try:
                from google import genai
                from google.genai import types as gt
                gclient = genai.Client(api_key=key)
                actual_mime = content_type if content_type.startswith("image/") else "application/pdf"
                if actual_mime.startswith("image/"):
                    contents_base = [BANK_STATEMENT_PROMPT, gt.Part.from_bytes(data=file_bytes, mime_type=actual_mime)]
                else:
                    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
                        tmp.write(file_bytes)
                        tmp_path = tmp.name
                    try:
                        uploaded_ref = gclient.files.upload(file=tmp_path, config={"mime_type": "application/pdf"})
                        for _ in range(30):
                            fi = gclient.files.get(name=uploaded_ref.name)
                            state = getattr(fi, "state", None)
                            sname = state.name if state else ""
                            if sname == "ACTIVE":
                                break
                            elif sname == "FAILED":
                                uploaded_ref = None
                                break
                            time.sleep(1)
                        contents_base = [BANK_STATEMENT_PROMPT, uploaded_ref] if uploaded_ref else None
                    finally:
                        try:
                            _os.unlink(tmp_path)
                        except Exception:
                            pass
                if contents_base is None:
                    return None
                for model_name in ["gemini-2.5-flash-lite", "gemini-2.0-flash-lite", "gemini-2.5-flash", "gemini-flash-latest"]:
                    try:
                        response = gclient.models.generate_content(
                            model=model_name,
                            contents=contents_base,
                            config=gt.GenerateContentConfig(
                                automatic_function_calling=gt.AutomaticFunctionCallingConfig(disable=True),
                                max_output_tokens=8192,
                            )
                        )
                        raw = (response.text or "").strip()
                        if raw.startswith("```"):
                            raw = re.sub(r"^```(?:json)?\n?", "", raw)
                            raw = re.sub(r"\n?```$", "", raw.strip())
                        if raw:
                            try:
                                data = _json.loads(raw)
                            except _json.JSONDecodeError:
                                fixed = re.sub(r",\s*([\]}])", r"\1", raw)
                                if not fixed.rstrip().endswith("}"):
                                    last_ok = fixed.rfind("},")
                                    if last_ok > 0:
                                        fixed = fixed[:last_ok + 1] + "\n]}"
                                    else:
                                        fixed = (fixed.rstrip().rstrip(",") or "{}") + "}"
                                data = _json.loads(fixed)
                            data["extraction_method"] = f"gemini ({model_name})"
                            return data
                    except Exception as e:
                        err_str = str(e)
                        if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                            continue
                        break
            except Exception as e:
                logger.warning(f"Gemini extract erreur: {e}")
            return None

        def _run_openai_extract():
            openai_key = _os.environ.get("OPENAI_API_KEY", "")
            if not openai_key:
                return None
            try:
                import openai as _openai
                import base64
                oclient = _openai.OpenAI(api_key=openai_key)
                # Images : GPT-4o Vision (base64)
                if content_type and content_type.startswith("image/"):
                    b64 = base64.b64encode(file_bytes).decode("utf-8")
                    mime = content_type if content_type in ("image/jpeg", "image/png", "image/gif", "image/webp") else "image/jpeg"
                    response = oclient.chat.completions.create(
                        model="gpt-4o",
                        messages=[
                            {"role": "system", "content": "Tu es un expert comptable tunisien. Réponds UNIQUEMENT avec du JSON valide, sans markdown."},
                            {
                                "role": "user",
                                "content": [
                                    {"type": "text", "text": BANK_STATEMENT_PROMPT},
                                    {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}}
                                ]
                            }
                        ],
                        max_tokens=16000,
                        timeout=120,
                        response_format={"type": "json_object"}
                    )
                else:
                    pdf_text = _extract_pdf_text()
                    if not pdf_text:
                        return None
                    text_chunk = pdf_text[:80000]
                    response = oclient.chat.completions.create(
                        model="gpt-4o",
                        messages=[
                            {"role": "system", "content": "Tu es un expert comptable tunisien. Réponds UNIQUEMENT avec du JSON valide, sans markdown."},
                            {"role": "user", "content": f"{BANK_STATEMENT_PROMPT}\n\nTexte extrait de l'extrait bancaire:\n\n{text_chunk}"}
                        ],
                        max_tokens=16000,
                        timeout=120,
                        response_format={"type": "json_object"}
                    )
                raw = (response.choices[0].message.content or "").strip()
                if not raw:
                    return None
                try:
                    data = json.loads(raw)
                except json.JSONDecodeError:
                    fixed = re.sub(r",\s*([\]}])", r"\1", raw)
                    if not fixed.rstrip().endswith("}"):
                        last_ok = fixed.rfind("},")
                        if last_ok > 0:
                            fixed = fixed[:last_ok + 1] + "\n]}"
                        else:
                            fixed = (fixed.rstrip().rstrip(",") or "{}") + "}"
                    data = json.loads(fixed)
                data["extraction_method"] = "openai_gpt4o"
                return data
            except Exception as e:
                logger.warning(f"OpenAI extract erreur: {e}")
                return None

        # ── Mode benchmark : exécuter tous les providers et mesurer ────────────
        if force_provider == "benchmark":
            import sys
            def _log(msg):
                logger.info(msg)
                print(msg, flush=True)
            _log("=== DÉBUT BENCHMARK EXTRACTION BANCAIRE ===")
            bench_results = []
            # 1. pdfplumber (PDF uniquement)
            pdfplumber_data = None
            if content_type == "application/pdf":
                _log("[Benchmark 1/3] Lancement pdfplumber...")
                t0 = time.perf_counter()
                pdfplumber_data = _run_pdfplumber_extract()
                elapsed = round((time.perf_counter() - t0) * 1000)
                tx_count = len(pdfplumber_data.get("transactions") or []) if pdfplumber_data else 0
                _log(f"      pdfplumber terminé en {elapsed} ms → {tx_count} transactions")
                bench_results.append({
                    "provider": "pdfplumber",
                    "time_ms": round((time.perf_counter() - t0) * 1000),
                    "transactions_count": len(pdfplumber_data.get("transactions") or []) if pdfplumber_data else 0,
                    "success": bool(pdfplumber_data and (pdfplumber_data.get("transactions") or [])),
                    "error": pdfplumber_data.get("error") if pdfplumber_data and not pdfplumber_data.get("transactions") else None,
                    "_data": pdfplumber_data
                })
            # 2. Gemini
            gemini_data = None
            if _os.environ.get("GEMINI_API_KEY"):
                _log("[Benchmark 2/3] Lancement Gemini...")
                t0 = time.perf_counter()
                try:
                    gemini_data = _run_gemini_extract()
                    elapsed = round((time.perf_counter() - t0) * 1000)
                    tx_count = len(gemini_data.get("transactions") or []) if gemini_data else 0
                    _log(f"      Gemini terminé en {elapsed} ms → {tx_count} transactions")
                    bench_results.append({
                        "provider": "gemini",
                        "time_ms": round((time.perf_counter() - t0) * 1000),
                        "transactions_count": len(gemini_data.get("transactions") or []) if gemini_data else 0,
                        "success": bool(gemini_data and (gemini_data.get("transactions") or [])),
                        "model": gemini_data.get("extraction_method", "").replace("gemini (", "").rstrip(")") if gemini_data else None,
                        "_data": gemini_data
                    })
                except Exception as e:
                    _log(f"      Gemini échec: {str(e)[:150]}")
                    bench_results.append({"provider": "gemini", "time_ms": round((time.perf_counter() - t0) * 1000), "transactions_count": 0, "success": False, "error": str(e)[:200]})
            # 3. OpenAI
            openai_data = None
            if _os.environ.get("OPENAI_API_KEY"):
                _log("[Benchmark 3/3] Lancement OpenAI GPT-4o...")
                t0 = time.perf_counter()
                try:
                    openai_data = _run_openai_extract()
                    elapsed = round((time.perf_counter() - t0) * 1000)
                    tx_count = len(openai_data.get("transactions") or []) if openai_data else 0
                    _log(f"      OpenAI terminé en {elapsed} ms → {tx_count} transactions")
                    bench_results.append({
                        "provider": "openai",
                        "time_ms": round((time.perf_counter() - t0) * 1000),
                        "transactions_count": len(openai_data.get("transactions") or []) if openai_data else 0,
                        "success": bool(openai_data and (openai_data.get("transactions") or [])),
                        "model": "gpt-4o",
                        "_data": openai_data
                    })
                except Exception as e:
                    _log(f"      OpenAI échec: {str(e)[:150]}")
                    bench_results.append({"provider": "openai", "time_ms": round((time.perf_counter() - t0) * 1000), "transactions_count": 0, "success": False, "error": str(e)[:200]})
            # Meilleur résultat (plus de transactions)
            best = None
            best_data = None
            for br in bench_results:
                if br.get("success") and br.get("transactions_count", 0) > 0:
                    if best is None or br["transactions_count"] > best.get("transactions_count", 0):
                        best = br
                        best_data = br.get("_data")
            if not best_data or not best_data.get("transactions"):
                best_data = _run_pdfplumber_extract() if content_type == "application/pdf" else {"transactions": []}
            # Nettoyer _data des résultats pour la réponse
            for br in bench_results:
                br.pop("_data", None)
            winner = best.get("provider", "aucun") if best else "aucun"
            winner_tx = best.get("transactions_count", 0) if best else 0
            _log(f"=== FIN BENCHMARK — Gagnant: {winner} ({winner_tx} transactions) ===")
            return {
                "benchmark": True,
                "benchmark_results": bench_results,
                "benchmark_summary": {
                    "winner": winner,
                    "winner_transactions": winner_tx,
                    "description": f"Le benchmark a testé {len(bench_results)} méthode(s) d'extraction. "
                                  f"Le meilleur résultat ({winner}) a extrait {winner_tx} transaction(s). "
                                  "Les lignes ci-dessous montrent le temps (ms) et le nombre de transactions par provider."
                },
                "bank_name": best_data.get("bank_name") if best_data else None,
                "account_number": best_data.get("account_number") if best_data else None,
                "period_start": best_data.get("period_start") if best_data else None,
                "period_end": best_data.get("period_end") if best_data else None,
                "currency": best_data.get("currency", "TND") if best_data else "TND",
                "opening_balance": best_data.get("opening_balance", 0) if best_data else 0,
                "closing_balance": best_data.get("closing_balance", 0) if best_data else 0,
                "transactions": best_data.get("transactions", []) if best_data else [],
                "extraction_method": f"benchmark (meilleur: {best['provider']})" if best else "benchmark"
            }

        # ── Provider forcé (pdfplumber, gemini, openai) ─────────────────────────
        if force_provider == "pdfplumber":
            if content_type != "application/pdf":
                return {"error": "pdfplumber ne supporte que les PDF", "transactions": []}
            res = _run_pdfplumber_extract()
            return res if res else {"error": "Extraction PDF impossible", "transactions": []}
        if force_provider == "gemini":
            r = _run_gemini_extract()
            return r if r else {"error": "Extraction Gemini impossible", "transactions": []}
        if force_provider == "openai":
            r = _run_openai_extract()
            return r if r else {"error": "Extraction OpenAI impossible", "transactions": []}

        # ── PDF : pdfplumber par défaut (rapide, toutes les lignes) ─────────────
        if content_type == "application/pdf" and not force_provider:
            pdf_result = _run_pdfplumber_extract()
            if pdf_result:
                n = len(pdf_result.get("transactions") or [])
                logger.info(f"pdfplumber: {n} transactions extraites")
                return pdf_result
            return {"error": "Extraction PDF impossible", "transactions": []}

        # ── Si skip_ai (ex: après timeout), aller directement à pdfplumber ─────
        if skip_ai:
            logger.info("Mode pdfplumber uniquement (skip IA)")
            if content_type == "application/pdf":
                return _run_pdfplumber_extract() or {"error": "Extraction impossible", "transactions": []}
            return {"error": "Timeout — pour les images, réessayez plus tard", "transactions": []}

        # ── Tentative Gemini (images) ou fallback OpenAI → pdfplumber ──────────
        r = _run_gemini_extract()
        if r:
            return r
        r = _run_openai_extract()
        if r:
            return r

        # ── Fallback : pdfplumber ────────────────────────────────────────────
        logger.info("Fallback pdfplumber pour extrait bancaire...")
        res = _run_pdfplumber_extract()
        return res if res else {"error": "Extraction impossible", "transactions": []}

    force_provider = None if provider == "auto" else provider
    try:
        extracted = await asyncio.wait_for(
            asyncio.to_thread(_sync_extract_bank, False, force_provider),
            timeout=420.0
        )
    except asyncio.TimeoutError:
        logger.warning("Timeout global extraction — passage au fallback pdfplumber direct")
        extracted = None

    # Si aucun résultat ou moins de 10 transactions, forcer pdfplumber SANS réappeler l'IA
    # (sauf en mode benchmark : on garde le résultat tel quel)
    tx_count = len((extracted or {}).get("transactions") or [])
    if not (extracted or {}).get("benchmark") and (not extracted or tx_count < 10):
        logger.info(f"Résultat IA insuffisant ({tx_count} tx) — extraction pdfplumber directe (sans IA)...")
        try:
            if content_type != "application/pdf":
                raise HTTPException(status_code=422, detail="Document non PDF — extraction impossible sans IA")
            # skip_ai=True : pas de Gemini/OpenAI (évite timeout en boucle)
            extracted = await asyncio.to_thread(_sync_extract_bank, True)
            if not extracted or not extracted.get("transactions"):
                raise HTTPException(status_code=422, detail="Extraction impossible après plusieurs tentatives")
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=422, detail=f"Extraction échouée: {e}")

    # Enrich transactions with suggested accounts
    transactions = extracted.get("transactions") or []
    enriched = []
    for i, t in enumerate(transactions):
        sugg = _suggest_accounts(t)
        enriched.append({
            "id": str(i),
            "date": t.get("date"),
            "value_date": t.get("value_date"),
            "reference": t.get("reference"),
            "description": t.get("description") or "",
            "debit": float(t.get("debit") or 0),
            "credit": float(t.get("credit") or 0),
            "balance": t.get("balance"),
            "transaction_type": t.get("type") or "autre",
            "account_debit": sugg["account_debit"],
            "account_debit_name": sugg["account_debit_name"],
            "account_credit": sugg["account_credit"],
            "account_credit_name": sugg["account_credit_name"],
            "is_cash_operation": sugg.get("is_cash_operation", False),
            "is_card_operation": sugg.get("is_card_operation", False),
            "matched_invoice_id": None,
            "matched_invoice_number": None,
            "validated": False,
        })

    # Save statement to DB
    now = datetime.now(timezone.utc)
    statement_doc = {
        "company_id": ObjectId(company_id),
        "filename": file.filename,
        "bank_name": extracted.get("bank_name"),
        "account_number": extracted.get("account_number"),
        "period_start": extracted.get("period_start"),
        "period_end": extracted.get("period_end"),
        "currency": extracted.get("currency", "TND"),
        "opening_balance": extracted.get("opening_balance", 0),
        "closing_balance": extracted.get("closing_balance", 0),
        "transactions": enriched,
        "status": "pending",
        "created_at": now,
        "created_by": current_user["_id"]
    }
    result = await db.bank_statements.insert_one(statement_doc)
    statement_id = str(result.inserted_id)

    resp = {
        "id": statement_id,
        "statement_id": statement_id,
        "bank_name": extracted.get("bank_name"),
        "account_number": extracted.get("account_number"),
        "period_start": extracted.get("period_start"),
        "period_end": extracted.get("period_end"),
        "currency": extracted.get("currency", "TND"),
        "opening_balance": extracted.get("opening_balance", 0),
        "closing_balance": extracted.get("closing_balance", 0),
        "transactions": enriched,
        "total_lines": len(enriched),
    }
    if extracted.get("benchmark"):
        resp["benchmark"] = True
        resp["benchmark_results"] = extracted.get("benchmark_results", [])
        resp["benchmark_summary"] = extracted.get("benchmark_summary", {})
        resp["extraction_method"] = extracted.get("extraction_method")
    return resp


@router.get("/statements")
async def list_bank_statements(
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Liste des extraits bancaires importés."""
    await get_current_company(current_user, company_id)
    stmts = await db.bank_statements.find(
        {"company_id": ObjectId(company_id)}
    ).sort("created_at", -1).to_list(50)

    return [
        {
            "id": str(s["_id"]),
            "filename": s.get("filename"),
            "bank_name": s.get("bank_name"),
            "period_start": s.get("period_start"),
            "period_end": s.get("period_end"),
            "total_lines": len(s.get("transactions") or []),
            "validated_lines": sum(1 for t in (s.get("transactions") or []) if t.get("validated")),
            "status": s.get("status", "pending"),
            "created_at": s.get("created_at").isoformat() if s.get("created_at") else None,
        }
        for s in stmts
    ]


@router.get("/statements/{statement_id}")
async def get_bank_statement(
    statement_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Récupère un extrait bancaire avec ses transactions."""
    await get_current_company(current_user, company_id)
    stmt = await db.bank_statements.find_one(
        {"_id": ObjectId(statement_id), "company_id": ObjectId(company_id)}
    )
    if not stmt:
        raise HTTPException(status_code=404, detail="Extrait non trouvé")

    return {
        "id": str(stmt["_id"]),
        "filename": stmt.get("filename"),
        "bank_name": stmt.get("bank_name"),
        "account_number": stmt.get("account_number"),
        "period_start": stmt.get("period_start"),
        "period_end": stmt.get("period_end"),
        "currency": stmt.get("currency", "TND"),
        "opening_balance": stmt.get("opening_balance", 0),
        "closing_balance": stmt.get("closing_balance", 0),
        "transactions": stmt.get("transactions") or [],
        "status": stmt.get("status"),
    }


@router.post("/validate-entries")
async def validate_bank_entries(
    data: ValidateEntriesRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Valide les écritures comptables proposées pour les lignes sélectionnées.
    Crée les écritures dans journal_entries.
    """
    await get_current_company(current_user, data.company_id)
    now = datetime.now(timezone.utc)
    company_id = data.company_id

    # Get next entry number
    last = await db.journal_entries.find_one(
        {"company_id": ObjectId(company_id)},
        sort=[("created_at", -1)]
    )
    try:
        last_num = int((last.get("entry_number") or "EC-00000").split("-")[-1])
    except Exception:
        last_num = 0

    created_entries = []
    validated_ids = []

    for i, line in enumerate(data.lines):
        if not line.validated:
            continue
        amount = line.credit if line.credit > 0 else line.debit
        if amount <= 0:
            continue

        # Parse date
        try:
            line_date = datetime.fromisoformat(line.date).replace(tzinfo=timezone.utc) if line.date else now
        except Exception:
            line_date = now

        entry_number = f"EC-{(last_num + len(created_entries) + 1):05d}"

        # Build journal lines
        d_code = line.suggested_account_debit or line.account_debit or "521"
        d_name = line.suggested_account_debit_name or line.account_debit_name or "Banques"
        c_code = line.suggested_account_credit or line.account_credit or "521"
        c_name = line.suggested_account_credit_name or line.account_credit_name or "Banques"

        # For credit lines: money coming in (company receives)
        if line.credit > 0:
            journal_type = "bank"
            lines_data = [
                {"account_code": "521", "account_name": "Banques", "debit": round(amount, 3), "credit": 0, "description": line.description},
                {"account_code": c_code, "account_name": c_name, "debit": 0, "credit": round(amount, 3), "description": line.description},
            ]
        else:
            journal_type = "bank"
            lines_data = [
                {"account_code": d_code, "account_name": d_name, "debit": round(amount, 3), "credit": 0, "description": line.description},
                {"account_code": "521", "account_name": "Banques", "debit": 0, "credit": round(amount, 3), "description": line.description},
            ]

        entry_doc = {
            "company_id": ObjectId(company_id),
            "entry_number": entry_number,
            "date": line_date,
            "reference": line.reference or "",
            "description": line.description,
            "journal_type": journal_type,
            "lines": lines_data,
            "total_debit": round(amount, 3),
            "total_credit": round(amount, 3),
            "status": "posted",
            "document_type": "bank_statement",
            "bank_statement_id": data.statement_id,
            "bank_line_id": line.id,
            "matched_invoice_id": line.matched_invoice_id,
            "created_by": current_user["_id"],
            "created_at": now
        }

        r = await db.journal_entries.insert_one(entry_doc)
        created_entries.append({
            "id": str(r.inserted_id),
            "entry_number": entry_number,
            "line_id": line.id,
            "amount": amount
        })
        validated_ids.append(line.id)

        # ── Opération caisse pour retraits espèces / carte ─────────────────────
        if getattr(line, "is_cash_operation", False) or getattr(line, "is_card_operation", False):
            try:
                from routes.cash_accounts import auto_record_cash_movement
                cash_direction = amount if line.credit > 0 else -amount  # entrée ou sortie
                await auto_record_cash_movement(
                    db=db,
                    company_id=data.company_id,
                    amount=cash_direction,
                    description=f"{'Versement' if cash_direction > 0 else 'Retrait'} espèces — {line.description}",
                    reference=line.reference or "",
                    payment_method="cash",
                    user_id=str(current_user["_id"])
                )
            except Exception as e:
                logger.warning(f"Opération caisse non créée: {e}")

    # Update validated lines in statement
    if validated_ids and data.statement_id:
        stmt = await db.bank_statements.find_one({"_id": ObjectId(data.statement_id)})
        if stmt:
            transactions = stmt.get("transactions") or []
            for t in transactions:
                if t.get("id") in validated_ids:
                    t["validated"] = True
            await db.bank_statements.update_one(
                {"_id": ObjectId(data.statement_id)},
                {"$set": {"transactions": transactions}}
            )

    return {
        "created_entries": len(created_entries),
        "entries": created_entries,
        "message": f"{len(created_entries)} écriture(s) validée(s)"
    }


@router.post("/lettrage")
async def lettrage_bank_line(
    data: LettrageRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Lettrage : rapproche une ligne de l'extrait bancaire avec une facture fournisseur.
    Marque la facture comme payée et crée l'écriture comptable 401/521.
    """
    await get_current_company(current_user, data.company_id)
    company_id = data.company_id
    now = datetime.now(timezone.utc)
    user_name = current_user.get("full_name") or current_user.get("email", "")

    # Get statement and line
    stmt = await db.bank_statements.find_one(
        {"_id": ObjectId(data.statement_id), "company_id": ObjectId(company_id)}
    )
    if not stmt:
        raise HTTPException(status_code=404, detail="Extrait non trouvé")

    transactions = stmt.get("transactions") or []
    if data.line_index >= len(transactions):
        raise HTTPException(status_code=400, detail="Ligne invalide")

    bank_line = transactions[data.line_index]
    amount = float(bank_line.get("debit") or 0)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Seulement les débits (sorties) peuvent être lettrés avec des factures fournisseur")

    # Get the supplier invoice
    invoice = await db.supplier_invoices.find_one(
        {"_id": ObjectId(data.invoice_id), "company_id": ObjectId(company_id)}
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Facture non trouvée")
    if invoice.get("status") == "paid":
        raise HTTPException(status_code=400, detail="Facture déjà payée")

    inv_number = invoice.get("number") or str(data.invoice_id)
    supplier_name = invoice.get("supplier_name") or ""
    inv_amount = invoice.get("balance_due") or invoice.get("total", 0)

    # Mark invoice as paid
    await db.supplier_invoices.update_one(
        {"_id": ObjectId(data.invoice_id)},
        {"$set": {
            "status": "paid",
            "amount_paid": inv_amount,
            "balance_due": 0,
            "paid_at": now,
            "payment_method": "transfer",
            "payment_reference": data.payment_reference or bank_line.get("reference"),
            "lettered": True,
            "bank_statement_id": data.statement_id,
            "updated_at": now
        }}
    )

    # Update supplier balance
    if invoice.get("supplier_id"):
        await db.suppliers.update_one(
            {"_id": invoice["supplier_id"]},
            {"$inc": {"balance": -inv_amount, "total_paid": inv_amount}}
        )

    # Create journal entry: Débit 401 / Crédit 521
    last = await db.journal_entries.find_one(
        {"company_id": ObjectId(company_id)},
        sort=[("created_at", -1)]
    )
    try:
        last_num = int((last.get("entry_number") or "EC-00000").split("-")[-1])
    except Exception:
        last_num = 0

    entry_number = f"EC-{(last_num + 1):05d}"
    payment_desc = f"Règlement par virement — {inv_number} — {supplier_name}"
    if data.payment_reference:
        payment_desc += f" (Réf: {data.payment_reference})"

    try:
        line_date = datetime.fromisoformat(bank_line.get("date") or now.isoformat()).replace(tzinfo=timezone.utc)
    except Exception:
        line_date = now

    journal_entry = {
        "company_id": ObjectId(company_id),
        "entry_number": entry_number,
        "date": line_date,
        "reference": inv_number,
        "payment_reference": data.payment_reference or bank_line.get("reference"),
        "description": payment_desc,
        "journal_type": "bank",
        "lines": [
            {
                "account_code": "401",
                "account_name": "Fournisseurs",
                "debit": round(inv_amount, 3),
                "credit": 0,
                "description": f"Règlement facture {inv_number}"
            },
            {
                "account_code": "521",
                "account_name": "Banques — Virement",
                "debit": 0,
                "credit": round(inv_amount, 3),
                "description": f"Virement bancaire"
            }
        ],
        "total_debit": round(inv_amount, 3),
        "total_credit": round(inv_amount, 3),
        "status": "posted",
        "document_type": "supplier_payment",
        "document_id": ObjectId(data.invoice_id),
        "payment_method": "transfer",
        "bank_statement_id": data.statement_id,
        "bank_line_index": data.line_index,
        "created_by": current_user["_id"],
        "created_at": now
    }
    je_result = await db.journal_entries.insert_one(journal_entry)

    # Mark bank line as validated and lettered
    transactions[data.line_index]["validated"] = True
    transactions[data.line_index]["matched_invoice_id"] = data.invoice_id
    transactions[data.line_index]["matched_invoice_number"] = inv_number
    transactions[data.line_index]["lettered"] = True
    await db.bank_statements.update_one(
        {"_id": ObjectId(data.statement_id)},
        {"$set": {"transactions": transactions}}
    )

    return {
        "message": f"Lettrage effectué — Facture {inv_number} rapprochée avec le virement",
        "invoice_number": inv_number,
        "amount": inv_amount,
        "entry_number": entry_number,
        "journal_entry_id": str(je_result.inserted_id)
    }


@router.get("/pending-customer-invoices")
async def get_pending_customer_invoices(
    company_id: str = Query(...),
    customer_name: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """Factures clients non payées, éligibles au lettrage depuis les crédits bancaires."""
    await get_current_company(current_user, company_id)
    query = {
        "company_id": ObjectId(company_id),
        "balance_due": {"$gt": 0},
        "status": {"$in": ["sent", "partial", "overdue"]}
    }
    invoices = await db.invoices.find(query).sort("date", 1).to_list(200)
    result = []
    for inv in invoices:
        cust = await db.customers.find_one({"_id": inv.get("customer_id")})
        cust_name = cust.get("display_name", "") if cust else ""
        if customer_name and customer_name.lower() not in cust_name.lower():
            continue
        result.append({
            "id": str(inv["_id"]),
            "number": inv.get("number"),
            "customer_name": cust_name,
            "date": inv.get("date").isoformat() if isinstance(inv.get("date"), datetime) else inv.get("date"),
            "total": inv.get("total", 0),
            "balance_due": inv.get("balance_due", 0),
        })
    return result


@router.post("/lettrage-client")
async def lettrage_bank_credit_with_customer_invoice(
    data: LettrageRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Lettrage crédit bancaire ↔ facture client :
    Un crédit sur le relevé (argent reçu) = règlement d'une facture de vente.
    Écriture : Débit 521 Banques / Crédit 411 Clients
    """
    await get_current_company(current_user, data.company_id)
    company_id = data.company_id
    now = datetime.now(timezone.utc)
    user_name = current_user.get("full_name") or current_user.get("email", "")

    stmt = await db.bank_statements.find_one(
        {"_id": ObjectId(data.statement_id), "company_id": ObjectId(company_id)}
    )
    if not stmt:
        raise HTTPException(status_code=404, detail="Extrait non trouvé")

    transactions = stmt.get("transactions") or []
    if data.line_index >= len(transactions):
        raise HTTPException(status_code=400, detail="Ligne invalide")

    bank_line = transactions[data.line_index]
    amount = float(bank_line.get("credit") or 0)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Seulement les crédits (entrées) peuvent lettrer avec des factures clients")

    invoice = await db.invoices.find_one(
        {"_id": ObjectId(data.invoice_id), "company_id": ObjectId(company_id)}
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Facture client non trouvée")
    if invoice.get("status") == "paid":
        raise HTTPException(status_code=400, detail="Facture déjà payée")

    inv_number = invoice.get("number") or str(data.invoice_id)
    inv_amount = invoice.get("balance_due") or invoice.get("total", 0)
    cust = await db.customers.find_one({"_id": invoice.get("customer_id")})
    cust_name = cust.get("display_name", "") if cust else ""

    # Marquer la facture comme payée
    await db.invoices.update_one(
        {"_id": ObjectId(data.invoice_id)},
        {"$set": {
            "status": "paid",
            "amount_paid": inv_amount,
            "balance_due": 0,
            "paid_at": now,
            "payment_method": "transfer",
            "payment_reference": data.payment_reference or bank_line.get("reference"),
            "lettered": True,
            "bank_statement_id": data.statement_id,
            "updated_at": now
        }}
    )

    # Mettre à jour le solde client
    if invoice.get("customer_id"):
        await db.customers.update_one(
            {"_id": invoice["customer_id"]},
            {"$inc": {"balance": -inv_amount}}
        )

    # Écriture comptable : Débit 521 / Crédit 411
    last = await db.journal_entries.find_one(
        {"company_id": ObjectId(company_id)}, sort=[("created_at", -1)]
    )
    try:
        last_num = int((last.get("entry_number") or "EC-00000").split("-")[-1])
    except Exception:
        last_num = 0

    entry_number = f"EC-{(last_num + 1):05d}"
    try:
        line_date = datetime.fromisoformat(bank_line.get("date") or now.isoformat()).replace(tzinfo=timezone.utc)
    except Exception:
        line_date = now

    payment_desc = f"Règlement virement client — {inv_number} — {cust_name}"
    if data.payment_reference:
        payment_desc += f" (Réf: {data.payment_reference})"

    await db.journal_entries.insert_one({
        "company_id": ObjectId(company_id),
        "entry_number": entry_number,
        "date": line_date,
        "reference": inv_number,
        "description": payment_desc,
        "journal_type": "bank",
        "lines": [
            {"account_code": "521", "account_name": "Banques", "debit": round(inv_amount, 3), "credit": 0, "description": f"Virement client {inv_number}"},
            {"account_code": "411", "account_name": "Clients", "debit": 0, "credit": round(inv_amount, 3), "description": f"Règlement facture {inv_number}"}
        ],
        "total_debit": round(inv_amount, 3),
        "total_credit": round(inv_amount, 3),
        "status": "posted",
        "document_type": "customer_payment",
        "document_id": ObjectId(data.invoice_id),
        "payment_method": "transfer",
        "bank_statement_id": data.statement_id,
        "bank_line_index": data.line_index,
        "created_by": current_user["_id"],
        "created_at": now
    })

    # Marquer la ligne comme lettrée
    transactions[data.line_index]["validated"] = True
    transactions[data.line_index]["matched_invoice_id"] = data.invoice_id
    transactions[data.line_index]["matched_invoice_number"] = inv_number
    transactions[data.line_index]["lettered"] = True
    await db.bank_statements.update_one(
        {"_id": ObjectId(data.statement_id)},
        {"$set": {"transactions": transactions}}
    )

    return {
        "message": f"Lettrage effectué — Facture client {inv_number} rapprochée",
        "invoice_number": inv_number,
        "customer_name": cust_name,
        "amount": inv_amount,
        "entry_number": entry_number
    }


@router.get("/pending-invoices")
async def get_pending_supplier_invoices(
    company_id: str = Query(...),
    supplier_name: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """Factures fournisseur non payées, éligibles au lettrage."""
    await get_current_company(current_user, company_id)
    query = {
        "company_id": ObjectId(company_id),
        "balance_due": {"$gt": 0},
        "status": {"$in": ["received", "partial"]}
    }
    invoices = await db.supplier_invoices.find(query).sort("date", 1).to_list(200)
    result = []
    for inv in invoices:
        if supplier_name:
            sn = (inv.get("supplier_name") or "").lower()
            if supplier_name.lower() not in sn:
                continue
        result.append({
            "id": str(inv["_id"]),
            "number": inv.get("number"),
            "supplier_number": inv.get("supplier_number"),
            "supplier_name": inv.get("supplier_name") or "",
            "date": inv.get("date").isoformat() if isinstance(inv.get("date"), datetime) else inv.get("date"),
            "total": inv.get("total", 0),
            "balance_due": inv.get("balance_due", 0),
        })
    return result
