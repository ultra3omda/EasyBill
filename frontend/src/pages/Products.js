import React, { useState, useEffect, useRef } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
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
  DropdownMenuSeparator,
} from '../components/ui/dropdown-menu';
import { 
  Plus, Search, Edit, Trash2, MoreVertical, Eye,
  Package, TrendingDown, TrendingUp, ShoppingCart, ChevronDown,
  Image, FileText, Calculator, BarChart3, Layers, QrCode, Barcode,
  AlertCircle, Warehouse, Download, Upload, FileSpreadsheet, Merge,
  Trash, Check
} from 'lucide-react';
import { toast } from '../hooks/use-toast';
import { useCompany } from '../hooks/useCompany';
import { productsAPI } from '../services/api';

// Units
const UNITS = [
  { value: 'pièce', label: 'Pièce' },
  { value: 'kg', label: 'Kilogramme (kg)' },
  { value: 'g', label: 'Gramme (g)' },
  { value: 'l', label: 'Litre (l)' },
  { value: 'ml', label: 'Millilitre (ml)' },
  { value: 'm', label: 'Mètre (m)' },
  { value: 'cm', label: 'Centimètre (cm)' },
  { value: 'm²', label: 'Mètre carré (m²)' },
  { value: 'm³', label: 'Mètre cube (m³)' },
  { value: 'heure', label: 'Heure' },
  { value: 'jour', label: 'Jour' },
  { value: 'mois', label: 'Mois' },
  { value: 'carton', label: 'Carton' },
  { value: 'palette', label: 'Palette' }
];

// Categories
const CATEGORIES = [
  'Informatique', 'Électronique', 'Mobilier', 'Fournitures de bureau',
  'Équipement industriel', 'Matières premières', 'Emballage',
  'Produits alimentaires', 'Textile', 'Cosmétique', 'Autre'
];

// Brands
const BRANDS = [
  'Sans marque', 'Apple', 'Samsung', 'HP', 'Dell', 'Lenovo',
  'Microsoft', 'Sony', 'LG', 'Canon', 'Autre'
];

// Tax rates Tunisia
const TAX_RATES = [
  { value: 19, label: 'TVA 19%' },
  { value: 13, label: 'TVA 13%' },
  { value: 7, label: 'TVA 7%' },
  { value: 0, label: 'Exonéré 0%' }
];

// Delimiters
const DELIMITERS = [
  { value: ';', label: 'Point-virgule (;)' },
  { value: ',', label: 'Virgule (,)' },
  { value: '\t', label: 'Tabulation' }
];

// Encodings
const ENCODINGS = [
  { value: 'utf-8', label: 'UTF-8' },
  { value: 'iso-8859-1', label: 'ISO-8859-1 (Latin-1)' },
  { value: 'windows-1252', label: 'Windows-1252' }
];

const Products = () => {
  const { currentCompany } = useCompany();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [selectedProducts, setSelectedProducts] = useState([]);
  
  // Import modal state
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importDelimiter, setImportDelimiter] = useState(';');
  const [importEncoding, setImportEncoding] = useState('utf-8');
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);
  
  const [formData, setFormData] = useState({
    name: '',
    reference: '',
    description: '',
    tax_id: '',
    unit: 'pièce',
    category: '',
    brand: '',
    destination: 'both', // vente, achat, both, raw_material
    reference_type: 'disabled', // lots, serial, disabled
    article_type: 'product', // product, service
    quantity_type: 'simple', // simple, composite
    composite_field_name: '',
    composite_operation: 'multiply',
    barcode: '',
    qr_code: '',
    stock_alert_enabled: false,
    stock_alert_threshold: 0,
    selling_price: '',
    purchase_price: '',
    tax_rate: 19,
    quantity_in_stock: 0,
    warehouse_id: '',
    // Composition
    is_composite: false,
    components: []
  });

  useEffect(() => {
    if (currentCompany?.id) {
      fetchProducts();
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

  const resetForm = () => {
    setFormData({
      name: '',
      reference: '',
      description: '',
      tax_id: '',
      unit: 'pièce',
      category: '',
      brand: '',
      destination: 'both',
      reference_type: 'disabled',
      article_type: 'product',
      quantity_type: 'simple',
      composite_field_name: '',
      composite_operation: 'multiply',
      barcode: '',
      qr_code: '',
      stock_alert_enabled: false,
      stock_alert_threshold: 0,
      selling_price: '',
      purchase_price: '',
      tax_rate: 19,
      quantity_in_stock: 0,
      warehouse_id: '',
      is_composite: false,
      components: []
    });
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({ title: 'Erreur', description: 'Le titre est requis', variant: 'destructive' });
      return;
    }

    setFormLoading(true);
    try {
      const payload = {
        name: formData.name,
        sku: formData.reference,
        description: formData.description,
        type: formData.article_type,
        category: formData.category,
        brand: formData.brand,
        unit: formData.unit,
        selling_price: parseFloat(formData.selling_price) || 0,
        purchase_price: parseFloat(formData.purchase_price) || 0,
        tax_rate: formData.tax_rate,
        quantity_in_stock: parseInt(formData.quantity_in_stock) || 0,
        min_stock_level: formData.stock_alert_enabled ? formData.stock_alert_threshold : 0,
        destination: formData.destination,
        reference_type: formData.reference_type,
        quantity_type: formData.quantity_type,
        barcode: formData.barcode,
        is_composite: formData.is_composite,
        components: formData.components
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
      reference: product.sku || '',
      description: product.description || '',
      tax_id: '',
      unit: product.unit || 'pièce',
      category: product.category || '',
      brand: product.brand || '',
      destination: product.destination || 'both',
      reference_type: product.reference_type || 'disabled',
      article_type: product.type || 'product',
      quantity_type: product.quantity_type || 'simple',
      composite_field_name: '',
      composite_operation: 'multiply',
      barcode: product.barcode || '',
      qr_code: '',
      stock_alert_enabled: (product.min_stock_level || 0) > 0,
      stock_alert_threshold: product.min_stock_level || 0,
      selling_price: product.selling_price?.toString() || '',
      purchase_price: product.purchase_price?.toString() || '',
      tax_rate: product.tax_rate || 19,
      quantity_in_stock: product.quantity_in_stock || 0,
      warehouse_id: '',
      is_composite: product.is_composite || false,
      components: product.components || []
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

  // Selection handlers
  const toggleSelectProduct = (productId) => {
    setSelectedProducts(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedProducts.length === filteredProducts.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(filteredProducts.map(p => p.id));
    }
  };

  // Import handlers
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
    }
  };

  const handleImport = async () => {
    if (!importFile) {
      toast({ title: 'Erreur', description: 'Veuillez sélectionner un fichier', variant: 'destructive' });
      return;
    }

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('delimiter', importDelimiter);
      formData.append('encoding', importEncoding);

      const response = await productsAPI.importProducts(currentCompany.id, formData);
      toast({ 
        title: 'Import réussi', 
        description: response.data.message 
      });
      
      if (response.data.errors?.length > 0) {
        console.warn('Import errors:', response.data.errors);
      }
      
      setImportModalOpen(false);
      setImportFile(null);
      fetchProducts();
    } catch (error) {
      toast({
        title: 'Erreur d\'import',
        description: error.response?.data?.detail || 'Erreur lors de l\'import',
        variant: 'destructive'
      });
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const token = localStorage.getItem('token');
    const url = productsAPI.downloadTemplate(currentCompany.id);
    window.open(`${url}&token=${token}`, '_blank');
  };

  // Export handlers
  const exportPriceList = () => {
    const token = localStorage.getItem('token');
    const url = productsAPI.exportPrices(currentCompany.id);
    window.open(`${url}&token=${token}`, '_blank');
  };

  const exportStockState = () => {
    const token = localStorage.getItem('token');
    const url = productsAPI.exportStock(currentCompany.id);
    window.open(`${url}&token=${token}`, '_blank');
  };

  // Bulk delete
  const handleBulkDelete = async () => {
    if (selectedProducts.length === 0) {
      toast({ title: 'Erreur', description: 'Aucun article sélectionné', variant: 'destructive' });
      return;
    }
    
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer ${selectedProducts.length} article(s) ?`)) return;
    
    try {
      await productsAPI.bulkDelete(currentCompany.id, selectedProducts);
      toast({ title: 'Succès', description: `${selectedProducts.length} articles supprimés` });
      setSelectedProducts([]);
      fetchProducts();
    } catch (error) {
      toast({ title: 'Erreur', description: 'Erreur lors de la suppression', variant: 'destructive' });
    }
  };

  const handleDeleteAll = async () => {
    if (!window.confirm('ATTENTION: Êtes-vous sûr de vouloir supprimer TOUS les articles ? Cette action est irréversible.')) return;
    if (!window.confirm('Confirmez une seconde fois pour supprimer tous les articles.')) return;
    
    try {
      await productsAPI.deleteAll(currentCompany.id);
      toast({ title: 'Succès', description: 'Tous les articles ont été supprimés' });
      setSelectedProducts([]);
      fetchProducts();
    } catch (error) {
      toast({ title: 'Erreur', description: 'Erreur lors de la suppression', variant: 'destructive' });
    }
  };

  // Filter products by tab
  const getFilteredProducts = () => {
    let filtered = products.filter(product =>
      (product.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.sku || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    switch(activeTab) {
      case 'sale':
        return filtered.filter(p => p.destination === 'vente' || p.destination === 'both');
      case 'purchase':
        return filtered.filter(p => p.destination === 'achat' || p.destination === 'both');
      case 'raw':
        return filtered.filter(p => p.destination === 'raw_material');
      default:
        return filtered;
    }
  };

  const filteredProducts = getFilteredProducts();

  // KPIs
  const totalValue = products.reduce((acc, p) => acc + ((p.quantity_in_stock || 0) * (p.purchase_price || 0)), 0);
  const lowStockProduct = products.find(p => p.quantity_in_stock <= (p.min_stock_level || 0) && p.min_stock_level > 0);
  const mostProfitable = products.reduce((best, p) => {
    const margin = (p.selling_price || 0) - (p.purchase_price || 0);
    const bestMargin = (best?.selling_price || 0) - (best?.purchase_price || 0);
    return margin > bestMargin ? p : best;
  }, null);
  const mostSold = products.reduce((best, p) => 
    (p.total_sold || 0) > (best?.total_sold || 0) ? p : best, null);

  return (
    <AppLayout>
      <div className="space-y-6" data-testid="products-page">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Articles</h1>
            <p className="text-gray-500 text-sm">Stock • {currentCompany?.name || 'Mycompany'}</p>
          </div>
          <div className="flex gap-2">
            {/* Action Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="text-gray-600">
                  Action
                  <ChevronDown className="w-4 h-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={exportPriceList}>
                  <Download className="w-4 h-4 mr-2" />
                  Exporter la liste des prix
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportStockState}>
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Exporter l'état du stock
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => toast({ title: 'Info', description: 'Sélectionnez des articles à fusionner' })}>
                  <Merge className="w-4 h-4 mr-2" />
                  Fusionner
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={handleBulkDelete}
                  disabled={selectedProducts.length === 0}
                  className="text-red-600"
                >
                  <Trash className="w-4 h-4 mr-2" />
                  Supprimer ({selectedProducts.length})
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDeleteAll} className="text-red-600">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Tout supprimer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Import Button */}
            <Button 
              variant="outline" 
              className="text-gray-600"
              onClick={() => setImportModalOpen(true)}
            >
              <Upload className="w-4 h-4 mr-2" />
              Importer
            </Button>
            
            <Button 
              onClick={openNewDialog}
              className="bg-violet-600 hover:bg-violet-700 text-white"
              data-testid="add-product-button"
            >
              Nouvel article
            </Button>
          </div>
        </div>

        {/* KPI Cards - Iberis Style */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Stock le plus bas */}
          <Card className="p-4 bg-gradient-to-br from-red-50 to-red-100 border-0 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-red-500 rounded-lg">
                <TrendingDown className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600 font-medium">Stock le plus bas</p>
                <p className="text-lg font-bold text-gray-900 truncate">
                  {lowStockProduct?.name || 'Aucun(e)'}
                </p>
              </div>
            </div>
          </Card>

          {/* Valeur du Stock */}
          <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 border-0 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-blue-500 rounded-lg">
                <Package className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600 font-medium">Valeur du Stock</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold text-gray-900">{totalValue.toFixed(3)}</span>
                  <span className="text-sm font-medium text-gray-600">TND</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Le plus rentable */}
          <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100 border-0 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-green-500 rounded-lg">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600 font-medium">Le plus rentable</p>
                <p className="text-lg font-bold text-gray-900 truncate">
                  {mostProfitable?.name || 'Aucun(e)'}
                </p>
              </div>
            </div>
          </Card>

          {/* Article le plus vendu */}
          <Card className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 border-0 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-purple-500 rounded-lg">
                <ShoppingCart className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600 font-medium">Article le plus vendu</p>
                <p className="text-lg font-bold text-gray-900 truncate">
                  {mostSold?.name || 'Aucun(e)'}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Tabs */}
        <Card className="p-0 overflow-hidden">
          <div className="border-b">
            <div className="flex">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'all' 
                    ? 'text-violet-600 border-b-2 border-violet-600 bg-violet-50' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Tous les articles
              </button>
              <button
                onClick={() => setActiveTab('sale')}
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'sale' 
                    ? 'text-violet-600 border-b-2 border-violet-600 bg-violet-50' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Pour la vente
              </button>
              <button
                onClick={() => setActiveTab('purchase')}
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'purchase' 
                    ? 'text-violet-600 border-b-2 border-violet-600 bg-violet-50' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Pour l'achat
              </button>
              <button
                onClick={() => setActiveTab('raw')}
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'raw' 
                    ? 'text-violet-600 border-b-2 border-violet-600 bg-violet-50' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Matière première
              </button>
            </div>
          </div>

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
                data-testid="search-products"
              />
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 mx-auto"></div>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-12 text-center">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-2">Aucune donnée disponible dans le tableau</p>
              <Button onClick={openNewDialog} className="mt-4 bg-violet-600 hover:bg-violet-700">
                <Plus className="w-4 h-4 mr-2" />
                Ajouter votre premier article
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
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase">TITRE</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase">CATÉGORIE</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase">MARQUE</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase">PRIX DE VENTE PAR DÉFAUT</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase">PRIX D'ACHAT PAR DÉFAUT</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase">STOCK</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase text-right">ACTION</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow key={product.id} className="hover:bg-gray-50" data-testid={`product-row-${product.id}`}>
                      <TableCell>
                        <input type="checkbox" className="rounded border-gray-300" />
                      </TableCell>
                      <TableCell className="text-sm text-gray-600 font-mono">{product.sku || '-'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                            <Package className="w-5 h-5 text-gray-400" />
                          </div>
                          <span className="font-medium text-gray-900">{product.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">{product.category || '-'}</TableCell>
                      <TableCell className="text-sm text-gray-600">{product.brand || '-'}</TableCell>
                      <TableCell className="text-sm font-semibold text-green-600">
                        {(product.selling_price || 0).toFixed(3)} TND
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {(product.purchase_price || 0).toFixed(3)} TND
                      </TableCell>
                      <TableCell>
                        <span className={`font-semibold ${
                          product.quantity_in_stock <= (product.min_stock_level || 0) && product.min_stock_level > 0
                            ? 'text-red-600' 
                            : 'text-gray-900'
                        }`}>
                          {product.quantity_in_stock || 0}
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
                            <DropdownMenuItem onClick={() => handleEdit(product)}>
                              <Eye className="w-4 h-4 mr-2" />
                              Voir / Modifier
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
                Affichage de l'élément {filteredProducts.length > 0 ? 1 : 0} à {Math.min(itemsPerPage, filteredProducts.length)} sur {filteredProducts.length} élément{filteredProducts.length > 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </Card>

        {/* Article Form Dialog - Iberis Style */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto" data-testid="product-form-modal">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold">
                {editingProduct ? 'Modifier l\'article' : 'Nouvel article'}
              </DialogTitle>
              <p className="text-sm text-gray-500">Stock • {currentCompany?.name}</p>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Main Grid - Image + Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Image Upload */}
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-violet-400 transition-colors cursor-pointer">
                    <div className="w-24 h-24 bg-gray-100 rounded-lg mx-auto flex items-center justify-center mb-3">
                      <Image className="w-12 h-12 text-gray-300" />
                    </div>
                    <p className="text-sm text-gray-500">Glissez une image ici</p>
                    <p className="text-xs text-gray-400 mt-1">ou cliquez pour parcourir</p>
                  </div>
                </div>

                {/* General Info */}
                <div className="md:col-span-2 space-y-4">
                  <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                    <div className="flex items-center gap-2 text-gray-700 font-medium">
                      <FileText className="w-4 h-4" />
                      <span>Informations générales</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Titre *</Label>
                        <Input
                          value={formData.name}
                          onChange={(e) => handleChange('name', e.target.value)}
                          placeholder="Nom de l'article"
                          className="mt-1"
                          data-testid="product-name"
                        />
                      </div>
                      <div>
                        <Label>Référence</Label>
                        <Input
                          value={formData.reference}
                          onChange={(e) => handleChange('reference', e.target.value)}
                          placeholder="REF-001"
                          className="mt-1"
                          data-testid="product-sku"
                        />
                      </div>
                    </div>

                    <div>
                      <Label>Description</Label>
                      <Textarea
                        value={formData.description}
                        onChange={(e) => handleChange('description', e.target.value)}
                        rows={3}
                        className="mt-1"
                        data-testid="product-description"
                      />
                    </div>

                    <div className="grid grid-cols-4 gap-3">
                      <div>
                        <Label>Taxes</Label>
                        <Select value={formData.tax_rate.toString()} onValueChange={(v) => handleChange('tax_rate', parseFloat(v))}>
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TAX_RATES.map(t => (
                              <SelectItem key={t.value} value={t.value.toString()}>{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Unité</Label>
                        <Select value={formData.unit} onValueChange={(v) => handleChange('unit', v)}>
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {UNITS.map(u => (
                              <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Catégorie</Label>
                        <Select value={formData.category} onValueChange={(v) => handleChange('category', v)}>
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Sélectionner" />
                          </SelectTrigger>
                          <SelectContent>
                            {CATEGORIES.map(c => (
                              <SelectItem key={c} value={c}>{c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Marque</Label>
                        <Select value={formData.brand} onValueChange={(v) => handleChange('brand', v)}>
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Sélectionner" />
                          </SelectTrigger>
                          <SelectContent>
                            {BRANDS.map(b => (
                              <SelectItem key={b} value={b}>{b}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Article Options */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column - Options */}
                <div className="space-y-4">
                  {/* Destination */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <Label className="mb-3 block">Cet article est destiné à</Label>
                    <RadioGroup 
                      value={formData.destination} 
                      onValueChange={(v) => handleChange('destination', v)}
                      className="flex flex-wrap gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="vente" id="dest-vente" />
                        <Label htmlFor="dest-vente" className="font-normal cursor-pointer">Vente</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="achat" id="dest-achat" />
                        <Label htmlFor="dest-achat" className="font-normal cursor-pointer">Achat</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="both" id="dest-both" />
                        <Label htmlFor="dest-both" className="font-normal cursor-pointer">Les deux</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="raw_material" id="dest-raw" />
                        <Label htmlFor="dest-raw" className="font-normal cursor-pointer">Matière première</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* Reference Type */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <Label className="mb-3 block">Type de référence de l'article</Label>
                    <RadioGroup 
                      value={formData.reference_type} 
                      onValueChange={(v) => handleChange('reference_type', v)}
                      className="flex flex-wrap gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="lots" id="ref-lots" />
                        <Label htmlFor="ref-lots" className="font-normal cursor-pointer">Lots</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="serial" id="ref-serial" />
                        <Label htmlFor="ref-serial" className="font-normal cursor-pointer">Numéros de série</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="disabled" id="ref-disabled" />
                        <Label htmlFor="ref-disabled" className="font-normal cursor-pointer">Désactiver</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* Article Type */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <Label className="mb-3 block">Type d'article</Label>
                    <RadioGroup 
                      value={formData.article_type} 
                      onValueChange={(v) => handleChange('article_type', v)}
                      className="flex gap-6"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="product" id="type-product" />
                        <Label htmlFor="type-product" className="font-normal cursor-pointer flex items-center gap-2">
                          <Package className="w-4 h-4 text-violet-600" />
                          Produit
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="service" id="type-service" />
                        <Label htmlFor="type-service" className="font-normal cursor-pointer flex items-center gap-2">
                          <Calculator className="w-4 h-4 text-blue-600" />
                          Service
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* Quantity Calculation */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <Label className="mb-3 block">Calcul de quantité</Label>
                    <RadioGroup 
                      value={formData.quantity_type} 
                      onValueChange={(v) => handleChange('quantity_type', v)}
                      className="space-y-3"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="simple" id="qty-simple" />
                        <Label htmlFor="qty-simple" className="font-normal cursor-pointer">Quantité simple</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="composite" id="qty-composite" />
                        <Label htmlFor="qty-composite" className="font-normal cursor-pointer">Quantité composée</Label>
                      </div>
                    </RadioGroup>

                    {formData.quantity_type === 'composite' && (
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Nom du champ</Label>
                          <Input
                            value={formData.composite_field_name}
                            onChange={(e) => handleChange('composite_field_name', e.target.value)}
                            placeholder="Longueur, Largeur..."
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Opération</Label>
                          <Select value={formData.composite_operation} onValueChange={(v) => handleChange('composite_operation', v)}>
                            <SelectTrigger className="mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="multiply">Multiplier</SelectItem>
                              <SelectItem value="add">Additionner</SelectItem>
                              <SelectItem value="divide">Diviser</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column - Codes & Alerts */}
                <div className="space-y-4">
                  {/* Barcode & QR */}
                  <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="flex items-center gap-2">
                          <Barcode className="w-4 h-4" />
                          Barcode
                        </Label>
                        <Input
                          value={formData.barcode}
                          onChange={(e) => handleChange('barcode', e.target.value)}
                          placeholder="Code barre"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="flex items-center gap-2">
                          <QrCode className="w-4 h-4" />
                          QR Code
                        </Label>
                        <Input
                          value={formData.qr_code}
                          onChange={(e) => handleChange('qr_code', e.target.value)}
                          placeholder="QR Code"
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Stock Alert */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-500" />
                        M'envoyer une alerte quand le stock atteint
                      </Label>
                      <Switch
                        checked={formData.stock_alert_enabled}
                        onCheckedChange={(v) => handleChange('stock_alert_enabled', v)}
                      />
                    </div>
                    {formData.stock_alert_enabled && (
                      <Input
                        type="number"
                        value={formData.stock_alert_threshold}
                        onChange={(e) => handleChange('stock_alert_threshold', parseInt(e.target.value) || 0)}
                        placeholder="Seuil d'alerte"
                        className="mt-3"
                      />
                    )}
                  </div>

                  {/* Prices */}
                  <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                    <div className="flex items-center gap-2 text-gray-700 font-medium">
                      <BarChart3 className="w-4 h-4" />
                      <span>Grilles des Prix</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Prix de vente HT</Label>
                        <Input
                          type="number"
                          step="0.001"
                          value={formData.selling_price}
                          onChange={(e) => handleChange('selling_price', e.target.value)}
                          placeholder="0.000"
                          className="mt-1"
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
                          placeholder="0.000"
                          className="mt-1"
                          data-testid="product-purchase-price"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Stock & Warehouse */}
                  {formData.article_type === 'product' && (
                    <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                      <div className="flex items-center gap-2 text-gray-700 font-medium">
                        <Warehouse className="w-4 h-4" />
                        <span>Stock & Entrepôt</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Quantité en stock</Label>
                          <Input
                            type="number"
                            value={formData.quantity_in_stock}
                            onChange={(e) => handleChange('quantity_in_stock', e.target.value)}
                            className="mt-1"
                            data-testid="product-stock"
                          />
                        </div>
                        <div>
                          <Label>Entrepôt</Label>
                          <Select value={formData.warehouse_id} onValueChange={(v) => handleChange('warehouse_id', v)}>
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Principal" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="main">Entrepôt Principal</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Composition Toggle */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-violet-500" />
                        Article composé
                      </Label>
                      <Switch
                        checked={formData.is_composite}
                        onCheckedChange={(v) => handleChange('is_composite', v)}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Activez pour définir les composants de cet article
                    </p>
                  </div>
                </div>
              </div>

              {/* Composition Section */}
              {formData.is_composite && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-amber-700 font-medium mb-4">
                    <Layers className="w-4 h-4" />
                    <span>Composition de l'article</span>
                  </div>
                  <p className="text-sm text-amber-600">
                    Ajoutez les articles qui composent ce produit. Cette fonctionnalité permet de gérer les produits assemblés.
                  </p>
                  <Button variant="outline" className="mt-3" type="button">
                    <Plus className="w-4 h-4 mr-2" />
                    Ajouter un composant
                  </Button>
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
