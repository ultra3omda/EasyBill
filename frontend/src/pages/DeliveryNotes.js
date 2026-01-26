import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../hooks/useCompany';
import AppLayout from '../components/layout/AppLayout';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { Plus, Search, Truck, Edit, Trash2, MoreVertical, CheckCircle, Download, Eye, Filter, RefreshCw, FileText } from 'lucide-react';
import axios from 'axios';
import { toast } from '../hooks/use-toast';

const DeliveryNotes = () => {
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const [docs, setDocs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedDocs, setSelectedDocs] = useState([]);

  useEffect(() => {
    if (currentCompany) loadData();
  }, [currentCompany]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/delivery-notes/?company_id=${currentCompany.id}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      setDocs(await res.json());
    } catch (error) {
      toast({ title: 'Erreur', description: 'Impossible de charger les données', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer ce bon de livraison ?')) return;
    try {
      await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/delivery-notes/${id}?company_id=${currentCompany.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      toast({ title: 'Succès', description: 'Bon de livraison supprimé' });
      loadData();
    } catch (error) {
      toast({ title: 'Erreur', description: 'Erreur lors de la suppression', variant: 'destructive' });
    }
  };


  const handleValidate = async (deliveryId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/api/delivery-notes/${deliveryId}/validate?company_id=${currentCompany.id}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast({ title: 'Succès', description: 'Bon de livraison validé et stock mis à jour' });
      loadData();
    } catch (error) {
      console.error('Error validating delivery note:', error);
      toast({ title: 'Erreur', description: error.response?.data?.detail || 'Erreur lors de la validation', variant: 'destructive' });
    }
  };

  const handleConvertToInvoice = async (deliveryId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/api/delivery-notes/${deliveryId}/convert-to-invoice?company_id=${currentCompany.id}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast({ title: 'Succès', description: `Facture ${res.data.number} créée depuis le BL` });
      loadData();
    } catch (error) {
      console.error('Error converting to invoice:', error);
      toast({ title: 'Erreur', description: error.response?.data?.detail || 'Erreur lors de la conversion', variant: 'destructive' });
    }
  };

  const handleDeliver = async (id) => {
    try {
      await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/delivery-notes/${id}/deliver?company_id=${currentCompany.id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      toast({ title: 'Succès', description: 'Bon de livraison marqué comme livré' });
      loadData();
    } catch (error) {
      toast({ title: 'Erreur', variant: 'destructive' });
    }
  };

  const getStatusBadge = (status) => {
    const config = {
      draft: { label: 'Brouillon', className: 'bg-gray-100 text-gray-800' },
      delivered: { label: 'Livré', className: 'bg-green-100 text-green-800' },
      cancelled: { label: 'Annulé', className: 'bg-red-100 text-red-800' }
    };
    return config[status] || config.draft;
  };
    };
    return config[status] || config.draft;
  };

  const filteredDocs = docs.filter(d =>
    d.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('fr-TN', { minimumFractionDigits: 3 }).format(value || 0) + ' TND';
  };

  if (!currentCompany) {
    return <AppLayout><div className="text-center py-20">Aucune entreprise sélectionnée</div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="space-y-6 p-6" data-testid="delivery-notes-page">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Bons de livraison</h1>
            <p className="text-gray-500">{filteredDocs.length} bons au total</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline">
              <Filter className="w-4 h-4 mr-2" />
              Filtres
            </Button>
            <Button 
              className="bg-violet-600 hover:bg-violet-700 text-white" 
              onClick={() => navigate('/sales/delivery-notes/new')}
              data-testid="create-delivery-note-btn"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nouveau bon de livraison
            </Button>
          </div>
        </div>

        {/* Search */}
        <Card className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Rechercher par N° ou client..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </Card>

        {/* Table */}
        <Card>
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="w-12">
                  <input type="checkbox" className="rounded border-gray-300" />
                </TableHead>
                <TableHead>N°</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">Chargement...</TableCell>
                </TableRow>
              ) : filteredDocs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-400">
                    Aucun bon de livraison trouvé
                  </TableCell>
                </TableRow>
              ) : (
                filteredDocs.map((doc) => {
                  const statusInfo = getStatusBadge(doc.status);
                  return (
                    <TableRow key={doc.id} className="hover:bg-gray-50">
                      <TableCell>
                        <input type="checkbox" className="rounded border-gray-300" />
                      </TableCell>
                      <TableCell>
                        <span className="font-medium text-violet-600">{doc.number}</span>
                      </TableCell>
                      <TableCell>{doc.customer_name || 'N/A'}</TableCell>
                      <TableCell>{new Date(doc.date).toLocaleDateString('fr-FR')}</TableCell>
                      <TableCell>
                        <Badge className={statusInfo.className}>{statusInfo.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(doc.total)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/sales/delivery-notes/${doc.id}/edit`)}>
                              <Edit className="w-4 h-4 mr-2" />
                              Modifier
                            </DropdownMenuItem>
                            {doc.status === 'draft' && (
                              <>
                                <DropdownMenuItem onClick={() => handleValidate(doc.id)}>
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  Valider (sortie stock)
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleConvertToInvoice(doc.id)}>
                                  <RefreshCw className="w-4 h-4 mr-2" />
                                  Convertir en facture
                                </DropdownMenuItem>
                              </>
                            )}
                            {doc.status === 'draft' && (
                              <DropdownMenuItem onClick={() => handleDeliver(doc.id)}>
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Marquer livré
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem>
                              <Download className="w-4 h-4 mr-2" />
                              Télécharger PDF
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(doc.id)}>
                              <Trash2 className="w-4 h-4 mr-2" />
                              Supprimer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </AppLayout>
  );
};

export default DeliveryNotes;
