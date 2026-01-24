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
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { Plus, Search, Filter, Download, Send, Eye, Edit, Trash2, MoreVertical } from 'lucide-react';
import { toast } from '../hooks/use-toast';

const Invoices = () => {
  const { t } = useLanguage();
  const { currentCompany } = useCompany();
  const [invoices, setInvoices] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
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

  const openCreateModal = () => {
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
            <p className="text-sm text-gray-600 mb-2">Total Facturé</p>
            <p className="text-2xl font-bold text-gray-900">94,510 TND</p>
            <p className="text-xs text-green-600 mt-1">+12% ce mois</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-gray-600 mb-2">Payées</p>
            <p className="text-2xl font-bold text-green-600">45,900 TND</p>
            <p className="text-xs text-gray-500 mt-1">3 factures</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-gray-600 mb-2">En attente</p>
            <p className="text-2xl font-bold text-orange-600">31,420 TND</p>
            <p className="text-xs text-gray-500 mt-1">2 factures</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-gray-600 mb-2">En retard</p>
            <p className="text-2xl font-bold text-red-600">15,420 TND</p>
            <p className="text-xs text-gray-500 mt-1">1 facture</p>
          </Card>
        </div>

        {/* Invoices Table */}
        <Card>
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
                    <TableRow key={invoice.id} className="hover:bg-gray-50">
                      <TableCell className="font-medium">{invoice.id}</TableCell>
                      <TableCell>{invoice.customer}</TableCell>
                      <TableCell>{new Date(invoice.date).toLocaleDateString('fr-FR')}</TableCell>
                      <TableCell>{new Date(invoice.dueDate).toLocaleDateString('fr-FR')}</TableCell>
                      <TableCell className="font-semibold">{invoice.amount.toFixed(2)} TND</TableCell>
                      <TableCell>
                        <Badge className={statusConfig.className}>
                          {statusConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Eye className="w-4 h-4 mr-2" />
                              {t('invoices.view')}
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Edit className="w-4 h-4 mr-2" />
                              {t('invoices.edit')}
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Send className="w-4 h-4 mr-2" />
                              {t('invoices.send')}
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Download className="w-4 h-4 mr-2" />
                              {t('invoices.download')}
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600">
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
        </Card>
      </div>
    </AppLayout>
  );
};

export default Invoices;