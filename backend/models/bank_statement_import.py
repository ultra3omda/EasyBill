"""
bank_statement_import.py
MongoDB models for bank statement import module.
Collections: bank_statement_imports, bank_transactions, reconciliation_suggestions
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from bson import ObjectId
from .user import PyObjectId


class BankStatementImport(BaseModel):
    """Import record for uploaded bank statement file."""
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    company_id: PyObjectId
    file_path: str
    file_name: Optional[str] = None
    original_file_name: Optional[str] = None
    mime_type: Optional[str] = None
    provider: str = "document_ai"  # document_ai, gemini, pdfplumber
    ocr_provider: Optional[str] = None
    status: str = "pending"  # pending, processing, processed, failed, too_many_lines, needs_split, review_required
    error_message: Optional[str] = None
    transaction_count: int = 0
    estimated_transaction_count: int = 0
    processing_complexity: Optional[str] = None
    import_warning: Optional[str] = None
    suggested_split: Optional[str] = None
    parsing_warnings: List[str] = []
    ocr_raw: Optional[dict] = None
    ocr_text: Optional[str] = None
    llm_call_count: int = 0
    suggestion_count: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    processed_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by: Optional[PyObjectId] = None

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True


class BankTransaction(BaseModel):
    """Extracted bank transaction from statement."""
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    import_id: PyObjectId
    company_id: PyObjectId
    txn_date: str  # YYYY-MM-DD
    value_date: Optional[str] = None
    label_raw: str
    label_clean: Optional[str] = None
    debit: float = 0.0
    credit: float = 0.0
    amount_signed: float = 0.0  # credit positive, debit negative
    balance: Optional[float] = None
    currency: str = "TND"
    reference: Optional[str] = None
    direction: Optional[str] = None
    transaction_type: Optional[str] = None
    status: str = "pending"
    confidence: Optional[float] = None
    matched_entity_type: Optional[str] = None
    matched_entity_id: Optional[PyObjectId] = None
    suggested_entry_id: Optional[PyObjectId] = None
    reasoning: Optional[str] = None
    reconciliation_status: str = "pending"
    hash_unique: str  # sha1(date + amountSigned + labelRaw)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None
    reconciled: bool = False
    reconciliation_id: Optional[PyObjectId] = None

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True


class ReconciliationSuggestion(BaseModel):
    """Auto-generated reconciliation match suggestion."""
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    transaction_id: PyObjectId
    company_id: PyObjectId
    candidate_type: str  # invoice, supplier_invoice, payment, supplier_payment, expense
    candidate_id: Optional[PyObjectId] = None
    score: float  # 0-100
    confidence: Optional[str] = None
    match_pass: Optional[str] = None
    reason: Optional[str] = None
    status: str = "pending"  # pending, approved, rejected, ignored
    should_letter: bool = False
    suggested_entry: Optional[dict] = None
    matched_entity_type: Optional[str] = None
    matched_entity_id: Optional[PyObjectId] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    approved_by: Optional[PyObjectId] = None

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
