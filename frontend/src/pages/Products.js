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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
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
  Plus, Search, Filter, Download, Edit, Trash2, MoreVertical, 
  Package, ShoppingBag, Boxes, AlertTriangle 
} from 'lucide-react';
import { toast } from '../hooks/use-toast';
import { useCompany } from '../hooks/useCompany';
import { productsAPI } from '../services/api';

const Products = () => {
  const { currentCompany } = useCompany();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [taxes, setTaxes] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    description: '',
    type: 'product',
    category: '',
    unit: 'pièce',
    selling_price: '',
    purchase_price: '',
    tax_rate: 19,
    quantity_in_stock: 0,
    min_stock_level: 0
  });

  useEffect(() => {
    if (currentCompany?.id) {
      fetchProducts();
      fetchTaxes();
    }
  }, [currentCompany]);

  const fetchProducts = async () => {
    try {
      const response = await productsAPI.list(currentCompany.id);
      setProducts(response.data);
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les articles',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTaxes = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/settings/taxes/${currentCompany.id}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      setTaxes(data);
    } catch (error) {
      console.error('Error fetching taxes:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      sku: '',
      description: '',
      type: 'product',
      category: '',
      unit: 'pièce',
      selling_price: '',
      purchase_price: '',
      tax_rate: 19,
      quantity_in_stock: 0,
      min_stock_level: 0
    });
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      const payload = {
        ...formData,
        selling_price: parseFloat(formData.selling_price) || 0,
        purchase_price: parseFloat(formData.purchase_price) || 0,
        quantity_in_stock: parseInt(formData.quantity_in_stock) || 0,
        min_stock_level: parseInt(formData.min_stock_level) || 0
      };

      if (editingProduct) {
        await productsAPI.update(currentCompany.id, editingProduct.id, payload);
        toast({ title: 'Succès', description: 'Article modifié avec succès' });
      } else {
        await productsAPI.create(currentCompany.id, payload);
        toast({ title: 'Succès', description: 'Article créé avec succès' });
      }
      setIsDialogOpen(false);
      setEditingProduct(null);
      resetForm();
      fetchProducts();
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

  const handleEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name || '',
      sku: product.sku || '',
      description: product.description || '',
      type: product.type || 'product',
      category: product.category || '',
      unit: product.unit || 'pièce',
      selling_price: product.selling_price?.toString() || '',
      purchase_price: product.purchase_price?.toString() || '',
      tax_rate: product.tax_rate || 19,
      quantity_in_stock: product.quantity_in_stock || 0,
      min_stock_level: product.min_stock_level || 0
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (productId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cet article ?')) return;
    
    try {
      await productsAPI.delete(currentCompany.id, productId);
      toast({ title: 'Succès', description: 'Article supprimé avec succès' });
      fetchProducts();
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de supprimer l\'article',
        variant: 'destructive'
      });
    }
  };

  const openNewDialog = () => {
    setEditingProduct(null);
    resetForm();
    setIsDialogOpen(true);
  };

  const filteredProducts = products.filter(product =>
    (product.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (product.sku || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalStock = products.reduce((acc, p) => acc + (p.quantity_in_stock || 0), 0);
  const lowStockProducts = products.filter(p => p.quantity_in_stock <= (p.min_stock_level || 0) && p.min_stock_level > 0);
  const totalValue = products.reduce((acc, p) => acc + ((p.quantity_in_stock || 0) * (p.purchase_price || 0)), 0);

  return (
    <AppLayout>
      <div className="space-y-6" data-testid="products-page">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Articles</h1>
            <p className="text-gray-500 mt-1">{filteredProducts.length} articles au total</p>
          </div>
          <Button 
            onClick={openNewDialog}
            className="bg-violet-600 hover:bg-violet-700 text-white"
            data-testid="add-product-button"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nouvel article
          </Button>
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                placeholder="Rechercher par nom ou référence..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="search-products"
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
                <Package className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Articles</p>
                <p className="text-2xl font-bold text-gray-900">{products.length}</p>
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Boxes className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Stock Total</p>
                <p className="text-2xl font-bold text-green-600">{totalStock}</p>
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Stock Faible</p>
                <p className="text-2xl font-bold text-amber-600">{lowStockProducts.length}</p>
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-gray-600 mb-2">Valeur Stock</p>
            <p className="text-2xl font-bold text-violet-600">
              {totalValue.toFixed(2)} TND
            </p>
            <p className="text-xs text-gray-500 mt-1">Au prix d'achat</p>
          </Card>
        </div>

        {/* Products Table */}
        <Card>
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 mx-auto"></div>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-8 text-center">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Aucun article trouvé</p>
              <Button onClick={openNewDialog} className="mt-4 bg-violet-600 hover:bg-violet-700">
                <Plus className="w-4 h-4 mr-2" />
                Créer votre premier article
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Article</TableHead>
                    <TableHead>Référence</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Prix Vente</TableHead>
                    <TableHead>Prix Achat</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>TVA</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow key={product.id} className="hover:bg-gray-50" data-testid={`product-row-${product.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center">
                            {product.type === 'service' ? (
                              <ShoppingBag className="w-5 h-5 text-violet-600" />
                            ) : (
                              <Package className="w-5 h-5 text-violet-600" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{product.name}</p>
                            {product.category && (
                              <p className="text-sm text-gray-500">{product.category}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{product.sku || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={product.type === 'service' ? 'secondary' : 'outline'}>
                          {product.type === 'service' ? 'Service' : 'Produit'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold text-green-600">
                        {(product.selling_price || 0).toFixed(2)} TND
                      </TableCell>
                      <TableCell className="text-gray-600">
                        {(product.purchase_price || 0).toFixed(2)} TND
                      </TableCell>
                      <TableCell>
                        {product.type === 'product' ? (
                          <span className={`font-semibold ${
                            product.quantity_in_stock <= (product.min_stock_level || 0) 
                              ? 'text-red-600' 
                              : 'text-gray-900'
                          }`}>
                            {product.quantity_in_stock || 0} {product.unit}
                          </span>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{product.tax_rate || 19}%</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(product)}>
                              <Edit className="w-4 h-4 mr-2" />
                              Modifier
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(product.id)}>
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
              <DialogTitle>{editingProduct ? 'Modifier l\'article' : 'Nouvel article'}</DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Nom de l'article *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    required
                    data-testid="product-name"
                  />
                </div>
                
                <div>
                  <Label>Référence (SKU)</Label>
                  <Input
                    value={formData.sku}
                    onChange={(e) => handleChange('sku', e.target.value)}
                    data-testid="product-sku"
                  />
                </div>
                
                <div>
                  <Label>Type</Label>
                  <Select value={formData.type} onValueChange={(v) => handleChange('type', v)}>
                    <SelectTrigger data-testid="product-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="product">Produit</SelectItem>
                      <SelectItem value="service">Service</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  rows={2}
                  data-testid="product-description"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Catégorie</Label>
                  <Input
                    value={formData.category}
                    onChange={(e) => handleChange('category', e.target.value)}
                    placeholder="Ex: Informatique"
                    data-testid="product-category"
                  />
                </div>
                <div>
                  <Label>Unité</Label>
                  <Select value={formData.unit} onValueChange={(v) => handleChange('unit', v)}>
                    <SelectTrigger data-testid="product-unit">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pièce">Pièce</SelectItem>
                      <SelectItem value="kg">Kilogramme</SelectItem>
                      <SelectItem value="l">Litre</SelectItem>
                      <SelectItem value="m">Mètre</SelectItem>
                      <SelectItem value="m²">Mètre carré</SelectItem>
                      <SelectItem value="heure">Heure</SelectItem>
                      <SelectItem value="jour">Jour</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Prix de vente HT *</Label>
                  <Input
                    type="number"
                    step="0.001"
                    value={formData.selling_price}
                    onChange={(e) => handleChange('selling_price', e.target.value)}
                    required
                    data-testid="product-selling-price"
                  />
                </div>
                <div>
                  <Label>Prix d'achat HT</Label>
                  <Input
                    type="number"
                    step="0.001"
                    value={formData.purchase_price}
                    onChange={(e) => handleChange('purchase_price', e.target.value)}
                    data-testid="product-purchase-price"
                  />
                </div>
                <div>
                  <Label>Taux TVA (%)</Label>
                  <Select value={formData.tax_rate.toString()} onValueChange={(v) => handleChange('tax_rate', parseFloat(v))}>
                    <SelectTrigger data-testid="product-tax-rate">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="19">19%</SelectItem>
                      <SelectItem value="13">13%</SelectItem>
                      <SelectItem value="7">7%</SelectItem>
                      <SelectItem value="0">0%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {formData.type === 'product' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Quantité en stock</Label>
                    <Input
                      type="number"
                      value={formData.quantity_in_stock}
                      onChange={(e) => handleChange('quantity_in_stock', e.target.value)}
                      data-testid="product-stock"
                    />
                  </div>
                  <div>
                    <Label>Seuil d'alerte stock</Label>
                    <Input
                      type="number"
                      value={formData.min_stock_level}
                      onChange={(e) => handleChange('min_stock_level', e.target.value)}
                      data-testid="product-min-stock"
                    />
                  </div>
                </div>
              )}

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

export default Products;
