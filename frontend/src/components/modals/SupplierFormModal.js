import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Checkbox } from '../ui/checkbox';
import { suppliersAPI } from '../../services/api';
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
  'Commerçant', 'Retraité', 'Autre'
];

// Titles
const TITLES = [
  { value: 'mr', label: 'Mr.' },
  { value: 'mme', label: 'Mme.' },
  { value: 'mlle', label: 'Mlle.' },
  { value: 'dr', label: 'Dr.' },
  { value: 'pr', label: 'Pr.' }
];

const STEPS = [
  { id: 1, title: 'Type & Entreprise', icon: Building2 },
  { id: 2, title: 'Informations', icon: User },
  { id: 3, title: 'Adresse facturation', icon: MapPin },
  { id: 4, title: 'Adresse livraison', icon: Truck }
];

const SupplierFormModal = ({ open, onClose, onSuccess, supplier = null }) => {
  const { currentCompany } = useCompany();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [sameAddress, setSameAddress] = useState(true);
  const [supplierType, setSupplierType] = useState('entreprise');
  
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
    supplier_type: 'entreprise',
    fiscal_id: '',
    identity_number: '',
    activity: '',
    currency: 'TND',
    payment_terms: 'immediate',
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
      if (supplier) {
        setSupplierType(supplier.supplier_type || 'entreprise');
        setFormData({
          title: supplier.title || 'mr',
          first_name: supplier.first_name || '',
          last_name: supplier.last_name || '',
          company_name: supplier.company_name || '',
          display_name: supplier.display_name || '',
          reference: supplier.reference || '',
          email: supplier.email || '',
          phone: supplier.phone || '',
          website: supplier.website || '',
          supplier_type: supplier.supplier_type || 'entreprise',
          fiscal_id: supplier.fiscal_id || '',
          identity_number: supplier.identity_number || '',
          activity: supplier.activity || '',
          currency: supplier.currency || 'TND',
          payment_terms: supplier.payment_terms || 'immediate',
          billing_address: supplier.billing_address || { street: '', governorate: '', postal_code: '', country: 'Tunisie' },
          shipping_address: supplier.shipping_address || { street: '', governorate: '', postal_code: '', country: 'Tunisie' }
        });
        const billing = supplier.billing_address || {};
        const shipping = supplier.shipping_address || {};
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
  }, [supplier, open]);

  const resetForm = () => {
    setSupplierType('entreprise');
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
      supplier_type: 'entreprise',
      fiscal_id: '',
      identity_number: '',
      activity: '',
      currency: 'TND',
      payment_terms: 'immediate',
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

  const handleSupplierTypeChange = (type) => {
    setSupplierType(type);
    setFormData(prev => ({ ...prev, supplier_type: type, activity: '' }));
  };

  const generateDisplayName = () => {
    if (supplierType === 'entreprise' && formData.company_name) {
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
        if (supplierType === 'entreprise') {
          return formData.company_name?.trim() !== '';
        } else {
          // Particulier: require first_name
          return formData.first_name?.trim() !== '';
        }
      case 2:
        return true; // Optional fields in step 2
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (!validateStep(currentStep)) {
      toast({ 
        title: 'Champs requis', 
        description: supplierType === 'entreprise' ? 'Veuillez saisir le nom de l\'entreprise' : 'Veuillez saisir le prénom',
        variant: 'destructive' 
      });
      return;
    }
    
    if (currentStep === 3 && sameAddress) {
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
      const dataToSend = { 
        ...formData, 
        supplier_type: supplierType,
        display_name: displayName,
        shipping_address: sameAddress ? formData.billing_address : formData.shipping_address
      };
      
      if (supplier) {
        await suppliersAPI.update(currentCompany.id, supplier.id, dataToSend);
        toast({ title: 'Succès', description: 'Fournisseur modifié avec succès' });
      } else {
        await suppliersAPI.create(currentCompany.id, dataToSend);
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

  const Stepper = () => (
    <div className="flex items-center justify-between mb-6 px-2">
      {STEPS.map((step, index) => {
        if (step.id === 4 && sameAddress && currentStep <= 3) return null;
        
        const isActive = currentStep === step.id;
        const isCompleted = currentStep > step.id;
        const Icon = step.icon;
        
        return (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                isCompleted ? 'bg-green-500 text-white' :
                isActive ? 'bg-amber-600 text-white' : 
                'bg-gray-200 text-gray-500'
              }`}>
                {isCompleted ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
              </div>
              <span className={`text-xs mt-1 text-center max-w-[80px] ${
                isActive ? 'text-amber-600 font-medium' : 'text-gray-500'
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

  const Step1 = () => (
    <div className="space-y-6">
      <div className="text-center mb-4">
        <h3 className="text-lg font-medium text-gray-900">Type de fournisseur</h3>
        <p className="text-sm text-gray-500">Sélectionnez le type et renseignez les informations professionnelles</p>
      </div>

      <RadioGroup 
        value={supplierType} 
        onValueChange={handleSupplierTypeChange}
        className="grid grid-cols-2 gap-4"
        data-testid="supplier-type-radio"
      >
        <div className={`relative flex items-center p-4 border-2 rounded-lg cursor-pointer transition-all ${
          supplierType === 'entreprise' ? 'border-amber-500 bg-amber-50' : 'border-gray-200 hover:border-gray-300'
        }`}>
          <RadioGroupItem value="entreprise" id="s-entreprise" className="sr-only" />
          <Label htmlFor="s-entreprise" className="flex items-center gap-3 cursor-pointer w-full">
            <div className={`p-2 rounded-lg ${supplierType === 'entreprise' ? 'bg-amber-500 text-white' : 'bg-gray-100'}`}>
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <p className="font-medium">Entreprise</p>
              <p className="text-xs text-gray-500">Société, SARL, SA...</p>
            </div>
          </Label>
        </div>
        
        <div className={`relative flex items-center p-4 border-2 rounded-lg cursor-pointer transition-all ${
          supplierType === 'particulier' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
        }`}>
          <RadioGroupItem value="particulier" id="s-particulier" className="sr-only" />
          <Label htmlFor="s-particulier" className="flex items-center gap-3 cursor-pointer w-full">
            <div className={`p-2 rounded-lg ${supplierType === 'particulier' ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}>
              <User className="w-6 h-6" />
            </div>
            <div>
              <p className="font-medium">Particulier</p>
              <p className="text-xs text-gray-500">Personne physique</p>
            </div>
          </Label>
        </div>
      </RadioGroup>

      {supplierType === 'entreprise' ? (
        <div className="space-y-4 pt-4 border-t">
          <div>
            <Label>Nom de l'entreprise *</Label>
            <Input
              value={formData.company_name}
              onChange={(e) => handleChange('company_name', e.target.value)}
              placeholder="Ex: Fournisseur Pro SARL"
              className="mt-1"
              data-testid="supplier-company-name"
            />
          </div>
          <div>
            <Label>Numéro d'identification fiscale</Label>
            <Input
              value={formData.fiscal_id}
              onChange={(e) => handleChange('fiscal_id', e.target.value)}
              placeholder="0000000/A/A/000"
              className="mt-1"
              data-testid="supplier-fiscal-id"
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
                data-testid="supplier-first-name-step1"
              />
            </div>
            <div>
              <Label>Nom de famille</Label>
              <Input
                value={formData.last_name}
                onChange={(e) => handleChange('last_name', e.target.value)}
                placeholder="Nom"
                className="mt-1"
                data-testid="supplier-last-name-step1"
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
              data-testid="supplier-identity-number"
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Activité</Label>
          <Select value={formData.activity} onValueChange={(v) => handleChange('activity', v)}>
            <SelectTrigger className="mt-1" data-testid="supplier-activity">
              <SelectValue placeholder="Sélectionner" />
            </SelectTrigger>
            <SelectContent>
              {(supplierType === 'entreprise' ? ACTIVITIES_ENTREPRISE : ACTIVITIES_PARTICULIER).map(act => (
                <SelectItem key={act} value={act}>{act}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Devise</Label>
          <Select value={formData.currency} onValueChange={(v) => handleChange('currency', v)}>
            <SelectTrigger className="mt-1" data-testid="supplier-currency">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map(c => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>Conditions de paiement</Label>
        <Select value={formData.payment_terms} onValueChange={(v) => handleChange('payment_terms', v)}>
          <SelectTrigger className="mt-1" data-testid="supplier-payment-terms">
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
  );

  const Step2 = () => (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h3 className="text-lg font-medium text-gray-900">Informations générales</h3>
        <p className="text-sm text-gray-500">Coordonnées du contact</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label>Titre</Label>
          <Select value={formData.title} onValueChange={(v) => handleChange('title', v)}>
            <SelectTrigger className="mt-1" data-testid="supplier-title">
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
            data-testid="supplier-first-name"
          />
        </div>
        <div>
          <Label>Nom de famille</Label>
          <Input
            value={formData.last_name}
            onChange={(e) => handleChange('last_name', e.target.value)}
            className="mt-1"
            data-testid="supplier-last-name"
          />
        </div>
      </div>

      {supplierType === 'particulier' && (
        <div>
          <Label>Numéro d'identité (CIN)</Label>
          <Input
            value={formData.identity_number}
            onChange={(e) => handleChange('identity_number', e.target.value)}
            placeholder="00000000"
            className="mt-1"
            data-testid="supplier-identity-number"
          />
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
            data-testid="supplier-email"
          />
        </div>
        <div>
          <Label>Téléphone</Label>
          <Input
            value={formData.phone}
            onChange={(e) => handleChange('phone', e.target.value)}
            placeholder="+216 XX XXX XXX"
            className="mt-1"
            data-testid="supplier-phone"
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
            data-testid="supplier-reference"
          />
        </div>
        <div>
          <Label>Site Internet</Label>
          <Input
            value={formData.website}
            onChange={(e) => handleChange('website', e.target.value)}
            placeholder="www.exemple.com"
            className="mt-1"
            data-testid="supplier-website"
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
          data-testid="supplier-display-name"
        />
        <p className="text-xs text-gray-500 mt-1">Laissez vide pour générer automatiquement</p>
      </div>
    </div>
  );

  const Step3 = () => (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h3 className="text-lg font-medium text-gray-900">Adresse de facturation</h3>
        <p className="text-sm text-gray-500">Adresse principale du fournisseur</p>
      </div>

      <div>
        <Label>Adresse</Label>
        <Input
          value={formData.billing_address.street}
          onChange={(e) => handleChange('billing_address.street', e.target.value)}
          placeholder="Rue, avenue, boulevard..."
          className="mt-1"
          data-testid="supplier-billing-street"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Gouvernorat</Label>
          <Select 
            value={formData.billing_address.governorate} 
            onValueChange={(v) => handleChange('billing_address.governorate', v)}
          >
            <SelectTrigger className="mt-1" data-testid="supplier-billing-governorate">
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
            data-testid="supplier-billing-postal"
          />
        </div>
      </div>

      <div>
        <Label>Pays</Label>
        <Select 
          value={formData.billing_address.country} 
          onValueChange={(v) => handleChange('billing_address.country', v)}
        >
          <SelectTrigger className="mt-1" data-testid="supplier-billing-country">
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
          id="sameAddressSupplier" 
          checked={sameAddress}
          onCheckedChange={setSameAddress}
          data-testid="same-address-checkbox"
        />
        <Label htmlFor="sameAddressSupplier" className="text-sm font-normal cursor-pointer">
          L'adresse de livraison est identique à l'adresse de facturation
        </Label>
      </div>
    </div>
  );

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
          data-testid="supplier-shipping-street"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Gouvernorat</Label>
          <Select 
            value={formData.shipping_address.governorate} 
            onValueChange={(v) => handleChange('shipping_address.governorate', v)}
          >
            <SelectTrigger className="mt-1" data-testid="supplier-shipping-governorate">
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
            data-testid="supplier-shipping-postal"
          />
        </div>
      </div>

      <div>
        <Label>Pays</Label>
        <Select 
          value={formData.shipping_address.country} 
          onValueChange={(v) => handleChange('shipping_address.country', v)}
        >
          <SelectTrigger className="mt-1" data-testid="supplier-shipping-country">
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
      case 1: return <Step1 />;
      case 2: return <Step2 />;
      case 3: return <Step3 />;
      case 4: return <Step4 />;
      default: return <Step1 />;
    }
  };

  const isLastStep = currentStep === 4 || (currentStep === 3 && sameAddress);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl" data-testid="supplier-form-modal">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {supplier ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}
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
            className="bg-amber-600 hover:bg-amber-700"
            data-testid="supplier-submit-btn"
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

export default SupplierFormModal;
