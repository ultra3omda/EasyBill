import React, { useState, useEffect } from 'react';
import { useCompany } from '../hooks/useCompany';
import AppLayout from '../components/layout/AppLayout';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Plus, Search, Receipt, Edit, Trash2, MoreVertical, CreditCard, Banknote, Building2, CheckSquare } from 'lucide-react';
import { toast } from '../hooks/use-toast';

const PAYMENT_METHODS = [
  { value: 'transfer', label: 'Virement bancaire', icon: Building2, account: '521 — Banques' },
  { value: 'check',    label: 'Chèque',            icon: CheckSquare, account: '521 — Banques' },
  { value: 'cash',     label: 'Espèces',            icon: Banknote, account: '531 — Caisse' },
  { value: 'card',     label: 'Carte bancaire',     icon: CreditCard, account: '521 — Banques' },
  { value: 'e_dinar',  label: 'E-Dinar',            icon: Banknote, account: '531 — Caisse' },
];

const SupplierInvoices = () => {
  const { currentCompany } = useCompany();
  const [docs, setDocs] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  // Payment modal
  const [paymentModal, setPaymentModal] = useState({ open: false, doc: null });
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
    const config = { draft: { label: 'Brouillon', className: 'bg-gray-100 text-gray-800' }, received: { label: 'Reçue', className: 'bg-blue-100 text-blue-800' }, partial: { label: 'Partiel', className: 'bg-orange-100 text-orange-800' }, paid: { label: 'Payée', className: 'bg-green-100 text-green-800' } };
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

  if (!currentCompany) return <AppLayout><div className="text-center py-20">Aucune entreprise sélectionnée</div></AppLayout>;

  return (
    <AppLayout>
      <div className="space-y-6" data-testid="supplier-invoices-page">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div><h1 className="text-3xl font-bold text-gray-900">Factures fournisseur</h1><p className="text-gray-500 mt-1">{filteredDocs.length} factures</p></div>
          <Button className="bg-violet-600 hover:bg-violet-700 text-white" onClick={openCreate} data-testid="create-si-btn"><Plus className="w-4 h-4 mr-2" /> Nouvelle facture</Button>
        </div>

        <Card className="p-4"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" /><Input placeholder="Rechercher..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" /></div></Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-6"><div className="flex items-center gap-3"><div className="p-2 bg-violet-100 rounded-lg"><Receipt className="w-5 h-5 text-violet-600" /></div><div><p className="text-sm text-gray-600">Total facturé</p><p className="text-2xl font-bold text-violet-600">{stats.total.toFixed(3)} TND</p></div></div></Card>
          <Card className="p-6"><div className="flex items-center gap-3"><div className="p-2 bg-green-100 rounded-lg"><CreditCard className="w-5 h-5 text-green-600" /></div><div><p className="text-sm text-gray-600">Payé</p><p className="text-2xl font-bold text-green-600">{stats.paid.toFixed(3)} TND</p></div></div></Card>
          <Card className="p-6"><div className="flex items-center gap-3"><div className="p-2 bg-red-100 rounded-lg"><Receipt className="w-5 h-5 text-red-600" /></div><div><p className="text-sm text-gray-600">À payer</p><p className="text-2xl font-bold text-red-600">{stats.pending.toFixed(3)} TND</p></div></div></Card>
        </div>

        <Card>
          {loading ? (<div className="p-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 mx-auto"></div></div>
          ) : filteredDocs.length === 0 ? (<div className="p-8 text-center"><Receipt className="w-12 h-12 text-gray-300 mx-auto mb-4" /><p className="text-gray-500">Aucune facture fournisseur</p><Button onClick={openCreate} className="mt-4 bg-violet-600 hover:bg-violet-700"><Plus className="w-4 h-4 mr-2" /> Créer</Button></div>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>N° Interne</TableHead><TableHead>N° Fournisseur</TableHead><TableHead>Fournisseur</TableHead><TableHead>Date</TableHead><TableHead>Échéance</TableHead><TableHead>Montant</TableHead><TableHead>Reste</TableHead><TableHead>Statut</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {filteredDocs.map((doc) => {
                  const statusConfig = getStatusBadge(doc.status);
                  return (
                    <TableRow key={doc.id}>
                      <TableCell><div className="flex items-center gap-3"><div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center"><Receipt className="w-5 h-5 text-red-600" /></div><span className="font-medium">{doc.number}</span></div></TableCell>
                      <TableCell>{doc.supplier_number || '-'}</TableCell>
                      <TableCell>{doc.supplier_name}</TableCell>
                      <TableCell>{doc.date ? new Date(doc.date).toLocaleDateString('fr-FR') : '-'}</TableCell>
                      <TableCell>{doc.due_date ? new Date(doc.due_date).toLocaleDateString('fr-FR') : '-'}</TableCell>
                      <TableCell className="font-semibold">{(doc.total || 0).toFixed(3)} TND</TableCell>
                      <TableCell className="font-semibold text-red-600">{(doc.balance_due || 0).toFixed(3)} TND</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <Badge className={statusConfig.className}>{statusConfig.label}</Badge>
                          {doc.payment_method && doc.status === 'paid' && (
                            <span className="text-xs text-gray-400">
                              {PAYMENT_METHODS.find(m => m.value === doc.payment_method)?.label || doc.payment_method}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="sm"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(doc)}><Edit className="w-4 h-4 mr-2" /> Modifier</DropdownMenuItem>
                            {doc.status !== 'paid' && (
                              <DropdownMenuItem onClick={() => { setPaymentModal({ open: true, doc }); setPaymentMethod('transfer'); setPaymentReference(''); }}>
                                <CreditCard className="w-4 h-4 mr-2 text-green-600" /> Marquer payée
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator /><DropdownMenuItem className="text-red-600" onClick={() => handleDelete(doc.id)}><Trash2 className="w-4 h-4 mr-2" /> Supprimer</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
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
