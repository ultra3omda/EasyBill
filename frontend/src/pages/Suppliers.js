import React, { useState, useEffect } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
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
import { Plus, Search, Filter, Download, Eye, Edit, Trash2, MoreVertical, Mail, Phone, Truck, Users } from 'lucide-react';
import { toast } from '../hooks/use-toast';
import { useCompany } from '../hooks/useCompany';
import { suppliersAPI } from '../services/api';

const Suppliers = () => {
  const { currentCompany } = useCompany();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    company_name: '',
    email: '',
    phone: '',
    mobile: '',
    fiscal_id: '',
    activity: '',
    billing_address: {
      street: '',
      city: '',
      postal_code: '',
      country: 'Tunisie'
    },
    notes: ''
  });

  useEffect(() => {
    if (currentCompany?.id) {
      fetchSuppliers();
    }
  }, [currentCompany]);

  const fetchSuppliers = async () => {
    try {
      const response = await suppliersAPI.list(currentCompany.id);
      setSuppliers(response.data);
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les fournisseurs',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      first_name: '',
      last_name: '',
      company_name: '',
      email: '',
      phone: '',
      mobile: '',
      fiscal_id: '',
      activity: '',
      billing_address: { street: '', city: '', postal_code: '', country: 'Tunisie' },
      notes: ''
    });
  };

  const handleChange = (field, value) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: { ...prev[parent], [child]: value }
      }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      if (editingSupplier) {
        await suppliersAPI.update(currentCompany.id, editingSupplier.id, formData);
        toast({ title: 'Succès', description: 'Fournisseur modifié avec succès' });
      } else {
        await suppliersAPI.create(currentCompany.id, formData);
        toast({ title: 'Succès', description: 'Fournisseur créé avec succès' });
      }
      setIsDialogOpen(false);
      setEditingSupplier(null);
      resetForm();
      fetchSuppliers();
    } catch (error) {
      toast({
        title: 'Erreur',
        description: error.response?.data?.detail || 'Erreur lors de l\'enregistrement',
        variant: 'destructive'
      });
    } finally {
      setFormLoading(false);
    }
  };

  const handleEdit = (supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      first_name: supplier.first_name || '',
      last_name: supplier.last_name || '',
      company_name: supplier.company_name || '',
      email: supplier.email || '',
      phone: supplier.phone || '',
      mobile: supplier.mobile || '',
      fiscal_id: supplier.fiscal_id || '',
      activity: supplier.activity || '',
      billing_address: supplier.billing_address || { street: '', city: '', postal_code: '', country: 'Tunisie' },
      notes: supplier.notes || ''
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (supplierId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce fournisseur ?')) return;
    
    try {
      await suppliersAPI.delete(currentCompany.id, supplierId);
      toast({ title: 'Succès', description: 'Fournisseur supprimé avec succès' });
      fetchSuppliers();
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de supprimer le fournisseur',
        variant: 'destructive'
      });
    }
  };

  const openNewDialog = () => {
    setEditingSupplier(null);
    resetForm();
    setIsDialogOpen(true);
  };

  const filteredSuppliers = suppliers.filter(supplier =>
    (supplier.display_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (supplier.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (supplier.company_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="space-y-6" data-testid="suppliers-page">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Fournisseurs</h1>
            <p className="text-gray-500 mt-1">{filteredSuppliers.length} fournisseurs au total</p>
          </div>
          <Button 
            onClick={openNewDialog}
            className="bg-violet-600 hover:bg-violet-700 text-white"
            data-testid="add-supplier-button"
          >
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
                placeholder="Rechercher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="search-suppliers"
              />
            </div>
            <Button variant="outline" className="flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filtrer
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              Exporter
            </Button>
          </div>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-100 rounded-lg">
                <Users className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Fournisseurs</p>
                <p className="text-2xl font-bold text-gray-900">{suppliers.length}</p>
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Truck className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Actifs</p>
                <p className="text-2xl font-bold text-green-600">
                  {suppliers.filter(s => s.purchases > 0).length}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-gray-600 mb-2">Dettes Totales</p>
            <p className="text-2xl font-bold text-red-600">
              {suppliers.reduce((acc, s) => acc + (s.balance || 0), 0).toFixed(2)} TND
            </p>
            <p className="text-xs text-gray-500 mt-1">À payer</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-gray-600 mb-2">Achats Totaux</p>
            <p className="text-2xl font-bold text-violet-600">
              {suppliers.reduce((acc, s) => acc + (s.purchases || 0), 0)}
            </p>
            <p className="text-xs text-gray-500 mt-1">Commandes</p>
          </Card>
        </div>

        {/* Suppliers Table */}
        <Card>
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 mx-auto"></div>
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="p-8 text-center">
              <Truck className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Aucun fournisseur trouvé</p>
              <Button onClick={openNewDialog} className="mt-4 bg-violet-600 hover:bg-violet-700">
                <Plus className="w-4 h-4 mr-2" />
                Ajouter votre premier fournisseur
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fournisseur</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Téléphone</TableHead>
                    <TableHead>Achats</TableHead>
                    <TableHead>Solde à payer</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSuppliers.map((supplier) => (
                    <TableRow key={supplier.id} className="hover:bg-gray-50" data-testid={`supplier-row-${supplier.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 font-semibold">
                            {(supplier.display_name || 'F').charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{supplier.display_name}</p>
                            {supplier.company_name && (
                              <p className="text-sm text-gray-500">{supplier.company_name}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {supplier.email ? (
                          <div className="flex items-center gap-2 text-gray-600">
                            <Mail className="w-4 h-4" />
                            {supplier.email}
                          </div>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        {supplier.phone ? (
                          <div className="flex items-center gap-2 text-gray-600">
                            <Phone className="w-4 h-4" />
                            {supplier.phone}
                          </div>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{supplier.purchases || 0} achats</Badge>
                      </TableCell>
                      <TableCell>
                        <span className={`font-semibold ${
                          (supplier.balance || 0) > 0 ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {(supplier.balance || 0).toFixed(2)} TND
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
                            <DropdownMenuItem onClick={() => handleEdit(supplier)}>
                              <Edit className="w-4 h-4 mr-2" />
                              Modifier
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(supplier.id)}>
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
        </Card>

        {/* Form Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingSupplier ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}</DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Prénom *</Label>
                  <Input
                    value={formData.first_name}
                    onChange={(e) => handleChange('first_name', e.target.value)}
                    required
                    data-testid="supplier-first-name"
                  />
                </div>
                <div>
                  <Label>Nom</Label>
                  <Input
                    value={formData.last_name}
                    onChange={(e) => handleChange('last_name', e.target.value)}
                    data-testid="supplier-last-name"
                  />
                </div>
              </div>

              <div>
                <Label>Entreprise</Label>
                <Input
                  value={formData.company_name}
                  onChange={(e) => handleChange('company_name', e.target.value)}
                  data-testid="supplier-company-name"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    data-testid="supplier-email"
                  />
                </div>
                <div>
                  <Label>Téléphone</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    data-testid="supplier-phone"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Matricule fiscal</Label>
                  <Input
                    value={formData.fiscal_id}
                    onChange={(e) => handleChange('fiscal_id', e.target.value)}
                    data-testid="supplier-fiscal-id"
                  />
                </div>
                <div>
                  <Label>Activité</Label>
                  <Input
                    value={formData.activity}
                    onChange={(e) => handleChange('activity', e.target.value)}
                    data-testid="supplier-activity"
                  />
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Adresse</h3>
                <div className="space-y-2">
                  <Input
                    placeholder="Rue"
                    value={formData.billing_address.street}
                    onChange={(e) => handleChange('billing_address.street', e.target.value)}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Ville"
                      value={formData.billing_address.city}
                      onChange={(e) => handleChange('billing_address.city', e.target.value)}
                    />
                    <Input
                      placeholder="Code postal"
                      value={formData.billing_address.postal_code}
                      onChange={(e) => handleChange('billing_address.postal_code', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label>Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  rows={3}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={formLoading} className="bg-violet-600 hover:bg-violet-700">
                  {formLoading ? 'Enregistrement...' : 'Enregistrer'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default Suppliers;
