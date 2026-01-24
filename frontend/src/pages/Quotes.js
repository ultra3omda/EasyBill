import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { quotesAPI } from '../services/api';
import { useCompany } from '../hooks/useCompany';
import AppLayout from '../components/layout/AppLayout';
import QuoteFormModal from '../components/modals/QuoteFormModal';
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
import { Plus, Search, Filter, Download, Send, Edit, Trash2, MoreVertical, FileCheck, FileText, CheckCircle } from 'lucide-react';
import { toast } from '../hooks/use-toast';

const Quotes = () => {
  const { t } = useLanguage();
  const { currentCompany } = useCompany();
  const [quotes, setQuotes] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentCompany) {
      loadQuotes();
    }
  }, [currentCompany]);

  const loadQuotes = async () => {
    if (!currentCompany) return;
    setLoading(true);
    try {
      const response = await quotesAPI.list(currentCompany.id);
      setQuotes(response.data);
    } catch (error) {
      console.error('Error loading quotes:', error);
      toast({ title: 'Erreur', description: 'Impossible de charger les devis', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (quoteId) => {
    if (!window.confirm('Voulez-vous vraiment supprimer ce devis ?')) return;
    try {
      await quotesAPI.delete(currentCompany.id, quoteId);
      toast({ title: 'Succès', description: 'Devis supprimé' });
      loadQuotes();
    } catch (error) {
      toast({ title: 'Erreur', description: 'Erreur lors de la suppression', variant: 'destructive' });
    }
  };

  const handleSend = async (quoteId) => {
    try {
      await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/quotes/${quoteId}/send?company_id=${currentCompany.id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      toast({ title: 'Succès', description: 'Devis marqué comme envoyé' });
      loadQuotes();
    } catch (error) {
      toast({ title: 'Erreur', description: 'Erreur lors de l\'envoi', variant: 'destructive' });
    }
  };

  const handleAccept = async (quoteId) => {
    try {
      await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/quotes/${quoteId}/accept?company_id=${currentCompany.id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      toast({ title: 'Succès', description: 'Devis accepté' });
      loadQuotes();
    } catch (error) {
      toast({ title: 'Erreur', description: 'Erreur', variant: 'destructive' });
    }
  };

  const handleConvertToInvoice = async (quoteId) => {
    try {
      const response = await quotesAPI.convertToInvoice(currentCompany.id, quoteId);
      toast({ title: 'Succès', description: `Facture ${response.data.number} créée` });
      loadQuotes();
    } catch (error) {
      toast({ title: 'Erreur', description: error.response?.data?.detail || 'Erreur lors de la conversion', variant: 'destructive' });
    }
  };

  const openCreateModal = () => {
    setSelectedQuote(null);
    setModalOpen(true);
  };

  const openEditModal = (quote) => {
    setSelectedQuote(quote);
    setModalOpen(true);
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      accepted: { label: 'Accepté', className: 'bg-green-100 text-green-800' },
      sent: { label: 'Envoyé', className: 'bg-blue-100 text-blue-800' },
      draft: { label: 'Brouillon', className: 'bg-gray-100 text-gray-800' },
      rejected: { label: 'Rejeté', className: 'bg-red-100 text-red-800' },
      expired: { label: 'Expiré', className: 'bg-orange-100 text-orange-800' },
    };
    return statusConfig[status] || statusConfig.draft;
  };

  const filteredQuotes = quotes.filter(quote =>
    quote.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    quote.number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate stats from real data
  const stats = {
    totalAmount: filteredQuotes.reduce((acc, q) => acc + (q.total || 0), 0),
    acceptedAmount: filteredQuotes.filter(q => q.status === 'accepted').reduce((acc, q) => acc + (q.total || 0), 0),
    pendingAmount: filteredQuotes.filter(q => ['draft', 'sent'].includes(q.status)).reduce((acc, q) => acc + (q.total || 0), 0),
    acceptedCount: filteredQuotes.filter(q => q.status === 'accepted').length,
    pendingCount: filteredQuotes.filter(q => ['draft', 'sent'].includes(q.status)).length,
    conversionRate: filteredQuotes.length > 0 
      ? ((filteredQuotes.filter(q => q.status === 'accepted').length / filteredQuotes.length) * 100).toFixed(0) 
      : 0
  };

  if (!currentCompany) {
    return <AppLayout><div className="text-center py-20">Aucune entreprise sélectionnée</div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="space-y-6" data-testid="quotes-page">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{t('nav.quotes')}</h1>
            <p className="text-gray-500 mt-1">{filteredQuotes.length} devis au total</p>
          </div>
          <Button className="bg-violet-600 hover:bg-violet-700 text-white" onClick={openCreateModal} data-testid="create-quote-btn">
            <Plus className="w-4 h-4 mr-2" />
            Créer un devis
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
                data-testid="search-quotes"
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
                <p className="text-sm text-gray-600">Total Devis</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalAmount.toFixed(2)} TND</p>
                <p className="text-xs text-gray-500">{filteredQuotes.length} devis</p>
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Acceptés</p>
                <p className="text-2xl font-bold text-green-600">{stats.acceptedAmount.toFixed(2)} TND</p>
                <p className="text-xs text-gray-500">{stats.acceptedCount} devis</p>
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Send className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">En attente</p>
                <p className="text-2xl font-bold text-orange-600">{stats.pendingAmount.toFixed(2)} TND</p>
                <p className="text-xs text-gray-500">{stats.pendingCount} devis</p>
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-100 rounded-lg">
                <FileCheck className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Taux de conversion</p>
                <p className="text-2xl font-bold text-violet-600">{stats.conversionRate}%</p>
                <p className="text-xs text-gray-500">Devis acceptés</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Quotes Table */}
        <Card>
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 mx-auto"></div>
            </div>
          ) : filteredQuotes.length === 0 ? (
            <div className="p-8 text-center">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Aucun devis trouvé</p>
              <Button onClick={openCreateModal} className="mt-4 bg-violet-600 hover:bg-violet-700">
                <Plus className="w-4 h-4 mr-2" />
                Créer votre premier devis
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N° Devis</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Valable jusqu'au</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredQuotes.map((quote) => {
                    const statusConfig = getStatusBadge(quote.status);
                    return (
                      <TableRow key={quote.id} className="hover:bg-gray-50" data-testid={`quote-row-${quote.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center">
                              <FileText className="w-5 h-5 text-violet-600" />
                            </div>
                            <span className="font-medium">{quote.number}</span>
                          </div>
                        </TableCell>
                        <TableCell>{quote.customer_name}</TableCell>
                        <TableCell>{quote.date ? new Date(quote.date).toLocaleDateString('fr-FR') : '-'}</TableCell>
                        <TableCell>{quote.valid_until ? new Date(quote.valid_until).toLocaleDateString('fr-FR') : '-'}</TableCell>
                        <TableCell className="font-semibold">{(quote.total || 0).toFixed(2)} TND</TableCell>
                        <TableCell>
                          <Badge className={statusConfig.className}>
                            {statusConfig.label}
                          </Badge>
                          {quote.converted_to_invoice && (
                            <Badge className="ml-2 bg-blue-100 text-blue-800">Facturé</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" data-testid={`quote-actions-${quote.id}`}>
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditModal(quote)}>
                                <Edit className="w-4 h-4 mr-2" />
                                Modifier
                              </DropdownMenuItem>
                              {quote.status === 'draft' && (
                                <DropdownMenuItem onClick={() => handleSend(quote.id)}>
                                  <Send className="w-4 h-4 mr-2" />
                                  Marquer envoyé
                                </DropdownMenuItem>
                              )}
                              {quote.status === 'sent' && (
                                <DropdownMenuItem onClick={() => handleAccept(quote.id)}>
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  Accepter
                                </DropdownMenuItem>
                              )}
                              {!quote.converted_to_invoice && (
                                <DropdownMenuItem onClick={() => handleConvertToInvoice(quote.id)}>
                                  <FileCheck className="w-4 h-4 mr-2" />
                                  Convertir en facture
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(quote.id)}>
                                <Trash2 className="w-4 h-4 mr-2" />
                                Supprimer
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

      <QuoteFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={loadQuotes}
        quote={selectedQuote}
      />
    </AppLayout>
  );
};

export default Quotes;
