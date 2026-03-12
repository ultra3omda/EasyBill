import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import { useCompany } from '../hooks/useCompany';
import {
  Upload, FileText, Scan, CheckCircle, AlertTriangle, XCircle,
  User, UserPlus, BookOpen, Receipt, Loader2, ChevronRight,
  Edit3, RefreshCw, Eye, Info, Plus, Trash2
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;
const token = () => localStorage.getItem('token');
const fmt = n => Number(n || 0).toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

const ACTION_ICONS = {
  create_supplier: <UserPlus className="w-4 h-4 text-blue-500" />,
  use_existing_supplier: <User className="w-4 h-4 text-green-500" />,
  create_supplier_invoice: <FileText className="w-4 h-4 text-violet-500" />,
  create_purchase_order: <Receipt className="w-4 h-4 text-amber-500" />,
  use_existing_purchase_order: <Receipt className="w-4 h-4 text-green-500" />,
  create_receipt: <Receipt className="w-4 h-4 text-amber-500" />,
  use_existing_receipt: <Receipt className="w-4 h-4 text-green-500" />,
  create_stock_movement: <Receipt className="w-4 h-4 text-cyan-500" />,
  review_stock_decisions: <AlertTriangle className="w-4 h-4 text-amber-500" />,
  create_draft_journal_entry: <BookOpen className="w-4 h-4 text-indigo-500" />,
};
const ACTION_COLORS = {
  info: 'bg-blue-50 border-blue-200 text-blue-800',
  success: 'bg-green-50 border-green-200 text-green-800',
  warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
};

export default function InvoiceScanner() {
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const fileInputRef = useRef(null);
  const dropZoneRef = useRef(null);

  // States
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [parseResult, setParseResult] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [activeTab, setActiveTab] = useState('supplier');

  // Editable parsed data
  const [editedSupplier, setEditedSupplier] = useState(null);
  const [editedInvoice, setEditedInvoice] = useState(null);
  const [editedJournalEntries, setEditedJournalEntries] = useState(null);
  const [editedWorkflow, setEditedWorkflow] = useState(null);

  const recalcInvoice = useCallback((invoice) => {
    const items = invoice?.items || [];
    const subtotal = Number(items.reduce((sum, item) => {
      const quantity = parseFloat(item.quantity || 0);
      const unitPrice = parseFloat(item.unit_price || 0);
      const discount = parseFloat(item.discount || 0);
      return sum + (quantity * unitPrice * (1 - discount / 100));
    }, 0).toFixed(3));
    const fodec = parseFloat(invoice?.fodec || 0);
    const totalTax = parseFloat(invoice?.total_tax || 0);
    const timbre = parseFloat(invoice?.timbre || 0);
    return {
      ...invoice,
      subtotal,
      assiette_tva: Number((subtotal + fodec).toFixed(3)),
      total: Number((subtotal + fodec + totalTax + timbre).toFixed(3))
    };
  }, []);

  const handleFileSelect = useCallback((selectedFile) => {
    if (!selectedFile) return;
    const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowed.includes(selectedFile.type) && !selectedFile.name.match(/\.(pdf|jpg|jpeg|png|webp)$/i)) {
      toast.error('Format non supporté. Utilisez PDF, JPEG, PNG ou WebP.');
      return;
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error('Fichier trop volumineux (max 10 Mo)');
      return;
    }
    setFile(selectedFile);
    setParseResult(null);
    setConfirmed(null);

    // Preview for images
    if (selectedFile.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = e => setFilePreview(e.target.result);
      reader.readAsDataURL(selectedFile);
    } else {
      setFilePreview(null);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileSelect(f);
  }, [handleFileSelect]);

  const handleParse = async () => {
    if (!file || !currentCompany) return;
    setParsing(true);
    setParseResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API}/api/invoice-scanner/parse?company_id=${currentCompany.id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}` },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Erreur analyse');
      setParseResult(data);
      setEditedSupplier(data.supplier);
      setEditedInvoice(data.invoice);
      setEditedJournalEntries(data.journal_entries);
      setEditedWorkflow(data.workflow);
      setShowConfirmModal(true);
    } catch (e) {
      toast.error(e.message || "Erreur lors de l'analyse du document");
    } finally {
      setParsing(false);
    }
  };

  const handleConfirm = async () => {
    if (!editedSupplier || !editedInvoice || !currentCompany) return;
    setConfirming(true);
    try {
      const payload = {
        supplier: editedSupplier,
        invoice: editedInvoice,
        journal_entries: editedJournalEntries,
        workflow: editedWorkflow,
        company_id: currentCompany.id
      };
      const res = await fetch(`${API}/api/invoice-scanner/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Erreur confirmation');
      setConfirmed(data);
      setShowConfirmModal(false);
      toast.success(data.message || 'Facture importée avec succès');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setConfirming(false);
    }
  };

  const addItem = () => {
    setEditedInvoice(prev => recalcInvoice({
      ...prev,
      items: [...(prev?.items || []), { description: '', quantity: 1, unit_price: 0, tax_rate: 19, discount: 0, total: 0, stock_decision: 'non_stock', should_create_stock_movement: false }]
    }));
  };

  const removeItem = (idx) => {
    setEditedInvoice(prev => recalcInvoice({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx)
    }));
  };

  const updateItem = (idx, field, value) => {
    setEditedInvoice(prev => {
      const items = [...(prev?.items || [])];
      items[idx] = { ...items[idx], [field]: value };
      const it = items[idx];
      const ht = parseFloat(it.quantity || 0) * parseFloat(it.unit_price || 0) * (1 - parseFloat(it.discount || 0) / 100);
      items[idx].total = parseFloat((ht * (1 + parseFloat(it.tax_rate || 0) / 100)).toFixed(3));
      return recalcInvoice({ ...prev, items });
    });
  };

  const updateStockDecision = (idx, checked) => {
    setEditedInvoice(prev => {
      const items = [...(prev?.items || [])];
      items[idx] = {
        ...items[idx],
        stock_decision: checked ? 'stock' : 'non_stock',
        should_create_stock_movement: checked && !!items[idx]?.warehouse_id,
        review_required: checked && !items[idx]?.product_id,
        stock_reason: checked && !items[idx]?.product_id
          ? 'Ajout au stock demandé par l’utilisateur. L’article sera créé automatiquement à la confirmation.'
          : items[idx]?.stock_reason
      };
      return recalcInvoice({ ...prev, items });
    });
  };

  const confidenceColor = (c) => {
    if (c >= 0.8) return 'text-green-600 bg-green-50';
    if (c >= 0.5) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Scan className="w-6 h-6 text-violet-600" />
            Scanner une facture fournisseur
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Uploadez une facture PDF ou image — l'outil extrait les informations et prépare les écritures comptables pour votre validation.
          </p>
        </div>

        {/* How it works */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { icon: Upload, label: '1. Uploader', desc: 'PDF ou image de la facture' },
            { icon: Scan, label: '2. Analyser', desc: 'Extraction automatique des données' },
            { icon: CheckCircle, label: '3. Confirmer', desc: 'Vérifier et valider les insertions' },
          ].map(step => (
            <div key={step.label} className="flex items-center gap-3 p-3 bg-violet-50 rounded-xl border border-violet-100">
              <step.icon className="w-5 h-5 text-violet-600 shrink-0" />
              <div>
                <p className="font-semibold text-sm text-violet-800">{step.label}</p>
                <p className="text-xs text-violet-600">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Upload Zone */}
        <Card>
          <CardContent className="p-6">
            <div
              ref={dropZoneRef}
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => !file && fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer ${
                dragOver
                  ? 'border-violet-500 bg-violet-50'
                  : file
                    ? 'border-green-400 bg-green-50'
                    : 'border-gray-300 hover:border-violet-400 hover:bg-violet-50/30'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                className="hidden"
                onChange={e => handleFileSelect(e.target.files[0])}
              />

              {file ? (
                <div className="space-y-3">
                  {filePreview ? (
                    <img src={filePreview} alt="Preview" className="max-h-40 mx-auto rounded-lg shadow-sm" />
                  ) : (
                    <FileText className="w-16 h-16 mx-auto text-violet-600" />
                  )}
                  <div>
                    <p className="font-semibold text-gray-800">{file.name}</p>
                    <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(1)} Ko</p>
                  </div>
                  <div className="flex justify-center gap-2">
                    <Button
                      variant="outline" size="sm"
                      onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                    >
                      <RefreshCw className="w-3.5 h-3.5 mr-1" /> Changer
                    </Button>
                    <Button
                      variant="outline" size="sm"
                      onClick={(e) => { e.stopPropagation(); setFile(null); setFilePreview(null); setParseResult(null); }}
                      className="text-red-500 border-red-200 hover:bg-red-50"
                    >
                      <XCircle className="w-3.5 h-3.5 mr-1" /> Supprimer
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <Upload className="w-12 h-12 mx-auto text-gray-400" />
                  <div>
                    <p className="font-semibold text-gray-700">Glisser-déposer ou cliquer pour sélectionner</p>
                    <p className="text-sm text-gray-400 mt-1">PDF, JPEG, PNG, WebP — max 10 Mo</p>
                  </div>
                </div>
              )}
            </div>

            {/* Gemini tip */}
            <div className="mt-3 flex items-start gap-2 text-xs text-gray-400 bg-gray-50 p-3 rounded-lg">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                Pour les images et PDF scannés, configurez <code className="bg-gray-200 px-1 rounded">GEMINI_API_KEY</code> dans le fichier <code className="bg-gray-200 px-1 rounded">.env</code> pour une extraction optimale.
                Sans clé, les PDF textuels sont supportés automatiquement.
              </span>
            </div>

            {/* Analyze button */}
            <div className="mt-4 flex justify-end">
              <Button
                onClick={handleParse}
                disabled={!file || parsing}
                className="gap-2 bg-violet-600 hover:bg-violet-700 min-w-40"
              >
                {parsing ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Analyse en cours…</>
                ) : (
                  <><Scan className="w-4 h-4" /> Analyser la facture</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Success result */}
        {confirmed && (
          <Card className="border-green-300 bg-green-50">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <CheckCircle className="w-7 h-7 text-green-600" />
                <div>
                  <p className="font-bold text-green-800 text-lg">{confirmed.message}</p>
                  <p className="text-sm text-green-600">Chaîne achat créée et écritures comptables préparées avec succès</p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {confirmed.results?.supplier?.created && (
                  <div className="bg-white rounded-lg p-3 border border-green-200">
                    <p className="text-xs text-gray-500">Fournisseur créé</p>
                    <p className="font-semibold text-sm">{confirmed.results.supplier.name}</p>
                  </div>
                )}
                <div className="bg-white rounded-lg p-3 border border-green-200">
                  <p className="text-xs text-gray-500">Facture fournisseur</p>
                  <p className="font-semibold text-sm">{confirmed.results?.supplier_invoice?.number}</p>
                  <p className="text-xs text-violet-600">{fmt(confirmed.results?.supplier_invoice?.total)} TND</p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-green-200">
                  <p className="text-xs text-gray-500">Bon de commande</p>
                  <p className="font-semibold text-sm">{confirmed.results?.purchase_order?.number || 'Existant / non créé'}</p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-green-200">
                  <p className="text-xs text-gray-500">Bon de réception</p>
                  <p className="font-semibold text-sm">{confirmed.results?.receipt?.number || 'Existant / non créé'}</p>
                  <p className="text-xs text-cyan-600">{confirmed.results?.stock_movements?.created || 0} mouvement(s) de stock</p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-green-200">
                  <p className="text-xs text-gray-500">Écritures comptables</p>
                  <p className="font-semibold text-sm">{confirmed.results?.journal_entries?.created} brouillon(s)</p>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => navigate('/supplier-invoices')}>
                  <Receipt className="w-3.5 h-3.5 mr-1" /> Voir les factures
                </Button>
                <Button size="sm" variant="outline" onClick={() => navigate('/journal-entries')}>
                  <BookOpen className="w-3.5 h-3.5 mr-1" /> Voir les écritures
                </Button>
                <Button
                  size="sm"
                  className="bg-violet-600 hover:bg-violet-700"
                  onClick={() => { setFile(null); setFilePreview(null); setParseResult(null); setConfirmed(null); }}
                >
                  <Scan className="w-3.5 h-3.5 mr-1" /> Scanner une autre facture
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Confirmation Modal ─────────────────────────────────────────────── */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <CheckCircle className="w-5 h-5 text-violet-600" />
              Confirmation des insertions
            </DialogTitle>
          </DialogHeader>

          {parseResult && (
            <div className="space-y-5">
              {/* Confidence + method */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${confidenceColor(parseResult.confidence)}`}>
                    Confiance : {Math.round((parseResult.confidence || 0) * 100)}%
                  </span>
                  <span className="text-xs text-gray-500">
                    Méthode : {parseResult.extraction_method === 'gemini_vision' ? '✨ Gemini Vision' : parseResult.extraction_method === 'regex' ? '📝 Regex (PDF texte)' : '❓ Inconnue'}
                  </span>
                </div>
                <p className="text-xs text-gray-400">{parseResult.filename}</p>
              </div>

              {/* Warnings */}
              {parseResult.error && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  {parseResult.error}
                </div>
              )}

              {!!parseResult.warnings?.length && (
                <div className="space-y-2">
                  {parseResult.warnings.map((warning, index) => (
                    <div key={index} className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      {warning}
                    </div>
                  ))}
                </div>
              )}

              {/* Planned actions summary */}
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Actions qui seront effectuées :</p>
                <div className="space-y-1.5">
                  {parseResult.planned_actions?.map((action, i) => (
                    <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${ACTION_COLORS[action.severity] || ACTION_COLORS.info}`}>
                      {ACTION_ICONS[action.type] || <ChevronRight className="w-4 h-4" />}
                      {action.label}
                    </div>
                  ))}
                </div>
              </div>

              {/* Tabs for editing */}
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="w-full">
                  <TabsTrigger value="supplier" className="flex-1">
                    {editedSupplier?.is_new
                      ? <><UserPlus className="w-3.5 h-3.5 mr-1" />Nouveau fournisseur</>
                      : <><User className="w-3.5 h-3.5 mr-1" />Fournisseur existant</>}
                  </TabsTrigger>
                  <TabsTrigger value="invoice" className="flex-1">
                    <FileText className="w-3.5 h-3.5 mr-1" />Facture
                  </TabsTrigger>
                  <TabsTrigger value="accounting" className="flex-1">
                    <BookOpen className="w-3.5 h-3.5 mr-1" />Écritures comptables
                  </TabsTrigger>
                </TabsList>

                {/* Tab: Supplier */}
                <TabsContent value="supplier" className="mt-4 space-y-3">
                  {editedSupplier?.is_new ? (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700 flex items-center gap-2 mb-3">
                      <UserPlus className="w-4 h-4 shrink-0" />
                      Ce fournisseur n'existe pas encore — il sera créé automatiquement.
                    </div>
                  ) : (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700 flex items-center gap-2 mb-3">
                      <User className="w-4 h-4 shrink-0" />
                      Fournisseur existant trouvé — la facture lui sera rattachée.
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: 'name', label: 'Nom / Raison sociale', required: true },
                      { key: 'fiscal_id', label: 'Matricule fiscal', required: false },
                      { key: 'phone', label: 'Téléphone', required: false },
                      { key: 'email', label: 'Email', required: false },
                    ].map(f => (
                      <div key={f.key}>
                        <Label className="text-xs text-gray-600">
                          {f.label}{f.required && <span className="text-red-500 ml-0.5">*</span>}
                        </Label>
                        <Input
                          value={editedSupplier?.[f.key] || ''}
                          onChange={e => setEditedSupplier(p => ({ ...p, [f.key]: e.target.value }))}
                          className="mt-1 h-8 text-sm"
                          disabled={!editedSupplier?.is_new && f.key !== 'name'}
                        />
                      </div>
                    ))}
                    <div className="col-span-2">
                      <Label className="text-xs text-gray-600">Adresse</Label>
                      <Input
                        value={editedSupplier?.address || ''}
                        onChange={e => setEditedSupplier(p => ({ ...p, address: e.target.value }))}
                        className="mt-1 h-8 text-sm"
                      />
                    </div>
                  </div>
                </TabsContent>

                {/* Tab: Invoice */}
                <TabsContent value="invoice" className="mt-4 space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs text-gray-600">N° facture fournisseur</Label>
                      <Input
                        value={editedInvoice?.supplier_number || ''}
                        onChange={e => setEditedInvoice(p => ({ ...p, supplier_number: e.target.value }))}
                        className="mt-1 h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600">Date</Label>
                      <Input
                        type="date"
                        value={editedInvoice?.date || ''}
                        onChange={e => setEditedInvoice(p => ({ ...p, date: e.target.value }))}
                        className="mt-1 h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600">Échéance</Label>
                      <Input
                        type="date"
                        value={editedInvoice?.due_date || ''}
                        onChange={e => setEditedInvoice(p => ({ ...p, due_date: e.target.value }))}
                        className="mt-1 h-8 text-sm"
                      />
                    </div>
                  </div>

                  {editedWorkflow && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="rounded-lg border bg-amber-50 border-amber-200 p-3">
                        <p className="text-xs text-amber-700">Bon de commande</p>
                        <p className="font-semibold text-sm text-amber-900">
                          {editedWorkflow.purchase_order?.create
                            ? 'Création automatique prévue'
                            : `Existant: ${editedWorkflow.purchase_order?.existing_number || '-'}`}
                        </p>
                      </div>
                      <div className="rounded-lg border bg-amber-50 border-amber-200 p-3">
                        <p className="text-xs text-amber-700">Bon de réception</p>
                        <p className="font-semibold text-sm text-amber-900">
                          {editedWorkflow.receipt?.create
                            ? 'Création automatique prévue'
                            : `Existant: ${editedWorkflow.receipt?.existing_number || '-'}`}
                        </p>
                      </div>
                      <div className="rounded-lg border bg-cyan-50 border-cyan-200 p-3">
                        <p className="text-xs text-cyan-700">Entrepôt stock</p>
                        <p className="font-semibold text-sm text-cyan-900">{editedWorkflow.warehouse_name || 'Aucun entrepôt par défaut'}</p>
                      </div>
                    </div>
                  )}

                  {/* Items */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm font-semibold">Articles / Prestations</Label>
                      <Button size="sm" variant="outline" onClick={addItem} className="h-7 text-xs gap-1">
                        <Plus className="w-3 h-3" /> Ajouter
                      </Button>
                    </div>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="px-2 py-2 text-left font-medium text-gray-600">Description</th>
                            <th className="px-2 py-2 text-center font-medium text-gray-600 w-16">Qté</th>
                            <th className="px-2 py-2 text-center font-medium text-gray-600 w-24">P.U. HT</th>
                            <th className="px-2 py-2 text-center font-medium text-gray-600 w-16">TVA%</th>
                            <th className="px-2 py-2 text-left font-medium text-gray-600 w-40">Produit lié</th>
                            <th className="px-2 py-2 text-center font-medium text-gray-600 w-24">Entrée stock</th>
                            <th className="px-2 py-2 text-right font-medium text-gray-600 w-24">Total TTC</th>
                            <th className="w-8" />
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {editedInvoice?.items?.map((item, idx) => (
                            <tr key={idx}>
                              <td className="px-2 py-1.5">
                                <Input
                                  value={item.description}
                                  onChange={e => updateItem(idx, 'description', e.target.value)}
                                  className="h-7 text-xs border-0 focus-visible:ring-0 p-0 bg-transparent"
                                />
                              </td>
                              <td className="px-2 py-1.5">
                                <Input
                                  type="number" min="0" step="0.01"
                                  value={item.quantity}
                                  onChange={e => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                                  className="h-7 text-xs text-center"
                                />
                              </td>
                              <td className="px-2 py-1.5">
                                <Input
                                  type="number" min="0" step="0.001"
                                  value={item.unit_price}
                                  onChange={e => updateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                                  className="h-7 text-xs text-right"
                                />
                              </td>
                              <td className="px-2 py-1.5">
                                <Input
                                  type="number" min="0" step="1"
                                  value={item.tax_rate}
                                  onChange={e => updateItem(idx, 'tax_rate', parseFloat(e.target.value) || 0)}
                                  className="h-7 text-xs text-center"
                                />
                              </td>
                              <td className="px-2 py-1.5">
                                <div className="text-[11px] leading-4">
                                  <div className="font-medium text-gray-700">{item.product_name || 'Aucun produit trouvé'}</div>
                                  <div className="text-gray-500">{Math.round((item.product_match_confidence || 0) * 100)}% • {item.stock_reason}</div>
                                </div>
                              </td>
                              <td className="px-2 py-1.5 text-center">
                                <label className="inline-flex items-center justify-center">
                                  <input
                                    type="checkbox"
                                    checked={!!item.should_create_stock_movement}
                                    disabled={!item.warehouse_id}
                                    onChange={e => updateStockDecision(idx, e.target.checked)}
                                  />
                                </label>
                              </td>
                              <td className="px-2 py-1.5 text-right font-medium">{fmt(item.total)}</td>
                              <td className="px-1 py-1.5">
                                <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600 p-0.5">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Totals recap */}
                  <div className="bg-violet-50 rounded-lg p-3 text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total HT NET</span>
                      <span className="font-medium">{fmt(editedInvoice?.subtotal)} TND</span>
                    </div>
                    {editedInvoice?.fodec > 0 && (
                      <div className="flex justify-between text-orange-700">
                        <span>FODEC (1% du HT)</span>
                        <span className="font-medium">{fmt(editedInvoice?.fodec)} TND</span>
                      </div>
                    )}
                    {editedInvoice?.fodec > 0 && editedInvoice?.assiette_tva > 0 && (
                      <div className="flex justify-between text-gray-500 text-xs">
                        <span>Assiette TVA (HT + FODEC)</span>
                        <span>{fmt(editedInvoice?.assiette_tva)} TND</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-600">TVA</span>
                      <span className="font-medium">{fmt(editedInvoice?.total_tax)} TND</span>
                    </div>
                    {editedInvoice?.timbre > 0 && (
                      <div className="flex justify-between text-blue-700">
                        <span>Timbre fiscal</span>
                        <span className="font-medium">{fmt(editedInvoice?.timbre)} TND</span>
                      </div>
                    )}
                    <div className="flex justify-between mt-1 pt-1.5 border-t border-violet-200">
                      <span className="font-bold text-violet-700">Net à payer</span>
                      {/* Calculé depuis les composants affichés — jamais depuis Gemini directement */}
                      <span className="font-bold text-violet-700">
                        {fmt(
                          parseFloat((
                            (editedInvoice?.subtotal || 0) +
                            (editedInvoice?.fodec || 0) +
                            (editedInvoice?.total_tax || 0) +
                            (editedInvoice?.timbre || 0)
                          ).toFixed(3))
                        )} TND
                      </span>
                    </div>
                  </div>
                </TabsContent>

                {/* Tab: Accounting */}
                <TabsContent value="accounting" className="mt-4 space-y-3">
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-sm text-indigo-700 flex items-start gap-2">
                    <BookOpen className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>Les écritures suivantes seront créées en brouillon pour validation explicite après revue.</span>
                  </div>

                  {editedJournalEntries?.map((je, i) => (
                    <div key={i} className="border rounded-lg overflow-hidden">
                      <div className="bg-indigo-50 px-3 py-2 border-b flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-indigo-600" />
                          <span className="font-semibold text-sm text-indigo-800">{je.description}</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          Journal: {je.journal_type}
                        </Badge>
                      </div>
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium text-gray-600">Compte</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-600">Intitulé</th>
                            <th className="px-3 py-2 text-right font-medium text-gray-600">Débit</th>
                            <th className="px-3 py-2 text-right font-medium text-gray-600">Crédit</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {je.lines?.map((line, li) => (
                            <tr key={li} className="hover:bg-gray-50">
                              <td className="px-3 py-2 font-mono text-indigo-600">{line.account_code}</td>
                              <td className="px-3 py-2 text-gray-700">{line.account_name}</td>
                              <td className="px-3 py-2 text-right font-medium">
                                {line.debit ? fmt(line.debit) : ''}
                              </td>
                              <td className="px-3 py-2 text-right font-medium">
                                {line.credit ? fmt(line.credit) : ''}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-50 border-t-2">
                          <tr>
                            <td colSpan={2} className="px-3 py-2 font-bold text-gray-700">Total</td>
                            <td className="px-3 py-2 text-right font-bold">{fmt(je.total_debit)}</td>
                            <td className="px-3 py-2 text-right font-bold">{fmt(je.total_credit)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ))}
                </TabsContent>
              </Tabs>

              {/* Action buttons */}
              <div className="flex justify-between pt-2 border-t">
                <Button variant="outline" onClick={() => setShowConfirmModal(false)}>
                  Annuler
                </Button>
                <Button
                  onClick={handleConfirm}
                  disabled={confirming || !editedSupplier?.name}
                  className="gap-2 bg-green-600 hover:bg-green-700 min-w-40"
                >
                  {confirming ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Enregistrement…</>
                  ) : (
                    <><CheckCircle className="w-4 h-4" /> Confirmer et enregistrer</>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
