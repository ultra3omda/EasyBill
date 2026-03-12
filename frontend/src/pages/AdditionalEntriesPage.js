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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Plus, Pencil, Trash2, PlusCircle } from 'lucide-react';
import { toast } from '../hooks/use-toast';
import { useCompany } from '../hooks/useCompany';
import apiClient from '../services/api';

const AdditionalEntriesPage = () => {
  const { currentCompany } = useCompany();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    value: '',
    type: 'fixed',
    calculation: 'after_tax',
    sign: 'positive',
    usage: 'everywhere'
  });

  useEffect(() => {
    if (currentCompany?.id) {
      fetchEntries();
    }
  }, [currentCompany]);

  const fetchEntries = async () => {
    try {
      const response = await apiClient.get(`/settings/additional-entries/${currentCompany.id}`);
      setEntries(response.data);
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les entrées supplémentaires',
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
        title: formData.title,
        value: parseFloat(formData.value),
        type: formData.type,
        calculation: formData.calculation,
        sign: formData.sign,
        usage: formData.usage
      };

      if (editingEntry) {
        await apiClient.put(`/settings/additional-entries/${editingEntry.id}`, payload);
        toast({ title: 'Succès', description: 'Entrée mise à jour' });
      } else {
        await apiClient.post(`/settings/additional-entries/${currentCompany.id}`, payload);
        toast({ title: 'Succès', description: 'Entrée créée' });
      }
      
      setIsDialogOpen(false);
      setEditingEntry(null);
      resetForm();
      fetchEntries();
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Une erreur est survenue',
        variant: 'destructive'
      });
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      value: '',
      type: 'fixed',
      calculation: 'after_tax',
      sign: 'positive',
      usage: 'everywhere'
    });
  };

  const handleEdit = (entry) => {
    setEditingEntry(entry);
    setFormData({
      title: entry.title,
      value: entry.value.toString(),
      type: entry.type,
      calculation: entry.calculation,
      sign: entry.sign,
      usage: entry.usage
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (entryId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette entrée ?')) return;
    
    try {
      await apiClient.delete(`/settings/additional-entries/${entryId}`);
      toast({ title: 'Succès', description: 'Entrée supprimée' });
      fetchEntries();
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de supprimer l\'entrée',
        variant: 'destructive'
      });
    }
  };

  const openNewDialog = () => {
    setEditingEntry(null);
    resetForm();
    setIsDialogOpen(true);
  };

  const getTypeLabel = (type) => {
    return type === 'fixed' ? 'Fixe' : 'Pourcentage';
  };

  const getCalculationLabel = (calc) => {
    return calc === 'after_tax' ? 'Après taxe' : 'Avant taxe';
  };

  const getSignLabel = (sign) => {
    return sign === 'positive' ? 'Positif (+)' : 'Négatif (-)';
  };

  const getUsageLabel = (usage) => {
    const labels = {
      'everywhere': 'Partout',
      'manual': 'Manuel',
      'country_specific': 'Par pays',
      'currency_specific': 'Par devise'
    };
    return labels[usage] || usage;
  };

  return (
    <AppLayout>
      <div className="space-y-6" data-testid="additional-entries-page">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="page-header-title">Entrées supplémentaires</h1>
            <p className="page-header-subtitle">Configurez les frais additionnels comme le timbre fiscal</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                onClick={openNewDialog}
                className="flex items-center gap-2"
                data-testid="add-entry-button"
              >
                <Plus className="w-4 h-4" />
                Nouvelle entrée
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingEntry ? 'Modifier l\'entrée' : 'Nouvelle entrée'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Titre *</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Ex: Timbre fiscal"
                    required
                    data-testid="entry-title-input"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Valeur par défaut *</Label>
                    <Input
                      type="number"
                      step="0.001"
                      value={formData.value}
                      onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                      placeholder="1.000"
                      required
                      data-testid="entry-value-input"
                    />
                  </div>
                  <div>
                    <Label>Type</Label>
                    <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                      <SelectTrigger data-testid="entry-type-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">Montant fixe</SelectItem>
                        <SelectItem value="percentage">Pourcentage</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Calcul</Label>
                    <Select value={formData.calculation} onValueChange={(v) => setFormData({ ...formData, calculation: v })}>
                      <SelectTrigger data-testid="entry-calculation-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="after_tax">Après taxe</SelectItem>
                        <SelectItem value="before_tax">Avant taxe</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Signe</Label>
                    <Select value={formData.sign} onValueChange={(v) => setFormData({ ...formData, sign: v })}>
                      <SelectTrigger data-testid="entry-sign-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="positive">Positif (+)</SelectItem>
                        <SelectItem value="negative">Négatif (-)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>Usage</Label>
                  <Select value={formData.usage} onValueChange={(v) => setFormData({ ...formData, usage: v })}>
                    <SelectTrigger data-testid="entry-usage-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="everywhere">Partout (automatique)</SelectItem>
                      <SelectItem value="manual">Manuel uniquement</SelectItem>
                      <SelectItem value="country_specific">Par pays</SelectItem>
                      <SelectItem value="currency_specific">Par devise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Annuler
                  </Button>
                  <Button type="submit" data-testid="entry-submit-button">
                    {editingEntry ? 'Mettre à jour' : 'Créer'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Entries Table */}
        <Card>
          {loading ? (
            <div className="p-8 text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
            </div>
          ) : entries.length === 0 ? (
            <div className="p-8 text-center">
              <PlusCircle className="mx-auto mb-4 h-12 w-12 text-slate-300" />
              <p className="text-slate-500">Aucune entrée supplémentaire configurée</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Titre</TableHead>
                  <TableHead>Valeur</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Calcul</TableHead>
                  <TableHead>Signe</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id} data-testid={`entry-row-${entry.id}`}>
                    <TableCell className="font-medium text-slate-900">{entry.title}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                        {entry.value} {entry.type === 'percentage' ? '%' : 'TND'}
                      </span>
                    </TableCell>
                    <TableCell>{getTypeLabel(entry.type)}</TableCell>
                    <TableCell>{getCalculationLabel(entry.calculation)}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        entry.sign === 'positive' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {getSignLabel(entry.sign)}
                      </span>
                    </TableCell>
                    <TableCell>{getUsageLabel(entry.usage)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(entry)}
                        data-testid={`edit-entry-${entry.id}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(entry.id)}
                        className="text-red-600 hover:text-red-700"
                        data-testid={`delete-entry-${entry.id}`}
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

export default AdditionalEntriesPage;
