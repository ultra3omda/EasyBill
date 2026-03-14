import React, { useState, useEffect } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Plus, Pencil, Wallet } from 'lucide-react';
import { toast } from '../hooks/use-toast';
import { useCompany } from '../hooks/useCompany';
import { cashAPI } from '../services/api';

const CURRENCIES = [
  { value: 'TND', label: 'TND' },
  { value: 'EUR', label: 'EUR' },
  { value: 'USD', label: 'USD' }
];

const CashAccountsPage = () => {
  const { currentCompany } = useCompany();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    currency: 'TND',
    initial_balance: '0',
    description: '',
    is_default: false
  });

  useEffect(() => {
    if (currentCompany?.id) {
      loadAccounts();
    }
  }, [currentCompany]);

  useEffect(() => {
    if (isDialogOpen && editingAccount?.id && currentCompany?.id) {
      const acc = editingAccount;
      cashAPI.getAccount(currentCompany.id, acc.id)
        .then((res) => {
          const data = res.data && typeof res.data === 'object' ? res.data : acc;
          setFormData({
            name: String(data.name || ''),
            currency: data.currency || 'TND',
            initial_balance: String(data.initial_balance ?? data.balance ?? 0),
            description: String(data.description || ''),
            is_default: Boolean(data.is_default)
          });
        })
        .catch(() => {
          setFormData({
            name: String(acc.name || ''),
            currency: acc.currency || 'TND',
            initial_balance: String(acc.initial_balance ?? acc.balance ?? 0),
            description: String(acc.description || ''),
            is_default: Boolean(acc.is_default)
          });
        });
    } else if (isDialogOpen && !editingAccount) {
      resetForm();
    }
  }, [isDialogOpen, editingAccount, currentCompany?.id]);

  const loadAccounts = async () => {
    try {
      const res = await cashAPI.listAccounts(currentCompany.id, 'cash');
      setAccounts(res.data || []);
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les comptes caisse',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: formData.name,
        currency: formData.currency,
        description: formData.description || null,
        is_default: formData.is_default,
        account_type: 'cash'
      };
      if (!editingAccount) {
        payload.initial_balance = parseFloat(formData.initial_balance) || 0;
      }

      if (editingAccount) {
        await cashAPI.updateAccount(currentCompany.id, editingAccount.id, payload);
        toast({ title: 'Succès', description: 'Compte caisse mis à jour' });
      } else {
        await cashAPI.createAccount(currentCompany.id, payload);
        toast({ title: 'Succès', description: 'Compte caisse créé' });
      }

      setIsDialogOpen(false);
      setEditingAccount(null);
      resetForm();
      loadAccounts();
    } catch (error) {
      toast({
        title: 'Erreur',
        description: error.response?.data?.detail || 'Une erreur est survenue',
        variant: 'destructive'
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      currency: 'TND',
      initial_balance: '0',
      description: '',
      is_default: false
    });
  };

  const handleEdit = (acc) => {
    setEditingAccount(acc);
    setFormData({
      name: acc.name || '',
      currency: acc.currency || 'TND',
      initial_balance: String(acc.initial_balance ?? acc.balance ?? 0),
      description: acc.description || '',
      is_default: acc.is_default ?? false
    });
    setIsDialogOpen(true);
  };

  const formatAmount = (val) => {
    const n = parseFloat(val);
    return isNaN(n) ? '0,000' : n.toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="page-header-title">Comptes caisse</h1>
            <p className="page-header-subtitle">Gérez vos caisses (espèces, tiroir-caisse)</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) { setEditingAccount(null); resetForm(); } setIsDialogOpen(open); }}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2" onClick={() => { setEditingAccount(null); resetForm(); setIsDialogOpen(true); }}>
                <Plus className="w-4 h-4" />
                Nouvelle caisse
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingAccount ? 'Modifier la caisse' : 'Nouvelle caisse'}</DialogTitle>
                <p className="mt-1 text-sm text-slate-500">
                  Comptes espèces pour encaissements et décaissements.
                </p>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Nom de la caisse *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Caisse principale, Tiroir-caisse"
                    required
                  />
                </div>
                <div>
                  <Label>Devise</Label>
                  <Select value={formData.currency} onValueChange={(v) => setFormData({ ...formData, currency: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {!editingAccount && (
                  <div>
                    <Label>Solde initial</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.initial_balance}
                      onChange={(e) => setFormData({ ...formData, initial_balance: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                )}
                {editingAccount && (
                  <div>
                    <Label>Solde actuel</Label>
                    <div className="flex h-10 items-center rounded-md border border-input bg-muted px-3 py-2 text-sm font-medium">
                      {formatAmount(editingAccount.balance)} {editingAccount.currency || formData.currency}
                    </div>
                  </div>
                )}
                <div>
                  <Label>Description (optionnel)</Label>
                  <Input
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Ex: Caisse du siège, Tiroir magasin"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_default_cash"
                    checked={formData.is_default}
                    onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                    className="rounded border-slate-300"
                  />
                  <Label htmlFor="is_default_cash">Compte caisse par défaut</Label>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Annuler</Button>
                  <Button type="submit">Enregistrer</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          {loading ? (
            <div className="p-8 text-center text-slate-500">Chargement...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Compte</TableHead>
                  <TableHead>Devise</TableHead>
                  <TableHead className="text-right">Solde</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-slate-500">
                      Aucune caisse. La caisse principale est créée automatiquement à la création de l&apos;entreprise.
                    </TableCell>
                  </TableRow>
                ) : (
                  accounts.map((acc) => (
                    <TableRow key={acc.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Wallet className="w-4 h-4 text-amber-600" />
                          <span className="font-medium text-slate-900">{acc.name}</span>
                          {acc.is_default && (
                            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs text-violet-700">Défaut</span>
                          )}
                        </div>
                        {acc.description && (
                          <p className="mt-0.5 text-xs text-slate-500">{acc.description}</p>
                        )}
                      </TableCell>
                      <TableCell>{acc.currency}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatAmount(acc.balance)} {acc.currency}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(acc)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </AppLayout>
  );
};

export default CashAccountsPage;
