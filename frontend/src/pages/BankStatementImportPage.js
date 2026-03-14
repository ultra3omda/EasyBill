import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { TableSkeleton } from '../components/ui/skeleton';
import { WorkflowStageProgress } from '../components/banking/WorkflowStageProgress';
import { toast } from 'sonner';
import { useCompany } from '../hooks/useCompany';
import {
  Upload, FileText, Loader2, CheckCircle, XCircle, Clock, RefreshCw,
  ArrowDownLeft, ArrowUpRight, Link2, Check, X, Eye, FileSpreadsheet, AlertTriangle,
  ShieldCheck, ScanLine, Split, Sparkles, Building2
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const token = () => localStorage.getItem('token');
const fmt = (n) => Number(n || 0).toLocaleString('fr-TN', { minimumFractionDigits: 0, maximumFractionDigits: 3 });

const STATUS_BADGE = {
  pending: { icon: Clock, class: 'warning', label: 'Upload reçu' },
  processing: { icon: Loader2, class: 'info', label: 'Traitement en cours' },
  processed: { icon: CheckCircle, class: 'success', label: 'Suggestions prêtes' },
  review_required: { icon: Eye, class: 'warning', label: 'Revue requise' },
  needs_split: { icon: AlertTriangle, class: 'warning', label: 'Découpage conseillé' },
  too_many_lines: { icon: AlertTriangle, class: 'destructive', label: 'Trop de lignes' },
  failed: { icon: XCircle, class: 'destructive', label: 'Échec' },
};

function formatStatus(status) {
  return STATUS_BADGE[status]?.label || status || 'Inconnu';
}

function getConfidenceVariant(score) {
  if (score >= 90) return 'success';
  if (score >= 75) return 'warning';
  return 'secondary';
}

function getImportWarnings(imp) {
  const warnings = [];
  if (imp?.status === 'needs_split') warnings.push("Le backend recommande de scinder l'extrait avant nouvelle analyse.");
  if (imp?.status === 'too_many_lines') warnings.push("Le volume d'opérations est trop élevé pour un traitement fluide en un seul lot.");
  if (imp?.import_warning) warnings.push(imp.import_warning);
  if (imp?.suggested_split) warnings.push(`Découpage suggéré : ${imp.suggested_split}`);
  if (imp?.error_message) warnings.push(imp.error_message);
  return warnings.filter(Boolean);
}

function getImportWorkflowStages(imp, uploading) {
  const hasDetectedOps = Boolean((imp?.estimated_transaction_count || imp?.transaction_count || 0) > 0);
  const hasReadySuggestions = ['processed', 'review_required'].includes(imp?.status);
  const hasWarning = ['needs_split', 'too_many_lines'].includes(imp?.status);
  const hasFailure = imp?.status === 'failed';

  return [
    {
      id: 'upload',
      label: 'Upload reçu',
      status: uploading ? 'active' : (imp ? 'complete' : 'pending'),
      meta: imp?.file_name || 'Fichier d’extrait en attente',
    },
    {
      id: 'ocr',
      label: 'OCR en cours',
      status: hasFailure ? 'error' : imp?.status === 'processing' && !hasDetectedOps ? 'active' : imp ? 'complete' : 'pending',
      meta: imp?.ocr_provider ? `Moteur : ${imp.ocr_provider}` : 'Lecture du document et détection des pages',
    },
    {
      id: 'detected',
      label: 'Opérations détectées',
      status: hasDetectedOps ? 'complete' : imp?.status === 'processing' ? 'active' : 'pending',
      meta: imp?.estimated_transaction_count ? `${imp.estimated_transaction_count} ligne(s) estimée(s)` : 'Comptage des opérations bancaires',
    },
    {
      id: 'parsing',
      label: 'Parsing en cours',
      status: hasFailure ? 'error' : imp?.status === 'processing' && hasDetectedOps ? 'active' : imp && imp?.status !== 'pending' ? 'complete' : 'pending',
      meta: imp?.processing_complexity || 'Analyse et normalisation des écritures',
    },
    {
      id: 'reconciliation',
      label: 'Analyse de rapprochement',
      status: hasFailure ? 'error' : hasWarning ? 'warning' : hasReadySuggestions ? 'complete' : imp?.status === 'processing' ? 'active' : 'pending',
      meta: imp?.status === 'review_required' ? 'Des lignes demandent une revue manuelle' : 'Préparation des correspondances comptables',
    },
    {
      id: 'ready',
      label: 'Suggestions prêtes',
      status: hasFailure ? 'error' : hasWarning ? 'warning' : hasReadySuggestions ? 'complete' : 'pending',
      meta: hasReadySuggestions ? `${imp?.transaction_count || 0} ligne(s) prêtes à exploiter` : 'En attente de résultat exploitable',
    },
  ];
}

export default function BankStatementImportPage() {
  const { currentCompany } = useCompany();
  const fileInputRef = useRef(null);
  const [tab, setTab] = useState('imports');
  const [imports, setImports] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [lastUploadedFile, setLastUploadedFile] = useState(null);
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
    } catch {
      toast.error('Erreur chargement imports');
      setImports([]);
    } finally {
      setLoading(false);
    }
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
    } catch {
      toast.error('Erreur chargement transactions');
      setTransactions([]);
    } finally {
      setLoading(false);
    }
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
    } catch {
      toast.error('Erreur chargement suggestions');
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, [currentCompany]);

  useEffect(() => { if (tab === 'imports') loadImports(); }, [tab, loadImports]);
  useEffect(() => { if (tab === 'transactions') loadTransactions(); }, [tab, loadTransactions]);
  useEffect(() => { if (tab === 'suggestions') loadSuggestions(); }, [tab, loadSuggestions]);

  useEffect(() => {
    if (tab !== 'imports') return;
    if (!imports.some((imp) => ['pending', 'processing'].includes(imp.status))) return;
    const timeout = setTimeout(() => {
      loadImports();
    }, 5000);
    return () => clearTimeout(timeout);
  }, [imports, tab, loadImports]);

  const uploadFile = async (file) => {
    if (!file || !currentCompany) return;
    const ok = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!ok.includes(file.type) && !file.name.match(/\.(pdf|jpg|jpeg|png)$/i)) {
      toast.error('Format non supporté (PDF, JPEG, PNG)');
      return;
    }
    setUploading(true);
    setLastUploadedFile({ name: file.name, size: file.size });
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
      toast.success('Import reçu. Le traitement OCR et le parsing démarrent.');
      await loadImports();
      if (fileInputRef.current?.value) fileInputRef.current.value = '';
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      setDragOver(false);
    }
  };

  const handleUpload = async (e) => {
    const file = e?.target?.files?.[0];
    if (!file) return;
    await uploadFile(file);
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

  const activeImport = useMemo(() => {
    const candidates = imports.filter((imp) => ['pending', 'processing', 'review_required', 'needs_split', 'too_many_lines', 'processed', 'failed'].includes(imp.status));
    return candidates[0] || null;
  }, [imports]);

  const activeWarnings = activeImport ? getImportWarnings(activeImport) : [];
  const unresolvedTransactions = transactions.filter((tx) => !tx.reconciled).length;
  const processingCount = imports.filter((imp) => ['pending', 'processing'].includes(imp.status)).length;
  const warningCount = imports.filter((imp) => ['needs_split', 'too_many_lines', 'review_required'].includes(imp.status)).length;

  return (
    <AppLayout>
      <div className="page-shell section-stack">
        <div className="page-header">
          <div>
            <h1 className="page-header-title flex items-center gap-2">
              <FileSpreadsheet className="h-6 w-6 text-primary" />
              Import d'extraits bancaires
            </h1>
            <p className="page-header-subtitle">
              Upload, OCR, parsing et suggestions de rapprochement sur un workflow plus lisible et plus fiable.
            </p>
          </div>
          <div className="page-actions">
            <Button variant={tab === 'imports' ? 'default' : 'outline'} onClick={() => setTab('imports')}>
              <Upload className="mr-1 h-4 w-4" /> Imports
            </Button>
            <Button variant={tab === 'transactions' ? 'default' : 'outline'} onClick={() => setTab('transactions')}>
              <FileText className="mr-1 h-4 w-4" /> Détail des lignes
            </Button>
            <Button variant={tab === 'suggestions' ? 'default' : 'outline'} onClick={() => setTab('suggestions')}>
              <Link2 className="mr-1 h-4 w-4" /> Suggestions
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="interactive-lift">
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Imports actifs</p>
              <p className="metric-value mt-2">{processingCount}</p>
              <p className="mt-1 text-sm text-slate-500">OCR et parsing encore en cours</p>
            </CardContent>
          </Card>
          <Card className="interactive-lift">
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Alertes de densité</p>
              <p className="metric-value mt-2">{warningCount}</p>
              <p className="mt-1 text-sm text-slate-500">Imports à revoir, scinder ou rejouer</p>
            </CardContent>
          </Card>
          <Card className="interactive-lift">
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Transactions visibles</p>
              <p className="metric-value mt-2">{transactions.length}</p>
              <p className="mt-1 text-sm text-slate-500">Lignes chargées sur le périmètre sélectionné</p>
            </CardContent>
          </Card>
          <Card className="interactive-lift">
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Suggestions en attente</p>
              <p className="metric-value mt-2">{suggestions.length}</p>
              <p className="mt-1 text-sm text-slate-500">Dont {unresolvedTransactions} ligne(s) non rapprochée(s)</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-blue-200 bg-blue-50/80">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 text-blue-700" />
              <div className="space-y-2">
                <p className="text-sm font-semibold text-blue-900">Avant d'importer</p>
                <div className="grid gap-2 text-sm text-blue-800 md:grid-cols-2">
                  <p>Le temps de traitement dépend surtout du nombre d'opérations détectées, pas seulement du poids du PDF.</p>
                  <p>Un petit fichier peut rester long s'il contient beaucoup de lignes ou plusieurs périodes.</p>
                  <p>Les relevés sur des plages courtes sont traités plus vite et donnent de meilleurs rapprochements.</p>
                  <p>Les extraits très denses peuvent nécessiter un découpage. Si le backend retourne `needs_split` ou `too_many_lines`, priorisez cette action.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <WorkflowStageProgress
          title="Suivi du traitement bancaire"
          description="Vue consolidée de la dernière importation active ou du dernier résultat exploitable."
          stages={getImportWorkflowStages(activeImport, uploading)}
          metrics={[
            { label: 'Fichier', value: activeImport?.file_name || lastUploadedFile?.name || 'Aucun' },
            { label: 'Lignes', value: activeImport?.transaction_count ?? activeImport?.estimated_transaction_count ?? '—' },
            { label: 'Non résolues', value: unresolvedTransactions || '—' },
          ]}
        />

        {activeWarnings.length > 0 ? (
          <Card className="border-amber-200 bg-amber-50/80">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-700" />
                <div>
                  <p className="text-sm font-semibold text-amber-900">Points d'attention sur le traitement</p>
                  <div className="mt-2 space-y-1 text-sm text-amber-800">
                    {activeWarnings.map((warning, index) => (
                      <p key={`${warning}-${index}`}>{warning}</p>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {tab === 'imports' && (
          <div className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
            <Card className="interactive-lift">
              <CardHeader>
                <CardTitle>Importer un nouvel extrait</CardTitle>
                <p className="text-sm text-slate-500">PDF, JPEG ou PNG. Utilisez des périodes plus courtes pour accélérer OCR, parsing et suggestions.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleUpload} />
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    uploadFile(e.dataTransfer.files?.[0]);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`rounded-[24px] border-2 border-dashed p-6 text-center transition-all ${
                    dragOver
                      ? 'border-primary bg-blue-50'
                      : 'border-slate-300 bg-slate-50 hover:border-primary/50 hover:bg-blue-50/50'
                  }`}
                >
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm">
                    {uploading ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : <Upload className="h-6 w-6 text-primary" />}
                  </div>
                  <p className="mt-4 text-base font-semibold text-slate-900">
                    {uploading ? 'Import en cours de transmission' : 'Déposez votre relevé ici'}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    ou cliquez pour sélectionner un extrait bancaire
                  </p>
                  <p className="mt-3 text-xs text-slate-400">
                    Plus le relevé contient d'opérations, plus l'étape d'analyse sera longue, même si le fichier reste léger.
                  </p>
                </div>

                {lastUploadedFile ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Dernier fichier soumis</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{lastUploadedFile.name}</p>
                    <p className="text-sm text-slate-500">{(lastUploadedFile.size / 1024).toFixed(1)} Ko</p>
                  </div>
                ) : null}

                <div className="grid gap-3 text-sm text-slate-600">
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-center gap-2 font-semibold text-slate-900">
                      <ScanLine className="h-4 w-4 text-primary" />
                      OCR puis parsing
                    </div>
                    <p className="mt-1">Le document est d'abord lu, puis les opérations sont détectées et normalisées.</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-center gap-2 font-semibold text-slate-900">
                      <Split className="h-4 w-4 text-amber-600" />
                      Relevés denses
                    </div>
                    <p className="mt-1">Les relevés très denses peuvent remonter `needs_split` ou `too_many_lines` pour sécuriser l'analyse.</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle>Historique des imports</CardTitle>
                    <p className="text-sm text-slate-500">Suivi des statuts, complexité détectée, volumes de lignes et alertes de traitement.</p>
                  </div>
                  <Button variant="outline" onClick={loadImports}>
                    <RefreshCw className="mr-1 h-4 w-4" /> Actualiser
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <TableSkeleton rows={6} columns={7} />
                ) : imports.length === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
                    <p className="text-base font-semibold text-slate-900">Aucun import disponible</p>
                    <p className="mt-2 text-sm text-slate-500">Le premier extrait importé apparaîtra ici avec son statut OCR/parsing et ses alertes éventuelles.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fichier</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Traitement</TableHead>
                        <TableHead className="text-right">Lignes</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Alerte</TableHead>
                        <TableHead className="text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {imports.map((imp) => {
                        const st = STATUS_BADGE[imp.status] || STATUS_BADGE.pending;
                        const Icon = st.icon;
                        const warnings = getImportWarnings(imp);
                        return (
                          <TableRow key={imp.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium text-slate-900">{imp.file_name || imp.id}</p>
                                <p className="text-xs text-slate-400">Import #{imp.id}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={st.class === 'success' ? 'success' : st.class === 'warning' ? 'warning' : st.class === 'destructive' ? 'destructive' : 'info'}>
                                {imp.status === 'processing' ? <Icon className="mr-1 h-3 w-3 animate-spin" /> : <Icon className="mr-1 h-3 w-3" />}
                                {formatStatus(imp.status)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm text-slate-700">{imp.processing_complexity || 'Complexité non disponible'}</div>
                              <div className="text-xs text-slate-400">{imp.ocr_provider || 'OCR non précisé'}</div>
                            </TableCell>
                            <TableCell className="text-right">
                              <p className="font-semibold text-slate-900">{imp.transaction_count ?? '—'}</p>
                              {imp.estimated_transaction_count > imp.transaction_count ? (
                                <p className="text-xs text-slate-400">estimé {imp.estimated_transaction_count}</p>
                              ) : null}
                            </TableCell>
                            <TableCell className="text-slate-500">{imp.created_at?.slice(0, 10)}</TableCell>
                            <TableCell>
                              {warnings.length > 0 ? (
                                <div className="space-y-1">
                                  {warnings.slice(0, 2).map((warning, index) => (
                                    <p key={`${imp.id}-${index}`} className="text-xs text-amber-700">{warning}</p>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400">Aucune alerte</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              {(imp.status === 'failed' || imp.status === 'processing') ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8"
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
                                    } catch (e) {
                                      toast.error(e.message);
                                    }
                                  }}
                                >
                                  <RefreshCw className="mr-1 h-3 w-3" /> Relancer
                                </Button>
                              ) : (
                                <span className="text-xs text-slate-400">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {tab === 'transactions' && (
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle>Détail des lignes extraites</CardTitle>
                  <p className="text-sm text-slate-500">Lecture opérationnelle des transactions détectées, avec signal visuel immédiat sur le rapprochement et la confiance.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select value={filterImportId} onChange={e => setFilterImportId(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm">
                    <option value="">Tous les imports</option>
                    {imports.filter(i => i.status === 'processed').map(i => (
                      <option key={i.id} value={i.id}>{i.file_name || i.id} ({i.transaction_count})</option>
                    ))}
                  </select>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400">Non rapprochées</p>
                    <p className="text-sm font-semibold text-slate-900">{unresolvedTransactions}</p>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <TableSkeleton rows={8} columns={8} />
              ) : transactions.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
                  <p className="text-base font-semibold text-slate-900">Aucune transaction chargée</p>
                  <p className="mt-2 text-sm text-slate-500">Sélectionnez un import traité ou relancez l'extraction pour voir les lignes normalisées.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Libellé</TableHead>
                      <TableHead className="text-right">Débit</TableHead>
                      <TableHead className="text-right">Crédit</TableHead>
                      <TableHead className="text-right">Solde</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Confiance</TableHead>
                      <TableHead className="text-center">Rapprochement</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="text-slate-500">{tx.txn_date}</TableCell>
                        <TableCell>
                          <div className="max-w-[340px]">
                            <p className="truncate font-medium text-slate-900" title={tx.label_raw}>{tx.label_raw}</p>
                            <p className="mt-1 text-xs text-slate-400">{tx.reference || tx.bank_reference || 'Aucune référence extraite'}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{tx.debit > 0 ? <span className="font-semibold text-red-700">{fmt(tx.debit)}</span> : <span className="text-slate-300">—</span>}</TableCell>
                        <TableCell className="text-right">{tx.credit > 0 ? <span className="font-semibold text-emerald-700">{fmt(tx.credit)}</span> : <span className="text-slate-300">—</span>}</TableCell>
                        <TableCell className="text-right text-slate-500">{tx.balance != null ? fmt(tx.balance) : '—'}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{tx.transaction_type || '—'}</Badge>
                        </TableCell>
                        <TableCell>
                          {tx.confidence != null ? (
                            <Badge variant={getConfidenceVariant(tx.confidence)}>
                              {Math.round(tx.confidence)}%
                            </Badge>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {tx.reconciled ? (
                            <Badge variant="success"><CheckCircle className="mr-1 h-3 w-3" /> Rapproché</Badge>
                          ) : (
                            <Badge variant="warning">À traiter</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {tab === 'suggestions' && (
          <Card>
            <CardHeader>
              <CardTitle>Suggestions de rapprochement</CardTitle>
              <p className="text-sm text-slate-500">Actions rapides sur les propositions les plus utiles, avec exposition plus claire du score et du raisonnement.</p>
            </CardHeader>
            <CardContent>
              {loading ? (
                <TableSkeleton rows={5} columns={4} showToolbar={false} />
              ) : suggestions.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
                  <p className="text-base font-semibold text-slate-900">Aucune suggestion en attente</p>
                  <p className="mt-2 text-sm text-slate-500">Dès qu'un extrait traité remontera des correspondances, elles apparaîtront ici pour validation.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {suggestions.map((s) => (
                    <div key={s.id} className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-slate-900">{s.candidate_summary}</p>
                            <Badge variant={s.score >= 85 ? 'success' : 'warning'}>Score {Math.round(s.score)}</Badge>
                            {s.match_pass ? <Badge variant="secondary">{s.match_pass}</Badge> : null}
                          </div>
                          <p className="mt-2 text-sm text-slate-600">{s.reason || 'Aucun raisonnement détaillé fourni.'}</p>
                          <p className="mt-2 text-xs text-slate-400">{s.confidence ? `Confiance : ${s.confidence}` : 'Confiance non fournie'}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => setApproveModal({ open: true, suggestion: s })} disabled={actioning}>
                            <Check className="mr-1 h-4 w-4" /> Approuver
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleReject(s.id)} disabled={actioning}>
                            <X className="mr-1 h-4 w-4" /> Rejeter
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleIgnore(s.transaction_id)} disabled={actioning}>
                            Ignorer
                          </Button>
                        </div>
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
            <div className="space-y-3 py-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="font-medium text-slate-900">{approveModal.suggestion.candidate_summary}</p>
                <p className="mt-1 text-sm text-slate-500">{approveModal.suggestion.reason}</p>
              </div>
              <p className="text-sm text-slate-600">La transaction sera associée à cette suggestion et sortira du backlog de revue.</p>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setApproveModal({ open: false, suggestion: null })}>Annuler</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleApprove} disabled={actioning}>
              {actioning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}
              Confirmer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
