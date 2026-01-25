import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useCompany } from '../hooks/useCompany';
import AppLayout from '../components/layout/AppLayout';
import SalesDocumentForm from '../components/forms/SalesDocumentForm';
import { invoicesAPI } from '../services/api';
import { toast } from '../hooks/use-toast';
import { Loader2 } from 'lucide-react';

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
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="h-[calc(100vh-80px)] overflow-hidden">
        <div className="p-6 h-full">
          <h1 className="text-2xl font-bold mb-4">
            {isEditing ? 'Modifier la facture' : 'Nouvelle facture'}
          </h1>
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
    </AppLayout>
  );
};

export default InvoiceForm;
