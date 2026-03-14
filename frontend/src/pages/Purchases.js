import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { mockPurchases } from '../data/mockData';
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
import { Plus, Search, Filter, Download } from 'lucide-react';

const Purchases = () => {
  const { t } = useLanguage();
  const [purchases] = useState(mockPurchases);
  const [searchTerm, setSearchTerm] = useState('');

  const getStatusBadge = (status) => {
    const statusConfig = {
      paid: { label: 'Payée', className: 'bg-green-100 text-green-800' },
      pending: { label: 'En attente', className: 'bg-orange-100 text-orange-800' },
      overdue: { label: 'En retard', className: 'bg-red-100 text-red-800' },
    };
    return statusConfig[status] || statusConfig.pending;
  };

  const filteredPurchases = purchases.filter(purchase =>
    purchase.supplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
    purchase.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{t('nav.purchases')}</h1>
            <p className="text-gray-500 mt-1">{filteredPurchases.length} achats au total</p>
          </div>
          <Button className="bg-teal-600 hover:bg-teal-700 text-white">
            <Plus className="w-4 h-4 mr-2" />
            Nouvel achat
          </Button>
        </div>

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
            <Button variant="outline">
              <Filter className="w-4 h-4 mr-2" />
              {t('common.filter')}
            </Button>
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-6">
            <p className="text-sm text-gray-600 mb-2">Total Achats</p>
            <p className="text-2xl font-bold text-gray-900">
              {purchases.reduce((acc, p) => acc + p.amount, 0).toFixed(3)} TND
            </p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-gray-600 mb-2">Payés</p>
            <p className="text-2xl font-bold text-green-600">
              {purchases.filter(p => p.status === 'paid').reduce((acc, p) => acc + p.amount, 0).toFixed(3)} TND
            </p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-gray-600 mb-2">À payer</p>
            <p className="text-2xl font-bold text-red-600">
              {purchases.filter(p => p.status !== 'paid').reduce((acc, p) => acc + p.amount, 0).toFixed(3)} TND
            </p>
          </Card>
        </div>

        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N° Achat</TableHead>
                  <TableHead>Fournisseur</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Échéance</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPurchases.map((purchase) => {
                  const statusConfig = getStatusBadge(purchase.status);
                  return (
                    <TableRow key={purchase.id} className="hover:bg-gray-50">
                      <TableCell className="font-medium">{purchase.id}</TableCell>
                      <TableCell>{purchase.supplier}</TableCell>
                      <TableCell>{new Date(purchase.date).toLocaleDateString('fr-FR')}</TableCell>
                      <TableCell>{new Date(purchase.dueDate).toLocaleDateString('fr-FR')}</TableCell>
                      <TableCell className="font-semibold">{purchase.amount.toFixed(3)} TND</TableCell>
                      <TableCell>
                        <Badge className={statusConfig.className}>
                          {statusConfig.label}
                        </Badge>
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

export default Purchases;