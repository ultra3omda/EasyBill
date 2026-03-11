import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  hire_date: '',
  marital_status: 'celibataire',
  children_count: 0,
  bank_name: '',
  rib: '',
  cnss_number: '',
  work_regime: '48h',
  payment_method: 'virement',
  primes: [],
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

  useEffect(() => {
    if (currentCompany) {
      loadEmployees();
    }
  }, [currentCompany]);

  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      openCreateModal();
    }
  }, [searchParams]);

  const loadEmployees = async () => {
    if (!currentCompany) return;
    setLoading(true);
    try {
      const response = await api.get(`/hr/employees?company_id=${currentCompany.id}`);
      setEmployees(response.data);
    } catch (error) {
      console.error('Error loading employees:', error);
      toast.error('Impossible de charger les employés');
    } finally {
      setLoading(false);
    }
  };

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
      base_salary: employee.base_salary ?? '',
      hire_date: employee.hire_date || '',
      marital_status: employee.marital_status || 'celibataire',
      children_count: employee.children_count ?? 0,
      bank_name: employee.bank_name || '',
      rib: employee.rib || '',
      cnss_number: employee.cnss_number || '',
      work_regime: employee.work_regime || '48h',
      payment_method: employee.payment_method || 'virement',
      primes: employee.primes || [],
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.first_name || !form.last_name) {
      toast.error('Le nom et prénom sont obligatoires');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        base_salary: form.base_salary ? parseFloat(form.base_salary) : 0,
        children_count: parseInt(form.children_count) || 0,
        primes: form.primes.map(p => ({ ...p, amount: parseFloat(p.amount) || 0 })),
      };

      if (editingEmployee) {
        await api.put(`/hr/employees/${editingEmployee.id}?company_id=${currentCompany.id}`, payload);
        toast.success('Employé modifié avec succès');
      } else {
        await api.post(`/hr/employees?company_id=${currentCompany.id}`, payload);
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
      await api.delete(`/hr/employees/${employeeId}?company_id=${currentCompany.id}`);
      toast.success('Employé supprimé');
      loadEmployees();
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const updateForm = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Employés</h1>
            <p className="text-gray-500 mt-1">{filteredEmployees.length} employé{filteredEmployees.length > 1 ? 's' : ''} au total</p>
          </div>
          <Button className="bg-violet-600 hover:bg-violet-700 text-white" onClick={openCreateModal}>
            <Plus className="w-4 h-4 mr-2" />
            Nouvel employé
          </Button>
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
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
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-2">Aucun employé trouvé</p>
              <Button onClick={openCreateModal} className="mt-4 bg-violet-600 hover:bg-violet-700">
                <Plus className="w-4 h-4 mr-2" />
                Ajouter votre premier employé
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase">Matricule</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase">Nom complet</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase">Poste</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase">Département</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase">Type contrat</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase">Salaire base</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase">Statut</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map((emp) => {
                    const statusCfg = STATUS_CONFIG[emp.status] || STATUS_CONFIG.actif;
                    return (
                      <TableRow key={emp.id} className="hover:bg-gray-50">
                        <TableCell className="text-sm text-gray-600 font-mono">{emp.matricule || '-'}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-violet-100 rounded-full flex items-center justify-center text-violet-600 font-semibold text-sm">
                              {emp.first_name?.charAt(0)}{emp.last_name?.charAt(0)}
                            </div>
                            <span className="font-medium text-gray-900">{emp.first_name} {emp.last_name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">{emp.position || '-'}</TableCell>
                        <TableCell className="text-sm text-gray-600">{emp.department || '-'}</TableCell>
                        <TableCell className="text-sm text-gray-600">{emp.contract_type || '-'}</TableCell>
                        <TableCell className="text-sm font-medium text-gray-900">
                          {emp.base_salary != null
                            ? parseFloat(emp.base_salary).toLocaleString('fr-FR', { minimumFractionDigits: 3 })
                            : '-'}{' '}
                          <span className="text-gray-500 text-xs">TND</span>
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEmployee ? 'Modifier l\'employé' : 'Nouvel employé'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Informations personnelles */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Informations personnelles</h3>
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
              <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Informations professionnelles</h3>
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
                  <Label>Salaire de base (TND)</Label>
                  <Input type="number" step="0.001" value={form.base_salary} onChange={(e) => updateForm('base_salary', e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Date d'embauche</Label>
                  <Input type="date" value={form.hire_date} onChange={(e) => updateForm('hire_date', e.target.value)} className="mt-1" />
                </div>
                <div>
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
              <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Informations bancaires & CNSS</h3>
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
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Primes mensuelles</h3>
                <Button type="button" variant="outline" size="sm" onClick={addPrime}>
                  <Plus className="w-3 h-3 mr-1" /> Ajouter une prime
                </Button>
              </div>
              {form.primes.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4 bg-gray-50 rounded-lg">Aucune prime définie</p>
              ) : (
                <div className="space-y-2">
                  {form.primes.map((prime, index) => (
                    <div key={index} className="flex items-end gap-3 p-3 bg-gray-50 rounded-lg">
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
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button className="bg-violet-600 hover:bg-violet-700 text-white" onClick={handleSubmit} disabled={saving}>
              {saving ? 'Enregistrement...' : editingEmployee ? 'Modifier' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Employees;