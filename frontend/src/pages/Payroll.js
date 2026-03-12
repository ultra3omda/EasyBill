import React, { useState, useEffect, useCallback } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { useCompany } from '../hooks/useCompany';
import api from '../services/api';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
  Calculator, CheckCircle, Clock, AlertCircle, History, DollarSign,
  ChevronDown, FileText,
} from 'lucide-react';

const MONTHS = [
  { value: 1, label: 'Janvier' }, { value: 2, label: 'Février' },
  { value: 3, label: 'Mars' }, { value: 4, label: 'Avril' },
  { value: 5, label: 'Mai' }, { value: 6, label: 'Juin' },
  { value: 7, label: 'Juillet' }, { value: 8, label: 'Août' },
  { value: 9, label: 'Septembre' }, { value: 10, label: 'Octobre' },
  { value: 11, label: 'Novembre' }, { value: 12, label: 'Décembre' },
];

const currentDate = new Date();
const currentYear = currentDate.getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

const fmt = (v) => (v != null ? Number(v).toFixed(3) : '0.000');

const Payroll = () => {
  const { currentCompany } = useCompany();
  const [month, setMonth] = useState(currentDate.getMonth() + 1);
  const [year, setYear] = useState(currentYear);
  const [payrollLines, setPayrollLines] = useState([]);
  const [status, setStatus] = useState('not_calculated');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [validating, setValidating] = useState(false);

  const loadPayroll = useCallback(async () => {
    if (!currentCompany?.id) return;
    setLoading(true);
    try {
      const res = await api.get(`/hr/payroll?company_id=${currentCompany.id}&month=${month}&year=${year}`);
      const data = res.data || {};
      setPayrollLines(data.lines || []);
      setStatus(data.status || 'not_calculated');
    } catch (error) {
      if (error.response?.status !== 404) {
        toast.error('Erreur lors du chargement de la paie');
      }
      setPayrollLines([]);
      setStatus('not_calculated');
    } finally {
      setLoading(false);
    }
  }, [currentCompany, month, year]);

  const loadHistory = useCallback(async () => {
    if (!currentCompany?.id) return;
    try {
      const res = await api.get(`/hr/payroll/history?company_id=${currentCompany.id}`);
      setHistory(res.data || []);
    } catch {
      setHistory([]);
    }
  }, [currentCompany]);

  useEffect(() => {
    loadPayroll();
    loadHistory();
  }, [loadPayroll, loadHistory]);

  const handleCalculate = async () => {
    setCalculating(true);
    try {
      await api.post(`/hr/payroll/calculate?company_id=${currentCompany.id}`, { month, year });
      toast.success('Paie calculée avec succès');
      await loadPayroll();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors du calcul de la paie');
    } finally {
      setCalculating(false);
    }
  };

  const handleValidate = async () => {
    setValidating(true);
    try {
      await api.post(`/hr/payroll/validate?company_id=${currentCompany.id}`, { month, year });
      toast.success('Paie validée avec succès');
      await loadPayroll();
      await loadHistory();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la validation');
    } finally {
      setValidating(false);
    }
  };

  const totals = payrollLines.reduce(
    (acc, l) => ({
      base: acc.base + (l.salaire_base || 0),
      primes: acc.primes + (l.primes || 0),
      brut: acc.brut + (l.brut || 0),
      cnss: acc.cnss + (l.cnss || 0),
      irpp: acc.irpp + (l.irpp || 0),
      css: acc.css + (l.css || 0),
      net: acc.net + (l.net || 0),
      cout_employeur: acc.cout_employeur + (l.cout_employeur || 0),
    }),
    { base: 0, primes: 0, brut: 0, cnss: 0, irpp: 0, css: 0, net: 0, cout_employeur: 0 }
  );

  const statusConfig = {
    not_calculated: { label: 'Non calculé', color: 'bg-gray-100 text-gray-700', icon: AlertCircle },
    calculated: { label: 'Calculé (preview)', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
    validated: { label: 'Validé', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  };

  const st = statusConfig[status] || statusConfig.not_calculated;
  const StatusIcon = st.icon;

  if (!currentCompany) {
    return <AppLayout><div className="text-center py-20 text-gray-500">Aucune entreprise sélectionnée</div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gestion de la Paie</h1>
            <p className="text-sm text-gray-500 mt-1">Calcul et validation des bulletins de paie</p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m) => (
                  <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {YEARS.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Status & Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${st.color}`}>
            <StatusIcon className="w-4 h-4" />
            {st.label}
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleCalculate}
              disabled={calculating || status === 'validated'}
              variant={status === 'validated' ? 'outline' : 'default'}
            >
              <Calculator className="w-4 h-4 mr-2" />
              {calculating ? 'Calcul en cours...' : 'Calculer la paie'}
            </Button>
            <Button
              onClick={handleValidate}
              disabled={validating || status !== 'calculated'}
              variant="default"
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              {validating ? 'Validation...' : 'Valider'}
            </Button>
          </div>
        </div>

        {/* Preview Table */}
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[160px]">Employé</TableHead>
                  <TableHead className="text-right">Salaire base</TableHead>
                  <TableHead className="text-right">Primes</TableHead>
                  <TableHead className="text-right">Brut</TableHead>
                  <TableHead className="text-right">CNSS (9.18%)</TableHead>
                  <TableHead className="text-right">IRPP</TableHead>
                  <TableHead className="text-right">CSS</TableHead>
                  <TableHead className="text-right">Net à payer</TableHead>
                  <TableHead className="text-right">Coût employeur</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-10 text-gray-400">
                      Chargement...
                    </TableCell>
                  </TableRow>
                ) : payrollLines.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-10 text-gray-400">
                      <div className="flex flex-col items-center gap-2">
                        <DollarSign className="w-8 h-8" />
                        <span>Aucune donnée. Cliquez sur "Calculer la paie" pour générer les bulletins.</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {payrollLines.map((line, idx) => (
                      <TableRow key={line.employee_id || idx}>
                        <TableCell className="font-medium">{line.employee_name || '—'}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(line.salaire_base)}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(line.primes)}</TableCell>
                        <TableCell className="text-right font-mono font-medium">{fmt(line.brut)}</TableCell>
                        <TableCell className="text-right font-mono text-red-600">{fmt(line.cnss)}</TableCell>
                        <TableCell className="text-right font-mono text-red-600">{fmt(line.irpp)}</TableCell>
                        <TableCell className="text-right font-mono text-red-600">{fmt(line.css)}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-green-700">{fmt(line.net)}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(line.cout_employeur)}</TableCell>
                      </TableRow>
                    ))}
                    {/* Summary row */}
                    <TableRow className="bg-gray-50 font-bold border-t-2">
                      <TableCell>TOTAL</TableCell>
                      <TableCell className="text-right font-mono">{fmt(totals.base)}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(totals.primes)}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(totals.brut)}</TableCell>
                      <TableCell className="text-right font-mono text-red-600">{fmt(totals.cnss)}</TableCell>
                      <TableCell className="text-right font-mono text-red-600">{fmt(totals.irpp)}</TableCell>
                      <TableCell className="text-right font-mono text-red-600">{fmt(totals.css)}</TableCell>
                      <TableCell className="text-right font-mono text-green-700">{fmt(totals.net)}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(totals.cout_employeur)}</TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* History */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <History className="w-5 h-5" />
            Historique des paies validées
          </h2>
          <Card>
            {history.length === 0 ? (
              <div className="text-center py-8 text-gray-400">Aucun historique disponible</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Période</TableHead>
                      <TableHead className="text-right">Nombre d'employés</TableHead>
                      <TableHead className="text-right">Total brut</TableHead>
                      <TableHead className="text-right">Total net</TableHead>
                      <TableHead className="text-right">Coût employeur</TableHead>
                      <TableHead>Date validation</TableHead>
                      <TableHead>Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((h, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">
                          {MONTHS.find((m) => m.value === h.month)?.label || h.month} {h.year}
                        </TableCell>
                        <TableCell className="text-right">{h.employee_count || '—'}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(h.total_brut)}</TableCell>
                        <TableCell className="text-right font-mono font-medium text-green-700">{fmt(h.total_net)}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(h.total_cout_employeur)}</TableCell>
                        <TableCell>{h.validated_at ? new Date(h.validated_at).toLocaleDateString('fr-TN') : '—'}</TableCell>
                        <TableCell>
                          <Badge className="bg-green-100 text-green-800">Validé</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default Payroll;
