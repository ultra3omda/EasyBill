# Bank Statement Import Module

## Architecture Overview

The bank statement import module provides AI-powered extraction and automatic reconciliation of bank statements.

### Components

| Component | Location | Purpose |
|-----------|----------|---------|
| **Models** | `models/bank_statement_import.py` | Pydantic schemas for MongoDB documents |
| **Extraction Service** | `services/bank_statement_extraction_service.py` | Google Document AI + Gemini fallback |
| **Reconciliation Service** | `services/auto_reconciliation_service.py` | Scoring engine for matching |
| **API Routes** | `routes/bank_statement_import.py` | REST endpoints |
| **React UI** | `frontend/src/pages/BankStatementImportPage.js` | Admin interface |

### MongoDB Collections

**bank_statement_imports**
- `_id`, `companyId`, `filePath`, `file_name`, `provider`, `status`, `transaction_count`, `error_message`, `created_at`, `processed_at`, `created_by`
- Status: `pending` | `processing` | `processed` | `failed`

**bank_transactions**
- `_id`, `importId`, `companyId`, `txnDate`, `valueDate`, `labelRaw`, `labelClean`, `debit`, `credit`, `amountSigned`, `balance`, `currency`, `reference`, `hashUnique`, `reconciled`, `reconciliationId`, `createdAt`
- `amountSigned`: credit positive, debit negative
- `hashUnique`: sha1(date + amountSigned + labelRaw) for duplicate detection

**reconciliation_suggestions**
- `_id`, `transactionId`, `companyId`, `candidateType`, `candidateId`, `score`, `reason`, `status`, `createdAt`, `approvedAt`, `approvedBy`
- candidateType: `invoice` | `supplier_invoice` | `payment` | `supplier_payment`
- status: `pending` | `approved` | `rejected` | `ignored`

### Scoring Rules

| Rule | Points |
|------|--------|
| Amount exact match | +45 |
| Date within 7 days | +20 |
| Reference match | +25 |
| Label similarity > 0.8 | +20 |
| **Strong match** | score >= 85 |
| **Suggested match** | score >= 60 |

### API Endpoints

- `POST /api/bank-statement-import/upload` — Upload PDF/image, starts background extraction
- `GET /api/bank-statement-import/imports` — List imports
- `GET /api/bank-statement-import/transactions` — List transactions (filter: import_id, reconciled)
- `GET /api/bank-statement-import/reconciliation-suggestions` — List suggestions (filter: transaction_id, status)
- `POST /api/bank-statement-import/reconciliation/approve` — Approve match
- `POST /api/bank-statement-import/reconciliation/reject` — Reject suggestion
- `POST /api/bank-statement-import/reconciliation/ignore` — Ignore transaction

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | For fallback | Gemini Vision extraction when Document AI not configured |
| `GOOGLE_CLOUD_PROJECT` | For Document AI | GCP project ID |
| `DOCUMENT_AI_LOCATION` | Optional | Default: `eu` |
| `DOCUMENT_AI_BANK_STATEMENT_PROCESSOR_ID` | For Document AI | Processor ID for bank statements |
| `OPENAI_API_KEY` | For AI matching | Resolve ambiguous cases with GPT |

### File Storage

Uploaded files are stored in `backend/uploads/bank_statement_imports/` (local filesystem).

### Background Jobs

- **ImportBankStatementJob**: Runs on upload, extracts transactions via Document AI or Gemini
- **ExtractTransactionsJob**: Normalizes and inserts transactions (dedup by hash_unique)
- **GenerateReconciliationSuggestionsJob**: Runs after extraction, creates suggestions

Jobs run in-process via `asyncio.create_task()`.
