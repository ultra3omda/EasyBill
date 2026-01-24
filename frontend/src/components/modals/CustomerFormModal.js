import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { customersAPI } from '../../services/api';
import { toast } from '../../hooks/use-toast';
import { useCompany } from '../../hooks/useCompany';

const CustomerFormModal = ({ open, onClose, onSuccess, customer = null }) => {
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
    billing_address: {
      street: '',
      city: '',
      postal_code: '',
      country: 'Tunisia'
    },
    notes: ''
  });

  useEffect(() => {
    if (customer) {
      setFormData({
        first_name: customer.first_name || '',
        last_name: customer.last_name || '',
        company_name: customer.company_name || '',
        email: customer.email || '',
        phone: customer.phone || '',
        mobile: customer.mobile || '',
        fiscal_id: customer.fiscal_id || '',
        activity: customer.activity || '',
        billing_address: customer.billing_address || { street: '', city: '', postal_code: '', country: 'Tunisia' },
        notes: customer.notes || ''
      });
    }
  }, [customer]);

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
      if (customer) {
        await customersAPI.update(currentCompany.id, customer.id, formData);
        toast({ title: 'Succès', description: 'Client modifié avec succès' });
      } else {
        await customersAPI.create(currentCompany.id, formData);
        toast({ title: 'Succès', description: 'Client créé avec succès' });
      }
      
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving customer:', error);
      toast({ title: 'Erreur', description: error.response?.data?.detail || 'Erreur lors de l\'enregistrement', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{customer ? 'Modifier le client' : 'Nouveau client'}</DialogTitle>
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
            <h3 className="font-semibold mb-2">Adresse de facturation</h3>
            <div className="space-y-2">
              <Input
                placeholder="Rue"
                value={formData.billing_address.street}
                onChange={(e) => handleChange('billing_address.street', e.target.value)}
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Ville"
                  value={formData.billing_address.city}
                  onChange={(e) => handleChange('billing_address.city', e.target.value)}
                />
                <Input
                  placeholder="Code postal"
                  value={formData.billing_address.postal_code}
                  onChange={(e) => handleChange('billing_address.postal_code', e.target.value)}
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

export default CustomerFormModal;