import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { mockExpenses } from '../data/mockData';
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
import { Plus, Search, Filter, RefreshCw } from 'lucide-react';

const Expenses = () => {
  const { t } = useLanguage();
  const [expenses] = useState(mockExpenses);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredExpenses = expenses.filter(expense =>
    expense.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    expense.supplier.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{t('nav.expenses')}</h1>
            <p className="text-gray-500 mt-1">{filteredExpenses.length} dépenses enregistrées</p>
          </div>
          <Button className="bg-teal-600 hover:bg-teal-700 text-white">
            <Plus className="w-4 h-4 mr-2" />
            Nouvelle dépense
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
            <p className="text-sm text-gray-600 mb-2">Total Dépenses</p>
            <p className="text-2xl font-bold text-gray-900">
              {expenses.reduce((acc, e) => acc + e.amount, 0).toFixed(3)} TND
            </p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-gray-600 mb-2">Dépenses Récurrentes</p>
            <p className="text-2xl font-bold text-blue-600">
              {expenses.filter(e => e.recurring).reduce((acc, e) => acc + e.amount, 0).toFixed(3)} TND
            </p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-gray-600 mb-2">Ce mois</p>
            <p className="text-2xl font-bold text-orange-600">
              {expenses.reduce((acc, e) => acc + e.amount, 0).toFixed(3)} TND
            </p>
          </Card>
        </div>

        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Référence</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Fournisseur</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExpenses.map((expense) => (
                  <TableRow key={expense.id} className="hover:bg-gray-50">
                    <TableCell className="font-medium">{expense.id}</TableCell>
                    <TableCell>{expense.category}</TableCell>
                    <TableCell>{expense.supplier}</TableCell>
                    <TableCell>{new Date(expense.date).toLocaleDateString('fr-FR')}</TableCell>
                    <TableCell className="font-semibold">{expense.amount.toFixed(3)} TND</TableCell>
                    <TableCell>
                      {expense.recurring ? (
                        <Badge className="bg-blue-100 text-blue-800">
                          <RefreshCw className="w-3 h-3 mr-1" />
                          Récurrent
                        </Badge>
                      ) : (
                        <Badge variant="outline">Ponctuel</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Expenses;