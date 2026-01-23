import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { mockProjects } from '../data/mockData';
import AppLayout from '../components/layout/AppLayout';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { Plus, Clock, DollarSign, Calendar } from 'lucide-react';

const Projects = () => {
  const { t } = useLanguage();
  const [projects] = useState(mockProjects);

  const getStatusBadge = (status) => {
    const statusConfig = {
      'in-progress': { label: 'En cours', className: 'bg-blue-100 text-blue-800' },
      'completed': { label: 'Terminé', className: 'bg-green-100 text-green-800' },
      'planning': { label: 'Planification', className: 'bg-orange-100 text-orange-800' },
    };
    return statusConfig[status] || statusConfig.planning;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{t('nav.projects')}</h1>
            <p className="text-gray-500 mt-1">{projects.length} projets actifs</p>
          </div>
          <Button className="bg-teal-600 hover:bg-teal-700 text-white">
            <Plus className="w-4 h-4 mr-2" />
            Nouveau projet
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-6">
            <p className="text-sm text-gray-600 mb-2">Projets Actifs</p>
            <p className="text-2xl font-bold text-blue-600">
              {projects.filter(p => p.status === 'in-progress').length}
            </p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-gray-600 mb-2">Budget Total</p>
            <p className="text-2xl font-bold text-gray-900">
              {projects.reduce((acc, p) => acc + p.budget, 0).toFixed(0)} TND
            </p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-gray-600 mb-2">Dépensé</p>
            <p className="text-2xl font-bold text-orange-600">
              {projects.reduce((acc, p) => acc + p.spent, 0).toFixed(0)} TND
            </p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-gray-600 mb-2">Heures Totales</p>
            <p className="text-2xl font-bold text-teal-600">
              {projects.reduce((acc, p) => acc + p.hours, 0)}h
            </p>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {projects.map((project) => {
            const statusConfig = getStatusBadge(project.status);
            const progress = (project.spent / project.budget) * 100;
            
            return (
              <Card key={project.id} className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{project.name}</h3>
                    <p className="text-sm text-gray-600">{project.customer}</p>
                  </div>
                  <Badge className={statusConfig.className}>
                    {statusConfig.label}
                  </Badge>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-600">Budget utilisé</span>
                      <span className="font-semibold">{progress.toFixed(0)}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>{project.spent.toFixed(0)} TND</span>
                      <span>{project.budget.toFixed(0)} TND</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500">Heures</p>
                        <p className="text-sm font-semibold">{project.hours}h</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500">Restant</p>
                        <p className="text-sm font-semibold">{(project.budget - project.spent).toFixed(0)} TND</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500">Fin</p>
                        <p className="text-sm font-semibold">{new Date(project.endDate).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' })}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
};

export default Projects;