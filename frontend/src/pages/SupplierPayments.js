import React, { useState, useEffect } from 'react';
import { useCompany } from '../hooks/useCompany';
import AppLayout from '../components/layout/AppLayout';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Checkbox } from '../components/ui/checkbox';
import { Plus, Search, CreditCard, Trash2, MoreVertical, Banknote, Building2 } from 'lucide-react';
import { toast } from '../hooks/use-toast';

const SupplierPayments = () => {
  const { currentCompany } = useCompany();
  const [payments, setPayments] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [pendingInvoices, setPendingInvoices] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    supplier_id: '', date: new Date().toISOString().split('T')[0], amount: 0,
    payment_method: 'transfer', reference: '', allocations: [], notes: ''
  });

  useEffect(() => { if (currentCompany) { loadData(); loadSuppliers(); } }, [currentCompany]);
  useEffect(() => { if (formData.supplier_id) { loadPendingInvoices(formData.supplier_id); } }, [formData.supplier_id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/supplier-payments/?company_id=${currentCompany.id}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      setPayments(await res.json());
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

  const loadPendingInvoices = async (supplierId) => {
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/supplier-invoices/pending?company_id=${currentCompany.id}&supplier_id=${supplierId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      setPendingInvoices(data);
      setFormData(prev => ({...prev, allocations: data.map(inv => ({ invoice_id: inv.id, amount: 0, selected: false, balance: inv.balance_due }))}));
    } catch (error) { console.error(error); setPendingInvoices([]); }
  };

  const handleAllocationChange = (index, amount) => {
    const newAllocations = [...formData.allocations];
    newAllocations[index].amount = Math.min(amount, newAllocations[index].balance);
    newAllocations[index].selected = amount > 0;
    setFormData({...formData, allocations: newAllocations, amount: newAllocations.reduce((s, a) => s + (a.amount || 0), 0)});
  };

  const toggleInvoice = (index) => {
    const newAllocations = [...formData.allocations];
    if (newAllocations[index].selected) {
      newAllocations[index].selected = false;
      newAllocations[index].amount = 0;
    } else {
      newAllocations[index].selected = true;
      newAllocations[index].amount = newAllocations[index].balance;
    }
    setFormData({...formData, allocations: newAllocations, amount: newAllocations.reduce((s, a) => s + (a.amount || 0), 0)});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.supplier_id) { toast({ title: 'Erreur', description: 'Sélectionnez un fournisseur', variant: 'destructive' }); return; }
    if (formData.amount <= 0) { toast({ title: 'Erreur', description: 'Le montant doit être supérieur à 0', variant: 'destructive' }); return; }
    
    try {
      const payload = {...formData, allocations: formData.allocations.filter(a => a.selected && a.amount > 0).map(a => ({ invoice_id: a.invoice_id, amount: a.amount }))};
      await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/supplier-payments/?company_id=${currentCompany.id}`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      toast({ title: 'Succès', description: 'Paiement enregistré' });
      setModalOpen(false); loadData();
    } catch (error) { toast({ title: 'Erreur', variant: 'destructive' }); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer ce paiement ? Les factures associées seront mises à jour.')) return;
    try {
      await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/supplier-payments/${id}?company_id=${currentCompany.id}`, {
        method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      toast({ title: 'Succès' }); loadData();
    } catch (error) { toast({ title: 'Erreur', variant: 'destructive' }); }
  };

  const openCreate = () => {
    setFormData({ supplier_id: '', date: new Date().toISOString().split('T')[0], amount: 0, payment_method: 'transfer', reference: '', allocations: [], notes: '' });
    setPendingInvoices([]);
    setModalOpen(true);
  };

  const getMethodLabel = (method) => {
    const labels = { cash: 'Espèces', check: 'Chèque', transfer: 'Virement', card: 'Carte' };
    return labels[method] || method;
  };

  const filteredPayments = payments.filter(p => p.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase()) || p.number?.toLowerCase().includes(searchTerm.toLowerCase()));
  const stats = {
    total: filteredPayments.reduce((s, p) => s + (p.amount || 0), 0),
    transfer: filteredPayments.filter(p => p.payment_method === 'transfer').reduce((s, p) => s + (p.amount || 0), 0),
    check: filteredPayments.filter(p => p.payment_method === 'check').reduce((s, p) => s + (p.amount || 0), 0)
  };

  if (!currentCompany) return <AppLayout><div className="text-center py-20">Aucune entreprise sélectionnée</div></AppLayout>;

  return (
    <AppLayout>
      <div className="space-y-6" data-testid="supplier-payments-page">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div><h1 className="text-3xl font-bold text-gray-900">Paiements fournisseur</h1><p className="text-gray-500 mt-1">{filteredPayments.length} paiements</p></div>
          <Button className="bg-violet-600 hover:bg-violet-700 text-white" onClick={openCreate} data-testid="create-sp-btn"><Plus className="w-4 h-4 mr-2" /> Enregistrer un paiement</Button>
        </div>

        <Card className="p-4"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" /><Input placeholder="Rechercher..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" /></div></Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-6"><div className="flex items-center gap-3"><div className="p-2 bg-red-100 rounded-lg"><CreditCard className="w-5 h-5 text-red-600" /></div><div><p className="text-sm text-gray-600">Total payé</p><p className="text-2xl font-bold text-red-600">{stats.total.toFixed(2)} TND</p></div></div></Card>
          <Card className="p-6"><div className="flex items-center gap-3"><div className="p-2 bg-blue-100 rounded-lg"><Building2 className="w-5 h-5 text-blue-600" /></div><div><p className="text-sm text-gray-600">Virements</p><p className="text-2xl font-bold text-blue-600">{stats.transfer.toFixed(2)} TND</p></div></div></Card>
          <Card className="p-6"><div className="flex items-center gap-3"><div className="p-2 bg-orange-100 rounded-lg"><Banknote className="w-5 h-5 text-orange-600" /></div><div><p className="text-sm text-gray-600">Chèques</p><p className="text-2xl font-bold text-orange-600">{stats.check.toFixed(2)} TND</p></div></div></Card>
        </div>

        <Card>
          {loading ? (<div className="p-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 mx-auto"></div></div>
          ) : filteredPayments.length === 0 ? (<div className="p-8 text-center"><CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-4" /><p className="text-gray-500">Aucun paiement</p><Button onClick={openCreate} className="mt-4 bg-violet-600 hover:bg-violet-700"><Plus className="w-4 h-4 mr-2" /> Enregistrer</Button></div>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>N° Paiement</TableHead><TableHead>Fournisseur</TableHead><TableHead>Date</TableHead><TableHead>Mode</TableHead><TableHead>Référence</TableHead><TableHead>Montant</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {filteredPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell><div className="flex items-center gap-3"><div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center"><CreditCard className="w-5 h-5 text-red-600" /></div><span className="font-medium">{payment.number}</span></div></TableCell>
                    <TableCell>{payment.supplier_name}</TableCell>
                    <TableCell>{payment.date ? new Date(payment.date).toLocaleDateString('fr-FR') : '-'}</TableCell>
                    <TableCell><Badge className="bg-gray-100 text-gray-800">{getMethodLabel(payment.payment_method)}</Badge></TableCell>
                    <TableCell>{payment.reference || '-'}</TableCell>
                    <TableCell className="font-semibold text-red-600">-{(payment.amount || 0).toFixed(2)} TND</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="sm"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end"><DropdownMenuItem className="text-red-600" onClick={() => handleDelete(payment.id)}><Trash2 className="w-4 h-4 mr-2" /> Supprimer</DropdownMenuItem></DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Enregistrer un paiement fournisseur</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Fournisseur *</Label><Select value={formData.supplier_id} onValueChange={(v) => setFormData({...formData, supplier_id: v})}><SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger><SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.display_name}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Date</Label><Input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Mode de paiement</Label><Select value={formData.payment_method} onValueChange={(v) => setFormData({...formData, payment_method: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="transfer">Virement bancaire</SelectItem><SelectItem value="check">Chèque</SelectItem><SelectItem value="cash">Espèces</SelectItem><SelectItem value="card">Carte</SelectItem></SelectContent></Select></div>
              <div><Label>Référence</Label><Input value={formData.reference} onChange={(e) => setFormData({...formData, reference: e.target.value})} placeholder="N° virement, chèque..." /></div>
            </div>

            {formData.supplier_id && (
              <div>
                <Label className="mb-2 block">Factures à payer</Label>
                {pendingInvoices.length === 0 ? (<p className="text-sm text-gray-500 p-4 bg-gray-50 rounded">Ce fournisseur n'a aucune facture impayée.</p>
                ) : (
                  <div className="border rounded-lg divide-y max-h-60 overflow-y-auto">
                    {pendingInvoices.map((inv, index) => (
                      <div key={inv.id} className="p-3 flex items-center gap-4 hover:bg-gray-50">
                        <Checkbox checked={formData.allocations[index]?.selected} onCheckedChange={() => toggleInvoice(index)} />
                        <div className="flex-1"><p className="font-medium">{inv.number}</p><p className="text-sm text-gray-500">{new Date(inv.date).toLocaleDateString('fr-FR')}</p></div>
                        <div className="text-right"><p className="text-sm text-gray-500">Total: {inv.total.toFixed(2)} TND</p><p className="font-medium text-red-600">Reste: {inv.balance_due.toFixed(2)} TND</p></div>
                        <div className="w-32"><Input type="number" step="0.01" value={formData.allocations[index]?.amount || 0} onChange={(e) => handleAllocationChange(index, parseFloat(e.target.value) || 0)} disabled={!formData.allocations[index]?.selected} /></div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-between items-center bg-red-50 p-4 rounded-lg">
              <div><p className="text-sm text-gray-600">Montant total du paiement</p></div>
              <p className="text-3xl font-bold text-red-600">{formData.amount.toFixed(2)} TND</p>
            </div>

            <div><Label>Remarques</Label><Textarea value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} rows={2} /></div>

            <DialogFooter><Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Annuler</Button><Button type="submit" className="bg-violet-600 hover:bg-violet-700">Enregistrer</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default SupplierPayments;
