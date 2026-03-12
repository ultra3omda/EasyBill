import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useCompany } from '../hooks/useCompany';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import {
  TrendingUp,
  TrendingDown,
  FileText,
  FileInput,
  Truck,
  DollarSign,
  CreditCard,
  AlertCircle,
  Filter,
  Database,
  Loader2,
  Users,
  Package,
  ShoppingCart,
  RefreshCw
} from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import { seedAPI, dashboardAPI } from '../services/api';
import { toast } from '../hooks/use-toast';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';

const COLORS = ['#8b5cf6', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#6366f1'];

const Dashboard = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const [seeding, setSeeding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (currentCompany?.id) {
      fetchStats();
    }
  }, [currentCompany]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const response = await dashboardAPI.getStats(currentCompany.id);
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      toast({ title: 'Erreur', description: 'Impossible de charger les statistiques', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSeedData = async () => {
    if (!currentCompany?.id) {
      toast({ title: 'Erreur', description: 'Aucune entreprise sélectionnée', variant: 'destructive' });
      return;
    }
    
    setSeeding(true);
    try {
      const response = await seedAPI.generateTestData(currentCompany.id);
      const { created } = response.data;
      toast({ 
        title: 'Données créées avec succès!', 
        description: `${created.products} produits, ${created.customers} clients, ${created.suppliers} fournisseurs, ${created.invoices} factures, ${created.quotes} devis`
      });
      fetchStats(); // Refresh stats
    } catch (error) {
      toast({ title: 'Erreur', description: error.response?.data?.detail || 'Erreur lors de la création', variant: 'destructive' });
    } finally {
      setSeeding(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(value || 0) + ' TND';
  };

  const formatNumber = (value) => {
    if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
    if (value >= 1000) return (value / 1000).toFixed(1) + 'k';
    return value?.toFixed(0) || '0';
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
        </div>
      </AppLayout>
    );
  }

  const topStats = [
    {
      label: 'Marge brute',
      value: `${stats?.summary?.gross_margin || 0}%`,
      change: stats?.summary?.gross_margin > 0 ? 5.2 : -2.1,
      bgColor: 'bg-violet-50',
      iconColor: 'text-violet-600',
      icon: TrendingUp
    },
    {
      label: 'Marge nette',
      value: `${stats?.summary?.net_margin || 0}%`,
      change: stats?.summary?.net_margin > 0 ? 3.1 : -1.5,
      bgColor: 'bg-amber-50',
      iconColor: 'text-amber-600',
      icon: TrendingUp
    },
    {
      label: 'DSO (Jours)',
      value: stats?.summary?.dso || 0,
      subtitle: 'Délai moyen de paiement',
      bgColor: 'bg-blue-50',
      iconColor: 'text-blue-600',
      icon: CreditCard
    },
    {
      label: 'Taux de renouvellement',
      value: `${stats?.summary?.renewal_rate || 0}%`,
      change: 2.5,
      bgColor: 'bg-green-50',
      iconColor: 'text-green-600',
      icon: RefreshCw
    }
  ];

  const businessMetrics = [
    {
      label: 'Factures',
      amount: formatCurrency(stats?.invoices?.total),
      subtitle: `${stats?.invoices?.count || 0} factures (${stats?.invoices?.paid || 0} payées)`,
      icon: FileText,
      bgColor: 'bg-green-50',
      iconColor: 'text-green-600',
      details: stats?.invoices?.overdue > 0 ? `${stats.invoices.overdue} en retard` : null
    },
    {
      label: 'Devis',
      amount: formatCurrency(stats?.quotes?.total),
      subtitle: `${stats?.quotes?.count || 0} devis (${stats?.quotes?.accepted || 0} acceptés)`,
      icon: FileInput,
      bgColor: 'bg-yellow-50',
      iconColor: 'text-yellow-600'
    },
    {
      label: 'Achats',
      amount: formatCurrency(stats?.purchases?.total),
      subtitle: 'Total commandes',
      icon: ShoppingCart,
      bgColor: 'bg-orange-50',
      iconColor: 'text-orange-600'
    }
  ];

  const paymentMetrics = [
    {
      label: 'Paiements reçus',
      amount: formatCurrency(stats?.payments?.received),
      subtitle: 'Encaissements',
      bgColor: 'bg-green-50',
      iconColor: 'text-green-600'
    },
    {
      label: 'Paiements envoyés',
      amount: formatCurrency(stats?.payments?.sent),
      subtitle: 'Décaissements',
      bgColor: 'bg-red-50',
      iconColor: 'text-red-600'
    },
    {
      label: 'Solde créances',
      amount: formatCurrency(stats?.invoices?.unpaid_amount),
      subtitle: 'Montant impayé',
      bgColor: stats?.invoices?.unpaid_amount > 0 ? 'bg-amber-50' : 'bg-gray-50',
      iconColor: stats?.invoices?.unpaid_amount > 0 ? 'text-amber-600' : 'text-gray-600'
    }
  ];

  const entityStats = [
    { label: 'Clients', count: stats?.customers?.count || 0, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', new: stats?.customers?.new_this_month },
    { label: 'Fournisseurs', count: stats?.suppliers?.count || 0, icon: Truck, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Articles', count: stats?.products?.count || 0, icon: Package, color: 'text-green-600', bg: 'bg-green-50', alert: stats?.products?.low_stock },
    { label: 'Valeur Stock', count: formatCurrency(stats?.products?.stock_value), icon: DollarSign, color: 'text-amber-600', bg: 'bg-amber-50', isValue: true }
  ];

  return (
    <AppLayout>
      <div className="space-y-6" data-testid="dashboard">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="page-header-title">
              {t('dashboard.welcome')}, {user?.name?.split(' ')[0]}
            </h1>
            <p className="page-header-subtitle">{currentCompany?.name || 'EasyBill'}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              onClick={fetchStats}
              variant="outline"
              className="flex items-center gap-2"
              data-testid="refresh-btn"
            >
              <RefreshCw className="w-4 h-4" />
              Actualiser
            </Button>
            <Button 
              onClick={handleSeedData}
              disabled={seeding}
              variant="outline"
              className="flex items-center gap-2"
              data-testid="seed-data-btn"
            >
              {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
              {seeding ? 'Création...' : 'Générer données test'}
            </Button>
          </div>
        </div>

        {/* Top Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {topStats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card key={index} className="stat-surface border-none p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className={`rounded-2xl p-3 ${stat.bgColor}`}>
                    <Icon className={`w-6 h-6 ${stat.iconColor}`} />
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-2xl font-bold tracking-[-0.03em] text-slate-900">{stat.value}</p>
                  <p className="text-sm text-slate-600">{stat.label}</p>
                  {stat.change !== undefined && (
                    <div className="flex items-center gap-1 text-xs">
                      {stat.change > 0 ? (
                        <TrendingUp className="w-3 h-3 text-green-600" />
                      ) : (
                        <TrendingDown className="w-3 h-3 text-red-600" />
                      )}
                      <span className={stat.change > 0 ? 'text-green-600' : 'text-red-600'}>
                        {Math.abs(stat.change)}%
                      </span>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        {/* Entity Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {entityStats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card key={index} className="stat-surface border-none p-4">
                <div className="flex items-center gap-3">
                  <div className={`rounded-2xl p-2.5 ${stat.bg}`}>
                    <Icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                  <div>
                    <p className={`font-bold tracking-[-0.03em] text-slate-900 ${stat.isValue ? 'text-sm' : 'text-lg'}`}>{stat.count}</p>
                    <p className="text-xs text-slate-600">{stat.label}</p>
                    {stat.new > 0 && <span className="text-xs text-green-600">+{stat.new} ce mois</span>}
                    {stat.alert > 0 && <span className="text-xs text-red-600">{stat.alert} en alerte</span>}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Business Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {businessMetrics.map((metric, index) => {
            const Icon = metric.icon;
            return (
              <Card key={index} className="stat-surface border-none p-6">
                <div className="flex items-start gap-4">
                  <div className={`rounded-2xl p-3 ${metric.bgColor}`}>
                    <Icon className={`w-6 h-6 ${metric.iconColor}`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-slate-600">{metric.label}</p>
                    <p className="mt-1 text-xl font-bold tracking-[-0.03em] text-slate-900">{metric.amount}</p>
                    <p className="mt-1 text-xs text-slate-500">{metric.subtitle}</p>
                    {metric.details && (
                      <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {metric.details}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Payment Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {paymentMetrics.map((metric, index) => (
            <Card key={index} className="stat-surface border-none p-6">
              <div className="space-y-2">
                <p className="text-sm text-slate-600">{metric.label}</p>
                <p className="text-xl font-bold tracking-[-0.03em] text-slate-900">{metric.amount}</p>
                <p className="text-xs text-slate-500">{metric.subtitle}</p>
              </div>
            </Card>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue Chart */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Chiffre d'affaires mensuel</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats?.charts?.monthly_revenue || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(v) => formatNumber(v)} />
                  <Tooltip formatter={(v) => formatCurrency(v)} />
                  <Bar dataKey="revenue" fill="#8b5cf6" name="Revenus" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Category Breakdown */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Répartition par catégorie</h3>
            <div className="h-64">
              {stats?.charts?.categories?.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.charts.categories}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {stats.charts.categories.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">
                  Aucune donnée de vente
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Alerts */}
        {(stats?.products?.low_stock > 0 || stats?.invoices?.overdue > 0) && (
          <Card className="p-6 bg-amber-50 border-amber-200">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0" />
              <div>
                <h3 className="text-lg font-semibold text-amber-800">Alertes</h3>
                <ul className="mt-2 space-y-1 text-sm text-amber-700">
                  {stats?.products?.low_stock > 0 && (
                    <li>• {stats.products.low_stock} article(s) en stock bas</li>
                  )}
                  {stats?.invoices?.overdue > 0 && (
                    <li>• {stats.invoices.overdue} facture(s) en retard de paiement</li>
                  )}
                </ul>
              </div>
            </div>
          </Card>
        )}
      </div>
    </AppLayout>
  );
};

export default Dashboard;
