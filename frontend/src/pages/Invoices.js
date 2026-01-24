import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { invoicesAPI } from '../services/api';
import { useCompany } from '../hooks/useCompany';
import AppLayout from '../components/layout/AppLayout';
import InvoiceFormModal from '../components/modals/InvoiceFormModal';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
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
import { Plus, Search, Filter, Download, Send, Eye, Edit, Trash2, MoreVertical, FileText, CreditCard, CheckCircle } from 'lucide-react';
import { toast } from '../hooks/use-toast';

const Invoices = () => {
  const { t } = useLanguage();
  const { currentCompany } = useCompany();
  const [invoices, setInvoices] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [loading, setLoading] = useState(true);

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

  const handleMarkPaid = async (invoiceId) => {
    try {
      await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/invoices/${invoiceId}/mark-paid?company_id=${currentCompany.id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      toast({ title: 'Succès', description: 'Facture marquée comme payée' });
      loadInvoices();
    } catch (error) {
      toast({ title: 'Erreur', description: 'Erreur lors du paiement', variant: 'destructive' });
    }
  };

  const openCreateModal = () => {
    setSelectedInvoice(null);
    setModalOpen(true);
  };

  const openEditModal = (invoice) => {
    setSelectedInvoice(invoice);
    setModalOpen(true);
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
          <Button className="bg-teal-600 hover:bg-teal-700 text-white" onClick={openCreateModal}>
            <Plus className="w-4 h-4 mr-2" />
            {t('invoices.createInvoice')}
          </Button>
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

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-100 rounded-lg">
                <FileText className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Facturé</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalInvoiced.toFixed(2)} TND</p>
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
                <p className="text-2xl font-bold text-green-600">{stats.totalPaid.toFixed(2)} TND</p>
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
                <p className="text-2xl font-bold text-orange-600">{stats.totalPending.toFixed(2)} TND</p>
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
                <p className="text-2xl font-bold text-red-600">{stats.totalOverdue.toFixed(2)} TND</p>
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
                            <span className="font-semibold">{(invoice.total || 0).toFixed(2)} TND</span>
                            {invoice.balance_due > 0 && invoice.balance_due < invoice.total && (
                              <p className="text-xs text-orange-600">Reste: {invoice.balance_due.toFixed(2)} TND</p>
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
                                <DropdownMenuItem onClick={() => handleMarkPaid(invoice.id)}>
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

      <InvoiceFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={loadInvoices}
        invoice={selectedInvoice}
      />
    </AppLayout>
  );
};

export default Invoices;