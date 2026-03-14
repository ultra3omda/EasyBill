import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { DetailPanelSkeleton, TableSkeleton, WorkflowProgressSkeleton } from '../components/ui/skeleton';
import { WorkflowStageProgress } from '../components/banking/WorkflowStageProgress';
import { toast } from 'sonner';
import { useCompany } from '../hooks/useCompany';
import {
  Upload, FileText, Building2, CheckCircle, Loader2, Link2,
  ChevronDown, ChevronRight, Calendar, RefreshCw, History,
  ArrowDownLeft, ArrowUpRight, Check, X, Search, Edit2, Banknote, ShieldCheck, AlertTriangle, ScanLine, Sparkles
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;
const token = () => localStorage.getItem('token');
const fmt = n => {
  const x = Number(n || 0);
  return x.toLocaleString('fr-TN', {
    minimumFractionDigits: x % 1 === 0 ? 0 : 3,
    maximumFractionDigits: 3
  });
};

const TYPE_COLORS = {
  virement: 'bg-blue-100 text-blue-700',
  cheque: 'bg-purple-100 text-purple-700',
  prelevement: 'bg-orange-100 text-orange-700',
  commission: 'bg-gray-100 text-gray-600',
  interets: 'bg-green-100 text-green-700',
  autre: 'bg-gray-100 text-gray-500',
};

const OPERATION_TYPES = {
  paiement_fournisseur: { label: 'Paiement fournisseur', color: 'bg-red-100 text-red-700' },
  paiement_client: { label: 'Paiement client', color: 'bg-green-100 text-green-700' },
  frais_bancaires: { label: 'Frais bancaires', color: 'bg-gray-100 text-gray-600' },
  salaire: { label: 'Salaire', color: 'bg-blue-100 text-blue-700' },
  charge_sociale: { label: 'Charge sociale', color: 'bg-purple-100 text-purple-700' },
  impot: { label: 'Impot', color: 'bg-yellow-100 text-yellow-700' },
  tva: { label: 'TVA', color: 'bg-yellow-100 text-yellow-700' },
  loyer: { label: 'Loyer', color: 'bg-orange-100 text-orange-700' },
  telecom: { label: 'Telecom', color: 'bg-cyan-100 text-cyan-700' },
  marketing: { label: 'Marketing / Pub', color: 'bg-pink-100 text-pink-700' },
  assurance: { label: 'Assurance', color: 'bg-indigo-100 text-indigo-700' },
  transport: { label: 'Transport', color: 'bg-amber-100 text-amber-700' },
  entretien_vehicule: { label: 'Entretien vehicule', color: 'bg-amber-100 text-amber-700' },
  retrait_especes: { label: 'Retrait especes', color: 'bg-yellow-100 text-yellow-700' },
  versement_especes: { label: 'Versement especes', color: 'bg-green-100 text-green-700' },
  virement_interne: { label: 'Virement interne', color: 'bg-blue-100 text-blue-700' },
  remboursement: { label: 'Remboursement', color: 'bg-green-100 text-green-700' },
  charge_exploitation: { label: 'Charge exploitation', color: 'bg-orange-100 text-orange-700' },
  produit_financier: { label: 'Produit financier', color: 'bg-emerald-100 text-emerald-700' },
  honoraire: { label: 'Honoraires', color: 'bg-violet-100 text-violet-700' },
  abonnement: { label: 'Abonnement / Licence', color: 'bg-sky-100 text-sky-700' },
  fourniture_bureau: { label: 'Fournitures bureau', color: 'bg-slate-100 text-slate-700' },
  retenue_source: { label: 'Retenue a la source', color: 'bg-yellow-100 text-yellow-700' },
  taxe: { label: 'Taxe', color: 'bg-yellow-100 text-yellow-700' },
  achat_carte: { label: 'Achat par carte', color: 'bg-orange-100 text-orange-700' },
  remboursement_tva: { label: 'Remboursement TVA', color: 'bg-green-100 text-green-700' },
  autre: { label: 'Autre', color: 'bg-gray-100 text-gray-500' },
};

const CONFIDENCE_COLORS = {
  fort: 'bg-green-100 text-green-700 border-green-300',
  moyen: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  faible: 'bg-red-100 text-red-700 border-red-300',
};

const FILTER_OPTIONS = [
  { value: 'all', label: 'Toutes les lignes' },
  { value: 'attention', label: 'Attention requise' },
  { value: 'validated', label: 'Validées' },
  { value: 'lettered', label: 'Lettrées' },
];

const getConfidenceVariant = (confidence) => {
  if (confidence === 'fort') return 'success';
  if (confidence === 'moyen') return 'warning';
  return 'destructive';
};

const getStatementWarnings = (statement, unresolvedCount) => {
  const warnings = [];
  if (statement?.total_lines > 250) warnings.push("Le relevé contient un volume élevé d'opérations. Le scan manuel sera plus rapide avec des filtres.");
  if (statement?.benchmark) warnings.push("Le benchmark a comparé plusieurs moteurs. Vérifiez la méthode retenue avant validation massive.");
  if (unresolvedCount > 0) warnings.push(`${unresolvedCount} ligne(s) demandent encore une action manuelle ou une vérification.`);
  if (statement?.error) warnings.push(statement.error);
  return warnings;
};

export default function BankReconciliation() {
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const fileInputRef = useRef(null);

  const [tab, setTab] = useState('upload'); // 'upload' | 'history'
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [statement, setStatement] = useState(null);
  const [provider, setProvider] = useState('auto'); // auto | pdfplumber | gemini | openai | benchmark
  const [statements, setStatements] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Édition des comptes comptables
  const [editingLine, setEditingLine] = useState(null);
  const [editModal, setEditModal] = useState({ open: false, idx: null, tx: null });
  // Lettrage
  const [lettrageModal, setLettrageModal] = useState({ open: false, lineIndex: null, line: null, type: 'supplier' });
  const [pendingInvoices, setPendingInvoices] = useState([]);
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [lettering, setLettering] = useState(false);
  const [paymentRef, setPaymentRef] = useState('');
  // Validation globale
  const [validating, setValidating] = useState(false);
  // Masquer les lettrés par défaut
  const [hideLettered, setHideLettered] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [lineFilter, setLineFilter] = useState('attention');
  const [lineQuery, setLineQuery] = useState('');
  const [activeLineIndex, setActiveLineIndex] = useState(null);
  const [parseElapsed, setParseElapsed] = useState(0);
  const [parseStep, setParseStep] = useState('');
  const parseTimerRef = useRef(null);
  const saveTimeoutRef = useRef(null);
  const statementRef = useRef(statement);
  useEffect(() => { statementRef.current = statement; }, [statement]);

  const saveStatement = useCallback(async (transactionsOverride) => {
    const st = statementRef.current;
    if (!st || !currentCompany) return;
    const sid = st.statement_id || st.id;
    if (!sid) return;
    const txs = transactionsOverride ?? (st.transactions || []);
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/bank-reconciliation/statements/${sid}?company_id=${currentCompany.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ transactions: txs })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Erreur sauvegarde');
      toast.success('Modifications enregistrées');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }, [currentCompany]);

  const saveStatementDebounced = useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => saveStatement(), 800);
  }, [saveStatement]);

  const loadHistory = useCallback(async () => {
    if (!currentCompany) return;
    setLoadingHistory(true);
    try {
      const res = await fetch(`${API}/api/bank-reconciliation/statements?company_id=${currentCompany.id}`,
        { headers: { Authorization: `Bearer ${token()}` } });
      setStatements(await res.json());
    } catch { toast.error('Erreur chargement historique'); }
    finally { setLoadingHistory(false); }
  }, [currentCompany]);

  useEffect(() => { if (tab === 'history') loadHistory(); }, [tab, loadHistory]);
  useEffect(() => {
    if (tab === 'upload' && statements.length === 0 && currentCompany) {
      loadHistory();
    }
  }, [tab, statements.length, currentCompany, loadHistory]);
  useEffect(() => () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    if (parseTimerRef.current) clearInterval(parseTimerRef.current);
  }, []);

  const handleFileSelect = useCallback((f) => {
    if (!f) return;
    const ok = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!ok.includes(f.type) && !f.name.match(/\.(pdf|jpg|jpeg|png|webp)$/i)) {
      toast.error('Format non supporté');
      return;
    }
    setFile(f);
    setStatement(null);
  }, []);

  const getEstimatedTime = (f) => {
    if (!f) return 180;
    const sizeMb = f.size / (1024 * 1024);
    if (sizeMb > 5) return 480;
    if (sizeMb > 2) return 360;
    if (sizeMb > 1) return 300;
    if (sizeMb > 0.5) return 240;
    return 180;
  };

  const PARSE_STEPS = [
    { at: 0, label: 'Envoi du fichier au serveur...' },
    { at: 3, label: 'Analyse du document en cours...' },
    { at: 10, label: 'Extraction des transactions (Document AI / Gemini)...' },
    { at: 30, label: 'Traitement des pages du relevé...' },
    { at: 60, label: 'Découpage et analyse des pages volumineuses...' },
    { at: 120, label: 'Classification IA des transactions (par batch)...' },
    { at: 180, label: 'Finalisation de l\'analyse...' },
  ];

  const parseWithProvider = async (selectedProvider, signal) => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`${API}/api/bank-reconciliation/parse?company_id=${currentCompany.id}&provider=${selectedProvider}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}` },
      body: fd,
      signal
    });
    let data;
    try {
      data = await res.json();
    } catch (_) {
      throw new Error('Réponse invalide du serveur');
    }
    if (!res.ok) {
      const error = new Error(data.detail || data.error || 'Erreur analyse');
      error.status = res.status;
      error.payload = data;
      throw error;
    }
    return data;
  };

  const handleParse = async () => {
    if (!file || !currentCompany) return;
    setParsing(true);
    setStatement(null);
    setParseElapsed(0);
    setParseStep(PARSE_STEPS[0].label);
    parseTimerRef.current = setInterval(() => {
      setParseElapsed(prev => {
        const next = prev + 1;
        const step = [...PARSE_STEPS].reverse().find(s => next >= s.at);
        if (step) setParseStep(step.label);
        return next;
      });
    }, 1000);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8 * 60 * 1000);
      let data;
      try {
        data = await parseWithProvider(provider, controller.signal);
      } catch (e) {
        const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
        const shouldRetryWithGemini =
          provider === 'auto' &&
          isPdf &&
          e?.status === 422 &&
          /Extraction impossible après plusieurs tentatives/i.test(e?.message || '');

        if (!shouldRetryWithGemini) {
          throw e;
        }

        setParseStep('Le mode automatique a échoué, relance avec Gemini...');
        toast.error('Mode automatique en échec sur ce PDF, relance avec Gemini...');
        data = await parseWithProvider('gemini', controller.signal);
      }
      clearTimeout(timeoutId);
      if (data.error && !data.transactions?.length) {
        throw new Error(data.error);
      }
      const txs = data.transactions || [];
      setStatement({
        ...data,
        id: data.statement_id || data.id,
        statement_id: data.statement_id || data.id,
        currency: data.currency || 'TND',
        opening_balance: data.opening_balance ?? 0,
        closing_balance: data.closing_balance ?? 0,
        transactions: txs,
        total_lines: data.total_lines ?? txs.length,
      });
      toast.success(data.benchmark ? `Benchmark terminé — ${txs.length} ligne(s) (meilleur: ${data.extraction_method || 'N/A'})` : `${txs.length} ligne(s) extraite(s)`);
    } catch (e) {
      if (e.name === 'AbortError') {
        toast.error('Délai dépassé — Réessayez ou utilisez un document plus court.');
      } else {
        toast.error(e.message || 'Erreur lors de l\'analyse');
      }
    } finally {
      if (parseTimerRef.current) clearInterval(parseTimerRef.current);
      parseTimerRef.current = null;
      setParsing(false);
      setParseElapsed(0);
      setParseStep('');
    }
  };

  const loadStatement = async (id) => {
    try {
      const res = await fetch(`${API}/api/bank-reconciliation/statements/${id}?company_id=${currentCompany.id}`,
        { headers: { Authorization: `Bearer ${token()}` } });
      const data = await res.json();
      setStatement({ ...data, statement_id: data.id, transactions: data.transactions || [] });
      setTab('upload');
    } catch { toast.error('Erreur chargement'); }
  };

  const loadPendingInvoices = async () => {
    try {
      const res = await fetch(`${API}/api/bank-reconciliation/pending-invoices?company_id=${currentCompany.id}`,
        { headers: { Authorization: `Bearer ${token()}` } });
      setPendingInvoices(await res.json());
    } catch { toast.error('Erreur chargement factures'); }
  };

  const openLettrageModal = (lineIndex, line, type = 'supplier') => {
    setLettrageModal({ open: true, lineIndex, line, type });
    setPaymentRef(line.reference || '');
    if (type === 'supplier') {
      loadPendingInvoices();
    } else {
      loadPendingCustomerInvoices();
    }
  };

  const loadPendingCustomerInvoices = async () => {
    try {
      const res = await fetch(`${API}/api/bank-reconciliation/pending-customer-invoices?company_id=${currentCompany.id}`,
        { headers: { Authorization: `Bearer ${token()}` } });
      setPendingInvoices(await res.json());
    } catch { toast.error('Erreur chargement factures clients'); }
  };

  const toggleValidated = (idx) => {
    if (!statement) return;
    const txs = [...statement.transactions];
    txs[idx] = { ...txs[idx], validated: !txs[idx].validated };
    setStatement({ ...statement, transactions: txs });
    saveStatementDebounced();
  };

  const updateAccountField = (idx, field, value) => {
    if (!statement) return;
    const txs = [...statement.transactions];
    txs[idx] = { ...txs[idx], [field]: value };
    setStatement({ ...statement, transactions: txs });
    saveStatementDebounced();
  };

  const handleValidateSelected = async () => {
    if (!statement) return;
    const selected = (statement.transactions || []).filter(t => t.validated && !t.lettered);
    if (selected.length === 0) { toast.error('Aucune ligne sélectionnée'); return; }
    setValidating(true);
    try {
      const res = await fetch(`${API}/api/bank-reconciliation/validate-entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          company_id: currentCompany.id,
          statement_id: statement.statement_id || statement.id || '',
          lines: selected.map(t => ({
            ...t,
            suggested_account_debit: t.account_debit,
            suggested_account_credit: t.account_credit,
            suggested_account_debit_name: t.account_debit_name,
            suggested_account_credit_name: t.account_credit_name,
          }))
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      toast.success(data.message);
      const sid = statement.statement_id || statement.id;
      if (sid) {
        const res2 = await fetch(`${API}/api/bank-reconciliation/statements/${sid}?company_id=${currentCompany.id}`,
          { headers: { Authorization: `Bearer ${token()}` } });
        const data2 = await res2.json();
        setStatement({ ...data2, statement_id: data2.id });
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setValidating(false);
    }
  };

  const handleLettrage = async (invoiceId) => {
    setLettering(true);
    const endpoint = lettrageModal.type === 'client'
      ? '/api/bank-reconciliation/lettrage-client'
      : '/api/bank-reconciliation/lettrage';
    try {
      const res = await fetch(`${API}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          company_id: currentCompany.id,
          statement_id: statement.statement_id || statement.id || '',
          line_index: lettrageModal.lineIndex,
          invoice_id: invoiceId,
          payment_reference: paymentRef || undefined,
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      toast.success(data.message);
      setLettrageModal({ open: false, lineIndex: null, line: null });
      // Mark line as lettered locally
      const txs = [...statement.transactions];
      txs[lettrageModal.lineIndex] = {
        ...txs[lettrageModal.lineIndex],
        validated: true,
        lettered: true,
        matched_invoice_number: data.invoice_number,
      };
      setStatement({ ...statement, transactions: txs });
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLettering(false);
    }
  };

  const filteredInvoices = pendingInvoices.filter(inv =>
    !invoiceSearch ||
    (inv.number || '').toLowerCase().includes(invoiceSearch.toLowerCase()) ||
    (inv.supplier_name || '').toLowerCase().includes(invoiceSearch.toLowerCase())
  );

  const allRows = (statement?.transactions || []).map((t, idx) => ({ t, origIdx: idx }));
  const selectedCount = allRows.filter(({ t }) => t.validated && !t.lettered).length;
  const unresolvedCount = allRows.filter(({ t }) => !t.validated && !t.lettered).length;
  const validatedCount = allRows.filter(({ t }) => t.validated && !t.lettered).length;
  const letteredCount = allRows.filter(({ t }) => t.lettered).length;
  const filteredRows = allRows.filter(({ t }) => {
    if (hideLettered && t.lettered) return false;
    if (lineFilter === 'attention' && (t.validated || t.lettered)) return false;
    if (lineFilter === 'validated' && (!t.validated || t.lettered)) return false;
    if (lineFilter === 'lettered' && !t.lettered) return false;
    if (lineQuery) {
      const haystack = `${t.description || ''} ${t.reference || ''} ${t.account_debit || ''} ${t.account_credit || ''} ${t.matched_invoice_number || ''}`.toLowerCase();
      if (!haystack.includes(lineQuery.toLowerCase())) return false;
    }
    return true;
  });
  const displayRows = filteredRows;
  const activeLine = activeLineIndex != null ? statement?.transactions?.[activeLineIndex] : null;
  const statementWarnings = getStatementWarnings(statement, unresolvedCount);
  const statementStages = [
    {
      id: 'upload',
      label: 'Upload reçu',
      status: file || statement ? 'complete' : 'pending',
      meta: file?.name || statement?.bank_name || 'Aucun document chargé',
    },
    {
      id: 'ocr',
      label: 'OCR en cours',
      status: parsing && parseElapsed < 10 ? 'active' : statement ? 'complete' : 'pending',
      meta: parsing ? 'Lecture des pages et détection des blocs bancaires' : 'OCR terminé',
    },
    {
      id: 'detected',
      label: 'Opérations détectées',
      status: (statement?.total_lines || 0) > 0 ? 'complete' : parsing && parseElapsed >= 10 ? 'active' : 'pending',
      meta: statement?.total_lines ? `${statement.total_lines} ligne(s) détectée(s)` : 'Comptage des opérations en cours',
    },
    {
      id: 'parsing',
      label: 'Parsing en cours',
      status: parsing && parseElapsed >= 10 && parseElapsed < 120 ? 'active' : statement ? 'complete' : 'pending',
      meta: parseStep || statement?.extraction_method || 'Normalisation comptable',
    },
    {
      id: 'analysis',
      label: 'Analyse de rapprochement',
      status: reanalyzing ? 'active' : statement ? (unresolvedCount > 0 ? 'warning' : 'complete') : 'pending',
      meta: reanalyzing ? 'Réanalyse IA en cours' : `${unresolvedCount} ligne(s) encore à arbitrer`,
    },
    {
      id: 'ready',
      label: 'Suggestions prêtes',
      status: statement ? (unresolvedCount > 0 ? 'warning' : 'complete') : 'pending',
      meta: statement ? `${validatedCount} validée(s), ${letteredCount} lettrée(s)` : 'En attente de résultat',
    },
  ];

  useEffect(() => {
    if (!statement?.transactions?.length) {
      setActiveLineIndex(null);
      return;
    }
    if (activeLineIndex != null && statement.transactions[activeLineIndex]) return;
    const firstAttention = statement.transactions.findIndex((tx) => !tx.validated && !tx.lettered);
    setActiveLineIndex(firstAttention >= 0 ? firstAttention : 0);
  }, [statement, activeLineIndex]);

  useEffect(() => {
    if (!displayRows.length) return;
    if (activeLineIndex != null && displayRows.some(({ origIdx }) => origIdx === activeLineIndex)) return;
    setActiveLineIndex(displayRows[0].origIdx);
  }, [displayRows, activeLineIndex]);

  return (
    <AppLayout>
      <div className="page-shell section-stack">
        <div className="page-header">
          <div>
            <h1 className="page-header-title flex items-center gap-2">
              <Building2 className="h-6 w-6 text-primary" />
              Lettrage bancaire
            </h1>
            <p className="page-header-subtitle">
              Import d'extrait, lecture OCR, analyse comptable et rapprochement dans un flux de travail unique.
            </p>
          </div>
          <div className="page-actions">
            <Button variant={tab === 'upload' ? 'default' : 'outline'} onClick={() => setTab('upload')}>
              <Upload className="mr-1 h-4 w-4" /> Nouvel extrait
            </Button>
            <Button variant={tab === 'history' ? 'default' : 'outline'} onClick={() => setTab('history')}>
              <History className="mr-1 h-4 w-4" /> Historique
            </Button>
          </div>
        </div>

        <Card className="border-blue-200 bg-blue-50/80">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 text-blue-700" />
              <div className="grid gap-2 text-sm text-blue-800 md:grid-cols-2">
                <p>Le temps de traitement dépend surtout du nombre de lignes bancaires détectées, pas uniquement de la taille du PDF.</p>
                <p>Un petit extrait peut rester lent s'il contient beaucoup d'opérations ou une longue période.</p>
                <p>Les périodes plus courtes réduisent les erreurs d'OCR et accélèrent le rapprochement.</p>
                <p>Les relevés denses peuvent nécessiter un découpage avant import pour garder des suggestions fiables.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <WorkflowStageProgress
          title="Progression du traitement"
          description="Suivi de l'import, de l'OCR, du parsing et de la préparation des suggestions."
          stages={statementStages}
          metrics={[
            { label: 'Lignes', value: statement?.total_lines || 0 },
            { label: 'À revoir', value: unresolvedCount },
            { label: 'Lettrées', value: letteredCount },
          ]}
        />

        {tab === 'upload' && (
          <>
            {!statement && !parsing && (
              <div className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
                <Card className="interactive-lift">
                  <CardHeader>
                    <CardTitle>Préparer un nouvel extrait</CardTitle>
                    <p className="text-sm text-slate-500">Choisissez le moteur d'extraction puis déposez le document. Les relevés très denses sont plus sûrs lorsqu'ils sont scindés.</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm text-slate-600">Moteur d'extraction</Label>
                      <Select value={provider} onValueChange={setProvider}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">Auto (recommandé)</SelectItem>
                          <SelectItem value="pdfplumber">pdfplumber (PDF uniquement)</SelectItem>
                          <SelectItem value="gemini">Gemini</SelectItem>
                          <SelectItem value="openai">OpenAI GPT-4o</SelectItem>
                          <SelectItem value="anthropic">Anthropic Claude</SelectItem>
                          <SelectItem value="benchmark">Benchmark (tester tous)</SelectItem>
                        </SelectContent>
                      </Select>
                      {provider === 'benchmark' ? (
                        <p className="text-xs text-amber-700">Le benchmark compare pdfplumber, Gemini, OpenAI et Anthropic avant de retenir le meilleur résultat exploitable.</p>
                      ) : null}
                    </div>

                    <div
                      onDrop={e => { e.preventDefault(); setDragOver(false); handleFileSelect(e.dataTransfer.files[0]); }}
                      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onClick={() => !file && fileInputRef.current?.click()}
                      className={`rounded-[24px] border-2 border-dashed p-8 text-center transition-all ${
                        dragOver ? 'border-primary bg-blue-50' : file ? 'border-emerald-300 bg-emerald-50' : 'border-slate-300 bg-slate-50 hover:border-primary/50 hover:bg-blue-50/50'
                      }`}
                    >
                      <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                        onChange={e => handleFileSelect(e.target.files[0])} />
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm">
                        {file ? <FileText className="h-6 w-6 text-emerald-600" /> : <Upload className="h-6 w-6 text-primary" />}
                      </div>
                      {file ? (
                        <div className="mt-4">
                          <p className="font-semibold text-slate-900">{file.name}</p>
                          <p className="mt-1 text-sm text-slate-500">{(file.size / 1024).toFixed(1)} Ko</p>
                          <p className="mt-2 text-xs text-slate-400">Le traitement dépendra surtout des lignes bancaires détectées.</p>
                        </div>
                      ) : (
                        <div className="mt-4 space-y-2">
                          <p className="font-semibold text-slate-900">Glissez-déposez le relevé bancaire</p>
                          <p className="text-sm text-slate-500">PDF ou image, jusqu'à 15 Mo</p>
                          <p className="text-xs text-slate-400">Les relevés courts sur une période limitée sont traités plus vite.</p>
                        </div>
                      )}
                    </div>

                    {file ? (
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <Button variant="outline" onClick={() => { setFile(null); setStatement(null); }}>
                          Annuler
                        </Button>
                        <Button onClick={handleParse} disabled={parsing} className="min-w-40">
                          {provider === 'benchmark' ? 'Lancer le benchmark' : "Analyser l'extrait"}
                        </Button>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>

                <div className="section-stack">
                  <Card>
                    <CardHeader>
                      <CardTitle>Ce que EasyBill va faire</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                          <ScanLine className="h-4 w-4 text-primary" />
                          OCR et lecture du document
                        </div>
                        <p className="mt-2 text-sm text-slate-600">Lecture des pages, détection des colonnes et récupération des opérations bancaires.</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                          <Sparkles className="h-4 w-4 text-primary" />
                          Parsing et suggestions
                        </div>
                        <p className="mt-2 text-sm text-slate-600">Normalisation des libellés, proposition de comptes et pré-lettrage des écritures pertinentes.</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Historique récent</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {loadingHistory ? (
                        <WorkflowProgressSkeleton steps={4} />
                      ) : statements.length === 0 ? (
                        <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
                          <p className="text-base font-semibold text-slate-900">Aucun extrait importé</p>
                          <p className="mt-2 text-sm text-slate-500">Les derniers extraits traités apparaîtront ici avec leurs volumes et leur statut d'avancement.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {statements.slice(0, 3).map((s) => (
                            <button
                              key={s.id}
                              onClick={() => loadStatement(s.id)}
                              className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition-colors hover:bg-slate-50"
                            >
                              <div>
                                <p className="font-medium text-slate-900">{s.bank_name || s.filename}</p>
                                <p className="text-sm text-slate-500">{s.period_start} {s.period_end ? `→ ${s.period_end}` : ''}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-semibold text-slate-900">{s.total_lines} ligne(s)</p>
                                <p className="text-xs text-slate-400">{s.validated_lines}/{s.total_lines} validées</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {parsing && !statement && (() => {
              const estimated = getEstimatedTime(file);
              const progress = Math.min((parseElapsed / estimated) * 100, 95);
              const remaining = Math.max(estimated - parseElapsed, 0);
              const fmtTime = s => {
                const m = Math.floor(s / 60);
                const sec = s % 60;
                return m > 0 ? `${m} min ${sec.toString().padStart(2, '0')} s` : `${sec} s`;
              };
              return (
                <Card className="border-blue-200 bg-gradient-to-br from-blue-50 via-white to-slate-50">
                  <CardContent className="p-8 md:p-10">
                    <div className="mx-auto max-w-3xl space-y-6">
                      <div className="text-center">
                        <p className="text-lg font-semibold text-slate-950">Traitement de l'extrait en cours</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {file?.name} · le temps dépend surtout du nombre d'opérations détectées.
                        </p>
                      </div>

                      <WorkflowStageProgress
                        stages={statementStages}
                        metrics={[
                          { label: 'Temps écoulé', value: fmtTime(parseElapsed) },
                          { label: 'Restant estimé', value: `~${fmtTime(remaining)}` },
                          { label: 'Progression', value: `${Math.round(progress)}%` },
                        ]}
                      />

                      <div className="rounded-[24px] border border-blue-200 bg-white p-5">
                        <div className="flex items-center justify-between text-sm text-slate-500">
                          <span>Étape active</span>
                          <span>{Math.round(progress)}%</span>
                        </div>
                        <p className="mt-3 text-base font-semibold text-blue-900">{parseStep}</p>
                        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-blue-100">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 transition-all duration-1000 ease-out"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <p className="mt-4 text-xs text-slate-500">
                          Les relevés très denses ou sur de longues périodes peuvent demander plus de temps, même avec un fichier léger.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            {statement && (
              <>
                {statementWarnings.length > 0 ? (
                  <Card className="border-amber-200 bg-amber-50/80">
                    <CardContent className="p-5">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-700" />
                        <div className="space-y-1 text-sm text-amber-800">
                          {statementWarnings.map((warning, index) => (
                            <p key={`${warning}-${index}`}>{warning}</p>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ) : null}

                {statement.benchmark && statement.benchmark_results?.length > 0 && (
                  <Card className="border-amber-200 bg-amber-50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Comparaison des moteurs d'extraction</CardTitle>
                      <p className="text-sm text-amber-800 mt-1 font-normal">
                        Le benchmark compare plusieurs moteurs. Le résultat affiché ci-dessous utilise le moteur jugé le plus exploitable.
                      </p>
                    </CardHeader>
                    <CardContent>
                      {statement.benchmark_summary?.description ? (
                        <p className="mb-3 rounded-2xl bg-amber-100 p-3 text-sm text-amber-800">
                          {statement.benchmark_summary.description}
                        </p>
                      ) : null}
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Méthode</TableHead>
                            <TableHead className="text-right">Durée</TableHead>
                            <TableHead className="text-right">Lignes</TableHead>
                            <TableHead>Statut</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {statement.benchmark_results.map((r, i) => {
                            const isWinner = statement.benchmark_summary?.winner === r.provider;
                            const timeSec = r.time_ms >= 1000 ? `${(r.time_ms / 1000).toFixed(1)} s` : `${r.time_ms} ms`;
                            return (
                              <TableRow key={i} className={isWinner ? 'bg-emerald-50/70' : ''}>
                                <TableCell>
                                  {r.provider}{r.model ? ` (${r.model})` : ''}
                                  {isWinner ? <Badge variant="success" className="ml-2">Retenu</Badge> : null}
                                </TableCell>
                                <TableCell className="text-right">{timeSec}</TableCell>
                                <TableCell className="text-right">{r.transactions_count}</TableCell>
                                <TableCell>
                                  {r.success ? <Badge variant="success">OK</Badge> : <Badge variant="destructive">{r.error || 'Échec'}</Badge>}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                      {statement.extraction_method ? (
                        <p className="mt-3 text-sm font-medium text-amber-700">
                          Méthode retenue : {statement.extraction_method}
                        </p>
                      ) : null}
                    </CardContent>
                  </Card>
                )}

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Card className="interactive-lift">
                    <CardContent className="p-5">
                      <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Banque / compte</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{statement.bank_name || 'Extrait bancaire'}</p>
                      <p className="mt-1 text-sm text-slate-500">{statement.account_number || 'Compte non détecté'}</p>
                    </CardContent>
                  </Card>
                  <Card className="interactive-lift">
                    <CardContent className="p-5">
                      <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Période</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{statement.period_start || '—'} {statement.period_end ? `→ ${statement.period_end}` : ''}</p>
                      <p className="mt-1 text-sm text-slate-500">{statement.currency || 'TND'}</p>
                    </CardContent>
                  </Card>
                  <Card className="interactive-lift">
                    <CardContent className="p-5">
                      <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Soldes</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">Ouverture {fmt(statement.opening_balance)} TND</p>
                      <p className="mt-1 text-sm text-slate-500">Clôture {fmt(statement.closing_balance)} TND</p>
                    </CardContent>
                  </Card>
                  <Card className="interactive-lift">
                    <CardContent className="p-5">
                      <p className="text-xs uppercase tracking-[0.12em] text-slate-400">État du workbench</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{statement.total_lines || 0} ligne(s)</p>
                      <p className="mt-1 text-sm text-slate-500">{unresolvedCount} à traiter · {letteredCount} lettrée(s)</p>
                    </CardContent>
                  </Card>
                </div>

                <Card className="border-slate-200/80">
                  <CardHeader>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <CardTitle className="text-base">Workbench de rapprochement</CardTitle>
                        <p className="text-sm text-slate-500">Comprendre rapidement la nature de chaque ligne, la suggestion de compte, le niveau de confiance et l'action à prendre.</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          value={lineQuery}
                          onChange={(e) => setLineQuery(e.target.value)}
                          placeholder="Rechercher une ligne, une référence, un compte..."
                          className="w-[300px]"
                        />
                        <Select value={lineFilter} onValueChange={setLineFilter}>
                          <SelectTrigger className="w-[200px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FILTER_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                          <input type="checkbox" checked={hideLettered} onChange={e => setHideLettered(e.target.checked)} className="rounded" />
                          Masquer les lettrés
                        </label>
                        <Button variant="outline" onClick={saveStatement} disabled={saving || !statement?.transactions?.length}>
                          {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                          Sauvegarder
                        </Button>
                        {selectedCount > 0 ? (
                          <Button onClick={handleValidateSelected} disabled={validating} className="bg-emerald-600 hover:bg-emerald-700">
                            {validating ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}
                            Valider {selectedCount}
                          </Button>
                        ) : null}
                        <Button
                          variant="outline"
                          disabled={reanalyzing}
                          onClick={async () => {
                            setReanalyzing(true);
                            try {
                              const sid = statement.statement_id || statement.id;
                              const res = await fetch(
                                `${API}/api/bank-reconciliation/ai-analyze/${sid}?company_id=${currentCompany.id}`,
                                { method: 'POST', headers: { Authorization: `Bearer ${token()}` } }
                              );
                              const data = await res.json();
                              if (!res.ok) throw new Error(data.detail);
                              setStatement(prev => ({ ...prev, transactions: data.transactions, ai_stats: data.ai_stats }));
                              toast.success(`Analyse IA terminee — ${data.ai_stats?.fort || 0} fort, ${data.ai_stats?.moyen || 0} moyen, ${data.ai_stats?.faible || 0} faible`);
                            } catch (e) {
                              toast.error(e.message);
                            } finally {
                              setReanalyzing(false);
                            }
                          }}
                        >
                          {reanalyzing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}
                          Re-analyser avec IA
                        </Button>
                        <Button variant="outline" onClick={() => { setStatement(null); setFile(null); }}>
                          <RefreshCw className="mr-1 h-4 w-4" /> Nouvel extrait
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {parsing ? (
                      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_360px]">
                        <TableSkeleton rows={8} columns={7} showToolbar={false} />
                        <DetailPanelSkeleton />
                      </div>
                    ) : displayRows.length === 0 ? (
                      <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
                        <p className="text-base font-semibold text-slate-900">Aucune ligne à afficher</p>
                        <p className="mt-2 text-sm text-slate-500">Ajustez les filtres ou rechargez un autre extrait.</p>
                      </div>
                    ) : (
                      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_360px]">
                        <div className="table-surface overflow-hidden">
                          <div className="overflow-auto">
                            <table className="w-full min-w-[1100px] text-sm">
                              <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur">
                                <tr className="border-b border-slate-200/80">
                                  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">OK</th>
                                  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Opération</th>
                                  <th className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Montant</th>
                                  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Suggestion / lettrage</th>
                                  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Comptes suggérés</th>
                                  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Confiance</th>
                                  <th className="px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {displayRows.map(({ t, origIdx }) => {
                                  const isAttention = !t.validated && !t.lettered;
                                  const isActive = activeLineIndex === origIdx;
                                  return (
                                    <tr
                                      key={origIdx}
                                      onClick={() => setActiveLineIndex(origIdx)}
                                      className={`cursor-pointer border-b border-slate-200/70 align-top transition-colors ${
                                        isActive ? 'bg-blue-50/70' : t.lettered ? 'bg-slate-50/70' : isAttention ? 'bg-amber-50/30 hover:bg-amber-50/50' : 'hover:bg-slate-50/80'
                                      }`}
                                    >
                                      <td className="px-3 py-3">
                                        {!t.lettered ? (
                                          <button
                                            onClick={(e) => { e.stopPropagation(); toggleValidated(origIdx); }}
                                            className={`flex h-5 w-5 items-center justify-center rounded border-2 ${
                                              t.validated ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 bg-white'
                                            }`}
                                          >
                                            {t.validated ? <Check className="h-3 w-3 text-white" /> : null}
                                          </button>
                                        ) : (
                                          <Link2 className="mx-auto h-4 w-4 text-blue-600" />
                                        )}
                                      </td>
                                      <td className="px-3 py-3">
                                        <div className="max-w-[320px]">
                                          <div className="flex flex-wrap items-center gap-2">
                                            <p className="font-medium text-slate-900">{t.description || 'Sans libellé'}</p>
                                            {t.operation_type && t.operation_type !== 'autre' ? (
                                              <Badge variant="secondary">{(OPERATION_TYPES[t.operation_type] || OPERATION_TYPES.autre).label}</Badge>
                                            ) : (
                                              <Badge variant="secondary">{t.transaction_type || 'Autre'}</Badge>
                                            )}
                                            {t.needs_lettrage ? <Badge variant="info">Lettrage requis</Badge> : null}
                                          </div>
                                          <p className="mt-1 text-xs text-slate-500">{t.date || '-'} {t.reference ? `· ${t.reference}` : ''}</p>
                                          {t.ai_explanation ? (
                                            <p className="mt-2 line-clamp-2 text-xs text-slate-400">{t.ai_explanation}</p>
                                          ) : null}
                                        </div>
                                      </td>
                                      <td className="px-3 py-3 text-right">
                                        <div>
                                          {t.debit > 0 ? (
                                            <p className="font-semibold text-red-700">{fmt(t.debit)} TND</p>
                                          ) : (
                                            <p className="font-semibold text-emerald-700">{fmt(t.credit)} TND</p>
                                          )}
                                          <p className="mt-1 text-xs text-slate-400">{t.debit > 0 ? 'Sortie' : 'Entrée'}</p>
                                        </div>
                                      </td>
                                      <td className="px-3 py-3">
                                        <div className="space-y-2">
                                          {t.matched_invoice_number ? (
                                            <Badge variant="info">{t.matched_invoice_number}</Badge>
                                          ) : (
                                            <Badge variant={isAttention ? 'warning' : 'secondary'}>{isAttention ? 'Manuel requis' : 'En attente'}</Badge>
                                          )}
                                          <p className="text-xs text-slate-500">
                                            {t.piece_metier ? t.piece_metier.replace(/_/g, ' ') : 'Aucune pièce métier détectée'}
                                          </p>
                                        </div>
                                      </td>
                                      <td className="px-3 py-3">
                                        <div className="space-y-1 text-xs">
                                          <div className="rounded-xl border border-slate-200 bg-white px-2 py-1">
                                            <span className="font-mono font-semibold text-slate-900">{t.account_debit || '—'}</span>
                                            <span className="ml-1 text-slate-500">{t.account_debit_name || 'Débit'}</span>
                                          </div>
                                          <div className="rounded-xl border border-slate-200 bg-white px-2 py-1">
                                            <span className="font-mono font-semibold text-slate-900">{t.account_credit || '—'}</span>
                                            <span className="ml-1 text-slate-500">{t.account_credit_name || 'Crédit'}</span>
                                          </div>
                                        </div>
                                      </td>
                                      <td className="px-3 py-3">
                                        <div className="space-y-2">
                                          {t.confidence ? <Badge variant={getConfidenceVariant(t.confidence)}>{t.confidence}</Badge> : <Badge variant="secondary">Sans score</Badge>}
                                          {t.lettered ? <Badge variant="success">Lettré</Badge> : null}
                                          {t.is_cash_operation ? <Badge variant="warning">+ Caisse</Badge> : null}
                                        </div>
                                      </td>
                                      <td className="px-3 py-3">
                                        <div className="flex flex-col items-stretch gap-2">
                                          {!t.validated && !t.lettered ? (
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="h-8"
                                              onClick={(e) => { e.stopPropagation(); setEditModal({ open: true, idx: origIdx, tx: { ...t } }); }}
                                            >
                                              <Edit2 className="mr-1 h-3 w-3" /> Éditer
                                            </Button>
                                          ) : null}
                                          {!t.lettered && t.debit > 0 ? (
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="h-8 border-blue-200 text-blue-700"
                                              onClick={(e) => { e.stopPropagation(); openLettrageModal(origIdx, t, 'supplier'); }}
                                            >
                                              <Link2 className="mr-1 h-3 w-3" /> Fournisseur
                                            </Button>
                                          ) : null}
                                          {!t.lettered && t.credit > 0 ? (
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="h-8 border-emerald-200 text-emerald-700"
                                              onClick={(e) => { e.stopPropagation(); openLettrageModal(origIdx, t, 'client'); }}
                                            >
                                              <Link2 className="mr-1 h-3 w-3" /> Client
                                            </Button>
                                          ) : null}
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {activeLine ? (
                          <Card className="sticky top-4 h-fit">
                            <CardHeader>
                              <CardTitle className="text-base">Détail de la ligne sélectionnée</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <p className="font-semibold text-slate-900">{activeLine.description || 'Sans libellé'}</p>
                                <p className="mt-1 text-sm text-slate-500">{activeLine.date || '-'} {activeLine.reference ? `· ${activeLine.reference}` : ''}</p>
                              </div>
                              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
                                <div className="rounded-2xl border border-slate-200 p-4">
                                  <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Montant</p>
                                  <p className={`mt-2 text-lg font-semibold ${activeLine.debit > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                                    {fmt(activeLine.debit > 0 ? activeLine.debit : activeLine.credit)} TND
                                  </p>
                                  <p className="text-sm text-slate-500">{activeLine.debit > 0 ? 'Débit / sortie' : 'Crédit / entrée'}</p>
                                </div>
                                <div className="rounded-2xl border border-slate-200 p-4">
                                  <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Confiance IA</p>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {activeLine.confidence ? <Badge variant={getConfidenceVariant(activeLine.confidence)}>{activeLine.confidence}</Badge> : <Badge variant="secondary">Sans score</Badge>}
                                    {activeLine.needs_lettrage ? <Badge variant="info">Lettrage requis</Badge> : null}
                                    {activeLine.lettered ? <Badge variant="success">Déjà lettré</Badge> : null}
                                  </div>
                                </div>
                              </div>

                              <div className="rounded-2xl border border-slate-200 p-4">
                                <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Comptes suggérés</p>
                                <div className="mt-3 space-y-2 text-sm">
                                  <div className="rounded-xl bg-slate-50 px-3 py-2">
                                    <span className="font-mono font-semibold text-slate-900">{activeLine.account_debit || '—'}</span>
                                    <span className="ml-2 text-slate-500">{activeLine.account_debit_name || 'Compte débit'}</span>
                                  </div>
                                  <div className="rounded-xl bg-slate-50 px-3 py-2">
                                    <span className="font-mono font-semibold text-slate-900">{activeLine.account_credit || '—'}</span>
                                    <span className="ml-2 text-slate-500">{activeLine.account_credit_name || 'Compte crédit'}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="rounded-2xl border border-slate-200 p-4">
                                <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Raisonnement / correspondance</p>
                                <p className="mt-3 text-sm text-slate-600">{activeLine.ai_explanation || 'Aucune explication détaillée fournie par le moteur.'}</p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {activeLine.matched_invoice_number ? <Badge variant="info">{activeLine.matched_invoice_number}</Badge> : null}
                                  {activeLine.piece_metier ? <Badge variant="secondary">{activeLine.piece_metier.replace(/_/g, ' ')}</Badge> : null}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ) : (
                          <DetailPanelSkeleton />
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </>
        )}

        {tab === 'history' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <History className="h-4 w-4 text-primary" />
                Extraits bancaires importés
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loadingHistory ? (
                <div className="p-4">
                  <TableSkeleton rows={5} columns={6} showToolbar={false} />
                </div>
              ) : statements.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
                  <p className="text-base font-semibold text-slate-900">Aucun extrait importé</p>
                  <p className="mt-2 text-sm text-slate-500">Les extraits validés ou en cours apparaîtront ici pour réouverture dans le workbench.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Banque</TableHead>
                      <TableHead>Période</TableHead>
                      <TableHead className="text-right">Lignes</TableHead>
                      <TableHead className="text-right">Validées</TableHead>
                      <TableHead>Date import</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {statements.map(s => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.bank_name || s.filename}</TableCell>
                        <TableCell className="text-slate-500">
                          {s.period_start} {s.period_end ? `→ ${s.period_end}` : ''}
                        </TableCell>
                        <TableCell className="text-right">{s.total_lines}</TableCell>
                        <TableCell className="text-right">
                          <span className={s.validated_lines === s.total_lines ? 'font-medium text-emerald-700' : 'text-slate-600'}>
                            {s.validated_lines}/{s.total_lines}
                          </span>
                        </TableCell>
                        <TableCell className="text-slate-500">
                          {s.created_at ? new Date(s.created_at).toLocaleDateString('fr-TN') : '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button size="sm" variant="outline" onClick={() => loadStatement(s.id)}>
                            Ouvrir
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Modal Édition écriture comptable ── */}
      <Dialog open={editModal.open} onOpenChange={o => setEditModal(p => ({ ...p, open: o }))}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-violet-600" />
              Modifier l'écriture comptable
            </DialogTitle>
          </DialogHeader>
          {editModal.tx && (
            <div className="space-y-4 py-2">
              {/* Description */}
              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <p className="font-medium">{editModal.tx.description}</p>
                <div className="flex justify-between text-gray-500 text-xs mt-1">
                  <span>{editModal.tx.date}</span>
                  <span>
                    {editModal.tx.debit > 0 ? `Débit: ${fmt(editModal.tx.debit)} TND` : `Crédit: ${fmt(editModal.tx.credit)} TND`}
                  </span>
                </div>
                {(editModal.tx.is_cash_operation || editModal.tx.is_card_operation) && (
                  <div className="mt-1 text-xs text-yellow-700 flex items-center gap-1">
                    <Banknote className="w-3 h-3" />
                    Opération espèces — une écriture de caisse sera créée automatiquement
                  </div>
                )}
              </div>

              {/* Compte débit */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium text-gray-600">Compte débit (N°)</Label>
                  <Input
                    value={editModal.tx.account_debit || ''}
                    onChange={e => setEditModal(p => ({ ...p, tx: { ...p.tx, account_debit: e.target.value } }))}
                    className="mt-1 h-8 text-sm font-mono"
                    placeholder="521"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium text-gray-600">Intitulé compte débit</Label>
                  <Input
                    value={editModal.tx.account_debit_name || ''}
                    onChange={e => setEditModal(p => ({ ...p, tx: { ...p.tx, account_debit_name: e.target.value } }))}
                    className="mt-1 h-8 text-sm"
                    placeholder="Banques"
                  />
                </div>
              </div>

              {/* Compte crédit */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium text-gray-600">Compte crédit (N°)</Label>
                  <Input
                    value={editModal.tx.account_credit || ''}
                    onChange={e => setEditModal(p => ({ ...p, tx: { ...p.tx, account_credit: e.target.value } }))}
                    className="mt-1 h-8 text-sm font-mono"
                    placeholder="401"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium text-gray-600">Intitulé compte crédit</Label>
                  <Input
                    value={editModal.tx.account_credit_name || ''}
                    onChange={e => setEditModal(p => ({ ...p, tx: { ...p.tx, account_credit_name: e.target.value } }))}
                    className="mt-1 h-8 text-sm"
                    placeholder="Fournisseurs"
                  />
                </div>
              </div>

              {/* Type d'opération + Lettrage */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium text-gray-600">Type d'operation</Label>
                  <select
                    value={editModal.tx.operation_type || 'autre'}
                    onChange={e => setEditModal(p => ({ ...p, tx: { ...p.tx, operation_type: e.target.value } }))}
                    className="mt-1 w-full h-8 text-sm rounded-md border border-gray-200 px-2"
                  >
                    {Object.entries(OPERATION_TYPES).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end gap-2">
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editModal.tx.needs_lettrage || false}
                      onChange={e => setEditModal(p => ({ ...p, tx: { ...p.tx, needs_lettrage: e.target.checked } }))}
                      className="rounded"
                    />
                    Lettrage requis
                  </label>
                </div>
              </div>

              {/* Confiance IA */}
              {editModal.tx.confidence && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Confiance IA :</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${CONFIDENCE_COLORS[editModal.tx.confidence] || ''}`}>
                    {editModal.tx.confidence}
                  </span>
                  {editModal.tx.ai_explanation && (
                    <span className="text-xs text-gray-400 italic">{editModal.tx.ai_explanation}</span>
                  )}
                </div>
              )}

              {/* Aperçu écriture */}
              <div className="bg-violet-50 border border-violet-200 rounded-lg p-3 text-xs font-mono">
                <p className="text-violet-700 font-semibold mb-1">Aperçu de l'écriture :</p>
                <p>Debit <strong>{editModal.tx.account_debit}</strong> {editModal.tx.account_debit_name} · {fmt(editModal.tx.debit > 0 ? editModal.tx.debit : editModal.tx.credit)} TND</p>
                <p>Credit <strong>{editModal.tx.account_credit}</strong> {editModal.tx.account_credit_name}</p>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setEditModal({ open: false, idx: null, tx: null })}>Annuler</Button>
            <Button
              className="bg-violet-600 hover:bg-violet-700"
              onClick={async () => {
                if (!statement || editModal.idx === null) return;
                const txs = [...statement.transactions];
                txs[editModal.idx] = { ...txs[editModal.idx], ...editModal.tx };
                setStatement({ ...statement, transactions: txs });
                setEditModal({ open: false, idx: null, tx: null });
                toast.success('Écriture mise à jour');
                await saveStatement(txs);
              }}
            >
              <Check className="w-4 h-4 mr-1" /> Appliquer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Lettrage Modal ── */}
      <Dialog open={lettrageModal.open} onOpenChange={o => setLettrageModal(p => ({ ...p, open: o }))}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className={`w-5 h-5 ${lettrageModal.type === 'client' ? 'text-green-600' : 'text-blue-600'}`} />
              {lettrageModal.type === 'client'
                ? 'Lettrage — Rapprochement avec une facture client'
                : 'Lettrage — Rapprochement avec une facture fournisseur'}
            </DialogTitle>
          </DialogHeader>
          {lettrageModal.line && (
            <div className="space-y-4">
              {/* Bank line summary */}
              <div className={`rounded-lg p-3 text-sm border ${lettrageModal.type === 'client' ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}>
                <p className={`font-medium ${lettrageModal.type === 'client' ? 'text-green-800' : 'text-blue-800'}`}>
                  {lettrageModal.line.description}
                </p>
                <div className={`flex justify-between mt-1 ${lettrageModal.type === 'client' ? 'text-green-700' : 'text-blue-700'}`}>
                  <span>{lettrageModal.line.date}</span>
                  {lettrageModal.type === 'client'
                    ? <span className="font-bold text-green-600">+ {fmt(lettrageModal.line.credit)} TND (Crédit reçu)</span>
                    : <span className="font-bold text-red-600">- {fmt(lettrageModal.line.debit)} TND (Débit)</span>
                  }
                </div>
              </div>

              {/* Reference */}
              <div>
                <Label className="text-sm">Référence de paiement (optionnel)</Label>
                <Input
                  value={paymentRef}
                  onChange={e => setPaymentRef(e.target.value)}
                  placeholder="Référence du virement..."
                  className="mt-1"
                />
              </div>

              {/* Invoice search */}
              <div>
                <Label className="text-sm font-medium mb-1 block">Sélectionner la facture à lettrer</Label>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    value={invoiceSearch}
                    onChange={e => setInvoiceSearch(e.target.value)}
                    placeholder="Rechercher par N° ou fournisseur..."
                    className="pl-9"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
                  {filteredInvoices.length === 0 ? (
                    <p className="text-center text-gray-400 py-4 text-sm">Aucune facture en attente</p>
                  ) : filteredInvoices.map(inv => (
                    <button
                      key={inv.id}
                      onClick={() => handleLettrage(inv.id)}
                      disabled={lettering}
                      className="w-full text-left p-3 hover:bg-blue-50 flex items-center justify-between gap-2 transition-colors"
                    >
                      <div>
                        <p className="font-medium text-sm">{inv.number}</p>
                        <p className="text-xs text-gray-500">{inv.supplier_name} · {inv.date?.slice(0, 10)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-red-600 text-sm">{fmt(inv.balance_due)} TND</p>
                        {Math.abs(inv.balance_due - lettrageModal.line?.debit) < 1 && (
                          <Badge className="bg-green-100 text-green-700 text-xs">Montant ≈</Badge>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-violet-50 border border-violet-200 rounded-lg p-3 text-xs text-violet-700">
                <strong>Écriture comptable qui sera créée :</strong>
                {lettrageModal.type === 'client' ? (
                  <div className="mt-1 font-mono">
                    Débit 521 Banques · {fmt(lettrageModal.line?.credit)} TND<br />
                    Crédit 411 Clients (règlement facture)
                  </div>
                ) : (
                  <div className="mt-1 font-mono">
                    Débit 401 Fournisseurs · {fmt(lettrageModal.line?.debit)} TND<br />
                    Crédit 521 Banques — Virement
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
