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
import { Checkbox } from '../components/ui/checkbox';
import { Plus, Search, Bell, Edit, Trash2, MoreVertical, Send, CheckCircle, AlertTriangle } from 'lucide-react';
import { toast } from '../hooks/use-toast';

const Reminders = () => {
  const { currentCompany } = useCompany();
  const [reminders, setReminders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [pendingInvoices, setPendingInvoices] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    customer_id: '', date: new Date().toISOString().split('T')[0], invoice_ids: [],
    level: 1, late_fees: 0, message: '', sent_via: 'email'
  });

  useEffect(() => {
    if (currentCompany) { loadData(); loadCustomers(); }
  }, [currentCompany]);

  useEffect(() => {
    if (formData.customer_id) { loadPendingInvoices(formData.customer_id); }
  }, [formData.customer_id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/reminders/?company_id=${currentCompany.id}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      setReminders(await res.json());
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

  const loadPendingInvoices = async (customerId) => {
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/payments/pending-invoices?company_id=${currentCompany.id}&customer_id=${customerId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      setPendingInvoices(await res.json());
    } catch (error) { console.error(error); setPendingInvoices([]); }
  };

  const toggleInvoice = (invoiceId) => {
    const newIds = formData.invoice_ids.includes(invoiceId) 
      ? formData.invoice_ids.filter(id => id !== invoiceId)
      : [...formData.invoice_ids, invoiceId];
    setFormData({...formData, invoice_ids: newIds});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.customer_id) { toast({ title: 'Erreur', description: 'Veuillez sélectionner un client', variant: 'destructive' }); return; }
    
    try {
      const method = selectedDoc ? 'PUT' : 'POST';
      const url = selectedDoc 
        ? `${process.env.REACT_APP_BACKEND_URL}/api/reminders/${selectedDoc.id}?company_id=${currentCompany.id}`
        : `${process.env.REACT_APP_BACKEND_URL}/api/reminders/?company_id=${currentCompany.id}`;
      
      await fetch(url, {
        method, headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      toast({ title: 'Succès', description: selectedDoc ? 'Rappel modifié' : 'Rappel créé' });
      setModalOpen(false);
      loadData();
    } catch (error) {
      toast({ title: 'Erreur', description: 'Erreur lors de l\'enregistrement', variant: 'destructive' });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer ce rappel ?')) return;
    try {
      await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/reminders/${id}?company_id=${currentCompany.id}`, {
        method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      toast({ title: 'Succès', description: 'Rappel supprimé' });
      loadData();
    } catch (error) {
      toast({ title: 'Erreur', variant: 'destructive' });
    }
  };

  const handleSend = async (id) => {
    try {
      await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/reminders/${id}/send?company_id=${currentCompany.id}`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      toast({ title: 'Succès', description: 'Rappel marqué comme envoyé' });
      loadData();
    } catch (error) {
      toast({ title: 'Erreur', variant: 'destructive' });
    }
  };

  const handleResolve = async (id) => {
    try {
      await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/reminders/${id}/resolve?company_id=${currentCompany.id}`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      toast({ title: 'Succès', description: 'Rappel résolu' });
      loadData();
    } catch (error) {
      toast({ title: 'Erreur', variant: 'destructive' });
    }
  };

  const openCreate = () => { 
    setSelectedDoc(null); 
    setFormData({ customer_id: '', date: new Date().toISOString().split('T')[0], invoice_ids: [], level: 1, late_fees: 0, message: '', sent_via: 'email' }); 
    setPendingInvoices([]);
    setModalOpen(true); 
  };

  const openEdit = (doc) => { 
    setSelectedDoc(doc); 
    setFormData({ customer_id: doc.customer_id || '', date: doc.date?.split('T')[0] || '', invoice_ids: doc.invoice_ids || [], level: doc.level || 1, late_fees: doc.late_fees || 0, message: doc.message || '', sent_via: doc.sent_via || 'email' }); 
    setModalOpen(true); 
  };

  const getStatusBadge = (status) => {
    const config = { draft: { label: 'Brouillon', className: 'bg-gray-100 text-gray-800' }, sent: { label: 'Envoyé', className: 'bg-blue-100 text-blue-800' }, acknowledged: { label: 'Accusé', className: 'bg-orange-100 text-orange-800' }, resolved: { label: 'Résolu', className: 'bg-green-100 text-green-800' } };
    return config[status] || config.draft;
  };

  const getLevelBadge = (level) => {
    const config = { 1: { label: 'Relance 1', className: 'bg-yellow-100 text-yellow-800' }, 2: { label: 'Relance 2', className: 'bg-orange-100 text-orange-800' }, 3: { label: 'Relance 3', className: 'bg-red-100 text-red-800' } };
    return config[level] || config[1];
  };

  const filteredReminders = reminders.filter(r => r.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) || r.number?.toLowerCase().includes(searchTerm.toLowerCase()));
  const totalDue = filteredReminders.reduce((s, r) => s + (r.total_due || 0), 0);

  if (!currentCompany) return <AppLayout><div className="text-center py-20">Aucune entreprise sélectionnée</div></AppLayout>;

  return (
    <AppLayout>
      <div className="space-y-6" data-testid="reminders-page">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Rappels de paiement</h1>
            <p className="text-gray-500 mt-1">{filteredReminders.length} rappels</p>
          </div>
          <Button className="bg-violet-600 hover:bg-violet-700 text-white" onClick={openCreate} data-testid="create-reminder-btn">
            <Plus className="w-4 h-4 mr-2" /> Créer un rappel
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
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg"><AlertTriangle className="w-5 h-5 text-red-600" /></div>
              <div><p className="text-sm text-gray-600">Total impayés</p><p className="text-2xl font-bold text-red-600">{totalDue.toFixed(2)} TND</p></div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg"><Bell className="w-5 h-5 text-orange-600" /></div>
              <div><p className="text-sm text-gray-600">Rappels en cours</p><p className="text-2xl font-bold text-orange-600">{filteredReminders.filter(r => r.status !== 'resolved').length}</p></div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg"><CheckCircle className="w-5 h-5 text-green-600" /></div>
              <div><p className="text-sm text-gray-600">Résolus</p><p className="text-2xl font-bold text-green-600">{filteredReminders.filter(r => r.status === 'resolved').length}</p></div>
            </div>
          </Card>
        </div>

        <Card>
          {loading ? (
            <div className="p-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 mx-auto"></div></div>
          ) : filteredReminders.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Aucun rappel</p>
              <Button onClick={openCreate} className="mt-4 bg-violet-600 hover:bg-violet-700"><Plus className="w-4 h-4 mr-2" /> Créer</Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N° Rappel</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Niveau</TableHead>
                  <TableHead>Montant dû</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReminders.map((reminder) => {
                  const statusConfig = getStatusBadge(reminder.status);
                  const levelConfig = getLevelBadge(reminder.level);
                  return (
                    <TableRow key={reminder.id}>
                      <TableCell><div className="flex items-center gap-3"><div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center"><Bell className="w-5 h-5 text-orange-600" /></div><span className="font-medium">{reminder.number}</span></div></TableCell>
                      <TableCell>{reminder.customer_name}</TableCell>
                      <TableCell>{reminder.date ? new Date(reminder.date).toLocaleDateString('fr-FR') : '-'}</TableCell>
                      <TableCell><Badge className={levelConfig.className}>{levelConfig.label}</Badge></TableCell>
                      <TableCell className="font-semibold text-red-600">{(reminder.total_due || 0).toFixed(2)} TND</TableCell>
                      <TableCell><Badge className={statusConfig.className}>{statusConfig.label}</Badge></TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="sm"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(reminder)}><Edit className="w-4 h-4 mr-2" /> Modifier</DropdownMenuItem>
                            {reminder.status === 'draft' && <DropdownMenuItem onClick={() => handleSend(reminder.id)}><Send className="w-4 h-4 mr-2" /> Marquer envoyé</DropdownMenuItem>}
                            {reminder.status !== 'resolved' && <DropdownMenuItem onClick={() => handleResolve(reminder.id)}><CheckCircle className="w-4 h-4 mr-2" /> Résoudre</DropdownMenuItem>}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(reminder.id)}><Trash2 className="w-4 h-4 mr-2" /> Supprimer</DropdownMenuItem>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{selectedDoc ? 'Modifier' : 'Nouveau'} rappel</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Client *</Label>
                <Select value={formData.customer_id} onValueChange={(v) => setFormData({...formData, customer_id: v, invoice_ids: []})}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.display_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Date</Label><Input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Niveau de relance</Label>
                <Select value={String(formData.level)} onValueChange={(v) => setFormData({...formData, level: parseInt(v)})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Relance 1 (Rappel amical)</SelectItem>
                    <SelectItem value="2">Relance 2 (Ferme)</SelectItem>
                    <SelectItem value="3">Relance 3 (Mise en demeure)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Frais de retard (TND)</Label><Input type="number" step="0.01" value={formData.late_fees} onChange={(e) => setFormData({...formData, late_fees: parseFloat(e.target.value) || 0})} /></div>
            </div>

            {formData.customer_id && (
              <div>
                <Label className="mb-2 block">Factures impayées</Label>
                {pendingInvoices.length === 0 ? (
                  <p className="text-sm text-gray-500 p-4 bg-gray-50 rounded">Ce client n'a aucune facture impayée.</p>
                ) : (
                  <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                    {pendingInvoices.map((inv) => (
                      <div key={inv.id} className="p-3 flex items-center gap-4 hover:bg-gray-50">
                        <Checkbox checked={formData.invoice_ids.includes(inv.id)} onCheckedChange={() => toggleInvoice(inv.id)} />
                        <div className="flex-1">
                          <p className="font-medium">{inv.number}</p>
                          <p className="text-sm text-gray-500">{new Date(inv.date).toLocaleDateString('fr-FR')}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-red-600">{inv.balance_due.toFixed(2)} TND</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div>
              <Label>Mode d'envoi</Label>
              <Select value={formData.sent_via} onValueChange={(v) => setFormData({...formData, sent_via: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="mail">Courrier postal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div><Label>Message</Label><Textarea value={formData.message} onChange={(e) => setFormData({...formData, message: e.target.value})} rows={4} placeholder="Message personnalisé pour le client..." /></div>

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

export default Reminders;
