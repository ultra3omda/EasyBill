import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../components/ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { suppliersAPI } from '../../services/api';
import { toast } from '../../hooks/use-toast';
import { useCompany } from '../../hooks/useCompany';

const SupplierFormModal = ({ open, onClose, onSuccess, supplier = null }) => {
  const { currentCompany } = useCompany();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    company_name: '',
    email: '',
    phone: '',
    mobile: '',
    fiscal_id: '',
    activity: '',
    address: {
      street: '',
      city: '',
      postal_code: '',
      country: 'Tunisia'
    },
    notes: ''
  });

  useEffect(() => {
    if (supplier) {
      setFormData({
        first_name: supplier.first_name || '',
        last_name: supplier.last_name || '',
        company_name: supplier.company_name || '',
        email: supplier.email || '',
        phone: supplier.phone || '',
        mobile: supplier.mobile || '',
        fiscal_id: supplier.fiscal_id || '',
        activity: supplier.activity || '',
        address: supplier.address || { street: '', city: '', postal_code: '', country: 'Tunisia' },
        notes: supplier.notes || ''
      });
    }
  }, [supplier]);

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
    if (!currentCompany) {
      toast({ title: 'Erreur', description: 'Aucune entreprise sélectionnée', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      if (supplier) {
        await suppliersAPI.update(currentCompany.id, supplier.id, formData);
        toast({ title: 'Succès', description: 'Fournisseur modifié avec succès' });
      } else {
        await suppliersAPI.create(currentCompany.id, formData);
        toast({ title: 'Succès', description: 'Fournisseur créé avec succès' });
      }
      
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving supplier:', error);
      toast({ title: 'Erreur', description: error.response?.data?.detail || 'Erreur lors de l\'enregistrement', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{supplier ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="first_name">Prénom *</Label>
              <Input
                id="first_name"
                value={formData.first_name}
                onChange={(e) => handleChange('first_name', e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="last_name">Nom</Label>
              <Input
                id="last_name"
                value={formData.last_name}
                onChange={(e) => handleChange('last_name', e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="company_name">Entreprise</Label>
            <Input
              id="company_name"
              value={formData.company_name}
              onChange={(e) => handleChange('company_name', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="phone">Téléphone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="fiscal_id">Matricule fiscal</Label>
              <Input
                id="fiscal_id"
                value={formData.fiscal_id}
                onChange={(e) => handleChange('fiscal_id', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="activity">Activité</Label>
              <Input
                id="activity"
                value={formData.activity}
                onChange={(e) => handleChange('activity', e.target.value)}
              />
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Adresse</h3>
            <div className="space-y-2">
              <Input
                placeholder="Rue"
                value={formData.address.street}
                onChange={(e) => handleChange('address.street', e.target.value)}
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Ville"
                  value={formData.address.city}
                  onChange={(e) => handleChange('address.city', e.target.value)}
                />
                <Input
                  placeholder="Code postal"
                  value={formData.address.postal_code}
                  onChange={(e) => handleChange('address.postal_code', e.target.value)}
                />
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Notes internes</Label>
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
              {loading ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default SupplierFormModal;