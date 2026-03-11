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
import { Textarea } from '../components/ui/textarea';
import { Switch } from '../components/ui/switch';
import { Plus, Search, Warehouse, Edit, Trash2, MoreVertical, Package, MapPin } from 'lucide-react';
import { toast } from '../hooks/use-toast';

const Warehouses = () => {
  const { currentCompany } = useCompany();
  const [warehouses, setWarehouses] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ name: '', code: '', address: '', city: '', phone: '', manager: '', is_default: false, notes: '' });

  useEffect(() => { if (currentCompany) loadData(); }, [currentCompany]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/warehouses/?company_id=${currentCompany.id}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      setWarehouses(await res.json());
    } catch (error) { toast({ title: 'Erreur', variant: 'destructive' }); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) { toast({ title: 'Erreur', description: 'Le nom est requis', variant: 'destructive' }); return; }
    try {
      const method = selectedWarehouse ? 'PUT' : 'POST';
      const url = selectedWarehouse 
        ? `${process.env.REACT_APP_BACKEND_URL}/api/warehouses/${selectedWarehouse.id}?company_id=${currentCompany.id}`
        : `${process.env.REACT_APP_BACKEND_URL}/api/warehouses/?company_id=${currentCompany.id}`;
      await fetch(url, { method, headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
      toast({ title: 'Succès', description: selectedWarehouse ? 'Entrepôt modifié' : 'Entrepôt créé' });
      setModalOpen(false); loadData();
    } catch (error) { toast({ title: 'Erreur', variant: 'destructive' }); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer cet entrepôt ?')) return;
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/warehouses/${id}?company_id=${currentCompany.id}`, {
        method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) { const data = await res.json(); throw new Error(data.detail); }
      toast({ title: 'Succès' }); loadData();
    } catch (error) { toast({ title: 'Erreur', description: error.message, variant: 'destructive' }); }
  };

  const openCreate = () => { setSelectedWarehouse(null); setFormData({ name: '', code: '', address: '', city: '', phone: '', manager: '', is_default: warehouses.length === 0, notes: '' }); setModalOpen(true); };
  const openEdit = (w) => { setSelectedWarehouse(w); setFormData({ name: w.name || '', code: w.code || '', address: w.address || '', city: w.city || '', phone: w.phone || '', manager: w.manager || '', is_default: w.is_default || warehouses.length === 1, notes: w.notes || '' }); setModalOpen(true); };

  const filteredWarehouses = warehouses.filter(w => w.name?.toLowerCase().includes(searchTerm.toLowerCase()) || w.code?.toLowerCase().includes(searchTerm.toLowerCase()));
  const stats = { total: filteredWarehouses.length, products: filteredWarehouses.reduce((s, w) => s + (w.product_count || 0), 0), value: filteredWarehouses.reduce((s, w) => s + (w.total_value || 0), 0) };

  if (!currentCompany) return <AppLayout><div className="text-center py-20">Aucune entreprise sélectionnée</div></AppLayout>;

  return (
    <AppLayout>
      <div className="space-y-6" data-testid="warehouses-page">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div><h1 className="text-3xl font-bold text-gray-900">Entrepôts</h1><p className="text-gray-500 mt-1">{stats.total} entrepôts</p></div>
          <Button className="bg-violet-600 hover:bg-violet-700 text-white" onClick={openCreate} data-testid="create-warehouse-btn"><Plus className="w-4 h-4 mr-2" /> Nouvel entrepôt</Button>
        </div>

        <Card className="p-4"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" /><Input placeholder="Rechercher..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" /></div></Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-6"><div className="flex items-center gap-3"><div className="p-2 bg-violet-100 rounded-lg"><Warehouse className="w-5 h-5 text-violet-600" /></div><div><p className="text-sm text-gray-600">Entrepôts</p><p className="text-2xl font-bold text-violet-600">{stats.total}</p></div></div></Card>
          <Card className="p-6"><div className="flex items-center gap-3"><div className="p-2 bg-blue-100 rounded-lg"><Package className="w-5 h-5 text-blue-600" /></div><div><p className="text-sm text-gray-600">Produits stockés</p><p className="text-2xl font-bold text-blue-600">{stats.products}</p></div></div></Card>
          <Card className="p-6"><div className="flex items-center gap-3"><div className="p-2 bg-green-100 rounded-lg"><Warehouse className="w-5 h-5 text-green-600" /></div><div><p className="text-sm text-gray-600">Valeur totale</p><p className="text-2xl font-bold text-green-600">{stats.value.toFixed(3)} TND</p></div></div></Card>
        </div>

        <Card>
          {loading ? (<div className="p-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 mx-auto"></div></div>
          ) : filteredWarehouses.length === 0 ? (<div className="p-8 text-center"><Warehouse className="w-12 h-12 text-gray-300 mx-auto mb-4" /><p className="text-gray-500">Aucun entrepôt</p><Button onClick={openCreate} className="mt-4 bg-violet-600 hover:bg-violet-700"><Plus className="w-4 h-4 mr-2" /> Créer</Button></div>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Entrepôt</TableHead><TableHead>Code</TableHead><TableHead>Ville</TableHead><TableHead>Responsable</TableHead><TableHead>Produits</TableHead><TableHead>Valeur</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {filteredWarehouses.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell><div className="flex items-center gap-3"><div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center"><Warehouse className="w-5 h-5 text-violet-600" /></div><div><span className="font-medium">{w.name}</span>{w.is_default && <Badge className="ml-2 bg-green-100 text-green-800">Principal</Badge>}</div></div></TableCell>
                    <TableCell>{w.code}</TableCell>
                    <TableCell><div className="flex items-center gap-1"><MapPin className="w-4 h-4 text-gray-400" />{w.city || '-'}</div></TableCell>
                    <TableCell>{w.manager || '-'}</TableCell>
                    <TableCell>{w.product_count || 0}</TableCell>
                    <TableCell className="font-semibold">{(w.total_value || 0).toFixed(3)} TND</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="sm"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(w)}><Edit className="w-4 h-4 mr-2" /> Modifier</DropdownMenuItem>
                          <DropdownMenuSeparator /><DropdownMenuItem className="text-red-600" onClick={() => handleDelete(w.id)}><Trash2 className="w-4 h-4 mr-2" /> Supprimer</DropdownMenuItem>
                        </DropdownMenuContent>
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
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{selectedWarehouse ? 'Modifier' : 'Nouvel'} entrepôt</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Nom *</Label><Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="Entrepôt principal" /></div>
              <div><Label>Code</Label><Input value={formData.code} onChange={(e) => setFormData({...formData, code: e.target.value})} placeholder="ENT001" /></div>
            </div>
            <div><Label>Adresse</Label><Input value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Ville</Label><Input value={formData.city} onChange={(e) => setFormData({...formData, city: e.target.value})} /></div>
              <div><Label>Téléphone</Label><Input value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} /></div>
            </div>
            <div><Label>Responsable</Label><Input value={formData.manager} onChange={(e) => setFormData({...formData, manager: e.target.value})} /></div>
            <div className="flex items-center gap-2"><Switch checked={formData.is_default} onCheckedChange={(v) => setFormData({...formData, is_default: v})} /><Label>Entrepôt par défaut</Label></div>
            <div><Label>Notes</Label><Textarea value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} rows={2} /></div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Annuler</Button><Button type="submit" className="bg-violet-600 hover:bg-violet-700">{selectedWarehouse ? 'Modifier' : 'Créer'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Warehouses;
