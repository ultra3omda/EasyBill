import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useCompany } from '../hooks/useCompany';
import AppLayout from '../components/layout/AppLayout';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  Users,
  Banknote,
  CalendarDays,
  FileWarning,
  AlertTriangle,
  ArrowRight,
  UserPlus,
  CheckCircle,
  Clock,
  Building2,
  Briefcase,
} from 'lucide-react';
import { toast } from 'sonner';

const HRDashboard = () => {
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentCompany) {
      loadDashboard();
    }
  }, [currentCompany]);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/hr/dashboard?company_id=${currentCompany.id}`);
      setData(response.data);
    } catch (error) {
      console.error('Error loading HR dashboard:', error);
      toast.error('Impossible de charger le tableau de bord RH');
    } finally {
      setLoading(false);
    }
  };

  if (!currentCompany) {
    return <AppLayout><div className="text-center py-20">Aucune entreprise sélectionnée</div></AppLayout>;
  }

  const stats = data?.stats || {};
  const departmentBreakdown = data?.department_breakdown || [];
  const contractBreakdown = data?.contract_breakdown || [];
  const recentLeaves = data?.recent_leaves || [];
  const recentHires = data?.recent_hires || [];
  const expiringContracts = data?.expiring_contracts || [];
  const pendingDeclarations = data?.pending_declarations || [];

  const maxDeptCount = Math.max(...departmentBreakdown.map(d => d.count), 1);

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="page-header-title">Ressources Humaines</h1>
            <p className="page-header-subtitle">Tableau de bord RH &bull; {currentCompany?.name}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/hr/employees')}>
              <Users className="w-4 h-4 mr-2" />
              Voir les employés
            </Button>
            <Button onClick={() => navigate('/hr/employees?action=new')}>
              <UserPlus className="w-4 h-4 mr-2" />
              Nouvel employé
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="p-16 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 mx-auto"></div>
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="stat-surface p-5">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-violet-100 p-3">
                    <Users className="w-6 h-6 text-violet-700" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-600">Employés actifs</p>
                    <span className="text-2xl font-bold text-slate-900">{stats.active_employees ?? 0}</span>
                    <p className="text-xs text-violet-600 mt-1">Total en activité</p>
                  </div>
                </div>
              </Card>

              <Card className="stat-surface p-5">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-amber-100 p-3">
                    <Banknote className="w-6 h-6 text-amber-700" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-600">Masse salariale</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-slate-900">
                        {(stats.monthly_payroll ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 3 })}
                      </span>
                      <span className="text-sm font-medium text-slate-600">TND</span>
                    </div>
                    <p className="text-xs text-amber-600 mt-1">Mensuelle</p>
                  </div>
                </div>
              </Card>

              <Card className="stat-surface p-5">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-blue-100 p-3">
                    <CalendarDays className="w-6 h-6 text-blue-700" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-600">Congés en cours</p>
                    <span className="text-2xl font-bold text-slate-900">{stats.active_leaves ?? 0}</span>
                    <p className="text-xs text-blue-600 mt-1">Employés en congé</p>
                  </div>
                </div>
              </Card>

              <Card className="stat-surface p-5">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-orange-100 p-3">
                    <FileWarning className="w-6 h-6 text-orange-700" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-600">Contrats à renouveler</p>
                    <span className="text-2xl font-bold text-slate-900">{stats.contracts_to_renew ?? 0}</span>
                    <p className="text-xs text-orange-600 mt-1">Dans les 30 jours</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Department Breakdown */}
              <Card className="p-6">
                <div className="flex items-center gap-2 mb-5">
                  <Building2 className="w-5 h-5 text-violet-600" />
                  <h2 className="text-lg font-semibold text-slate-900">Répartition par département</h2>
                </div>
                {departmentBreakdown.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-8">Aucune donnée disponible</p>
                ) : (
                  <div className="space-y-3">
                    {departmentBreakdown.map((dept, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <span className="text-sm text-slate-600 w-32 truncate">{dept.name}</span>
                        <div className="flex-1 bg-slate-100 rounded-full h-6 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-violet-500 to-violet-400 rounded-full flex items-center justify-end pr-2 transition-all duration-500"
                            style={{ width: `${Math.max((dept.count / maxDeptCount) * 100, 8)}%` }}
                          >
                            <span className="text-xs font-semibold text-white">{dept.count}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Contract Type Breakdown */}
              <Card className="p-6">
                <div className="flex items-center gap-2 mb-5">
                  <Briefcase className="w-5 h-5 text-amber-600" />
                  <h2 className="text-lg font-semibold text-slate-900">Répartition par type de contrat</h2>
                </div>
                {contractBreakdown.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-8">Aucune donnée disponible</p>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    {contractBreakdown.map((ct, index) => {
                      const colors = [
                        'bg-violet-100 text-violet-700 border-violet-200',
                        'bg-amber-100 text-amber-700 border-amber-200',
                        'bg-blue-100 text-blue-700 border-blue-200',
                        'bg-green-100 text-green-700 border-green-200',
                        'bg-orange-100 text-orange-700 border-orange-200',
                        'bg-rose-100 text-rose-700 border-rose-200',
                      ];
                      return (
                        <div
                          key={index}
                          className={`inline-flex items-center gap-2 px-4 py-3 rounded-xl border ${colors[index % colors.length]}`}
                        >
                          <span className="text-sm font-medium">{ct.type}</span>
                          <span className="text-lg font-bold">{ct.count}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>

            {/* Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Approved Leaves */}
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-slate-900">Derniers congés approuvés</h2>
                  <Button variant="ghost" size="sm" className="text-violet-600" onClick={() => navigate('/hr/employees')}>
                    Tout voir <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
                {recentLeaves.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-6">Aucun congé récent</p>
                ) : (
                  <div className="space-y-3">
                    {recentLeaves.map((leave, index) => (
                      <div key={index} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
                        <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{leave.employee_name}</p>
                          <p className="text-xs text-slate-500">
                            {leave.start_date && new Date(leave.start_date).toLocaleDateString('fr-FR')} — {leave.end_date && new Date(leave.end_date).toLocaleDateString('fr-FR')}
                          </p>
                        </div>
                        <Badge className="bg-green-100 text-green-700">{leave.type || 'Congé'}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Recent Hires */}
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-slate-900">Dernières embauches</h2>
                  <Button variant="ghost" size="sm" className="text-violet-600" onClick={() => navigate('/hr/employees')}>
                    Tout voir <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
                {recentHires.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-6">Aucune embauche récente</p>
                ) : (
                  <div className="space-y-3">
                    {recentHires.map((hire, index) => (
                      <div key={index} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
                        <div className="w-9 h-9 bg-violet-100 rounded-full flex items-center justify-center text-violet-600 font-semibold text-sm">
                          {hire.first_name?.charAt(0)}{hire.last_name?.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{hire.first_name} {hire.last_name}</p>
                          <p className="text-xs text-slate-500">{hire.position} &bull; {hire.department}</p>
                        </div>
                        <span className="text-xs text-slate-400">
                          {hire.hire_date && new Date(hire.hire_date).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            {/* Alerts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Expiring Contracts */}
              <Card className="p-6 border-orange-200">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="w-5 h-5 text-orange-500" />
                  <h2 className="text-lg font-semibold text-slate-900">Contrats expirant dans 30 jours</h2>
                </div>
                {expiringContracts.length === 0 ? (
                  <div className="text-center py-6">
                    <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">Aucun contrat à renouveler</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {expiringContracts.map((c, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-100">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{c.employee_name}</p>
                          <p className="text-xs text-slate-500">{c.contract_type}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-orange-600">
                            {c.end_date && new Date(c.end_date).toLocaleDateString('fr-FR')}
                          </p>
                          <p className="text-xs text-slate-400">
                            <Clock className="w-3 h-3 inline mr-1" />
                            {c.days_remaining}j restants
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Pending Declarations */}
              <Card className="p-6 border-red-200">
                <div className="flex items-center gap-2 mb-4">
                  <FileWarning className="w-5 h-5 text-red-500" />
                  <h2 className="text-lg font-semibold text-slate-900">Déclarations à faire</h2>
                </div>
                {pendingDeclarations.length === 0 ? (
                  <div className="text-center py-6">
                    <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">Aucune déclaration en attente</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pendingDeclarations.map((d, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{d.title}</p>
                          <p className="text-xs text-slate-500">{d.description}</p>
                        </div>
                        <Badge className="bg-red-100 text-red-700">{d.status || 'En attente'}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default HRDashboard;