import React, { useState, useEffect } from 'react';
import { useCompany } from '../hooks/useCompany';
import AppLayout from '../components/layout/AppLayout';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Plus, Search, Eye, CheckCircle, FileText, DollarSign } from 'lucide-react';
import { toast } from '../hooks/use-toast';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const WithholdingTaxes = () => {
  const { currentCompany } = useCompany();
  const [taxes, setTaxes] = useState([]);
  const [rates, setRates] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, pending: 0, paid: 0, total_amount: 0 });

  useEffect(() => {
    if (currentCompany) loadData();
  }, [currentCompany]);

  const loadData = async () => {
    if (!currentCompany) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      const res = await axios.get(`${API_URL}/api/withholding-taxes/?company_id=${currentCompany.id}`, { headers });
      setTaxes(res.data.items || res.data || []);
      
      const ratesRes = await axios.get(`${API_URL}/api/withholding-taxes/rates?company_id=${currentCompany.id}`, { headers });
      setRates(ratesRes.data.rates || []);
      
      const statsRes = await axios.get(`${API_URL}/api/withholding-taxes/stats?company_id=${currentCompany.id}`, { headers });
      const statsData = statsRes.data || {};
      setStats({
        total: statsData.total || 0,
        pending: statsData.pending || 0,
        paid: statsData.paid || 0,
        total_amount: statsData.total_amount || 0
      });
    } catch (error) {
      console.error('Error loading data:', error);
      toast({ title: "Erreur", description: "Impossible de charger les retenues à la source", variant: "destructive" });
      setTaxes([]);
      setRates([]);
    } finally {
      setLoading(false);
    }
  };

  const validateTax = async (id) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/api/withholding-taxes/${id}/validate?company_id=${currentCompany.id}`, {}, 
        { headers: { Authorization: `Bearer ${token}` } });
      toast({ title: "Succès", description: "Retenue validée" });
      loadData();
    } catch (error) {
      toast({ title: "Erreur", description: error.response?.data?.detail || "Erreur", variant: "destructive" });
    }
  };

  const getStatusBadge = (status) => {
    const config = {
      draft: { label: 'Brouillon', variant: 'secondary' },
      validated: { label: 'Validée', variant: 'default' },
      declared: { label: 'Déclarée', variant: 'default' },
      paid: { label: 'Payée', variant: 'success' }
    };
    const s = config[status] || config.draft;
    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  const filteredTaxes = Array.isArray(taxes) ? taxes.filter(t =>
    t.reference?.toLowerCase().includes(searchTerm.toLowerCase())
  ) : [];

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Retenues à la Source</h1>
            <p className="text-gray-500 mt-1">Conformité fiscale tunisienne</p>
          </div>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Nouvelle retenue
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total retenues</p>
                <h3 className="text-2xl font-bold mt-1">{stats.total}</h3>
              </div>
              <FileText className="w-8 h-8 text-gray-400" />
            </div>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-gray-500">En attente</p>
            <h3 className="text-2xl font-bold text-orange-600 mt-1">{stats.pending}</h3>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-gray-500">Payées</p>
            <h3 className="text-2xl font-bold text-green-600 mt-1">{stats.paid}</h3>
          </Card>
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Montant total</p>
                <h3 className="text-2xl font-bold text-purple-600 mt-1">{stats.total_amount?.toFixed(3)} TND</h3>
              </div>
              <DollarSign className="w-8 h-8 text-purple-600" />
            </div>
          </Card>
        </div>

        {rates.length > 0 && (
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Taux de retenue à la source (Tunisie)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {rates.map((rate, idx) => (
                <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                  <span className="font-medium">{rate.type}</span>
                  <Badge className="bg-purple-100 text-purple-800">{rate.rate}%</Badge>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Liste des retenues</h2>
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
          ) : filteredTaxes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">Aucune retenue à la source</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Référence</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Taux</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTaxes.map((tax) => (
                  <TableRow key={tax.id}>
                    <TableCell className="font-medium">{tax.reference}</TableCell>
                    <TableCell>{new Date(tax.date).toLocaleDateString('fr-FR')}</TableCell>
                    <TableCell>{tax.tax_type}</TableCell>
                    <TableCell>{tax.rate}%</TableCell>
                    <TableCell>{tax.amount?.toFixed(3)} TND</TableCell>
                    <TableCell>{getStatusBadge(tax.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        {tax.status === 'draft' && (
                          <Button size="sm" onClick={() => validateTax(tax.id)}>
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

export default WithholdingTaxes;