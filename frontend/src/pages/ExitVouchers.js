import React, { useState, useEffect } from 'react';
import { useCompany } from '../hooks/useCompany';
import AppLayout from '../components/layout/AppLayout';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Plus, Search, Eye, Edit, Trash2, CheckCircle } from 'lucide-react';
import { toast } from '../hooks/use-toast';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const ExitVouchers = () => {
  const { currentCompany } = useCompany();
  const [vouchers, setVouchers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, validated: 0, pending: 0 });

  useEffect(() => {
    if (currentCompany) loadData();
  }, [currentCompany]);

  const loadData = async () => {
    if (!currentCompany) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      const res = await axios.get(`${API_URL}/api/exit-vouchers/?company_id=${currentCompany.id}`, { headers });
      setVouchers(res.data.items || res.data || []);
      
      const statsRes = await axios.get(`${API_URL}/api/exit-vouchers/stats?company_id=${currentCompany.id}`, { headers });
      const statsData = statsRes.data || {};
      setStats({
        total: statsData.total || 0,
        validated: statsData.validated || 0,
        pending: statsData.pending || 0
      });
    } catch (error) {
      console.error('Error loading data:', error);
      toast({ title: "Erreur", description: "Impossible de charger les bons de sortie", variant: "destructive" });
      setVouchers([]);
    } finally {
      setLoading(false);
    }
  };

  const validateVoucher = async (id) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/api/exit-vouchers/${id}/validate?company_id=${currentCompany.id}`, {}, 
        { headers: { Authorization: `Bearer ${token}` } });
      toast({ title: "Succès", description: "Bon de sortie validé" });
      loadData();
    } catch (error) {
      toast({ title: "Erreur", description: error.response?.data?.detail || "Erreur", variant: "destructive" });
    }
  };

  const getStatusBadge = (status) => {
    const config = {
      draft: { label: 'Brouillon', variant: 'secondary' },
      validated: { label: 'Validé', variant: 'success' },
      cancelled: { label: 'Annulé', variant: 'destructive' }
    };
    const s = config[status] || config.draft;
    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  const filteredVouchers = Array.isArray(vouchers) ? vouchers.filter(v =>
    v.number?.toLowerCase().includes(searchTerm.toLowerCase())
  ) : [];

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Bons de Sortie</h1>
            <p className="text-gray-500 mt-1">Gérez les sorties de stock</p>
          </div>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Nouveau bon de sortie
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-6">
            <p className="text-sm text-gray-500">Total</p>
            <h3 className="text-2xl font-bold mt-1">{stats.total}</h3>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-gray-500">Validés</p>
            <h3 className="text-2xl font-bold text-green-600 mt-1">{stats.validated}</h3>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-gray-500">En attente</p>
            <h3 className="text-2xl font-bold text-orange-600 mt-1">{stats.pending}</h3>
          </Card>
        </div>

        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Liste des bons de sortie</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Rechercher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-64"
              />
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8">Chargement...</div>
          ) : filteredVouchers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">Aucun bon de sortie</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numéro</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Référence</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVouchers.map((voucher) => (
                  <TableRow key={voucher.id}>
                    <TableCell className="font-medium">{voucher.number}</TableCell>
                    <TableCell>{new Date(voucher.date).toLocaleDateString('fr-FR')}</TableCell>
                    <TableCell>{voucher.reference}</TableCell>
                    <TableCell>{getStatusBadge(voucher.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        {voucher.status === 'draft' && (
                          <Button size="sm" onClick={() => validateVoucher(voucher.id)}>
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Valider
                          </Button>
                        )}
                        <Button variant="ghost" size="icon">
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>
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

export default ExitVouchers;