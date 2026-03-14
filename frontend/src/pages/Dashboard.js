import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useCompany } from '../hooks/useCompany';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { PageSkeleton } from '../components/ui/skeleton';
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

const COLORS = ['#2563eb', '#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];

const Dashboard = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { currentCompany, loading: companyLoading } = useCompany();
  const [seeding, setSeeding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (!currentCompany?.id) {
      setLoading(false);
      return;
    }
    fetchStats();
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

  if (companyLoading || loading) {
    return (
      <AppLayout>
        <PageSkeleton cards={4} withSidePanel />
      </AppLayout>
    );
  }

  if (!currentCompany?.id) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-96 gap-4">
          <Database className="w-12 h-12 text-gray-400" />
          <p className="text-gray-600">Aucune entreprise sélectionnée ou disponible.</p>
          <p className="text-sm text-gray-500">Créez une entreprise ou sélectionnez-en une dans le sélecteur.</p>
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
      <div className="page-shell section-stack" data-testid="dashboard">
        {/* Header */}
        <div className="page-header">
          <div>
            <h1 className="page-header-title">
              {t('dashboard.welcome')}, {user?.name?.split(' ')[0]}
            </h1>
            <p className="page-header-subtitle">{currentCompany?.name || 'EasyBill'}</p>
          </div>
          <div className="page-actions">
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

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_340px]">
          <Card className="interactive-lift overflow-hidden border-none bg-[linear-gradient(135deg,#0f172a_0%,#1e3a8a_100%)] p-6 text-white">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_220px]">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-blue-100/70">Pilotage financier</p>
                <p className="mt-3 text-3xl font-bold tracking-[-0.04em]">
                  {formatCurrency((stats?.payments?.received || 0) - (stats?.payments?.sent || 0))}
                </p>
                <p className="mt-2 text-sm text-blue-100/80">
                  Solde net des encaissements et décaissements sur la période visible.
                </p>
                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/6 p-4">
                    <p className="text-xs uppercase tracking-[0.12em] text-blue-100/70">Créances</p>
                    <p className="mt-2 text-lg font-semibold">{formatCurrency(stats?.invoices?.unpaid_amount)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/6 p-4">
                    <p className="text-xs uppercase tracking-[0.12em] text-blue-100/70">DSO</p>
                    <p className="mt-2 text-lg font-semibold">{stats?.summary?.dso || 0} jours</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/6 p-4">
                    <p className="text-xs uppercase tracking-[0.12em] text-blue-100/70">Marge nette</p>
                    <p className="mt-2 text-lg font-semibold">{stats?.summary?.net_margin || 0}%</p>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="rounded-2xl border border-white/10 bg-white/8 p-4">
                  <p className="text-xs uppercase tracking-[0.12em] text-blue-100/70">Rythme commercial</p>
                  <p className="mt-2 text-lg font-semibold">{stats?.quotes?.accepted || 0} devis acceptés</p>
                  <p className="mt-1 text-sm text-blue-100/80">{stats?.quotes?.count || 0} devis au total</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/8 p-4">
                  <p className="text-xs uppercase tracking-[0.12em] text-blue-100/70">Santé du recouvrement</p>
                  <p className="mt-2 text-lg font-semibold">{stats?.invoices?.overdue || 0} facture(s) en retard</p>
                  <p className="mt-1 text-sm text-blue-100/80">{stats?.invoices?.paid || 0} payée(s) sur {stats?.invoices?.count || 0}</p>
                </div>
              </div>
            </div>
          </Card>

          <Card className="app-shell-surface p-5">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-400">À surveiller</p>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">Factures en retard</p>
                <p className="mt-2 text-2xl font-bold tracking-[-0.03em] text-slate-950">{stats?.invoices?.overdue || 0}</p>
                <p className="mt-1 text-sm text-slate-500">Lignes de recouvrement à suivre</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">Stock bas</p>
                <p className="mt-2 text-2xl font-bold tracking-[-0.03em] text-slate-950">{stats?.products?.low_stock || 0}</p>
                <p className="mt-1 text-sm text-slate-500">Articles à réapprovisionner</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">Décaissements</p>
                <p className="mt-2 text-2xl font-bold tracking-[-0.03em] text-slate-950">{formatCurrency(stats?.payments?.sent)}</p>
                <p className="mt-1 text-sm text-slate-500">Sorties de trésorerie</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Top Stats */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {topStats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card key={index} className="stat-surface interactive-lift border-none p-5">
                <div className="flex items-start justify-between mb-2">
                  <div className={`rounded-xl p-2 ${stat.bgColor}`}>
                    <Icon className={`w-5 h-5 ${stat.iconColor}`} />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xl font-bold tracking-[-0.03em] text-slate-900">{stat.value}</p>
                  <p className="text-xs text-slate-600">{stat.label}</p>
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
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {entityStats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card key={index} className="stat-surface interactive-lift border-none p-4">
                <div className="flex items-center gap-2">
                  <div className={`rounded-xl p-2 ${stat.bg}`}>
                    <Icon className={`w-4 h-4 ${stat.color}`} />
                  </div>
                  <div>
                    <p className={`font-bold tracking-[-0.03em] text-slate-900 ${stat.isValue ? 'text-xs' : 'text-base'}`}>{stat.count}</p>
                    <p className="text-[11px] text-slate-600">{stat.label}</p>
                    {stat.new > 0 && <span className="text-xs text-green-600">+{stat.new} ce mois</span>}
                    {stat.alert > 0 && <span className="text-xs text-red-600">{stat.alert} en alerte</span>}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Business Metrics */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {businessMetrics.map((metric, index) => {
            const Icon = metric.icon;
            return (
              <Card key={index} className="stat-surface interactive-lift border-none p-5">
                <div className="flex items-start gap-3">
                  <div className={`rounded-xl p-2 ${metric.bgColor}`}>
                    <Icon className={`w-5 h-5 ${metric.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-600">{metric.label}</p>
                    <p className="mt-0.5 text-base font-bold tracking-[-0.03em] text-slate-900">{metric.amount}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">{metric.subtitle}</p>
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {paymentMetrics.map((metric, index) => (
            <Card key={index} className="stat-surface interactive-lift border-none p-5">
              <div className="space-y-1">
                <p className="text-xs text-slate-600">{metric.label}</p>
                <p className="text-lg font-bold tracking-[-0.03em] text-slate-900">{metric.amount}</p>
                <p className="text-[11px] text-slate-500">{metric.subtitle}</p>
              </div>
            </Card>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Revenue Chart */}
          <Card className="p-5">
            <h3 className="text-base font-semibold text-gray-900 mb-1">Chiffre d'affaires mensuel</h3>
            <p className="mb-4 text-sm text-slate-500">Vue rapide du rythme commercial sur les derniers mois.</p>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats?.charts?.monthly_revenue || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(v) => formatNumber(v)} />
                  <Tooltip formatter={(v) => formatCurrency(v)} />
                  <Bar dataKey="revenue" fill="#2563eb" name="Revenus" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Category Breakdown */}
          <Card className="p-5">
            <h3 className="text-base font-semibold text-gray-900 mb-1">Répartition par catégorie</h3>
            <p className="mb-4 text-sm text-slate-500">Poids relatif des catégories dans le volume traité.</p>
            <div className="h-48">
              {stats?.charts?.categories?.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.charts.categories}
                      cx="50%"
                      cy="50%"
                      outerRadius={64}
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
          <Card className="p-5 bg-amber-50 border-amber-200">
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
