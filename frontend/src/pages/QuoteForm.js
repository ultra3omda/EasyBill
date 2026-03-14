import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCompany } from '../hooks/useCompany';
import AppLayout from '../components/layout/AppLayout';
import SalesDocumentForm from '../components/forms/SalesDocumentForm';
import { FormSkeleton } from '../components/ui/skeleton';
import { quotesAPI } from '../services/api';
import { toast } from '../hooks/use-toast';

const QuoteForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { currentCompany } = useCompany();
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(false);

  const isEditing = !!id;

  useEffect(() => {
    if (id && currentCompany) {
      loadQuote();
    }
  }, [id, currentCompany]);

  const loadQuote = async () => {
    setLoading(true);
    try {
      const response = await quotesAPI.get(currentCompany.id, id);
      setQuote(response.data);
    } catch (error) {
      toast({ title: 'Erreur', description: 'Impossible de charger le devis', variant: 'destructive' });
      navigate('/sales/quotes');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (data, action) => {
    try {
      if (isEditing) {
        await quotesAPI.update(currentCompany.id, id, data);
        toast({ title: 'Succès', description: 'Devis mis à jour' });
      } else {
        const response = await quotesAPI.create(currentCompany.id, data);
        toast({ title: 'Succès', description: `Devis ${response.data.number} créé` });
        
        if (action === 'send') {
          await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/quotes/${response.data.id}/send?company_id=${currentCompany.id}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
          });
          toast({ title: 'Succès', description: 'Devis envoyé' });
        }
      }
      navigate('/sales/quotes');
    } catch (error) {
      toast({ 
        title: 'Erreur', 
        description: error.response?.data?.detail || 'Erreur lors de l\'enregistrement', 
        variant: 'destructive' 
      });
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <FormSkeleton />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="page-shell h-full overflow-hidden">
        <div className="h-full">
          <h1 className="page-header-title mb-4 text-xl">
            {isEditing ? 'Modifier le devis' : 'Nouveau devis'}
          </h1>
          <SalesDocumentForm
            type="quote"
            document={quote}
            companyId={currentCompany?.id}
            numbering={currentCompany?.numbering}
            onSave={handleSave}
            onCancel={() => navigate('/sales/quotes')}
          />
        </div>
      </div>
    </AppLayout>
  );
};

export default QuoteForm;
