import React, { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';
import { Badge } from '../ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  Plus,
  Trash2,
  Search,
  FileText,
  ChevronDown,
  Upload,
  QrCode,
  X,
  Save,
  Send,
  Printer,
  Eye,
  Bold,
  Italic,
  Link,
  List,
  AlignLeft,
  Image,
  Paperclip,
  Calendar,
  User,
  Building2,
  MapPin,
  Clock,
  Tag,
  Globe,
  CreditCard,
  Percent,
  Hash
} from 'lucide-react';
import { customersAPI, productsAPI, taxesAPI } from '../../services/api';
import { toast } from '../../hooks/use-toast';
import ProductFormModal from '../modals/ProductFormModal';

const SalesDocumentForm = ({
  type = 'invoice', // invoice, quote, delivery_note, exit_note
  document = null,
  companyId,
  onSave,
  onCancel,
  numbering = {}
}) => {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    customer_id: '',
    reference: '',
    subject: '',
    billing_address: '',
    shipping_address: '',
    payment_condition: 'immediate',
    items: [],
    notes: '',
    terms: '',
    discount_type: 'amount', // amount or percent
    discount_value: 0,
    fiscal_stamp: 1.000,
    show_fiscal_stamp: true,
    // PDF Options
    watermark: '',
    pdf_language: 'fr',
    show_description: true,
    show_unit: true,
    show_ttc_price: false,
    show_photos: false,
    show_billing_address: true,
    show_shipping_address: false,
    show_terms: true,
    show_bank_details: true,
    category: 'main',
    remarks: ''
  });

  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [taxes, setTaxes] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [activeSearchRowIndex, setActiveSearchRowIndex] = useState(null);
  const [rowSearchTerm, setRowSearchTerm] = useState('');
  const [showNewProductModal, setShowNewProductModal] = useState(false);
  const [newProductInitialName, setNewProductInitialName] = useState('');
  const [newProductTargetRowIndex, setNewProductTargetRowIndex] = useState(null);
  const [priceType, setPriceType] = useState('ht'); // ht or ttc

  // Document type configurations
  const docConfig = {
    invoice: {
      title: 'Facture',
      prefix: numbering.invoice_prefix || 'FAC',
      next: numbering.invoice_next || 1,
      showDueDate: true,
      showPaymentCondition: true,
      showFiscalStamp: true,
      color: 'violet'
    },
    quote: {
      title: 'Devis',
      prefix: numbering.quote_prefix || 'DEV',
      next: numbering.quote_next || 1,
      showDueDate: true,
      showPaymentCondition: true,
      showFiscalStamp: false,
      color: 'blue'
    },
    delivery_note: {
      title: 'Bon de livraison',
      prefix: numbering.delivery_prefix || 'BL',
      next: numbering.delivery_next || 1,
      showDueDate: false,
      showPaymentCondition: false,
      showFiscalStamp: false,
      color: 'green'
    },
    exit_note: {
      title: 'Bon de sortie',
      prefix: numbering.exit_prefix || 'BS',
      next: numbering.exit_next || 1,
      showDueDate: false,
      showPaymentCondition: false,
      showFiscalStamp: false,
      color: 'orange'
    }
  };

  const config = docConfig[type];
  const documentNumber = `${config.prefix}-${new Date().getFullYear()}-${String(config.next).padStart(5, '0')}`;

  useEffect(() => {
    loadData();
    if (document) {
      setFormData({
        ...formData,
        ...document,
        items: document.items || []
      });
      if (document.customer_id) {
        loadCustomerDetails(document.customer_id);
      }
    }
  }, [companyId, document]);

  const loadData = async () => {
    if (!companyId) return;
    try {
      const [customersRes, productsRes, taxesRes] = await Promise.all([
        customersAPI.list(companyId),
        productsAPI.list(companyId),
        taxesAPI.list(companyId)
      ]);
      setCustomers(customersRes.data);
      setProducts(productsRes.data);
      setTaxes(taxesRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const loadCustomerDetails = async (customerId) => {
    try {
      const response = await customersAPI.get(companyId, customerId);
      setSelectedCustomer(response.data);
      setFormData(prev => ({
        ...prev,
        billing_address: response.data.address || '',
        shipping_address: response.data.shipping_address || response.data.address || ''
      }));
    } catch (error) {
      console.error('Error loading customer:', error);
    }
  };

  const handleCustomerSelect = (customerId) => {
    const customer = customers.find(c => c.id === customerId);
    setSelectedCustomer(customer);
    setFormData(prev => ({
      ...prev,
      customer_id: customerId,
      billing_address: customer?.address || '',
      shipping_address: customer?.shipping_address || customer?.address || ''
    }));
  };

  const addItem = (product = null) => {
    const defaultTax = taxes.find(t => t.rate === 19) || taxes[0];
    const newItem = {
      id: Date.now(),
      product_id: product?.id || '',
      product_name: product?.name || '',
      description: product?.description || '',
      quantity: 1,
      unit: product?.unit || 'pièce',
      unit_price: product?.selling_price || 0,
      tax_id: defaultTax?.id || '',
      tax_rate: defaultTax?.rate || 19,
      discount: 0,
      total: product?.selling_price || 0
    };
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));
  };

  const updateItem = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    
    // Recalculate total
    const item = newItems[index];
    const subtotal = item.quantity * item.unit_price;
    const discountAmount = item.discount || 0;
    item.total = subtotal - discountAmount;
    
    setFormData(prev => ({ ...prev, items: newItems }));
  };

  const removeItem = (index) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const selectProductForRow = (index, product) => {
    setFormData(prev => {
      const newItems = [...prev.items];
      newItems[index] = {
        ...newItems[index],
        product_id: product.id,
        product_name: product.name,
        description: product.description || '',
        unit: product.unit || 'pièce',
        unit_price: product.selling_price || 0,
        tax_rate: product.tax_rate || 19,
        total: (newItems[index].quantity || 1) * (product.selling_price || 0),
      };
      return { ...prev, items: newItems };
    });
    setActiveSearchRowIndex(null);
    setRowSearchTerm('');
  };

  const calculateTotals = () => {
    const subtotal = formData.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const itemDiscounts = formData.items.reduce((sum, item) => sum + (item.discount || 0), 0);
    
    let globalDiscount = 0;
    if (formData.discount_type === 'percent') {
      globalDiscount = subtotal * (formData.discount_value / 100);
    } else {
      globalDiscount = formData.discount_value || 0;
    }
    
    const totalBeforeTax = subtotal - itemDiscounts - globalDiscount;
    
    const taxAmount = formData.items.reduce((sum, item) => {
      const itemSubtotal = (item.quantity * item.unit_price) - (item.discount || 0);
      return sum + (itemSubtotal * (item.tax_rate / 100));
    }, 0);
    
    const fiscalStamp = config.showFiscalStamp && formData.show_fiscal_stamp ? (formData.fiscal_stamp || 0) : 0;
    
    const total = totalBeforeTax + taxAmount + fiscalStamp;
    
    return {
      subtotal: subtotal.toFixed(3),
      itemDiscounts: itemDiscounts.toFixed(3),
      globalDiscount: globalDiscount.toFixed(3),
      totalDiscount: (itemDiscounts + globalDiscount).toFixed(3),
      taxAmount: taxAmount.toFixed(3),
      fiscalStamp: fiscalStamp.toFixed(3),
      total: total.toFixed(3)
    };
  };

  const totals = calculateTotals();

  const handleSubmit = (action = 'save') => {
    if (!formData.customer_id) {
      toast({ title: 'Erreur', description: 'Veuillez sélectionner un client', variant: 'destructive' });
      return;
    }
    if (formData.items.length === 0) {
      toast({ title: 'Erreur', description: 'Veuillez ajouter au moins un article', variant: 'destructive' });
      return;
    }

    const documentData = {
      ...formData,
      number: documentNumber,
      subtotal: parseFloat(totals.subtotal),
      total_discount: parseFloat(totals.totalDiscount),
      total_tax: parseFloat(totals.taxAmount),
      fiscal_stamp: parseFloat(totals.fiscalStamp),
      total: parseFloat(totals.total),
      status: action === 'send' ? 'sent' : 'draft'
    };

    onSave(documentData, action);
  };


  return (
    <div className="flex gap-6 h-full" data-testid="sales-document-form">
      {/* Main Form */}
      <div className="flex-1 space-y-6 overflow-y-auto pb-20">
        {/* Header */}
        <Card className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Date */}
            <div>
              <Label className="text-sm text-gray-600">Date *</Label>
              <div className="relative mt-1">
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="pl-10"
                />
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>
            </div>

            {/* Payment Condition */}
            {config.showPaymentCondition && (
              <div>
                <Label className="text-sm text-gray-600">Condition</Label>
                <Select value={formData.payment_condition} onValueChange={(v) => setFormData({ ...formData, payment_condition: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="immediate">Payable à réception</SelectItem>
                    <SelectItem value="net_15">Net 15 jours</SelectItem>
                    <SelectItem value="net_30">Net 30 jours</SelectItem>
                    <SelectItem value="net_45">Net 45 jours</SelectItem>
                    <SelectItem value="net_60">Net 60 jours</SelectItem>
                    <SelectItem value="end_of_month">Fin de mois</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Due Date */}
            {config.showDueDate && (
              <div>
                <Label className="text-sm text-gray-600">Échéance *</Label>
                <div className="relative mt-1">
                  <Input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    className="pl-10"
                  />
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                </div>
              </div>
            )}

            {/* Category */}
            <div>
              <Label className="text-sm text-gray-600">Catégorie</Label>
              <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="main">Activité principale</SelectItem>
                  <SelectItem value="secondary">Activité secondaire</SelectItem>
                  <SelectItem value="other">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {/* Subject */}
            <div>
              <Label className="text-sm text-gray-600">Objet</Label>
              <Input
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder="Objet du document"
                className="mt-1"
              />
            </div>

            {/* Document Number */}
            <div>
              <Label className="text-sm text-gray-600">{config.title} n°</Label>
              <Input
                value={documentNumber}
                readOnly
                className="mt-1 bg-gray-50"
              />
            </div>
          </div>
        </Card>

        {/* Customer Selection */}
        <Card className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label className="text-sm text-gray-600 flex items-center gap-2">
                <User className="w-4 h-4" />
                Client *
              </Label>
              <div className="flex gap-2 mt-1">
                <Select value={formData.customer_id} onValueChange={handleCustomerSelect} className="flex-1">
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un client" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map(c => {
                      const label = c.display_name
                        || c.company_name
                        || [c.first_name, c.last_name].filter(Boolean).join(' ')
                        || c.email
                        || 'Client sans nom';
                      return (
                        <SelectItem key={c.id} value={c.id}>
                          {label}
                          {(c.client_type === 'entreprise' || c.customer_type === 'entreprise') && (
                            <Badge variant="outline" className="ml-2 text-xs">Entreprise</Badge>
                          )}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" onClick={() => setShowCustomerModal(true)}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              
              {selectedCustomer && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm">
                  <p className="font-medium">{selectedCustomer.name}</p>
                  {selectedCustomer.email && <p className="text-gray-600">{selectedCustomer.email}</p>}
                  {selectedCustomer.phone && <p className="text-gray-600">{selectedCustomer.phone}</p>}
                </div>
              )}
            </div>

            <div>
              <Label className="text-sm text-gray-600">N° de référence</Label>
              <Input
                value={formData.reference}
                onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                placeholder="Référence client"
                className="mt-1"
              />
              
              <Label className="text-sm text-gray-600 mt-4 block">
                <MapPin className="w-4 h-4 inline mr-1" />
                Adresse de facturation
              </Label>
              <Textarea
                value={formData.billing_address}
                onChange={(e) => setFormData({ ...formData, billing_address: e.target.value })}
                placeholder="Adresse de facturation"
                className="mt-1"
                rows={2}
              />
            </div>
          </div>
        </Card>

        {/* Items Table */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <Button variant="outline" size="sm" onClick={() => setShowCsvImport(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Importer en masse (CSV)
            </Button>
            
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">Les prix des articles sont en:</span>
              <div className="flex border rounded-lg overflow-hidden">
                <button
                  className={`px-3 py-1 text-sm ${priceType === 'ht' ? 'bg-violet-600 text-white' : 'bg-gray-100'}`}
                  onClick={() => setPriceType('ht')}
                >
                  Hors taxes
                </button>
                <button
                  className={`px-3 py-1 text-sm ${priceType === 'ttc' ? 'bg-violet-600 text-white' : 'bg-gray-100'}`}
                  onClick={() => setPriceType('ttc')}
                >
                  Taxe incluse
                </button>
              </div>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="w-[300px]">Article</TableHead>
                <TableHead className="w-[100px]">Quantité</TableHead>
                <TableHead className="w-[120px]">P.U.</TableHead>
                <TableHead className="w-[100px]">Taxe</TableHead>
                <TableHead className="w-[120px]">Prix</TableHead>
                <TableHead className="w-[50px]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {formData.items.map((item, index) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="relative">
                      {/* Combobox style Select */}
                      <button
                        type="button"
                        onClick={() => {
                          setRowSearchTerm('');
                          setActiveSearchRowIndex(activeSearchRowIndex === index ? null : index);
                        }}
                        className="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring font-medium"
                      >
                        <span className={item.product_name ? '' : 'text-muted-foreground'}>
                          {item.product_name || 'Sélectionner un article'}
                        </span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-50 shrink-0 ml-2"><path d="m6 9 6 6 6-6"/></svg>
                      </button>

                      {/* Dropdown autocomplete */}
                      {activeSearchRowIndex === index && (
                        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg">
                          {/* Barre de recherche */}
                          <div className="p-2 border-b">
                            <div className="relative">
                              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                              <input
                                autoFocus
                                value={rowSearchTerm}
                                onChange={(e) => setRowSearchTerm(e.target.value)}
                                onKeyDown={(e) => e.key === 'Escape' && setActiveSearchRowIndex(null)}
                                placeholder="Rechercher..."
                                className="w-full pl-7 pr-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-violet-500"
                              />
                            </div>
                          </div>
                          {/* Liste */}
                          <div className="max-h-48 overflow-y-auto">
                            {products
                              .filter(p =>
                                !rowSearchTerm ||
                                p.name?.toLowerCase().includes(rowSearchTerm.toLowerCase()) ||
                                p.sku?.toLowerCase().includes(rowSearchTerm.toLowerCase())
                              )
                              .slice(0, 8)
                              .map(product => (
                                <div
                                  key={product.id}
                                  className="flex items-center justify-between px-3 py-2 hover:bg-violet-50 cursor-pointer border-b last:border-0"
                                  onMouseDown={(e) => { e.preventDefault(); selectProductForRow(index, product); setActiveSearchRowIndex(null); }}
                                >
                                  <div className="min-w-0">
                                    <p className="font-medium text-sm truncate">{product.name}</p>
                                    <p className="text-xs text-gray-400">{[product.sku, product.category].filter(Boolean).join(' • ')}</p>
                                  </div>
                                  <p className="text-sm text-violet-600 ml-3 shrink-0 font-medium">{(product.selling_price || 0).toFixed(3)} TND</p>
                                </div>
                              ))}
                            {products.filter(p => !rowSearchTerm || p.name?.toLowerCase().includes(rowSearchTerm.toLowerCase())).length === 0 && !rowSearchTerm && (
                              <p className="text-center text-gray-400 text-xs py-3">Aucun article dans le catalogue</p>
                            )}
                          </div>
                          {/* Créer nouveau article */}
                          <div className="border-t p-2">
                            <button
                              type="button"
                              className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-violet-600 hover:bg-violet-50 rounded font-medium"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setActiveSearchRowIndex(null);
                                setNewProductInitialName(rowSearchTerm || item.product_name || '');
                                setNewProductTargetRowIndex(index);
                                setShowNewProductModal(true);
                              }}
                            >
                              <Plus className="w-4 h-4 shrink-0" />
                              {rowSearchTerm
                                ? <>Créer <strong className="mx-1">"{rowSearchTerm}"</strong> comme nouvel article</>
                                : 'Créer un nouvel article'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Overlay pour fermer le dropdown */}
                      {activeSearchRowIndex === index && (
                        <div className="fixed inset-0 z-40" onClick={() => setActiveSearchRowIndex(null)} />
                      )}

                      <Textarea
                        value={item.description}
                        onChange={(e) => updateItem(index, 'description', e.target.value)}
                        placeholder="Description"
                        className="mt-1 text-sm"
                        rows={1}
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                        className="w-16 text-center"
                        min="0"
                        step="1"
                      />
                      <span className="text-xs text-gray-500">{item.unit}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={item.unit_price}
                      onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                      className="text-right"
                      min="0"
                      step="0.001"
                    />
                  </TableCell>
                  <TableCell>
                    <Select 
                      value={item.tax_rate?.toString()} 
                      onValueChange={(v) => updateItem(index, 'tax_rate', parseFloat(v))}
                    >
                      <SelectTrigger className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">0%</SelectItem>
                        <SelectItem value="7">7%</SelectItem>
                        <SelectItem value="13">13%</SelectItem>
                        <SelectItem value="19">19%</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {(item.quantity * item.unit_price).toFixed(3)}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => removeItem(index)} className="text-red-500 hover:text-red-700">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {formData.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-400">
                    Cliquez sur "+ Ajouter un article" pour commencer.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Add Item Buttons */}
          <div className="flex gap-2 mt-4">
            <Button variant="outline" onClick={() => addItem()}>
              <Plus className="w-4 h-4 mr-2" />
              Ajouter un article
            </Button>
            <Button variant="outline">
              <QrCode className="w-4 h-4 mr-2" />
              Barcode & QRCode Scanner
            </Button>
          </div>

          {/* Description Editor */}
          <div className="mt-6">
            <Label className="text-sm text-gray-600">Description</Label>
            <div className="border rounded-lg mt-1">
              <div className="flex gap-1 p-2 border-b bg-gray-50">
                <Button variant="ghost" size="icon" className="w-8 h-8"><Bold className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" className="w-8 h-8"><Italic className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" className="w-8 h-8"><Link className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" className="w-8 h-8"><List className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" className="w-8 h-8"><AlignLeft className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" className="w-8 h-4"><Image className="w-4 h-4" /></Button>
              </div>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Description additionnelle..."
                className="border-0 focus:ring-0"
                rows={3}
              />
            </div>
          </div>

          {/* Discount */}
          <div className="mt-4 flex items-center gap-4">
            <Label className="text-sm text-gray-600">Remise</Label>
            <Input
              type="number"
              value={formData.discount_value}
              onChange={(e) => setFormData({ ...formData, discount_value: parseFloat(e.target.value) || 0 })}
              className="w-24"
              min="0"
              step="0.001"
            />
            <Select value={formData.discount_type} onValueChange={(v) => setFormData({ ...formData, discount_type: v })}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="amount">Montant</SelectItem>
                <SelectItem value="percent">Pourcentage</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Terms & Attachments */}
        <Card className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label className="text-sm text-gray-600">Conditions générales</Label>
              <Textarea
                value={formData.terms}
                onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
                placeholder="Conditions de vente..."
                className="mt-1"
                rows={4}
              />
            </div>
            <div>
              <Label className="text-sm text-gray-600">Pièces jointes</Label>
              <div className="mt-1 border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-violet-400 transition-colors">
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">Glissez ou cliquez pour ajouter des fichiers</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Remarques */}
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Remarques</h3>
          <Textarea
            value={formData.remarks}
            onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
            placeholder="Notes internes..."
            rows={3}
          />
        </Card>
      </div>

      {/* Right Sidebar */}
      <div className="w-80 space-y-4 overflow-y-auto pb-4">
        {/* Totals */}
        <Card className="p-4">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            Récapitulatif
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Sous total</span>
              <span>{totals.subtotal} TND</span>
            </div>
            {parseFloat(totals.totalDiscount) > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Remise</span>
                <span>-{totals.totalDiscount} TND</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-600">TVA</span>
              <span>{totals.taxAmount} TND</span>
            </div>
            {config.showFiscalStamp && formData.show_fiscal_stamp && (
              <div className="flex justify-between">
                <span className="text-gray-600">Timbre fiscal</span>
                <span>{totals.fiscalStamp} TND</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg pt-2 border-t">
              <span>Total</span>
              <span className="text-violet-600">{totals.total} TND</span>
            </div>
          </div>
        </Card>

        {/* Category */}
        <Card className="p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Tag className="w-4 h-4" />
            Catégorie
          </h3>
          <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="main">Activité principale</SelectItem>
              <SelectItem value="secondary">Activité secondaire</SelectItem>
            </SelectContent>
          </Select>
        </Card>

        {/* Content Options */}
        <Card className="p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Contenu
          </h3>
          
          <div className="space-y-3">
            <div>
              <Label className="text-sm text-gray-600">Filigrane</Label>
              <Input
                value={formData.watermark}
                onChange={(e) => setFormData({ ...formData, watermark: e.target.value })}
                placeholder="Ex: BROUILLON"
                className="mt-1"
              />
            </div>
            
            <div>
              <Label className="text-sm text-gray-600">Langue PDF</Label>
              <Select value={formData.pdf_language} onValueChange={(v) => setFormData({ ...formData, pdf_language: v })}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fr">Français</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ar">العربية</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 pt-2">
              {[
                { key: 'show_description', label: 'Description' },
                { key: 'show_unit', label: 'Unité' },
                { key: 'show_ttc_price', label: 'Prix TTC' },
                { key: 'show_photos', label: 'Photos' },
                { key: 'show_billing_address', label: 'Adresse facturation' },
                { key: 'show_shipping_address', label: 'Adresse livraison' },
                { key: 'show_terms', label: 'Conditions' },
                { key: 'show_bank_details', label: 'Détails bancaires' },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <Label className="text-sm">{label}</Label>
                  <Switch
                    checked={formData[key]}
                    onCheckedChange={(v) => setFormData({ ...formData, [key]: v })}
                  />
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Additional Entries */}
        {config.showFiscalStamp && (
          <Card className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Hash className="w-4 h-4" />
              Entrées supplémentaires
            </h3>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.show_fiscal_stamp}
                  onCheckedChange={(v) => setFormData({ ...formData, show_fiscal_stamp: v })}
                />
                <Label className="text-sm">Timbre fiscal</Label>
              </div>
              <Input
                type="number"
                value={formData.fiscal_stamp}
                onChange={(e) => setFormData({ ...formData, fiscal_stamp: parseFloat(e.target.value) || 0 })}
                className="w-20 text-right"
                step="0.001"
                disabled={!formData.show_fiscal_stamp}
              />
            </div>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="pt-4 border-t space-y-2">
          <Button className="w-full bg-violet-600 hover:bg-violet-700" onClick={() => handleSubmit('save')}>
            <Save className="w-4 h-4 mr-2" />
            Enregistrer
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => handleSubmit('send')}>
              <Send className="w-4 h-4 mr-2" />
              Envoyer
            </Button>
            <Button variant="outline">
              <Printer className="w-4 h-4 mr-2" />
              Imprimer
            </Button>
          </div>
          <Button variant="ghost" className="w-full" onClick={onCancel}>
            Annuler
          </Button>
        </div>
      </div>

      {/* Modal création nouveau produit depuis la ligne */}
      <ProductFormModal
        open={showNewProductModal}
        onClose={() => { setShowNewProductModal(false); setNewProductInitialName(''); setNewProductTargetRowIndex(null); }}
        product={{ name: newProductInitialName }}
        onSuccess={(createdProduct) => {
          // Recharger la liste des produits
          if (companyId) productsAPI.list(companyId).then(r => setProducts(r.data)).catch(() => {});
          // Remplir la ligne cible si elle existe
          if (newProductTargetRowIndex !== null && createdProduct) {
            const p = createdProduct;
            setFormData(prev => {
              const newItems = [...prev.items];
              if (newItems[newProductTargetRowIndex]) {
                newItems[newProductTargetRowIndex] = {
                  ...newItems[newProductTargetRowIndex],
                  product_id: p.id,
                  product_name: p.name,
                  description: p.description || '',
                  unit: p.unit || 'pièce',
                  unit_price: p.selling_price || p.unit_price || 0,
                  tax_rate: p.tax_rate || 19,
                  total: (newItems[newProductTargetRowIndex].quantity || 1) * (p.selling_price || p.unit_price || 0),
                };
              }
              return { ...prev, items: newItems };
            });
          }
          setShowNewProductModal(false);
          setNewProductInitialName('');
          setNewProductTargetRowIndex(null);
        }}
      />

      {/* CSV Import Modal */}
      <Dialog open={showCsvImport} onOpenChange={setShowCsvImport}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Importer des articles en masse (CSV)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
              <p className="font-medium mb-2">Format attendu :</p>
              <code className="block bg-white border rounded p-2 text-xs font-mono">
                nom,quantite,prix_unitaire,taxe,description<br/>
                Article A,2,100.000,19,Description optionnelle<br/>
                Article B,1,50.000,0,
              </code>
            </div>
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-violet-400 transition-colors"
              onClick={() => document.getElementById('csv-file-input').click()}
            >
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600">Cliquez pour sélectionner un fichier CSV</p>
              <p className="text-xs text-gray-400 mt-1">ou glissez-déposez ici</p>
              <input
                id="csv-file-input"
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    const lines = ev.target.result.split('\n').filter(l => l.trim());
                    const newItems = [];
                    lines.slice(1).forEach(line => {
                      const [name, qty, price, tax, desc] = line.split(',');
                      if (!name?.trim()) return;
                      newItems.push({
                        id: Date.now() + Math.random(),
                        product_id: null,
                        product_name: name.trim(),
                        description: desc?.trim() || '',
                        quantity: parseFloat(qty) || 1,
                        unit: 'pièce',
                        unit_price: parseFloat(price) || 0,
                        tax_rate: parseFloat(tax) || 19,
                        discount: 0,
                        total: (parseFloat(qty) || 1) * (parseFloat(price) || 0),
                      });
                    });
                    if (newItems.length > 0) {
                      setFormData(prev => ({ ...prev, items: [...prev.items, ...newItems] }));
                      setShowCsvImport(false);
                    }
                  };
                  reader.readAsText(file);
                  e.target.value = '';
                }}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SalesDocumentForm;
