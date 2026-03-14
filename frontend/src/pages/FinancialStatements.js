import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import { companiesAPI } from '../services/api';
import {
  FileBarChart, Scale, TrendingUp, Activity, BookOpen, Calendar,
  RefreshCw, ArrowRight, Banknote, Users, Building2, CheckCircle, AlertCircle
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;
const token = () => localStorage.getItem('token');
const fmt = n => Number(n || 0).toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

const STATEMENTS = [
  {
    key: 'bilan',
    label: 'Bilan',
    description: 'Situation patrimoniale — Actif et Passif',
    path: '/bilan',
    icon: Scale,
    color: 'text-violet-600',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
  },
  {
    key: 'income',
    label: 'État de résultat',
    description: 'Produits, charges et résultat net',
    path: '/income-statement',
    icon: TrendingUp,
    color: 'text-green-600',
    bg: 'bg-green-50',
    border: 'border-green-200',
  },
  {
    key: 'cashflow',
    label: 'Flux de trésorerie',
    description: 'Exploitation, investissement et financement',
    path: '/cash-flow',
    icon: Activity,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
  },
  {
    key: 'journals',
    label: 'Journaux légaux',
    description: 'Ventes, achats, caisse, banque et OD',
    path: '/legal-journals',
    icon: BookOpen,
    color: 'text-indigo-600',
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
  },
  {
    key: 'fiscal',
    label: 'Exercices comptables',
    description: 'Gestion et clôture des exercices',
    path: '/fiscal-years',
    icon: Calendar,
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
  },
];

export default function FinancialStatements() {
  const navigate = useNavigate();
  const [companyId, setCompanyId] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    companiesAPI.list().then(r => {
      if (r.data?.length) setCompanyId(r.data[0].id);
    });
  }, []);

  const fetchOverview = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ company_id: companyId });
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      const res = await fetch(`${API}/api/financial-statements/overview?${params}`, {
        headers: { Authorization: `Bearer ${token()}` }
      });
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      toast.error('Erreur lors du chargement des états financiers');
    } finally {
      setLoading(false);
    }
  }, [companyId, dateFrom, dateTo]);

  useEffect(() => { fetchOverview(); }, [fetchOverview]);

  const kpis = data?.kpis || {};

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-header-title flex items-center gap-2">
              <FileBarChart className="w-6 h-6 text-violet-700" />
              États financiers
            </h1>
            <p className="page-header-subtitle">
              Vue consolidée — Bilan · Résultat · Flux de trésorerie
            </p>
          </div>
          <Button onClick={fetchOverview} variant="outline" size="sm" className="gap-1.5" disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Actualiser
          </Button>
        </div>

        {/* Period filter */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  <Calendar className="w-3.5 h-3.5 inline mr-1" />Période du
                </label>
                <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-40" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">au</label>
                <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-40" />
              </div>
              <Button onClick={fetchOverview}>
                Appliquer
              </Button>
              {(dateFrom || dateTo) && (
                <Button variant="outline" onClick={() => { setDateFrom(''); setDateTo(''); }}>
                  Réinitialiser
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Result indicator */}
        {data && (
          <div className={`flex items-center gap-4 rounded-2xl border-2 p-5 ${
            kpis.benefice ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'
          }`}>
            {kpis.benefice
              ? <CheckCircle className="w-8 h-8 text-green-600 shrink-0" />
              : <AlertCircle className="w-8 h-8 text-red-600 shrink-0" />}
            <div className="flex-1">
              <p className={`text-xl font-bold ${kpis.benefice ? 'text-green-700' : 'text-red-700'}`}>
                {kpis.benefice ? 'Résultat bénéficiaire' : 'Résultat déficitaire'} :
                {kpis.net_result >= 0 ? ' +' : ' '}{fmt(kpis.net_result)} TND
              </p>
              <p className="text-sm text-slate-500">
                {kpis.total_entries} écriture(s) comptable(s) dans la période
              </p>
            </div>
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: 'Total Produits', value: kpis.total_income, icon: TrendingUp, color: 'text-green-600' },
            { label: 'Total Charges', value: kpis.total_expenses, icon: TrendingUp, color: 'text-red-600' },
            { label: 'Résultat net', value: kpis.net_result, icon: FileBarChart, color: kpis.benefice ? 'text-green-600' : 'text-red-600' },
            { label: 'Trésorerie', value: kpis.treasury, icon: Banknote, color: 'text-violet-600' },
            { label: 'Créances clients', value: kpis.clients_balance, icon: Users, color: 'text-blue-600' },
            { label: 'Dettes fournisseurs', value: kpis.suppliers_balance, icon: Building2, color: 'text-orange-600' },
          ].map(kpi => (
            <Card key={kpi.label} className="stat-surface">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                </div>
                <p className={`text-lg font-bold ${kpi.color}`}>{fmt(kpi.value)}</p>
                <p className="mt-0.5 text-xs text-slate-500">{kpi.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Navigation cards */}
        <div>
          <h2 className="mb-4 text-base font-semibold text-slate-700">Accéder aux états détaillés</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {STATEMENTS.map(stmt => {
              const Icon = stmt.icon;
              return (
                <button
                  key={stmt.key}
                  onClick={() => navigate(stmt.path)}
                  className={`group rounded-2xl border-2 p-5 text-left transition-all hover:shadow-md ${stmt.border} ${stmt.bg}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="rounded-2xl bg-white p-2.5 shadow-sm">
                      <Icon className={`w-5 h-5 ${stmt.color}`} />
                    </div>
                    <ArrowRight className={`w-4 h-4 ${stmt.color} opacity-0 group-hover:opacity-100 transition-opacity`} />
                  </div>
                  <p className="font-semibold text-slate-900">{stmt.label}</p>
                  <p className="mt-1 text-sm text-slate-500">{stmt.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* By journal type summary */}
        {data?.by_journal_type?.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-violet-700" />
                Répartition par type de journal
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b bg-slate-50/80">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">Journal</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-600">Écritures</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-600">Total Débit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.by_journal_type.map(row => (
                    <tr key={row.journal_type} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 capitalize font-medium">{row.journal_type}</td>
                      <td className="px-4 py-2.5 text-right">{row.count}</td>
                      <td className="px-4 py-2.5 text-right font-medium">{fmt(row.total_debit)} TND</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
