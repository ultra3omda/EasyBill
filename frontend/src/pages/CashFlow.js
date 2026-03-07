import React, { useState, useEffect, useCallback } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import { companiesAPI } from '../services/api';
import { Activity, RefreshCw, Calendar, Banknote, Building2, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;
const token = () => localStorage.getItem('token');
const fmt = n => Number(n || 0).toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

function FluxSection({ data, icon: Icon, colorClass, bgClass }) {
  if (!data) return null;
  const isPositive = data.total >= 0;
  return (
    <Card>
      <CardHeader className={`${bgClass} rounded-t-xl pb-3`}>
        <div className="flex items-center justify-between">
          <CardTitle className={`text-base flex items-center gap-2 ${colorClass}`}>
            <Icon className="w-4 h-4" />
            {data.label}
          </CardTitle>
          <span className={`text-xl font-bold ${isPositive ? colorClass : 'text-red-600'}`}>
            {isPositive ? '+' : ''}{fmt(data.total)} TND
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <tbody>
            {data.detail?.map((item, i) => (
              <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-2.5 text-gray-700">{item.label}</td>
                <td className="px-4 py-2.5 text-right">
                  <span className={`font-medium ${item.amount >= 0 ? 'text-gray-800' : 'text-red-600'}`}>
                    {item.amount >= 0 ? '' : '-'}{fmt(Math.abs(item.amount))}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-gray-200 bg-gray-50">
            <tr>
              <td className="px-4 py-2.5 font-bold text-gray-800">Flux net</td>
              <td className={`px-4 py-2.5 text-right font-bold ${isPositive ? 'text-green-700' : 'text-red-600'}`}>
                {isPositive ? '+' : ''}{fmt(data.total)} TND
              </td>
            </tr>
          </tfoot>
        </table>
      </CardContent>
    </Card>
  );
}

export default function CashFlow() {
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

  const fetchData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ company_id: companyId });
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      const res = await fetch(`${API}/api/financial-statements/cash-flow?${params}`, {
        headers: { Authorization: `Bearer ${token()}` }
      });
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      toast.error('Erreur lors du chargement de l\'état des flux');
    } finally {
      setLoading(false);
    }
  }, [companyId, dateFrom, dateTo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Activity className="w-6 h-6 text-violet-600" />
              État des flux de trésorerie
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              Méthode indirecte — Exploitation · Investissement · Financement
            </p>
          </div>
          <Button onClick={fetchData} variant="outline" size="sm" className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Actualiser
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  <Calendar className="w-3.5 h-3.5 inline mr-1" />Du
                </label>
                <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-40" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Au</label>
                <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-40" />
              </div>
              <Button onClick={fetchData} className="bg-violet-600 hover:bg-violet-700">Actualiser</Button>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="text-center py-16 text-gray-400">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-violet-600 mx-auto mb-3" />
            Calcul des flux de trésorerie…
          </div>
        ) : !data ? null : (
          <>
            {/* KPI Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                {
                  label: 'Trésorerie fin de période',
                  value: data.tresorerie?.total_fin_periode,
                  icon: Banknote,
                  color: 'text-violet-600',
                  bg: 'bg-violet-50'
                },
                {
                  label: 'Flux exploitation',
                  value: data.flux_exploitation?.total,
                  icon: data.flux_exploitation?.total >= 0 ? ArrowUpRight : ArrowDownRight,
                  color: data.flux_exploitation?.total >= 0 ? 'text-green-600' : 'text-red-600',
                  bg: data.flux_exploitation?.total >= 0 ? 'bg-green-50' : 'bg-red-50'
                },
                {
                  label: 'Flux investissement',
                  value: data.flux_investissement?.total,
                  icon: data.flux_investissement?.total >= 0 ? ArrowUpRight : ArrowDownRight,
                  color: data.flux_investissement?.total >= 0 ? 'text-blue-600' : 'text-orange-600',
                  bg: data.flux_investissement?.total >= 0 ? 'bg-blue-50' : 'bg-orange-50'
                },
                {
                  label: 'Flux financement',
                  value: data.flux_financement?.total,
                  icon: data.flux_financement?.total >= 0 ? TrendingUp : TrendingDown,
                  color: data.flux_financement?.total >= 0 ? 'text-indigo-600' : 'text-pink-600',
                  bg: data.flux_financement?.total >= 0 ? 'bg-indigo-50' : 'bg-pink-50'
                },
              ].map(kpi => (
                <Card key={kpi.label}>
                  <CardContent className={`p-4 ${kpi.bg} rounded-xl`}>
                    <div className="flex items-center gap-2 mb-1">
                      <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                      <p className="text-xs text-gray-500">{kpi.label}</p>
                    </div>
                    <p className={`text-xl font-bold ${kpi.color}`}>
                      {kpi.value >= 0 ? '+' : ''}{fmt(kpi.value)} TND
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Flux sections */}
            <FluxSection
              data={data.flux_exploitation}
              icon={Activity}
              colorClass="text-green-700"
              bgClass="bg-green-50"
            />
            <FluxSection
              data={data.flux_investissement}
              icon={Building2}
              colorClass="text-blue-700"
              bgClass="bg-blue-50"
            />
            <FluxSection
              data={data.flux_financement}
              icon={TrendingUp}
              colorClass="text-indigo-700"
              bgClass="bg-indigo-50"
            />

            {/* Treasury detail */}
            <Card>
              <CardHeader className="bg-violet-50 rounded-t-xl pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-violet-700">
                  <Banknote className="w-4 h-4" />
                  {data.tresorerie?.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b border-gray-100">
                      <td className="px-4 py-2.5 text-gray-700"><Building2 className="w-3.5 h-3.5 inline mr-2 text-indigo-500" />Banques (52x)</td>
                      <td className="px-4 py-2.5 text-right font-medium">{fmt(data.tresorerie?.banques)} TND</td>
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="px-4 py-2.5 text-gray-700"><Banknote className="w-3.5 h-3.5 inline mr-2 text-yellow-500" />Caisse (53x)</td>
                      <td className="px-4 py-2.5 text-right font-medium">{fmt(data.tresorerie?.caisse)} TND</td>
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="px-4 py-2.5 text-gray-700"><Activity className="w-3.5 h-3.5 inline mr-2 text-blue-500" />Placements (50-51x)</td>
                      <td className="px-4 py-2.5 text-right font-medium">{fmt(data.tresorerie?.placements)} TND</td>
                    </tr>
                    {data.tresorerie?.accounts?.length > 0 && (
                      <>
                        <tr className="bg-gray-50">
                          <td colSpan={2} className="px-4 py-1.5 text-xs font-semibold text-gray-500 uppercase">Détail par compte</td>
                        </tr>
                        {data.tresorerie.accounts.map(acc => (
                          <tr key={acc.account_code} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-4 py-2 pl-8">
                              <span className="font-mono text-xs text-violet-700 mr-2">{acc.account_code}</span>
                              <span className="text-gray-600">{acc.account_name}</span>
                            </td>
                            <td className="px-4 py-2 text-right text-gray-700">{fmt(acc.balance)} TND</td>
                          </tr>
                        ))}
                      </>
                    )}
                  </tbody>
                  <tfoot className="border-t-2 border-violet-200 bg-violet-50">
                    <tr>
                      <td className="px-4 py-3 font-bold text-violet-800">Trésorerie nette fin de période</td>
                      <td className="px-4 py-3 text-right font-bold text-xl text-violet-700">
                        {fmt(data.tresorerie?.total_fin_periode)} TND
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}
