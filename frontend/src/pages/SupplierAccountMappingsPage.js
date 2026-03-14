import React, { useCallback, useEffect, useState } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { TableSkeleton } from '../components/ui/skeleton';
import { toast } from 'sonner';
import { useCompany } from '../hooks/useCompany';
import { accountingMappingsAPI } from '../services/api';
import { Loader2, RefreshCw, Save, Settings2 } from 'lucide-react';

export default function SupplierAccountMappingsPage() {
  const { currentCompany } = useCompany();
  const [mappings, setMappings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    supplier_pattern: '',
    default_expense_account_code: '',
    semantic_key: '',
    category: '',
  });

  const loadMappings = useCallback(async () => {
    if (!currentCompany) return;
    setLoading(true);
    try {
      const res = await accountingMappingsAPI.listSupplierMappings(currentCompany.id);
      setMappings(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur de chargement des mappings');
      setMappings([]);
    } finally {
      setLoading(false);
    }
  }, [currentCompany]);

  useEffect(() => {
    loadMappings();
  }, [loadMappings]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!currentCompany) return;
    setSaving(true);
    try {
      await accountingMappingsAPI.createSupplierMapping(currentCompany.id, form);
      toast.success('Mapping créé');
      setForm({
        supplier_pattern: '',
        default_expense_account_code: '',
        semantic_key: '',
        category: '',
      });
      loadMappings();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la création du mapping');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <div className="page-shell section-stack">
        <div className="page-header">
          <div>
            <h1 className="page-header-title flex items-center gap-2">
              <Settings2 className="w-6 h-6 text-primary" />
              Mappings fournisseurs
            </h1>
            <p className="page-header-subtitle">
              Associez des fournisseurs/libellés récurrents aux comptes de charge de la société.
            </p>
          </div>
          <Button variant="outline" onClick={loadMappings} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Actualiser
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="interactive-lift p-5">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Mappings actifs</p>
            <p className="metric-value mt-2">{mappings.length}</p>
            <p className="mt-1 text-sm text-slate-500">Règles utilisables par l'analyse comptable</p>
          </Card>
          <Card className="interactive-lift p-5">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Confiance forte</p>
            <p className="metric-value mt-2">{mappings.filter((m) => m.confidence === 'fort').length}</p>
            <p className="mt-1 text-sm text-slate-500">Mappings déjà bien confirmés</p>
          </Card>
          <Card className="interactive-lift p-5">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Confirmations</p>
            <p className="metric-value mt-2">{mappings.reduce((acc, m) => acc + (m.times_confirmed || 0), 0)}</p>
            <p className="mt-1 text-sm text-slate-500">Retours terrain consolidés</p>
          </Card>
        </div>

        <Card className="border-blue-200 bg-blue-50/70">
          <CardContent className="p-5">
            <p className="text-sm font-semibold text-blue-900">Principe</p>
            <p className="mt-2 text-sm text-blue-800">
              Utilisez ces mappings pour sécuriser les affectations comptables récurrentes. Plus une règle est confirmée, plus elle devient fiable pour le rapprochement automatique.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Nouveau mapping</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" onSubmit={handleCreate}>
              <div className="space-y-2">
                <Label>Pattern fournisseur</Label>
                <Input value={form.supplier_pattern} onChange={(e) => setForm({ ...form, supplier_pattern: e.target.value })} placeholder="META / OOREDOO / GARAGE..." />
              </div>
              <div className="space-y-2">
                <Label>Compte</Label>
                <Input value={form.default_expense_account_code} onChange={(e) => setForm({ ...form, default_expense_account_code: e.target.value })} placeholder="6231" />
              </div>
              <div className="space-y-2">
                <Label>Clé sémantique</Label>
                <Input value={form.semantic_key} onChange={(e) => setForm({ ...form, semantic_key: e.target.value })} placeholder="marketing" />
              </div>
              <div className="space-y-2">
                <Label>Catégorie</Label>
                <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="marketing" />
              </div>
              <div className="md:col-span-4">
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  Enregistrer
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mappings actifs</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <TableSkeleton rows={6} columns={6} showToolbar={false} />
            ) : mappings.length === 0 ? (
              <div className="py-8 text-center text-slate-400">Aucun mapping</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pattern</TableHead>
                    <TableHead>Compte</TableHead>
                    <TableHead>Clé sémantique</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Confiance</TableHead>
                    <TableHead className="text-right">Confirmations</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mappings.map((mapping) => (
                    <TableRow key={mapping.id}>
                      <TableCell className="font-medium text-slate-900">{mapping.supplier_pattern}</TableCell>
                      <TableCell className="font-mono">{mapping.default_expense_account_code || '—'}</TableCell>
                      <TableCell>{mapping.semantic_key || '—'}</TableCell>
                      <TableCell>{mapping.source}</TableCell>
                      <TableCell>
                        <Badge variant={mapping.confidence === 'fort' ? 'success' : mapping.confidence === 'moyen' ? 'warning' : 'secondary'}>
                          {mapping.confidence || 'faible'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{mapping.times_confirmed || 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
