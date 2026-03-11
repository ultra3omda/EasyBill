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
import { Plus, Search, ShoppingCart, Edit, Trash2, MoreVertical, Send, CheckCircle, Package } from 'lucide-react';
import { toast } from '../hooks/use-toast';

const PurchaseOrders = () => {
  const { currentCompany } = useCompany();
  const [docs, setDocs] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    supplier_id: '', date: new Date().toISOString().split('T')[0], expected_date: '',
    items: [{ description: '', quantity: 1, unit_price: 0, tax_rate: 19, discount: 0, total: 0 }], notes: ''
  });

  useEffect(() => { if (currentCompany) { loadData(); loadSuppliers(); loadProducts(); } }, [currentCompany]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/purchase-orders/?company_id=${currentCompany.id}`, {
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
      const subtotal = item.quantity * item.unit_price;
      item.total = subtotal * (1 + item.tax_rate / 100);
      setFormData({...formData, items: newItems});
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.supplier_id) { toast({ title: 'Erreur', description: 'Sélectionnez un fournisseur', variant: 'destructive' }); return; }
    try {
      const method = selectedDoc ? 'PUT' : 'POST';
      const url = selectedDoc 
        ? `${process.env.REACT_APP_BACKEND_URL}/api/purchase-orders/${selectedDoc.id}?company_id=${currentCompany.id}`
        : `${process.env.REACT_APP_BACKEND_URL}/api/purchase-orders/?company_id=${currentCompany.id}`;
      await fetch(url, { method, headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
      toast({ title: 'Succès', description: selectedDoc ? 'BC modifié' : 'BC créé' });
      setModalOpen(false); loadData();
    } catch (error) { toast({ title: 'Erreur', variant: 'destructive' }); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer ce bon de commande ?')) return;
    try {
      await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/purchase-orders/${id}?company_id=${currentCompany.id}`, {
        method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      toast({ title: 'Succès' }); loadData();
    } catch (error) { toast({ title: 'Erreur', variant: 'destructive' }); }
  };

  const handleAction = async (id, action) => {
    try {
      await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/purchase-orders/${id}/${action}?company_id=${currentCompany.id}`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      toast({ title: 'Succès' }); loadData();
    } catch (error) { toast({ title: 'Erreur', variant: 'destructive' }); }
  };

  const openCreate = () => { setSelectedDoc(null); setFormData({ supplier_id: '', date: new Date().toISOString().split('T')[0], expected_date: '', items: [{ description: '', quantity: 1, unit_price: 0, tax_rate: 19, discount: 0, total: 0 }], notes: '' }); setModalOpen(true); };
  const openEdit = (doc) => { setSelectedDoc(doc); setFormData({ supplier_id: doc.supplier_id || '', date: doc.date?.split('T')[0] || '', expected_date: doc.expected_date?.split('T')[0] || '', items: doc.items?.length ? doc.items : [{ description: '', quantity: 1, unit_price: 0, tax_rate: 19, discount: 0, total: 0 }], notes: doc.notes || '' }); setModalOpen(true); };

  const getStatusBadge = (status) => {
    const config = { draft: { label: 'Brouillon', className: 'bg-gray-100 text-gray-800' }, sent: { label: 'Envoyé', className: 'bg-blue-100 text-blue-800' }, confirmed: { label: 'Confirmé', className: 'bg-orange-100 text-orange-800' }, received: { label: 'Reçu', className: 'bg-green-100 text-green-800' }, cancelled: { label: 'Annulé', className: 'bg-red-100 text-red-800' } };
    return config[status] || config.draft;
  };

  const calculateTotal = () => formData.items.reduce((sum, item) => sum + item.total, 0);
  const filteredDocs = docs.filter(d => d.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase()) || d.number?.toLowerCase().includes(searchTerm.toLowerCase()));
  const stats = { total: filteredDocs.reduce((s, d) => s + (d.total || 0), 0), pending: filteredDocs.filter(d => ['draft', 'sent'].includes(d.status)).length, received: filteredDocs.filter(d => d.status === 'received').length };

  if (!currentCompany) return <AppLayout><div className="text-center py-20">Aucune entreprise sélectionnée</div></AppLayout>;

  return (
    <AppLayout>
      <div className="space-y-6" data-testid="purchase-orders-page">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div><h1 className="text-3xl font-bold text-gray-900">Bons de commande</h1><p className="text-gray-500 mt-1">{filteredDocs.length} commandes</p></div>
          <Button className="bg-violet-600 hover:bg-violet-700 text-white" onClick={openCreate} data-testid="create-po-btn"><Plus className="w-4 h-4 mr-2" /> Nouveau BC</Button>
        </div>

        <Card className="p-4"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" /><Input placeholder="Rechercher..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" /></div></Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-6"><div className="flex items-center gap-3"><div className="p-2 bg-violet-100 rounded-lg"><ShoppingCart className="w-5 h-5 text-violet-600" /></div><div><p className="text-sm text-gray-600">Total commandé</p><p className="text-2xl font-bold text-violet-600">{stats.total.toFixed(3)} TND</p></div></div></Card>
          <Card className="p-6"><div className="flex items-center gap-3"><div className="p-2 bg-orange-100 rounded-lg"><Send className="w-5 h-5 text-orange-600" /></div><div><p className="text-sm text-gray-600">En attente</p><p className="text-2xl font-bold text-orange-600">{stats.pending}</p></div></div></Card>
          <Card className="p-6"><div className="flex items-center gap-3"><div className="p-2 bg-green-100 rounded-lg"><Package className="w-5 h-5 text-green-600" /></div><div><p className="text-sm text-gray-600">Reçus</p><p className="text-2xl font-bold text-green-600">{stats.received}</p></div></div></Card>
        </div>

        <Card>
          {loading ? (<div className="p-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 mx-auto"></div></div>
          ) : filteredDocs.length === 0 ? (<div className="p-8 text-center"><ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-4" /><p className="text-gray-500">Aucun bon de commande</p><Button onClick={openCreate} className="mt-4 bg-violet-600 hover:bg-violet-700"><Plus className="w-4 h-4 mr-2" /> Créer</Button></div>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>N° BC</TableHead><TableHead>Fournisseur</TableHead><TableHead>Date</TableHead><TableHead>Livraison prévue</TableHead><TableHead>Montant</TableHead><TableHead>Statut</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {filteredDocs.map((doc) => {
                  const statusConfig = getStatusBadge(doc.status);
                  return (
                    <TableRow key={doc.id}>
                      <TableCell><div className="flex items-center gap-3"><div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center"><ShoppingCart className="w-5 h-5 text-violet-600" /></div><span className="font-medium">{doc.number}</span></div></TableCell>
                      <TableCell>{doc.supplier_name}</TableCell>
                      <TableCell>{doc.date ? new Date(doc.date).toLocaleDateString('fr-FR') : '-'}</TableCell>
                      <TableCell>{doc.expected_date ? new Date(doc.expected_date).toLocaleDateString('fr-FR') : '-'}</TableCell>
                      <TableCell className="font-semibold">{(doc.total || 0).toFixed(3)} TND</TableCell>
                      <TableCell><Badge className={statusConfig.className}>{statusConfig.label}</Badge></TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="sm"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(doc)}><Edit className="w-4 h-4 mr-2" /> Modifier</DropdownMenuItem>
                            {doc.status === 'draft' && <DropdownMenuItem onClick={() => handleAction(doc.id, 'send')}><Send className="w-4 h-4 mr-2" /> Envoyer</DropdownMenuItem>}
                            {doc.status === 'sent' && <DropdownMenuItem onClick={() => handleAction(doc.id, 'confirm')}><CheckCircle className="w-4 h-4 mr-2" /> Confirmer</DropdownMenuItem>}
                            {doc.status === 'confirmed' && <DropdownMenuItem onClick={() => handleAction(doc.id, 'receive')}><Package className="w-4 h-4 mr-2" /> Réceptionner</DropdownMenuItem>}
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
          <DialogHeader><DialogTitle>{selectedDoc ? 'Modifier' : 'Nouveau'} bon de commande</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Fournisseur *</Label><Select value={formData.supplier_id} onValueChange={(v) => setFormData({...formData, supplier_id: v})}><SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger><SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.display_name}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Date</Label><Input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} /></div>
              <div><Label>Livraison prévue</Label><Input type="date" value={formData.expected_date} onChange={(e) => setFormData({...formData, expected_date: e.target.value})} /></div>
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
            <div className="flex justify-end"><div className="bg-gray-50 p-4 rounded-lg text-right"><p className="text-sm text-gray-600">Total TTC</p><p className="text-2xl font-bold text-violet-600">{calculateTotal().toFixed(3)} TND</p></div></div>
            <div><Label>Notes</Label><Textarea value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} rows={2} /></div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Annuler</Button><Button type="submit" className="bg-violet-600 hover:bg-violet-700">{selectedDoc ? 'Modifier' : 'Créer'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default PurchaseOrders;
