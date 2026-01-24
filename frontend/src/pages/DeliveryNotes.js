import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
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
import { Plus, Search, Truck, Edit, Trash2, MoreVertical, CheckCircle } from 'lucide-react';
import { toast } from '../hooks/use-toast';

const DeliveryNotes = () => {
  const { t } = useLanguage();
  const { currentCompany } = useCompany();
  const [docs, setDocs] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    customer_id: '', date: new Date().toISOString().split('T')[0],
    items: [{ description: '', quantity: 1, unit_price: 0, tax_rate: 0, discount: 0, total: 0 }],
    notes: '', delivery_person: ''
  });

  useEffect(() => {
    if (currentCompany) { loadData(); loadCustomers(); }
  }, [currentCompany]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/delivery-notes/?company_id=${currentCompany.id}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      setDocs(data);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const method = selectedDoc ? 'PUT' : 'POST';
      const url = selectedDoc 
        ? `${process.env.REACT_APP_BACKEND_URL}/api/delivery-notes/${selectedDoc.id}?company_id=${currentCompany.id}`
        : `${process.env.REACT_APP_BACKEND_URL}/api/delivery-notes/?company_id=${currentCompany.id}`;
      
      await fetch(url, {
        method, headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      toast({ title: 'Succès', description: selectedDoc ? 'Bon de livraison modifié' : 'Bon de livraison créé' });
      setModalOpen(false);
      loadData();
    } catch (error) {
      toast({ title: 'Erreur', description: 'Erreur lors de l\'enregistrement', variant: 'destructive' });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer ce bon de livraison ?')) return;
    try {
      await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/delivery-notes/${id}?company_id=${currentCompany.id}`, {
        method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      toast({ title: 'Succès', description: 'Bon de livraison supprimé' });
      loadData();
    } catch (error) {
      toast({ title: 'Erreur', description: 'Erreur lors de la suppression', variant: 'destructive' });
    }
  };

  const handleDeliver = async (id) => {
    try {
      await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/delivery-notes/${id}/deliver?company_id=${currentCompany.id}`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      toast({ title: 'Succès', description: 'Bon de livraison marqué comme livré' });
      loadData();
    } catch (error) {
      toast({ title: 'Erreur', variant: 'destructive' });
    }
  };

  const openCreate = () => { setSelectedDoc(null); setFormData({ customer_id: '', date: new Date().toISOString().split('T')[0], items: [{ description: '', quantity: 1, unit_price: 0, tax_rate: 0, discount: 0, total: 0 }], notes: '', delivery_person: '' }); setModalOpen(true); };
  const openEdit = (doc) => { setSelectedDoc(doc); setFormData({ customer_id: doc.customer_id || '', date: doc.date?.split('T')[0] || '', items: doc.items || [{ description: '', quantity: 1, unit_price: 0, tax_rate: 0, discount: 0, total: 0 }], notes: doc.notes || '', delivery_person: doc.delivery_person || '' }); setModalOpen(true); };

  const getStatusBadge = (status) => {
    const config = { draft: { label: 'Brouillon', className: 'bg-gray-100 text-gray-800' }, delivered: { label: 'Livré', className: 'bg-green-100 text-green-800' }, cancelled: { label: 'Annulé', className: 'bg-red-100 text-red-800' } };
    return config[status] || config.draft;
  };

  const filteredDocs = docs.filter(d => d.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) || d.number?.toLowerCase().includes(searchTerm.toLowerCase()));

  if (!currentCompany) return <AppLayout><div className="text-center py-20">Aucune entreprise sélectionnée</div></AppLayout>;

  return (
    <AppLayout>
      <div className="space-y-6" data-testid="delivery-notes-page">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Bons de livraison</h1>
            <p className="text-gray-500 mt-1">{filteredDocs.length} bons au total</p>
          </div>
          <Button className="bg-violet-600 hover:bg-violet-700 text-white" onClick={openCreate} data-testid="create-delivery-note-btn">
            <Plus className="w-4 h-4 mr-2" /> Créer un bon de livraison
          </Button>
        </div>

        <Card className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input placeholder="Rechercher..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
          </div>
        </Card>

        <Card>
          {loading ? (
            <div className="p-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 mx-auto"></div></div>
          ) : filteredDocs.length === 0 ? (
            <div className="p-8 text-center">
              <Truck className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Aucun bon de livraison</p>
              <Button onClick={openCreate} className="mt-4 bg-violet-600 hover:bg-violet-700"><Plus className="w-4 h-4 mr-2" /> Créer</Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N° BL</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Livreur</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDocs.map((doc) => {
                  const statusConfig = getStatusBadge(doc.status);
                  return (
                    <TableRow key={doc.id}>
                      <TableCell><div className="flex items-center gap-3"><div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center"><Truck className="w-5 h-5 text-violet-600" /></div><span className="font-medium">{doc.number}</span></div></TableCell>
                      <TableCell>{doc.customer_name}</TableCell>
                      <TableCell>{doc.date ? new Date(doc.date).toLocaleDateString('fr-FR') : '-'}</TableCell>
                      <TableCell>{doc.delivery_person || '-'}</TableCell>
                      <TableCell><Badge className={statusConfig.className}>{statusConfig.label}</Badge></TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="sm"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(doc)}><Edit className="w-4 h-4 mr-2" /> Modifier</DropdownMenuItem>
                            {doc.status === 'draft' && <DropdownMenuItem onClick={() => handleDeliver(doc.id)}><CheckCircle className="w-4 h-4 mr-2" /> Marquer livré</DropdownMenuItem>}
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
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{selectedDoc ? 'Modifier' : 'Nouveau'} bon de livraison</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Client *</Label>
                <Select value={formData.customer_id} onValueChange={(v) => setFormData({...formData, customer_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.display_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Date</Label><Input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} /></div>
            </div>
            <div><Label>Livreur</Label><Input value={formData.delivery_person} onChange={(e) => setFormData({...formData, delivery_person: e.target.value})} placeholder="Nom du livreur" /></div>
            <div><Label>Notes</Label><Textarea value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} rows={3} /></div>
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

export default DeliveryNotes;
