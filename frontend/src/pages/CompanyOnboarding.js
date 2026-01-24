import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { companiesAPI } from '../services/api';
import { toast } from '../hooks/use-toast';
import { Building, MapPin, Globe } from 'lucide-react';

const CompanyOnboarding = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    fiscal_id: '',
    activity: '',
    logo: '',
    address: {
      street: '',
      city: '',
      postal_code: '',
      country: 'Tunisia'
    }
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await companiesAPI.create(formData);
      toast({
        title: 'Succès !',
        description: 'Votre entreprise a été créée avec succès',
      });
      navigate('/dashboard');
      window.location.reload(); // Reload to update company context
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
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-blue-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl p-8 shadow-xl">
        <div className="text-center mb-8">
          <img 
            src="https://finances.iberis.io/images/logo-iberis.png" 
            alt="Iberis" 
            className="h-10 mx-auto mb-4"
          />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Bienvenue sur Iberis !
          </h1>
          <p className="text-gray-600">
            Créez votre entreprise pour commencer à utiliser toutes les fonctionnalités
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Informations de base */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-teal-600 font-semibold mb-2">
              <Building className="w-5 h-5" />
              <h3>Informations de l'entreprise</h3>
            </div>

            <div>
              <Label htmlFor="name">Nom de l'entreprise *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Ex: Ma Société SARL"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="fiscal_id">Matricule fiscal</Label>
                <Input
                  id="fiscal_id"
                  value={formData.fiscal_id}
                  onChange={(e) => handleChange('fiscal_id', e.target.value)}
                  placeholder="0000000X/A/M/000"
                />
              </div>
              <div>
                <Label htmlFor="activity">Activité</Label>
                <Input
                  id="activity"
                  value={formData.activity}
                  onChange={(e) => handleChange('activity', e.target.value)}
                  placeholder="Ex: Commerce de détail"
                />
              </div>
            </div>
          </div>

          {/* Adresse */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-teal-600 font-semibold mb-2">
              <MapPin className="w-5 h-5" />
              <h3>Adresse</h3>
            </div>

            <div>
              <Label htmlFor="street">Rue</Label>
              <Input
                id="street"
                value={formData.address.street}
                onChange={(e) => handleChange('address.street', e.target.value)}
                placeholder="Adresse complète"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="city">Ville</Label>
                <Input
                  id="city"
                  value={formData.address.city}
                  onChange={(e) => handleChange('address.city', e.target.value)}
                  placeholder="Ex: Tunis"
                />
              </div>
              <div>
                <Label htmlFor="postal_code">Code postal</Label>
                <Input
                  id="postal_code"
                  value={formData.address.postal_code}
                  onChange={(e) => handleChange('address.postal_code', e.target.value)}
                  placeholder="Ex: 1000"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 bg-teal-600 hover:bg-teal-700 text-white py-6 text-lg"
            >
              {loading ? 'Création...' : 'Créer mon entreprise'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default CompanyOnboarding;
