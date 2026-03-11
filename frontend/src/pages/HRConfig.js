import React, { useState, useEffect, useCallback } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { useCompany } from '../hooks/useCompany';
import api from '../services/api';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Save, Lock, Plus, Trash2, Loader2, Scale, Building2, Briefcase,
  Calendar, BookOpen, Calculator, Settings, FileText,
} from 'lucide-react';

const HRConfig = () => {
  const { currentCompany } = useCompany();
  const [activeTab, setActiveTab] = useState('irpp');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [financeLaw, setFinanceLaw] = useState('LF 2025');
  const [applyingLaw, setApplyingLaw] = useState(false);

  // IRPP
  const [irppBrackets, setIrppBrackets] = useState([]);
  const [cssRate, setCssRate] = useState('');
  const [familyDeductions, setFamilyDeductions] = useState({
    head_of_family: '', spouse: '', child_1_4: '', child_5_plus: '', parent: '',
  });

  // CNSS
  const [cnssRates, setCnssRates] = useState({
    employee_rate: '', employer_rate: '', accident_sector: 'A',
  });
  const [cnssBreakdown, setCnssBreakdown] = useState([]);

  // Parafiscal
  const [parafiscal, setParafiscal] = useState({
    tfp_industrie: '', tfp_autres: '', tfp_applied: 'industrie',
    foprolos_rate: '', tfp_active: true, foprolos_active: true,
  });

  // SMIG
  const [smig, setSmig] = useState({
    smig_48h_monthly: '', smig_48h_hourly: '',
    smig_40h_monthly: '', smig_40h_hourly: '',
    smag_daily: '', enforce_minimum: true,
  });

  // Contract types
  const [contractTypes, setContractTypes] = useState([]);
  const [newContractLabel, setNewContractLabel] = useState('');

  // Leave types
  const [leaveTypesConfig, setLeaveTypesConfig] = useState([]);
  const [newLeaveLabel, setNewLeaveLabel] = useState('');

  // Rubrics
  const [rubrics, setRubrics] = useState({ gains: [], retenues: [] });
  const [newGainLabel, setNewGainLabel] = useState('');
  const [newRetenueLabel, setNewRetenueLabel] = useState('');

  // Accounting
  const [accounting, setAccounting] = useState({
    journal_code: '', journal_name: '', auto_generate: false,
    grouping: 'global', account_salary: '', account_cnss_employee: '',
    account_cnss_employer: '', account_irpp: '', account_net: '',
    account_charges: '',
  });

  const companyId = currentCompany?.id;

  const loadTabData = useCallback(async (tab) => {
    if (!companyId) return;
    setLoading(true);
    try {
      let res;
      switch (tab) {
        case 'irpp':
          res = await api.get(`/hr/config/irpp?company_id=${companyId}`);
          if (res.data) {
            setIrppBrackets(res.data.brackets || []);
            setCssRate(res.data.css_rate ?? '');
            setFamilyDeductions(res.data.family_deductions || familyDeductions);
          }
          break;
        case 'cnss':
          res = await api.get(`/hr/config/cnss?company_id=${companyId}`);
          if (res.data) {
            setCnssRates({
              employee_rate: res.data.employee_rate ?? '',
              employer_rate: res.data.employer_rate ?? '',
              accident_sector: res.data.accident_sector || 'A',
            });
            setCnssBreakdown(res.data.breakdown || []);
          }
          break;
        case 'parafiscal':
          res = await api.get(`/hr/config/parafiscal?company_id=${companyId}`);
          if (res.data) setParafiscal({ ...parafiscal, ...res.data });
          break;
        case 'smig':
          res = await api.get(`/hr/config/minimum-wages?company_id=${companyId}`);
          if (res.data) setSmig({ ...smig, ...res.data });
          break;
        case 'contrats':
          res = await api.get(`/hr/config/contract-types?company_id=${companyId}`);
          setContractTypes(res.data || []);
          break;
        case 'conges':
          res = await api.get(`/hr/config/leave-types?company_id=${companyId}`);
          setLeaveTypesConfig(res.data || []);
          break;
        case 'rubriques':
          res = await api.get(`/hr/config/rubrics?company_id=${companyId}`);
          if (res.data) setRubrics({ gains: res.data.gains || [], retenues: res.data.retenues || [] });
          break;
        case 'comptabilite':
          res = await api.get(`/hr/config/accounting?company_id=${companyId}`);
          if (res.data) setAccounting({ ...accounting, ...res.data });
          break;
        default:
          break;
      }
    } catch {
      // config not yet set — keep defaults
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadTabData(activeTab);
  }, [activeTab, loadTabData]);

  useEffect(() => {
    if (companyId) {
      api.get(`/hr/finance-laws?company_id=${companyId}`)
        .then((res) => { if (res.data?.active) setFinanceLaw(res.data.active); })
        .catch(() => {});
    }
  }, [companyId]);

  const handleApplyLaw = async (code) => {
    setApplyingLaw(true);
    try {
      await api.post(`/hr/finance-laws/apply/${code}?company_id=${companyId}`);
      setFinanceLaw(code);
      toast.success(`Loi de Finances ${code} appliquée`);
      loadTabData(activeTab);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de l\'application');
    } finally {
      setApplyingLaw(false);
    }
  };

  const saveConfig = async (endpoint, data) => {
    setSaving(true);
    try {
      await api.put(`/hr/config/${endpoint}?company_id=${companyId}`, data);
      toast.success('Configuration sauvegardée');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  // Bracket helpers
  const updateBracket = (idx, field, value) => {
    const updated = [...irppBrackets];
    updated[idx] = { ...updated[idx], [field]: value };
    setIrppBrackets(updated);
  };

  const addBracket = () => {
    setIrppBrackets([...irppBrackets, { min: '', max: '', rate: '', label: '' }]);
  };

  const removeBracket = (idx) => {
    setIrppBrackets(irppBrackets.filter((_, i) => i !== idx));
  };

  // Contract type helpers
  const toggleContractType = (idx) => {
    const updated = [...contractTypes];
    updated[idx] = { ...updated[idx], active: !updated[idx].active };
    setContractTypes(updated);
  };

  const addContractType = () => {
    if (!newContractLabel.trim()) return;
    setContractTypes([...contractTypes, { code: newContractLabel.toLowerCase().replace(/\s+/g, '_'), label: newContractLabel, active: true, locked: false }]);
    setNewContractLabel('');
  };

  // Leave type helpers
  const toggleLeaveType = (idx) => {
    const updated = [...leaveTypesConfig];
    updated[idx] = { ...updated[idx], active: !updated[idx].active };
    setLeaveTypesConfig(updated);
  };

  const updateLeaveDays = (idx, days) => {
    const updated = [...leaveTypesConfig];
    updated[idx] = { ...updated[idx], days: Number(days) || 0 };
    setLeaveTypesConfig(updated);
  };

  const addLeaveType = () => {
    if (!newLeaveLabel.trim()) return;
    setLeaveTypesConfig([...leaveTypesConfig, { code: newLeaveLabel.toLowerCase().replace(/\s+/g, '_'), label: newLeaveLabel, days: 0, active: true, locked: false }]);
    setNewLeaveLabel('');
  };

  // Rubric helpers
  const toggleRubric = (section, idx) => {
    const updated = { ...rubrics };
    updated[section] = [...updated[section]];
    updated[section][idx] = { ...updated[section][idx], active: !updated[section][idx].active };
    setRubrics(updated);
  };

  const addRubric = (section, label) => {
    if (!label.trim()) return;
    const updated = { ...rubrics };
    updated[section] = [...updated[section], { code: label.toLowerCase().replace(/\s+/g, '_'), label, active: true, locked: false }];
    setRubrics(updated);
    if (section === 'gains') setNewGainLabel('');
    else setNewRetenueLabel('');
  };

  if (!currentCompany) {
    return <AppLayout><div className="text-center py-20 text-gray-500">Aucune entreprise sélectionnée</div></AppLayout>;
  }

  const SaveButton = ({ onClick }) => (
    <Button onClick={onClick} disabled={saving} className="mt-4">
      {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
      {saving ? 'Sauvegarde...' : 'Sauvegarder'}
    </Button>
  );

  return (
    <AppLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configuration RH</h1>
          <p className="text-sm text-gray-500 mt-1">Paramétrage des barèmes, cotisations et rubriques</p>
        </div>

        {/* Finance Law Banner */}
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-blue-600" />
              <span className="font-semibold text-blue-900">Loi de Finances active : {financeLaw}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={applyingLaw || financeLaw === 'LF 2024'}
                onClick={() => handleApplyLaw('LF 2024')}
              >
                Charger LF 2024
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={applyingLaw || financeLaw === 'LF 2025'}
                onClick={() => handleApplyLaw('LF 2025')}
              >
                Charger LF 2025
              </Button>
            </div>
          </div>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="overflow-x-auto">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="irpp">IRPP</TabsTrigger>
              <TabsTrigger value="cnss">CNSS</TabsTrigger>
              <TabsTrigger value="parafiscal">TFP/FOPROLOS</TabsTrigger>
              <TabsTrigger value="smig">SMIG</TabsTrigger>
              <TabsTrigger value="contrats">Contrats</TabsTrigger>
              <TabsTrigger value="conges">Congés</TabsTrigger>
              <TabsTrigger value="rubriques">Rubriques</TabsTrigger>
              <TabsTrigger value="comptabilite">Comptabilité</TabsTrigger>
            </TabsList>
          </div>

          {loading && (
            <div className="text-center py-10 text-gray-400">Chargement...</div>
          )}

          {/* IRPP Tab */}
          <TabsContent value="irpp">
            <Card className="p-5 space-y-6">
              <h3 className="font-semibold text-gray-900">Barème IRPP</h3>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Min (TND)</TableHead>
                      <TableHead>Max (TND)</TableHead>
                      <TableHead>Taux (%)</TableHead>
                      <TableHead>Libellé</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {irppBrackets.map((b, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <Input
                            type="number"
                            value={b.min}
                            onChange={(e) => updateBracket(idx, 'min', e.target.value)}
                            className="w-28"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={b.max}
                            onChange={(e) => updateBracket(idx, 'max', e.target.value)}
                            className="w-28"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={b.rate}
                            onChange={(e) => updateBracket(idx, 'rate', e.target.value)}
                            className="w-20"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={b.label || ''}
                            onChange={(e) => updateBracket(idx, 'label', e.target.value)}
                            className="w-40"
                          />
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => removeBracket(idx)}>
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Button variant="outline" size="sm" onClick={addBracket}>
                <Plus className="w-4 h-4 mr-1" /> Ajouter une tranche
              </Button>

              <div className="border-t pt-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Taux CSS (%)</Label>
                    <Input
                      type="number"
                      value={cssRate}
                      onChange={(e) => setCssRate(e.target.value)}
                      className="w-32"
                    />
                  </div>
                </div>
                <h4 className="font-medium text-gray-700">Déductions familiales (TND/an)</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {[
                    { key: 'head_of_family', label: 'Chef de famille' },
                    { key: 'spouse', label: 'Conjoint' },
                    { key: 'child_1_4', label: 'Enfant (1-4)' },
                    { key: 'child_5_plus', label: 'Enfant (5+)' },
                    { key: 'parent', label: 'Parent à charge' },
                  ].map((f) => (
                    <div key={f.key} className="space-y-1">
                      <Label className="text-xs">{f.label}</Label>
                      <Input
                        type="number"
                        value={familyDeductions[f.key] || ''}
                        onChange={(e) => setFamilyDeductions({ ...familyDeductions, [f.key]: e.target.value })}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <SaveButton onClick={() => saveConfig('irpp', {
                brackets: irppBrackets, css_rate: cssRate, family_deductions: familyDeductions,
              })} />
            </Card>
          </TabsContent>

          {/* CNSS Tab */}
          <TabsContent value="cnss">
            <Card className="p-5 space-y-6">
              <h3 className="font-semibold text-gray-900">Cotisations CNSS</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Taux salarié (%)</Label>
                  <Input
                    type="number"
                    value={cnssRates.employee_rate}
                    onChange={(e) => setCnssRates({ ...cnssRates, employee_rate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Taux patronal (%)</Label>
                  <Input
                    type="number"
                    value={cnssRates.employer_rate}
                    onChange={(e) => setCnssRates({ ...cnssRates, employer_rate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Secteur accident</Label>
                  <Select
                    value={cnssRates.accident_sector}
                    onValueChange={(v) => setCnssRates({ ...cnssRates, accident_sector: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['A', 'B', 'C', 'D', 'E'].map((s) => (
                        <SelectItem key={s} value={s}>Groupe {s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {cnssBreakdown.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">Détail des cotisations</h4>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Branche</TableHead>
                          <TableHead className="text-right">Salarié (%)</TableHead>
                          <TableHead className="text-right">Patronal (%)</TableHead>
                          <TableHead className="text-right">Total (%)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cnssBreakdown.map((row, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{row.label}</TableCell>
                            <TableCell className="text-right font-mono">{row.employee ?? '—'}</TableCell>
                            <TableCell className="text-right font-mono">{row.employer ?? '—'}</TableCell>
                            <TableCell className="text-right font-mono font-medium">
                              {((Number(row.employee) || 0) + (Number(row.employer) || 0)).toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              <SaveButton onClick={() => saveConfig('cnss', cnssRates)} />
            </Card>
          </TabsContent>

          {/* TFP/FOPROLOS Tab */}
          <TabsContent value="parafiscal">
            <Card className="p-5 space-y-6">
              <h3 className="font-semibold text-gray-900">TFP & FOPROLOS</h3>
              <div className="space-y-4">
                <h4 className="font-medium text-gray-700">TFP (Taxe de Formation Professionnelle)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Taux industrie (%)</Label>
                    <Input
                      type="number"
                      value={parafiscal.tfp_industrie}
                      onChange={(e) => setParafiscal({ ...parafiscal, tfp_industrie: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Taux autres (%)</Label>
                    <Input
                      type="number"
                      value={parafiscal.tfp_autres}
                      onChange={(e) => setParafiscal({ ...parafiscal, tfp_autres: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Taux appliqué</Label>
                    <Select
                      value={parafiscal.tfp_applied}
                      onValueChange={(v) => setParafiscal({ ...parafiscal, tfp_applied: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="industrie">Industrie</SelectItem>
                        <SelectItem value="autres">Autres</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={parafiscal.tfp_active}
                    onCheckedChange={(v) => setParafiscal({ ...parafiscal, tfp_active: v })}
                  />
                  <Label>TFP active</Label>
                </div>
              </div>

              <div className="border-t pt-4 space-y-4">
                <h4 className="font-medium text-gray-700">FOPROLOS</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Taux FOPROLOS (%)</Label>
                    <Input
                      type="number"
                      value={parafiscal.foprolos_rate}
                      onChange={(e) => setParafiscal({ ...parafiscal, foprolos_rate: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={parafiscal.foprolos_active}
                    onCheckedChange={(v) => setParafiscal({ ...parafiscal, foprolos_active: v })}
                  />
                  <Label>FOPROLOS active</Label>
                </div>
              </div>

              <SaveButton onClick={() => saveConfig('parafiscal', parafiscal)} />
            </Card>
          </TabsContent>

          {/* SMIG Tab */}
          <TabsContent value="smig">
            <Card className="p-5 space-y-6">
              <h3 className="font-semibold text-gray-900">Salaires Minimums</h3>
              <div className="space-y-4">
                <h4 className="font-medium text-gray-700">SMIG 48h</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Mensuel (TND)</Label>
                    <Input
                      type="number"
                      value={smig.smig_48h_monthly}
                      onChange={(e) => setSmig({ ...smig, smig_48h_monthly: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Horaire (TND)</Label>
                    <Input
                      type="number"
                      value={smig.smig_48h_hourly}
                      onChange={(e) => setSmig({ ...smig, smig_48h_hourly: e.target.value })}
                    />
                  </div>
                </div>
                <h4 className="font-medium text-gray-700">SMIG 40h</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Mensuel (TND)</Label>
                    <Input
                      type="number"
                      value={smig.smig_40h_monthly}
                      onChange={(e) => setSmig({ ...smig, smig_40h_monthly: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Horaire (TND)</Label>
                    <Input
                      type="number"
                      value={smig.smig_40h_hourly}
                      onChange={(e) => setSmig({ ...smig, smig_40h_hourly: e.target.value })}
                    />
                  </div>
                </div>
                <h4 className="font-medium text-gray-700">SMAG</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Journalier (TND)</Label>
                    <Input
                      type="number"
                      value={smig.smag_daily}
                      onChange={(e) => setSmig({ ...smig, smag_daily: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={smig.enforce_minimum}
                    onCheckedChange={(v) => setSmig({ ...smig, enforce_minimum: v })}
                  />
                  <Label>Appliquer le contrôle du salaire minimum</Label>
                </div>
              </div>
              <SaveButton onClick={() => saveConfig('minimum-wages', smig)} />
            </Card>
          </TabsContent>

          {/* Contrats Tab */}
          <TabsContent value="contrats">
            <Card className="p-5 space-y-4">
              <h3 className="font-semibold text-gray-900">Types de contrats</h3>
              <div className="space-y-2">
                {contractTypes.map((ct, idx) => (
                  <div key={ct.code || idx} className="flex items-center justify-between py-2 px-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={ct.active}
                        onCheckedChange={() => toggleContractType(idx)}
                        disabled={ct.locked}
                      />
                      <span className="text-sm font-medium">{ct.label}</span>
                      {ct.locked && <Lock className="w-3.5 h-3.5 text-gray-400" />}
                    </div>
                    <Badge variant="outline" className={ct.active ? 'text-green-700' : 'text-gray-400'}>
                      {ct.active ? 'Actif' : 'Inactif'}
                    </Badge>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 pt-2">
                <Input
                  value={newContractLabel}
                  onChange={(e) => setNewContractLabel(e.target.value)}
                  placeholder="Nouveau type de contrat"
                  className="max-w-xs"
                  onKeyDown={(e) => e.key === 'Enter' && addContractType()}
                />
                <Button variant="outline" size="sm" onClick={addContractType}>
                  <Plus className="w-4 h-4 mr-1" /> Ajouter
                </Button>
              </div>
              <SaveButton onClick={() => saveConfig('contract-types', contractTypes)} />
            </Card>
          </TabsContent>

          {/* Congés Tab */}
          <TabsContent value="conges">
            <Card className="p-5 space-y-4">
              <h3 className="font-semibold text-gray-900">Types de congés</h3>
              <div className="space-y-2">
                {leaveTypesConfig.map((lt, idx) => (
                  <div key={lt.code || idx} className="flex items-center justify-between py-2 px-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={lt.active}
                        onCheckedChange={() => toggleLeaveType(idx)}
                        disabled={lt.locked}
                      />
                      <span className="text-sm font-medium">{lt.label}</span>
                      {lt.locked && <Lock className="w-3.5 h-3.5 text-gray-400" />}
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={lt.days}
                        onChange={(e) => updateLeaveDays(idx, e.target.value)}
                        className="w-20 text-center"
                      />
                      <span className="text-xs text-gray-500">jours</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 pt-2">
                <Input
                  value={newLeaveLabel}
                  onChange={(e) => setNewLeaveLabel(e.target.value)}
                  placeholder="Nouveau type de congé"
                  className="max-w-xs"
                  onKeyDown={(e) => e.key === 'Enter' && addLeaveType()}
                />
                <Button variant="outline" size="sm" onClick={addLeaveType}>
                  <Plus className="w-4 h-4 mr-1" /> Ajouter
                </Button>
              </div>
              <SaveButton onClick={() => saveConfig('leave-types', leaveTypesConfig)} />
            </Card>
          </TabsContent>

          {/* Rubriques Tab */}
          <TabsContent value="rubriques">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Gains */}
              <Card className="p-5 space-y-4">
                <h3 className="font-semibold text-green-700">Gains</h3>
                <div className="space-y-2">
                  {rubrics.gains.map((r, idx) => (
                    <div key={r.code || idx} className="flex items-center justify-between py-2 px-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={r.active}
                          onCheckedChange={() => toggleRubric('gains', idx)}
                          disabled={r.locked}
                        />
                        <span className="text-sm font-medium">{r.label}</span>
                        {r.locked && <Lock className="w-3.5 h-3.5 text-gray-400" />}
                      </div>
                      <Badge variant="outline" className={r.active ? 'text-green-700' : 'text-gray-400'}>
                        {r.active ? 'ON' : 'OFF'}
                      </Badge>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    value={newGainLabel}
                    onChange={(e) => setNewGainLabel(e.target.value)}
                    placeholder="Nouvelle rubrique"
                    className="max-w-xs"
                    onKeyDown={(e) => e.key === 'Enter' && addRubric('gains', newGainLabel)}
                  />
                  <Button variant="outline" size="sm" onClick={() => addRubric('gains', newGainLabel)}>
                    <Plus className="w-4 h-4 mr-1" /> Ajouter
                  </Button>
                </div>
              </Card>

              {/* Retenues */}
              <Card className="p-5 space-y-4">
                <h3 className="font-semibold text-red-700">Retenues</h3>
                <div className="space-y-2">
                  {rubrics.retenues.map((r, idx) => (
                    <div key={r.code || idx} className="flex items-center justify-between py-2 px-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={r.active}
                          onCheckedChange={() => toggleRubric('retenues', idx)}
                          disabled={r.locked}
                        />
                        <span className="text-sm font-medium">{r.label}</span>
                        {r.locked && <Lock className="w-3.5 h-3.5 text-gray-400" />}
                      </div>
                      <Badge variant="outline" className={r.active ? 'text-red-700' : 'text-gray-400'}>
                        {r.active ? 'ON' : 'OFF'}
                      </Badge>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    value={newRetenueLabel}
                    onChange={(e) => setNewRetenueLabel(e.target.value)}
                    placeholder="Nouvelle rubrique"
                    className="max-w-xs"
                    onKeyDown={(e) => e.key === 'Enter' && addRubric('retenues', newRetenueLabel)}
                  />
                  <Button variant="outline" size="sm" onClick={() => addRubric('retenues', newRetenueLabel)}>
                    <Plus className="w-4 h-4 mr-1" /> Ajouter
                  </Button>
                </div>
              </Card>
            </div>
            <div className="mt-4">
              <SaveButton onClick={() => saveConfig('rubrics', rubrics)} />
            </div>
          </TabsContent>

          {/* Comptabilité Tab */}
          <TabsContent value="comptabilite">
            <Card className="p-5 space-y-6">
              <h3 className="font-semibold text-gray-900">Paramétrage comptable</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Code journal</Label>
                  <Input
                    value={accounting.journal_code}
                    onChange={(e) => setAccounting({ ...accounting, journal_code: e.target.value })}
                    placeholder="ex: PAI"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nom du journal</Label>
                  <Input
                    value={accounting.journal_name}
                    onChange={(e) => setAccounting({ ...accounting, journal_name: e.target.value })}
                    placeholder="ex: Journal de paie"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  checked={accounting.auto_generate}
                  onCheckedChange={(v) => setAccounting({ ...accounting, auto_generate: v })}
                />
                <Label>Générer automatiquement les écritures à la validation de la paie</Label>
              </div>

              <div className="space-y-2">
                <Label>Regroupement des écritures</Label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="grouping"
                      value="global"
                      checked={accounting.grouping === 'global'}
                      onChange={(e) => setAccounting({ ...accounting, grouping: e.target.value })}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm">Global (une écriture pour tous)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="grouping"
                      value="individuel"
                      checked={accounting.grouping === 'individuel'}
                      onChange={(e) => setAccounting({ ...accounting, grouping: e.target.value })}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm">Individuel (une écriture par employé)</span>
                  </label>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium text-gray-700 mb-3">Comptes comptables</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { key: 'account_salary', label: 'Charges de personnel (salaires)' },
                    { key: 'account_cnss_employee', label: 'CNSS salarié' },
                    { key: 'account_cnss_employer', label: 'CNSS patronal' },
                    { key: 'account_irpp', label: 'IRPP à payer' },
                    { key: 'account_net', label: 'Rémunérations dues' },
                    { key: 'account_charges', label: 'Charges sociales patronales' },
                  ].map((acc) => (
                    <div key={acc.key} className="space-y-1">
                      <Label className="text-xs">{acc.label}</Label>
                      <Input
                        value={accounting[acc.key] || ''}
                        onChange={(e) => setAccounting({ ...accounting, [acc.key]: e.target.value })}
                        placeholder="ex: 641000"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <SaveButton onClick={() => saveConfig('accounting', accounting)} />
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default HRConfig;
