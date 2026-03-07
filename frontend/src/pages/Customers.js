import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Plus, Search, Filter, Download, Eye, Edit, Trash2, MoreVertical, Mail, Phone, Users, FileText, TrendingUp, UserPlus, ChevronDown, ExternalLink } from 'lucide-react';
import { toast } from '../hooks/use-toast';

const Customers = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { currentCompany } = useCompany();
  const [customers, setCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [itemsPerPage, setItemsPerPage] = useState(25);

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

  const handleSendPortalLink = async (customerId) => {
    try {
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
      const response = await fetch(`${API_URL}/api/client-portal/create-access?customer_id=${customerId}&company_id=${currentCompany.id}&send_email=true`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        toast({ 
          title: 'Succès', 
          description: data.email_sent ? 'Lien du portail envoyé par email' : 'Lien du portail créé (email non envoyé)' 
        });
      } else {
        throw new Error('Erreur lors de l\'envoi');
      }
    } catch (error) {
      console.error('Error sending portal link:', error);
      toast({ 
        title: 'Erreur', 
        description: 'Impossible d\'envoyer le lien du portail', 
        variant: 'destructive' 
      });
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
    customer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.company_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate KPIs
  const totalCustomers = customers.length;
  const totalUnpaid = customers.reduce((acc, c) => acc + (c.balance || 0), 0);
  const totalRevenue = customers.reduce((acc, c) => acc + (c.total_invoiced || 0), 0);
  const newThisMonth = customers.filter(c => {
    if (!c.created_at) return false;
    const createdDate = new Date(c.created_at);
    const now = new Date();
    return createdDate.getMonth() === now.getMonth() && createdDate.getFullYear() === now.getFullYear();
  }).length;

  if (!currentCompany) {
    return <AppLayout><div className="text-center py-20">Aucune entreprise sélectionnée</div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="space-y-6" data-testid="customers-page">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Synthèse des clients</h1>
            <p className="text-gray-500 text-sm">Clients • {currentCompany?.name || 'Mycompany'}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="text-gray-600">
              Action
              <ChevronDown className="w-4 h-4 ml-2" />
            </Button>
            <Button variant="outline" className="text-gray-600">
              Importer
            </Button>
            <Button 
              className="bg-violet-600 hover:bg-violet-700 text-white" 
              onClick={openCreateModal}
              data-testid="add-customer-btn"
            >
              Nouveau client
            </Button>
          </div>
        </div>

        {/* KPI Cards - Iberis Style */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Clients */}
          <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 border-0 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-blue-500 rounded-lg">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600 font-medium">Clients</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-gray-900">{totalCustomers}</span>
                  <span className="text-sm text-green-600">(+0%)</span>
                </div>
                <p className="text-xs text-blue-600 mt-1">vs mois dernier</p>
              </div>
            </div>
          </Card>

          {/* Impayé */}
          <Card className="p-4 bg-gradient-to-br from-amber-50 to-amber-100 border-0 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-amber-500 rounded-lg">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600 font-medium">Impayé</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-gray-900">{totalUnpaid.toFixed(3)}</span>
                  <span className="text-sm font-medium text-gray-600">TND</span>
                </div>
                <p className="text-xs text-amber-600 mt-1">{customers.filter(c => (c.balance || 0) > 0).length} clients</p>
              </div>
            </div>
          </Card>

          {/* Chiffre d'affaire */}
          <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100 border-0 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-green-500 rounded-lg">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600 font-medium">Chiffre d'affaire</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-gray-900">{totalRevenue.toFixed(3)}</span>
                  <span className="text-sm font-medium text-gray-600">TND</span>
                </div>
                <p className="text-xs text-green-600 mt-1">{new Date().getFullYear()}</p>
              </div>
            </div>
          </Card>

          {/* Nouveaux ce mois */}
          <Card className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 border-0 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-purple-500 rounded-lg">
                <UserPlus className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600 font-medium">Nouveaux ce mois</p>
                <span className="text-2xl font-bold text-gray-900">{newThisMonth}</span>
                <p className="text-xs text-purple-600 mt-1">vs mois dernier</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Filters & Table */}
        <Card className="p-0 overflow-hidden">
          {/* Table Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between p-4 border-b bg-gray-50">
            <Button variant="outline" className="flex items-center gap-2 text-violet-600 border-violet-200 bg-violet-50 hover:bg-violet-100">
              Affichage des colonnes
              <ChevronDown className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-4 mt-4 md:mt-0">
              <span className="text-sm text-gray-500">Rechercher:</span>
              <Input
                placeholder=""
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-48"
                data-testid="search-customers"
              />
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 mx-auto"></div>
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-2">Aucune donnée disponible dans le tableau</p>
              <Button onClick={openCreateModal} className="mt-4 bg-violet-600 hover:bg-violet-700">
                <Plus className="w-4 h-4 mr-2" />
                Ajouter votre premier client
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="w-12">
                      <input type="checkbox" className="rounded border-gray-300" />
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase">REF</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase">NOM AFFICHÉ</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase">TYPE</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase">ENTREPRISE</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase">EMAIL</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase">TÉLÉPHONE</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase">
                      SOLDE <ChevronDown className="w-3 h-3 inline" />
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase">CHIFFRE D'AFFAIRE</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase text-right">ACTION</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.map((customer) => (
                    <TableRow key={customer.id} className="hover:bg-gray-50" data-testid={`customer-row-${customer.id}`}>
                      <TableCell>
                        <input type="checkbox" className="rounded border-gray-300" />
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">{customer.reference || '-'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-violet-100 rounded-full flex items-center justify-center text-violet-600 font-semibold text-sm">
                            {customer.display_name?.charAt(0)}
                          </div>
                          <span className="font-medium text-gray-900">{customer.display_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={customer.client_type === 'entreprise' 
                            ? 'bg-violet-50 text-violet-700 border-violet-200' 
                            : 'bg-blue-50 text-blue-700 border-blue-200'}
                        >
                          {customer.client_type === 'entreprise' ? 'Entreprise' : 'Particulier'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">{customer.company_name || '-'}</TableCell>
                      <TableCell className="text-sm text-gray-600">{customer.email || '-'}</TableCell>
                      <TableCell className="text-sm text-gray-600">{customer.phone || '-'}</TableCell>
                      <TableCell>
                        <span className={`font-semibold ${
                          (customer.balance || 0) > 0 ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {(customer.balance || 0).toFixed(3)}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-gray-900 font-medium">
                        {(customer.total_invoiced || 0).toFixed(3)} TND
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/contacts/customers/${customer.id}/summary`)}>
                              <TrendingUp className="w-4 h-4 mr-2" />
                              Voir synthèse
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEditModal(customer)}>
                              <Eye className="w-4 h-4 mr-2" />
                              Voir / Modifier
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleSendPortalLink(customer.id)}>
                              <ExternalLink className="w-4 h-4 mr-2" />
                              Envoyer lien portail
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
          )}

          {/* Pagination */}
          <div className="flex items-center justify-between p-4 border-t bg-gray-50">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Afficher</span>
              <Select value={String(itemsPerPage)} onValueChange={(v) => setItemsPerPage(Number(v))}>
                <SelectTrigger className="w-20 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-gray-600">éléments</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">
                Affichage de l'élément {filteredCustomers.length > 0 ? 1 : 0} à {Math.min(itemsPerPage, filteredCustomers.length)} sur {filteredCustomers.length} élément{filteredCustomers.length > 1 ? 's' : ''}
              </span>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled>Précédent</Button>
                <Button variant="outline" size="sm" disabled>Suivant</Button>
              </div>
            </div>
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
