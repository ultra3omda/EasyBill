import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { customersAPI } from '../services/api';
import { useCompany } from '../hooks/useCompany';
import AppLayout from '../components/layout/AppLayout';
import CustomerFormModal from '../components/modals/CustomerFormModal';
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
import { toast } from '../hooks/use-toast';

const Customers = () => {
  const { t } = useLanguage();
  const { currentCompany } = useCompany();
  const [customers, setCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentCompany) {
      loadCustomers();
    }
  }, [currentCompany]);

  const loadCustomers = async () => {
    if (!currentCompany) return;
    setLoading(true);
    try {
      const response = await customersAPI.list(currentCompany.id, searchTerm);
      setCustomers(response.data);
    } catch (error) {
      console.error('Error loading customers:', error);
      toast({ title: 'Erreur', description: 'Impossible de charger les clients', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (customerId) => {
    if (!window.confirm('Voulez-vous vraiment supprimer ce client ?')) return;
    try {
      await customersAPI.delete(currentCompany.id, customerId);
      toast({ title: 'Succès', description: 'Client supprimé' });
      loadCustomers();
    } catch (error) {
      toast({ title: 'Erreur', description: 'Erreur lors de la suppression', variant: 'destructive' });
    }
  };

  const openEditModal = (customer) => {
    setSelectedCustomer(customer);
    setModalOpen(true);
  };

  const openCreateModal = () => {
    setSelectedCustomer(null);
    setModalOpen(true);
  };

  const filteredCustomers = customers.filter(customer =>
    customer.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.email?.toLowerCase().includes(searchTerm.toLowerCase())
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
            <h1 className="text-3xl font-bold text-gray-900">{t('nav.customers')}</h1>
            <p className="text-gray-500 mt-1">{filteredCustomers.length} clients au total</p>
          </div>
          <Button className="bg-teal-600 hover:bg-teal-700 text-white" onClick={openCreateModal}>
            <Plus className="w-4 h-4 mr-2" />
            Ajouter un client
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
            <p className="text-sm text-gray-600 mb-2">Total Clients</p>
            <p className="text-2xl font-bold text-gray-900">{customers.length}</p>
            <p className="text-xs text-green-600 mt-1">+3 ce mois</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-gray-600 mb-2">Clients Actifs</p>
            <p className="text-2xl font-bold text-green-600">{customers.filter(c => c.invoices > 0).length}</p>
            <p className="text-xs text-gray-500 mt-1">Avec factures</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-gray-600 mb-2">Créances Totales</p>
            <p className="text-2xl font-bold text-orange-600">
              {customers.reduce((acc, c) => acc + c.balance, 0).toFixed(2)} TND
            </p>
            <p className="text-xs text-gray-500 mt-1">À recouvrer</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-gray-600 mb-2">Factures Totales</p>
            <p className="text-2xl font-bold text-teal-600">
              {customers.reduce((acc, c) => acc + c.invoices, 0)}
            </p>
            <p className="text-xs text-gray-500 mt-1">Toutes périodes</p>
          </Card>
        </div>

        {/* Customers Table */}
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead>Adresse</TableHead>
                  <TableHead>Factures</TableHead>
                  <TableHead>Solde</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((customer) => (
                  <TableRow key={customer.id} className="hover:bg-gray-50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center text-teal-600 font-semibold">
                          {customer.display_name?.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{customer.display_name}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-gray-600">
                        <Mail className="w-4 h-4" />
                        {customer.email}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-gray-600">
                        <Phone className="w-4 h-4" />
                        {customer.phone}
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-600">{customer.address}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{customer.invoices} factures</Badge>
                    </TableCell>
                    <TableCell>
                      <span className={`font-semibold ${
                        customer.balance > 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {customer.balance.toFixed(2)} TND
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
                          <DropdownMenuItem onClick={() => openEditModal(customer)}>
                            <Edit className="w-4 h-4 mr-2" />
                            Modifier
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(customer.id)}>
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

      <CustomerFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={loadCustomers}
        customer={selectedCustomer}
      />
    </AppLayout>
  );
};

export default Customers;