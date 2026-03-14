import React, { useState, useEffect, useCallback } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { toast } from 'sonner';
import { companiesAPI } from '../services/api';
import {
  Calendar, Plus, Lock, Unlock, CheckCircle, Clock,
  BarChart2, FileText, AlertTriangle, Star, Trash2, RefreshCw
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;
const token = () => localStorage.getItem('token');
const fmt = n => Number(n || 0).toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

const STATUS_CONFIG = {
  open: { label: 'Ouvert', color: 'bg-green-100 text-green-700 border-green-200', Icon: CheckCircle },
  closed: { label: 'Clôturé', color: 'bg-slate-100 text-slate-600 border-slate-200', Icon: Lock },
  locked: { label: 'Verrouillé', color: 'bg-red-100 text-red-600 border-red-200', Icon: Lock },
};

export default function FiscalYears() {
  const [companyId, setCompanyId] = useState(null);
  const [fiscalYears, setFiscalYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedFY, setSelectedFY] = useState(null);
  const [detailFY, setDetailFY] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: `Exercice ${new Date().getFullYear()}`,
    start_date: `${new Date().getFullYear()}-01-01`,
    end_date: `${new Date().getFullYear()}-12-31`,
    notes: ''
  });
  const [saving, setSaving] = useState(false);
  const [confirmClose, setConfirmClose] = useState(null);

  useEffect(() => {
    companiesAPI.list().then(r => {
      if (r.data?.length) setCompanyId(r.data[0].id);
    });
  }, []);

  const fetchFiscalYears = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/fiscal-years/?company_id=${companyId}`, {
        headers: { Authorization: `Bearer ${token()}` }
      });
      const data = await res.json();
      setFiscalYears(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Erreur lors du chargement des exercices');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { fetchFiscalYears(); }, [fetchFiscalYears]);

  const fetchDetail = async (fy) => {
    setSelectedFY(fy);
    setDetailLoading(true);
    try {
      const res = await fetch(`${API}/api/fiscal-years/${fy.id}/stats?company_id=${companyId}`, {
        headers: { Authorization: `Bearer ${token()}` }
      });
      const data = await res.json();
      setDetailFY(data);
    } catch {
      toast.error('Erreur lors du chargement des statistiques');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.name || !formData.start_date || !formData.end_date) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/fiscal-years/?company_id=${companyId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Erreur');
      toast.success('Exercice comptable créé');
      setShowModal(false);
      fetchFiscalYears();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSetCurrent = async (id) => {
    try {
      const res = await fetch(`${API}/api/fiscal-years/${id}/set-current?company_id=${companyId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      toast.success('Exercice courant défini');
      fetchFiscalYears();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleClose = async (id) => {
    try {
      const res = await fetch(`${API}/api/fiscal-years/${id}/close?company_id=${companyId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      toast.success('Exercice clôturé');
      if (data.warnings) toast.warning(data.warnings);
      setConfirmClose(null);
      fetchFiscalYears();
      if (selectedFY?.id === id) setSelectedFY(null);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleReopen = async (id) => {
    try {
      const res = await fetch(`${API}/api/fiscal-years/${id}/reopen?company_id=${companyId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      toast.success('Exercice réouvert');
      fetchFiscalYears();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cet exercice ?')) return;
    try {
      const res = await fetch(`${API}/api/fiscal-years/${id}?company_id=${companyId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token()}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      toast.success('Exercice supprimé');
      fetchFiscalYears();
      if (selectedFY?.id === id) setSelectedFY(null);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const currentFY = fiscalYears.find(fy => fy.is_current);

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-header-title flex items-center gap-2">
              <Calendar className="w-6 h-6 text-violet-600" />
              Exercices comptables
            </h1>
            <p className="page-header-subtitle">
              Gestion des périodes comptables — ouverture, clôture et statistiques
            </p>
          </div>
          <Button onClick={() => setShowModal(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Nouvel exercice
          </Button>
        </div>

        {/* Current FY Banner */}
        {currentFY && (
          <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 flex items-center gap-3">
            <Star className="w-5 h-5 text-violet-600 shrink-0" />
            <div>
              <p className="font-semibold text-violet-800">Exercice courant : {currentFY.name}</p>
              <p className="text-sm text-violet-600">
                Du {currentFY.start_date} au {currentFY.end_date}
                {currentFY.entry_count > 0 && ` · ${currentFY.entry_count} écritures`}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Fiscal Year List */}
          <div className="lg:col-span-1 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Exercices</h2>
            {loading ? (
              <div className="py-8 text-center text-slate-400">Chargement…</div>
            ) : fiscalYears.length === 0 ? (
              <Card className="stat-surface">
                <CardContent className="py-8 text-center text-slate-400">
                  <Calendar className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p>Aucun exercice</p>
                  <Button size="sm" className="mt-3" onClick={() => setShowModal(true)}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Créer
                  </Button>
                </CardContent>
              </Card>
            ) : (
              fiscalYears.map(fy => {
                const sc = STATUS_CONFIG[fy.status] || STATUS_CONFIG.open;
                const isSelected = selectedFY?.id === fy.id;
                return (
                  <div
                    key={fy.id}
                    onClick={() => fetchDetail(fy)}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-violet-500 bg-violet-50 shadow-md'
                        : 'border-slate-200 bg-white hover:border-violet-300 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-slate-900">{fy.name}</span>
                      <div className="flex items-center gap-1.5">
                        {fy.is_current && (
                          <Badge className="text-xs bg-violet-100 text-violet-700 border-violet-200">
                            <Star className="w-2.5 h-2.5 mr-1" />Courant
                          </Badge>
                        )}
                        <Badge className={`text-xs border ${sc.color}`}>
                          <sc.Icon className="w-2.5 h-2.5 mr-1" />{sc.label}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500">
                      {fy.start_date} → {fy.end_date}
                    </p>
                    {fy.entry_count > 0 && (
                      <p className="mt-1 text-xs text-slate-500">
                        {fy.entry_count} écriture{fy.entry_count > 1 ? 's' : ''} · {fmt(fy.total_debit)} TND
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Detail Panel */}
          <div className="lg:col-span-2">
            {!selectedFY ? (
              <Card className="stat-surface">
                <CardContent className="py-16 text-center text-slate-400">
                  <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-lg font-medium">Sélectionnez un exercice</p>
                  <p className="text-sm">Cliquez sur un exercice pour voir les détails</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {/* FY Header */}
                <Card className="stat-surface">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xl">{selectedFY.name}</CardTitle>
                      <div className="flex items-center gap-2">
                        {selectedFY.status === 'open' && !selectedFY.is_current && (
                          <Button variant="outline" size="sm" onClick={() => handleSetCurrent(selectedFY.id)} className="gap-1.5">
                            <Star className="w-3.5 h-3.5" /> Définir courant
                          </Button>
                        )}
                        {selectedFY.status === 'open' && (
                          <Button
                            variant="outline" size="sm"
                            onClick={() => setConfirmClose(selectedFY.id)}
                            className="gap-1.5 text-orange-600 border-orange-200 hover:bg-orange-50"
                          >
                            <Lock className="w-3.5 h-3.5" /> Clôturer
                          </Button>
                        )}
                        {selectedFY.status === 'closed' && (
                          <Button variant="outline" size="sm" onClick={() => handleReopen(selectedFY.id)} className="gap-1.5">
                            <Unlock className="w-3.5 h-3.5" /> Réouvrir
                          </Button>
                        )}
                        {selectedFY.status === 'open' && (
                          <Button
                            variant="outline" size="sm"
                            onClick={() => handleDelete(selectedFY.id)}
                            className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-sm text-slate-500">
                      <span><Calendar className="w-3.5 h-3.5 inline mr-1" />{selectedFY.start_date} → {selectedFY.end_date}</span>
                      {selectedFY.closed_at && (
                        <span><Lock className="w-3.5 h-3.5 inline mr-1" />Clôturé le {selectedFY.closed_at.slice(0, 10)} par {selectedFY.closed_by}</span>
                      )}
                    </div>
                  </CardHeader>
                </Card>

                {/* Stats */}
                {detailLoading ? (
                  <div className="py-8 text-center text-slate-400">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 mx-auto mb-2" />
                    Chargement des statistiques…
                  </div>
                ) : detailFY && (
                  <>
                    <div className="grid grid-cols-3 gap-3">
                      <Card className="stat-surface">
                        <CardContent className="p-4 text-center">
                          <FileText className="w-6 h-6 mx-auto mb-1 text-violet-600" />
                          <p className="text-2xl font-bold text-slate-900">
                            {detailFY.by_status ? Object.values(detailFY.by_status).reduce((a, b) => a + b, 0) : 0}
                          </p>
                          <p className="text-xs text-slate-500">Écritures total</p>
                        </CardContent>
                      </Card>
                      <Card className="stat-surface">
                        <CardContent className="p-4 text-center">
                          <CheckCircle className="w-6 h-6 mx-auto mb-1 text-green-600" />
                          <p className="text-2xl font-bold text-slate-900">{detailFY.by_status?.posted || 0}</p>
                          <p className="text-xs text-slate-500">Validées</p>
                        </CardContent>
                      </Card>
                      <Card className="stat-surface">
                        <CardContent className="p-4 text-center">
                          <Clock className="w-6 h-6 mx-auto mb-1 text-yellow-600" />
                          <p className="text-2xl font-bold text-slate-900">{detailFY.by_status?.draft || 0}</p>
                          <p className="text-xs text-slate-500">Brouillons</p>
                        </CardContent>
                      </Card>
                    </div>

                    {/* By journal type */}
                    <Card className="stat-surface">
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <BarChart2 className="w-4 h-4 text-violet-600" />
                          Répartition par journal
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        <table className="w-full text-sm">
                          <thead className="border-b bg-slate-50">
                            <tr>
                              <th className="px-4 py-2 text-left font-medium text-slate-600">Journal</th>
                              <th className="px-4 py-2 text-right font-medium text-slate-600">Écritures</th>
                              <th className="px-4 py-2 text-right font-medium text-slate-600">Total Débit</th>
                              <th className="px-4 py-2 text-right font-medium text-slate-600">Total Crédit</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {detailFY.by_journal_type?.map(row => (
                              <tr key={row.journal_type} className="hover:bg-slate-50/80">
                                <td className="px-4 py-2 capitalize">{row.journal_type}</td>
                                <td className="px-4 py-2 text-right">{row.count}</td>
                                <td className="px-4 py-2 text-right font-medium">{fmt(row.total_debit)}</td>
                                <td className="px-4 py-2 text-right font-medium">{fmt(row.total_credit)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </CardContent>
                    </Card>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-violet-600" />
              Nouvel exercice comptable
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nom de l'exercice *</Label>
              <Input
                value={formData.name}
                onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                placeholder="Ex: Exercice 2025"
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Date de début *</Label>
                <Input
                  type="date"
                  value={formData.start_date}
                  onChange={e => setFormData(p => ({ ...p, start_date: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Date de fin *</Label>
                <Input
                  type="date"
                  value={formData.end_date}
                  onChange={e => setFormData(p => ({ ...p, end_date: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Input
                value={formData.notes}
                onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
                placeholder="Remarques optionnelles"
                className="mt-1"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowModal(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
              Créer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Close Dialog */}
      <Dialog open={!!confirmClose} onOpenChange={() => setConfirmClose(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-700">
              <AlertTriangle className="w-5 h-5" />
              Clôturer l'exercice
            </DialogTitle>
          </DialogHeader>
          <div className="py-3">
            <p className="text-slate-700">
              La clôture d'un exercice est une opération comptable importante.
              Les écritures brouillons ne seront <strong>pas</strong> automatiquement validées.
            </p>
            <p className="text-sm text-orange-600 mt-2 bg-orange-50 p-3 rounded-lg">
              Assurez-vous d'avoir validé toutes les écritures avant de clôturer.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmClose(null)}>Annuler</Button>
            <Button
              onClick={() => handleClose(confirmClose)}
              className="bg-orange-600 hover:bg-orange-700"
            >
              <Lock className="w-4 h-4 mr-1" /> Confirmer la clôture
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
