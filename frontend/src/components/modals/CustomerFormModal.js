import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Checkbox } from '../ui/checkbox';
import { customersAPI } from '../../services/api';
import { toast } from '../../hooks/use-toast';
import { useCompany } from '../../hooks/useCompany';
import { User, Building2, MapPin, Truck, Copy } from 'lucide-react';

// Tunisian Governorates
const GOVERNORATES = [
  'Tunis', 'Ariana', 'Ben Arous', 'Manouba', 'Nabeul', 'Zaghouan', 'Bizerte',
  'Béja', 'Jendouba', 'Le Kef', 'Siliana', 'Sousse', 'Monastir', 'Mahdia',
  'Sfax', 'Kairouan', 'Kasserine', 'Sidi Bouzid', 'Gabès', 'Medenine',
  'Tataouine', 'Gafsa', 'Tozeur', 'Kébili'
];

// Payment Terms
const PAYMENT_TERMS = [
  { value: 'immediate', label: 'Payable à réception' },
  { value: 'net15', label: 'Net 15 jours' },
  { value: 'net30', label: 'Net 30 jours' },
  { value: 'net45', label: 'Net 45 jours' },
  { value: 'net60', label: 'Net 60 jours' },
  { value: 'net90', label: 'Net 90 jours' },
  { value: 'end_of_month', label: 'Fin de mois' },
  { value: 'end_of_month_15', label: 'Fin de mois + 15 jours' }
];

// Currencies
const CURRENCIES = [
  { value: 'TND', label: 'Dinar(s) tunisien' },
  { value: 'EUR', label: 'Euro' },
  { value: 'USD', label: 'Dollar américain' },
  { value: 'GBP', label: 'Livre sterling' }
];

// Activity Types for Entreprise
const ACTIVITIES_ENTREPRISE = [
  'Agence ou société commerciale',
  'Industrie',
  'Services',
  'Commerce de gros',
  'Commerce de détail',
  'Import/Export',
  'Construction et BTP',
  'Transport et logistique',
  'Hôtellerie et restauration',
  'Technologies de l\'information',
  'Conseil et consulting',
  'Santé et pharmaceutique',
  'Agriculture et agroalimentaire',
  'Banques et assurances',
  'Immobilier',
  'Autre'
];

// Activity Types for Particulier
const ACTIVITIES_PARTICULIER = [
  'Salarié',
  'Fonctionnaire',
  'Profession libérale',
  'Artisan',
  'Commerçant',
  'Retraité',
  'Étudiant',
  'Sans emploi',
  'Autre'
];

// Titles
const TITLES = [
  { value: 'mr', label: 'Mr.' },
  { value: 'mme', label: 'Mme.' },
  { value: 'mlle', label: 'Mlle.' },
  { value: 'dr', label: 'Dr.' },
  { value: 'pr', label: 'Pr.' }
];

// Price Grids
const PRICE_GRIDS = [
  { value: 'default', label: 'Prix par défaut' },
  { value: 'vip', label: 'Tarif VIP' },
  { value: 'wholesale', label: 'Tarif grossiste' },
  { value: 'retail', label: 'Tarif détaillant' }
];

const CustomerFormModal = ({ open, onClose, onSuccess, customer = null }) => {
  const { currentCompany } = useCompany();
  const [loading, setLoading] = useState(false);
  const [clientType, setClientType] = useState('entreprise');
  const [formData, setFormData] = useState({
    title: 'mr',
    first_name: '',
    last_name: '',
    company_name: '',
    display_name: '',
    reference: '',
    email: '',
    phone: '',
    website: '',
    client_type: 'entreprise',
    fiscal_id: '',
    identity_number: '',
    activity: '',
    price_grid: 'default',
    currency: 'TND',
    payment_terms: 'immediate',
    birthday: '',
    billing_address: {
      street: '',
      governorate: '',
      postal_code: '',
      country: 'Tunisie'
    },
    shipping_address: {
      street: '',
      governorate: '',
      postal_code: '',
      country: 'Tunisie'
    },
    notes: ''
  });

  useEffect(() => {
    if (customer) {
      setClientType(customer.client_type || 'entreprise');
      setFormData({
        title: customer.title || 'mr',
        first_name: customer.first_name || '',
        last_name: customer.last_name || '',
        company_name: customer.company_name || '',
        display_name: customer.display_name || '',
        reference: customer.reference || '',
        email: customer.email || '',
        phone: customer.phone || '',
        website: customer.website || '',
        client_type: customer.client_type || 'entreprise',
        fiscal_id: customer.fiscal_id || '',
        identity_number: customer.identity_number || '',
        activity: customer.activity || '',
        price_grid: customer.price_grid || 'default',
        currency: customer.currency || 'TND',
        payment_terms: customer.payment_terms || 'immediate',
        birthday: customer.birthday || '',
        billing_address: customer.billing_address || { street: '', governorate: '', postal_code: '', country: 'Tunisie' },
        shipping_address: customer.shipping_address || { street: '', governorate: '', postal_code: '', country: 'Tunisie' },
        notes: customer.notes || ''
      });
    } else {
      resetForm();
    }
  }, [customer, open]);

  const resetForm = () => {
    setClientType('entreprise');
    setFormData({
      title: 'mr',
      first_name: '',
      last_name: '',
      company_name: '',
      display_name: '',
      reference: '',
      email: '',
      phone: '',
      website: '',
      client_type: 'entreprise',
      fiscal_id: '',
      identity_number: '',
      activity: '',
      price_grid: 'default',
      currency: 'TND',
      payment_terms: 'immediate',
      birthday: '',
      billing_address: { street: '', governorate: '', postal_code: '', country: 'Tunisie' },
      shipping_address: { street: '', governorate: '', postal_code: '', country: 'Tunisie' },
      notes: ''
    });
  };

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

  const handleClientTypeChange = (type) => {
    setClientType(type);
    setFormData(prev => ({ ...prev, client_type: type, activity: '' }));
  };

  const copyBillingToShipping = () => {
    setFormData(prev => ({
      ...prev,
      shipping_address: { ...prev.billing_address }
    }));
    toast({ title: 'Copié', description: 'Adresse de facturation copiée vers livraison' });
  };

  const copyShippingToBilling = () => {
    setFormData(prev => ({
      ...prev,
      billing_address: { ...prev.shipping_address }
    }));
    toast({ title: 'Copié', description: 'Adresse de livraison copiée vers facturation' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentCompany) {
      toast({ title: 'Erreur', description: 'Aucune entreprise sélectionnée', variant: 'destructive' });
      return;
    }

    if (!formData.first_name || !formData.display_name) {
      toast({ title: 'Erreur', description: 'Les champs Prénom et Nom affiché sont obligatoires', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const dataToSend = { ...formData, client_type: clientType };
      
      if (customer) {
        await customersAPI.update(currentCompany.id, customer.id, dataToSend);
        toast({ title: 'Succès', description: 'Client modifié avec succès' });
      } else {
        await customersAPI.create(currentCompany.id, dataToSend);
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="customer-form-modal">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {customer ? 'Modifier le client' : 'Nouveau client'}
          </DialogTitle>
          <p className="text-sm text-gray-500">Synthèse des clients • {currentCompany?.name || 'Mycompany'}</p>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Informations générales */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-4">
            <div className="flex items-center gap-2 text-gray-700 font-medium mb-3">
              <User className="w-4 h-4" />
              <span>Informations générales</span>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Titre</Label>
                <Select value={formData.title} onValueChange={(v) => handleChange('title', v)}>
                  <SelectTrigger data-testid="customer-title">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TITLES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prénom *</Label>
                <Input
                  value={formData.first_name}
                  onChange={(e) => handleChange('first_name', e.target.value)}
                  required
                  data-testid="customer-first-name"
                />
              </div>
              <div>
                <Label>Nom de famille</Label>
                <Input
                  value={formData.last_name}
                  onChange={(e) => handleChange('last_name', e.target.value)}
                  data-testid="customer-last-name"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Entreprise</Label>
                <Input
                  value={formData.company_name}
                  onChange={(e) => handleChange('company_name', e.target.value)}
                  placeholder="Nom de l'entreprise"
                  data-testid="customer-company-name"
                />
              </div>
              <div>
                <Label>Nom affiché *</Label>
                <Input
                  value={formData.display_name}
                  onChange={(e) => handleChange('display_name', e.target.value)}
                  required
                  data-testid="customer-display-name"
                />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div>
                <Label>Référence</Label>
                <Input
                  value={formData.reference}
                  onChange={(e) => handleChange('reference', e.target.value)}
                  data-testid="customer-reference"
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  data-testid="customer-email"
                />
              </div>
              <div>
                <Label>Téléphone</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  data-testid="customer-phone"
                />
              </div>
              <div>
                <Label>Site Internet</Label>
                <Input
                  value={formData.website}
                  onChange={(e) => handleChange('website', e.target.value)}
                  placeholder="www.exemple.com"
                  data-testid="customer-website"
                />
              </div>
            </div>
          </div>

          {/* Informations professionnelles */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-4">
            <div className="flex items-center gap-2 text-gray-700 font-medium mb-3">
              <Building2 className="w-4 h-4" />
              <span>Informations professionnelles</span>
            </div>

            {/* Type Selection */}
            <div className="mb-4">
              <Label className="mb-2 block">Type *</Label>
              <RadioGroup 
                value={clientType} 
                onValueChange={handleClientTypeChange}
                className="flex gap-6"
                data-testid="customer-type-radio"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="entreprise" id="entreprise" />
                  <Label htmlFor="entreprise" className="font-normal cursor-pointer flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-violet-600" />
                    Entreprise
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="particulier" id="particulier" />
                  <Label htmlFor="particulier" className="font-normal cursor-pointer flex items-center gap-2">
                    <User className="w-4 h-4 text-blue-600" />
                    Particulier
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {clientType === 'entreprise' ? (
                <div>
                  <Label>Numéro d'identification fiscale</Label>
                  <Input
                    value={formData.fiscal_id}
                    onChange={(e) => handleChange('fiscal_id', e.target.value)}
                    placeholder="0000000/A/A/000"
                    data-testid="customer-fiscal-id"
                  />
                </div>
              ) : (
                <div>
                  <Label>Numéro d'identité</Label>
                  <Input
                    value={formData.identity_number}
                    onChange={(e) => handleChange('identity_number', e.target.value)}
                    placeholder="CIN"
                    data-testid="customer-identity-number"
                  />
                </div>
              )}
              <div>
                <Label>Grille des Prix</Label>
                <Select value={formData.price_grid} onValueChange={(v) => handleChange('price_grid', v)}>
                  <SelectTrigger data-testid="customer-price-grid">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRICE_GRIDS.map(pg => (
                      <SelectItem key={pg.value} value={pg.value}>{pg.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {clientType === 'particulier' && (
                <div>
                  <Label>Anniversaire</Label>
                  <Input
                    type="date"
                    value={formData.birthday}
                    onChange={(e) => handleChange('birthday', e.target.value)}
                    data-testid="customer-birthday"
                  />
                </div>
              )}
              <div>
                <Label>Activité</Label>
                <Select value={formData.activity} onValueChange={(v) => handleChange('activity', v)}>
                  <SelectTrigger data-testid="customer-activity">
                    <SelectValue placeholder="Sélectionner une activité" />
                  </SelectTrigger>
                  <SelectContent>
                    {(clientType === 'entreprise' ? ACTIVITIES_ENTREPRISE : ACTIVITIES_PARTICULIER).map(act => (
                      <SelectItem key={act} value={act}>{act}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Devise</Label>
                <Select value={formData.currency} onValueChange={(v) => handleChange('currency', v)}>
                  <SelectTrigger data-testid="customer-currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Conditions de paiement</Label>
                <Select value={formData.payment_terms} onValueChange={(v) => handleChange('payment_terms', v)}>
                  <SelectTrigger data-testid="customer-payment-terms">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_TERMS.map(pt => (
                      <SelectItem key={pt.value} value={pt.value}>{pt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Addresses Section */}
          <div className="grid grid-cols-2 gap-4">
            {/* Billing Address */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-gray-700 font-medium">
                  <MapPin className="w-4 h-4" />
                  <span>Adresse de facturation</span>
                </div>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm"
                  onClick={copyShippingToBilling}
                  className="text-xs text-violet-600 hover:text-violet-700"
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copier l'adresse de livraison
                </Button>
              </div>
              
              <div>
                <Label>Adresse</Label>
                <Input
                  value={formData.billing_address.street}
                  onChange={(e) => handleChange('billing_address.street', e.target.value)}
                  placeholder="1, route de la liberté"
                  data-testid="customer-billing-street"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Gouvernorat</Label>
                  <Select 
                    value={formData.billing_address.governorate} 
                    onValueChange={(v) => handleChange('billing_address.governorate', v)}
                  >
                    <SelectTrigger data-testid="customer-billing-governorate">
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      {GOVERNORATES.map(g => (
                        <SelectItem key={g} value={g}>{g}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Code postal</Label>
                  <Input
                    value={formData.billing_address.postal_code}
                    onChange={(e) => handleChange('billing_address.postal_code', e.target.value)}
                    data-testid="customer-billing-postal"
                  />
                </div>
              </div>
              <div>
                <Label>Pays</Label>
                <Select 
                  value={formData.billing_address.country} 
                  onValueChange={(v) => handleChange('billing_address.country', v)}
                >
                  <SelectTrigger data-testid="customer-billing-country">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Tunisie">Tunisie</SelectItem>
                    <SelectItem value="France">France</SelectItem>
                    <SelectItem value="Algérie">Algérie</SelectItem>
                    <SelectItem value="Maroc">Maroc</SelectItem>
                    <SelectItem value="Libye">Libye</SelectItem>
                    <SelectItem value="Autre">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Shipping Address */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-gray-700 font-medium">
                  <Truck className="w-4 h-4" />
                  <span>Adresse de livraison</span>
                </div>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm"
                  onClick={copyBillingToShipping}
                  className="text-xs text-violet-600 hover:text-violet-700"
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copier l'adresse de facturation
                </Button>
              </div>
              
              <div>
                <Label>Adresse</Label>
                <Input
                  value={formData.shipping_address.street}
                  onChange={(e) => handleChange('shipping_address.street', e.target.value)}
                  placeholder="1, route de la liberté"
                  data-testid="customer-shipping-street"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Gouvernorat</Label>
                  <Select 
                    value={formData.shipping_address.governorate} 
                    onValueChange={(v) => handleChange('shipping_address.governorate', v)}
                  >
                    <SelectTrigger data-testid="customer-shipping-governorate">
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      {GOVERNORATES.map(g => (
                        <SelectItem key={g} value={g}>{g}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Code postal</Label>
                  <Input
                    value={formData.shipping_address.postal_code}
                    onChange={(e) => handleChange('shipping_address.postal_code', e.target.value)}
                    data-testid="customer-shipping-postal"
                  />
                </div>
              </div>
              <div>
                <Label>Pays</Label>
                <Select 
                  value={formData.shipping_address.country} 
                  onValueChange={(v) => handleChange('shipping_address.country', v)}
                >
                  <SelectTrigger data-testid="customer-shipping-country">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Tunisie">Tunisie</SelectItem>
                    <SelectItem value="France">France</SelectItem>
                    <SelectItem value="Algérie">Algérie</SelectItem>
                    <SelectItem value="Maroc">Maroc</SelectItem>
                    <SelectItem value="Libye">Libye</SelectItem>
                    <SelectItem value="Autre">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button 
              type="submit" 
              disabled={loading} 
              className="bg-violet-600 hover:bg-violet-700"
              data-testid="customer-submit-btn"
            >
              {loading ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CustomerFormModal;
