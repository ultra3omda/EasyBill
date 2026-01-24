import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { customersAPI, productsAPI, invoicesAPI } from '../../services/api';
import { toast } from '../../hooks/use-toast';
import { useCompany } from '../../hooks/useCompany';
import { Plus, Trash2 } from 'lucide-react';

const InvoiceFormModal = ({ open, onClose, onSuccess, invoice }) => {
  const { currentCompany } = useCompany();
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const isEditing = !!invoice;
  
  const getInitialFormData = () => ({
    customer_id: '',
    date: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    subject: '',
    items: [{ description: '', quantity: 1, unit_price: 0, tax_rate: 19, discount: 0, total: 0 }],
    notes: ''
  });
  
  const [formData, setFormData] = useState(getInitialFormData());

  useEffect(() => {
    if (open && currentCompany) {
      loadCustomers();
      loadProducts();
      
      // If editing, populate form with invoice data
      if (invoice) {
        setFormData({
          customer_id: invoice.customer_id || '',
          date: invoice.date ? invoice.date.split('T')[0] : new Date().toISOString().split('T')[0],
          due_date: invoice.due_date ? invoice.due_date.split('T')[0] : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          subject: invoice.subject || '',
          items: invoice.items && invoice.items.length > 0 
            ? invoice.items.map(item => ({
                description: item.description || '',
                quantity: item.quantity || 1,
                unit_price: item.unit_price || 0,
                tax_rate: item.tax_rate || 19,
                discount: item.discount || 0,
                total: item.total || 0
              }))
            : [{ description: '', quantity: 1, unit_price: 0, tax_rate: 19, discount: 0, total: 0 }],
          notes: invoice.notes || ''
        });
      } else {
        setFormData(getInitialFormData());
      }
    }
  }, [open, currentCompany, invoice]);

  const loadCustomers = async () => {
    try {
      const response = await customersAPI.list(currentCompany.id);
      setCustomers(response.data);
    } catch (error) {
      console.error('Error loading customers:', error);
    }
  };

  const loadProducts = async () => {
    try {
      const response = await productsAPI.list(currentCompany.id);
      setProducts(response.data);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    
    // Recalculate total for this item
    const item = newItems[index];
    const subtotal = item.quantity * item.unit_price;
    const discountAmount = subtotal * (item.discount / 100);
    const afterDiscount = subtotal - discountAmount;
    const taxAmount = afterDiscount * (item.tax_rate / 100);
    item.total = afterDiscount + taxAmount;
    
    setFormData(prev => ({ ...prev, items: newItems }));
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { description: '', quantity: 1, unit_price: 0, tax_rate: 19, discount: 0, total: 0 }]
    }));
  };

  const removeItem = (index) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const selectProduct = (index, productId) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      handleItemChange(index, 'description', product.name);
      handleItemChange(index, 'unit_price', product.unit_price);
      handleItemChange(index, 'tax_rate', product.tax_rate);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentCompany) {
      toast({ title: 'Erreur', description: 'Aucune entreprise sélectionnée', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      await invoicesAPI.create(currentCompany.id, formData);
      toast({ title: 'Succès', description: 'Facture créée avec succès' });
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error creating invoice:', error);
      toast({ title: 'Erreur', description: error.response?.data?.detail || 'Erreur lors de la création', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const calculateTotal = () => {
    return formData.items.reduce((sum, item) => sum + item.total, 0);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouvelle facture</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="customer_id">Client *</Label>
              <Select value={formData.customer_id} onValueChange={(value) => handleChange('customer_id', value)} required>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un client" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map(customer => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="subject">Objet</Label>
              <Input
                id="subject"
                value={formData.subject}
                onChange={(e) => handleChange('subject', e.target.value)}
                placeholder="Objet de la facture"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => handleChange('date', e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="due_date">Date d'échéance *</Label>
              <Input
                id="due_date"
                type="date"
                value={formData.due_date}
                onChange={(e) => handleChange('due_date', e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Articles / Services</Label>
              <Button type="button" size="sm" onClick={addItem} className="bg-teal-600 hover:bg-teal-700">
                <Plus className="w-4 h-4 mr-1" /> Ajouter
              </Button>
            </div>
            
            <div className="space-y-3">
              {formData.items.map((item, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-3">
                  <div className="flex gap-2">
                    <Select onValueChange={(value) => selectProduct(index, value)}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Produit" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map(product => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                      className="flex-1"
                    />
                    {formData.items.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(index)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-5 gap-2">
                    <div>
                      <Label className="text-xs">Quantité</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Prix HT</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={item.unit_price}
                        onChange={(e) => handleItemChange(index, 'unit_price', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">TVA (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={item.tax_rate}
                        onChange={(e) => handleItemChange(index, 'tax_rate', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Remise (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={item.discount}
                        onChange={(e) => handleItemChange(index, 'discount', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Total TTC</Label>
                      <Input
                        type="number"
                        value={item.total.toFixed(2)}
                        disabled
                        className="bg-gray-100"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-right">
                <p className="text-sm text-gray-600">Total TTC</p>
                <p className="text-2xl font-bold text-teal-600">{calculateTotal().toFixed(2)} TND</p>
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading} className="bg-teal-600 hover:bg-teal-700">
              {loading ? 'Création...' : 'Créer la facture'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default InvoiceFormModal;
