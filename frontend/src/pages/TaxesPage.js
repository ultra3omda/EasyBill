import React, { useState, useEffect } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Switch } from '../components/ui/switch';
import { Plus, Pencil, Trash2, Percent } from 'lucide-react';
import { toast } from '../hooks/use-toast';
import { useCompany } from '../hooks/useCompany';
import apiClient from '../services/api';

const TaxesPage = () => {
  const { currentCompany } = useCompany();
  const [taxes, setTaxes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTax, setEditingTax] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    rate: '',
    description: '',
    is_default: false
  });

  useEffect(() => {
    if (currentCompany?.id) {
      fetchTaxes();
    }
  }, [currentCompany]);

  const fetchTaxes = async () => {
    try {
      const response = await apiClient.get(`/settings/taxes/${currentCompany.id}`);
      setTaxes(response.data);
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les taxes',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: formData.name,
        rate: parseFloat(formData.rate),
        description: formData.description,
        is_default: formData.is_default
      };

      if (editingTax) {
        await apiClient.put(`/settings/taxes/${editingTax.id}`, payload);
        toast({ title: 'Succès', description: 'Taxe mise à jour' });
      } else {
        await apiClient.post(`/settings/taxes/${currentCompany.id}`, payload);
        toast({ title: 'Succès', description: 'Taxe créée' });
      }
      
      setIsDialogOpen(false);
      setEditingTax(null);
      setFormData({ name: '', rate: '', description: '', is_default: false });
      fetchTaxes();
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Une erreur est survenue',
        variant: 'destructive'
      });
    }
  };

  const handleEdit = (tax) => {
    setEditingTax(tax);
    setFormData({
      name: tax.name,
      rate: tax.rate.toString(),
      description: tax.description || '',
      is_default: tax.is_default
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (taxId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette taxe ?')) return;
    
    try {
      await apiClient.delete(`/settings/taxes/${taxId}`);
      toast({ title: 'Succès', description: 'Taxe supprimée' });
      fetchTaxes();
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de supprimer la taxe',
        variant: 'destructive'
      });
    }
  };

  const openNewDialog = () => {
    setEditingTax(null);
    setFormData({ name: '', rate: '', description: '', is_default: false });
    setIsDialogOpen(true);
  };

  return (
    <AppLayout>
      <div className="space-y-6" data-testid="taxes-page">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Taxes</h1>
            <p className="text-gray-500 mt-1">Gérez les taxes applicables à vos documents</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                onClick={openNewDialog}
                className="bg-violet-600 hover:bg-violet-700 text-white flex items-center gap-2"
                data-testid="add-tax-button"
              >
                <Plus className="w-4 h-4" />
                Nouvelle taxe
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingTax ? 'Modifier la taxe' : 'Nouvelle taxe'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Nom de la taxe *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: T.V.A"
                    required
                    data-testid="tax-name-input"
                  />
                </div>
                <div>
                  <Label>Taux (%) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.rate}
                    onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                    placeholder="Ex: 19"
                    required
                    data-testid="tax-rate-input"
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Input
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Description optionnelle"
                    data-testid="tax-description-input"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={formData.is_default}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_default: checked })}
                    data-testid="tax-default-switch"
                  />
                  <Label>Taxe par défaut</Label>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Annuler
                  </Button>
                  <Button type="submit" className="bg-violet-600 hover:bg-violet-700" data-testid="tax-submit-button">
                    {editingTax ? 'Mettre à jour' : 'Créer'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Taxes Table */}
        <Card>
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 mx-auto"></div>
            </div>
          ) : taxes.length === 0 ? (
            <div className="p-8 text-center">
              <Percent className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Aucune taxe configurée</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Taux</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Par défaut</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {taxes.map((tax) => (
                  <TableRow key={tax.id} data-testid={`tax-row-${tax.id}`}>
                    <TableCell className="font-medium">{tax.name}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-800">
                        {tax.rate}%
                      </span>
                    </TableCell>
                    <TableCell className="text-gray-500">{tax.description || '-'}</TableCell>
                    <TableCell>
                      {tax.is_default ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                          Oui
                        </span>
                      ) : (
                        <span className="text-gray-400">Non</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {tax.is_active ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                          Actif
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                          Inactif
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(tax)}
                        data-testid={`edit-tax-${tax.id}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(tax.id)}
                        className="text-red-600 hover:text-red-700"
                        data-testid={`delete-tax-${tax.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </AppLayout>
  );
};

export default TaxesPage;
