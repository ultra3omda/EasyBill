import React, { useState, useCallback, useEffect, useRef } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { toast } from 'sonner';
import { useCompany } from '../hooks/useCompany';
import {
  Upload, FileText, Loader2, CheckCircle, XCircle, Clock, RefreshCw,
  ArrowDownLeft, ArrowUpRight, Link2, Check, X, Eye, FileSpreadsheet, AlertTriangle
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const token = () => localStorage.getItem('token');
const fmt = n => Number(n || 0).toLocaleString('fr-TN', { minimumFractionDigits: 0, maximumFractionDigits: 3 });

const STATUS_BADGE = {
  pending: { icon: Clock, class: 'bg-amber-100 text-amber-700' },
  processing: { icon: Loader2, class: 'bg-blue-100 text-blue-700' },
  processed: { icon: CheckCircle, class: 'bg-green-100 text-green-700' },
  review_required: { icon: Eye, class: 'bg-orange-100 text-orange-700' },
  needs_split: { icon: AlertTriangle, class: 'bg-orange-100 text-orange-700' },
  too_many_lines: { icon: AlertTriangle, class: 'bg-red-100 text-red-700' },
  failed: { icon: XCircle, class: 'bg-red-100 text-red-700' },
};

export default function BankStatementImportPage() {
  const { currentCompany } = useCompany();
  const fileInputRef = useRef(null);
  const [tab, setTab] = useState('imports');
  const [imports, setImports] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [filterImportId, setFilterImportId] = useState('');
  const [approveModal, setApproveModal] = useState({ open: false, suggestion: null });
  const [actioning, setActioning] = useState(false);

  const loadImports = useCallback(async () => {
    if (!currentCompany) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/bank-statement-import/imports?company_id=${currentCompany.id}`,
        { headers: { Authorization: `Bearer ${token()}` } });
      const data = await res.json();
      setImports(Array.isArray(data) ? data : []);
      if (!res.ok) toast.error(data.detail || 'Erreur chargement imports');
    } catch { toast.error('Erreur chargement imports'); setImports([]); }
    finally { setLoading(false); }
  }, [currentCompany]);

  const loadTransactions = useCallback(async () => {
    if (!currentCompany) return;
    setLoading(true);
    try {
      let url = `${API}/api/bank-statement-import/transactions?company_id=${currentCompany.id}`;
      if (filterImportId) url += `&import_id=${filterImportId}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token()}` } });
      const data = await res.json();
      setTransactions(Array.isArray(data) ? data : []);
      if (!res.ok) toast.error(data.detail || 'Erreur chargement transactions');
    } catch { toast.error('Erreur chargement transactions'); setTransactions([]); }
    finally { setLoading(false); }
  }, [currentCompany, filterImportId]);

  const loadSuggestions = useCallback(async () => {
    if (!currentCompany) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/bank-statement-import/reconciliation-suggestions?company_id=${currentCompany.id}&status=pending`,
        { headers: { Authorization: `Bearer ${token()}` } });
      const data = await res.json();
      setSuggestions(Array.isArray(data) ? data : []);
      if (!res.ok) toast.error(data.detail || 'Erreur chargement suggestions');
    } catch { toast.error('Erreur chargement suggestions'); setSuggestions([]); }
    finally { setLoading(false); }
  }, [currentCompany]);

  useEffect(() => { if (tab === 'imports') loadImports(); }, [tab, loadImports]);
  useEffect(() => { if (tab === 'transactions') loadTransactions(); }, [tab, loadTransactions, filterImportId]);
  useEffect(() => { if (tab === 'suggestions') loadSuggestions(); }, [tab, loadSuggestions]);

  const handleUpload = async (e) => {
    const file = e?.target?.files?.[0];
    if (!file || !currentCompany) return;
    const ok = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!ok.includes(file.type) && !file.name.match(/\.(pdf|jpg|jpeg|png)$/i)) {
      toast.error('Format non supporté (PDF, JPEG, PNG)');
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${API}/api/bank-statement-import/upload?company_id=${currentCompany.id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Erreur upload');
      toast.success('Import en cours de traitement');
      loadImports();
      fileInputRef.current?.value && (fileInputRef.current.value = '');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleApprove = async () => {
    if (!approveModal.suggestion || !currentCompany) return;
    setActioning(true);
    try {
      const res = await fetch(`${API}/api/bank-statement-import/reconciliation/approve?company_id=${currentCompany.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          suggestion_id: approveModal.suggestion.id,
          transaction_id: approveModal.suggestion.transaction_id,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).detail);
      toast.success('Rapprochement approuvé');
      setApproveModal({ open: false, suggestion: null });
      loadSuggestions();
      loadTransactions();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setActioning(false);
    }
  };

  const handleReject = async (suggestionId) => {
    if (!currentCompany) return;
    setActioning(true);
    try {
      const res = await fetch(`${API}/api/bank-statement-import/reconciliation/reject?suggestion_id=${suggestionId}&company_id=${currentCompany.id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}` } });
      if (!res.ok) throw new Error((await res.json()).detail);
      toast.success('Suggestion rejetée');
      loadSuggestions();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setActioning(false);
    }
  };

  const handleIgnore = async (transactionId) => {
    if (!currentCompany) return;
    setActioning(true);
    try {
      const res = await fetch(`${API}/api/bank-statement-import/reconciliation/ignore?transaction_id=${transactionId}&company_id=${currentCompany.id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}` } });
      if (!res.ok) throw new Error((await res.json()).detail);
      toast.success('Transaction ignorée');
      loadSuggestions();
      loadTransactions();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setActioning(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-header-title flex items-center gap-2">
              <FileSpreadsheet className="w-6 h-6 text-violet-700" />
              Import extraits bancaires
            </h1>
            <p className="page-header-subtitle">
              Import PDF · Extraction Document AI · Rapprochement automatique
            </p>
          </div>
        </div>

        <div className="flex gap-2 border-b border-slate-200">
          <Button variant={tab === 'imports' ? 'default' : 'ghost'} onClick={() => setTab('imports')}>
            <Upload className="w-4 h-4 mr-1" /> Imports
          </Button>
          <Button variant={tab === 'transactions' ? 'default' : 'ghost'} onClick={() => setTab('transactions')}>
            <FileText className="w-4 h-4 mr-1" /> Transactions
          </Button>
          <Button variant={tab === 'suggestions' ? 'default' : 'ghost'} onClick={() => setTab('suggestions')}>
            <Link2 className="w-4 h-4 mr-1" /> Suggestions
          </Button>
        </div>

        {tab === 'imports' && (
          <Card>
            <CardHeader>
              <CardTitle>Imports d'extraits bancaires</CardTitle>
              <p className="text-sm text-slate-500">Uploadez un PDF ou une image d'extrait de compte</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleUpload} />
                <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Upload className="w-4 h-4 mr-1" />}
                  Importer un extrait
                </Button>
                <Button variant="outline" onClick={loadImports}><RefreshCw className="w-4 h-4 mr-1" /> Actualiser</Button>
              </div>
              {loading ? (
                <div className="py-8 text-center text-slate-400"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>
              ) : imports.length === 0 ? (
                <div className="py-8 text-center text-slate-400">Aucun import</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-b bg-slate-50/80"><tr>
                    <th className="px-4 py-2 text-left">Fichier</th>
                    <th className="px-4 py-2 text-left">Statut</th>
                    <th className="px-4 py-2 text-left">Complexité</th>
                    <th className="px-4 py-2 text-right">Lignes</th>
                    <th className="px-4 py-2 text-left">Date</th>
                    <th className="px-4 py-2 text-left">Avertissement</th>
                    <th className="px-4 py-2 text-center">Actions</th>
                  </tr></thead>
                  <tbody className="divide-y">
                    {imports.map(imp => {
                      const st = STATUS_BADGE[imp.status] || STATUS_BADGE.pending;
                      const Icon = st.icon;
                      return (
                        <tr key={imp.id} className="hover:bg-slate-50">
                          <td className="px-4 py-2 font-medium">{imp.file_name || imp.id}</td>
                          <td className="px-4 py-2">
                            <Badge className={st.class}>
                              {imp.status === 'processing' ? <Icon className="w-3 h-3 animate-spin mr-1" /> : <Icon className="w-3 h-3 mr-1" />}
                              {imp.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-2 text-xs">
                            <div className="text-slate-700">{imp.processing_complexity || '—'}</div>
                            <div className="text-slate-400">{imp.ocr_provider || 'n/a'}</div>
                          </td>
                          <td className="px-4 py-2 text-right">
                            <div>{imp.transaction_count}</div>
                            {imp.estimated_transaction_count > imp.transaction_count && (
                              <div className="text-[11px] text-slate-400">estimé {imp.estimated_transaction_count}</div>
                            )}
                          </td>
                          <td className="px-4 py-2 text-slate-500">{imp.created_at?.slice(0, 10)}</td>
                          <td className="px-4 py-2 text-xs">
                            <div className="text-red-600">{imp.error_message || ''}</div>
                            <div className="text-amber-700">{imp.import_warning || '—'}</div>
                            {imp.suggested_split && <div className="text-slate-500">Scinder: {imp.suggested_split}</div>}
                          </td>
                          <td className="px-4 py-2 text-center">
                            {(imp.status === 'failed' || imp.status === 'processing') && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={async () => {
                                  try {
                                    const res = await fetch(`${API}/api/bank-statement-import/retry/${imp.id}?company_id=${currentCompany.id}`, {
                                      method: 'POST',
                                      headers: { Authorization: `Bearer ${token()}` },
                                    });
                                    const data = await res.json();
                                    if (!res.ok) throw new Error(data.detail || 'Erreur');
                                    toast.success('Import relancé');
                                    loadImports();
                                  } catch (e) { toast.error(e.message); }
                                }}
                              >
                                <RefreshCw className="w-3 h-3 mr-1" /> Relancer
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        )}

        {tab === 'transactions' && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Transactions extraites</CardTitle>
                <select value={filterImportId} onChange={e => setFilterImportId(e.target.value)} className="border rounded px-2 py-1 text-sm">
                  <option value="">Tous les imports</option>
                  {imports.filter(i => i.status === 'processed').map(i => (
                    <option key={i.id} value={i.id}>{i.file_name || i.id} ({i.transaction_count})</option>
                  ))}
                </select>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="py-8 text-center text-slate-400"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>
              ) : transactions.length === 0 ? (
                <div className="py-8 text-center text-slate-400">Aucune transaction</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b bg-slate-50/80"><tr>
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-left">Libellé</th>
                      <th className="px-3 py-2 text-right bg-red-50/50"><span className="flex items-center justify-end gap-1"><ArrowDownLeft className="w-3.5 h-3.5 text-red-600" /> Débit (sortie)</span></th>
                      <th className="px-3 py-2 text-right bg-green-50/50"><span className="flex items-center justify-end gap-1"><ArrowUpRight className="w-3.5 h-3.5 text-green-600" /> Crédit (entrée)</span></th>
                      <th className="px-3 py-2 text-right">Solde</th>
                      <th className="px-3 py-2 text-left">Type</th>
                      <th className="px-3 py-2 text-left">Confiance</th>
                      <th className="px-3 py-2 text-center">Rapproché</th>
                    </tr></thead>
                    <tbody className="divide-y">
                      {transactions.map(tx => (
                        <tr key={tx.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2 text-slate-500">{tx.txn_date}</td>
                          <td className="px-3 py-2 max-w-xs truncate" title={tx.label_raw}>{tx.label_raw}</td>
                          <td className="px-3 py-2 text-right bg-red-50/30">{tx.debit > 0 ? <span className="font-medium text-red-700">{fmt(tx.debit)}</span> : <span className="text-slate-300">—</span>}</td>
                          <td className="px-3 py-2 text-right bg-green-50/30">{tx.credit > 0 ? <span className="font-medium text-green-700">{fmt(tx.credit)}</span> : <span className="text-slate-300">—</span>}</td>
                          <td className="px-3 py-2 text-right text-slate-500">{tx.balance != null ? fmt(tx.balance) : '—'}</td>
                          <td className="px-3 py-2 text-slate-600">{tx.transaction_type || '—'}</td>
                          <td className="px-3 py-2">
                            {tx.confidence != null ? (
                              <Badge className={tx.confidence >= 90 ? 'bg-green-100 text-green-700' : tx.confidence >= 75 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'}>
                                {Math.round(tx.confidence)}
                              </Badge>
                            ) : '—'}
                          </td>
                          <td className="px-3 py-2 text-center">{tx.reconciled ? <CheckCircle className="w-4 h-4 text-green-500 mx-auto" /> : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {tab === 'suggestions' && (
          <Card>
            <CardHeader>
              <CardTitle>Suggestions de rapprochement</CardTitle>
              <p className="text-sm text-slate-500">Approuvez, rejetez ou ignorez les correspondances proposées</p>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="py-8 text-center text-slate-400"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>
              ) : suggestions.length === 0 ? (
                <div className="py-8 text-center text-slate-400">Aucune suggestion en attente</div>
              ) : (
                <div className="space-y-3">
                  {suggestions.map(s => (
                    <div key={s.id} className="border rounded-lg p-4 flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{s.candidate_summary}</p>
                        <p className="text-sm text-slate-500">{s.reason}</p>
                        <p className="text-xs text-slate-400">{s.match_pass || '—'} {s.confidence ? `· ${s.confidence}` : ''}</p>
                      </div>
                      <Badge className={s.score >= 85 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}>
                        Score {Math.round(s.score)}
                      </Badge>
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" className="bg-green-600 text-white hover:bg-green-700" onClick={() => setApproveModal({ open: true, suggestion: s })} disabled={actioning}>
                          <Check className="w-4 h-4 mr-0.5" /> Approuver
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleReject(s.id)} disabled={actioning}>
                          <X className="w-4 h-4 mr-0.5" /> Rejeter
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleIgnore(s.transaction_id)} disabled={actioning}>
                          Ignorer
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={approveModal.open} onOpenChange={o => setApproveModal(p => ({ ...p, open: o }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approuver le rapprochement</DialogTitle>
          </DialogHeader>
          {approveModal.suggestion && (
            <p className="py-2">Associer la transaction à : {approveModal.suggestion.candidate_summary}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setApproveModal({ open: false, suggestion: null })}>Annuler</Button>
            <Button className="bg-green-600" onClick={handleApprove} disabled={actioning}>
              {actioning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
              Confirmer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
