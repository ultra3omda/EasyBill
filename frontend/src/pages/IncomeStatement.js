import React, { useState, useEffect, useCallback } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import { companiesAPI } from '../services/api';
import { TrendingUp, TrendingDown, RefreshCw, Calendar, ChevronDown, ChevronRight } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;
const token = () => localStorage.getItem('token');
const fmt = n => Number(n || 0).toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const pct = n => `${Number(n || 0).toFixed(2)} %`;

function SectionCard({ title, sections = [], total, colorClass, showDetail }) {
  const [expanded, setExpanded] = useState({});
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className={`text-base ${colorClass}`}>{title}</CardTitle>
        <p className="text-sm text-gray-500">Total : <strong>{fmt(total)} TND</strong></p>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-600">Rubrique</th>
              <th className="px-4 py-2 text-right font-medium text-gray-600">Montant (TND)</th>
            </tr>
          </thead>
          <tbody>
            {sections.map((section, i) => (
              <React.Fragment key={i}>
                <tr
                  className={`border-b border-gray-100 ${showDetail && section.detail?.length ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                  onClick={() => showDetail && section.detail?.length && setExpanded(p => ({ ...p, [i]: !p[i] }))}
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      {showDetail && section.detail?.length ? (
                        expanded[i] ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                      ) : null}
                      {section.label}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium">{fmt(section.amount)}</td>
                </tr>
                {showDetail && expanded[i] && section.detail?.map(d => (
                  <tr key={d.account_code} className="bg-blue-50/40 border-b border-blue-50">
                    <td className="py-1.5" style={{ paddingLeft: '40px' }}>
                      <span className="font-mono text-xs text-blue-700 mr-2">{d.account_code}</span>
                      <span className="text-xs text-gray-600">{d.account_name}</span>
                    </td>
                    <td className="px-4 py-1.5 text-right text-xs text-gray-700">{fmt(d.balance)}</td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-gray-200 bg-gray-50">
            <tr>
              <td className="px-4 py-2.5 font-bold text-gray-800">Total {title}</td>
              <td className="px-4 py-2.5 text-right font-bold text-gray-800">{fmt(total)}</td>
            </tr>
          </tfoot>
        </table>
      </CardContent>
    </Card>
  );
}

export default function IncomeStatement() {
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

  const fetchData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ company_id: companyId, detail: showDetail });
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      const res = await fetch(`${API}/api/financial-statements/income-statement?${params}`, {
        headers: { Authorization: `Bearer ${token()}` }
      });
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      toast.error("Erreur lors du chargement de l'état de résultat");
    } finally {
      setLoading(false);
    }
  }, [companyId, dateFrom, dateTo, showDetail]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-header-title flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-violet-700" />
              État de résultat
            </h1>
            <p className="page-header-subtitle">
              Compte de résultat selon le SCE tunisien
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowDetail(!showDetail)} className="gap-1.5">
              {showDetail ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              {showDetail ? 'Masquer' : 'Afficher'} le détail
            </Button>
            <Button onClick={fetchData} variant="outline" size="sm" className="gap-1.5">
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
              <Button onClick={fetchData}>Actualiser</Button>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="py-16 text-center text-slate-400">
            <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
            Calcul de l'état de résultat…
          </div>
        ) : !data ? null : (
          <>
            {/* Result Banner */}
            <div className={`rounded-2xl border-2 p-5 ${data.benefice ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {data.benefice
                    ? <TrendingUp className="w-8 h-8 text-green-600" />
                    : <TrendingDown className="w-8 h-8 text-red-600" />}
                  <div>
                    <p className={`text-2xl font-bold ${data.benefice ? 'text-green-700' : 'text-red-700'}`}>
                      {data.benefice ? 'Bénéfice' : 'Déficit'} : {data.resultat_net >= 0 ? '+' : ''}{fmt(data.resultat_net)} TND
                    </p>
                    <p className="text-sm text-slate-500">
                      Marge brute : {fmt(data.marge_brute)} TND ({pct(data.taux_marge)})
                    </p>
                  </div>
                </div>
                <div className="text-right text-sm text-gray-500">
                  <p>Résultat d'exploitation : <strong>{fmt(data.resultat_exploitation)} TND</strong></p>
                  <p>Résultat financier : <strong>{fmt(data.resultat_financier)} TND</strong></p>
                </div>
              </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Produits', value: data.produits?.total, color: 'text-green-600' },
                { label: 'Charges', value: data.charges?.total, color: 'text-red-600' },
                { label: 'Marge brute', value: data.marge_brute, color: 'text-blue-600' },
                { label: 'Résultat net', value: data.resultat_net, color: data.benefice ? 'text-green-600' : 'text-red-600' },
              ].map(kpi => (
                <Card key={kpi.label} className="stat-surface">
                  <CardContent className="p-4 text-center">
                    <p className={`text-xl font-bold ${kpi.color}`}>
                      {kpi.value >= 0 ? '+' : ''}{fmt(kpi.value)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{kpi.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Tables */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <SectionCard
                title="Produits"
                sections={data.produits?.sections}
                total={data.produits?.total}
                colorClass="text-green-700"
                showDetail={showDetail}
              />
              <SectionCard
                title="Charges"
                sections={data.charges?.sections}
                total={data.charges?.total}
                colorClass="text-red-700"
                showDetail={showDetail}
              />
            </div>

            {/* Soldes intermédiaires */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Soldes intermédiaires de gestion</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <tbody>
                    {[
                      { label: 'Chiffre d\'affaires (Ventes)', value: data.produits?.sections?.find(s => s.label.includes('ventes'))?.amount || 0, bold: false },
                      { label: 'Marge brute', value: data.marge_brute, bold: true },
                      { label: '  Taux de marge', value: null, pct: data.taux_marge, bold: false, sub: true },
                      { label: 'Résultat d\'exploitation', value: data.resultat_exploitation, bold: true },
                      { label: 'Résultat financier', value: data.resultat_financier, bold: false },
                      { label: 'Résultat net de l\'exercice', value: data.resultat_net, bold: true, highlight: true },
                    ].map((row, i) => (
                      <tr key={i} className={`border-b border-gray-100 ${row.highlight ? (data.benefice ? 'bg-green-50' : 'bg-red-50') : ''}`}>
                        <td className={`px-4 py-2.5 ${row.bold ? 'font-semibold' : ''} ${row.sub ? 'text-gray-500 pl-8' : ''}`}>
                          {row.label}
                        </td>
                        <td className={`px-4 py-2.5 text-right ${row.bold ? 'font-bold' : ''} ${row.highlight ? (data.benefice ? 'text-green-700' : 'text-red-700') : ''}`}>
                          {row.pct !== undefined ? pct(row.pct) : (row.value !== null ? `${row.value >= 0 ? '' : '-'}${fmt(Math.abs(row.value))} TND` : '')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}
