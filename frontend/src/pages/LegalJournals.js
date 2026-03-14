import React, { useState, useEffect, useCallback } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { companiesAPI } from '../services/api';
import {
  BookOpen, TrendingUp, ShoppingCart, Banknote, Building2, RefreshCw,
  Download, ChevronLeft, ChevronRight, Filter, Calendar, Eye
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const JOURNAL_ICONS = {
  sales: TrendingUp,
  purchases: ShoppingCart,
  cash: Banknote,
  bank: Building2,
  od: RefreshCw,
};
const JOURNAL_COLORS = {
  sales: 'text-green-600 bg-green-50 border-green-200',
  purchases: 'text-blue-600 bg-blue-50 border-blue-200',
  cash: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  bank: 'text-indigo-600 bg-indigo-50 border-indigo-200',
  od: 'text-purple-600 bg-purple-50 border-purple-200',
};

const fmt = (n) => Number(n || 0).toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export default function LegalJournals() {
  const [companyId, setCompanyId] = useState(null);
  const [journals, setJournals] = useState([]);
  const [selectedJournal, setSelectedJournal] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totals, setTotals] = useState({ debit: 0, credit: 0, total: 0 });
  const [expandedEntry, setExpandedEntry] = useState(null);

  useEffect(() => {
    companiesAPI.list().then(r => {
      if (r.data?.length) setCompanyId(r.data[0].id);
    }).catch(console.error);
  }, []);

  const token = () => localStorage.getItem('token');

  const fetchSummary = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ company_id: companyId });
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      const res = await fetch(`${API}/api/legal-journals/summary?${params}`, {
        headers: { Authorization: `Bearer ${token()}` }
      });
      const data = await res.json();
      setJournals(data);
    } catch (e) {
      toast.error('Erreur lors du chargement des journaux');
    } finally {
      setLoading(false);
    }
  }, [companyId, dateFrom, dateTo]);

  const fetchEntries = useCallback(async (journalKey, p = 1) => {
    if (!companyId) return;
    setLoadingEntries(true);
    try {
      const params = new URLSearchParams({ company_id: companyId, page: p, page_size: 50 });
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      const res = await fetch(`${API}/api/legal-journals/${journalKey}?${params}`, {
        headers: { Authorization: `Bearer ${token()}` }
      });
      const data = await res.json();
      setEntries(data.entries || []);
      setTotalPages(data.total_pages || 1);
      setPage(data.page || 1);
      setTotals({ debit: data.totals_debit || 0, credit: data.totals_credit || 0, total: data.total || 0 });
    } catch (e) {
      toast.error('Erreur lors du chargement des écritures');
    } finally {
      setLoadingEntries(false);
    }
  }, [companyId, dateFrom, dateTo]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);
  useEffect(() => {
    if (selectedJournal) fetchEntries(selectedJournal, 1);
  }, [selectedJournal, fetchEntries]);

  const handleExport = async () => {
    if (!selectedJournal) return;
    try {
      const params = new URLSearchParams({ company_id: companyId });
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      const res = await fetch(`${API}/api/legal-journals/${selectedJournal}/export/excel?${params}`, {
        headers: { Authorization: `Bearer ${token()}` }
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `journal_${selectedJournal}.xlsx`;
      a.click(); URL.revokeObjectURL(url);
      toast.success('Export réussi');
    } catch {
      toast.error("Erreur lors de l'export");
    }
  };

  const currentJournal = journals.find(j => j.key === selectedJournal);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-header-title flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-violet-700" />
              Journaux légaux
            </h1>
            <p className="page-header-subtitle">
              Journal des ventes, achats, caisse, banque et opérations diverses
            </p>
          </div>
          <div className="flex items-center gap-2">
            {selectedJournal && (
              <Button variant="outline" onClick={handleExport} className="gap-2">
                <Download className="w-4 h-4" /> Exporter Excel
              </Button>
            )}
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
              <Button onClick={fetchSummary} className="gap-2">
                <Filter className="w-4 h-4" /> Appliquer
              </Button>
              {(dateFrom || dateTo) && (
                <Button variant="outline" onClick={() => { setDateFrom(''); setDateTo(''); }}>
                  Réinitialiser
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left: Journal list */}
          <div className="lg:col-span-1 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Journaux</h2>
            {loading ? (
              <div className="py-8 text-center text-slate-400">Chargement…</div>
            ) : (
              journals.map(journal => {
                const Icon = JOURNAL_ICONS[journal.key] || BookOpen;
                const colorClass = JOURNAL_COLORS[journal.key] || 'text-gray-600 bg-gray-50 border-gray-200';
                const isSelected = selectedJournal === journal.key;
                return (
                  <button
                    key={journal.key}
                    onClick={() => setSelectedJournal(journal.key)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                      isSelected
                        ? 'border-violet-500 bg-violet-50 shadow-md'
                        : 'border-slate-200 bg-white hover:border-violet-300 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 rounded-lg ${colorClass}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-medium text-slate-900">{journal.label}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>{journal.count} écriture{journal.count !== 1 ? 's' : ''}</span>
                      <span className="font-medium text-slate-700">{fmt(journal.total_debit)} TND</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Right: Journal entries */}
          <div className="lg:col-span-3">
            {!selectedJournal ? (
              <Card>
                <CardContent className="py-16 text-center text-slate-400">
                  <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-lg font-medium">Sélectionnez un journal</p>
                  <p className="text-sm">Cliquez sur un journal à gauche pour afficher ses écritures</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      {currentJournal?.label}
                      <Badge variant="secondary" className="ml-2">{totals.total} entrées</Badge>
                    </CardTitle>
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <span>Total Débit : <strong className="text-slate-900">{fmt(totals.debit)}</strong></span>
                      <span>|</span>
                      <span>Total Crédit : <strong className="text-slate-900">{fmt(totals.credit)}</strong></span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {loadingEntries ? (
                    <div className="py-12 text-center text-slate-400">
                      <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
                      Chargement…
                    </div>
                  ) : entries.length === 0 ? (
                    <div className="py-12 text-center text-slate-400">
                      <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      Aucune écriture dans ce journal pour la période sélectionnée
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="border-b bg-slate-50/80">
                          <tr>
                            <th className="px-4 py-3 text-left font-medium text-gray-600">N°</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-600">Date</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-600">Description</th>
                            <th className="px-4 py-3 text-right font-medium text-gray-600">Débit</th>
                            <th className="px-4 py-3 text-right font-medium text-gray-600">Crédit</th>
                            <th className="px-4 py-3 text-center font-medium text-gray-600">Détail</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {entries.map(entry => (
                            <React.Fragment key={entry.id}>
                              <tr
                                className="cursor-pointer hover:bg-slate-50"
                                onClick={() => setExpandedEntry(expandedEntry === entry.id ? null : entry.id)}
                              >
                                <td className="px-4 py-3 font-mono text-xs text-violet-700">{entry.entry_number}</td>
                                <td className="px-4 py-3 text-slate-600">
                                  {entry.date ? new Date(entry.date).toLocaleDateString('fr-TN') : '-'}
                                </td>
                                <td className="max-w-xs truncate px-4 py-3 text-slate-800">{entry.description || entry.reference || '-'}</td>
                                <td className="px-4 py-3 text-right font-medium text-slate-800">{fmt(entry.total_debit)}</td>
                                <td className="px-4 py-3 text-right font-medium text-slate-800">{fmt(entry.total_credit)}</td>
                                <td className="px-4 py-3 text-center">
                                  <Eye className={`mx-auto w-4 h-4 ${expandedEntry === entry.id ? 'text-violet-700' : 'text-slate-400'}`} />
                                </td>
                              </tr>
                              {expandedEntry === entry.id && entry.lines?.length > 0 && (
                                <tr>
                                  <td colSpan={6} className="px-4 pb-3 pt-0">
                                    <div className="bg-violet-50 rounded-lg p-3 border border-violet-100">
                                      <table className="w-full text-xs">
                                        <thead>
                                          <tr className="text-violet-700 font-medium">
                                            <th className="text-left py-1">Compte</th>
                                            <th className="text-left py-1">Intitulé</th>
                                            <th className="text-right py-1">Débit</th>
                                            <th className="text-right py-1">Crédit</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {entry.lines.map((line, i) => (
                                            <tr key={i} className="border-t border-violet-100">
                                              <td className="py-1 font-mono text-violet-600">{line.account_code}</td>
                                              <td className="py-1 text-gray-700">{line.account_name}</td>
                                              <td className="py-1 text-right text-gray-800">{line.debit ? fmt(line.debit) : ''}</td>
                                              <td className="py-1 text-right text-gray-800">{line.credit ? fmt(line.credit) : ''}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          ))}
                        </tbody>
                        {/* Footer totals */}
                        <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                          <tr>
                            <td colSpan={3} className="px-4 py-3 font-semibold text-gray-700">TOTAUX (page)</td>
                            <td className="px-4 py-3 text-right font-bold text-gray-900">
                              {fmt(entries.reduce((s, e) => s + (e.total_debit || 0), 0))}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-gray-900">
                              {fmt(entries.reduce((s, e) => s + (e.total_credit || 0), 0))}
                            </td>
                            <td />
                          </tr>
                        </tfoot>
                      </table>

                      {/* Pagination */}
                      {totalPages > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t">
                          <span className="text-sm text-gray-500">Page {page} / {totalPages}</span>
                          <div className="flex gap-2">
                            <Button
                              variant="outline" size="sm"
                              disabled={page <= 1}
                              onClick={() => { const p = page - 1; setPage(p); fetchEntries(selectedJournal, p); }}
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline" size="sm"
                              disabled={page >= totalPages}
                              onClick={() => { const p = page + 1; setPage(p); fetchEntries(selectedJournal, p); }}
                            >
                              <ChevronRight className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
