import React, { useState, useEffect, useCallback } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { companiesAPI } from '../services/api';
import { Scale, RefreshCw, Calendar, ChevronDown, ChevronRight, TrendingUp, TrendingDown, Download } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;
const token = () => localStorage.getItem('token');
const fmt = n => Number(n || 0).toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

function SectionRow({ item, depth = 0 }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetail = item.detail && item.detail.length > 0;
  const isPositive = item.amount >= 0;

  return (
    <>
      <tr
        className={`${depth === 0 ? 'bg-gray-50 font-semibold' : 'hover:bg-gray-50'} border-b border-gray-100`}
        onClick={() => hasDetail && setExpanded(!expanded)}
        style={{ cursor: hasDetail ? 'pointer' : 'default' }}
      >
        <td className="px-4 py-2.5" style={{ paddingLeft: `${(depth + 1) * 16}px` }}>
          <div className="flex items-center gap-2">
            {hasDetail ? (
              expanded ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            ) : <span className="w-3.5" />}
            <span className={depth === 0 ? 'text-gray-800' : 'text-gray-700 font-normal'}>{item.label}</span>
          </div>
        </td>
        <td className={`px-4 py-2.5 text-right font-${depth === 0 ? 'bold' : 'medium'} ${isPositive ? 'text-gray-900' : 'text-red-600'}`}>
          {fmt(item.amount)}
        </td>
      </tr>
      {expanded && hasDetail && item.detail.map(d => (
        <tr key={d.account_code} className="border-b border-gray-50 bg-blue-50/30">
          <td className="px-4 py-1.5" style={{ paddingLeft: '64px' }}>
            <span className="font-mono text-xs text-blue-700 mr-2">{d.account_code}</span>
            <span className="text-xs text-gray-600">{d.account_name}</span>
          </td>
          <td className="px-4 py-1.5 text-right text-xs text-gray-700">{fmt(d.balance)}</td>
        </tr>
      ))}
    </>
  );
}

export default function Bilan() {
  const [companyId, setCompanyId] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    companiesAPI.list().then(r => {
      if (r.data?.length) setCompanyId(r.data[0].id);
    });
  }, []);

  const fetchBilan = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ company_id: companyId, detail: showDetail });
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      const res = await fetch(`${API}/api/financial-statements/bilan?${params}`, {
        headers: { Authorization: `Bearer ${token()}` }
      });
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      toast.error('Erreur lors du chargement du bilan');
    } finally {
      setLoading(false);
    }
  }, [companyId, dateFrom, dateTo, showDetail]);

  useEffect(() => { fetchBilan(); }, [fetchBilan]);

  const isBalanced = data && Math.abs(data.equilibre) < 0.01;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-header-title flex items-center gap-2">
              <Scale className="w-6 h-6 text-violet-700" />
              Bilan comptable
            </h1>
            <p className="page-header-subtitle">
              Situation patrimoniale — Actif / Passif selon le SCE tunisien
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline" size="sm"
              onClick={() => setShowDetail(!showDetail)}
              className="gap-1.5"
            >
              {showDetail ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              {showDetail ? 'Masquer' : 'Afficher'} le détail
            </Button>
            <Button onClick={fetchBilan} variant="outline" size="sm" className="gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" /> Actualiser
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  <Calendar className="w-3.5 h-3.5 inline mr-1" />Du
                </label>
                <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-40" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Au</label>
                <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-40" />
              </div>
              <Button onClick={fetchBilan}>
                Actualiser
              </Button>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="py-16 text-center text-slate-400">
            <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
            Calcul du bilan…
          </div>
        ) : !data ? null : (
          <>
            {/* Equilibre indicator */}
            <div className={`flex items-center gap-3 rounded-2xl border p-4 ${isBalanced ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              {isBalanced
                ? <TrendingUp className="w-5 h-5 text-green-600" />
                : <TrendingDown className="w-5 h-5 text-red-600" />}
              <div>
                <p className={`font-semibold ${isBalanced ? 'text-green-700' : 'text-red-700'}`}>
                  {isBalanced ? 'Bilan équilibré' : `Écart : ${fmt(Math.abs(data.equilibre))} TND`}
                </p>
                <p className="text-sm text-slate-500">
                  Résultat net de l'exercice : <strong className={data.net_result >= 0 ? 'text-green-700' : 'text-red-600'}>
                    {data.net_result >= 0 ? '+' : ''}{fmt(data.net_result)} TND
                  </strong>
                </p>
              </div>
            </div>

            {/* Bilan Table */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* ACTIF */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg text-gray-800">ACTIF</CardTitle>
                  <p className="text-sm text-gray-500">Total Actif : <strong className="text-violet-700">{fmt(data.actif?.total)} TND</strong></p>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead className="border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium text-gray-600">Rubrique</th>
                        <th className="px-4 py-2 text-right font-medium text-gray-600">Montant (TND)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.actif?.sections?.map(section => (
                        <React.Fragment key={section.key}>
                          <tr className="bg-violet-50 border-b border-violet-100">
                            <td colSpan={2} className="px-4 py-2 font-bold text-violet-800 text-xs uppercase tracking-wide">
                              {section.label}
                            </td>
                          </tr>
                          {section.items?.map((item, i) => (
                            <SectionRow key={i} item={item} depth={1} />
                          ))}
                          <tr className="border-b-2 border-violet-200">
                            <td className="px-4 py-2 font-bold text-gray-700">Sous-total {section.label}</td>
                            <td className="px-4 py-2 text-right font-bold text-violet-700">{fmt(section.total)}</td>
                          </tr>
                        </React.Fragment>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-gray-300 bg-gray-100">
                      <tr>
                        <td className="px-4 py-3 font-bold text-gray-900">TOTAL ACTIF</td>
                        <td className="px-4 py-3 text-right font-bold text-lg text-violet-700">{fmt(data.actif?.total)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </CardContent>
              </Card>

              {/* PASSIF */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg text-gray-800">PASSIF</CardTitle>
                  <p className="text-sm text-gray-500">Total Passif : <strong className="text-violet-700">{fmt(data.passif?.total)} TND</strong></p>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead className="border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium text-gray-600">Rubrique</th>
                        <th className="px-4 py-2 text-right font-medium text-gray-600">Montant (TND)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.passif?.sections?.map(section => (
                        <React.Fragment key={section.key}>
                          <tr className="bg-emerald-50 border-b border-emerald-100">
                            <td colSpan={2} className="px-4 py-2 font-bold text-emerald-800 text-xs uppercase tracking-wide">
                              {section.label}
                            </td>
                          </tr>
                          {section.items?.map((item, i) => (
                            <SectionRow key={i} item={item} depth={1} />
                          ))}
                          <tr className="border-b-2 border-emerald-200">
                            <td className="px-4 py-2 font-bold text-gray-700">Sous-total {section.label}</td>
                            <td className="px-4 py-2 text-right font-bold text-emerald-700">{fmt(section.total)}</td>
                          </tr>
                        </React.Fragment>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-gray-300 bg-gray-100">
                      <tr>
                        <td className="px-4 py-3 font-bold text-gray-900">TOTAL PASSIF</td>
                        <td className="px-4 py-3 text-right font-bold text-lg text-emerald-700">{fmt(data.passif?.total)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </CardContent>
              </Card>
            </div>

            {/* Key Indicators */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Produits', value: data.income_total, color: 'text-green-600' },
                { label: 'Total Charges', value: data.expense_total, color: 'text-red-600' },
                { label: 'Résultat net', value: data.net_result, color: data.net_result >= 0 ? 'text-green-600' : 'text-red-600' },
                { label: 'Équilibre', value: data.equilibre, color: Math.abs(data.equilibre) < 0.01 ? 'text-green-600' : 'text-red-600' },
              ].map(kpi => (
                <Card key={kpi.label} className="stat-surface">
                  <CardContent className="p-4 text-center">
                    <p className={`text-xl font-bold ${kpi.color}`}>{fmt(kpi.value)}</p>
                    <p className="mt-1 text-xs text-slate-500">{kpi.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
