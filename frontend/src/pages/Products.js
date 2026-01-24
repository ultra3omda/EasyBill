import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { productsAPI } from '../services/api';
import { useCompany } from '../hooks/useCompany';
import AppLayout from '../components/layout/AppLayout';
import ProductFormModal from '../components/modals/ProductFormModal';
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
import { Plus, Search, Filter, Download, Eye, Edit, Trash2, MoreVertical, Package } from 'lucide-react';
import { toast } from '../hooks/use-toast';

const Products = () => {
  const { t } = useLanguage();
  const { currentCompany } = useCompany();
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentCompany) {
      loadProducts();
    }
  }, [currentCompany]);

  const loadProducts = async () => {
    if (!currentCompany) return;
    setLoading(true);
    try {
      const response = await productsAPI.list(currentCompany.id, { search: searchTerm });
      setProducts(response.data);
    } catch (error) {
      console.error('Error loading products:', error);
      toast({ title: 'Erreur', description: 'Impossible de charger les produits', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (productId) => {
    if (!window.confirm('Voulez-vous vraiment supprimer ce produit ?')) return;
    try {
      await productsAPI.delete(currentCompany.id, productId);
      toast({ title: 'Succès', description: 'Produit supprimé' });
      loadProducts();
    } catch (error) {
      toast({ title: 'Erreur', description: 'Erreur lors de la suppression', variant: 'destructive' });
    }
  };

  const openEditModal = (product) => {
    setSelectedProduct(product);
    setModalOpen(true);
  };

  const openCreateModal = () => {
    setSelectedProduct(null);
    setModalOpen(true);
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{t('nav.products')}</h1>
            <p className="text-gray-500 mt-1">{filteredProducts.length} produits et services</p>
          </div>
          <Button className="bg-teal-600 hover:bg-teal-700 text-white">
            <Plus className="w-4 h-4 mr-2" />
            Ajouter un produit
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
            <p className="text-sm text-gray-600 mb-2">Total Produits</p>
            <p className="text-2xl font-bold text-gray-900">{products.length}</p>
            <p className="text-xs text-gray-500 mt-1">Catalogue complet</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-gray-600 mb-2">Services</p>
            <p className="text-2xl font-bold text-blue-600">
              {products.filter(p => p.category === 'Services').length}
            </p>
            <p className="text-xs text-gray-500 mt-1">Services billables</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-gray-600 mb-2">Produits</p>
            <p className="text-2xl font-bold text-green-600">
              {products.filter(p => p.category === 'Produits').length}
            </p>
            <p className="text-xs text-gray-500 mt-1">Avec stock</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-gray-600 mb-2">Valeur Moyenne</p>
            <p className="text-2xl font-bold text-teal-600">
              {(products.reduce((acc, p) => acc + p.price, 0) / products.length).toFixed(2)} TND
            </p>
            <p className="text-xs text-gray-500 mt-1">Prix moyen</p>
          </Card>
        </div>

        {/* Products Table */}
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produit/Service</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Prix Unitaire</TableHead>
                  <TableHead>Unité</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => (
                  <TableRow key={product.id} className="hover:bg-gray-50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                          <Package className="w-5 h-5 text-teal-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{product.name}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-gray-600">{product.sku}</TableCell>
                    <TableCell>
                      <Badge variant={product.category === 'Services' ? 'default' : 'secondary'}>
                        {product.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-semibold">{product.price.toFixed(2)} TND</TableCell>
                    <TableCell className="text-gray-600">{product.unit}</TableCell>
                    <TableCell>
                      {product.stock !== null ? (
                        <span className={`font-semibold ${
                          product.stock > 20 ? 'text-green-600' : product.stock > 0 ? 'text-orange-600' : 'text-red-600'
                        }`}>
                          {product.stock}
                        </span>
                      ) : (
                        <span className="text-gray-400">N/A</span>
                      )}
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

export default Products;