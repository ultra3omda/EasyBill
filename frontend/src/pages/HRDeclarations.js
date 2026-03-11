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
  FileText, Building2, Calculator, Calendar, History, Download, Loader2,
} from 'lucide-react';

const QUARTERS = [
  { value: 'T1', label: 'T1 (Jan-Mar)' },
  { value: 'T2', label: 'T2 (Avr-Jun)' },
  { value: 'T3', label: 'T3 (Jul-Sep)' },
  { value: 'T4', label: 'T4 (Oct-Déc)' },
];

const MONTHS = [
  { value: 1, label: 'Janvier' }, { value: 2, label: 'Février' },
  { value: 3, label: 'Mars' }, { value: 4, label: 'Avril' },
  { value: 5, label: 'Mai' }, { value: 6, label: 'Juin' },
  { value: 7, label: 'Juillet' }, { value: 8, label: 'Août' },
  { value: 9, label: 'Septembre' }, { value: 10, label: 'Octobre' },
  { value: 11, label: 'Novembre' }, { value: 12, label: 'Décembre' },
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

const fmt = (v) => (v != null ? Number(v).toFixed(3) : '0.000');

const HRDeclarations = () => {
  const { currentCompany } = useCompany();

  // CNSS state
  const [cnssQuarter, setCnssQuarter] = useState('T1');
  const [cnssYear, setCnssYear] = useState(currentYear);
  const [cnssResult, setCnssResult] = useState(null);
  const [cnssGenerating, setCnssGenerating] = useState(false);
  const [cnssHistory, setCnssHistory] = useState([]);

  // IRPP state
  const [irppMonth, setIrppMonth] = useState(new Date().getMonth() + 1);
  const [irppYear, setIrppYear] = useState(currentYear);
  const [irppResult, setIrppResult] = useState(null);
  const [irppGenerating, setIrppGenerating] = useState(false);
  const [irppHistory, setIrppHistory] = useState([]);

  // Annual state
  const [annualYear, setAnnualYear] = useState(currentYear);
  const [annualResult, setAnnualResult] = useState(null);
  const [annualGenerating, setAnnualGenerating] = useState(false);

  const loadHistory = useCallback(async () => {
    if (!currentCompany?.id) return;
    try {
      const [cnssRes, irppRes] = await Promise.all([
        api.get(`/hr/declarations/cnss/history?company_id=${currentCompany.id}`).catch(() => ({ data: [] })),
        api.get(`/hr/declarations/irpp/history?company_id=${currentCompany.id}`).catch(() => ({ data: [] })),
      ]);
      setCnssHistory(cnssRes.data || []);
      setIrppHistory(irppRes.data || []);
    } catch {
      // silently fail
    }
  }, [currentCompany]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleGenerateCNSS = async () => {
    setCnssGenerating(true);
    try {
      const res = await api.post(`/hr/declarations/cnss/generate?company_id=${currentCompany.id}`, {
        quarter: cnssQuarter,
        year: cnssYear,
      });
      setCnssResult(res.data);
      toast.success('Déclaration CNSS générée');
      loadHistory();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la génération CNSS');
    } finally {
      setCnssGenerating(false);
    }
  };

  const handleGenerateIRPP = async () => {
    setIrppGenerating(true);
    try {
      const res = await api.post(`/hr/declarations/irpp/generate?company_id=${currentCompany.id}`, {
        month: irppMonth,
        year: irppYear,
      });
      setIrppResult(res.data);
      toast.success('Déclaration IRPP générée');
      loadHistory();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la génération IRPP');
    } finally {
      setIrppGenerating(false);
    }
  };

  const handleGenerateAnnual = async () => {
    setAnnualGenerating(true);
    try {
      const res = await api.post(`/hr/declarations/annual/generate?company_id=${currentCompany.id}`, {
        year: annualYear,
      });
      setAnnualResult(res.data);
      toast.success('Déclaration annuelle générée');
      loadHistory();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la génération annuelle');
    } finally {
      setAnnualGenerating(false);
    }
  };

  const allHistory = [
    ...cnssHistory.map((h) => ({ ...h, type: 'CNSS' })),
    ...irppHistory.map((h) => ({ ...h, type: 'IRPP' })),
  ].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

  if (!currentCompany) {
    return <AppLayout><div className="text-center py-20 text-gray-500">Aucune entreprise sélectionnée</div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Déclarations Sociales & Fiscales</h1>
          <p className="text-sm text-gray-500 mt-1">Génération des déclarations CNSS, IRPP et annuelles</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {/* CNSS Trimestrielle */}
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">CNSS Trimestrielle</h3>
                <p className="text-xs text-gray-500">Déclaration trimestrielle des salaires</p>
              </div>
            </div>
            <div className="flex items-center gap-2 mb-4">
              <Select value={cnssQuarter} onValueChange={setCnssQuarter}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUARTERS.map((q) => (
                    <SelectItem key={q.value} value={q.value}>{q.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(cnssYear)} onValueChange={(v) => setCnssYear(Number(v))}>
                <SelectTrigger className="w-[90px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleGenerateCNSS} disabled={cnssGenerating} size="sm">
                {cnssGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Générer'}
              </Button>
            </div>
            {cnssResult && (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Employé</TableHead>
                      <TableHead className="text-xs text-right">Brut</TableHead>
                      <TableHead className="text-xs text-right">CNSS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(cnssResult.employees || []).map((emp, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm">{emp.name}</TableCell>
                        <TableCell className="text-sm text-right font-mono">{fmt(emp.brut)}</TableCell>
                        <TableCell className="text-sm text-right font-mono">{fmt(emp.cnss)}</TableCell>
                      </TableRow>
                    ))}
                    {cnssResult.total && (
                      <TableRow className="font-bold bg-gray-50">
                        <TableCell className="text-sm">Total</TableCell>
                        <TableCell className="text-sm text-right font-mono">{fmt(cnssResult.total.brut)}</TableCell>
                        <TableCell className="text-sm text-right font-mono">{fmt(cnssResult.total.cnss)}</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>

          {/* IRPP Mensuelle */}
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-lg bg-orange-100 flex items-center justify-center">
                <Calculator className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">IRPP Mensuelle</h3>
                <p className="text-xs text-gray-500">Retenues mensuelles à la source</p>
              </div>
            </div>
            <div className="flex items-center gap-2 mb-4">
              <Select value={String(irppMonth)} onValueChange={(v) => setIrppMonth(Number(v))}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m) => (
                    <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(irppYear)} onValueChange={(v) => setIrppYear(Number(v))}>
                <SelectTrigger className="w-[90px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleGenerateIRPP} disabled={irppGenerating} size="sm">
                {irppGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Générer'}
              </Button>
            </div>
            {irppResult && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'IRPP', value: irppResult.total_irpp },
                    { label: 'CSS', value: irppResult.total_css },
                    { label: 'TFP', value: irppResult.total_tfp },
                    { label: 'FOPROLOS', value: irppResult.total_foprolos },
                  ].map((item) => (
                    <div key={item.label} className="bg-gray-50 rounded-lg p-3">
                      <div className="text-xs text-gray-500">{item.label}</div>
                      <div className="text-sm font-mono font-semibold">{fmt(item.value)} TND</div>
                    </div>
                  ))}
                </div>
                {irppResult.total_all != null && (
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <div className="text-xs text-blue-600">Total retenues</div>
                    <div className="text-lg font-mono font-bold text-blue-800">{fmt(irppResult.total_all)} TND</div>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Déclaration Annuelle */}
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center">
                <FileText className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Déclaration Annuelle</h3>
                <p className="text-xs text-gray-500">Récapitulatif annuel des salaires</p>
              </div>
            </div>
            <div className="flex items-center gap-2 mb-4">
              <Select value={String(annualYear)} onValueChange={(v) => setAnnualYear(Number(v))}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleGenerateAnnual} disabled={annualGenerating} size="sm">
                {annualGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Générer'}
              </Button>
            </div>
            {annualResult && (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Employé</TableHead>
                      <TableHead className="text-xs text-right">Brut annuel</TableHead>
                      <TableHead className="text-xs text-right">IRPP annuel</TableHead>
                      <TableHead className="text-xs text-right">CNSS annuel</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(annualResult.employees || []).map((emp, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm">{emp.name}</TableCell>
                        <TableCell className="text-sm text-right font-mono">{fmt(emp.brut_annual)}</TableCell>
                        <TableCell className="text-sm text-right font-mono">{fmt(emp.irpp_annual)}</TableCell>
                        <TableCell className="text-sm text-right font-mono">{fmt(emp.cnss_annual)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </div>

        {/* History */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <History className="w-5 h-5" />
            Historique des déclarations
          </h2>
          <Card>
            {allHistory.length === 0 ? (
              <div className="text-center py-8 text-gray-400">Aucun historique disponible</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Période</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allHistory.map((h, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          {h.created_at ? new Date(h.created_at).toLocaleDateString('fr-TN') : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{h.type}</Badge>
                        </TableCell>
                        <TableCell>{h.period || h.quarter || '—'} {h.year || ''}</TableCell>
                        <TableCell>
                          <Badge className={
                            h.status === 'validated' ? 'bg-green-100 text-green-800'
                            : h.status === 'draft' ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-700'
                          }>
                            {h.status === 'validated' ? 'Validé' : h.status === 'draft' ? 'Brouillon' : h.status || '—'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">{h.total != null ? fmt(h.total) + ' TND' : '—'}</TableCell>
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

export default HRDeclarations;
