import React, { useState, useEffect } from 'react';
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
import { 
  Plus, Search, CreditCard, Trash2, MoreVertical, Banknote, Building2, Wallet, 
  Eye, Edit, FileText, Download, TrendingUp, TrendingDown, Calendar, Filter,
  ChevronDown, Receipt, DollarSign, Percent, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { toast } from '../hooks/use-toast';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Espèces', icon: Banknote, color: '#22c55e' },
  { value: 'check', label: 'Chèque', icon: FileText, color: '#3b82f6' },
  { value: 'bank_transfer', label: 'Virement', icon: Building2, color: '#8b5cf6' },
  { value: 'card', label: 'Carte', icon: CreditCard, color: '#f59e0b' },
  { value: 'other', label: 'Autre', icon: Wallet, color: '#6b7280' },
];

const Payments = () => {
  const { currentCompany } = useCompany();
  const [payments, setPayments] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [pendingInvoices, setPendingInvoices] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedPayments, setSelectedPayments] = useState([]);
  const [stats, setStats] = useState({ byMethod: [], yearComparison: { current: 0, previous: 0, change: 0 } });
  
  const [formData, setFormData] = useState({
    customer_id: '',
    invoice_id: '',
    date: new Date().toISOString().split('T')[0],
    amount: 0,
    payment_method: 'cash',
    reference: '',
    notes: ''
  });

  useEffect(() => {
    if (currentCompany) {
      loadData();
      loadCustomers();
    }
  }, [currentCompany]);

  useEffect(() => {
    if (formData.customer_id) {
      loadPendingInvoices(formData.customer_id);
    }
  }, [formData.customer_id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/payments/?company_id=${currentCompany.id}&type=received`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      setPayments(data);
      calculateStats(data);
    } catch (error) {
      toast({ title: 'Erreur', description: 'Impossible de charger les paiements', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (paymentsData) => {
    // Stats by payment method
    const byMethod = PAYMENT_METHODS.map(method => {
      const methodPayments = paymentsData.filter(p => p.payment_method === method.value);
      const total = methodPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
      return {
        method: method.value,
        label: method.label,
        total,
        count: methodPayments.length,
        color: method.color
      };
    }).filter(m => m.total > 0);

    // Year comparison
    const currentYear = new Date().getFullYear();
    const currentYearTotal = paymentsData
      .filter(p => new Date(p.date).getFullYear() === currentYear)
      .reduce((sum, p) => sum + (p.amount || 0), 0);
    const previousYearTotal = paymentsData
      .filter(p => new Date(p.date).getFullYear() === currentYear - 1)
      .reduce((sum, p) => sum + (p.amount || 0), 0);
    
    const change = previousYearTotal > 0 
      ? ((currentYearTotal - previousYearTotal) / previousYearTotal * 100).toFixed(1)
      : 0;

    setStats({
      byMethod,
      yearComparison: {
        current: currentYearTotal,
        previous: previousYearTotal,
        change: parseFloat(change)
      }
    });
  };

  const loadCustomers = async () => {
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/customers/?company_id=${currentCompany.id}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      setCustomers(await res.json());
    } catch (error) {
      console.error(error);
    }
  };

  const loadPendingInvoices = async (customerId) => {
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/invoices/?company_id=${currentCompany.id}&customer_id=${customerId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const invoices = await res.json();
      // Filter invoices with remaining balance
      setPendingInvoices(invoices.filter(inv => 
        inv.status !== 'paid' && (inv.total - (inv.amount_paid || 0)) > 0
      ));
    } catch (error) {
      console.error(error);
      setPendingInvoices([]);
    }
  };

  const handleSubmit = async () => {
    if (!formData.customer_id || formData.amount <= 0) {
      toast({ title: 'Erreur', description: 'Veuillez remplir tous les champs requis', variant: 'destructive' });
      return;
    }

    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/payments/?company_id=${currentCompany.id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          type: 'received'
        })
      });

      if (res.ok) {
        toast({ title: 'Succès', description: 'Paiement enregistré' });
        setModalOpen(false);
        resetForm();
        loadData();
      } else {
        throw new Error('Erreur lors de l\'enregistrement');
      }
    } catch (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer ce paiement ?')) return;
    try {
      await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/payments/${id}?company_id=${currentCompany.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      toast({ title: 'Succès', description: 'Paiement supprimé' });
      loadData();
    } catch (error) {
      toast({ title: 'Erreur', description: 'Impossible de supprimer', variant: 'destructive' });
    }
  };

  const resetForm = () => {
    setFormData({
      customer_id: '',
      invoice_id: '',
      date: new Date().toISOString().split('T')[0],
      amount: 0,
      payment_method: 'cash',
      reference: '',
      notes: ''
    });
    setPendingInvoices([]);
  };

  const toggleSelectAll = () => {
    if (selectedPayments.length === filteredPayments.length) {
      setSelectedPayments([]);
    } else {
      setSelectedPayments(filteredPayments.map(p => p.id));
    }
  };

  const toggleSelectPayment = (id) => {
    setSelectedPayments(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('fr-TN', { minimumFractionDigits: 3 }).format(value || 0) + ' TND';
  };

  const getMethodInfo = (method) => {
    return PAYMENT_METHODS.find(m => m.value === method) || PAYMENT_METHODS[4];
  };

  const filteredPayments = payments.filter(p =>
    p.payment_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.reference?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalAmount = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

  return (
    <AppLayout>
      <div className="space-y-6 p-6" data-testid="payments-page">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Paiements reçus</h1>
            <p className="text-gray-500">{payments.length} paiements • {formatCurrency(totalAmount)}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline">
              <Search className="w-4 h-4 mr-2" />
              Recherche avoirs
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  Action
                  <ChevronDown className="w-4 h-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem>
                  <Download className="w-4 h-4 mr-2" />
                  Exporter
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <FileText className="w-4 h-4 mr-2" />
                  Générer rapport
                </DropdownMenuItem>
                {selectedPayments.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-red-600">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Supprimer ({selectedPayments.length})
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button className="bg-violet-600 hover:bg-violet-700" onClick={() => setModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Nouveau paiement
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Payment Methods Stats */}
          <Card className="p-6 col-span-2">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-violet-600" />
              Répartition par mode de paiement
            </h3>
            {stats.byMethod.length > 0 ? (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.byMethod} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} />
                    <YAxis type="category" dataKey="label" width={80} />
                    <Tooltip 
                      formatter={(value) => formatCurrency(value)}
                      labelFormatter={(label) => `Mode: ${label}`}
                    />
                    <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                      {stats.byMethod.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-400">
                Aucune donnée de paiement
              </div>
            )}
            
            {/* Method Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
              {PAYMENT_METHODS.slice(0, 4).map(method => {
                const data = stats.byMethod.find(m => m.method === method.value);
                const Icon = method.icon;
                return (
                  <div key={method.value} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50">
                    <div className="p-2 rounded-lg" style={{ backgroundColor: `${method.color}20` }}>
                      <Icon className="w-4 h-4" style={{ color: method.color }} />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">{method.label}</p>
                      <p className="font-semibold text-sm">{data ? formatCurrency(data.total) : '0.000 TND'}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Year Comparison */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              Comparaison annuelle
            </h3>
            <div className="space-y-4">
              <div className="p-4 bg-violet-50 rounded-lg">
                <p className="text-sm text-gray-600">Cette année</p>
                <p className="text-2xl font-bold text-violet-600">{formatCurrency(stats.yearComparison.current)}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Année précédente</p>
                <p className="text-xl font-semibold text-gray-700">{formatCurrency(stats.yearComparison.previous)}</p>
              </div>
              <div className={`flex items-center gap-2 p-3 rounded-lg ${stats.yearComparison.change >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                {stats.yearComparison.change >= 0 ? (
                  <ArrowUpRight className="w-5 h-5 text-green-600" />
                ) : (
                  <ArrowDownRight className="w-5 h-5 text-red-600" />
                )}
                <span className={`font-semibold ${stats.yearComparison.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {stats.yearComparison.change >= 0 ? '+' : ''}{stats.yearComparison.change}%
                </span>
                <span className="text-sm text-gray-600">vs année précédente</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Search & Filters */}
        <Card className="p-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Rechercher par N°, client, référence..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline">
              <Filter className="w-4 h-4 mr-2" />
              Filtres
            </Button>
            <Button variant="outline">
              <Calendar className="w-4 h-4 mr-2" />
              Période
            </Button>
          </div>
        </Card>

        {/* Payments Table */}
        <Card>
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="w-12">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300"
                    checked={selectedPayments.length === filteredPayments.length && filteredPayments.length > 0}
                    onChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>N°</TableHead>
                <TableHead>Ventes</TableHead>
                <TableHead>Notes de débours</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead className="text-right">Montant payé</TableHead>
                <TableHead className="w-20">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    Chargement...
                  </TableCell>
                </TableRow>
              ) : filteredPayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-gray-400">
                    Aucun paiement trouvé
                  </TableCell>
                </TableRow>
              ) : (
                filteredPayments.map((payment) => {
                  const methodInfo = getMethodInfo(payment.payment_method);
                  const MethodIcon = methodInfo.icon;
                  return (
                    <TableRow key={payment.id} className="hover:bg-gray-50">
                      <TableCell>
                        <input
                          type="checkbox"
                          className="rounded border-gray-300"
                          checked={selectedPayments.includes(payment.id)}
                          onChange={() => toggleSelectPayment(payment.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <span className="font-medium text-violet-600">{payment.payment_number}</span>
                      </TableCell>
                      <TableCell>
                        {payment.invoice_number ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            {payment.invoice_number}
                          </Badge>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-gray-400">-</span>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{payment.customer_name || 'N/A'}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {new Date(payment.date).toLocaleDateString('fr-FR')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="p-1 rounded" style={{ backgroundColor: `${methodInfo.color}20` }}>
                            <MethodIcon className="w-3 h-3" style={{ color: methodInfo.color }} />
                          </div>
                          <span className="text-sm">{methodInfo.label}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-green-600">
                        {formatCurrency(payment.amount)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Eye className="w-4 h-4 mr-2" />
                              Voir
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Edit className="w-4 h-4 mr-2" />
                              Modifier
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Download className="w-4 h-4 mr-2" />
                              Télécharger reçu
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-red-600"
                              onClick={() => handleDelete(payment.id)}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Supprimer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Card>

        {/* New Payment Modal */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-violet-600" />
                Nouveau paiement
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Client *</Label>
                  <Select
                    value={formData.customer_id}
                    onValueChange={(v) => setFormData({ ...formData, customer_id: v })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Sélectionner un client" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Date *</Label>
                  <Input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>

              {pendingInvoices.length > 0 && (
                <div>
                  <Label>Facture à régler</Label>
                  <Select
                    value={formData.invoice_id}
                    onValueChange={(v) => {
                      const inv = pendingInvoices.find(i => i.id === v);
                      setFormData({ 
                        ...formData, 
                        invoice_id: v,
                        amount: inv ? (inv.total - (inv.amount_paid || 0)) : 0
                      });
                    }}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Sélectionner une facture (optionnel)" />
                    </SelectTrigger>
                    <SelectContent>
                      {pendingInvoices.map((inv) => (
                        <SelectItem key={inv.id} value={inv.id}>
                          {inv.invoice_number || inv.number} - Solde: {formatCurrency(inv.total - (inv.amount_paid || 0))}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Montant *</Label>
                  <div className="relative mt-1">
                    <Input
                      type="number"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                      step="0.001"
                      min="0"
                      className="pr-16"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">TND</span>
                  </div>
                </div>

                <div>
                  <Label>Mode de paiement *</Label>
                  <Select
                    value={formData.payment_method}
                    onValueChange={(v) => setFormData({ ...formData, payment_method: v })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((method) => (
                        <SelectItem key={method.value} value={method.value}>
                          <div className="flex items-center gap-2">
                            <method.icon className="w-4 h-4" style={{ color: method.color }} />
                            {method.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Référence</Label>
                <Input
                  value={formData.reference}
                  onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                  placeholder="N° chèque, référence virement..."
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Notes additionnelles..."
                  className="mt-1"
                  rows={2}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => { setModalOpen(false); resetForm(); }}>
                Annuler
              </Button>
              <Button className="bg-violet-600 hover:bg-violet-700" onClick={handleSubmit}>
                <Plus className="w-4 h-4 mr-2" />
                Enregistrer le paiement
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default Payments;
