import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { mockQuotes } from '../data/mockData';
import AppLayout from '../components/layout/AppLayout';
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
import { Plus, Search, Filter, Download, Send, Eye, Edit, Trash2, MoreVertical, FileCheck } from 'lucide-react';

const Quotes = () => {
  const { t } = useLanguage();
  const [quotes, setQuotes] = useState(mockQuotes);
  const [searchTerm, setSearchTerm] = useState('');

  const getStatusBadge = (status) => {
    const statusConfig = {
      accepted: { label: 'Accepté', className: 'bg-green-100 text-green-800' },
      sent: { label: 'Envoyé', className: 'bg-blue-100 text-blue-800' },
      draft: { label: 'Brouillon', className: 'bg-gray-100 text-gray-800' },
      rejected: { label: 'Rejeté', className: 'bg-red-100 text-red-800' },
    };
    return statusConfig[status] || statusConfig.draft;
  };

  const filteredQuotes = quotes.filter(quote =>
    quote.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
    quote.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{t('nav.quotes')}</h1>
            <p className="text-gray-500 mt-1">{filteredQuotes.length} devis au total</p>
          </div>
          <Button className="bg-teal-600 hover:bg-teal-700 text-white">
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
            <p className="text-sm text-gray-600 mb-2">Total Devis</p>
            <p className="text-2xl font-bold text-gray-900">
              {quotes.reduce((acc, q) => acc + q.amount, 0).toFixed(0)} TND
            </p>
            <p className="text-xs text-gray-500 mt-1">{quotes.length} devis</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-gray-600 mb-2">Acceptés</p>
            <p className="text-2xl font-bold text-green-600">
              {quotes.filter(q => q.status === 'accepted').reduce((acc, q) => acc + q.amount, 0).toFixed(0)} TND
            </p>
            <p className="text-xs text-gray-500 mt-1">{quotes.filter(q => q.status === 'accepted').length} devis</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-gray-600 mb-2">En attente</p>
            <p className="text-2xl font-bold text-orange-600">
              {quotes.filter(q => q.status === 'sent').reduce((acc, q) => acc + q.amount, 0).toFixed(0)} TND
            </p>
            <p className="text-xs text-gray-500 mt-1">{quotes.filter(q => q.status === 'sent').length} devis</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-gray-600 mb-2">Taux de conversion</p>
            <p className="text-2xl font-bold text-teal-600">
              {((quotes.filter(q => q.status === 'accepted').length / quotes.length) * 100).toFixed(0)}%
            </p>
            <p className="text-xs text-gray-500 mt-1">Devis acceptés</p>
          </Card>
        </div>

        {/* Quotes Table */}
        <Card>
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
                    <TableRow key={quote.id} className="hover:bg-gray-50">
                      <TableCell className="font-medium">{quote.id}</TableCell>
                      <TableCell>{quote.customer}</TableCell>
                      <TableCell>{new Date(quote.date).toLocaleDateString('fr-FR')}</TableCell>
                      <TableCell>{new Date(quote.validUntil).toLocaleDateString('fr-FR')}</TableCell>
                      <TableCell className="font-semibold">{quote.amount.toFixed(2)} TND</TableCell>
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
                              Voir
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Edit className="w-4 h-4 mr-2" />
                              Modifier
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Send className="w-4 h-4 mr-2" />
                              Envoyer
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <FileCheck className="w-4 h-4 mr-2" />
                              Convertir en facture
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Download className="w-4 h-4 mr-2" />
                              Télécharger
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600">
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
        </Card>
      </div>
    </AppLayout>
  );
};

export default Quotes;