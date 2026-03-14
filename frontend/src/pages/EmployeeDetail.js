import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useCompany } from '../hooks/useCompany';
import AppLayout from '../components/layout/AppLayout';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Label } from '../components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Textarea } from '../components/ui/textarea';
import {
  ArrowLeft,
  User,
  FileText,
  Banknote,
  CalendarDays,
  Receipt,
  Plus,
  Phone,
  Mail,
  CreditCard,
  Building2,
  Users,
  Briefcase,
  Calendar,
  Clock,
  Download,
} from 'lucide-react';
import { toast } from 'sonner';

const STATUS_CONFIG = {
  actif: { label: 'Actif', className: 'bg-green-100 text-green-800' },
  en_congé: { label: 'En congé', className: 'bg-yellow-100 text-yellow-800' },
  terminé: { label: 'Terminé', className: 'bg-red-100 text-red-800' },
};

const EmployeeDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentCompany } = useCompany();

  const [employee, setEmployee] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [leaveBalance, setLeaveBalance] = useState(null);
  const [recentLeaves, setRecentLeaves] = useState([]);
  const [payslips, setPayslips] = useState([]);
  const [contractTypes, setContractTypes] = useState([]);
  const [loading, setLoading] = useState(true);

  const [contractModal, setContractModal] = useState(false);
  const [contractForm, setContractForm] = useState({
    contract_type: '',
    start_date: '',
    end_date: '',
    salary: '',
    notes: '',
  });
  const [savingContract, setSavingContract] = useState(false);

  useEffect(() => {
    if (currentCompany && id) {
      loadAll();
    }
  }, [currentCompany, id]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [empRes, contractsRes, balanceRes, leavesRes, payslipsRes, typesRes] = await Promise.allSettled([
        api.get(`/hr/employees/${id}?company_id=${currentCompany.id}`),
        api.get(`/hr/employees/${id}/contracts?company_id=${currentCompany.id}`),
        api.get(`/hr/leaves/balance/${id}?company_id=${currentCompany.id}`),
        api.get(`/hr/employees/${id}/leaves?company_id=${currentCompany.id}`),
        api.get(`/hr/payroll?company_id=${currentCompany.id}&employee_id=${id}`),
        api.get(`/hr/contract-types?company_id=${currentCompany.id}`),
      ]);

      if (empRes.status === 'fulfilled') setEmployee(empRes.value.data);
      if (contractsRes.status === 'fulfilled') setContracts(contractsRes.value.data);
      if (balanceRes.status === 'fulfilled') setLeaveBalance(balanceRes.value.data);
      if (leavesRes.status === 'fulfilled') setRecentLeaves(leavesRes.value.data);
      if (payslipsRes.status === 'fulfilled') setPayslips(Array.isArray(payslipsRes.value.data) ? payslipsRes.value.data : []);
      if (typesRes.status === 'fulfilled') setContractTypes(Array.isArray(typesRes.value.data) ? typesRes.value.data : []);
    } catch (error) {
      console.error('Error loading employee details:', error);
      toast.error('Erreur de chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const handleAddContract = async () => {
    if (!contractForm.contract_type || !contractForm.start_date) {
      toast.error('Le type de contrat et la date de début sont obligatoires');
      return;
    }
    setSavingContract(true);
    try {
      await api.post(`/hr/employees/${id}/contracts?company_id=${currentCompany.id}`, {
        ...contractForm,
        salary: contractForm.salary ? parseFloat(contractForm.salary) : null,
      });
      toast.success('Contrat ajouté avec succès');
      setContractModal(false);
      setContractForm({ contract_type: '', start_date: '', end_date: '', salary: '', notes: '' });
      const res = await api.get(`/hr/employees/${id}/contracts?company_id=${currentCompany.id}`);
      setContracts(res.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de l\'ajout du contrat');
    } finally {
      setSavingContract(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('fr-FR');
  };

  const computeSeniority = (hireDate) => {
    if (!hireDate) return '-';
    const start = new Date(hireDate);
    const now = new Date();
    const years = now.getFullYear() - start.getFullYear();
    const months = now.getMonth() - start.getMonth();
    const totalMonths = years * 12 + months;
    const y = Math.floor(totalMonths / 12);
    const m = totalMonths % 12;
    if (y > 0) return `${y} an${y > 1 ? 's' : ''} ${m > 0 ? `et ${m} mois` : ''}`;
    return `${m} mois`;
  };

  if (!currentCompany) {
    return <AppLayout><div className="text-center py-20">Aucune entreprise sélectionnée</div></AppLayout>;
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="p-16 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 mx-auto"></div>
        </div>
      </AppLayout>
    );
  }

  if (!employee) {
    return (
      <AppLayout>
        <div className="text-center py-20">
          <User className="mx-auto mb-4 h-12 w-12 text-slate-300" />
          <p className="text-slate-500">Employé introuvable</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/hr/employees')}>
            Retour à la liste
          </Button>
        </div>
      </AppLayout>
    );
  }

  const statusCfg = STATUS_CONFIG[employee.status] || STATUS_CONFIG.actif;

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={() => navigate('/hr/employees')}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Retour
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-violet-100 rounded-full flex items-center justify-center text-violet-600 font-bold text-lg">
                {employee.first_name?.charAt(0)}{employee.last_name?.charAt(0)}
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-[-0.03em] text-slate-900">{employee.first_name} {employee.last_name}</h1>
                <p className="text-sm text-slate-500">{employee.position || 'Poste non défini'} &bull; {employee.department || 'Département non défini'}</p>
              </div>
            </div>
          </div>
          <Badge className={`${statusCfg.className} text-sm px-3 py-1`}>{statusCfg.label}</Badge>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="informations">
          <TabsList className="bg-slate-100 p-1">
            <TabsTrigger value="informations" className="data-[state=active]:bg-white">
              <User className="w-4 h-4 mr-1.5" /> Informations
            </TabsTrigger>
            <TabsTrigger value="contrats" className="data-[state=active]:bg-white">
              <FileText className="w-4 h-4 mr-1.5" /> Contrats
            </TabsTrigger>
            <TabsTrigger value="remuneration" className="data-[state=active]:bg-white">
              <Banknote className="w-4 h-4 mr-1.5" /> Rémunération
            </TabsTrigger>
            <TabsTrigger value="conges" className="data-[state=active]:bg-white">
              <CalendarDays className="w-4 h-4 mr-1.5" /> Congés
            </TabsTrigger>
            <TabsTrigger value="bulletins" className="data-[state=active]:bg-white">
              <Receipt className="w-4 h-4 mr-1.5" /> Bulletins
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Informations */}
          <TabsContent value="informations">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-6">
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-700">Informations personnelles</h3>
                <div className="space-y-3">
                  <InfoRow icon={<User className="w-4 h-4" />} label="Nom complet" value={`${employee.first_name} ${employee.last_name}`} />
                  <InfoRow icon={<CreditCard className="w-4 h-4" />} label="CIN" value={employee.cin} />
                  <InfoRow icon={<Calendar className="w-4 h-4" />} label="Date de naissance" value={formatDate(employee.date_of_birth)} />
                  <InfoRow icon={<User className="w-4 h-4" />} label="Genre" value={employee.gender === 'M' ? 'Masculin' : 'Féminin'} />
                  <InfoRow icon={<Phone className="w-4 h-4" />} label="Téléphone" value={employee.phone} />
                  <InfoRow icon={<Mail className="w-4 h-4" />} label="Email" value={employee.email} />
                  <InfoRow icon={<Users className="w-4 h-4" />} label="Situation familiale" value={employee.marital_status} />
                  <InfoRow icon={<Users className="w-4 h-4" />} label="Enfants" value={employee.children_count ?? 0} />
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-700">Informations bancaires</h3>
                <div className="space-y-3">
                  <InfoRow icon={<Building2 className="w-4 h-4" />} label="Banque" value={employee.bank_name} />
                  <InfoRow icon={<CreditCard className="w-4 h-4" />} label="RIB" value={employee.rib} />
                  <InfoRow icon={<FileText className="w-4 h-4" />} label="N° CNSS" value={employee.cnss_number} />
                  <InfoRow icon={<Banknote className="w-4 h-4" />} label="Mode de paiement" value={employee.payment_method} />
                </div>

                <h3 className="mt-6 mb-4 text-sm font-semibold uppercase tracking-wide text-slate-700">Informations professionnelles</h3>
                <div className="space-y-3">
                  <InfoRow icon={<Briefcase className="w-4 h-4" />} label="Poste" value={employee.position} />
                  <InfoRow icon={<Building2 className="w-4 h-4" />} label="Département" value={employee.department} />
                  <InfoRow icon={<FileText className="w-4 h-4" />} label="Catégorie" value={employee.professional_category} />
                  <InfoRow icon={<Calendar className="w-4 h-4" />} label="Date d'embauche" value={formatDate(employee.hire_date)} />
                  <InfoRow icon={<Clock className="w-4 h-4" />} label="Régime de travail" value={employee.work_regime} />
                  <InfoRow icon={<FileText className="w-4 h-4" />} label="Matricule" value={employee.matricule} />
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* Tab 2: Contrats */}
          <TabsContent value="contrats">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">Contrats</h3>
                <Button onClick={() => setContractModal(true)}>
                  <Plus className="w-4 h-4 mr-2" /> Ajouter un contrat
                </Button>
              </div>

              {contracts.length === 0 ? (
                <p className="text-center text-sm text-slate-400 py-8">Aucun contrat enregistré</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="text-xs font-semibold uppercase text-slate-500">Type</TableHead>
                      <TableHead className="text-xs font-semibold uppercase text-slate-500">Date début</TableHead>
                      <TableHead className="text-xs font-semibold uppercase text-slate-500">Date fin</TableHead>
                      <TableHead className="text-xs font-semibold uppercase text-slate-500">Salaire</TableHead>
                      <TableHead className="text-xs font-semibold uppercase text-slate-500">Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contracts.map((c, index) => {
                      const isActive = !c.end_date || new Date(c.end_date) >= new Date();
                      return (
                        <TableRow key={c.id || index} className="hover:bg-slate-50/80">
                          <TableCell className="font-medium">{c.contract_type || c.type || '-'}</TableCell>
                          <TableCell>{formatDate(c.start_date)}</TableCell>
                          <TableCell>{formatDate(c.end_date)}</TableCell>
                          <TableCell>
                            {c.salary != null
                              ? `${parseFloat(c.salary).toLocaleString('fr-FR', { minimumFractionDigits: 3 })} TND`
                              : '-'}
                          </TableCell>
                          <TableCell>
                            <Badge className={isActive ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}>
                              {isActive ? 'Actif' : 'Expiré'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </Card>
          </TabsContent>

          {/* Tab 3: Rémunération */}
          <TabsContent value="remuneration">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-6">
                <h3 className="mb-4 text-lg font-semibold text-slate-900">Salaire de base</h3>
                <div className="bg-violet-50 rounded-xl p-6 text-center">
                  <p className="text-sm text-violet-600 mb-1">Salaire mensuel brut</p>
                  <p className="text-3xl font-bold text-violet-700">
                    {employee.base_salary != null
                      ? parseFloat(employee.base_salary).toLocaleString('fr-FR', { minimumFractionDigits: 3 })
                      : '0.000'}
                    <span className="text-lg ml-1">TND</span>
                  </p>
                </div>

                <div className="mt-6 space-y-3">
                  <InfoRow icon={<Briefcase className="w-4 h-4" />} label="Catégorie" value={employee.professional_category} />
                  <InfoRow icon={<Clock className="w-4 h-4" />} label="Régime" value={employee.work_regime} />
                  <InfoRow icon={<Calendar className="w-4 h-4" />} label="Ancienneté" value={computeSeniority(employee.hire_date)} />
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="mb-4 text-lg font-semibold text-slate-900">Primes mensuelles</h3>
                {(!employee.primes || employee.primes.length === 0) ? (
                  <p className="py-8 text-center text-sm text-slate-400">Aucune prime définie</p>
                ) : (
                  <div className="space-y-2">
                    {employee.primes.map((prime, index) => (
                      <div key={index} className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{prime.name}</p>
                          <p className="font-mono text-xs text-slate-500">{prime.code}</p>
                        </div>
                        <span className="text-sm font-semibold text-slate-900">
                          {parseFloat(prime.amount || 0).toLocaleString('fr-FR', { minimumFractionDigits: 3 })} TND
                        </span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between p-3 bg-violet-50 rounded-lg border border-violet-200 mt-3">
                      <span className="text-sm font-semibold text-violet-700">Total primes</span>
                      <span className="text-sm font-bold text-violet-700">
                        {employee.primes.reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0).toLocaleString('fr-FR', { minimumFractionDigits: 3 })} TND
                      </span>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          </TabsContent>

          {/* Tab 4: Congés */}
          <TabsContent value="conges">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Leave Balance */}
              <Card className="p-6">
                <h3 className="mb-4 text-lg font-semibold text-slate-900">Solde de congés</h3>
                {leaveBalance ? (
                  <div className="space-y-4">
                    <div className="bg-blue-50 rounded-xl p-4 text-center">
                      <p className="text-sm text-blue-600 mb-1">Jours disponibles</p>
                      <p className="text-3xl font-bold text-blue-700">{leaveBalance.available ?? 0}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-green-50 rounded-lg p-3 text-center">
                        <p className="text-xs text-green-600">Acquis</p>
                        <p className="text-lg font-bold text-green-700">{leaveBalance.earned ?? 0}</p>
                      </div>
                      <div className="bg-orange-50 rounded-lg p-3 text-center">
                        <p className="text-xs text-orange-600">Consommés</p>
                        <p className="text-lg font-bold text-orange-700">{leaveBalance.used ?? 0}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="py-8 text-center text-sm text-slate-400">Données non disponibles</p>
                )}
              </Card>

              {/* Recent Leaves */}
              <Card className="p-6 lg:col-span-2">
                <h3 className="mb-4 text-lg font-semibold text-slate-900">Demandes de congés récentes</h3>
                {recentLeaves.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-400">Aucune demande de congé</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="text-xs font-semibold uppercase text-slate-500">Type</TableHead>
                        <TableHead className="text-xs font-semibold uppercase text-slate-500">Du</TableHead>
                        <TableHead className="text-xs font-semibold uppercase text-slate-500">Au</TableHead>
                        <TableHead className="text-xs font-semibold uppercase text-slate-500">Jours</TableHead>
                        <TableHead className="text-xs font-semibold uppercase text-slate-500">Statut</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentLeaves.map((leave, index) => (
                        <TableRow key={leave.id || index} className="hover:bg-slate-50/80">
                          <TableCell className="text-sm">{leave.type || leave.leave_type || '-'}</TableCell>
                          <TableCell className="text-sm">{formatDate(leave.start_date)}</TableCell>
                          <TableCell className="text-sm">{formatDate(leave.end_date)}</TableCell>
                          <TableCell className="text-sm font-medium">{leave.days ?? '-'}</TableCell>
                          <TableCell>
                            <Badge className={
                              leave.status === 'approved' ? 'bg-green-100 text-green-800'
                                : leave.status === 'pending' ? 'bg-yellow-100 text-yellow-800'
                                : leave.status === 'rejected' ? 'bg-red-100 text-red-800'
                                : 'bg-slate-100 text-slate-600'
                            }>
                              {leave.status === 'approved' ? 'Approuvé'
                                : leave.status === 'pending' ? 'En attente'
                                : leave.status === 'rejected' ? 'Refusé'
                                : leave.status || '-'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Card>
            </div>
          </TabsContent>

          {/* Tab 5: Bulletins */}
          <TabsContent value="bulletins">
            <Card className="p-6">
              <h3 className="mb-4 text-lg font-semibold text-slate-900">Bulletins de paie</h3>
              {payslips.length === 0 ? (
                <div className="text-center py-12">
                  <Receipt className="mx-auto mb-4 h-12 w-12 text-slate-300" />
                  <p className="text-slate-500">Aucun bulletin de paie généré</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="text-xs font-semibold uppercase text-slate-500">Période</TableHead>
                      <TableHead className="text-xs font-semibold uppercase text-slate-500">Salaire brut</TableHead>
                      <TableHead className="text-xs font-semibold uppercase text-slate-500">Retenues</TableHead>
                      <TableHead className="text-xs font-semibold uppercase text-slate-500">Net à payer</TableHead>
                      <TableHead className="text-xs font-semibold uppercase text-slate-500">Statut</TableHead>
                      <TableHead className="text-right text-xs font-semibold uppercase text-slate-500">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payslips.map((slip, index) => (
                      <TableRow key={slip.id || index} className="hover:bg-slate-50/80">
                        <TableCell className="text-sm font-medium">{slip.period || `${slip.month}/${slip.year}` || '-'}</TableCell>
                        <TableCell className="text-sm">
                          {slip.gross_salary != null
                            ? `${parseFloat(slip.gross_salary).toLocaleString('fr-FR', { minimumFractionDigits: 3 })} TND`
                            : '-'}
                        </TableCell>
                        <TableCell className="text-sm text-red-600">
                          {slip.deductions != null
                            ? `- ${parseFloat(slip.deductions).toLocaleString('fr-FR', { minimumFractionDigits: 3 })} TND`
                            : '-'}
                        </TableCell>
                        <TableCell className="text-sm font-semibold text-green-700">
                          {slip.net_salary != null
                            ? `${parseFloat(slip.net_salary).toLocaleString('fr-FR', { minimumFractionDigits: 3 })} TND`
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge className={
                            slip.status === 'paid' ? 'bg-green-100 text-green-800'
                              : slip.status === 'draft' ? 'bg-slate-100 text-slate-600'
                              : 'bg-yellow-100 text-yellow-800'
                          }>
                            {slip.status === 'paid' ? 'Payé' : slip.status === 'draft' ? 'Brouillon' : slip.status || '-'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="text-violet-600">
                            <Download className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Contract Modal */}
      <Dialog open={contractModal} onOpenChange={setContractModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Ajouter un contrat</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Type de contrat *</Label>
              {contractTypes.length > 0 ? (
                <Select value={contractForm.contract_type} onValueChange={(v) => setContractForm(prev => ({ ...prev, contract_type: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    {contractTypes.map(ct => (
                      <SelectItem key={ct.value || ct.id || ct} value={ct.value || ct.id || ct}>
                        {ct.label || ct.name || ct}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={contractForm.contract_type}
                  onChange={(e) => setContractForm(prev => ({ ...prev, contract_type: e.target.value }))}
                  placeholder="ex: CDI, CDD, Stage..."
                  className="mt-1"
                />
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Date de début *</Label>
                <Input
                  type="date"
                  value={contractForm.start_date}
                  onChange={(e) => setContractForm(prev => ({ ...prev, start_date: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Date de fin</Label>
                <Input
                  type="date"
                  value={contractForm.end_date}
                  onChange={(e) => setContractForm(prev => ({ ...prev, end_date: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label>Salaire (TND)</Label>
              <Input
                type="number"
                step="0.001"
                value={contractForm.salary}
                onChange={(e) => setContractForm(prev => ({ ...prev, salary: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={contractForm.notes}
                onChange={(e) => setContractForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Remarques éventuelles..."
                className="mt-1"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContractModal(false)}>Annuler</Button>
            <Button onClick={handleAddContract} disabled={savingContract}>
              {savingContract ? 'Enregistrement...' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

const InfoRow = ({ icon, label, value }) => (
  <div className="flex items-center gap-3 border-b border-slate-50 py-2 last:border-0">
    <span className="text-slate-400">{icon}</span>
    <span className="w-36 text-sm text-slate-500">{label}</span>
    <span className="text-sm font-medium text-slate-900">{value || '-'}</span>
  </div>
);

export default EmployeeDetail;