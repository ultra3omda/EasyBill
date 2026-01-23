import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { mockSuppliers } from '../data/mockData';
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
import { Plus, Search, Filter, Download, Eye, Edit, Trash2, MoreVertical, Mail, Phone } from 'lucide-react';

const Suppliers = () => {
  const { t } = useLanguage();
  const [suppliers, setSuppliers] = useState(mockSuppliers);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredSuppliers = suppliers.filter(supplier =>
    supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supplier.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{t('nav.suppliers')}</h1>
            <p className="text-gray-500 mt-1">{filteredSuppliers.length} fournisseurs au total</p>
          </div>
          <Button className="bg-teal-600 hover:bg-teal-700 text-white">
            <Plus className="w-4 h-4 mr-2" />
            Ajouter un fournisseur
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
            <p className="text-sm text-gray-600 mb-2">Total Fournisseurs</p>
            <p className="text-2xl font-bold text-gray-900">{suppliers.length}</p>
            <p className="text-xs text-green-600 mt-1">+2 ce mois</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-gray-600 mb-2">Fournisseurs Actifs</p>
            <p className="text-2xl font-bold text-green-600">
              {suppliers.filter(s => s.orders > 0).length}
            </p>
            <p className="text-xs text-gray-500 mt-1">Avec commandes</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-gray-600 mb-2">Dettes Totales</p>
            <p className="text-2xl font-bold text-red-600">
              {suppliers.reduce((acc, s) => acc + s.balance, 0).toFixed(2)} TND
            </p>
            <p className="text-xs text-gray-500 mt-1">À payer</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-gray-600 mb-2">Commandes Totales</p>
            <p className="text-2xl font-bold text-teal-600">
              {suppliers.reduce((acc, s) => acc + s.orders, 0)}
            </p>
            <p className="text-xs text-gray-500 mt-1">Toutes périodes</p>
          </Card>
        </div>

        {/* Suppliers Table */}
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fournisseur</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead>Commandes</TableHead>
                  <TableHead>Solde à payer</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSuppliers.map((supplier) => (
                  <TableRow key={supplier.id} className="hover:bg-gray-50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 font-semibold">
                          {supplier.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{supplier.name}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-gray-600">
                        <Mail className="w-4 h-4" />
                        {supplier.email}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-gray-600">
                        <Phone className="w-4 h-4" />
                        {supplier.phone}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{supplier.orders} commandes</Badge>
                    </TableCell>
                    <TableCell>
                      <span className={`font-semibold ${
                        supplier.balance > 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {supplier.balance.toFixed(2)} TND
                      </span>
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
                            Voir détails
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Edit className="w-4 h-4 mr-2" />
                            Modifier
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Mail className="w-4 h-4 mr-2" />
                            Envoyer email
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600">
                            <Trash2 className="w-4 h-4 mr-2" />
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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

export default Suppliers;