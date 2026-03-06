import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCompany } from '../hooks/useCompany';
import AppLayout from '../components/layout/AppLayout';
import SalesDocumentForm from '../components/forms/SalesDocumentForm';
import { deliveryNotesAPI } from '../services/api';
import { toast } from '../hooks/use-toast';
import { Loader2 } from 'lucide-react';

const DeliveryNoteForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { currentCompany } = useCompany();
  const [deliveryNote, setDeliveryNote] = useState(null);
  const [loading, setLoading] = useState(false);

  const isEditing = !!id;

  useEffect(() => {
    if (id && currentCompany) {
      loadDeliveryNote();
    }
  }, [id, currentCompany]);

  const loadDeliveryNote = async () => {
    setLoading(true);
    try {
      const response = await deliveryNotesAPI.get(currentCompany.id, id);
      setDeliveryNote(response.data);
    } catch (error) {
      toast({ title: 'Erreur', description: 'Impossible de charger le bon de livraison', variant: 'destructive' });
      navigate('/sales/delivery-notes');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (data, action) => {
    try {
      if (isEditing) {
        await deliveryNotesAPI.update(currentCompany.id, id, data);
        toast({ title: 'Succès', description: 'Bon de livraison mis à jour' });
      } else {
        const response = await deliveryNotesAPI.create(currentCompany.id, data);
        toast({ title: 'Succès', description: `Bon de livraison ${response.data.number} créé` });
      }
      navigate('/sales/delivery-notes');
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
            {isEditing ? 'Modifier le bon de livraison' : 'Nouveau bon de livraison'}
          </h1>
          <SalesDocumentForm
            type="delivery_note"
            document={deliveryNote}
            companyId={currentCompany?.id}
            numbering={currentCompany?.numbering}
            onSave={handleSave}
            onCancel={() => navigate('/sales/delivery-notes')}
          />
        </div>
      </div>
    </AppLayout>
  );
};

export default DeliveryNoteForm;
