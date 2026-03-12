import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { invoicesAPI, pdfAPI } from '../services/api';
import { useCompany } from '../hooks/useCompany';
import AppLayout from '../components/layout/AppLayout';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
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
import { Label } from '../components/ui/label';
import axios from 'axios';
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
import { Plus, Search, Filter, Download, Send, Eye, Edit, Trash2, MoreVertical, FileText, CreditCard, CheckCircle, Printer, Banknote, Building2, CreditCard as CardIcon, Upload } from 'lucide-react';
import { toast } from '../hooks/use-toast';
import { importExportAPI } from '../services/api';

const PAYMENT_METHODS = [
  { value: 'cash',     label: 'Espèces',          icon: '💵', account: '531 Caisse' },
  { value: 'check',    label: 'Chèque',            icon: '📋', account: '521 Banques' },
  { value: 'transfer', label: 'Virement bancaire', icon: '🏦', account: '521 Banques' },
  { value: 'card',     label: 'Carte bancaire',    icon: '💳', account: '521 Banques - TPE' },
  { value: 'e_dinar',  label: 'e-Dinar',           icon: '📱', account: '531 Caisse élec.' },
];

const Invoices = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const [invoices, setInvoices] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // Modale de paiement
  const [paymentModal, setPaymentModal] = useState({ open: false, invoiceId: null, invoiceNumber: '' });
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('cash');
  const [markingPaid, setMarkingPaid] = useState(false);
  // Import Odoo
  const [importOdooOpen, setImportOdooOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importUseOdooNumber, setImportUseOdooNumber] = useState(true);
  const [importStatus, setImportStatus] = useState('sent');
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (currentCompany) {
      loadInvoices();
    }
  }, [currentCompany]);

  const loadInvoices = async () => {
    if (!currentCompany) return;
    setLoading(true);
    try {
      const response = await invoicesAPI.list(currentCompany.id, { search: searchTerm });
      setInvoices(response.data);
    } catch (error) {
      console.error('Error loading invoices:', error);
      toast({ title: 'Erreur', description: 'Impossible de charger les factures', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (invoiceId) => {
    if (!window.confirm('Voulez-vous vraiment supprimer cette facture ?')) return;
    try {
      await invoicesAPI.delete(currentCompany.id, invoiceId);
      toast({ title: 'Succès', description: 'Facture supprimée' });
      loadInvoices();
    } catch (error) {
      toast({ title: 'Erreur', description: 'Erreur lors de la suppression', variant: 'destructive' });
    }
  };

  const handleSend = async (invoiceId) => {
    try {
      await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/invoices/${invoiceId}/send?company_id=${currentCompany.id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      toast({ title: 'Succès', description: 'Facture marquée comme envoyée' });
      loadInvoices();
    } catch (error) {
      toast({ title: 'Erreur', description: 'Erreur lors de l\'envoi', variant: 'destructive' });
    }
  };

  const openPaymentModal = (invoice) => {
    setPaymentModal({ open: true, invoiceId: invoice.id, invoiceNumber: invoice.number });
    setSelectedPaymentMethod('cash');
  };

  const handleMarkPaid = async () => {
    if (!paymentModal.invoiceId) return;
    setMarkingPaid(true);
    try {
      await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/invoices/${paymentModal.invoiceId}/mark-paid?company_id=${currentCompany.id}&payment_method=${selectedPaymentMethod}`,
        { method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }
      );
      const method = PAYMENT_METHODS.find(m => m.value === selectedPaymentMethod);
      toast({ title: 'Succès', description: `Facture ${paymentModal.invoiceNumber} payée par ${method?.label} — écritures comptables générées` });
      setPaymentModal({ open: false, invoiceId: null, invoiceNumber: '' });
      loadInvoices();
    } catch (error) {
      toast({ title: 'Erreur', description: 'Erreur lors de l\'enregistrement du paiement', variant: 'destructive' });
    } finally {
      setMarkingPaid(false);
    }
  };

  const handleDownloadPdf = async (invoice) => {
    try {
      const response = await pdfAPI.downloadInvoice(currentCompany.id, invoice.id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Facture_${invoice.number}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast({ title: 'Succès', description: 'PDF téléchargé' });
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast({ title: 'Erreur', description: 'Erreur lors du téléchargement du PDF', variant: 'destructive' });
    }
  };

  const handleSendByEmail = async (invoiceId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/api/invoices/${invoiceId}/send-email?company_id=${currentCompany.id}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast({ title: 'Succès', description: 'Facture envoyée par email avec succès' });
      loadInvoices();
    } catch (error) {
      console.error('Error sending invoice by email:', error);
      toast({ title: 'Erreur', description: error.response?.data?.detail || 'Erreur lors de l\'envoi de l\'email', variant: 'destructive' });
    }
  };


  const openCreateModal = () => {
    navigate('/sales/invoices/new');
  };

  const openEditModal = (invoice) => {
    navigate(`/sales/invoices/${invoice.id}/edit`);
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      paid: { label: t('invoices.paid'), className: 'bg-green-100 text-green-800' },
      sent: { label: t('invoices.sent'), className: 'bg-blue-100 text-blue-800' },
      draft: { label: t('invoices.draft'), className: 'bg-gray-100 text-gray-800' },
      overdue: { label: t('invoices.overdue'), className: 'bg-red-100 text-red-800' },
      partial: { label: t('invoices.partial'), className: 'bg-orange-100 text-orange-800' },
    };
    return statusConfig[status] || statusConfig.draft;
  };

  const filteredInvoices = invoices.filter(invoice =>
    invoice.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    invoice.number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate stats from real data
  const stats = {
    totalInvoiced: filteredInvoices.reduce((acc, inv) => acc + (inv.total || 0), 0),
    totalPaid: filteredInvoices.filter(inv => inv.status === 'paid').reduce((acc, inv) => acc + (inv.total || 0), 0),
    totalPending: filteredInvoices.filter(inv => ['draft', 'sent'].includes(inv.status)).reduce((acc, inv) => acc + (inv.balance_due || 0), 0),
    totalOverdue: filteredInvoices.filter(inv => inv.status === 'overdue').reduce((acc, inv) => acc + (inv.balance_due || 0), 0),
    paidCount: filteredInvoices.filter(inv => inv.status === 'paid').length,
    pendingCount: filteredInvoices.filter(inv => ['draft', 'sent'].includes(inv.status)).length,
    overdueCount: filteredInvoices.filter(inv => inv.status === 'overdue').length
  };

  if (!currentCompany) {
    return <AppLayout><div className="text-center py-20">Aucune entreprise sélectionnée</div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{t('invoices.title')}</h1>
            <p className="text-gray-500 mt-1">{filteredInvoices.length} factures au total</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setImportOdooOpen(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Importer Odoo
            </Button>
            <Button className="bg-violet-600 hover:bg-violet-700 text-white" onClick={openCreateModal} data-testid="create-invoice-btn">
              <Plus className="w-4 h-4 mr-2" />
              {t('invoices.createInvoice')}
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                placeholder={t('common.search')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" className="flex items-center gap-2">
              <Filter className="w-4 h-4" />
              {t('common.filter')}
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              {t('common.export')}
            </Button>
          </div>
        </Card>

        {/* Import Odoo Dialog */}
        <Dialog open={importOdooOpen} onOpenChange={setImportOdooOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Importer des factures Odoo</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-gray-600">
              Importez un export CSV de factures Odoo. Les clients seront créés automatiquement.
            </p>
            <div className="space-y-4 py-4">
              <div>
                <Label>Fichier CSV</Label>
                <Input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setImportFile(e.target.files?.[0])}
                  className="mt-1"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="useOdooNumber"
                  checked={importUseOdooNumber}
                  onChange={(e) => setImportUseOdooNumber(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="useOdooNumber">Conserver les numéros Odoo</Label>
              </div>
              <div>
                <Label>Statut par défaut</Label>
                <Select value={importStatus} onValueChange={setImportStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sent">Envoyée</SelectItem>
                    <SelectItem value="paid">Payée</SelectItem>
                    <SelectItem value="draft">Brouillon</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setImportOdooOpen(false)}>Annuler</Button>
              <Button
                className="bg-violet-600 hover:bg-violet-700"
                disabled={!importFile || importing}
                onClick={async () => {
                  if (!importFile || !currentCompany) return;
                  setImporting(true);
                  try {
                    const formData = new FormData();
                    formData.append('file', importFile);
                    const res = await importExportAPI.importOdooInvoices(currentCompany.id, formData, {
                      use_odoo_number: importUseOdooNumber,
                      default_status: importStatus
                    });
                    toast({ title: 'Succès', description: res.data?.message || 'Import terminé' });
                    setImportOdooOpen(false);
                    setImportFile(null);
                    loadInvoices();
                  } catch (err) {
                    toast({
                      title: 'Erreur',
                      description: err.response?.data?.detail || err.message || 'Import échoué',
                      variant: 'destructive'
                    });
                  } finally {
                    setImporting(false);
                  }
                }}
              >
                {importing ? 'Import en cours...' : 'Importer'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-100 rounded-lg">
                <FileText className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Facturé</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalInvoiced.toFixed(3)} TND</p>
                <p className="text-xs text-gray-500">{filteredInvoices.length} factures</p>
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Payées</p>
                <p className="text-2xl font-bold text-green-600">{stats.totalPaid.toFixed(3)} TND</p>
                <p className="text-xs text-gray-500">{stats.paidCount} factures</p>
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <CreditCard className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">En attente</p>
                <p className="text-2xl font-bold text-orange-600">{stats.totalPending.toFixed(3)} TND</p>
                <p className="text-xs text-gray-500">{stats.pendingCount} factures</p>
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <FileText className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">En retard</p>
                <p className="text-2xl font-bold text-red-600">{stats.totalOverdue.toFixed(3)} TND</p>
                <p className="text-xs text-gray-500">{stats.overdueCount} factures</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Invoices Table */}
        <Card>
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 mx-auto"></div>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="p-8 text-center">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Aucune facture trouvée</p>
              <Button onClick={openCreateModal} className="mt-4 bg-violet-600 hover:bg-violet-700">
                <Plus className="w-4 h-4 mr-2" />
                Créer votre première facture
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('invoices.invoiceNumber')}</TableHead>
                    <TableHead>{t('invoices.customer')}</TableHead>
                    <TableHead>{t('invoices.date')}</TableHead>
                    <TableHead>{t('invoices.dueDate')}</TableHead>
                    <TableHead>{t('invoices.amount')}</TableHead>
                    <TableHead>{t('invoices.status')}</TableHead>
                    <TableHead className="text-right">{t('invoices.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((invoice) => {
                    const statusConfig = getStatusBadge(invoice.status);
                    return (
                      <TableRow key={invoice.id} className="hover:bg-gray-50" data-testid={`invoice-row-${invoice.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center">
                              <FileText className="w-5 h-5 text-violet-600" />
                            </div>
                            <span className="font-medium">{invoice.number}</span>
                          </div>
                        </TableCell>
                        <TableCell>{invoice.customer_name}</TableCell>
                        <TableCell>{invoice.date ? new Date(invoice.date).toLocaleDateString('fr-FR') : '-'}</TableCell>
                        <TableCell>{invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('fr-FR') : '-'}</TableCell>
                        <TableCell>
                          <div>
                            <span className="font-semibold">{(invoice.total || 0).toFixed(3)} TND</span>
                            {invoice.balance_due > 0 && invoice.balance_due < invoice.total && (
                              <p className="text-xs text-orange-600">Reste: {invoice.balance_due.toFixed(3)} TND</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={statusConfig.className}>
                            {statusConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" data-testid={`invoice-actions-${invoice.id}`}>
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleDownloadPdf(invoice)}>
                                <Printer className="w-4 h-4 mr-2" />
                                Télécharger PDF
                              </DropdownMenuItem>
                              {invoice.status === 'draft' && (
                                <DropdownMenuItem onClick={() => handleSendByEmail(invoice.id)}>
                                  <Send className="w-4 h-4 mr-2" />
                                  Envoyer par email
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => openEditModal(invoice)}>
                                <Edit className="w-4 h-4 mr-2" />
                                Modifier
                              </DropdownMenuItem>
                              {invoice.status === 'draft' && (
                                <DropdownMenuItem onClick={() => handleSend(invoice.id)}>
                                  <Send className="w-4 h-4 mr-2" />
                                  Marquer envoyée
                                </DropdownMenuItem>
                              )}
                              {invoice.status !== 'paid' && (
                                <DropdownMenuItem onClick={() => openPaymentModal(invoice)}>
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  Marquer payée
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(invoice.id)}>
                                <Trash2 className="w-4 h-4 mr-2" />
                                {t('invoices.delete')}
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


      {/* ── Modale mode de règlement ─────────────────────────────────── */}
      <Dialog open={paymentModal.open} onOpenChange={(o) => !o && setPaymentModal({ open: false, invoiceId: null, invoiceNumber: '' })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Enregistrer le paiement
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-600">
              Facture <span className="font-semibold text-gray-900">{paymentModal.invoiceNumber}</span> — choisissez le mode de règlement pour générer les écritures comptables correctes.
            </p>

            <div>
              <Label className="text-sm font-medium mb-2 block">Mode de règlement</Label>
              <div className="grid grid-cols-1 gap-2">
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setSelectedPaymentMethod(m.value)}
                    className={`flex items-center justify-between px-4 py-3 rounded-lg border-2 transition-all text-left ${
                      selectedPaymentMethod === m.value
                        ? 'border-violet-500 bg-violet-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{m.icon}</span>
                      <span className="font-medium text-sm">{m.label}</span>
                    </div>
                    <span className="text-xs text-gray-400 font-mono">{m.account}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700 space-y-1">
              <p className="font-semibold">Écritures générées automatiquement :</p>
              <p>① Vente : <span className="font-mono">411 Clients → 707 Ventes + 4351 TVA</span></p>
              <p>② Règlement : <span className="font-mono">{PAYMENT_METHODS.find(m => m.value === selectedPaymentMethod)?.account} → 411 Clients</span></p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentModal({ open: false, invoiceId: null, invoiceNumber: '' })}>
              Annuler
            </Button>
            <Button onClick={handleMarkPaid} disabled={markingPaid} className="bg-green-600 hover:bg-green-700 text-white">
              {markingPaid ? 'Enregistrement...' : 'Confirmer le paiement'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </AppLayout>
  );
};

export default Invoices;