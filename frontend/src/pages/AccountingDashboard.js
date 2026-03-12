import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { accountingAPI, companiesAPI } from '../services/api';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  Calculator,
  BookOpen,
  FileText,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  ArrowRight,
  PlusCircle,
  DollarSign,
  Scale,
} from 'lucide-react';

const AccountingDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState(null);
  const [dashboard, setDashboard] = useState(null);

  const COLORS = {
    equity: '#8B5CF6',    // Purple
    asset: '#3B82F6',     // Blue
    liability: '#F97316', // Orange
    expense: '#EF4444',   // Red
    income: '#22C55E',    // Green
  };

  const TYPE_LABELS = {
    equity: 'Capitaux propres',
    asset: 'Actifs',
    liability: 'Passifs',
    expense: 'Charges',
    income: 'Produits',
  };

  useEffect(() => {
    const fetchCompanyId = async () => {
      try {
        const response = await companiesAPI.list();
        if (response.data.length > 0) {
          setCompanyId(response.data[0].id);
        }
      } catch (error) {
        console.error('Error fetching company:', error);
      }
    };
    fetchCompanyId();
  }, []);

  useEffect(() => {
    if (companyId) {
      fetchDashboard();
    }
  }, [companyId]);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const response = await accountingAPI.getDashboard(companyId);
      setDashboard(response.data);
    } catch (error) {
      console.error('Error fetching dashboard:', error);
      toast.error('Erreur lors du chargement du tableau de bord');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('fr-TN', {
      style: 'currency',
      currency: 'TND',
      minimumFractionDigits: 3,
    }).format(value);
  };

  // Prepare chart data
  const pieData = dashboard?.by_type
    ? Object.entries(dashboard.by_type)
        .filter(([_, data]) => data.count > 0)
        .map(([type, data]) => ({
          name: TYPE_LABELS[type],
          value: Math.abs(data.balance),
          type,
          count: data.count,
          color: COLORS[type],
        }))
    : [];

  const barData = dashboard?.classes
    ? dashboard.classes.map((c) => ({
        name: `Classe ${c.code}`,
        fullName: c.name,
        balance: c.balance,
        type: c.type,
        fill: COLORS[c.type],
      }))
    : [];

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-lg">
          <p className="font-semibold">{data.fullName || data.name}</p>
          <p className="text-sm text-slate-600">
            Solde: {formatCurrency(data.balance || data.value)}
          </p>
          {data.count && (
            <p className="text-sm text-slate-600">{data.count} comptes</p>
          )}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex h-64 items-center justify-center">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6" data-testid="accounting-dashboard">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="page-header-title">Tableau de Bord Comptable</h1>
            <p className="page-header-subtitle">Vue d'ensemble de la santé financière</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => navigate('/journal-entries')}
            >
              <FileText className="w-4 h-4 mr-2" />
              Écritures
            </Button>
            <Button onClick={() => navigate('/journal-entries?action=new')}>
              <PlusCircle className="w-4 h-4 mr-2" />
              Nouvelle écriture
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="stat-surface p-5">
            <div className="flex items-center gap-4">
              <div className="rounded-2xl bg-violet-100 p-3">
                <Calculator className="w-6 h-6 text-violet-700" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Écritures comptables</p>
                <p className="text-2xl font-bold tracking-[-0.03em] text-slate-900">
                  {dashboard?.entries?.total || 0}
                </p>
              </div>
            </div>
          </Card>

          <Card className="stat-surface p-5">
            <div className="flex items-center gap-4">
              <div className="rounded-2xl bg-green-100 p-3">
                <TrendingUp className="w-6 h-6 text-green-700" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Total Débits</p>
                <p className="text-2xl font-bold tracking-[-0.03em] text-slate-900">
                  {formatCurrency(dashboard?.entries?.total_debit || 0)}
                </p>
              </div>
            </div>
          </Card>

          <Card className="stat-surface p-5">
            <div className="flex items-center gap-4">
              <div className="rounded-2xl bg-rose-100 p-3">
                <TrendingDown className="w-6 h-6 text-rose-700" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Total Crédits</p>
                <p className="text-2xl font-bold tracking-[-0.03em] text-slate-900">
                  {formatCurrency(dashboard?.entries?.total_credit || 0)}
                </p>
              </div>
            </div>
          </Card>

          <Card className="stat-surface p-5">
            <div className="flex items-center gap-4">
              <div className="rounded-2xl bg-amber-100 p-3">
                <Scale className="w-6 h-6 text-amber-700" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Équilibre</p>
                <p className="text-2xl font-bold tracking-[-0.03em] text-slate-900">
                  {Math.abs(
                    (dashboard?.entries?.total_debit || 0) -
                      (dashboard?.entries?.total_credit || 0)
                  ) < 0.01
                    ? '✓ Équilibré'
                    : '⚠ Déséquilibré'}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pie Chart - Balance by Type */}
          <Card className="p-6">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">Répartition par Type de Compte</h3>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name} (${(percent * 100).toFixed(0)}%)`
                    }
                    labelLine={false}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-slate-500">
                Aucune donnée disponible
              </div>
            )}
            <div className="flex flex-wrap justify-center gap-4 mt-4">
              {pieData.map((entry) => (
                <div key={entry.type} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-sm text-slate-600">{entry.name}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Bar Chart - Balance by Class */}
          <Card className="p-6">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">Soldes par Classe de Compte</h3>
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) =>
                      new Intl.NumberFormat('fr-TN', {
                        notation: 'compact',
                        compactDisplay: 'short',
                      }).format(value)
                    }
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="balance" radius={[4, 4, 0, 0]}>
                    {barData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-slate-500">
                Aucune donnée disponible
              </div>
            )}
          </Card>
        </div>

        {/* Type Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Object.entries(dashboard?.by_type || {}).map(([type, data]) => (
            <Card
              key={type}
              className="stat-surface cursor-pointer p-4 transition-shadow hover:shadow-md"
              onClick={() => navigate(`/chart-of-accounts?type=${type}`)}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: COLORS[type] }}
                />
                <Badge variant="outline" className="text-xs">
                  {data.count} comptes
                </Badge>
              </div>
              <p className="text-sm font-medium text-slate-600">{TYPE_LABELS[type]}</p>
              <p className="text-lg font-bold" style={{ color: COLORS[type] }}>
                {formatCurrency(data.balance)}
              </p>
            </Card>
          ))}
        </div>

        {/* Recent Entries */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Dernières Écritures</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/journal-entries')}
            >
              Voir tout
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
          {dashboard?.recent_entries?.length > 0 ? (
            <div className="space-y-3">
              {dashboard.recent_entries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex cursor-pointer items-center justify-between rounded-2xl bg-slate-50 p-3 hover:bg-slate-100"
                  onClick={() => navigate(`/journal-entries?id=${entry.id}`)}
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-violet-100 p-2">
                      <FileText className="w-4 h-4 text-violet-700" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">
                        {entry.entry_number}
                      </p>
                      <p className="max-w-[300px] truncate text-sm text-slate-500">
                        {entry.description}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-slate-900">
                      {formatCurrency(entry.total_debit)}
                    </p>
                    <Badge
                      className={
                        entry.status === 'posted'
                          ? 'bg-green-100 text-green-800'
                          : entry.status === 'draft'
                          ? 'bg-violet-100 text-violet-800'
                          : 'bg-red-100 text-red-800'
                      }
                    >
                      {entry.status === 'posted'
                        ? 'Validée'
                        : entry.status === 'draft'
                        ? 'Brouillon'
                        : 'Annulée'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-slate-500">
              <Calculator className="mx-auto mb-3 h-12 w-12 text-slate-300" />
              <p>Aucune écriture comptable</p>
              <Button className="mt-4" onClick={() => navigate('/journal-entries?action=new')}>
                <PlusCircle className="w-4 h-4 mr-2" />
                Créer une écriture
              </Button>
            </div>
          )}
        </Card>

        {/* Quick Links */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card
            className="stat-surface cursor-pointer border-l-4 border-l-violet-500 p-4 transition-shadow hover:shadow-md"
            onClick={() => navigate('/chart-of-accounts')}
          >
            <BookOpen className="mb-2 h-6 w-6 text-violet-700" />
            <p className="font-medium">Plan Comptable</p>
            <p className="text-sm text-slate-500">490 comptes</p>
          </Card>
          <Card
            className="stat-surface cursor-pointer border-l-4 border-l-blue-500 p-4 transition-shadow hover:shadow-md"
            onClick={() => navigate('/journal-entries')}
          >
            <FileText className="mb-2 h-6 w-6 text-blue-600" />
            <p className="font-medium">Écritures</p>
            <p className="text-sm text-slate-500">{dashboard?.entries?.total || 0} écritures</p>
          </Card>
          <Card
            className="stat-surface cursor-pointer border-l-4 border-l-green-500 p-4 transition-shadow hover:shadow-md"
            onClick={() => navigate('/general-ledger')}
          >
            <DollarSign className="mb-2 h-6 w-6 text-green-600" />
            <p className="font-medium">Grand Livre</p>
            <p className="text-sm text-slate-500">Par compte</p>
          </Card>
          <Card
            className="stat-surface cursor-pointer border-l-4 border-l-amber-500 p-4 transition-shadow hover:shadow-md"
            onClick={() => navigate('/trial-balance')}
          >
            <Scale className="mb-2 h-6 w-6 text-amber-600" />
            <p className="font-medium">Balance</p>
            <p className="text-sm text-slate-500">Des comptes</p>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default AccountingDashboard;
