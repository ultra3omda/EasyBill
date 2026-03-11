import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { customersAPI, productsAPI, quotesAPI } from '../../services/api';
import { toast } from '../../hooks/use-toast';
import { useCompany } from '../../hooks/useCompany';
import { Plus, Trash2 } from 'lucide-react';

const QuoteFormModal = ({ open, onClose, onSuccess, quote }) => {
  const { currentCompany } = useCompany();
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const isEditing = !!quote;
  
  const getInitialFormData = () => ({
    customer_id: '',
    date: new Date().toISOString().split('T')[0],
    valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    subject: '',
    items: [{ description: '', quantity: 1, unit_price: 0, tax_rate: 19, discount: 0, total: 0 }],
    notes: ''
  });
  
  const [formData, setFormData] = useState(getInitialFormData());

  useEffect(() => {
    if (open && currentCompany) {
      loadCustomers();
      loadProducts();
      
      // If editing, populate form with quote data
      if (quote) {
        setFormData({
          customer_id: quote.customer_id || '',
          date: quote.date ? quote.date.split('T')[0] : new Date().toISOString().split('T')[0],
          valid_until: quote.valid_until ? quote.valid_until.split('T')[0] : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          subject: quote.subject || '',
          items: quote.items && quote.items.length > 0 
            ? quote.items.map(item => ({
                description: item.description || '',
                quantity: item.quantity || 1,
                unit_price: item.unit_price || 0,
                tax_rate: item.tax_rate || 19,
                discount: item.discount || 0,
                total: item.total || 0
              }))
            : [{ description: '', quantity: 1, unit_price: 0, tax_rate: 19, discount: 0, total: 0 }],
          notes: quote.notes || ''
        });
      } else {
        setFormData(getInitialFormData());
      }
    }
  }, [open, currentCompany, quote]);

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
      const newItems = [...formData.items];
      newItems[index] = {
        ...newItems[index],
        description: product.name,
        unit_price: product.selling_price || 0,
        tax_rate: product.tax_rate || 19
      };
      // Recalculate total
      const item = newItems[index];
      const subtotal = item.quantity * item.unit_price;
      const discountAmount = subtotal * (item.discount / 100);
      const afterDiscount = subtotal - discountAmount;
      const taxAmount = afterDiscount * (item.tax_rate / 100);
      item.total = afterDiscount + taxAmount;
      
      setFormData(prev => ({ ...prev, items: newItems }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentCompany) {
      toast({ title: 'Erreur', description: 'Aucune entreprise sélectionnée', variant: 'destructive' });
      return;
    }

    if (!formData.customer_id) {
      toast({ title: 'Erreur', description: 'Veuillez sélectionner un client', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      if (isEditing) {
        await quotesAPI.update(currentCompany.id, quote.id, formData);
        toast({ title: 'Succès', description: 'Devis modifié avec succès' });
      } else {
        await quotesAPI.create(currentCompany.id, formData);
        toast({ title: 'Succès', description: 'Devis créé avec succès' });
      }
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving quote:', error);
      toast({ title: 'Erreur', description: error.response?.data?.detail || 'Erreur lors de l\'enregistrement', variant: 'destructive' });
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
          <DialogTitle>{isEditing ? 'Modifier le devis' : 'Nouveau devis'}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="customer_id">Client *</Label>
              <Select value={formData.customer_id} onValueChange={(value) => handleChange('customer_id', value)}>
                <SelectTrigger data-testid="quote-customer-select">
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
                placeholder="Objet du devis"
                data-testid="quote-subject"
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
                data-testid="quote-date"
              />
            </div>
            <div>
              <Label htmlFor="valid_until">Valable jusqu'au *</Label>
              <Input
                id="valid_until"
                type="date"
                value={formData.valid_until}
                onChange={(e) => handleChange('valid_until', e.target.value)}
                required
                data-testid="quote-valid-until"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Articles / Services</Label>
              <Button type="button" size="sm" onClick={addItem} className="bg-violet-600 hover:bg-violet-700">
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
                        value={item.total.toFixed(3)}
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
                <p className="text-2xl font-bold text-violet-600">{calculateTotal().toFixed(3)} TND</p>
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
              data-testid="quote-notes"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading} className="bg-violet-600 hover:bg-violet-700" data-testid="quote-submit">
              {loading ? 'Enregistrement...' : (isEditing ? 'Modifier' : 'Créer le devis')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default QuoteFormModal;
