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

  const totalExpenses = filteredExpenses.reduce((acc, e) => acc + e.amount, 0);
  const recurringExpenses = filteredExpenses.filter(e => e.recurring).reduce((acc, e) => acc + e.amount, 0);
  const oneOffExpenses = filteredExpenses.filter(e => !e.recurring).reduce((acc, e) => acc + e.amount, 0);

  return (
    <AppLayout>
      <div className="page-shell section-stack">
        <div className="page-header">
          <div>
            <h1 className="page-header-title">{t('nav.expenses')}</h1>
            <p className="page-header-subtitle">{filteredExpenses.length} dépense(s) visibles sur le périmètre courant</p>
          </div>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Nouvelle dépense
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="interactive-lift p-5">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Total dépenses</p>
            <p className="metric-value mt-2">{totalExpenses.toFixed(3)} TND</p>
            <p className="mt-1 text-sm text-slate-500">Montant cumulé des lignes filtrées</p>
          </Card>
          <Card className="interactive-lift p-5">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Récurrentes</p>
            <p className="metric-value mt-2">{recurringExpenses.toFixed(3)} TND</p>
            <p className="mt-1 text-sm text-slate-500">Charges périodiques</p>
          </Card>
          <Card className="interactive-lift p-5">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Ponctuelles</p>
            <p className="metric-value mt-2">{oneOffExpenses.toFixed(3)} TND</p>
            <p className="mt-1 text-sm text-slate-500">Achats ou frais non récurrents</p>
          </Card>
        </div>

        <Card className="p-4 md:p-5">
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

        <Card>
          {filteredExpenses.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-base font-semibold text-slate-900">Aucune dépense trouvée</p>
              <p className="mt-2 text-sm text-slate-500">Ajustez votre recherche ou ajoutez une nouvelle charge pour alimenter le suivi des dépenses.</p>
            </div>
          ) : (
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
                    <TableRow key={expense.id}>
                      <TableCell className="font-medium text-slate-900">{expense.id}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-slate-900">{expense.category}</p>
                          <p className="text-xs text-slate-400">Charge d'exploitation</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-700">{expense.supplier}</TableCell>
                      <TableCell className="text-slate-500">{new Date(expense.date).toLocaleDateString('fr-FR')}</TableCell>
                      <TableCell className="font-semibold text-slate-900">{expense.amount.toFixed(3)} TND</TableCell>
                      <TableCell>
                        {expense.recurring ? (
                          <Badge variant="info">
                            <RefreshCw className="w-3 h-3 mr-1" />
                            Récurrent
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Ponctuel</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>
    </AppLayout>
  );
};

export default Expenses;