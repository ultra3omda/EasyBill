import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCompany } from '../hooks/useCompany';
import AppLayout from '../components/layout/AppLayout';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { ArrowLeft, FileText, CreditCard, TrendingUp, DollarSign, Calendar, Mail, Phone } from 'lucide-react';
import { toast } from '../hooks/use-toast';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const CustomerSummary = () => {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentCompany && customerId) {
      loadData();
    }
  }, [currentCompany, customerId]);

  const loadData = async () => {
    if (!currentCompany || !customerId) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(
        `${API_URL}/api/customers/${customerId}/stats?company_id=${currentCompany.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setData(res.data);
    } catch (error) {
      console.error('Error loading customer stats:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les statistiques client",
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
        <div className="text-center py-20">Client non trouvé</div>
      </AppLayout>
    );
  }

  const customer = data.customer;

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/contacts/customers')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{customer.display_name}</h1>
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                {customer.email && (
                  <div className="flex items-center gap-1">
                    <Mail className="w-4 h-4" />
                    {customer.email}
                  </div>
                )}
                {customer.phone && (
                  <div className="flex items-center gap-1">
                    <Phone className="w-4 h-4" />
                    {customer.phone}
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
                <p className="text-sm text-gray-500">Chiffre d'affaires</p>
                <h3 className="text-2xl font-bold text-purple-600 mt-1">
                  {data.invoices.total.toFixed(2)} TND
                </h3>
                <p className="text-xs text-gray-500 mt-1">{data.invoices.count} factures</p>
              </div>
              <DollarSign className="w-8 h-8 text-purple-600" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Payé</p>
                <h3 className="text-2xl font-bold text-green-600 mt-1">
                  {data.invoices.paid.toFixed(2)} TND
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
                  {data.invoices.unpaid.toFixed(2)} TND
                </h3>
                <p className="text-xs text-gray-500 mt-1">En attente</p>
              </div>
              <FileText className="w-8 h-8 text-red-600" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Devis</p>
                <h3 className="text-2xl font-bold text-blue-600 mt-1">
                  {data.quotes.total.toFixed(2)} TND
                </h3>
                <p className="text-xs text-gray-500 mt-1">{data.quotes.count} devis</p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-600" />
            </div>
          </Card>
        </div>

        {/* Chart */}
        {data.monthly_revenue && data.monthly_revenue.length > 0 && (
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Évolution du chiffre d'affaires (12 derniers mois)</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.monthly_revenue}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="amount" stroke="#7c3aed" strokeWidth={2} name="CA (TND)" />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* Tabs */}
        <Tabs defaultValue="transactions" className="w-full">
          <TabsList>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="contacts">Contacts</TabsTrigger>
            <TabsTrigger value="info">Informations</TabsTrigger>
          </TabsList>

          <TabsContent value="transactions" className="space-y-4">
            {/* Invoices */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Dernières factures</h3>
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
                      <TableCell>{inv.total.toFixed(2)} TND</TableCell>
                      <TableCell>
                        <Badge variant={inv.status === 'paid' ? 'success' : 'secondary'}>
                          {inv.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>

            {/* Payments */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Derniers paiements</h3>
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
                      <TableCell className="font-medium text-green-600">{pay.amount.toFixed(2)} TND</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="contacts">
            <Card className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Contacts</h3>
                <Button size="sm">
                  Ajouter un contact
                </Button>
              </div>
              <div className="space-y-3">
                {/* Contact principal */}
                <div className="p-4 bg-purple-50 rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">{customer.first_name} {customer.last_name}</p>
                      <Badge className="mt-1 bg-purple-100 text-purple-800">Principal</Badge>
                      {customer.email && <p className="text-sm text-gray-600 mt-2">{customer.email}</p>}
                      {customer.phone && <p className="text-sm text-gray-600">{customer.phone}</p>}
                    </div>
                  </div>
                </div>
                
                {/* Contacts secondaires */}
                {customer.contacts && customer.contacts.map((contact, idx) => (
                  <div key={idx} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold">{contact.name}</p>
                        {contact.position && <p className="text-sm text-gray-500">{contact.position}</p>}
                        {contact.email && <p className="text-sm text-gray-600 mt-2">{contact.email}</p>}
                        {contact.phone && <p className="text-sm text-gray-600">{contact.phone}</p>}
                      </div>
                    </div>
                  </div>
                ))}
                
                {(!customer.contacts || customer.contacts.length === 0) && (
                  <p className="text-center text-gray-500 py-8">Aucun contact secondaire</p>
                )}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="info">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Informations</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Type</p>
                  <p className="font-medium">{customer.client_type === 'entreprise' ? 'Entreprise' : 'Particulier'}</p>
                </div>
                {customer.fiscal_id && (
                  <div>
                    <p className="text-sm text-gray-500">N° Fiscal</p>
                    <p className="font-medium">{customer.fiscal_id}</p>
                  </div>
                )}
                {customer.activity && (
                  <div>
                    <p className="text-sm text-gray-500">Activité</p>
                    <p className="font-medium">{customer.activity}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-500">Devise</p>
                  <p className="font-medium">{customer.currency}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Conditions de paiement</p>
                  <p className="font-medium">{customer.payment_terms || 'Immédiat'}</p>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default CustomerSummary;
