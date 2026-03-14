import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { projectsAPI, customersAPI } from '../services/api';
import { useCompany } from '../hooks/useCompany';
import AppLayout from '../components/layout/AppLayout';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Plus, Clock, DollarSign, Calendar, Edit, Trash2, Eye, MoreVertical, CheckCircle2, AlertCircle } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { toast } from '../hooks/use-toast';

const Projects = () => {
  const { t } = useLanguage();
  const { currentCompany } = useCompany();
  
  const [projects, setProjects] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    customer_id: '',
    status: 'active',
    start_date: '',
    end_date: '',
    budget: 0,
    hourly_rate: 0,
  });

  useEffect(() => {
    if (currentCompany) {
      loadProjects();
      loadStats();
      loadCustomers();
    }
  }, [currentCompany, filterStatus]);

  const loadProjects = async () => {
    if (!currentCompany) return;
    setLoading(true);
    try {
      const statusParam = filterStatus === 'all' ? null : filterStatus;
      const response = await projectsAPI.list(currentCompany.id, statusParam);
      setProjects(response.data);
    } catch (error) {
      console.error('Error loading projects:', error);
      toast({ title: 'Erreur', description: 'Impossible de charger les projets', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    if (!currentCompany) return;
    try {
      const response = await projectsAPI.getStats(currentCompany.id);
      setStats(response.data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadCustomers = async () => {
    if (!currentCompany) return;
    try {
      const response = await customersAPI.list(currentCompany.id);
      setCustomers(response.data);
    } catch (error) {
      console.error('Error loading customers:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Préparer les données
      const projectData = {
        ...formData,
        budget: parseFloat(formData.budget) || 0,
        hourly_rate: parseFloat(formData.hourly_rate) || 0,
        start_date: formData.start_date ? new Date(formData.start_date).toISOString() : null,
        end_date: formData.end_date ? new Date(formData.end_date).toISOString() : null,
      };

      // Ajouter le nom du client
      if (projectData.customer_id) {
        const customer = customers.find(c => c.id === projectData.customer_id);
        if (customer) {
          projectData.customer_name = customer.display_name || customer.company_name || '';
        }
      }

      if (selectedProject) {
        await projectsAPI.update(currentCompany.id, selectedProject.id, projectData);
        toast({ title: 'Succès', description: 'Projet modifié avec succès' });
      } else {
        await projectsAPI.create(currentCompany.id, projectData);
        toast({ title: 'Succès', description: 'Projet créé avec succès' });
      }
      
      setModalOpen(false);
      resetForm();
      loadProjects();
      loadStats();
    } catch (error) {
      console.error('Error saving project:', error);
      toast({ 
        title: 'Erreur', 
        description: error.response?.data?.detail || 'Erreur lors de l\'enregistrement', 
        variant: 'destructive' 
      });
    }
  };

  const handleDelete = async (projectId) => {
    if (!window.confirm('Voulez-vous vraiment supprimer ce projet ?')) return;
    try {
      await projectsAPI.delete(currentCompany.id, projectId);
      toast({ title: 'Succès', description: 'Projet supprimé' });
      loadProjects();
      loadStats();
    } catch (error) {
      toast({ title: 'Erreur', description: 'Erreur lors de la suppression', variant: 'destructive' });
    }
  };

  const openEditModal = (project) => {
    setSelectedProject(project);
    setFormData({
      name: project.name || '',
      description: project.description || '',
      customer_id: project.customer_id || '',
      status: project.status || 'active',
      start_date: project.start_date ? project.start_date.split('T')[0] : '',
      end_date: project.end_date ? project.end_date.split('T')[0] : '',
      budget: project.budget || 0,
      hourly_rate: project.hourly_rate || 0,
    });
    setModalOpen(true);
  };

  const openCreateModal = () => {
    setSelectedProject(null);
    resetForm();
    setModalOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      customer_id: '',
      status: 'active',
      start_date: '',
      end_date: '',
      budget: 0,
      hourly_rate: 0,
    });
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      'active': { label: 'Actif', className: 'bg-blue-100 text-blue-800' },
      'on_hold': { label: 'En pause', className: 'bg-yellow-100 text-yellow-800' },
      'completed': { label: 'Terminé', className: 'bg-green-100 text-green-800' },
      'cancelled': { label: 'Annulé', className: 'bg-red-100 text-red-800' },
    };
    return statusConfig[status] || statusConfig.active;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('fr-TN', {
      style: 'currency',
      currency: 'TND',
      minimumFractionDigits: 3
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  if (loading && !projects.length) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{t('nav.projects')}</h1>
            <p className="text-gray-500 mt-1">{projects.length} projet{projects.length > 1 ? 's' : ''}</p>
          </div>
          <div className="flex gap-3">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrer par statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="active">Actif</SelectItem>
                <SelectItem value="on_hold">En pause</SelectItem>
                <SelectItem value="completed">Terminé</SelectItem>
                <SelectItem value="cancelled">Annulé</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={openCreateModal} className="bg-teal-600 hover:bg-teal-700 text-white">
              <Plus className="w-4 h-4 mr-2" />
              Nouveau projet
            </Button>
          </div>
        </div>

        {/* Statistics Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Projets Actifs</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.active || 0}</p>
                </div>
                <CheckCircle2 className="h-10 w-10 text-blue-500 opacity-20" />
              </div>
            </Card>
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Budget Total</p>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.total_budget || 0)}</p>
                </div>
                <DollarSign className="h-10 w-10 text-gray-400 opacity-20" />
              </div>
            </Card>
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Dépensé</p>
                  <p className="text-2xl font-bold text-orange-600">{formatCurrency(stats.total_spent || 0)}</p>
                </div>
                <AlertCircle className="h-10 w-10 text-orange-500 opacity-20" />
              </div>
            </Card>
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Heures Totales</p>
                  <p className="text-2xl font-bold text-teal-600">{stats.total_hours || 0}h</p>
                </div>
                <Clock className="h-10 w-10 text-teal-500 opacity-20" />
              </div>
            </Card>
          </div>
        )}

        {/* Projects Grid */}
        {projects.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-gray-500 mb-4">Aucun projet trouvé</p>
            <Button onClick={openCreateModal} className="bg-teal-600 hover:bg-teal-700 text-white">
              <Plus className="w-4 h-4 mr-2" />
              Créer votre premier projet
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {projects.map((project) => {
              const statusConfig = getStatusBadge(project.status);
              const progress = project.budget > 0 ? (project.spent / project.budget) * 100 : 0;
              const remaining = project.budget - project.spent;
              
              return (
                <Card key={project.id} className="p-6 hover:shadow-lg transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">{project.name}</h3>
                      <p className="text-sm text-gray-600">{project.customer_name || 'Aucun client'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={statusConfig.className}>
                        {statusConfig.label}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditModal(project)}>
                            <Edit className="w-4 h-4 mr-2" />
                            Modifier
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(project.id)}>
                            <Trash2 className="w-4 h-4 mr-2" />
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {project.description && (
                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">{project.description}</p>
                  )}

                  <div className="space-y-4">
                    {/* Budget Progress */}
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-600">Budget utilisé</span>
                        <span className="font-semibold">{progress.toFixed(0)}%</span>
                      </div>
                      <Progress value={Math.min(progress, 100)} className="h-2" />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>{formatCurrency(project.spent)}</span>
                        <span>{formatCurrency(project.budget)}</span>
                      </div>
                    </div>

                    {/* Project Stats */}
                    <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-500">Heures</p>
                          <p className="text-sm font-semibold">{project.total_hours || 0}h</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-500">Restant</p>
                          <p className={`text-sm font-semibold ${remaining < 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {formatCurrency(remaining)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-500">Fin</p>
                          <p className="text-sm font-semibold">{formatDate(project.end_date)}</p>
                        </div>
                      </div>
                    </div>

                    {/* Tasks Progress */}
                    {project.task_count > 0 && (
                      <div className="pt-4 border-t">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Tâches complétées</span>
                          <span className="font-semibold">{project.completed_tasks || 0}/{project.task_count}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Create/Edit Modal */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedProject ? 'Modifier le projet' : 'Nouveau projet'}</DialogTitle>
              <DialogDescription>
                {selectedProject ? 'Modifiez les informations du projet' : 'Créez un nouveau projet pour suivre vos tâches et budgets'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Nom du projet *</label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ex: Refonte site web"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Client</label>
                    <Select value={formData.customer_id} onValueChange={(value) => setFormData({ ...formData, customer_id: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un client" />
                      </SelectTrigger>
                      <SelectContent>
                        {customers.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.display_name || customer.company_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Description</label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Description du projet..."
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Statut</label>
                    <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Actif</SelectItem>
                        <SelectItem value="on_hold">En pause</SelectItem>
                        <SelectItem value="completed">Terminé</SelectItem>
                        <SelectItem value="cancelled">Annulé</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Date début</label>
                    <Input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Date fin</label>
                    <Input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Budget (TND)</label>
                    <Input
                      type="number"
                      step="0.001"
                      value={formData.budget}
                      onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                      placeholder="0.000"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Taux horaire (TND)</label>
                    <Input
                      type="number"
                      step="0.001"
                      value={formData.hourly_rate}
                      onChange={(e) => setFormData({ ...formData, hourly_rate: e.target.value })}
                      placeholder="0.000"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" className="bg-teal-600 hover:bg-teal-700">
                  {selectedProject ? 'Modifier' : 'Créer'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default Projects;
