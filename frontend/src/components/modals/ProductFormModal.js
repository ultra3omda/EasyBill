import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { productsAPI } from '../../services/api';
import { toast } from '../../hooks/use-toast';
import { useCompany } from '../../hooks/useCompany';

const ProductFormModal = ({ open, onClose, onSuccess, product = null }) => {
  const { currentCompany } = useCompany();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    description: '',
    category: '',
    type: 'product',
    unit_price: '',
    tax_rate: '19',
    unit: 'Unité',
    stock_quantity: '',
  });

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || '',
        sku: product.sku || '',
        description: product.description || '',
        category: product.category || '',
        type: product.type || 'product',
        unit_price: product.unit_price || '',
        tax_rate: product.tax_rate || '19',
        unit: product.unit || 'Unité',
        stock_quantity: product.stock_quantity || '',
      });
    }
  }, [product]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentCompany) {
      toast({ title: 'Erreur', description: 'Aucune entreprise sélectionnée', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const data = {
        ...formData,
        unit_price: parseFloat(formData.unit_price),
        tax_rate: parseFloat(formData.tax_rate),
        stock_quantity: formData.type === 'product' ? parseInt(formData.stock_quantity) : null,
      };

      if (product) {
        await productsAPI.update(currentCompany.id, product.id, data);
        toast({ title: 'Succès', description: 'Produit modifié avec succès' });
      } else {
        await productsAPI.create(currentCompany.id, data);
        toast({ title: 'Succès', description: 'Produit créé avec succès' });
      }
      
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving product:', error);
      toast({ title: 'Erreur', description: error.response?.data?.detail || 'Erreur lors de l\'enregistrement', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? 'Modifier le produit' : 'Nouveau produit'}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Nom du produit *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="sku">SKU / Référence</Label>
              <Input
                id="sku"
                value={formData.sku}
                onChange={(e) => handleChange('sku', e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="category">Catégorie</Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) => handleChange('category', e.target.value)}
                placeholder="Services, Produits, etc."
              />
            </div>
            <div>
              <Label htmlFor="type">Type *</Label>
              <Select value={formData.type} onValueChange={(value) => handleChange('type', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="product">Produit</SelectItem>
                  <SelectItem value="service">Service</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="unit_price">Prix unitaire HT *</Label>
              <Input
                id="unit_price"
                type="number"
                step="0.01"
                value={formData.unit_price}
                onChange={(e) => handleChange('unit_price', e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="tax_rate">TVA (%)</Label>
              <Input
                id="tax_rate"
                type="number"
                step="0.01"
                value={formData.tax_rate}
                onChange={(e) => handleChange('tax_rate', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="unit">Unité</Label>
              <Input
                id="unit"
                value={formData.unit}
                onChange={(e) => handleChange('unit', e.target.value)}
              />
            </div>
          </div>

          {formData.type === 'product' && (
            <div>
              <Label htmlFor="stock_quantity">Quantité en stock</Label>
              <Input
                id="stock_quantity"
                type="number"
                value={formData.stock_quantity}
                onChange={(e) => handleChange('stock_quantity', e.target.value)}
              />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading} className="bg-teal-600 hover:bg-teal-700">
              {loading ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ProductFormModal;