import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCompany } from '../hooks/useCompany';
import AppLayout from '../components/layout/AppLayout';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { ArrowLeft, FileText, CreditCard, TrendingDown, DollarSign, ShoppingCart, Mail, Phone } from 'lucide-react';
import { toast } from '../hooks/use-toast';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { suppliersAPI } from '../services/api';

const SupplierSummary = () => {
  const { supplierId } = useParams();
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (currentCompany && supplierId) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [currentCompany, supplierId]);

  const loadData = async () => {
    if (!currentCompany || !supplierId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await suppliersAPI.getStats(currentCompany.id, supplierId);
      setData(res.data);
    } catch (err) {
      console.error('Error loading supplier stats:', err);
      setError(err.response?.data?.detail || 'Fournisseur non trouvé');
      toast({
        title: "Erreur",
        description: typeof (err.response?.data?.detail) === 'string' ? err.response.data.detail : "Impossible de charger les statistiques fournisseur",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="text-center py-20">Chargement...</div>
      </AppLayout>
    );
  }

  if (!data) {
    return (
      <AppLayout>
        <div className="text-center py-20 space-y-4">
          <p className="text-gray-600">{error || 'Fournisseur non trouvé'}</p>
          <Button variant="outline" onClick={() => navigate('/contacts/suppliers')}>
            Retour aux fournisseurs
          </Button>
        </div>
      </AppLayout>
    );
  }

  const supplier = data.supplier;

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/contacts/suppliers')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{supplier.display_name}</h1>
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                {supplier.email && (
                  <div className="flex items-center gap-1">
                    <Mail className="w-4 h-4" />
                    {supplier.email}
                  </div>
                )}
                {supplier.phone && (
                  <div className="flex items-center gap-1">
                    <Phone className="w-4 h-4" />
                    {supplier.phone}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total achats</p>
                <h3 className="text-2xl font-bold text-orange-600 mt-1">
                  {data.invoices.total.toFixed(3)} TND
                </h3>
                <p className="text-xs text-gray-500 mt-1">{data.invoices.count} factures</p>
              </div>
              <ShoppingCart className="w-8 h-8 text-orange-600" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Payé</p>
                <h3 className="text-2xl font-bold text-green-600 mt-1">
                  {data.invoices.paid.toFixed(3)} TND
                </h3>
                <p className="text-xs text-gray-500 mt-1">{data.payments.count} paiements</p>
              </div>
              <CreditCard className="w-8 h-8 text-green-600" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Impayé</p>
                <h3 className="text-2xl font-bold text-red-600 mt-1">
                  {data.invoices.unpaid.toFixed(3)} TND
                </h3>
              </div>
              <FileText className="w-8 h-8 text-red-600" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Commandes</p>
                <h3 className="text-2xl font-bold text-blue-600 mt-1">
                  {data.purchase_orders.total.toFixed(3)} TND
                </h3>
                <p className="text-xs text-gray-500 mt-1">{data.purchase_orders.count} commandes</p>
              </div>
              <TrendingDown className="w-8 h-8 text-blue-600" />
            </div>
          </Card>
        </div>

        {/* Chart */}
        {data.monthly_expenses && data.monthly_expenses.length > 0 && (
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Évolution des achats (12 derniers mois)</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.monthly_expenses}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="amount" stroke="#f59e0b" strokeWidth={2} name="Achats (TND)" />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* Transactions History */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Historique des transactions</h3>
          <Tabs defaultValue="invoices">
            <TabsList>
              <TabsTrigger value="invoices">Factures ({data.transactions.invoices.length})</TabsTrigger>
              <TabsTrigger value="payments">Paiements ({data.transactions.payments.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="invoices">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Numéro</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.transactions.invoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.number}</TableCell>
                      <TableCell>{new Date(inv.date).toLocaleDateString('fr-FR')}</TableCell>
                      <TableCell>{inv.total.toFixed(3)} TND</TableCell>
                      <TableCell>
                        <Badge>{inv.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="payments">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Référence</TableHead>
                    <TableHead>Montant</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.transactions.payments.map((pay) => (
                    <TableRow key={pay.id}>
                      <TableCell>{new Date(pay.date).toLocaleDateString('fr-FR')}</TableCell>
                      <TableCell>{pay.reference}</TableCell>
                      <TableCell className="font-medium text-green-600">{pay.amount.toFixed(3)} TND</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </AppLayout>
  );
};

export default SupplierSummary;
