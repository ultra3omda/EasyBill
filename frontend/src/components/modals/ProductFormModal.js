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
import { Package, Calculator } from 'lucide-react';

const UNITS = [
  { value: 'pièce', label: 'Pièce' },
  { value: 'kg', label: 'Kilogramme (kg)' },
  { value: 'g', label: 'Gramme (g)' },
  { value: 'l', label: 'Litre (l)' },
  { value: 'heure', label: 'Heure' },
  { value: 'jour', label: 'Jour' },
  { value: 'm', label: 'Mètre (m)' },
  { value: 'm²', label: 'Mètre carré' },
  { value: 'carton', label: 'Carton' },
];

const CATEGORIES = [
  'Informatique', 'Électronique', 'Mobilier', 'Fournitures de bureau',
  'Équipement industriel', 'Matières premières', 'Produits alimentaires',
  'Textile', 'Cosmétique', 'Autre'
];

const TAX_RATES = [
  { value: 19, label: 'TVA 19%' },
  { value: 13, label: 'TVA 13%' },
  { value: 7, label: 'TVA 7%' },
  { value: 0, label: 'Exonéré 0%' },
];

const DEFAULT_FORM = {
  name: '',
  reference: '',
  description: '',
  article_type: 'product',
  selling_price: '',
  purchase_price: '',
  tax_rate: 19,
  unit: 'pièce',
  category: '',
  quantity_in_stock: 0,
};

const ProductFormModal = ({ open, onClose, onSuccess, product = null }) => {
  const { currentCompany } = useCompany();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(DEFAULT_FORM);

  useEffect(() => {
    if (open) {
      if (product?.id) {
        setFormData({
          name: product.name || '',
          reference: product.sku || product.reference || '',
          description: product.description || '',
          article_type: product.type === 'service' ? 'service' : 'product',
          selling_price: product.selling_price?.toString() || product.unit_price?.toString() || '',
          purchase_price: product.purchase_price?.toString() || '',
          tax_rate: product.tax_rate ?? 19,
          unit: product.unit || 'pièce',
          category: product.category || '',
          quantity_in_stock: product.quantity_in_stock || 0,
        });
      } else {
        setFormData({ ...DEFAULT_FORM, name: product?.name || '' });
      }
    }
  }, [product, open]);

  const handleChange = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentCompany) return;
    if (!formData.name.trim()) {
      toast({ title: 'Champ requis', description: 'Le nom de l\'article est obligatoire', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const data = {
        name: formData.name.trim(),
        sku: formData.reference || undefined,
        description: formData.description || undefined,
        type: formData.article_type,
        selling_price: parseFloat(formData.selling_price) || 0,
        purchase_price: parseFloat(formData.purchase_price) || 0,
        tax_rate: parseFloat(formData.tax_rate),
        unit: formData.unit,
        category: formData.category || undefined,
        quantity_in_stock: formData.article_type === 'product' ? parseInt(formData.quantity_in_stock) || 0 : 0,
      };

      if (product?.id) {
        const res = await productsAPI.update(currentCompany.id, product.id, data);
        toast({ title: 'Succès', description: 'Article modifié avec succès' });
        onSuccess(res.data);
      } else {
        const res = await productsAPI.create(currentCompany.id, data);
        toast({ title: 'Succès', description: 'Article créé avec succès' });
        onSuccess(res.data);
      }
      onClose();
    } catch (error) {
      toast({ title: 'Erreur', description: error.response?.data?.detail || 'Erreur lors de l\'enregistrement', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product?.id ? 'Modifier l\'article' : 'Nouvel article'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Type — choix visuel */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleChange('article_type', 'product')}
              className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                formData.article_type === 'product'
                  ? 'border-violet-500 bg-violet-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className={`p-2 rounded-lg ${formData.article_type === 'product' ? 'bg-violet-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                <Package className="w-5 h-5" />
              </div>
              <div>
                <p className="font-medium text-sm">Produit</p>
                <p className="text-xs text-gray-400">Article physique avec stock</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => handleChange('article_type', 'service')}
              className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                formData.article_type === 'service'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className={`p-2 rounded-lg ${formData.article_type === 'service' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                <Calculator className="w-5 h-5" />
              </div>
              <div>
                <p className="font-medium text-sm">Service</p>
                <p className="text-xs text-gray-400">Prestation, sans stock</p>
              </div>
            </button>
          </div>

          {/* Nom + Référence */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Nom *</Label>
              <Input
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Nom de l'article"
                className="mt-1"
                autoFocus
                required
              />
            </div>
            <div>
              <Label>Référence / SKU</Label>
              <Input
                value={formData.reference}
                onChange={(e) => handleChange('reference', e.target.value)}
                placeholder="REF-001"
                className="mt-1"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Description de l'article..."
              rows={2}
              className="mt-1"
            />
          </div>

          {/* Prix */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Prix de vente HT</Label>
              <Input
                type="number"
                value={formData.selling_price}
                onChange={(e) => handleChange('selling_price', e.target.value)}
                placeholder="0.000"
                step="0.001"
                min="0"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Prix d'achat HT</Label>
              <Input
                type="number"
                value={formData.purchase_price}
                onChange={(e) => handleChange('purchase_price', e.target.value)}
                placeholder="0.000"
                step="0.001"
                min="0"
                className="mt-1"
              />
            </div>
          </div>

          {/* Taxe + Unité + Catégorie */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Taxe</Label>
              <Select value={formData.tax_rate.toString()} onValueChange={(v) => handleChange('tax_rate', parseFloat(v))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TAX_RATES.map(t => <SelectItem key={t.value} value={t.value.toString()}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Unité</Label>
              <Select value={formData.unit} onValueChange={(v) => handleChange('unit', v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNITS.map(u => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Catégorie</Label>
              <Select value={formData.category} onValueChange={(v) => handleChange('category', v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Stock (produit uniquement) */}
          {formData.article_type === 'product' && (
            <div>
              <Label>Stock initial</Label>
              <Input
                type="number"
                value={formData.quantity_in_stock}
                onChange={(e) => handleChange('quantity_in_stock', e.target.value)}
                placeholder="0"
                min="0"
                className="mt-1 w-40"
              />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={loading} className="bg-violet-600 hover:bg-violet-700">
              {loading ? 'Enregistrement...' : product?.id ? 'Modifier' : 'Créer l\'article'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ProductFormModal;
