import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { hrEmployeesAPI } from '../services/api';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
  Plus,
  Search,
  Eye,
  Edit,
  Trash2,
  MoreVertical,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

const PROFESSIONAL_CATEGORIES = [
  { value: 'ouvrier', label: 'Ouvrier' },
  { value: 'employe', label: 'Employé' },
  { value: 'technicien', label: 'Technicien' },
  { value: 'agent_maitrise', label: 'Agent de maîtrise' },
  { value: 'cadre', label: 'Cadre' },
  { value: 'cadre_superieur', label: 'Cadre supérieur' },
];

const WORK_REGIMES = [
  { value: '48h', label: '48h / semaine' },
  { value: '40h', label: '40h / semaine' },
];

const PAYMENT_METHODS = [
  { value: 'virement', label: 'Virement bancaire' },
  { value: 'cheque', label: 'Chèque' },
  { value: 'especes', label: 'Espèces' },
];

const MARITAL_STATUSES = [
  { value: 'celibataire', label: 'Célibataire' },
  { value: 'marie', label: 'Marié(e)' },
  { value: 'divorce', label: 'Divorcé(e)' },
  { value: 'veuf', label: 'Veuf/Veuve' },
];

const STATUS_CONFIG = {
  actif: { label: 'Actif', className: 'bg-green-100 text-green-800' },
  en_congé: { label: 'En congé', className: 'bg-yellow-100 text-yellow-800' },
  terminé: { label: 'Terminé', className: 'bg-red-100 text-red-800' },
};

const INITIAL_FORM = {
  first_name: '',
  last_name: '',
  cin: '',
  date_of_birth: '',
  gender: 'M',
  phone: '',
  email: '',
  department: '',
  position: '',
  professional_category: '',
  base_salary: '',
  net_target: '',
  hire_date: '',
  marital_status: 'celibataire',
  children_count: 0,
  bank_name: '',
  rib: '',
  cnss_number: '',
  work_regime: '48h',
  payment_method: 'virement',
  salary_input_mode: 'net_target',
  primes: [],
  mandatory_primes: [],
  salary_breakdown_snapshot: null,
};

const Employees = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentCompany } = useCompany();

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [form, setForm] = useState({ ...INITIAL_FORM });
  const [saving, setSaving] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  const loadEmployees = useCallback(async () => {
    if (!currentCompany) return;
    setLoading(true);
    try {
      const response = await hrEmployeesAPI.list(currentCompany.id);
      setEmployees(response.data);
    } catch (error) {
      console.error('Error loading employees:', error);
      toast.error('Impossible de charger les employés');
    } finally {
      setLoading(false);
    }
  }, [currentCompany]);

  useEffect(() => {
    if (currentCompany) {
      loadEmployees();
    }
  }, [currentCompany, loadEmployees]);

  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      openCreateModal();
    }
  }, [searchParams]);

  const openCreateModal = () => {
    setEditingEmployee(null);
    setForm({ ...INITIAL_FORM });
    setModalOpen(true);
  };

  const openEditModal = (employee) => {
    setEditingEmployee(employee);
    setForm({
      first_name: employee.first_name || '',
      last_name: employee.last_name || '',
      cin: employee.cin || '',
      date_of_birth: employee.date_of_birth || '',
      gender: employee.gender || 'M',
      phone: employee.phone || '',
      email: employee.email || '',
      department: employee.department || '',
      position: employee.position || '',
      professional_category: employee.professional_category || '',
      base_salary: employee.base_salary_gross ?? employee.base_salary ?? '',
      net_target: employee.net_target ?? '',
      hire_date: employee.hire_date || '',
      marital_status: employee.marital_status || 'celibataire',
      children_count: employee.children_count ?? 0,
      bank_name: employee.bank_name || '',
      rib: employee.rib || '',
      cnss_number: employee.cnss_number || '',
      work_regime: employee.work_regime || '48h',
      payment_method: employee.payment_method || 'virement',
      salary_input_mode: employee.salary_input_mode || 'net_target',
      primes: (employee.primes || []).filter((prime) => !prime.is_mandatory),
      mandatory_primes: employee.mandatory_primes || [],
      salary_breakdown_snapshot: employee.salary_breakdown_snapshot || null,
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.first_name || !form.last_name) {
      toast.error('Le nom et prénom sont obligatoires');
      return;
    }
    if (!parseFloat(form.net_target || 0)) {
      toast.error('Le net mensuel cible est obligatoire');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        base_salary: form.base_salary ? parseFloat(form.base_salary) : 0,
        net_target: form.net_target ? parseFloat(form.net_target) : 0,
        children_count: parseInt(form.children_count) || 0,
        primes: form.primes.map(p => ({ ...p, amount: parseFloat(p.amount) || 0 })),
      };

      if (editingEmployee) {
        await hrEmployeesAPI.update(currentCompany.id, editingEmployee.id, payload);
        toast.success('Employé modifié avec succès');
      } else {
        await hrEmployeesAPI.create(currentCompany.id, payload);
        toast.success('Employé créé avec succès');
      }
      setModalOpen(false);
      loadEmployees();
    } catch (error) {
      console.error('Error saving employee:', error);
      toast.error(error.response?.data?.detail || 'Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (employeeId) => {
    if (!window.confirm('Voulez-vous vraiment supprimer cet employé ?')) return;
    try {
      await hrEmployeesAPI.remove(currentCompany.id, employeeId);
      toast.success('Employé supprimé');
      loadEmployees();
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const updateForm = (field, value) => {
    setForm((prev) => {
      if (field === 'net_target' && !value) {
        return {
          ...prev,
          net_target: value,
          base_salary: '',
          mandatory_primes: [],
          salary_breakdown_snapshot: null,
        };
      }
      return { ...prev, [field]: value };
    });
  };

  useEffect(() => {
    if (!modalOpen || !currentCompany) return undefined;
    if (!form.net_target && !form.base_salary && form.primes.length === 0) {
      setForm((prev) => ({ ...prev, salary_breakdown_snapshot: null, mandatory_primes: [] }));
      return undefined;
    }

    const timer = setTimeout(async () => {
      try {
        setPreviewLoading(true);
        const response = await hrEmployeesAPI.previewSalary(currentCompany.id, {
          base_salary: form.base_salary ? parseFloat(form.base_salary) : 0,
          net_target: form.net_target ? parseFloat(form.net_target) : 0,
          hire_date: form.hire_date,
          work_regime: form.work_regime,
          professional_category: form.professional_category,
          marital_status: form.marital_status,
          children_count: parseInt(form.children_count) || 0,
          salary_input_mode: form.salary_input_mode,
          primes: form.primes.map((prime) => ({
            ...prime,
            amount: parseFloat(prime.amount) || 0,
          })),
        });
        setForm((prev) => ({
          ...prev,
          base_salary: response.data?.base_salary_gross ?? prev.base_salary,
          mandatory_primes: response.data?.mandatory_primes || [],
          salary_breakdown_snapshot: response.data || null,
        }));
      } catch (error) {
        console.error('Error previewing salary:', error);
      } finally {
        setPreviewLoading(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [
    modalOpen,
    currentCompany,
    form.net_target,
    form.base_salary,
    form.hire_date,
    form.work_regime,
    form.professional_category,
    form.marital_status,
    form.children_count,
    form.salary_input_mode,
    form.primes,
  ]);

  const addPrime = () => {
    setForm(prev => ({
      ...prev,
      primes: [...prev.primes, { code: '', name: '', amount: '' }],
    }));
  };

  const updatePrime = (index, field, value) => {
    setForm(prev => {
      const primes = [...prev.primes];
      primes[index] = { ...primes[index], [field]: value };
      return { ...prev, primes };
    });
  };

  const removePrime = (index) => {
    setForm(prev => ({
      ...prev,
      primes: prev.primes.filter((_, i) => i !== index),
    }));
  };

  const departments = [...new Set(employees.map(e => e.department).filter(Boolean))];

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch =
      !searchTerm ||
      `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.matricule?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.department?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || emp.status === statusFilter;
    const matchesDept = departmentFilter === 'all' || emp.department === departmentFilter;
    return matchesSearch && matchesStatus && matchesDept;
  });

  if (!currentCompany) {
    return <AppLayout><div className="text-center py-20">Aucune entreprise sélectionnée</div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="page-header-title">Employés</h1>
            <p className="page-header-subtitle">{filteredEmployees.length} employé{filteredEmployees.length > 1 ? 's' : ''} au total</p>
          </div>
          <Button onClick={openCreateModal}>
            <Plus className="w-4 h-4 mr-2" />
            Nouvel employé
          </Button>
        </div>

        {/* Filters */}
        <Card className="stat-surface p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                placeholder="Rechercher par nom, matricule ou département..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="actif">Actif</SelectItem>
                <SelectItem value="en_congé">En congé</SelectItem>
                <SelectItem value="terminé">Terminé</SelectItem>
              </SelectContent>
            </Select>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Département" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les départements</SelectItem>
                {departments.map(dept => (
                  <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Table */}
        <Card>
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 mx-auto"></div>
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="mx-auto mb-4 h-12 w-12 text-slate-300" />
              <p className="mb-2 text-slate-500">Aucun employé trouvé</p>
              <Button onClick={openCreateModal} className="mt-4">
                <Plus className="w-4 h-4 mr-2" />
                Ajouter votre premier employé
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="text-xs font-semibold uppercase text-slate-500">Matricule</TableHead>
                    <TableHead className="text-xs font-semibold uppercase text-slate-500">Nom complet</TableHead>
                    <TableHead className="text-xs font-semibold uppercase text-slate-500">Poste</TableHead>
                    <TableHead className="text-xs font-semibold uppercase text-slate-500">Département</TableHead>
                    <TableHead className="text-xs font-semibold uppercase text-slate-500">Type contrat</TableHead>
                    <TableHead className="text-xs font-semibold uppercase text-slate-500">Salaire base</TableHead>
                    <TableHead className="text-xs font-semibold uppercase text-slate-500">Statut</TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase text-slate-500">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map((emp) => {
                    const statusCfg = STATUS_CONFIG[emp.status] || STATUS_CONFIG.actif;
                    return (
                      <TableRow key={emp.id} className="hover:bg-slate-50/80">
                        <TableCell className="font-mono text-sm text-slate-600">{emp.matricule || '-'}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-violet-100 rounded-full flex items-center justify-center text-violet-600 font-semibold text-sm">
                              {emp.first_name?.charAt(0)}{emp.last_name?.charAt(0)}
                            </div>
                            <span className="font-medium text-slate-900">{emp.first_name} {emp.last_name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">{emp.position || '-'}</TableCell>
                        <TableCell className="text-sm text-slate-600">{emp.department || '-'}</TableCell>
                        <TableCell className="text-sm text-slate-600">{emp.contract_type || '-'}</TableCell>
                        <TableCell className="text-sm font-medium text-slate-900">
                          {emp.base_salary != null
                            ? parseFloat(emp.base_salary).toLocaleString('fr-FR', { minimumFractionDigits: 3 })
                            : '-'}{' '}
                          <span className="text-xs text-slate-500">TND</span>
                        </TableCell>
                        <TableCell>
                          <Badge className={statusCfg.className}>{statusCfg.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => navigate(`/hr/employees/${emp.id}`)}>
                                <Eye className="w-4 h-4 mr-2" />
                                Voir détails
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openEditModal(emp)}>
                                <Edit className="w-4 h-4 mr-2" />
                                Modifier
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(emp.id)}>
                                <Trash2 className="w-4 h-4 mr-2" />
                                Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>

      {/* Create / Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEmployee ? 'Modifier l\'employé' : 'Nouvel employé'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Informations personnelles */}
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-700">Informations personnelles</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Prénom *</Label>
                  <Input value={form.first_name} onChange={(e) => updateForm('first_name', e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Nom *</Label>
                  <Input value={form.last_name} onChange={(e) => updateForm('last_name', e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>CIN</Label>
                  <Input value={form.cin} onChange={(e) => updateForm('cin', e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Date de naissance</Label>
                  <Input type="date" value={form.date_of_birth} onChange={(e) => updateForm('date_of_birth', e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Genre</Label>
                  <Select value={form.gender} onValueChange={(v) => updateForm('gender', v)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M">Masculin</SelectItem>
                      <SelectItem value="F">Féminin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Téléphone</Label>
                  <Input value={form.phone} onChange={(e) => updateForm('phone', e.target.value)} className="mt-1" />
                </div>
                <div className="md:col-span-2">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => updateForm('email', e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Situation familiale</Label>
                  <Select value={form.marital_status} onValueChange={(v) => updateForm('marital_status', v)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MARITAL_STATUSES.map(ms => (
                        <SelectItem key={ms.value} value={ms.value}>{ms.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Nombre d'enfants</Label>
                  <Input type="number" min="0" value={form.children_count} onChange={(e) => updateForm('children_count', e.target.value)} className="mt-1" />
                </div>
              </div>
            </div>

            {/* Informations professionnelles */}
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-700">Informations professionnelles</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Département</Label>
                  <Input value={form.department} onChange={(e) => updateForm('department', e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Poste</Label>
                  <Input value={form.position} onChange={(e) => updateForm('position', e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Catégorie professionnelle</Label>
                  <Select value={form.professional_category} onValueChange={(v) => updateForm('professional_category', v)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROFESSIONAL_CATEGORIES.map(cat => (
                        <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Net mensuel cible (TND)</Label>
                  <Input type="number" step="0.001" value={form.net_target} onChange={(e) => updateForm('net_target', e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Salaire de base brut calculé (TND)</Label>
                  <Input type="number" step="0.001" value={form.base_salary} readOnly className="mt-1 bg-slate-50" />
                </div>
                <div>
                  <Label>Date d'embauche</Label>
                  <Input type="date" value={form.hire_date} onChange={(e) => updateForm('hire_date', e.target.value)} className="mt-1" />
                </div>
                <div className="md:col-span-2">
                  <Label>Régime de travail</Label>
                  <Select value={form.work_regime} onValueChange={(v) => updateForm('work_regime', v)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WORK_REGIMES.map(wr => (
                        <SelectItem key={wr.value} value={wr.value}>{wr.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Informations bancaires */}
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-700">Informations bancaires & CNSS</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Banque</Label>
                  <Input value={form.bank_name} onChange={(e) => updateForm('bank_name', e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>RIB</Label>
                  <Input value={form.rib} onChange={(e) => updateForm('rib', e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>N° CNSS</Label>
                  <Input value={form.cnss_number} onChange={(e) => updateForm('cnss_number', e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Mode de paiement</Label>
                  <Select value={form.payment_method} onValueChange={(v) => updateForm('payment_method', v)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map(pm => (
                        <SelectItem key={pm.value} value={pm.value}>{pm.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Primes mensuelles */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Primes mensuelles</h3>
                <Button type="button" variant="outline" size="sm" onClick={addPrime}>
                  <Plus className="w-3 h-3 mr-1" /> Ajouter une prime
                </Button>
              </div>
              {(form.mandatory_primes || []).length > 0 && (
                <div className="mb-3 space-y-2">
                  <div className="text-xs font-medium uppercase text-slate-500">Primes minimales obligatoires injectées</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {form.mandatory_primes.map((prime, index) => (
                      <div key={`${prime.code}-${index}`} className="flex items-center justify-between rounded-lg border bg-violet-50 px-3 py-2 text-sm">
                        <span>{prime.name}</span>
                        <span className="font-medium">{Number(prime.amount || 0).toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} TND</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {form.primes.length === 0 ? (
                <p className="rounded-lg bg-slate-50 py-4 text-center text-sm text-slate-400">Aucune prime définie</p>
              ) : (
                <div className="space-y-2">
                  {form.primes.map((prime, index) => (
                    <div key={index} className="flex items-end gap-3 rounded-lg bg-slate-50 p-3">
                      <div className="flex-1">
                        <Label className="text-xs">Code</Label>
                        <Input
                          value={prime.code}
                          onChange={(e) => updatePrime(index, 'code', e.target.value)}
                          placeholder="ex: PTRANS"
                          className="mt-1"
                        />
                      </div>
                      <div className="flex-[2]">
                        <Label className="text-xs">Libellé</Label>
                        <Input
                          value={prime.name}
                          onChange={(e) => updatePrime(index, 'name', e.target.value)}
                          placeholder="ex: Prime de transport"
                          className="mt-1"
                        />
                      </div>
                      <div className="flex-1">
                        <Label className="text-xs">Montant (TND)</Label>
                        <Input
                          type="number"
                          step="0.001"
                          value={prime.amount}
                          onChange={(e) => updatePrime(index, 'amount', e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <Button type="button" variant="ghost" size="sm" onClick={() => removePrime(index)} className="text-red-500 hover:text-red-700 mb-0.5">
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Simulation de paie</h3>
                {previewLoading && <span className="text-xs text-slate-500">Calcul en cours...</span>}
              </div>
              {form.salary_breakdown_snapshot ? (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="rounded-lg border bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">Brut mensuel</div>
                    <div className="mt-1 font-semibold text-slate-900">
                      {Number(form.salary_breakdown_snapshot.total_brut || 0).toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} TND
                    </div>
                  </div>
                  <div className="rounded-lg border bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">Retenues</div>
                    <div className="mt-1 font-semibold text-slate-900">
                      {Number(form.salary_breakdown_snapshot.total_deductions || 0).toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} TND
                    </div>
                  </div>
                  <div className="rounded-lg border bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">Net à payer</div>
                    <div className="mt-1 font-semibold text-violet-700">
                      {Number(form.salary_breakdown_snapshot.net_a_payer || 0).toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} TND
                    </div>
                  </div>
                  <div className="rounded-lg border bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">Charges patronales</div>
                    <div className="mt-1 font-semibold text-slate-900">
                      {Number(form.salary_breakdown_snapshot.total_employer_charges || 0).toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} TND
                    </div>
                  </div>
                </div>
              ) : (
                <p className="rounded-lg bg-slate-50 py-4 text-center text-sm text-slate-400">Saisis le net cible pour lancer la simulation automatique.</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? 'Enregistrement...' : editingEmployee ? 'Modifier' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Employees;