import React, { useCallback, useEffect, useState } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
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
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Settings2 className="w-6 h-6 text-violet-600" />
              Mappings fournisseurs
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Associez des fournisseurs/libellés récurrents aux comptes de charge de la société.
            </p>
          </div>
          <Button variant="outline" onClick={loadMappings} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Actualiser
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Nouveau mapping</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid grid-cols-1 md:grid-cols-4 gap-4" onSubmit={handleCreate}>
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
                <Button type="submit" className="bg-violet-600" disabled={saving}>
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
              <div className="py-8 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
            ) : mappings.length === 0 ? (
              <div className="py-8 text-center text-gray-400">Aucun mapping</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-3 py-2 text-left">Pattern</th>
                      <th className="px-3 py-2 text-left">Compte</th>
                      <th className="px-3 py-2 text-left">Clé sémantique</th>
                      <th className="px-3 py-2 text-left">Source</th>
                      <th className="px-3 py-2 text-left">Confiance</th>
                      <th className="px-3 py-2 text-right">Confirmations</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {mappings.map((mapping) => (
                      <tr key={mapping.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium">{mapping.supplier_pattern}</td>
                        <td className="px-3 py-2 font-mono">{mapping.default_expense_account_code || '—'}</td>
                        <td className="px-3 py-2">{mapping.semantic_key || '—'}</td>
                        <td className="px-3 py-2">{mapping.source}</td>
                        <td className="px-3 py-2">
                          <Badge className={mapping.confidence === 'fort' ? 'bg-green-100 text-green-700' : mapping.confidence === 'moyen' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'}>
                            {mapping.confidence || 'faible'}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-right">{mapping.times_confirmed || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
