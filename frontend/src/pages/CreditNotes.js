import React, { useState, useEffect } from 'react';
import { useCompany } from '../hooks/useCompany';
import AppLayout from '../components/layout/AppLayout';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Plus, Search, FileText, Edit, Trash2, MoreVertical, CheckCircle, FileX } from 'lucide-react';
import { toast } from '../hooks/use-toast';

const CreditNotes = () => {
  const { currentCompany } = useCompany();
  const [docs, setDocs] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    customer_id: '', date: new Date().toISOString().split('T')[0], invoice_id: '',
    reason: 'return', items: [{ description: '', quantity: 1, unit_price: 0, tax_rate: 19, discount: 0, total: 0 }],
    notes: '', refund_method: 'credit'
  });

  useEffect(() => {
    if (currentCompany) { loadData(); loadCustomers(); loadInvoices(); }
  }, [currentCompany]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/credit-notes/?company_id=${currentCompany.id}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      setDocs(await res.json());
    } catch (error) {
      toast({ title: 'Erreur', description: 'Impossible de charger les données', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const loadCustomers = async () => {
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/customers/?company_id=${currentCompany.id}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      setCustomers(await res.json());
    } catch (error) { console.error(error); }
  };

  const loadInvoices = async () => {
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/invoices/?company_id=${currentCompany.id}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      setInvoices(await res.json());
    } catch (error) { console.error(error); }
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    const item = newItems[index];
    const subtotal = item.quantity * item.unit_price;
    const discountAmount = subtotal * (item.discount / 100);
    const afterDiscount = subtotal - discountAmount;
    item.total = afterDiscount + (afterDiscount * item.tax_rate / 100);
    setFormData({...formData, items: newItems});
  };

  const addItem = () => setFormData({...formData, items: [...formData.items, { description: '', quantity: 1, unit_price: 0, tax_rate: 19, discount: 0, total: 0 }]});
  const removeItem = (index) => setFormData({...formData, items: formData.items.filter((_, i) => i !== index)});

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const method = selectedDoc ? 'PUT' : 'POST';
      const url = selectedDoc 
        ? `${process.env.REACT_APP_BACKEND_URL}/api/credit-notes/${selectedDoc.id}?company_id=${currentCompany.id}`
        : `${process.env.REACT_APP_BACKEND_URL}/api/credit-notes/?company_id=${currentCompany.id}`;
      
      await fetch(url, {
        method, headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      toast({ title: 'Succès', description: selectedDoc ? 'Avoir modifié' : 'Avoir créé' });
      setModalOpen(false);
      loadData();
    } catch (error) {
      toast({ title: 'Erreur', description: 'Erreur lors de l\'enregistrement', variant: 'destructive' });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer cet avoir ?')) return;
    try {
      await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/credit-notes/${id}?company_id=${currentCompany.id}`, {
        method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      toast({ title: 'Succès', description: 'Avoir supprimé' });
      loadData();
    } catch (error) {
      toast({ title: 'Erreur', description: 'Erreur', variant: 'destructive' });
    }
  };

  const handleApply = async (id) => {
    try {
      await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/credit-notes/${id}/apply?company_id=${currentCompany.id}`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      toast({ title: 'Succès', description: 'Avoir appliqué' });
      loadData();
    } catch (error) {
      toast({ title: 'Erreur', variant: 'destructive' });
    }
  };

  const openCreate = () => { setSelectedDoc(null); setFormData({ customer_id: '', date: new Date().toISOString().split('T')[0], invoice_id: '', reason: 'return', items: [{ description: '', quantity: 1, unit_price: 0, tax_rate: 19, discount: 0, total: 0 }], notes: '', refund_method: 'credit' }); setModalOpen(true); };
  const openEdit = (doc) => { setSelectedDoc(doc); setFormData({ customer_id: doc.customer_id || '', date: doc.date?.split('T')[0] || '', invoice_id: doc.invoice_id || '', reason: doc.reason || 'return', items: doc.items?.length ? doc.items : [{ description: '', quantity: 1, unit_price: 0, tax_rate: 19, discount: 0, total: 0 }], notes: doc.notes || '', refund_method: doc.refund_method || 'credit' }); setModalOpen(true); };

  const getStatusBadge = (status) => {
    const config = { draft: { label: 'Brouillon', className: 'bg-gray-100 text-gray-800' }, issued: { label: 'Émis', className: 'bg-blue-100 text-blue-800' }, applied: { label: 'Appliqué', className: 'bg-green-100 text-green-800' }, cancelled: { label: 'Annulé', className: 'bg-red-100 text-red-800' } };
    return config[status] || config.draft;
  };

  const getReasonLabel = (reason) => {
    const labels = { return: 'Retour', discount: 'Remise', error: 'Erreur', other: 'Autre' };
    return labels[reason] || reason;
  };

  // Factures filtrées par client sélectionné
  const filteredInvoices = formData.customer_id
    ? invoices.filter(i => i.customer_id === formData.customer_id)
    : invoices;

  // Quand une facture est sélectionnée → pré-remplir les articles
  const handleInvoiceSelect = async (invoiceId) => {
    setFormData(prev => ({ ...prev, invoice_id: invoiceId, items: [] }));
    if (!invoiceId) return;
    try {
      const res = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/invoices/${invoiceId}?company_id=${currentCompany.id}`,
        { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }
      );
      const inv = await res.json();
      if (inv.items && inv.items.length > 0) {
        const mappedItems = inv.items.map(item => {
          const subtotal = item.quantity * item.unit_price;
          const discountAmount = subtotal * ((item.discount || 0) / 100);
          const afterDiscount = subtotal - discountAmount;
          const total = afterDiscount + afterDiscount * ((item.tax_rate || 0) / 100);
          return {
            description: item.description || item.product_name || '',
            quantity: item.quantity || 1,
            unit_price: item.unit_price || 0,
            tax_rate: item.tax_rate || 0,
            discount: item.discount || 0,
            total: parseFloat(total.toFixed(3)),
          };
        });
        setFormData(prev => ({ ...prev, invoice_id: invoiceId, items: mappedItems }));
      } else {
        setFormData(prev => ({
          ...prev, invoice_id: invoiceId,
          items: [{ description: '', quantity: 1, unit_price: 0, tax_rate: 19, discount: 0, total: 0 }]
        }));
      }
    } catch (e) {
      console.error('Erreur chargement facture', e);
    }
  };

  // Quand le client change → réinitialiser la facture et les articles
  const handleCustomerChange = (customerId) => {
    setFormData(prev => ({
      ...prev,
      customer_id: customerId,
      invoice_id: '',
      items: [{ description: '', quantity: 1, unit_price: 0, tax_rate: 19, discount: 0, total: 0 }]
    }));
  };

  const calculateTotal = () => formData.items.reduce((sum, item) => sum + item.total, 0);
  const filteredDocs = docs.filter(d => d.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) || d.number?.toLowerCase().includes(searchTerm.toLowerCase()));

  if (!currentCompany) return <AppLayout><div className="text-center py-20">Aucune entreprise sélectionnée</div></AppLayout>;

  return (
    <AppLayout>
      <div className="space-y-6" data-testid="credit-notes-page">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Factures d'avoir</h1>
            <p className="text-gray-500 mt-1">{filteredDocs.length} avoirs au total</p>
          </div>
          <Button className="bg-violet-600 hover:bg-violet-700 text-white" onClick={openCreate} data-testid="create-credit-note-btn">
            <Plus className="w-4 h-4 mr-2" /> Créer un avoir
          </Button>
        </div>

        <Card className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input placeholder="Rechercher..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-6">
            <p className="text-sm text-gray-600">Total des avoirs</p>
            <p className="text-2xl font-bold text-violet-600">{filteredDocs.reduce((s, d) => s + (d.total || 0), 0).toFixed(2)} TND</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-gray-600">Avoirs appliqués</p>
            <p className="text-2xl font-bold text-green-600">{filteredDocs.filter(d => d.status === 'applied').reduce((s, d) => s + (d.total || 0), 0).toFixed(2)} TND</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-gray-600">En attente</p>
            <p className="text-2xl font-bold text-orange-600">{filteredDocs.filter(d => d.status !== 'applied').reduce((s, d) => s + (d.total || 0), 0).toFixed(2)} TND</p>
          </Card>
        </div>

        <Card>
          {loading ? (
            <div className="p-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 mx-auto"></div></div>
          ) : filteredDocs.length === 0 ? (
            <div className="p-8 text-center">
              <FileX className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Aucun avoir</p>
              <Button onClick={openCreate} className="mt-4 bg-violet-600 hover:bg-violet-700"><Plus className="w-4 h-4 mr-2" /> Créer</Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N° Avoir</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Raison</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDocs.map((doc) => {
                  const statusConfig = getStatusBadge(doc.status);
                  return (
                    <TableRow key={doc.id}>
                      <TableCell><div className="flex items-center gap-3"><div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center"><FileX className="w-5 h-5 text-red-600" /></div><span className="font-medium">{doc.number}</span></div></TableCell>
                      <TableCell>{doc.customer_name}</TableCell>
                      <TableCell>{doc.date ? new Date(doc.date).toLocaleDateString('fr-FR') : '-'}</TableCell>
                      <TableCell>{getReasonLabel(doc.reason)}</TableCell>
                      <TableCell className="font-semibold text-red-600">-{(doc.total || 0).toFixed(2)} TND</TableCell>
                      <TableCell><Badge className={statusConfig.className}>{statusConfig.label}</Badge></TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="sm"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(doc)}><Edit className="w-4 h-4 mr-2" /> Modifier</DropdownMenuItem>
                            {doc.status !== 'applied' && <DropdownMenuItem onClick={() => handleApply(doc.id)}><CheckCircle className="w-4 h-4 mr-2" /> Appliquer</DropdownMenuItem>}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(doc.id)}><Trash2 className="w-4 h-4 mr-2" /> Supprimer</DropdownMenuItem>
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
          <DialogHeader><DialogTitle>{selectedDoc ? 'Modifier' : 'Nouvel'} avoir</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Client *</Label>
                <Select value={formData.customer_id} onValueChange={handleCustomerChange}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.display_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Date</Label><Input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>
                  Facture d'origine
                  {formData.customer_id && filteredInvoices.length === 0 && (
                    <span className="ml-2 text-xs text-orange-500">Aucune facture pour ce client</span>
                  )}
                </Label>
                <Select
                  value={formData.invoice_id}
                  onValueChange={handleInvoiceSelect}
                  disabled={!formData.customer_id}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={formData.customer_id ? 'Sélectionner une facture' : 'Choisir un client d\'abord'} />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredInvoices.map(i => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.number} — {(i.total || 0).toFixed(3)} TND
                        {i.status === 'paid' && ' ✓ Payée'}
                        {i.status === 'sent' && ' · Envoyée'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Raison</Label>
                <Select value={formData.reason} onValueChange={(v) => setFormData({...formData, reason: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="return">Retour de marchandise</SelectItem>
                    <SelectItem value="discount">Remise commerciale</SelectItem>
                    <SelectItem value="error">Erreur de facturation</SelectItem>
                    <SelectItem value="other">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Articles</Label>
                <Button type="button" size="sm" onClick={addItem} className="bg-violet-600 hover:bg-violet-700"><Plus className="w-4 h-4 mr-1" /> Ajouter</Button>
              </div>
              {formData.items.map((item, index) => (
                <div key={index} className="border rounded-lg p-3 mb-2 space-y-2">
                  <div className="flex gap-2">
                    <Input placeholder="Description" value={item.description} onChange={(e) => handleItemChange(index, 'description', e.target.value)} className="flex-1" />
                    {formData.items.length > 1 && <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(index)}><Trash2 className="w-4 h-4 text-red-500" /></Button>}
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    <div><Label className="text-xs">Qté</Label><Input type="number" value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)} /></div>
                    <div><Label className="text-xs">Prix HT</Label><Input type="number" value={item.unit_price} onChange={(e) => handleItemChange(index, 'unit_price', parseFloat(e.target.value) || 0)} /></div>
                    <div><Label className="text-xs">TVA %</Label><Input type="number" value={item.tax_rate} onChange={(e) => handleItemChange(index, 'tax_rate', parseFloat(e.target.value) || 0)} /></div>
                    <div><Label className="text-xs">Remise %</Label><Input type="number" value={item.discount} onChange={(e) => handleItemChange(index, 'discount', parseFloat(e.target.value) || 0)} /></div>
                    <div><Label className="text-xs">Total</Label><Input type="number" value={item.total.toFixed(2)} disabled className="bg-gray-100" /></div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end"><div className="bg-gray-50 p-4 rounded-lg text-right"><p className="text-sm text-gray-600">Total Avoir</p><p className="text-2xl font-bold text-red-600">-{calculateTotal().toFixed(2)} TND</p></div></div>
            <div><Label>Notes</Label><Textarea value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} rows={2} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Annuler</Button>
              <Button type="submit" className="bg-violet-600 hover:bg-violet-700">{selectedDoc ? 'Modifier' : 'Créer'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default CreditNotes;
