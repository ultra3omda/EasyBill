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
      <div className="space-y-6" data-testid="inventory-page">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div><h1 className="text-3xl font-bold text-gray-900">Inventaire</h1><p className="text-gray-500 mt-1">État du stock en temps réel</p></div>
        </div>

        <Card className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" /><Input placeholder="Rechercher un produit..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" /></div>
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
          <Card className="p-6"><div className="flex items-center gap-3"><div className="p-2 bg-violet-100 rounded-lg"><Package className="w-5 h-5 text-violet-600" /></div><div><p className="text-sm text-gray-600">Produits</p><p className="text-2xl font-bold text-violet-600">{stats.totalProducts}</p></div></div></Card>
          <Card className="p-6"><div className="flex items-center gap-3"><div className="p-2 bg-blue-100 rounded-lg"><ArrowDownUp className="w-5 h-5 text-blue-600" /></div><div><p className="text-sm text-gray-600">Quantité totale</p><p className="text-2xl font-bold text-blue-600">{stats.totalQuantity.toFixed(0)}</p></div></div></Card>
          <Card className="p-6"><div className="flex items-center gap-3"><div className="p-2 bg-green-100 rounded-lg"><TrendingDown className="w-5 h-5 text-green-600" /></div><div><p className="text-sm text-gray-600">Valeur totale</p><p className="text-2xl font-bold text-green-600">{stats.totalValue.toFixed(2)} TND</p></div></div></Card>
          <Card className="p-6"><div className="flex items-center gap-3"><div className="p-2 bg-red-100 rounded-lg"><AlertTriangle className="w-5 h-5 text-red-600" /></div><div><p className="text-sm text-gray-600">Stock bas</p><p className="text-2xl font-bold text-red-600">{stats.lowStock}</p></div></div></Card>
        </div>

        <Card>
          {loading ? (<div className="p-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 mx-auto"></div></div>
          ) : filteredLevels.length === 0 ? (<div className="p-8 text-center"><Package className="w-12 h-12 text-gray-300 mx-auto mb-4" /><p className="text-gray-500">Aucun stock trouvé</p></div>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Produit</TableHead><TableHead>SKU</TableHead><TableHead>Entrepôt</TableHead><TableHead>Quantité</TableHead><TableHead>Coût unitaire</TableHead><TableHead>Valeur</TableHead><TableHead>Statut</TableHead></TableRow></TableHeader>
              <TableBody>
                {filteredLevels.map((level, idx) => (
                  <TableRow key={idx} className={level.is_low_stock ? 'bg-red-50' : ''}>
                    <TableCell><div className="flex items-center gap-3"><div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center"><Package className="w-5 h-5 text-violet-600" /></div><span className="font-medium">{level.product_name}</span></div></TableCell>
                    <TableCell>{level.product_sku || '-'}</TableCell>
                    <TableCell><div className="flex items-center gap-1"><Warehouse className="w-4 h-4 text-gray-400" />{level.warehouse_name}</div></TableCell>
                    <TableCell className="font-semibold">{level.quantity}</TableCell>
                    <TableCell>{level.unit_cost.toFixed(2)} TND</TableCell>
                    <TableCell className="font-semibold">{level.total_value.toFixed(2)} TND</TableCell>
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
