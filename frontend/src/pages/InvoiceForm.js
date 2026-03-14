import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useCompany } from '../hooks/useCompany';
import AppLayout from '../components/layout/AppLayout';
import SalesDocumentForm from '../components/forms/SalesDocumentForm';
import { FormSkeleton } from '../components/ui/skeleton';
import { invoicesAPI } from '../services/api';
import { toast } from '../hooks/use-toast';

const InvoiceForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { currentCompany } = useCompany();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(false);

  const isEditing = !!id;

  useEffect(() => {
    if (id && currentCompany) {
      loadInvoice();
    }
  }, [id, currentCompany]);

  const loadInvoice = async () => {
    setLoading(true);
    try {
      const response = await invoicesAPI.get(currentCompany.id, id);
      setInvoice(response.data);
    } catch (error) {
      toast({ title: 'Erreur', description: 'Impossible de charger la facture', variant: 'destructive' });
      navigate('/sales/invoices');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (data, action) => {
    try {
      if (isEditing) {
        await invoicesAPI.update(currentCompany.id, id, data);
        toast({ title: 'Succès', description: 'Facture mise à jour' });
      } else {
        const response = await invoicesAPI.create(currentCompany.id, data);
        toast({ title: 'Succès', description: `Facture ${response.data.number} créée` });
        
        if (action === 'send') {
          await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/invoices/${response.data.id}/send?company_id=${currentCompany.id}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
          });
          toast({ title: 'Succès', description: 'Facture envoyée' });
        }
      }
      navigate('/sales/invoices');
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
        <div className="flex-1 min-h-0 flex flex-col">
          <h1 className="page-header-title mb-3 text-xl">
            {isEditing ? 'Modifier la facture' : 'Nouvelle facture'}
          </h1>
          <div className="flex-1 min-h-0">
          <SalesDocumentForm
            type="invoice"
            document={invoice}
            companyId={currentCompany?.id}
            numbering={currentCompany?.numbering}
            onSave={handleSave}
            onCancel={() => navigate('/sales/invoices')}
          />
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default InvoiceForm;
