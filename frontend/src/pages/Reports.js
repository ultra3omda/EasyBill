import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useCompany } from '../hooks/useCompany';
import { dashboardAPI } from '../services/api';
import AppLayout from '../components/layout/AppLayout';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { Download } from 'lucide-react';

const CHART_COLORS = ['#14b8a6', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

function formatMoney(value, currency = 'TND') {
  if (value == null || isNaN(value)) return '—';
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value) + ' ' + currency;
}

const Reports = () => {
  const { t } = useLanguage();
  const { currentCompany } = useCompany();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const currency = currentCompany?.primary_currency || 'TND';

  useEffect(() => {
    if (!currentCompany?.id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    dashboardAPI
      .getStats(currentCompany.id)
      .then((res) => {
        if (!cancelled) {
          setStats(res.data);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.response?.data?.detail || 'Erreur lors du chargement des rapports.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [currentCompany?.id]);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-violet-600 border-t-transparent" />
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="p-6">
          <p className="text-red-600">{error}</p>
        </div>
      </AppLayout>
    );
  }

  if (!currentCompany) {
    return (
      <AppLayout>
        <div className="p-6">
          <p className="text-gray-600">Sélectionnez une entreprise pour afficher les rapports.</p>
        </div>
      </AppLayout>
    );
  }

  const summary = stats?.summary || {};
  const payments = stats?.payments || {};
  const charts = stats?.charts || {};
  const monthlyRevenue = charts.monthly_revenue || [];
  const categories = charts.categories || [];

  const totalRevenue = summary.total_revenue ?? 0;
  const grossMarginAmount = summary.gross_margin_amount ?? 0;
  const totalSent = payments.sent ?? 0;
  const netProfit = summary.net_profit ?? 0;

  const lineChartData = monthlyRevenue.map((m) => ({
    month: m.month,
    value: m.revenue
  }));

  const categoryTotal = categories.reduce((s, c) => s + (c.value || 0), 0);
  const pieData = categories.map((c, i) => ({
    category: c.name,
    value: categoryTotal > 0 ? Math.round((c.value / categoryTotal) * 1000) / 10 : 0,
    color: CHART_COLORS[i % CHART_COLORS.length]
  }));

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{t('nav.reports')}</h1>
            <p className="text-gray-500 mt-1">Analyses et rapports détaillés</p>
          </div>
          <Button className="bg-violet-600 hover:bg-violet-700 text-white" disabled>
            <Download className="w-4 h-4 mr-2" />
            Exporter rapport
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-6">
            <p className="text-sm text-gray-600 mb-2">Chiffre d&apos;affaires</p>
            <p className="text-2xl font-bold text-gray-900">{formatMoney(totalRevenue, currency)}</p>
            <p className="text-xs text-gray-500 mt-2">Total facturé</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-gray-600 mb-2">Marge brute</p>
            <p className="text-2xl font-bold text-blue-600">{formatMoney(grossMarginAmount, currency)}</p>
            <p className="text-xs text-gray-500 mt-2">
              {summary.gross_margin != null ? `${Number(summary.gross_margin).toFixed(1)} %` : '—'}
            </p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-gray-600 mb-2">Dépenses / Décaissements</p>
            <p className="text-2xl font-bold text-orange-600">{formatMoney(totalSent, currency)}</p>
            <p className="text-xs text-gray-500 mt-2">Paiements envoyés</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-gray-600 mb-2">Bénéfice net (trésorerie)</p>
            <p className="text-2xl font-bold text-green-600">{formatMoney(netProfit, currency)}</p>
            <p className="text-xs text-gray-500 mt-2">Encaissements − Décaissements</p>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Évolution du chiffre d&apos;affaires</h3>
            {lineChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={lineChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} />
                  <Tooltip formatter={(v) => [formatMoney(v, currency), 'CA']} />
                  <Line type="monotone" dataKey="value" stroke="#14b8a6" strokeWidth={3} name="Chiffre d'affaires" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-500">Aucune donnée sur la période</div>
            )}
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Répartition du CA par catégorie</h3>
            {pieData.length > 0 ? (
              <div className="flex items-center justify-between">
                <div className="w-56 h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-3">
                  {pieData.map((category, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded shrink-0" style={{ backgroundColor: category.color }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700 truncate">{category.category}</p>
                      </div>
                      <p className="text-sm font-semibold">{category.value} %</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-500">Aucune donnée par catégorie</div>
            )}
          </Card>
        </div>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Comparaison mensuelle (chiffre d&apos;affaires)</h3>
          {lineChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={lineChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} />
                <Tooltip formatter={(v) => [formatMoney(v, currency), 'CA']} />
                <Bar dataKey="value" fill="#14b8a6" radius={[8, 8, 0, 0]} name="Chiffre d'affaires" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[350px] flex items-center justify-center text-gray-500">Aucune donnée sur la période</div>
          )}
        </Card>
      </div>
    </AppLayout>
  );
};

export default Reports;
