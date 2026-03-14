import React, { useState, useEffect } from 'react';
import { useCompany } from '../hooks/useCompany';
import AppLayout from '../components/layout/AppLayout';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Search, Package, AlertTriangle, Warehouse, ArrowDownUp, TrendingDown } from 'lucide-react';
import { toast } from '../hooks/use-toast';

const Inventory = () => {
  const { currentCompany } = useCompany();
  const [stockLevels, setStockLevels] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (currentCompany) { loadData(); loadWarehouses(); } }, [currentCompany]);
  useEffect(() => { if (currentCompany) loadData(); }, [selectedWarehouse]);

  const loadData = async () => {
    setLoading(true);
    try {
      let url = `${process.env.REACT_APP_BACKEND_URL}/api/stock-movements/stock-levels?company_id=${currentCompany.id}`;
      if (selectedWarehouse !== 'all') url += `&warehouse_id=${selectedWarehouse}`;
      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
      setStockLevels(await res.json());
    } catch (error) { toast({ title: 'Erreur', variant: 'destructive' }); }
    finally { setLoading(false); }
  };

  const loadWarehouses = async () => {
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/warehouses/?company_id=${currentCompany.id}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      setWarehouses(await res.json());
    } catch (error) { console.error(error); }
  };

  const filteredLevels = stockLevels.filter(s => 
    s.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.product_sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.warehouse_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    totalProducts: new Set(filteredLevels.map(s => s.product_id)).size,
    totalQuantity: filteredLevels.reduce((s, l) => s + (l.quantity || 0), 0),
    totalValue: filteredLevels.reduce((s, l) => s + (l.total_value || 0), 0),
    lowStock: filteredLevels.filter(l => l.is_low_stock).length
  };

  if (!currentCompany) return <AppLayout><div className="text-center py-20">Aucune entreprise sélectionnée</div></AppLayout>;

  return (
    <AppLayout>
      <div className="space-y-4" data-testid="inventory-page">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div><h1 className="page-header-title">Inventaire</h1><p className="page-header-subtitle">État du stock en temps réel</p></div>
        </div>

        <Card className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1"><Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" /><Input placeholder="Rechercher un produit..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-11" /></div>
            <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Tous les entrepôts" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les entrepôts</SelectItem>
                {warehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="stat-surface p-6"><div className="flex items-center gap-3"><div className="rounded-2xl bg-violet-100 p-3"><Package className="w-5 h-5 text-violet-700" /></div><div><p className="text-sm text-slate-600">Produits</p><p className="text-2xl font-bold tracking-[-0.03em] text-slate-900">{stats.totalProducts}</p></div></div></Card>
          <Card className="stat-surface p-6"><div className="flex items-center gap-3"><div className="rounded-2xl bg-blue-100 p-3"><ArrowDownUp className="w-5 h-5 text-blue-700" /></div><div><p className="text-sm text-slate-600">Quantité totale</p><p className="text-2xl font-bold tracking-[-0.03em] text-slate-900">{stats.totalQuantity.toFixed(0)}</p></div></div></Card>
          <Card className="stat-surface p-6"><div className="flex items-center gap-3"><div className="rounded-2xl bg-green-100 p-3"><TrendingDown className="w-5 h-5 text-green-700" /></div><div><p className="text-sm text-slate-600">Valeur totale</p><p className="text-2xl font-bold tracking-[-0.03em] text-slate-900">{stats.totalValue.toFixed(3)} TND</p></div></div></Card>
          <Card className="stat-surface p-6"><div className="flex items-center gap-3"><div className="rounded-2xl bg-rose-100 p-3"><AlertTriangle className="w-5 h-5 text-rose-700" /></div><div><p className="text-sm text-slate-600">Stock bas</p><p className="text-2xl font-bold tracking-[-0.03em] text-slate-900">{stats.lowStock}</p></div></div></Card>
        </div>

        <Card>
          {loading ? (<div className="p-8 text-center"><div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div></div>
          ) : filteredLevels.length === 0 ? (<div className="p-8 text-center"><Package className="mx-auto mb-4 h-12 w-12 text-slate-300" /><p className="text-slate-500">Aucun stock trouvé</p></div>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Produit</TableHead><TableHead>SKU</TableHead><TableHead>Entrepôt</TableHead><TableHead>Quantité</TableHead><TableHead>Coût unitaire</TableHead><TableHead>Valeur</TableHead><TableHead>Statut</TableHead></TableRow></TableHeader>
              <TableBody>
                {filteredLevels.map((level, idx) => (
                  <TableRow key={idx} className={level.is_low_stock ? 'bg-red-50/80' : ''}>
                    <TableCell><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-100"><Package className="w-5 h-5 text-violet-700" /></div><span className="font-medium text-slate-900">{level.product_name}</span></div></TableCell>
                    <TableCell>{level.product_sku || '-'}</TableCell>
                    <TableCell><div className="flex items-center gap-1"><Warehouse className="w-4 h-4 text-slate-400" />{level.warehouse_name}</div></TableCell>
                    <TableCell className="font-semibold">{level.quantity}</TableCell>
                    <TableCell>{level.unit_cost.toFixed(3)} TND</TableCell>
                    <TableCell className="font-semibold">{level.total_value.toFixed(3)} TND</TableCell>
                    <TableCell>
                      {level.is_low_stock ? (
                        <Badge className="bg-red-100 text-red-800"><AlertTriangle className="w-3 h-3 mr-1" /> Stock bas</Badge>
                      ) : (
                        <Badge className="bg-green-100 text-green-800">Normal</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </AppLayout>
  );
};

export default Inventory;
