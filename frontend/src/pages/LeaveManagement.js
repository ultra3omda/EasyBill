import React, { useState, useEffect, useCallback } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { useCompany } from '../hooks/useCompany';
import api from '../services/api';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../components/ui/dialog';
import {
  Plus, CheckCircle, XCircle, Calendar, Users, Clock, ChevronLeft, ChevronRight,
} from 'lucide-react';

const STATUS_CONFIG = {
  en_attente: { label: 'En attente', className: 'bg-yellow-100 text-yellow-800' },
  approuve: { label: 'Approuvé', className: 'bg-green-100 text-green-800' },
  refuse: { label: 'Refusé', className: 'bg-red-100 text-red-800' },
};

const MONTHS_LABELS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

const LeaveManagement = () => {
  const { currentCompany } = useCompany();
  const [activeTab, setActiveTab] = useState('demandes');
  const [leaves, setLeaves] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());

  const [formData, setFormData] = useState({
    employee_id: '',
    leave_type: '',
    start_date: '',
    end_date: '',
    reason: '',
  });

  const loadLeaves = useCallback(async () => {
    if (!currentCompany?.id) return;
    setLoading(true);
    try {
      const res = await api.get(`/hr/leaves?company_id=${currentCompany.id}`);
      setLeaves(res.data || []);
    } catch {
      toast.error('Erreur lors du chargement des congés');
    } finally {
      setLoading(false);
    }
  }, [currentCompany]);

  const loadLeaveTypes = useCallback(async () => {
    if (!currentCompany?.id) return;
    try {
      const res = await api.get(`/hr/leaves/types?company_id=${currentCompany.id}`);
      setLeaveTypes(res.data || []);
    } catch {
      setLeaveTypes([]);
    }
  }, [currentCompany]);

  const loadEmployees = useCallback(async () => {
    if (!currentCompany?.id) return;
    try {
      const res = await api.get(`/hr/employees?company_id=${currentCompany.id}`);
      setEmployees(res.data || []);
    } catch {
      setEmployees([]);
    }
  }, [currentCompany]);

  const loadBalances = useCallback(async () => {
    if (!currentCompany?.id) return;
    try {
      const res = await api.get(`/hr/leaves/balances?company_id=${currentCompany.id}`);
      setBalances(res.data || []);
    } catch {
      setBalances([]);
    }
  }, [currentCompany]);

  useEffect(() => {
    loadLeaves();
    loadLeaveTypes();
    loadEmployees();
  }, [loadLeaves, loadLeaveTypes, loadEmployees]);

  useEffect(() => {
    if (activeTab === 'soldes') loadBalances();
  }, [activeTab, loadBalances]);

  const handleApprove = async (id) => {
    try {
      await api.post(`/hr/leaves/${id}/approve?company_id=${currentCompany.id}`);
      toast.success('Congé approuvé');
      loadLeaves();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de l\'approbation');
    }
  };

  const handleReject = async (id) => {
    try {
      await api.post(`/hr/leaves/${id}/reject?company_id=${currentCompany.id}`);
      toast.success('Congé refusé');
      loadLeaves();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors du refus');
    }
  };

  const handleSubmit = async () => {
    if (!formData.employee_id || !formData.leave_type || !formData.start_date || !formData.end_date) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/hr/leaves?company_id=${currentCompany.id}`, formData);
      toast.success('Demande de congé créée');
      setModalOpen(false);
      setFormData({ employee_id: '', leave_type: '', start_date: '', end_date: '', reason: '' });
      loadLeaves();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la création');
    } finally {
      setSubmitting(false);
    }
  };

  // Calendar helpers
  const getDaysInMonth = (m, y) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (m, y) => (new Date(y, m, 1).getDay() + 6) % 7; // Monday=0

  const approvedLeaves = leaves.filter(
    (l) => l.status === 'approuve' || l.status === 'approved'
  );

  const isDateInRange = (date, start, end) => {
    const d = new Date(date);
    return d >= new Date(start) && d <= new Date(end);
  };

  const getLeavesForDate = (day) => {
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return approvedLeaves.filter((l) => isDateInRange(dateStr, l.start_date, l.end_date));
  };

  const prevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); }
    else setCalMonth(calMonth - 1);
  };

  const nextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); }
    else setCalMonth(calMonth + 1);
  };

  if (!currentCompany) {
    return <AppLayout><div className="py-20 text-center text-slate-500">Aucune entreprise sélectionnée</div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="page-header-title">Gestion des Congés</h1>
            <p className="page-header-subtitle">Demandes, calendrier et soldes de congés</p>
          </div>
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nouvelle demande
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="demandes" className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" /> Demandes
            </TabsTrigger>
            <TabsTrigger value="calendrier" className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" /> Calendrier
            </TabsTrigger>
            <TabsTrigger value="soldes" className="flex items-center gap-1.5">
              <Users className="w-4 h-4" /> Soldes
            </TabsTrigger>
          </TabsList>

          {/* Demandes Tab */}
          <TabsContent value="demandes">
            <Card className="stat-surface">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employé</TableHead>
                      <TableHead>Type congé</TableHead>
                      <TableHead>Du</TableHead>
                      <TableHead>Au</TableHead>
                      <TableHead className="text-right">Jours</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-10 text-center text-slate-400">Chargement...</TableCell>
                      </TableRow>
                    ) : leaves.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-10 text-center text-slate-400">
                          Aucune demande de congé
                        </TableCell>
                      </TableRow>
                    ) : (
                      leaves.map((leave) => {
                        const sc = STATUS_CONFIG[leave.status] || STATUS_CONFIG.en_attente;
                        return (
                          <TableRow key={leave.id} className="hover:bg-slate-50/80">
                            <TableCell className="font-medium text-slate-900">{leave.employee_name || '—'}</TableCell>
                            <TableCell className="text-slate-600">{leave.leave_type_label || leave.leave_type || '—'}</TableCell>
                            <TableCell className="text-slate-600">{leave.start_date ? new Date(leave.start_date).toLocaleDateString('fr-TN') : '—'}</TableCell>
                            <TableCell className="text-slate-600">{leave.end_date ? new Date(leave.end_date).toLocaleDateString('fr-TN') : '—'}</TableCell>
                            <TableCell className="text-right text-slate-600">{leave.days ?? '—'}</TableCell>
                            <TableCell>
                              <Badge className={sc.className}>{sc.label}</Badge>
                            </TableCell>
                            <TableCell>
                              {leave.status === 'en_attente' && (
                                <div className="flex items-center gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                    onClick={() => handleApprove(leave.id)}
                                  >
                                    <CheckCircle className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => handleReject(leave.id)}
                                  >
                                    <XCircle className="w-4 h-4" />
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          {/* Calendrier Tab */}
          <TabsContent value="calendrier">
            <Card className="stat-surface p-4">
              <div className="flex items-center justify-between mb-4">
                <Button variant="ghost" size="sm" onClick={prevMonth}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <h3 className="text-lg font-semibold">
                  {MONTHS_LABELS[calMonth]} {calYear}
                </h3>
                <Button variant="ghost" size="sm" onClick={nextMonth}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              <div className="grid grid-cols-7 gap-px overflow-hidden rounded-2xl bg-slate-200">
                {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => (
                  <div key={d} className="bg-slate-50 p-2 text-center text-xs font-medium text-slate-500">{d}</div>
                ))}
                {Array.from({ length: getFirstDayOfMonth(calMonth, calYear) }).map((_, i) => (
                  <div key={`empty-${i}`} className="bg-white p-2 min-h-[60px]" />
                ))}
                {Array.from({ length: getDaysInMonth(calMonth, calYear) }).map((_, i) => {
                  const day = i + 1;
                  const dayLeaves = getLeavesForDate(day);
                  return (
                    <div key={day} className="min-h-[60px] bg-white p-1.5">
                      <span className="text-xs font-medium text-slate-700">{day}</span>
                      {dayLeaves.slice(0, 2).map((l, li) => (
                        <div
                          key={li}
                          className="mt-0.5 px-1 py-0.5 text-[10px] bg-blue-100 text-blue-700 rounded truncate"
                          title={l.employee_name}
                        >
                          {l.employee_name?.split(' ')[0] || '—'}
                        </div>
                      ))}
                      {dayLeaves.length > 2 && (
                        <div className="mt-0.5 text-[10px] text-slate-400">+{dayLeaves.length - 2}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          </TabsContent>

          {/* Soldes Tab */}
          <TabsContent value="soldes">
            <Card className="stat-surface">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employé</TableHead>
                      <TableHead className="text-right">Acquis</TableHead>
                      <TableHead className="text-right">Pris</TableHead>
                      <TableHead className="text-right">Restant</TableHead>
                      <TableHead>Type</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {balances.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-10 text-center text-slate-400">
                          Aucun solde disponible
                        </TableCell>
                      </TableRow>
                    ) : (
                      balances.map((b, idx) => (
                        <TableRow key={idx} className="hover:bg-slate-50/80">
                          <TableCell className="font-medium text-slate-900">{b.employee_name || '—'}</TableCell>
                          <TableCell className="text-right font-mono text-slate-600">{b.acquired ?? '—'}</TableCell>
                          <TableCell className="text-right font-mono text-slate-600">{b.taken ?? '—'}</TableCell>
                          <TableCell className="text-right font-mono font-bold">
                            <span className={(b.remaining || 0) <= 0 ? 'text-red-600' : 'text-green-700'}>
                              {b.remaining ?? '—'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{b.leave_type_label || 'ANNUEL'}</Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        {/* New Leave Modal */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Nouvelle demande de congé</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Employé *</Label>
                <Select value={formData.employee_id} onValueChange={(v) => setFormData({ ...formData, employee_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un employé" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={String(emp.id)}>
                        {emp.first_name} {emp.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Type de congé *</Label>
                <Select value={formData.leave_type} onValueChange={(v) => setFormData({ ...formData, leave_type: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner le type" />
                  </SelectTrigger>
                  <SelectContent>
                    {leaveTypes.map((lt) => (
                      <SelectItem key={lt.code || lt.id} value={lt.code || String(lt.id)}>
                        {lt.label || lt.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date de début *</Label>
                  <Input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date de fin *</Label>
                  <Input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Motif</Label>
                <Textarea
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="Motif de la demande (optionnel)"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setModalOpen(false)}>Annuler</Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Envoi...' : 'Soumettre'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default LeaveManagement;
