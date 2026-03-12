import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { companiesAPI } from '../services/api';
import { toast } from '../hooks/use-toast';
import { Building, DollarSign, Phone } from 'lucide-react';

const PHONE_PREFIXES = [
  { value: '+216', label: '🇹🇳 +216' },
  { value: '+33', label: '🇫🇷 +33' },
  { value: '+213', label: '🇩🇿 +213' },
  { value: '+212', label: '🇲🇦 +212' },
  { value: '+218', label: '🇱🇾 +218' },
  { value: '+20', label: '🇪🇬 +20' },
  { value: '+32', label: '🇧🇪 +32' },
  { value: '+41', label: '🇨🇭 +41' },
  { value: '+39', label: '🇮🇹 +39' },
  { value: '+34', label: '🇪🇸 +34' },
  { value: '+1', label: '🇺🇸 +1' },
  { value: '+44', label: '🇬🇧 +44' },
  { value: '+49', label: '🇩🇪 +49' },
  { value: '+90', label: '🇹🇷 +90' },
  { value: '+971', label: '🇦🇪 +971' },
];

function parsePhone(full) {
  if (!full || !String(full).trim()) return { prefix: '+216', number: '' };
  const s = String(full).trim();
  const match = s.match(/^(\+\d{1,4})\s*(.*)$/);
  if (match) return { prefix: match[1], number: match[2].trim() };
  if (/^\+\d+/.test(s)) {
    const prefixMatch = s.match(/^(\+\d{1,4})/);
    const prefix = prefixMatch ? prefixMatch[1] : '+216';
    return { prefix, number: s.replace(/^\+\d{1,4}\s*/, '').trim() };
  }
  return { prefix: '+216', number: s };
}

const ACTIVITIES = [
  'Artisanat',
  'Art et design',
  'Autres',
  'Commerce de détail',
  'Commerce en ligne',
  'Commerce en gros',
  'Conseil',
  'Construction',
  'E-commerce',
  'Éducation',
  'Finance et assurance',
  'Formation',
  'Hôtellerie et restauration',
  'Immobilier',
  'Import/Export',
  'Industrie manufacturière',
  'Informatique',
  'Logistique et transport',
  'Marketing',
  'Média et communication',
  'Santé',
  'Services aux entreprises',
  'Services professionnels',
  'Technologies de l\'information',
  'Télécommunications',
  'Tourisme'
];

const COUNTRIES = [
  { code: 'TN', name: 'Tunisie' },
  { code: 'FR', name: 'France' },
  { code: 'DZ', name: 'Algérie' },
  { code: 'MA', name: 'Maroc' },
  { code: 'LY', name: 'Libye' },
  { code: 'EG', name: 'Égypte' },
  { code: 'BE', name: 'Belgique' },
  { code: 'CH', name: 'Suisse' },
  { code: 'IT', name: 'Italie' },
  { code: 'ES', name: 'Espagne' },
  { code: 'DE', name: 'Allemagne' },
  { code: 'GB', name: 'Royaume-Uni' },
  { code: 'US', name: 'États-Unis' },
  { code: 'CA', name: 'Canada' },
  { code: 'TR', name: 'Turquie' },
  { code: 'AE', name: 'Émirats arabes unis' },
  { code: 'SA', name: 'Arabie saoudite' },
  { code: 'NL', name: 'Pays-Bas' },
  { code: 'PT', name: 'Portugal' },
  { code: 'LU', name: 'Luxembourg' },
];

const CURRENCIES = [
  { code: 'TND', name: 'Dinar tunisien (TND)' },
  { code: 'EUR', name: 'Euro (EUR)' },
  { code: 'USD', name: 'Dollar américain (USD)' },
  { code: 'GBP', name: 'Livre sterling (GBP)' },
  { code: 'MAD', name: 'Dirham marocain (MAD)' },
  { code: 'DZD', name: 'Dinar algérien (DZD)' }
];

const FISCAL_YEARS = [
  'Janvier - Décembre',
  'Février - Janvier',
  'Mars - Février',
  'Avril - Mars',
  'Mai - Avril',
  'Juin - Mai',
  'Juillet - Juin',
  'Août - Juillet',
  'Septembre - Août',
  'Octobre - Septembre',
  'Novembre - Octobre',
  'Décembre - Novembre'
];

const CompanyOnboarding = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [logoPreview, setLogoPreview] = useState(null);
  const [phonePrefix, setPhonePrefix] = useState('+216');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    fiscal_id: '',
    activity: '',
    logo: '',
    phone: '',
    website: '',
    address: {
      street: '',
      city: '',
      postal_code: '',
      country: 'Tunisie'
    },
    primary_currency: 'TND',
    fiscal_year_period: 'Janvier - Décembre'
  });

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

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result);
        setFormData(prev => ({ ...prev, logo: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Convertir la période d'exercice en dates
      const fiscalYearMap = {
        'Janvier - Décembre': { start: '01-01', end: '12-31' },
        'Février - Janvier': { start: '02-01', end: '01-31' },
        'Mars - Février': { start: '03-01', end: '02-28' },
        'Avril - Mars': { start: '04-01', end: '03-31' },
        'Mai - Avril': { start: '05-01', end: '04-30' },
        'Juin - Mai': { start: '06-01', end: '05-31' },
        'Juillet - Juin': { start: '07-01', end: '06-30' },
        'Août - Juillet': { start: '08-01', end: '07-31' },
        'Septembre - Août': { start: '09-01', end: '08-31' },
        'Octobre - Septembre': { start: '10-01', end: '09-30' },
        'Novembre - Octobre': { start: '11-01', end: '10-31' },
        'Décembre - Novembre': { start: '12-01', end: '11-30' }
      };

      const currentYear = new Date().getFullYear();
      const fiscalPeriod = fiscalYearMap[formData.fiscal_year_period];
      
      await companiesAPI.create({
        ...formData,
        fiscal_year: {
          start_date: `${currentYear}-${fiscalPeriod.start}`,
          end_date: `${currentYear}-${fiscalPeriod.end}`
        }
      });

      toast({
        title: 'Succès !',
        description: 'Votre entreprise a été créée avec succès',
      });
      navigate('/dashboard');
    } catch (error) {
      console.error('Error creating company:', error);
      toast({
        title: 'Erreur',
        description: error.response?.data?.detail || 'Erreur lors de la création',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-amber-50 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-violet-600 to-violet-700 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">E</span>
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-amber-500 bg-clip-text text-transparent">
              EasyBill
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Réglages</h1>
          <p className="text-gray-600 text-sm">Nouvelle entreprise</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Colonne gauche - Logo */}
          <Card className="p-6 h-fit">
            <div className="text-center">
              <div className="mb-4">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" className="w-32 h-32 mx-auto object-contain rounded-lg border" />
                ) : (
                  <div className="w-32 h-32 mx-auto bg-violet-50 rounded-lg flex items-center justify-center border-2 border-dashed border-violet-200">
                    <Building className="w-12 h-12 text-violet-400" />
                  </div>
                )}
              </div>
              <label className="cursor-pointer">
                <span className="text-sm text-violet-600 hover:text-violet-700">Télécharger un logo</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="hidden"
                />
              </label>
              <button 
                type="button"
                onClick={() => {
                  setLogoPreview(null);
                  setFormData(prev => ({ ...prev, logo: '' }));
                }}
                className="text-sm text-gray-500 hover:text-gray-700 mt-2 block w-full"
              >
                ×
              </button>
            </div>

            {/* Informations comptables */}
            <div className="mt-6 pt-6 border-t">
              <div className="flex items-center gap-2 mb-4">
                <DollarSign className="w-5 h-5 text-amber-600" />
                <h3 className="font-semibold text-gray-900">Informations comptables</h3>
              </div>
              
              <div className="space-y-4">
                <div>
                  <Label className="text-sm">Numéro d'identification fiscale</Label>
                  <Input
                    value={formData.fiscal_id}
                    onChange={(e) => handleChange('fiscal_id', e.target.value)}
                    placeholder="0000000X/A/M/000"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label className="text-sm">Exercice *</Label>
                  <Select 
                    value={formData.fiscal_year_period} 
                    onValueChange={(value) => handleChange('fiscal_year_period', value)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FISCAL_YEARS.map(period => (
                        <SelectItem key={period} value={period}>{period}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-sm">Devise principale *</Label>
                  <Select 
                    value={formData.primary_currency} 
                    onValueChange={(value) => handleChange('primary_currency', value)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map(currency => (
                        <SelectItem key={currency.code} value={currency.code}>
                          {currency.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </Card>

          {/* Colonne droite - Informations générales */}
          <Card className="lg:col-span-2 p-6">
            <div className="flex items-center gap-2 mb-6">
              <Building className="w-5 h-5 text-violet-600" />
              <h3 className="font-semibold text-gray-900">Informations générales</h3>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4" data-testid="onboarding-form">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Nom de l'entreprise *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    placeholder="GOOGLE?"
                    required
                    className="mt-1"
                    data-testid="onboarding-company-name-input"
                  />
                </div>

                <div>
                  <Label>Activité *</Label>
                  <Select 
                    value={formData.activity} 
                    onValueChange={(value) => handleChange('activity', value)}
                    required
                  >
                    <SelectTrigger className="mt-1" data-testid="onboarding-activity-select">
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTIVITIES.map(activity => (
                        <SelectItem key={activity} value={activity}>{activity}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Téléphone</Label>
                  <div className="flex rounded-lg border border-input bg-background shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 mt-1">
                    <div className="flex items-center pl-3 bg-muted/50 border-r border-input">
                      <Phone className="h-4 w-4 text-muted-foreground mr-2 shrink-0" />
                      <Select
                        value={phonePrefix}
                        onValueChange={(v) => {
                          setPhonePrefix(v);
                          handleChange('phone', (v + ' ' + phoneNumber).trim());
                        }}
                      >
                        <SelectTrigger className="w-[7.5rem] h-10 border-0 bg-transparent shadow-none focus:ring-0 focus-visible:ring-0">
                          <span className="truncate text-sm">
                            {PHONE_PREFIXES.find((p) => p.value === phonePrefix)?.label ?? '+216'}
                          </span>
                        </SelectTrigger>
                        <SelectContent>
                          {PHONE_PREFIXES.map((p) => (
                            <SelectItem key={p.value} value={p.value}>
                              {p.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Input
                      className="rounded-none border-0 focus-visible:ring-0 flex-1 min-w-0"
                      value={phoneNumber}
                      onChange={(e) => {
                        const v = e.target.value;
                        setPhoneNumber(v);
                        handleChange('phone', (phonePrefix + ' ' + v).trim());
                      }}
                      placeholder="12 345 678"
                      data-testid="onboarding-phone-input"
                    />
                  </div>
                </div>

                <div>
                  <Label>Site Internet</Label>
                  <Input
                    value={formData.website}
                    onChange={(e) => handleChange('website', e.target.value)}
                    placeholder="https://www.google.com"
                    className="mt-1"
                    data-testid="onboarding-website-input"
                  />
                </div>
              </div>

              <div>
                <Label>Adresse</Label>
                <Input
                  value={formData.address.street}
                  onChange={(e) => handleChange('address.street', e.target.value)}
                  placeholder="1, route de la liberté"
                  className="mt-1"
                  data-testid="onboarding-address-input"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Gouvernorat</Label>
                  <Input
                    value={formData.address.city}
                    onChange={(e) => handleChange('address.city', e.target.value)}
                    placeholder="Tunis"
                    className="mt-1"
                    data-testid="onboarding-city-input"
                  />
                </div>

                <div>
                  <Label>Code postal</Label>
                  <Input
                    value={formData.address.postal_code}
                    onChange={(e) => handleChange('address.postal_code', e.target.value)}
                    placeholder="2000"
                    className="mt-1"
                    data-testid="onboarding-postal-code-input"
                  />
                </div>

                <div>
                  <Label>Pays *</Label>
                  <Select 
                    value={formData.address.country} 
                    onValueChange={(value) => handleChange('address.country', value)}
                  >
                    <SelectTrigger className="mt-1" data-testid="onboarding-country-select">
                      <SelectValue placeholder="Choisir un pays" />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map((c) => (
                        <SelectItem key={c.code} value={c.name}>
                          <span className="flex items-center gap-2">
                            <img
                              src={`https://flagcdn.com/w40/${c.code.toLowerCase()}.png`}
                              alt=""
                              className="w-5 h-4 object-cover rounded"
                            />
                            {c.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end pt-6">
                <Button
                  type="submit"
                  disabled={loading}
                  className="bg-violet-600 hover:bg-violet-700 text-white px-8"
                  data-testid="onboarding-submit-button"
                >
                  {loading ? 'Création...' : 'Soumettre'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CompanyOnboarding;
