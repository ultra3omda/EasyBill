import React, { useState, useEffect } from 'react';
import { useCompany } from '../hooks/useCompany';
import AppLayout from '../components/layout/AppLayout';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Plus, Search, Eye, FileText, Send, RefreshCw } from 'lucide-react';
import { toast } from '../hooks/use-toast';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const Disbursements = () => {
  const { currentCompany } = useCompany();
  const [disbursements, setDisbursements] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, pending: 0, invoiced: 0 });

  useEffect(() => {
    if (currentCompany) loadData();
  }, [currentCompany]);

  const loadData = async () => {
    if (!currentCompany) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      const res = await axios.get(`${API_URL}/api/disbursements/?company_id=${currentCompany.id}`, { headers });
      setDisbursements(res.data.items || res.data || []);
      
      const statsRes = await axios.get(`${API_URL}/api/disbursements/stats?company_id=${currentCompany.id}`, { headers });
      const statsData = statsRes.data || {};
      setStats({
        total: statsData.total || 0,
        pending: statsData.pending || 0,
        invoiced: statsData.invoiced || 0
      });
    } catch (error) {
      console.error('Error loading data:', error);
      toast({ title: "Erreur", description: "Impossible de charger les notes de débours", variant: "destructive" });
      setDisbursements([]);
    } finally {
      setLoading(false);
    }
  };

  const convertToInvoice = async (id) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API_URL}/api/disbursements/${id}/convert-to-invoice?company_id=${currentCompany.id}`, {}, 
        { headers: { Authorization: `Bearer ${token}` } });
      toast({ title: "Succès", description: `Facture ${res.data.invoice_number} créée` });
      loadData();
    } catch (error) {
      toast({ title: "Erreur", description: error.response?.data?.detail || "Erreur", variant: "destructive" });
    }
  };

  const getStatusBadge = (status) => {
    const config = {
      draft: { label: 'Brouillon', variant: 'secondary' },
      pending: { label: 'En attente', variant: 'default' },
      invoiced: { label: 'Facturé', variant: 'success' }
    };
    const s = config[status] || config.draft;
    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  const filteredDisbursements = Array.isArray(disbursements) ? disbursements.filter(d =>
    d.number?.toLowerCase().includes(searchTerm.toLowerCase())
  ) : [];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="page-header-title">Notes de Débours</h1>
            <p className="page-header-subtitle">Gérez les débours client</p>
          </div>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Nouvelle note de débours
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="stat-surface p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total</p>
                <h3 className="mt-1 text-2xl font-bold tracking-[-0.03em] text-slate-900">{stats.total}</h3>
              </div>
              <div className="rounded-2xl bg-violet-100 p-3"><FileText className="w-6 h-6 text-violet-700" /></div>
            </div>
          </Card>
          <Card className="stat-surface p-6">
            <p className="text-sm text-slate-500">En attente</p>
            <h3 className="mt-1 text-2xl font-bold tracking-[-0.03em] text-slate-900">{stats.pending}</h3>
          </Card>
          <Card className="stat-surface p-6">
            <p className="text-sm text-slate-500">Facturés</p>
            <h3 className="mt-1 text-2xl font-bold tracking-[-0.03em] text-slate-900">{stats.invoiced}</h3>
          </Card>
        </div>

        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Liste des notes de débours</h2>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder="Rechercher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64 pl-11"
              />
            </div>
          </div>

          {loading ? (
            <div className="py-8 text-center text-slate-500">Chargement...</div>
          ) : filteredDisbursements.length === 0 ? (
            <div className="py-8 text-center text-slate-500">Aucune note de débours</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numéro</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDisbursements.map((disb) => (
                  <TableRow key={disb.id}>
                    <TableCell className="font-medium text-slate-900">{disb.number}</TableCell>
                    <TableCell>{new Date(disb.date).toLocaleDateString('fr-FR')}</TableCell>
                    <TableCell>{disb.customer_name || '-'}</TableCell>
                    <TableCell>{disb.total?.toFixed(3)} TND</TableCell>
                    <TableCell>{getStatusBadge(disb.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        {disb.status !== 'invoiced' && (
                          <Button size="sm" onClick={() => convertToInvoice(disb.id)}>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Convertir en facture
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

export default Disbursements;