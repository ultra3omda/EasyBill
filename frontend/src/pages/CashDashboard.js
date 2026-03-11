import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useCompany } from '../hooks/useCompany';
import AppLayout from '../components/layout/AppLayout';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Textarea } from '../components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../components/ui/table';
import {
  Banknote, TrendingUp, TrendingDown, Plus, RefreshCw, Wallet,
  Users, AlertCircle, Calendar, ArrowUpRight, ArrowDownRight, Wrench, Settings
} from 'lucide-react';
import { toast } from '../hooks/use-toast';
import { cashAPI } from '../services/api';

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Espèces' },
  { value: 'bank_transfer', label: 'Virement bancaire' },
  { value: 'check', label: 'Chèque' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'agent', label: 'Agent' },
  { value: 'card', label: 'Carte bancaire' },
];

export default function CashDashboard() {
  const { currentCompany } = useCompany();
  const [accounts, setAccounts] = useState([]);
  const [dailyReport, setDailyReport] = useState(null);
  const [customerBalances, setCustomerBalances] = useState([]);
  const [unpaidInvoices, setUnpaidInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Modals
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [transactionType, setTransactionType] = useState('in');

  const [accountForm, setAccountForm] = useState({
    name: '', currency: 'TND', initial_balance: 0, is_default: false, description: ''
  });
  const [txnForm, setTxnForm] = useState({
    cash_account_id: '', type: 'in', amount: '', payment_method: 'cash',
    label: '', reference: '', notes: ''
  });
  const [migrating, setMigrating] = useState(false);

  const fixPaidInvoicesCash = async () => {
    if (!currentCompany) return;
    if (!window.confirm('Analyser les factures payées en espèces et créer les transactions caisse manquantes ?')) return;
    setMigrating(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/cash/fix-paid-invoices-cash?company_id=${currentCompany.id}`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      const created = data.details?.filter(d => d.action === 'transaction_créée').length || 0;
      toast({
        title: created > 0 ? 'Migration réussie' : 'Aucune correction nécessaire',
        description: `${data.analyzed} factures analysées · ${created} transaction(s) caisse créée(s)`
      });
      load();
    } catch (e) {
      toast({ title: 'Erreur', description: 'Erreur lors de la migration', variant: 'destructive' });
    } finally {
      setMigrating(false);
    }
  };

  const load = useCallback(async () => {
    if (!currentCompany) return;
    setLoading(true);
    try {
      const [accRes, reportRes, balRes, unpaidRes] = await Promise.all([
        cashAPI.listAccounts(currentCompany.id, 'cash'),
        cashAPI.getDailyReport(currentCompany.id),
        cashAPI.getCustomerBalances(currentCompany.id),
        cashAPI.getUnpaidInvoices(currentCompany.id),
      ]);
      setAccounts(accRes.data);
      setDailyReport(reportRes.data);
      setCustomerBalances(balRes.data);
      setUnpaidInvoices(unpaidRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [currentCompany]);

  useEffect(() => { load(); }, [load]);

  const handleCreateAccount = async () => {
    try {
      await cashAPI.createAccount(currentCompany.id, {
        ...accountForm,
        initial_balance: parseFloat(accountForm.initial_balance) || 0,
        account_type: 'cash'
      });
      toast({ title: 'Compte créé', description: accountForm.name });
      setShowAccountModal(false);
      setAccountForm({ name: '', currency: 'TND', initial_balance: 0, is_default: false, description: '' });
      load();
    } catch (e) {
      toast({ title: 'Erreur', description: e.response?.data?.detail || 'Erreur création', variant: 'destructive' });
    }
  };

  const handleTransaction = async () => {
    try {
      await cashAPI.recordTransaction(currentCompany.id, {
        ...txnForm,
        amount: parseFloat(txnForm.amount),
        type: transactionType
      });
      toast({ title: 'Transaction enregistrée' });
      setShowTransactionModal(false);
      setTxnForm({ cash_account_id: '', type: 'in', amount: '', payment_method: 'cash', label: '', reference: '', notes: '' });
      load();
    } catch (e) {
      toast({ title: 'Erreur', description: e.response?.data?.detail || 'Erreur', variant: 'destructive' });
    }
  };

  const totalBalance = accounts.reduce((s, a) => s + (a.balance || 0), 0);
  const totalDue = customerBalances.reduce((s, c) => s + (c.total_due || 0), 0);

  const tabs = [
    { id: 'overview', label: 'Vue d\'ensemble' },
    { id: 'accounts', label: 'Comptes caisse' },
    { id: 'customers', label: 'Soldes clients' },
    { id: 'unpaid', label: 'Factures impayées' },
  ];

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Caisse & Paiements</h1>
            <p className="text-gray-500 text-sm mt-1">Suivi des espèces, soldes clients, rapport journalier</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/cash-accounts">
                <Settings className="h-4 w-4 mr-1" /> Configurer caisse
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={load}>
              <RefreshCw className="h-4 w-4 mr-1" /> Actualiser
            </Button>
            <Button
              variant="outline" size="sm"
              onClick={fixPaidInvoicesCash}
              disabled={migrating}
              className="border-orange-300 text-orange-700 hover:bg-orange-50"
              title="Créer les transactions caisse manquantes pour les factures déjà payées en espèces"
            >
              {migrating ? <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> : <Wrench className="h-4 w-4 mr-1" />}
              Corriger caisse
            </Button>
            <Button size="sm" onClick={() => { setTransactionType('in'); setShowTransactionModal(true); }}
              className="bg-green-600 hover:bg-green-700">
              <ArrowUpRight className="h-4 w-4 mr-1" /> Encaisser
            </Button>
            <Button size="sm" onClick={() => { setTransactionType('out'); setShowTransactionModal(true); }}
              className="bg-red-600 hover:bg-red-700">
              <ArrowDownRight className="h-4 w-4 mr-1" /> Décaisser
            </Button>
            <Button size="sm" onClick={() => setShowAccountModal(true)}>
              <Plus className="h-4 w-4 mr-1" /> Nouveau compte
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Solde total caisse</p>
                <p className="text-2xl font-bold text-gray-900">{totalBalance.toFixed(3)}</p>
                <p className="text-xs text-gray-400">TND</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-full"><Wallet className="h-6 w-6 text-blue-600" /></div>
            </div>
          </Card>

          {dailyReport && (
            <>
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Encaissements aujourd'hui</p>
                    <p className="text-2xl font-bold text-green-600">{dailyReport.total_in?.toFixed(3)}</p>
                    <p className="text-xs text-gray-400">TND</p>
                  </div>
                  <div className="bg-green-100 p-3 rounded-full"><TrendingUp className="h-6 w-6 text-green-600" /></div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Décaissements aujourd'hui</p>
                    <p className="text-2xl font-bold text-red-600">{dailyReport.total_out?.toFixed(3)}</p>
                    <p className="text-xs text-gray-400">TND</p>
                  </div>
                  <div className="bg-red-100 p-3 rounded-full"><TrendingDown className="h-6 w-6 text-red-600" /></div>
                </div>
              </Card>
            </>
          )}

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Créances clients</p>
                <p className="text-2xl font-bold text-orange-600">{totalDue.toFixed(3)}</p>
                <p className="text-xs text-gray-400">{customerBalances.length} client(s)</p>
              </div>
              <div className="bg-orange-100 p-3 rounded-full"><Users className="h-6 w-6 text-orange-600" /></div>
            </div>
          </Card>
        </div>

        {/* Tabs */}
        <div className="border-b flex gap-4">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && dailyReport && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Calendar className="h-4 w-4" /> Rapport journalier — {dailyReport.date}
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between border-b pb-2">
                  <span className="text-gray-500">Solde ouverture</span>
                  <span className="font-medium">{dailyReport.opening_balance?.toFixed(3)} TND</span>
                </div>
                <div className="flex justify-between text-green-600">
                  <span>+ Encaissements</span>
                  <span className="font-medium">{dailyReport.total_in?.toFixed(3)}</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>- Décaissements</span>
                  <span className="font-medium">{dailyReport.total_out?.toFixed(3)}</span>
                </div>
                <div className="flex justify-between border-t pt-2 font-semibold">
                  <span>Solde clôture</span>
                  <span>{dailyReport.closing_balance?.toFixed(3)} TND</span>
                </div>
                <div className="text-xs text-gray-400 mt-2">{dailyReport.transaction_count} transaction(s)</div>
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-orange-500" /> Top créances
              </h3>
              {customerBalances.slice(0, 5).map(c => (
                <div key={c.customer_id} className="flex justify-between py-2 border-b last:border-0 text-sm">
                  <div>
                    <div className="font-medium">{c.customer_name}</div>
                    <div className="text-xs text-gray-400">{c.invoice_count} facture(s) · {c.overdue_days}j de retard</div>
                  </div>
                  <span className="font-semibold text-red-600">{c.total_due?.toFixed(3)}</span>
                </div>
              ))}
              {customerBalances.length === 0 && (
                <p className="text-gray-400 text-sm text-center py-4">Aucune créance en cours</p>
              )}
            </Card>
          </div>
        )}

        {activeTab === 'accounts' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {accounts.map(acc => (
              <Card key={acc.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{acc.name}</h3>
                    {acc.is_default && <Badge className="text-xs mt-1">Par défaut</Badge>}
                    {acc.description && <p className="text-xs text-gray-400 mt-1">{acc.description}</p>}
                  </div>
                  <Banknote className="h-5 w-5 text-blue-500" />
                </div>
                <div className="mt-4">
                  <p className="text-2xl font-bold">{acc.balance?.toFixed(3)}</p>
                  <p className="text-xs text-gray-400">{acc.currency} · Solde initial : {acc.initial_balance?.toFixed(3)}</p>
                </div>
              </Card>
            ))}
            {accounts.length === 0 && !loading && (
              <div className="col-span-3 text-center py-12 text-gray-400">
                <Banknote className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p>Aucun compte caisse. Créez-en un pour commencer.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'customers' && (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead className="text-right">Factures</TableHead>
                  <TableHead className="text-right">Retard (j)</TableHead>
                  <TableHead className="text-right">Solde dû</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customerBalances.map(c => (
                  <TableRow key={c.customer_id}>
                    <TableCell className="font-medium">{c.customer_name}</TableCell>
                    <TableCell>{c.phone || '—'}</TableCell>
                    <TableCell className="text-right">{c.invoice_count}</TableCell>
                    <TableCell className="text-right">
                      <span className={c.overdue_days > 30 ? 'text-red-600 font-semibold' : ''}>
                        {c.overdue_days}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-red-600">
                      {c.total_due?.toFixed(3)} TND
                    </TableCell>
                  </TableRow>
                ))}
                {customerBalances.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-gray-400 py-8">Aucune créance</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        )}

        {activeTab === 'unpaid' && (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Facture</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Échéance</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Restant</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unpaidInvoices.map(inv => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.number}</TableCell>
                    <TableCell>{inv.customer_name}</TableCell>
                    <TableCell>
                      {inv.due_date ? new Date(inv.due_date).toLocaleDateString('fr-FR') : '—'}
                      {inv.days_overdue > 0 && (
                        <span className="ml-1 text-xs text-red-500">+{inv.days_overdue}j</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{inv.total?.toFixed(3)}</TableCell>
                    <TableCell className="text-right font-semibold text-red-600">
                      {inv.balance_due?.toFixed(3)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={inv.status === 'partial' ? 'secondary' : 'destructive'}>
                        {inv.status === 'partial' ? 'Partiel' : 'Impayé'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {unpaidInvoices.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-gray-400 py-8">Toutes les factures sont réglées ✓</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      {/* Modal création compte caisse */}
      <Dialog open={showAccountModal} onOpenChange={setShowAccountModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouveau compte caisse</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nom du compte *</Label>
              <Input value={accountForm.name} onChange={e => setAccountForm({ ...accountForm, name: e.target.value })}
                placeholder="Ex: Caisse principale" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Devise</Label>
                <Select value={accountForm.currency} onValueChange={v => setAccountForm({ ...accountForm, currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TND">TND (Dinar)</SelectItem>
                    <SelectItem value="EUR">EUR (Euro)</SelectItem>
                    <SelectItem value="USD">USD (Dollar)</SelectItem>
                    <SelectItem value="MAD">MAD (Dirham)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Solde initial</Label>
                <Input type="number" value={accountForm.initial_balance}
                  onChange={e => setAccountForm({ ...accountForm, initial_balance: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={accountForm.description}
                onChange={e => setAccountForm({ ...accountForm, description: e.target.value })}
                rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAccountModal(false)}>Annuler</Button>
            <Button onClick={handleCreateAccount}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal transaction */}
      <Dialog open={showTransactionModal} onOpenChange={setShowTransactionModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {transactionType === 'in' ? '💚 Encaissement' : '🔴 Décaissement'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Compte caisse *</Label>
              <Select value={txnForm.cash_account_id} onValueChange={v => setTxnForm({ ...txnForm, cash_account_id: v })}>
                <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                <SelectContent>
                  {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name} — {a.balance?.toFixed(3)} {a.currency}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Montant *</Label>
                <Input type="number" value={txnForm.amount}
                  onChange={e => setTxnForm({ ...txnForm, amount: e.target.value })} placeholder="0.000" />
              </div>
              <div>
                <Label>Mode de paiement</Label>
                <Select value={txnForm.payment_method} onValueChange={v => setTxnForm({ ...txnForm, payment_method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Libellé *</Label>
              <Input value={txnForm.label} onChange={e => setTxnForm({ ...txnForm, label: e.target.value })}
                placeholder="Ex: Paiement facture F-2025-001" />
            </div>
            <div>
              <Label>Référence</Label>
              <Input value={txnForm.reference} onChange={e => setTxnForm({ ...txnForm, reference: e.target.value })}
                placeholder="N° chèque, virement…" />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={txnForm.notes} onChange={e => setTxnForm({ ...txnForm, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTransactionModal(false)}>Annuler</Button>
            <Button
              onClick={handleTransaction}
              className={transactionType === 'in' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
