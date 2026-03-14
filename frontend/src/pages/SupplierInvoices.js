import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { useCompany } from '../hooks/useCompany';
import AppLayout from '../components/layout/AppLayout';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { TableSkeleton } from '../components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Plus, Search, Receipt, Edit, Trash2, MoreVertical, CreditCard, Banknote, Building2, CheckSquare, Upload, FileText, Eye, ExternalLink, CalendarDays, ChevronLeft, ChevronRight, Loader2, Sparkles } from 'lucide-react';
import InvoiceImportModal from '../components/invoice/InvoiceImportModal';
import { toast } from '../hooks/use-toast';

const API_BASE = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const PAYMENT_METHODS = [
  { value: 'transfer', label: 'Virement bancaire', icon: Building2, account: '521 — Banques' },
  { value: 'check',    label: 'Chèque',            icon: CheckSquare, account: '521 — Banques' },
  { value: 'cash',     label: 'Espèces',            icon: Banknote, account: '531 — Caisse' },
  { value: 'card',     label: 'Carte bancaire',     icon: CreditCard, account: '521 — Banques' },
  { value: 'e_dinar',  label: 'E-Dinar',            icon: Banknote, account: '531 — Caisse' },
];

const SupplierInvoicePdfPreview = ({ fileUrl, documentLabel }) => {
  const containerRef = useRef(null);
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageWidth, setPageWidth] = useState(720);

  useEffect(() => {
    setNumPages(0);
    setPageNumber(1);
  }, [fileUrl]);

  useEffect(() => {
    const updateWidth = () => {
      const nextWidth = containerRef.current?.clientWidth;
      if (nextWidth) {
        setPageWidth(Math.max(320, Math.floor(nextWidth - 16)));
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">Aperçu document</p>
          <p className="text-xs text-slate-500">
            {numPages ? `Page ${pageNumber} sur ${numPages}` : 'Chargement du PDF'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pageNumber <= 1}
            onClick={() => setPageNumber((current) => Math.max(1, current - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!numPages || pageNumber >= numPages}
            onClick={() => setPageNumber((current) => Math.min(numPages, current + 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div ref={containerRef} className="flex h-[calc(100vh-16rem)] min-h-[480px] items-start justify-center overflow-auto bg-slate-100 p-2">
        <Document
          file={fileUrl}
          loading={
            <div className="flex min-h-[400px] items-center justify-center text-sm text-slate-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Chargement du document
            </div>
          }
          error={
            <div className="flex min-h-[400px] flex-col items-center justify-center px-6 text-center">
              <FileText className="mb-3 h-8 w-8 text-slate-300" />
              <p className="font-medium text-slate-900">Impossible de charger l’aperçu PDF</p>
              <p className="mt-2 text-sm text-slate-500">
                Ouvrez le document dans un nouvel onglet si le fichier source bloque le rendu intégré.
              </p>
            </div>
          }
          onLoadSuccess={({ numPages: totalPages }) => {
            setNumPages(totalPages);
            setPageNumber((current) => Math.min(current, totalPages || 1));
          }}
        >
          <Page
            key={`${fileUrl}-${pageNumber}-${pageWidth}`}
            pageNumber={pageNumber}
            width={pageWidth}
            renderAnnotationLayer={false}
            renderTextLayer={false}
            loading={
              <div className="flex min-h-[400px] items-center justify-center text-sm text-slate-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Chargement de la page
              </div>
            }
          />
        </Document>
      </div>
    </div>
  );
};

const SupplierInvoices = () => {
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const [docs, setDocs] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [selectedPreviewId, setSelectedPreviewId] = useState(null);
  const [loading, setLoading] = useState(true);
  // Payment modal
  const [paymentModal, setPaymentModal] = useState({ open: false, doc: null });
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('transfer');
  const [paymentReference, setPaymentReference] = useState('');
  const [paying, setPaying] = useState(false);
  const [formData, setFormData] = useState({
    supplier_id: '', supplier_number: '',
    date: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    items: [{ description: '', quantity: 1, unit_price: 0, tax_rate: 19, discount: 0, total: 0 }],
    fodec: 0, timbre: 0, notes: ''
  });

  useEffect(() => { if (currentCompany) { loadData(); loadSuppliers(); loadProducts(); } }, [currentCompany]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/supplier-invoices/?company_id=${currentCompany.id}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      setDocs(await res.json());
    } catch (error) { toast({ title: 'Erreur', variant: 'destructive' }); }
    finally { setLoading(false); }
  };

  const loadSuppliers = async () => {
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/suppliers/?company_id=${currentCompany.id}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      setSuppliers(await res.json());
    } catch (error) { console.error(error); }
  };

  const loadProducts = async () => {
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/products/?company_id=${currentCompany.id}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      setProducts(await res.json());
    } catch (error) { console.error(error); }
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    const item = newItems[index];
    const subtotal = item.quantity * item.unit_price;
    const discountAmount = subtotal * (item.discount / 100);
    item.total = (subtotal - discountAmount) * (1 + item.tax_rate / 100);
    // Ne PAS recalculer FODEC automatiquement — il vient de la facture
    setFormData({...formData, items: newItems});
  };

  const addItem = () => setFormData({...formData, items: [...formData.items, { description: '', quantity: 1, unit_price: 0, tax_rate: 19, discount: 0, total: 0 }]});
  const removeItem = (index) => setFormData({...formData, items: formData.items.filter((_, i) => i !== index)});

  const selectProduct = (index, productId) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      const newItems = [...formData.items];
      newItems[index] = {...newItems[index], description: product.name, unit_price: product.purchase_price || product.selling_price || 0, tax_rate: product.tax_rate || 19};
      const item = newItems[index];
      item.total = item.quantity * item.unit_price * (1 + item.tax_rate / 100);
      setFormData({...formData, items: newItems});
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.supplier_id) { toast({ title: 'Erreur', description: 'Sélectionnez un fournisseur', variant: 'destructive' }); return; }
    try {
      const totals = calculateTotals();
      const payload = {
        ...formData,
        subtotal: totals.totalHT,
        fodec: totals.fodec,
        assiette_tva: totals.assietteTva,
        total_tax: totals.tva,
        timbre: totals.timbre,
        total: totals.netTotal,
        balance_due: totals.netTotal,
      };
      const method = selectedDoc ? 'PUT' : 'POST';
      const url = selectedDoc
        ? `${process.env.REACT_APP_BACKEND_URL}/api/supplier-invoices/${selectedDoc.id}?company_id=${currentCompany.id}`
        : `${process.env.REACT_APP_BACKEND_URL}/api/supplier-invoices/?company_id=${currentCompany.id}`;
      await fetch(url, { method, headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      toast({ title: 'Succès', description: selectedDoc ? 'Facture modifiée' : 'Facture créée' });
      setModalOpen(false); loadData();
    } catch (error) { toast({ title: 'Erreur', variant: 'destructive' }); }
  };

  const handleMarkPaid = async () => {
    if (!paymentModal.doc) return;
    setPaying(true);
    try {
      const params = new URLSearchParams({
        company_id: currentCompany.id,
        payment_method: paymentMethod,
      });
      if (paymentReference) params.append('payment_reference', paymentReference);
      const res = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/supplier-invoices/${paymentModal.doc.id}/mark-paid?${params}`,
        { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Erreur');
      toast({ title: 'Succès', description: `Facture ${paymentModal.doc.number} marquée payée` });
      setPaymentModal({ open: false, doc: null });
      setPaymentReference('');
      loadData();
    } catch (e) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    } finally {
      setPaying(false);
    }
  };

  const handleDelete = async (id) => {    if (!window.confirm('Supprimer cette facture fournisseur ?')) return;
    try {
      await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/supplier-invoices/${id}?company_id=${currentCompany.id}`, {
        method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      toast({ title: 'Succès' }); loadData();
    } catch (error) { toast({ title: 'Erreur', variant: 'destructive' }); }
  };

  const openCreate = () => {
    setSelectedDoc(null);
    setFormData({
      supplier_id: '', supplier_number: '',
      date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      items: [{ description: '', quantity: 1, unit_price: 0, tax_rate: 19, discount: 0, total: 0 }],
      fodec: 0, timbre: 0, notes: ''
    });
    setModalOpen(true);
  };
  const openEdit = (doc) => {
    setSelectedDoc(doc);
    setFormData({
      supplier_id: doc.supplier_id || '',
      supplier_number: doc.supplier_number || '',
      date: doc.date?.split('T')[0] || '',
      due_date: doc.due_date?.split('T')[0] || '',
      items: doc.items?.length ? doc.items : [{ description: '', quantity: 1, unit_price: 0, tax_rate: 19, discount: 0, total: 0 }],
      fodec: doc.fodec || 0,
      timbre: doc.timbre || 0,
      notes: doc.notes || ''
    });
    setModalOpen(true);
  };

  const getStatusBadge = (status) => {
    const config = {
      draft: { label: 'Brouillon', variant: 'secondary', tone: 'bg-slate-100 text-slate-700' },
      received: { label: 'Reçue', variant: 'info', tone: 'bg-blue-50 text-blue-700' },
      partial: { label: 'Partiel', variant: 'warning', tone: 'bg-amber-50 text-amber-700' },
      paid: { label: 'Payée', variant: 'success', tone: 'bg-emerald-50 text-emerald-700' }
    };
    return config[status] || config.received;
  };

  const calculateTotals = () => {
    // Étape 1 : Total HT NET = somme des (qté × prix × (1 - remise%))
    const totalHT = parseFloat(formData.items.reduce((s, it) =>
      s + (it.quantity || 0) * (it.unit_price || 0) * (1 - (it.discount || 0) / 100), 0).toFixed(3));

    // Étape 2 : FODEC = 1% du HT (si applicable)
    const fodec = parseFloat((formData.fodec || 0).toFixed(3));

    // Étape 3 : Assiette TVA = HT + FODEC
    const assietteTva = parseFloat((totalHT + fodec).toFixed(3));

    // Étape 4 : TVA = 19% × Assiette TVA (base = HT + FODEC)
    const tvaRate = formData.items[0]?.tax_rate || 19;
    const tva = parseFloat((assietteTva * tvaRate / 100).toFixed(3));

    // Étape 5 : Timbre fiscal
    const timbre = parseFloat((formData.timbre || 0).toFixed(3));

    // Résultat : Net à payer = HT + FODEC + TVA + Timbre
    const netTotal = parseFloat((totalHT + fodec + tva + timbre).toFixed(3));

    return { totalHT, fodec, assietteTva, tva, tvaRate, timbre, netTotal };
  };
  const filteredDocs = docs.filter(d => d.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase()) || d.number?.toLowerCase().includes(searchTerm.toLowerCase()));
  const stats = {
    total: filteredDocs.reduce((s, d) => s + (d.total || 0), 0),
    paid: filteredDocs.filter(d => d.status === 'paid').reduce((s, d) => s + (d.total || 0), 0),
    pending: filteredDocs.filter(d => d.status !== 'paid').reduce((s, d) => s + (d.balance_due || 0), 0)
  };
  const selectedPreviewDoc = filteredDocs.find((doc) => doc.id === selectedPreviewId) || null;
  const previewHasAttachment = !!selectedPreviewDoc?.attachments?.length;
  const previewAttachment = selectedPreviewDoc?.attachments?.[0] || '';
  const previewIsPdf = /\.pdf$/i.test(previewAttachment);
  const previewUrl = selectedPreviewDoc && previewHasAttachment && currentCompany
    ? `${API_BASE}/api/supplier-invoices/${selectedPreviewDoc.id}/attachment?company_id=${currentCompany.id}&token=${encodeURIComponent(localStorage.getItem('token') || '')}`
    : null;

  useEffect(() => {
    if (!filteredDocs.length) {
      if (selectedPreviewId !== null) setSelectedPreviewId(null);
      return;
    }
    if (selectedPreviewId && !filteredDocs.some((doc) => doc.id === selectedPreviewId)) {
      setSelectedPreviewId(null);
    }
  }, [filteredDocs, selectedPreviewId]);

  if (!currentCompany) return <AppLayout><div className="page-shell"><div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-6 py-16 text-center text-slate-500">Aucune entreprise sélectionnée</div></div></AppLayout>;

  return (
    <AppLayout>
      <div className="page-shell section-stack" data-testid="supplier-invoices-page">
        <div className="page-header">
          <div><h1 className="page-header-title">Factures fournisseur</h1><p className="page-header-subtitle">{filteredDocs.length} facture(s) sur le périmètre courant</p></div>
          <div className="page-actions">
            <Button variant="outline" onClick={() => setImportModalOpen(true)} className="btn-ai-import gap-2">
              <Sparkles className="w-4 h-4 text-violet-500" />
              Importer des factures (IA)
            </Button>
            <Button onClick={openCreate} data-testid="create-si-btn"><Plus className="w-4 h-4 mr-2" /> Nouvelle facture</Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="interactive-lift p-5 border-slate-200/80 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Total facturé</p>
            <p className="metric-value mt-2 text-slate-900">{stats.total.toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} TND</p>
            <p className="mt-1 text-sm text-slate-500">{filteredDocs.length} facture(s)</p>
          </Card>
          <Card className="interactive-lift p-5 border-slate-200/80 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Payé</p>
            <p className="metric-value mt-2 text-emerald-700">{stats.paid.toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} TND</p>
            <p className="mt-1 text-sm text-slate-500">Décaissements confirmés</p>
          </Card>
          <Card className="interactive-lift p-5 border-slate-200/80 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">À payer</p>
            <p className="metric-value mt-2 text-rose-600">{stats.pending.toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} TND</p>
            <p className="mt-1 text-sm text-slate-500">Reste dû aux fournisseurs</p>
          </Card>
        </div>

        <Card className="p-4 md:p-5"><div className="flex flex-col gap-4 md:flex-row md:items-center"><div className="relative flex-1"><Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" /><Input placeholder="Rechercher par fournisseur, numéro ou référence..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-11" /></div><div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">Cliquez une facture pour ouvrir le panneau document</div></div></Card>

        <Card>
          {loading ? (<div className="p-4 md:p-5"><TableSkeleton rows={7} columns={6} /></div>
          ) : filteredDocs.length === 0 ? (<div className="p-8 text-center"><Receipt className="w-12 h-12 text-slate-300 mx-auto mb-4" /><p className="text-base font-semibold text-slate-900">Aucune facture fournisseur</p><p className="mt-2 text-sm text-slate-500">Importez un document fournisseur ou créez une facture manuelle pour lancer le flux achat.</p><div className="mt-4 flex justify-center gap-2"><Button variant="outline" onClick={() => setImportModalOpen(true)} className="btn-ai-import"><Sparkles className="w-4 h-4 mr-2 text-violet-500" /> Importer (IA)</Button><Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" /> Créer</Button></div></div>
          ) : selectedPreviewDoc ? (
            <div className="grid gap-4 p-4 lg:grid-cols-[320px_minmax(0,1fr)_340px]">
              <Card className="overflow-hidden border-slate-200">
                <div className="border-b border-slate-200 px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Rubrique factures</p>
                      <p className="text-xs text-slate-500">Cliquez sur une facture pour l’ouvrir</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setImportModalOpen(true)} className="btn-ai-import">
                      <Sparkles className="w-3.5 h-3.5 mr-1 text-violet-500" /> Import IA
                    </Button>
                  </div>
                </div>
                <div className="max-h-[calc(100vh-18rem)] space-y-2 overflow-y-auto p-3">
                  {filteredDocs.map((doc) => {
                    const statusConfig = getStatusBadge(doc.status);
                    const isActive = selectedPreviewDoc?.id === doc.id;
                    return (
                      <button
                        key={doc.id}
                        type="button"
                        onClick={() => setSelectedPreviewId(doc.id)}
                        className={`w-full rounded-2xl border p-4 text-left transition-all ${
                          isActive
                            ? 'border-violet-300 bg-violet-50 shadow-sm'
                            : 'border-slate-200 bg-white hover:border-violet-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${isActive ? 'bg-violet-100' : 'bg-slate-100'}`}>
                              <Receipt className={`w-5 h-5 ${isActive ? 'text-violet-700' : 'text-slate-700'}`} />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-slate-900">{doc.number}</p>
                              <p className="truncate text-xs text-slate-500">{doc.supplier_name || 'Fournisseur non renseigné'}</p>
                            </div>
                          </div>
                          <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
                        </div>
                        <div className="space-y-1 text-xs text-slate-500">
                          <div className="flex items-center justify-between gap-2">
                            <span>{doc.supplier_number || 'Sans n° fournisseur'}</span>
                            <span>{doc.date ? new Date(doc.date).toLocaleDateString('fr-FR') : '-'}</span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-slate-900">{(doc.total || 0).toFixed(3)} TND</span>
                            <span className="font-medium text-rose-600">Reste {(doc.balance_due ?? 0).toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} TND</span>
                          </div>
                          {doc.attachments?.length > 0 && (
                            <div className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-1 text-[11px] font-medium text-violet-700">
                              <FileText className="h-3 w-3" /> Importée avec document
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Card>

              <Card className="overflow-hidden border-slate-200">
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Document</p>
                    <p className="text-xs text-slate-500">
                      {selectedPreviewDoc.number} {selectedPreviewDoc.supplier_number ? `· ${selectedPreviewDoc.supplier_number}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setSelectedPreviewId(null)}>
                      Fermer
                    </Button>
                    {previewUrl && (
                      <Button variant="ghost" size="sm" onClick={() => window.open(previewUrl, '_blank', 'noopener,noreferrer')}>
                        <ExternalLink className="w-4 h-4 mr-1" /> Ouvrir
                      </Button>
                    )}
                  </div>
                </div>
                <div className="bg-slate-50/60 p-4">
                  {previewUrl ? (
                    previewIsPdf ? (
                      <SupplierInvoicePdfPreview
                        fileUrl={previewUrl}
                        documentLabel={selectedPreviewDoc.number}
                      />
                    ) : (
                      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                          <p className="text-sm font-semibold text-slate-900">Aperçu document</p>
                          <p className="text-xs text-slate-500">Image source importée</p>
                        </div>
                        <div className="flex h-[calc(100vh-19rem)] min-h-[620px] items-center justify-center p-4">
                          <img src={previewUrl} alt={selectedPreviewDoc.number} className="max-h-full max-w-full rounded-xl object-contain" />
                        </div>
                      </div>
                    )
                  ) : (
                    <div className="flex h-[calc(100vh-19rem)] min-h-[620px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
                      <Eye className="mb-4 h-10 w-10 text-slate-300" />
                      <p className="font-semibold text-slate-900">Aucun document importé disponible</p>
                      <p className="mt-2 max-w-md text-sm text-slate-500">
                        Cette facture semble avoir été créée manuellement. Les factures ajoutées via l’import afficheront ici leur PDF ou leur image source.
                      </p>
                    </div>
                  )}
                </div>
              </Card>

              <Card className="overflow-hidden border-slate-200">
                <div className="border-b border-slate-200 px-5 py-3">
                  <p className="text-sm font-semibold text-slate-900">Actions & détails</p>
                  <p className="text-xs text-slate-500">Expérience de validation orientée document</p>
                </div>
                <div className="max-h-[calc(100vh-18rem)] space-y-5 overflow-y-auto p-5">
                  <div className="grid gap-2">
                    <Button onClick={() => openEdit(selectedPreviewDoc)}>
                      <Edit className="w-4 h-4 mr-2" /> Modifier la facture
                    </Button>
                    {selectedPreviewDoc.status !== 'paid' ? (
                      <Button
                        variant="outline"
                        onClick={() => { setPaymentModal({ open: true, doc: selectedPreviewDoc }); setPaymentMethod('transfer'); setPaymentReference(''); }}
                      >
                        <CreditCard className="w-4 h-4 mr-2 text-green-600" /> Marquer payée
                      </Button>
                    ) : (
                      <Button variant="outline" disabled>
                        <CreditCard className="w-4 h-4 mr-2" /> Déjà payée
                      </Button>
                    )}
                    {previewUrl && (
                      <Button variant="outline" onClick={() => window.open(previewUrl, '_blank', 'noopener,noreferrer')}>
                        <Eye className="w-4 h-4 mr-2" /> Voir le document
                      </Button>
                    )}
                    <Button variant="outline" className="text-red-600 hover:text-red-700" onClick={() => handleDelete(selectedPreviewDoc.id)}>
                      <Trash2 className="w-4 h-4 mr-2" /> Supprimer
                    </Button>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Synthèse</p>
                    <div className="space-y-3 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-slate-500">Fournisseur</span>
                        <span className="text-right font-medium text-slate-900">{selectedPreviewDoc.supplier_name || '-'}</span>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-slate-500">N° interne</span>
                        <span className="text-right font-medium text-slate-900">{selectedPreviewDoc.number || '-'}</span>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-slate-500">N° fournisseur</span>
                        <span className="text-right font-medium text-slate-900">{selectedPreviewDoc.supplier_number || '-'}</span>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-slate-500">Date facture</span>
                        <span className="text-right font-medium text-slate-900">{selectedPreviewDoc.date ? new Date(selectedPreviewDoc.date).toLocaleDateString('fr-FR') : '-'}</span>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-slate-500">Échéance</span>
                        <span className="text-right font-medium text-slate-900">{selectedPreviewDoc.due_date ? new Date(selectedPreviewDoc.due_date).toLocaleDateString('fr-FR') : '-'}</span>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-slate-500">Statut</span>
                        <Badge variant={getStatusBadge(selectedPreviewDoc.status).variant}>{getStatusBadge(selectedPreviewDoc.status).label}</Badge>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 p-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Montants</p>
                    <div className="space-y-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Total HT</span>
                        <span className="font-medium text-slate-900">{(selectedPreviewDoc.subtotal || 0).toFixed(3)} TND</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">TVA</span>
                        <span className="font-medium text-slate-900">{(selectedPreviewDoc.total_tax || 0).toFixed(3)} TND</span>
                      </div>
                      {!!selectedPreviewDoc.fodec && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">FODEC</span>
                          <span className="font-medium text-slate-900">{(selectedPreviewDoc.fodec || 0).toFixed(3)} TND</span>
                        </div>
                      )}
                      {!!selectedPreviewDoc.timbre && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Timbre</span>
                          <span className="font-medium text-slate-900">{(selectedPreviewDoc.timbre || 0).toFixed(3)} TND</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between border-t border-slate-200 pt-3">
                        <span className="font-semibold text-slate-700">Net à payer</span>
                        <span className="text-lg font-bold text-slate-900">{(selectedPreviewDoc.total || 0).toFixed(3)} TND</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Reste dû</span>
                        <span className="font-semibold text-rose-600">{(selectedPreviewDoc.balance_due || 0).toFixed(3)} TND</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-violet-600" />
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lignes de facture</p>
                    </div>
                    <div className="space-y-2">
                      {(selectedPreviewDoc.items || []).length ? (
                        selectedPreviewDoc.items.map((item, index) => (
                          <div key={`${selectedPreviewDoc.id}-item-${index}`} className="rounded-xl bg-slate-50 p-3">
                            <p className="text-sm font-medium text-slate-900">{item.description || `Ligne ${index + 1}`}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              {Number(item.quantity || 0).toFixed(3)} × {Number(item.unit_price || 0).toFixed(3)} TND
                              {item.tax_rate !== undefined ? ` · TVA ${item.tax_rate}%` : ''}
                            </p>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-slate-400">Aucune ligne disponible.</p>
                      )}
                    </div>
                  </div>

                  {selectedPreviewDoc.notes && (
                    <div className="rounded-2xl border border-slate-200 p-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Commentaires</p>
                      <p className="text-sm text-slate-600">{selectedPreviewDoc.notes}</p>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          ) : (
            <div className="p-4">
              <Card className="overflow-hidden border-slate-200">
                <div className="border-b border-slate-200 px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Liste des factures</p>
                      <p className="text-xs text-slate-500">Cliquez sur une facture pour ouvrir le visualiseur</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setImportModalOpen(true)} className="btn-ai-import">
                      <Sparkles className="w-3.5 h-3.5 mr-1 text-violet-500" /> Import IA
                    </Button>
                  </div>
                </div>
                <div className="max-h-[calc(100vh-18rem)] space-y-2 overflow-y-auto p-3">
                {filteredDocs.map((doc) => {
                  const statusConfig = getStatusBadge(doc.status);
                  return (
                      <button
                        key={doc.id}
                        type="button"
                        onClick={() => setSelectedPreviewId(doc.id)}
                        className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left transition-all hover:border-violet-200 hover:bg-slate-50"
                      >
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100">
                              <Receipt className="w-5 h-5 text-slate-700" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-slate-900">{doc.number}</p>
                              <p className="truncate text-xs text-slate-500">{doc.supplier_name || 'Fournisseur non renseigné'}</p>
                            </div>
                          </div>
                          <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
                        </div>
                        <div className="space-y-1 text-xs text-slate-500">
                          <div className="flex items-center justify-between gap-2">
                            <span>{doc.supplier_number || 'Sans n° fournisseur'}</span>
                            <span>{doc.date ? new Date(doc.date).toLocaleDateString('fr-FR') : '-'}</span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-slate-900">{(doc.total || 0).toFixed(3)} TND</span>
                            <span className="font-medium text-rose-600">Reste {(doc.balance_due ?? 0).toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} TND</span>
                          </div>
                          {doc.attachments?.length > 0 && (
                            <div className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-1 text-[11px] font-medium text-violet-700">
                              <FileText className="h-3 w-3" /> Importée avec document
                            </div>
                          )}
                        </div>
                      </button>
                  );
                })}
                </div>
              </Card>
            </div>
          )}
        </Card>
      </div>

        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{selectedDoc ? 'Modifier' : 'Nouvelle'} facture fournisseur</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Fournisseur *</Label><Select value={formData.supplier_id} onValueChange={(v) => setFormData({...formData, supplier_id: v})}><SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger><SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.display_name}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>N° facture fournisseur</Label><Input value={formData.supplier_number} onChange={(e) => setFormData({...formData, supplier_number: e.target.value})} placeholder="Réf. fournisseur" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Date</Label><Input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} /></div>
              <div><Label>Échéance</Label><Input type="date" value={formData.due_date} onChange={(e) => setFormData({...formData, due_date: e.target.value})} /></div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2"><Label>Articles</Label><Button type="button" size="sm" onClick={addItem} className="bg-violet-600 hover:bg-violet-700"><Plus className="w-4 h-4 mr-1" /> Ajouter</Button></div>
              {formData.items.map((item, index) => (
                <div key={index} className="border rounded-lg p-3 mb-2 space-y-2">
                  <div className="flex gap-2">
                    <Select onValueChange={(v) => selectProduct(index, v)}><SelectTrigger className="w-[180px]"><SelectValue placeholder="Produit" /></SelectTrigger><SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
                    <Input placeholder="Description" value={item.description} onChange={(e) => handleItemChange(index, 'description', e.target.value)} className="flex-1" />
                    {formData.items.length > 1 && <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(index)}><Trash2 className="w-4 h-4 text-red-500" /></Button>}
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    <div><Label className="text-xs">Qté</Label><Input type="number" value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)} /></div>
                    <div><Label className="text-xs">Prix HT</Label><Input type="number" value={item.unit_price} onChange={(e) => handleItemChange(index, 'unit_price', parseFloat(e.target.value) || 0)} /></div>
                    <div><Label className="text-xs">TVA %</Label><Input type="number" value={item.tax_rate} onChange={(e) => handleItemChange(index, 'tax_rate', parseFloat(e.target.value) || 0)} /></div>
                    <div><Label className="text-xs">Remise %</Label><Input type="number" value={item.discount} onChange={(e) => handleItemChange(index, 'discount', parseFloat(e.target.value) || 0)} /></div>
                    <div><Label className="text-xs">Total</Label><Input type="number" value={item.total.toFixed(3)} disabled className="bg-gray-100" /></div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              {(() => {
                const totals = calculateTotals();
                return (
                  <div className="bg-gray-50 p-4 rounded-lg text-right space-y-1 min-w-64">
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Total HT NET</span>
                      <span>{totals.totalHT.toFixed(3)} TND</span>
                    </div>
                    {totals.fodec > 0 && (
                      <div className="flex justify-between text-sm text-orange-700">
                        <span>FODEC (1%)</span>
                        <span>{totals.fodec.toFixed(3)} TND</span>
                      </div>
                    )}
                    {totals.fodec > 0 && (
                      <div className="flex justify-between text-xs text-gray-400">
                        <span>Assiette TVA</span>
                        <span>{totals.assietteTva.toFixed(3)} TND</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>TVA ({totals.tvaRate}% × Assiette)</span>
                      <span>{totals.tva.toFixed(3)} TND</span>
                    </div>
                    {totals.timbre > 0 && (
                      <div className="flex justify-between text-sm text-blue-700">
                        <span>Timbre fiscal</span>
                        <span>{totals.timbre.toFixed(3)} TND</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-2 border-t border-gray-300">
                      <span className="font-bold text-gray-700">Net à payer</span>
                      <span className="text-xl font-bold text-red-600">{totals.netTotal.toFixed(3)} TND</span>
                    </div>
                    {/* Champs FODEC et Timbre éditables */}
                    <div className="flex gap-2 pt-2 mt-1 border-t border-gray-200">
                      <div className="flex-1">
                        <Label className="text-xs text-gray-500">FODEC</Label>
                        <Input
                          type="number" step="0.001" min="0"
                          value={formData.fodec}
                          onChange={e => setFormData({...formData, fodec: parseFloat(e.target.value) || 0})}
                          className="h-7 text-xs"
                        />
                      </div>
                      <div className="flex-1">
                        <Label className="text-xs text-gray-500">Timbre</Label>
                        <Input
                          type="number" step="0.001" min="0"
                          value={formData.timbre}
                          onChange={e => setFormData({...formData, timbre: parseFloat(e.target.value) || 0})}
                          className="h-7 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
            <div><Label>Notes</Label><Textarea value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} rows={2} /></div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Annuler</Button><Button type="submit" className="bg-violet-600 hover:bg-violet-700">{selectedDoc ? 'Modifier' : 'Créer'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <InvoiceImportModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        onSuccess={loadData}
      />

      {/* ── Modal de paiement ─────────────────────────────────────────────── */}
      <Dialog open={paymentModal.open} onOpenChange={o => setPaymentModal(p => ({ ...p, open: o }))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-green-600" />
              Marquer la facture comme payée
            </DialogTitle>
          </DialogHeader>
          {paymentModal.doc && (
            <div className="space-y-4 py-2">
              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <p className="font-medium">{paymentModal.doc.number} — {paymentModal.doc.supplier_name}</p>
                <p className="text-gray-500">Montant : <strong className="text-red-600">{(paymentModal.doc.balance_due || paymentModal.doc.total || 0).toFixed(3)} TND</strong></p>
              </div>

              <div>
                <Label className="text-sm font-medium mb-2 block">Mode de règlement</Label>
                <div className="grid grid-cols-1 gap-2">
                  {PAYMENT_METHODS.map(m => {
                    const Icon = m.icon;
                    return (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => setPaymentMethod(m.value)}
                        className={`flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-all ${
                          paymentMethod === m.value
                            ? 'border-violet-500 bg-violet-50'
                            : 'border-gray-200 hover:border-violet-300'
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${paymentMethod === m.value ? 'text-violet-600' : 'text-gray-500'}`} />
                        <div>
                          <p className="font-medium text-sm">{m.label}</p>
                          <p className="text-xs text-gray-400">{m.account}</p>
                        </div>
                        <div className="ml-auto">
                          {paymentMethod === m.value && (
                            <div className="w-4 h-4 rounded-full bg-violet-600 flex items-center justify-center">
                              <div className="w-2 h-2 rounded-full bg-white" />
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium">Référence de paiement (optionnel)</Label>
                <Input
                  value={paymentReference}
                  onChange={e => setPaymentReference(e.target.value)}
                  placeholder="N° de chèque, référence virement..."
                  className="mt-1"
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
                <strong>Écriture comptable qui sera créée :</strong>
                <div className="mt-1 font-mono">
                  Débit 401 Fournisseurs · {(paymentModal.doc.balance_due || paymentModal.doc.total || 0).toFixed(3)} TND<br />
                  Crédit {PAYMENT_METHODS.find(m => m.value === paymentMethod)?.account}
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPaymentModal({ open: false, doc: null })}>Annuler</Button>
            <Button
              onClick={handleMarkPaid}
              disabled={paying}
              className="bg-green-600 hover:bg-green-700"
            >
              {paying ? 'Enregistrement...' : 'Confirmer le paiement'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default SupplierInvoices;
