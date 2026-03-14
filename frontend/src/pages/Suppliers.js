import React, { useState, useEffect } from 'react';
import AppLayout from '../components/layout/AppLayout';
import SupplierFormModal from '../components/modals/SupplierFormModal';
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
import { Plus, Search, Eye, Edit, Trash2, MoreVertical, Truck, Users, FileText, TrendingDown, TrendingUp, UserPlus, ChevronDown } from 'lucide-react';
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
  const [itemsPerPage, setItemsPerPage] = useState(25);

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

  const handleEdit = (supplier) => {
    setEditingSupplier(supplier);
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
    setIsDialogOpen(true);
  };

  const filteredSuppliers = suppliers.filter(supplier =>
    (supplier.display_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (supplier.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (supplier.company_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate KPIs
  const totalSuppliers = suppliers.length;
  const totalDebt = suppliers.reduce((acc, s) => acc + (s.balance || 0), 0);
  const totalPurchases = suppliers.reduce((acc, s) => acc + (s.total_purchases || 0), 0);
  const newThisMonth = suppliers.filter(s => {
    if (!s.created_at) return false;
    const createdDate = new Date(s.created_at);
    const now = new Date();
    return createdDate.getMonth() === now.getMonth() && createdDate.getFullYear() === now.getFullYear();
  }).length;

  return (
    <AppLayout>
      <div className="space-y-4" data-testid="suppliers-page">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Synthèse des fournisseurs</h1>
            <p className="text-gray-500 text-sm">Fournisseurs • {currentCompany?.name || 'Mycompany'}</p>
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
              onClick={openNewDialog}
              className="bg-amber-600 hover:bg-amber-700 text-white"
              data-testid="add-supplier-btn"
            >
              Nouveau fournisseur
            </Button>
          </div>
        </div>

        {/* KPI Cards - Iberis Style */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Fournisseurs */}
          <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 border-0 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-blue-500 rounded-lg">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600 font-medium">Fournisseurs</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-gray-900">{totalSuppliers}</span>
                  <span className="text-sm text-green-600">(+0%)</span>
                </div>
                <p className="text-xs text-blue-600 mt-1">vs mois dernier</p>
              </div>
            </div>
          </Card>

          {/* Impayé (Dettes) */}
          <Card className="p-4 bg-gradient-to-br from-amber-50 to-amber-100 border-0 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-amber-500 rounded-lg">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600 font-medium">Impayé</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-gray-900">{totalDebt.toFixed(3)}</span>
                  <span className="text-sm font-medium text-gray-600">TND</span>
                </div>
                <p className="text-xs text-amber-600 mt-1">{suppliers.filter(s => (s.balance || 0) > 0).length} fournisseurs</p>
              </div>
            </div>
          </Card>

          {/* Factures fournisseur */}
          <Card className="p-4 bg-gradient-to-br from-red-50 to-red-100 border-0 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-red-500 rounded-lg">
                <TrendingDown className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600 font-medium">Factures fournisseur</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-gray-900">{totalPurchases.toFixed(3)}</span>
                  <span className="text-sm font-medium text-gray-600">TND</span>
                </div>
                <p className="text-xs text-red-600 mt-1">{new Date().getFullYear()}</p>
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
            <Button variant="outline" className="flex items-center gap-2 text-amber-600 border-amber-200 bg-amber-50 hover:bg-amber-100">
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
                data-testid="search-suppliers"
              />
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600 mx-auto"></div>
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="p-12 text-center">
              <Truck className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-2">Aucune donnée disponible dans le tableau</p>
              <Button onClick={openNewDialog} className="mt-4 bg-amber-600 hover:bg-amber-700">
                <Plus className="w-4 h-4 mr-2" />
                Ajouter votre premier fournisseur
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
                  {filteredSuppliers.map((supplier) => (
                    <TableRow key={supplier.id} className="hover:bg-gray-50" data-testid={`supplier-row-${supplier.id}`}>
                      <TableCell>
                        <input type="checkbox" className="rounded border-gray-300" />
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">{supplier.reference || '-'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 font-semibold text-sm">
                            {(supplier.display_name || 'F').charAt(0)}
                          </div>
                          <span className="font-medium text-gray-900">{supplier.display_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={supplier.supplier_type === 'entreprise' 
                            ? 'bg-amber-50 text-amber-700 border-amber-200' 
                            : 'bg-blue-50 text-blue-700 border-blue-200'}
                        >
                          {supplier.supplier_type === 'entreprise' ? 'Entreprise' : 'Particulier'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">{supplier.company_name || '-'}</TableCell>
                      <TableCell className="text-sm text-gray-600">{supplier.email || '-'}</TableCell>
                      <TableCell className="text-sm text-gray-600">{supplier.phone || '-'}</TableCell>
                      <TableCell>
                        <span className={`font-semibold ${
                          (supplier.balance || 0) > 0 ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {(supplier.balance || 0).toFixed(3)}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-gray-900 font-medium">
                        {(supplier.total_purchases || 0).toFixed(3)} TND
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/contacts/suppliers/${supplier.id}/summary`)}>
                              <TrendingUp className="w-4 h-4 mr-2" />
                              Voir synthèse
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEdit(supplier)}>
                              <Eye className="w-4 h-4 mr-2" />
                              Voir / Modifier
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
                Affichage de l'élément {filteredSuppliers.length > 0 ? 1 : 0} à {Math.min(itemsPerPage, filteredSuppliers.length)} sur {filteredSuppliers.length} élément{filteredSuppliers.length > 1 ? 's' : ''}
              </span>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled>Précédent</Button>
                <Button variant="outline" size="sm" disabled>Suivant</Button>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <SupplierFormModal
        open={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSuccess={fetchSuppliers}
        supplier={editingSupplier}
      />
    </AppLayout>
  );
};

export default Suppliers;
