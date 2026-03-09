import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { toast } from 'sonner';
import { useCompany } from '../hooks/useCompany';
import {
  Upload, FileText, Building2, CheckCircle, Loader2, Link2,
  ChevronDown, ChevronRight, Calendar, RefreshCw, History,
  ArrowDownLeft, ArrowUpRight, Check, X, Search, Edit2, Banknote
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

  const handleParse = async () => {
    if (!file || !currentCompany) return;
    setParsing(true);
    setStatement(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8 * 60 * 1000);
      const res = await fetch(`${API}/api/bank-reconciliation/parse?company_id=${currentCompany.id}&provider=${provider}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}` },
        body: fd,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      let data;
      try {
        data = await res.json();
      } catch (_) {
        throw new Error('Réponse invalide du serveur');
      }
      if (!res.ok) throw new Error(data.detail || data.error || 'Erreur analyse');
      if (data.error && !data.transactions?.length) {
        throw new Error(data.error);
      }
      const txs = data.transactions || [];
      setStatement({
        id: data.statement_id || data.id,
        statement_id: data.statement_id || data.id,
        bank_name: data.bank_name,
        account_number: data.account_number,
        period_start: data.period_start,
        period_end: data.period_end,
        currency: data.currency || 'TND',
        opening_balance: data.opening_balance ?? 0,
        closing_balance: data.closing_balance ?? 0,
        transactions: txs,
        total_lines: data.total_lines ?? txs.length,
        benchmark: data.benchmark,
        benchmark_results: data.benchmark_results,
        benchmark_summary: data.benchmark_summary,
        extraction_method: data.extraction_method,
      });
      toast.success(data.benchmark ? `Benchmark terminé — ${txs.length} ligne(s) (meilleur: ${data.extraction_method || 'N/A'})` : `${txs.length} ligne(s) extraite(s)`);
    } catch (e) {
      if (e.name === 'AbortError') {
        toast.error('Délai dépassé — Réessayez ou utilisez un document plus court.');
      } else {
        toast.error(e.message || 'Erreur lors de l\'analyse');
      }
    } finally {
      setParsing(false);
    }
  };

  const loadStatement = async (id) => {
    try {
      const res = await fetch(`${API}/api/bank-reconciliation/statements/${id}?company_id=${currentCompany.id}`,
        { headers: { Authorization: `Bearer ${token()}` } });
      const data = await res.json();
      setStatement({ ...data, statement_id: data.id });
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
  };

  const updateAccountField = (idx, field, value) => {
    if (!statement) return;
    const txs = [...statement.transactions];
    txs[idx] = { ...txs[idx], [field]: value };
    setStatement({ ...statement, transactions: txs });
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

  const selectedCount = (statement?.transactions || []).filter(t => t.validated && !t.lettered).length;

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Building2 className="w-6 h-6 text-violet-600" />
              Lettrage bancaire
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              Upload de l'extrait de compte · Proposition d'écritures · Lettrage des virements fournisseurs
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={tab === 'upload' ? 'default' : 'outline'}
              onClick={() => setTab('upload')}
              className={tab === 'upload' ? 'bg-violet-600' : ''}
            >
              <Upload className="w-4 h-4 mr-1" /> Nouvel extrait
            </Button>
            <Button
              variant={tab === 'history' ? 'default' : 'outline'}
              onClick={() => setTab('history')}
              className={tab === 'history' ? 'bg-violet-600' : ''}
            >
              <History className="w-4 h-4 mr-1" /> Historique
            </Button>
          </div>
        </div>

        {/* ── Tab Upload ── */}
        {tab === 'upload' && (
          <>
            {/* Upload zone */}
            {!statement && (
              <Card>
                <CardContent className="p-6">
                  {/* Sélecteur API visible dès le chargement */}
                  <div className="mb-4 flex items-center gap-2">
                    <Label className="text-sm text-gray-600">API d'extraction :</Label>
                    <select
                      value={provider}
                      onChange={e => setProvider(e.target.value)}
                      className="border rounded-md px-3 py-1.5 text-sm bg-white"
                    >
                      <option value="auto">Auto (recommandé)</option>
                      <option value="pdfplumber">pdfplumber (PDF uniquement)</option>
                      <option value="gemini">Gemini</option>
                      <option value="openai">OpenAI GPT-4o</option>
                      <option value="benchmark">Benchmark (tester tous)</option>
                    </select>
                    {provider === 'benchmark' && (
                      <span className="text-amber-600 text-sm">→ Compare pdfplumber, Gemini et OpenAI</span>
                    )}
                  </div>
                  <div
                    onDrop={e => { e.preventDefault(); setDragOver(false); handleFileSelect(e.dataTransfer.files[0]); }}
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onClick={() => !file && fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
                      dragOver ? 'border-violet-500 bg-violet-50' : file ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-violet-400'
                    }`}
                  >
                    <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                      onChange={e => handleFileSelect(e.target.files[0])} />
                    {file ? (
                      <div className="space-y-2">
                        <FileText className="w-12 h-12 mx-auto text-green-600" />
                        <p className="font-semibold">{file.name}</p>
                        <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(1)} Ko</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <Building2 className="w-12 h-12 mx-auto text-gray-400" />
                        <p className="font-semibold text-gray-700">Glisser-déposer ou cliquer</p>
                        <p className="text-sm text-gray-400">Extrait de compte PDF ou image — max 15 Mo</p>
                      </div>
                    )}
                  </div>
                  {file && (
                    <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                      <Button variant="outline" onClick={() => { setFile(null); setStatement(null); }}>Annuler</Button>
                      <Button onClick={handleParse} disabled={parsing} className="bg-violet-600 hover:bg-violet-700 min-w-36">
                        {parsing ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Analyse…</> : provider === 'benchmark' ? 'Lancer le benchmark' : 'Analyser l\'extrait'}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Statement summary */}
            {statement && (
              <>
                {statement.benchmark && statement.benchmark_results?.length > 0 && (
                  <Card className="border-amber-200 bg-amber-50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Comparaison des APIs d'extraction</CardTitle>
                      <p className="text-sm text-amber-800 mt-1 font-normal">
                        Le benchmark a testé chaque méthode sur votre document. Le résultat avec le plus de transactions a été retenu pour l'affichage ci-dessous.
                      </p>
                    </CardHeader>
                    <CardContent>
                      {statement.benchmark_summary?.description && (
                        <p className="text-sm text-amber-700 mb-3 p-2 bg-amber-100 rounded">
                          {statement.benchmark_summary.description}
                        </p>
                      )}
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-amber-200">
                              <th className="text-left py-2">Méthode</th>
                              <th className="text-right py-2">Durée</th>
                              <th className="text-right py-2">Lignes extraites</th>
                              <th className="text-left py-2">Statut</th>
                            </tr>
                          </thead>
                          <tbody>
                            {statement.benchmark_results.map((r, i) => {
                              const isWinner = statement.benchmark_summary?.winner === r.provider;
                              const timeSec = r.time_ms >= 1000 ? `${(r.time_ms / 1000).toFixed(1)} s` : `${r.time_ms} ms`;
                              return (
                                <tr
                                  key={i}
                                  className={`border-b border-amber-100 ${isWinner ? 'bg-green-100 font-semibold' : ''}`}
                                >
                                  <td className="py-1.5">
                                    {r.provider}{r.model ? ` (${r.model})` : ''}
                                    {isWinner && <Badge className="ml-2 bg-green-600 text-white text-xs">Retenu</Badge>}
                                  </td>
                                  <td className="text-right">{timeSec}</td>
                                  <td className="text-right">{r.transactions_count}</td>
                                  <td>{r.success ? <Badge className="bg-green-100 text-green-700">OK</Badge> : <span className="text-red-600 text-xs">{r.error || 'Échec'}</span>}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      {statement.extraction_method && (
                        <p className="text-sm text-amber-700 mt-3 font-medium">
                          Méthode utilisée pour les lignes ci-dessous : {statement.extraction_method}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}
                <Card className="bg-violet-50 border-violet-200">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div>
                        <p className="font-bold text-violet-800 text-lg">{statement.bank_name || 'Extrait bancaire'}</p>
                        <p className="text-sm text-violet-600">
                          {statement.period_start && `Du ${statement.period_start}`}
                          {statement.period_end && ` au ${statement.period_end}`}
                          {statement.account_number && ` · Compte : ${statement.account_number}`}
                        </p>
                      </div>
                      <div className="flex gap-4 text-sm">
                        <div className="text-center">
                          <p className="text-gray-500">Solde ouverture</p>
                          <p className="font-bold">{fmt(statement.opening_balance)} TND</p>
                        </div>
                        <div className="text-center">
                          <p className="text-gray-500">Solde clôture</p>
                          <p className="font-bold">{fmt(statement.closing_balance)} TND</p>
                        </div>
                        <div className="text-center">
                          <p className="text-gray-500">Lignes</p>
                          <p className="font-bold">{statement.total_lines || statement.transactions?.length || 0}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {selectedCount > 0 && (
                          <Button
                            onClick={handleValidateSelected}
                            disabled={validating}
                            className="bg-green-600 hover:bg-green-700 gap-1.5"
                          >
                            {validating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            Valider {selectedCount} écriture{selectedCount > 1 ? 's' : ''}
                          </Button>
                        )}
                        <Button variant="outline" onClick={() => { setStatement(null); setFile(null); }}>
                          <RefreshCw className="w-4 h-4 mr-1" /> Nouvel extrait
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Transactions table */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">
                      Lignes de l'extrait — Écritures proposées
                    </CardTitle>
                    <p className="text-xs text-gray-500">
                      Cochez les lignes à valider · Cliquez "Lettrer" pour rapprocher avec une facture fournisseur
                    </p>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="px-3 py-2 text-left w-10">✓</th>
                            <th className="px-3 py-2 text-left">Date</th>
                            <th className="px-3 py-2 text-left">Description / Libellé</th>
                            <th className="px-3 py-2 text-right">Débit</th>
                            <th className="px-3 py-2 text-right">Crédit</th>
                            <th className="px-3 py-2 text-left">Compte débit</th>
                            <th className="px-3 py-2 text-left">Compte crédit</th>
                            <th className="px-3 py-2 text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {(statement.transactions || []).map((t, idx) => (
                            <tr key={idx} className={`hover:bg-gray-50 ${t.validated ? 'bg-green-50/50' : ''} ${t.lettered ? 'bg-blue-50/50' : ''}`}>
                              {/* Checkbox */}
                              <td className="px-3 py-2">
                                {!t.lettered ? (
                                  <button
                                    onClick={() => toggleValidated(idx)}
                                    className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                                      t.validated ? 'border-green-500 bg-green-500' : 'border-gray-300'
                                    }`}
                                  >
                                    {t.validated && <Check className="w-3 h-3 text-white" />}
                                  </button>
                                ) : (
                                  <Link2 className="w-4 h-4 text-blue-500 mx-auto" title="Lettré" />
                                )}
                              </td>

                              {/* Date */}
                              <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{t.date || '-'}</td>

                              {/* Description */}
                              <td className="px-3 py-2">
                                <div className="max-w-xs">
                                  <p className="truncate font-medium">{t.description}</p>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${TYPE_COLORS[t.transaction_type] || TYPE_COLORS.autre}`}>
                                      {t.transaction_type}
                                    </span>
                                    {t.reference && <span className="text-xs text-gray-400">{t.reference}</span>}
                                    {t.matched_invoice_number && (
                                      <span className="text-xs text-blue-600 font-medium">→ {t.matched_invoice_number}</span>
                                    )}
                                  </div>
                                </div>
                              </td>

                              {/* Debit */}
                              <td className="px-3 py-2 text-right">
                                {t.debit > 0 && (
                                  <span className="text-red-600 font-medium flex items-center justify-end gap-0.5">
                                    <ArrowUpRight className="w-3 h-3" />{fmt(t.debit)}
                                  </span>
                                )}
                              </td>

                              {/* Credit */}
                              <td className="px-3 py-2 text-right">
                                {t.credit > 0 && (
                                  <span className="text-green-600 font-medium flex items-center justify-end gap-0.5">
                                    <ArrowDownLeft className="w-3 h-3" />{fmt(t.credit)}
                                  </span>
                                )}
                              </td>

                              {/* Account Debit */}
                              <td className="px-3 py-2">
                                {editingLine === `${idx}-d` ? (
                                  <div className="flex gap-1">
                                    <Input
                                      value={t.account_debit || ''}
                                      onChange={e => updateAccountField(idx, 'account_debit', e.target.value)}
                                      className="h-6 w-16 text-xs p-1"
                                      autoFocus
                                      onBlur={() => setEditingLine(null)}
                                    />
                                    <Input
                                      value={t.account_debit_name || ''}
                                      onChange={e => updateAccountField(idx, 'account_debit_name', e.target.value)}
                                      className="h-6 text-xs p-1"
                                      onBlur={() => setEditingLine(null)}
                                    />
                                  </div>
                                ) : (
                                  <button
                                    className="text-left hover:bg-violet-50 px-1.5 py-0.5 rounded text-xs"
                                    onClick={() => setEditingLine(`${idx}-d`)}
                                  >
                                    <span className="font-mono text-violet-700">{t.account_debit}</span>
                                    <span className="text-gray-500 ml-1 truncate max-w-20 inline-block">{t.account_debit_name}</span>
                                  </button>
                                )}
                              </td>

                              {/* Account Credit */}
                              <td className="px-3 py-2">
                                {editingLine === `${idx}-c` ? (
                                  <div className="flex gap-1">
                                    <Input
                                      value={t.account_credit || ''}
                                      onChange={e => updateAccountField(idx, 'account_credit', e.target.value)}
                                      className="h-6 w-16 text-xs p-1"
                                      autoFocus
                                      onBlur={() => setEditingLine(null)}
                                    />
                                    <Input
                                      value={t.account_credit_name || ''}
                                      onChange={e => updateAccountField(idx, 'account_credit_name', e.target.value)}
                                      className="h-6 text-xs p-1"
                                      onBlur={() => setEditingLine(null)}
                                    />
                                  </div>
                                ) : (
                                  <button
                                    className="text-left hover:bg-violet-50 px-1.5 py-0.5 rounded text-xs"
                                    onClick={() => setEditingLine(`${idx}-c`)}
                                  >
                                    <span className="font-mono text-violet-700">{t.account_credit}</span>
                                    <span className="text-gray-500 ml-1 truncate max-w-20 inline-block">{t.account_credit_name}</span>
                                  </button>
                                )}
                              </td>

                              {/* Actions */}
                              <td className="px-3 py-2 text-center">
                                <div className="flex flex-col gap-1 items-center">
                                {!t.validated && !t.lettered && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 text-xs px-2 border-violet-300 text-violet-700 hover:bg-violet-50 w-full"
                                    onClick={() => setEditModal({ open: true, idx, tx: { ...t } })}
                                  >
                                    <Edit2 className="w-3 h-3 mr-0.5" /> Éditer
                                  </Button>
                                )}
                                {t.is_cash_operation && (
                                  <span className="text-xs text-yellow-600 flex items-center gap-0.5">
                                    <Banknote className="w-3 h-3" /> +Caisse
                                  </span>
                                )}
                                {!t.lettered && t.debit > 0 && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 text-xs px-2 border-blue-300 text-blue-700 hover:bg-blue-50"
                                    onClick={() => openLettrageModal(idx, t, 'supplier')}
                                    title="Lettrer avec une facture fournisseur"
                                  >
                                    <Link2 className="w-3 h-3 mr-0.5" /> Fournisseur
                                  </Button>
                                )}
                                {!t.lettered && t.credit > 0 && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 text-xs px-2 border-green-300 text-green-700 hover:bg-green-50"
                                    onClick={() => openLettrageModal(idx, t, 'client')}
                                    title="Lettrer avec une facture client"
                                  >
                                    <Link2 className="w-3 h-3 mr-0.5" /> Client
                                  </Button>
                                )}
                                {t.lettered && (
                                  <Badge className="bg-blue-100 text-blue-700 text-xs">Lettré</Badge>
                                )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </>
        )}

        {/* ── Tab History ── */}
        {tab === 'history' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <History className="w-4 h-4 text-violet-600" />
                Extraits bancaires importés
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loadingHistory ? (
                <div className="text-center py-8 text-gray-400">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />Chargement…
                </div>
              ) : statements.length === 0 ? (
                <div className="text-center py-8 text-gray-400">Aucun extrait importé</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-2 text-left">Banque</th>
                      <th className="px-4 py-2 text-left">Période</th>
                      <th className="px-4 py-2 text-right">Lignes</th>
                      <th className="px-4 py-2 text-right">Validées</th>
                      <th className="px-4 py-2 text-left">Date import</th>
                      <th className="px-4 py-2 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {statements.map(s => (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium">{s.bank_name || s.filename}</td>
                        <td className="px-4 py-2 text-gray-500">
                          {s.period_start} {s.period_end && `→ ${s.period_end}`}
                        </td>
                        <td className="px-4 py-2 text-right">{s.total_lines}</td>
                        <td className="px-4 py-2 text-right">
                          <span className={s.validated_lines === s.total_lines ? 'text-green-600 font-medium' : ''}>
                            {s.validated_lines}/{s.total_lines}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-gray-500">
                          {s.created_at ? new Date(s.created_at).toLocaleDateString('fr-TN') : '-'}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <Button size="sm" variant="outline" onClick={() => loadStatement(s.id)}>
                            Ouvrir
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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

              {/* Aperçu écriture */}
              <div className="bg-violet-50 border border-violet-200 rounded-lg p-3 text-xs font-mono">
                <p className="text-violet-700 font-semibold mb-1">Aperçu de l'écriture :</p>
                <p>Débit <strong>{editModal.tx.account_debit}</strong> {editModal.tx.account_debit_name} · {fmt(editModal.tx.debit > 0 ? editModal.tx.debit : editModal.tx.credit)} TND</p>
                <p>Crédit <strong>{editModal.tx.account_credit}</strong> {editModal.tx.account_credit_name}</p>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setEditModal({ open: false, idx: null, tx: null })}>Annuler</Button>
            <Button
              className="bg-violet-600 hover:bg-violet-700"
              onClick={() => {
                if (!statement || editModal.idx === null) return;
                const txs = [...statement.transactions];
                txs[editModal.idx] = { ...txs[editModal.idx], ...editModal.tx };
                setStatement({ ...statement, transactions: txs });
                setEditModal({ open: false, idx: null, tx: null });
                toast.success('Écriture mise à jour');
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
