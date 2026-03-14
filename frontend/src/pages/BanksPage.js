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
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
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
import { Plus, Pencil, Trash2, Building2 } from 'lucide-react';
import { toast } from '../hooks/use-toast';
import { useCompany } from '../hooks/useCompany';
import { cashAPI } from '../services/api';

const CURRENCIES = [
  { value: 'TND', label: 'TND' },
  { value: 'EUR', label: 'EUR' },
  { value: 'USD', label: 'USD' }
];

const TUNISIAN_BANKS = [
  'BIAT',
  'BNA',
  'STB',
  'BH',
  'Attijari Bank',
  'Amen Bank',
  'Arab Tunisian Bank',
  'UIB',
  'Banque de Tunisie',
  'Banque Zitouna',
  'Al Baraka Bank',
  'Bank ABC',
  'Banque de Tunisie et des Émirats',
  'Banque Tuniso-Koweïtienne',
  'Banque Tuniso-Libyenne',
  'Banque Tunisienne de Solidarité',
  'North Africa International Bank',
  'Office National des Postes',
  'Qatar National Bank',
  'Tunis International Bank',
  'Tunisian Saudi Bank',
  'UBCI',
  'Wifak Bank',
  'Autre'
];

const BanksPage = () => {
  const { currentCompany } = useCompany();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [accountToDelete, setAccountToDelete] = useState(null);
  const loadedAccountIdRef = React.useRef(null);
  const [formData, setFormData] = useState({
    name: '',
    currency: 'TND',
    initial_balance: '0',
    description: '',
    is_default: false,
    bank_name: '',
    rib: '',
    show_in_footer: false,
    bank_other_mode: false
  });

  useEffect(() => {
    if (currentCompany?.id) {
      loadAccounts();
    }
  }, [currentCompany]);

  useEffect(() => {
    if (isDialogOpen && editingAccount?.id && currentCompany?.id) {
      const acc = editingAccount;
      if (loadedAccountIdRef.current === acc.id) {
        return;
      }
      loadedAccountIdRef.current = acc.id;
      cashAPI.getAccount(currentCompany.id, acc.id)
        .then((res) => {
          const data = res.data && typeof res.data === 'object' ? res.data : acc;
          setEditingAccount((prev) => prev ? { ...prev, ...data } : null);
          setFormData({
            name: String(data.name || ''),
            currency: data.currency || 'TND',
            initial_balance: String(data.initial_balance ?? data.balance ?? 0),
            description: String(data.description || ''),
            is_default: Boolean(data.is_default),
            bank_name: String(data.bank_name || ''),
            rib: String(data.rib || ''),
            show_in_footer: Boolean(data.show_in_footer),
            bank_other_mode: !!(data.bank_name && !TUNISIAN_BANKS.includes(data.bank_name))
          });
        })
        .catch(() => {
          setFormData({
            name: String(acc.name || ''),
            currency: acc.currency || 'TND',
            initial_balance: String(acc.initial_balance ?? acc.balance ?? 0),
            description: String(acc.description || ''),
            is_default: Boolean(acc.is_default),
            bank_name: String(acc.bank_name || ''),
            rib: String(acc.rib || ''),
            show_in_footer: Boolean(acc.show_in_footer),
            bank_other_mode: !!(acc.bank_name && !TUNISIAN_BANKS.includes(acc.bank_name))
          });
        });
    } else if (isDialogOpen && !editingAccount) {
      loadedAccountIdRef.current = null;
      resetForm();
    } else if (!isDialogOpen) {
      loadedAccountIdRef.current = null;
    }
  }, [isDialogOpen, editingAccount, currentCompany?.id]);

  const loadAccounts = async () => {
    try {
      const res = await cashAPI.listAccounts(currentCompany.id, 'bank');
      setAccounts(res.data || []);
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les comptes',
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
        initial_balance: parseFloat(formData.initial_balance) || 0,
        description: formData.description || null,
        is_default: formData.is_default,
        account_type: 'bank',
        bank_name: (formData.bank_name || '').trim() || null,
        rib: (formData.rib || '').trim() || null,
        show_in_footer: formData.show_in_footer
      };

      if (editingAccount) {
        await cashAPI.updateAccount(currentCompany.id, editingAccount.id, payload);
        toast({ title: 'Succès', description: 'Compte mis à jour' });
      } else {
        await cashAPI.createAccount(currentCompany.id, payload);
        toast({ title: 'Succès', description: 'Compte créé' });
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
      is_default: false,
      bank_name: '',
      rib: '',
      show_in_footer: false,
      bank_other_mode: false
    });
  };

  const handleEdit = (acc) => {
    setEditingAccount(acc);
    setFormData({
      name: acc.name || '',
      currency: acc.currency || 'TND',
      initial_balance: String(acc.initial_balance ?? acc.balance ?? 0),
      description: acc.description || '',
      is_default: acc.is_default ?? false,
      bank_name: acc.bank_name || '',
      rib: acc.rib || '',
      show_in_footer: acc.show_in_footer ?? false,
      bank_other_mode: !!(acc.bank_name && !TUNISIAN_BANKS.includes(acc.bank_name))
    });
    setIsDialogOpen(true);
  };

  const openNewDialog = () => {
    setEditingAccount(null);
    resetForm();
    setIsDialogOpen(true);
  };

  const formatAmount = (val) => {
    const n = parseFloat(val);
    return isNaN(n) ? '0,000' : n.toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  };

  const handleDelete = async () => {
    if (!accountToDelete) return;
    try {
      await cashAPI.deleteAccount(currentCompany.id, accountToDelete.id);
      toast({ title: 'Succès', description: 'Compte supprimé' });
      setAccountToDelete(null);
      loadAccounts();
    } catch (err) {
      toast({ title: 'Erreur', description: err.response?.data?.detail || 'Impossible de supprimer', variant: 'destructive' });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="page-header-title">Banques</h1>
            <p className="page-header-subtitle">Gérez vos comptes bancaires</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) { setEditingAccount(null); resetForm(); } setIsDialogOpen(open); }}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2" onClick={openNewDialog}>
                <Plus className="w-4 h-4" />
                Nouveau compte
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingAccount ? 'Modifier le compte' : 'Nouveau compte'}</DialogTitle>
                <p className="mt-1 text-sm text-slate-500">
                  Renseignez la banque et le RIB pour identifier le compte.
                </p>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Nom du compte</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Compte BNA, Caisse principale"
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
                    placeholder="Ex: Compte courant, Compte épargne"
                  />
                </div>
                <div>
                  <Label>Banque (optionnel)</Label>
                  <Select
                    value={TUNISIAN_BANKS.includes(formData.bank_name) ? formData.bank_name : (formData.bank_other_mode || (formData.bank_name && !TUNISIAN_BANKS.includes(formData.bank_name)) ? '__autre__' : '__aucune__')}
                    onValueChange={(v) => setFormData({ ...formData, bank_name: v === '__autre__' ? '' : (v === '__aucune__' ? '' : v), bank_other_mode: v === '__autre__' })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une banque" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__aucune__">Aucune</SelectItem>
                      {TUNISIAN_BANKS.map((b) => (
                        <SelectItem key={b} value={b}>{b}</SelectItem>
                      ))}
                      <SelectItem value="__autre__">Autre</SelectItem>
                    </SelectContent>
                  </Select>
                  {(formData.bank_other_mode || (formData.bank_name && !TUNISIAN_BANKS.includes(formData.bank_name))) && (
                    <Input
                      className="mt-2"
                      value={formData.bank_name}
                      onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                      placeholder="Saisir le nom de la banque"
                    />
                  )}
                </div>
                <div>
                  <Label>RIB / Numéro de compte (optionnel)</Label>
                  <Input
                    value={formData.rib}
                    onChange={(e) => setFormData({ ...formData, rib: e.target.value })}
                    placeholder="Ex: 08006000661006230813"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="show_in_footer"
                    checked={formData.show_in_footer}
                    onChange={(e) => setFormData({ ...formData, show_in_footer: e.target.checked })}
                    className="rounded border-slate-300"
                  />
                  <Label htmlFor="show_in_footer">Afficher en pied des factures</Label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_default"
                    checked={formData.is_default}
                    onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                    className="rounded border-slate-300"
                  />
                  <Label htmlFor="is_default">Compte par défaut</Label>
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
                      Aucun compte bancaire. Cliquez sur « Nouveau compte » pour en ajouter un.
                    </TableCell>
                  </TableRow>
                ) : (
                  accounts.map((acc) => (
                    <TableRow key={acc.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-violet-600" />
                          <span className="font-medium text-slate-900">{acc.name}</span>
                          {acc.is_default && (
                            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs text-violet-700">Défaut</span>
                          )}
                          {acc.show_in_footer && (
                            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">Pied de page</span>
                          )}
                        </div>
                        {(acc.description || acc.bank_name || acc.rib) && (
                          <p className="mt-0.5 text-xs text-slate-500">
                            {acc.bank_name && acc.rib ? `${acc.bank_name} - RIB: ${acc.rib}` : (acc.description || acc.bank_name || acc.rib)}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>{acc.currency}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatAmount(acc.balance)} {acc.currency}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(acc)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setAccountToDelete(acc)} className="text-red-600 hover:bg-red-50 hover:text-red-700">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </Card>

        <AlertDialog open={!!accountToDelete} onOpenChange={(open) => !open && setAccountToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer le compte ?</AlertDialogTitle>
              <AlertDialogDescription>
                Êtes-vous sûr de vouloir supprimer « {accountToDelete?.name} » ? Cette action est irréversible.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <Button variant="destructive" onClick={handleDelete}>Supprimer</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
};

export default BanksPage;
