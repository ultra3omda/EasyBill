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
import { User, Building2, MapPin, Truck, ChevronRight, ChevronLeft, Check } from 'lucide-react';

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
  { value: 'end_of_month', label: 'Fin de mois' }
];

// Currencies
const CURRENCIES = [
  { value: 'TND', label: 'Dinar(s) tunisien' },
  { value: 'EUR', label: 'Euro' },
  { value: 'USD', label: 'Dollar américain' },
  { value: 'GBP', label: 'Livre sterling' }
];

// Activity Types
const ACTIVITIES_ENTREPRISE = [
  'Agence ou société commerciale', 'Industrie', 'Services', 'Commerce de gros',
  'Commerce de détail', 'Import/Export', 'Construction et BTP', 'Transport et logistique',
  'Technologies de l\'information', 'Conseil et consulting', 'Santé et pharmaceutique',
  'Agriculture et agroalimentaire', 'Banques et assurances', 'Immobilier', 'Autre'
];

const ACTIVITIES_PARTICULIER = [
  'Salarié', 'Fonctionnaire', 'Profession libérale', 'Artisan',
  'Commerçant', 'Retraité', 'Étudiant', 'Sans emploi', 'Autre'
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

const STEPS = [
  { id: 1, title: 'Type & Entreprise', icon: Building2 },
  { id: 2, title: 'Informations', icon: User },
  { id: 3, title: 'Adresse facturation', icon: MapPin },
  { id: 4, title: 'Adresse livraison', icon: Truck }
];

const CustomerFormModal = ({ open, onClose, onSuccess, customer = null }) => {
  const { currentCompany } = useCompany();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [sameAddress, setSameAddress] = useState(true);
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
    }
  });

  useEffect(() => {
    if (open) {
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
          shipping_address: customer.shipping_address || { street: '', governorate: '', postal_code: '', country: 'Tunisie' }
        });
        // Check if addresses are the same
        const billing = customer.billing_address || {};
        const shipping = customer.shipping_address || {};
        setSameAddress(
          billing.street === shipping.street &&
          billing.governorate === shipping.governorate &&
          billing.postal_code === shipping.postal_code
        );
      } else {
        resetForm();
      }
      setCurrentStep(1);
    }
  }, [customer, open]);

  const resetForm = () => {
    setClientType('entreprise');
    setSameAddress(true);
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
      shipping_address: { street: '', governorate: '', postal_code: '', country: 'Tunisie' }
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

  // Auto-generate display name
  const generateDisplayName = () => {
    if (clientType === 'entreprise' && formData.company_name) {
      return formData.company_name;
    } else if (formData.last_name && formData.first_name) {
      return `${formData.last_name}, ${formData.first_name}`;
    } else if (formData.first_name) {
      return formData.first_name;
    }
    return '';
  };

  const validateStep = (step) => {
    switch(step) {
      case 1:
        if (clientType === 'entreprise') {
          return formData.company_name?.trim() !== '';
        } else {
          // Particulier: require first_name
          return formData.first_name?.trim() !== '';
        }
      case 2:
        return true; // Optional fields in step 2
      case 3:
        return true; // Address is optional
      case 4:
        return true;
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (!validateStep(currentStep)) {
      toast({ 
        title: 'Champs requis', 
        description: clientType === 'entreprise' ? 'Veuillez saisir le nom de l\'entreprise' : 'Veuillez saisir le prénom',
        variant: 'destructive' 
      });
      return;
    }
    
    if (currentStep === 3 && sameAddress) {
      // Skip step 4 if same address
      handleSubmit();
    } else if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    } else {
      handleSubmit();
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    if (!currentCompany) {
      toast({ title: 'Erreur', description: 'Aucune entreprise sélectionnée', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const displayName = formData.display_name || generateDisplayName();
      let first_name = formData.first_name?.trim();
      if (!first_name && clientType === 'entreprise' && formData.company_name?.trim()) {
        first_name = formData.company_name.trim();
      }
      if (!first_name) {
        first_name = 'Client';
      }
      const billingAddr = { ...formData.billing_address };
      if (billingAddr.governorate && !billingAddr.city) {
        billingAddr.city = billingAddr.governorate;
      }
      const billing = { street: billingAddr.street || null, city: billingAddr.city || billingAddr.governorate || null, postal_code: billingAddr.postal_code || null, country: billingAddr.country || 'Tunisie' };
      const shipping = sameAddress ? billing : { street: formData.shipping_address.street || null, city: formData.shipping_address.city || formData.shipping_address.governorate || null, postal_code: formData.shipping_address.postal_code || null, country: formData.shipping_address.country || 'Tunisie' };
      const dataToSend = { 
        ...formData, 
        first_name,
        client_type: clientType,
        display_name: displayName,
        billing_address: billing,
        shipping_address: shipping,
        email: formData.email?.trim() || undefined,
        phone: formData.phone?.trim() || undefined,
        website: formData.website?.trim() || undefined,
        notes: formData.notes?.trim() || undefined,
        reference: formData.reference?.trim() || undefined,
        fiscal_id: formData.fiscal_id?.trim() || undefined,
        identity_number: formData.identity_number?.trim() || undefined,
        activity: formData.activity?.trim() || undefined,
        birthday: formData.birthday?.trim() || undefined
      };
      Object.keys(dataToSend).forEach(k => {
        if (dataToSend[k] === '' || dataToSend[k] === null) delete dataToSend[k];
      });
      
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
      const detail = error.response?.data?.detail;
      const msg = Array.isArray(detail) ? detail.map(e => e.msg || `${e.loc?.join('.')}: ${e.msg}`).join('; ') : (typeof detail === 'string' ? detail : JSON.stringify(detail) || 'Erreur lors de l\'enregistrement');
      toast({ title: 'Erreur', description: msg || 'Erreur lors de l\'enregistrement', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Stepper component
  const Stepper = () => (
    <div className="flex items-center justify-between mb-6 px-2">
      {STEPS.map((step, index) => {
        // Skip step 4 in display if sameAddress
        if (step.id === 4 && sameAddress && currentStep <= 3) return null;
        
        const isActive = currentStep === step.id;
        const isCompleted = currentStep > step.id;
        const Icon = step.icon;
        
        return (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                isCompleted ? 'bg-green-500 text-white' :
                isActive ? 'bg-violet-600 text-white' : 
                'bg-gray-200 text-gray-500'
              }`}>
                {isCompleted ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
              </div>
              <span className={`text-xs mt-1 text-center max-w-[80px] ${
                isActive ? 'text-violet-600 font-medium' : 'text-gray-500'
              }`}>
                {step.title}
              </span>
            </div>
            {index < STEPS.length - 1 && !(step.id === 3 && sameAddress) && (
              <div className={`flex-1 h-0.5 mx-2 ${
                currentStep > step.id ? 'bg-green-500' : 'bg-gray-200'
              }`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );

  // Step 1: Type & Company
  const Step1 = () => (
    <div className="space-y-6">
      <div className="text-center mb-4">
        <h3 className="text-lg font-medium text-gray-900">Type de client</h3>
        <p className="text-sm text-gray-500">Sélectionnez le type et renseignez les informations professionnelles</p>
      </div>

      <RadioGroup 
        value={clientType} 
        onValueChange={handleClientTypeChange}
        className="grid grid-cols-2 gap-4"
        data-testid="customer-type-radio"
      >
        <div className={`relative flex items-center p-4 border-2 rounded-lg cursor-pointer transition-all ${
          clientType === 'entreprise' ? 'border-violet-500 bg-violet-50' : 'border-gray-200 hover:border-gray-300'
        }`}>
          <RadioGroupItem value="entreprise" id="entreprise" className="sr-only" />
          <Label htmlFor="entreprise" className="flex items-center gap-3 cursor-pointer w-full">
            <div className={`p-2 rounded-lg ${clientType === 'entreprise' ? 'bg-violet-500 text-white' : 'bg-gray-100'}`}>
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <p className="font-medium">Entreprise</p>
              <p className="text-xs text-gray-500">Société, SARL, SA...</p>
            </div>
          </Label>
        </div>
        
        <div className={`relative flex items-center p-4 border-2 rounded-lg cursor-pointer transition-all ${
          clientType === 'particulier' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
        }`}>
          <RadioGroupItem value="particulier" id="particulier" className="sr-only" />
          <Label htmlFor="particulier" className="flex items-center gap-3 cursor-pointer w-full">
            <div className={`p-2 rounded-lg ${clientType === 'particulier' ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}>
              <User className="w-6 h-6" />
            </div>
            <div>
              <p className="font-medium">Particulier</p>
              <p className="text-xs text-gray-500">Personne physique</p>
            </div>
          </Label>
        </div>
      </RadioGroup>

      {clientType === 'entreprise' ? (
        <div className="space-y-4 pt-4 border-t">
          <div>
            <Label>Nom de l'entreprise *</Label>
            <Input
              value={formData.company_name}
              onChange={(e) => handleChange('company_name', e.target.value)}
              placeholder="Ex: Tech Solutions SARL"
              className="mt-1"
              data-testid="customer-company-name"
            />
          </div>
          <div>
            <Label>Numéro d'identification fiscale</Label>
            <Input
              value={formData.fiscal_id}
              onChange={(e) => handleChange('fiscal_id', e.target.value)}
              placeholder="0000000/A/A/000"
              className="mt-1"
              data-testid="customer-fiscal-id"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-4 pt-4 border-t">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Prénom *</Label>
              <Input
                value={formData.first_name}
                onChange={(e) => handleChange('first_name', e.target.value)}
                placeholder="Prénom"
                className="mt-1"
                data-testid="customer-first-name-step1"
              />
            </div>
            <div>
              <Label>Nom de famille</Label>
              <Input
                value={formData.last_name}
                onChange={(e) => handleChange('last_name', e.target.value)}
                placeholder="Nom"
                className="mt-1"
                data-testid="customer-last-name-step1"
              />
            </div>
          </div>
          <div>
            <Label>Numéro d'identité (CIN)</Label>
            <Input
              value={formData.identity_number}
              onChange={(e) => handleChange('identity_number', e.target.value)}
              placeholder="00000000"
              className="mt-1"
              data-testid="customer-identity-number"
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Activité</Label>
          <Select value={formData.activity} onValueChange={(v) => handleChange('activity', v)}>
            <SelectTrigger className="mt-1" data-testid="customer-activity">
              <SelectValue placeholder="Sélectionner" />
            </SelectTrigger>
            <SelectContent>
              {(clientType === 'entreprise' ? ACTIVITIES_ENTREPRISE : ACTIVITIES_PARTICULIER).map(act => (
                <SelectItem key={act} value={act}>{act}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Grille des Prix</Label>
          <Select value={formData.price_grid} onValueChange={(v) => handleChange('price_grid', v)}>
            <SelectTrigger className="mt-1" data-testid="customer-price-grid">
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
        <div>
          <Label>Devise</Label>
          <Select value={formData.currency} onValueChange={(v) => handleChange('currency', v)}>
            <SelectTrigger className="mt-1" data-testid="customer-currency">
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
            <SelectTrigger className="mt-1" data-testid="customer-payment-terms">
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
  );

  // Step 2: General Information
  const Step2 = () => (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h3 className="text-lg font-medium text-gray-900">Informations générales</h3>
        <p className="text-sm text-gray-500">Coordonnées du contact</p>
      </div>

      {/* Show name fields only for Entreprise (already filled for Particulier in step 1) */}
      {clientType === 'entreprise' ? (
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label>Titre</Label>
            <Select value={formData.title} onValueChange={(v) => handleChange('title', v)}>
              <SelectTrigger className="mt-1" data-testid="customer-title">
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
              className="mt-1"
              data-testid="customer-first-name"
            />
          </div>
          <div>
            <Label>Nom de famille</Label>
            <Input
              value={formData.last_name}
              onChange={(e) => handleChange('last_name', e.target.value)}
              className="mt-1"
              data-testid="customer-last-name"
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Titre</Label>
            <Select value={formData.title} onValueChange={(v) => handleChange('title', v)}>
              <SelectTrigger className="mt-1" data-testid="customer-title">
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
            <Label>Date de naissance</Label>
            <Input
              type="date"
              value={formData.birthday}
              onChange={(e) => handleChange('birthday', e.target.value)}
              className="mt-1"
              data-testid="customer-birthday"
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Email</Label>
          <Input
            type="email"
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            placeholder="email@exemple.com"
            className="mt-1"
            data-testid="customer-email"
          />
        </div>
        <div>
          <Label>Téléphone</Label>
          <Input
            value={formData.phone}
            onChange={(e) => handleChange('phone', e.target.value)}
            placeholder="+216 XX XXX XXX"
            className="mt-1"
            data-testid="customer-phone"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Référence</Label>
          <Input
            value={formData.reference}
            onChange={(e) => handleChange('reference', e.target.value)}
            placeholder="REF-001"
            className="mt-1"
            data-testid="customer-reference"
          />
        </div>
        <div>
          <Label>Site Internet</Label>
          <Input
            value={formData.website}
            onChange={(e) => handleChange('website', e.target.value)}
            placeholder="www.exemple.com"
            className="mt-1"
            data-testid="customer-website"
          />
        </div>
      </div>

      <div>
        <Label>Nom affiché</Label>
        <Input
          value={formData.display_name || generateDisplayName()}
          onChange={(e) => handleChange('display_name', e.target.value)}
          placeholder="Généré automatiquement"
          className="mt-1"
          data-testid="customer-display-name"
        />
        <p className="text-xs text-gray-500 mt-1">Laissez vide pour générer automatiquement</p>
      </div>
    </div>
  );

  // Step 3: Billing Address
  const Step3 = () => (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h3 className="text-lg font-medium text-gray-900">Adresse de facturation</h3>
        <p className="text-sm text-gray-500">Adresse principale du client</p>
      </div>

      <div>
        <Label>Adresse</Label>
        <Input
          value={formData.billing_address.street}
          onChange={(e) => handleChange('billing_address.street', e.target.value)}
          placeholder="Rue, avenue, boulevard..."
          className="mt-1"
          data-testid="customer-billing-street"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Gouvernorat</Label>
          <Select 
            value={formData.billing_address.governorate} 
            onValueChange={(v) => handleChange('billing_address.governorate', v)}
          >
            <SelectTrigger className="mt-1" data-testid="customer-billing-governorate">
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
            placeholder="1000"
            className="mt-1"
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
          <SelectTrigger className="mt-1" data-testid="customer-billing-country">
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

      <div className="flex items-center space-x-2 pt-4 border-t">
        <Checkbox 
          id="sameAddress" 
          checked={sameAddress}
          onCheckedChange={setSameAddress}
          data-testid="same-address-checkbox"
        />
        <Label htmlFor="sameAddress" className="text-sm font-normal cursor-pointer">
          L'adresse de livraison est identique à l'adresse de facturation
        </Label>
      </div>
    </div>
  );

  // Step 4: Shipping Address
  const Step4 = () => (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h3 className="text-lg font-medium text-gray-900">Adresse de livraison</h3>
        <p className="text-sm text-gray-500">Adresse différente de facturation</p>
      </div>

      <div>
        <Label>Adresse</Label>
        <Input
          value={formData.shipping_address.street}
          onChange={(e) => handleChange('shipping_address.street', e.target.value)}
          placeholder="Rue, avenue, boulevard..."
          className="mt-1"
          data-testid="customer-shipping-street"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Gouvernorat</Label>
          <Select 
            value={formData.shipping_address.governorate} 
            onValueChange={(v) => handleChange('shipping_address.governorate', v)}
          >
            <SelectTrigger className="mt-1" data-testid="customer-shipping-governorate">
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
            placeholder="1000"
            className="mt-1"
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
          <SelectTrigger className="mt-1" data-testid="customer-shipping-country">
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
  );

  const renderStep = () => {
    switch(currentStep) {
      case 1: return Step1();
      case 2: return Step2();
      case 3: return Step3();
      case 4: return Step4();
      default: return Step1();
    }
  };

  const isLastStep = currentStep === 4 || (currentStep === 3 && sameAddress);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl" data-testid="customer-form-modal">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {customer ? 'Modifier le client' : 'Nouveau client'}
          </DialogTitle>
        </DialogHeader>
        
        <Stepper />
        
        <div className="min-h-[350px]">
          {renderStep()}
        </div>

        <DialogFooter className="flex justify-between border-t pt-4">
          <Button 
            type="button" 
            variant="outline" 
            onClick={currentStep === 1 ? onClose : prevStep}
          >
            {currentStep === 1 ? 'Annuler' : (
              <>
                <ChevronLeft className="w-4 h-4 mr-1" />
                Précédent
              </>
            )}
          </Button>
          <Button 
            onClick={nextStep}
            disabled={loading} 
            className="bg-violet-600 hover:bg-violet-700"
            data-testid="customer-submit-btn"
          >
            {loading ? 'Enregistrement...' : isLastStep ? (
              <>
                <Check className="w-4 h-4 mr-1" />
                Enregistrer
              </>
            ) : (
              <>
                Suivant
                <ChevronRight className="w-4 h-4 ml-1" />
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CustomerFormModal;
