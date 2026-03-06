import React, { useState, useEffect } from 'react';
import { useCompany } from '../hooks/useCompany';
import AppLayout from '../components/layout/AppLayout';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Plus, Search, ArrowDownUp, ArrowDown, ArrowUp, ArrowLeftRight, Package, Warehouse } from 'lucide-react';
import { toast } from '../hooks/use-toast';

const StockMovements = () => {
  const { currentCompany } = useCompany();
  const [movements, setMovements] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ product_id: '', warehouse_id: '', type: 'in', quantity: 1, unit_cost: 0, reason: '', reference: '', destination_warehouse_id: '', notes: '' });

  useEffect(() => { if (currentCompany) { loadData(); loadProducts(); loadWarehouses(); } }, [currentCompany]);

  const loadData = async () => {
    setLoading(true);
    try {
      let url = `${process.env.REACT_APP_BACKEND_URL}/api/stock-movements/?company_id=${currentCompany.id}`;
      if (filterType !== 'all') url += `&type=${filterType}`;
      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
      setMovements(await res.json());
    } catch (error) { toast({ title: 'Erreur', variant: 'destructive' }); }
    finally { setLoading(false); }
  };

  const loadProducts = async () => {
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/products/?company_id=${currentCompany.id}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
      setProducts(await res.json());
    } catch (error) { console.error(error); }
  };

  const loadWarehouses = async () => {
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/warehouses/?company_id=${currentCompany.id}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
      setWarehouses(await res.json());
    } catch (error) { console.error(error); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.product_id || !formData.warehouse_id) { toast({ title: 'Erreur', description: 'Produit et entrepôt requis', variant: 'destructive' }); return; }
    if (formData.type === 'transfer' && !formData.destination_warehouse_id) { toast({ title: 'Erreur', description: 'Entrepôt de destination requis', variant: 'destructive' }); return; }
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/stock-movements/?company_id=${currentCompany.id}`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' }, body: JSON.stringify(formData)
      });
      if (!res.ok) { const data = await res.json(); throw new Error(data.detail); }
      toast({ title: 'Succès', description: 'Mouvement enregistré' });
      setModalOpen(false); loadData();
    } catch (error) { toast({ title: 'Erreur', description: error.message, variant: 'destructive' }); }
  };

  const openCreate = () => { setFormData({ product_id: '', warehouse_id: '', type: 'in', quantity: 1, unit_cost: 0, reason: '', reference: '', destination_warehouse_id: '', notes: '' }); setModalOpen(true); };

  const getTypeConfig = (type) => {
    const config = {
      in: { label: 'Entrée', icon: ArrowDown, className: 'bg-green-100 text-green-800' },
      out: { label: 'Sortie', icon: ArrowUp, className: 'bg-red-100 text-red-800' },
      transfer: { label: 'Transfert', icon: ArrowLeftRight, className: 'bg-blue-100 text-blue-800' },
      adjustment: { label: 'Ajustement', icon: ArrowDownUp, className: 'bg-orange-100 text-orange-800' }
    };
    return config[type] || config.in;
  };

  const filteredMovements = movements.filter(m => 
    m.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    m.warehouse_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.reference?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: filteredMovements.length,
    in: filteredMovements.filter(m => m.type === 'in').reduce((s, m) => s + m.quantity, 0),
    out: filteredMovements.filter(m => m.type === 'out').reduce((s, m) => s + m.quantity, 0),
    transfers: filteredMovements.filter(m => m.type === 'transfer').length
  };

  if (!currentCompany) return <AppLayout><div className="text-center py-20">Aucune entreprise sélectionnée</div></AppLayout>;

  return (
    <AppLayout>
      <div className="space-y-6" data-testid="stock-movements-page">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div><h1 className="text-3xl font-bold text-gray-900">Mouvements de stock</h1><p className="text-gray-500 mt-1">Historique des entrées/sorties</p></div>
          <Button className="bg-violet-600 hover:bg-violet-700 text-white" onClick={openCreate} data-testid="create-movement-btn"><Plus className="w-4 h-4 mr-2" /> Nouveau mouvement</Button>
        </div>

        <Card className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" /><Input placeholder="Rechercher..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" /></div>
            <Select value={filterType} onValueChange={(v) => { setFilterType(v); }}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                <SelectItem value="in">Entrées</SelectItem>
                <SelectItem value="out">Sorties</SelectItem>
                <SelectItem value="transfer">Transferts</SelectItem>
                <SelectItem value="adjustment">Ajustements</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-6"><div className="flex items-center gap-3"><div className="p-2 bg-violet-100 rounded-lg"><ArrowDownUp className="w-5 h-5 text-violet-600" /></div><div><p className="text-sm text-gray-600">Total mouvements</p><p className="text-2xl font-bold text-violet-600">{stats.total}</p></div></div></Card>
          <Card className="p-6"><div className="flex items-center gap-3"><div className="p-2 bg-green-100 rounded-lg"><ArrowDown className="w-5 h-5 text-green-600" /></div><div><p className="text-sm text-gray-600">Entrées</p><p className="text-2xl font-bold text-green-600">+{stats.in}</p></div></div></Card>
          <Card className="p-6"><div className="flex items-center gap-3"><div className="p-2 bg-red-100 rounded-lg"><ArrowUp className="w-5 h-5 text-red-600" /></div><div><p className="text-sm text-gray-600">Sorties</p><p className="text-2xl font-bold text-red-600">-{stats.out}</p></div></div></Card>
          <Card className="p-6"><div className="flex items-center gap-3"><div className="p-2 bg-blue-100 rounded-lg"><ArrowLeftRight className="w-5 h-5 text-blue-600" /></div><div><p className="text-sm text-gray-600">Transferts</p><p className="text-2xl font-bold text-blue-600">{stats.transfers}</p></div></div></Card>
        </div>

        <Card>
          {loading ? (<div className="p-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 mx-auto"></div></div>
          ) : filteredMovements.length === 0 ? (<div className="p-8 text-center"><ArrowDownUp className="w-12 h-12 text-gray-300 mx-auto mb-4" /><p className="text-gray-500">Aucun mouvement</p><Button onClick={openCreate} className="mt-4 bg-violet-600 hover:bg-violet-700"><Plus className="w-4 h-4 mr-2" /> Créer</Button></div>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Produit</TableHead><TableHead>Entrepôt</TableHead><TableHead>Quantité</TableHead><TableHead>Stock avant</TableHead><TableHead>Stock après</TableHead><TableHead>Référence</TableHead></TableRow></TableHeader>
              <TableBody>
                {filteredMovements.map((m) => {
                  const typeConfig = getTypeConfig(m.type);
                  const TypeIcon = typeConfig.icon;
                  return (
                    <TableRow key={m.id}>
                      <TableCell>{m.created_at ? new Date(m.created_at).toLocaleString('fr-FR') : '-'}</TableCell>
                      <TableCell><Badge className={typeConfig.className}><TypeIcon className="w-3 h-3 mr-1" />{typeConfig.label}</Badge></TableCell>
                      <TableCell><div className="flex items-center gap-2"><Package className="w-4 h-4 text-gray-400" />{m.product_name}</div></TableCell>
                      <TableCell><div className="flex items-center gap-1"><Warehouse className="w-4 h-4 text-gray-400" />{m.warehouse_name}{m.type === 'transfer' && m.destination_warehouse_name && <span className="text-gray-400"> → {m.destination_warehouse_name}</span>}</div></TableCell>
                      <TableCell className={`font-semibold ${m.type === 'in' ? 'text-green-600' : m.type === 'out' ? 'text-red-600' : ''}`}>{m.type === 'in' ? '+' : m.type === 'out' ? '-' : ''}{m.quantity}</TableCell>
                      <TableCell>{m.stock_before}</TableCell>
                      <TableCell className="font-semibold">{m.stock_after}</TableCell>
                      <TableCell>{m.reference || m.reason || '-'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nouveau mouvement de stock</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div><Label>Type de mouvement *</Label>
              <Select value={formData.type} onValueChange={(v) => setFormData({...formData, type: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">Entrée (réception)</SelectItem>
                  <SelectItem value="out">Sortie (expédition)</SelectItem>
                  <SelectItem value="transfer">Transfert entre entrepôts</SelectItem>
                  <SelectItem value="adjustment">Ajustement d'inventaire</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Produit *</Label>
              <Select value={formData.product_id} onValueChange={(v) => { const p = products.find(pr => pr.id === v); setFormData({...formData, product_id: v, unit_cost: p?.purchase_price || p?.selling_price || 0}); }}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>{formData.type === 'transfer' ? 'Entrepôt source *' : 'Entrepôt *'}</Label>
              <Select value={formData.warehouse_id} onValueChange={(v) => setFormData({...formData, warehouse_id: v})}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>{warehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {formData.type === 'transfer' && (
              <div><Label>Entrepôt destination *</Label>
                <Select value={formData.destination_warehouse_id} onValueChange={(v) => setFormData({...formData, destination_warehouse_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>{warehouses.filter(w => w.id !== formData.warehouse_id).map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Quantité *</Label><Input type="number" min="1" step="0.01" value={formData.quantity} onChange={(e) => setFormData({...formData, quantity: parseFloat(e.target.value) || 1})} /></div>
              <div><Label>Coût unitaire</Label><Input type="number" step="0.01" value={formData.unit_cost} onChange={(e) => setFormData({...formData, unit_cost: parseFloat(e.target.value) || 0})} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Raison</Label><Input value={formData.reason} onChange={(e) => setFormData({...formData, reason: e.target.value})} placeholder="Achat, Vente, Inventaire..." /></div>
              <div><Label>Référence</Label><Input value={formData.reference} onChange={(e) => setFormData({...formData, reference: e.target.value})} placeholder="N° facture, BC..." /></div>
            </div>
            <div><Label>Notes</Label><Textarea value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} rows={2} /></div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Annuler</Button><Button type="submit" className="bg-violet-600 hover:bg-violet-700">Enregistrer</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default StockMovements;
