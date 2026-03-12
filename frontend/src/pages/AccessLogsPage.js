import React, { useState, useEffect } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { FileKey, RefreshCw, User, Calendar, Activity } from 'lucide-react';
import { toast } from '../hooks/use-toast';
import { useCompany } from '../hooks/useCompany';
import apiClient from '../services/api';

const AccessLogsPage = () => {
  const { currentCompany } = useCompany();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentCompany?.id) {
      fetchLogs();
    }
  }, [currentCompany]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get(`/settings/access-logs/${currentCompany.id}?limit=100`);
      setLogs(response.data);
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de charger le journal d\'accès',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getCategoryColor = (category) => {
    const colors = {
      'Entreprise': 'bg-blue-100 text-blue-800',
      'Taxe': 'bg-violet-100 text-violet-800',
      'Entrées supplémentaires': 'bg-amber-100 text-amber-800',
      'Client': 'bg-green-100 text-green-800',
      'Fournisseur': 'bg-orange-100 text-orange-800',
      'Facture': 'bg-red-100 text-red-800',
      'Devis': 'bg-cyan-100 text-cyan-800',
      'Article': 'bg-pink-100 text-pink-800',
    };
    return colors[category] || 'bg-slate-100 text-slate-800';
  };

  const getActionColor = (action) => {
    const colors = {
      'Créer': 'text-green-600',
      'Mise à jour': 'text-blue-600',
      'Supprimer': 'text-red-600',
    };
    return colors[action] || 'text-slate-600';
  };

  return (
    <AppLayout>
      <div className="space-y-6" data-testid="access-logs-page">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="page-header-title">Journal d'accès</h1>
            <p className="page-header-subtitle">Historique des actions effectuées sur votre entreprise</p>
          </div>
          <Button 
            onClick={fetchLogs}
            variant="outline"
            className="flex items-center gap-2"
            data-testid="refresh-logs-button"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="stat-surface p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-violet-100 p-2">
                <Activity className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Total actions</p>
                <p className="text-2xl font-bold text-slate-900">{logs.length}</p>
              </div>
            </div>
          </Card>
          <Card className="stat-surface p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-green-100 p-2">
                <Activity className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Créations</p>
                <p className="text-2xl font-bold text-slate-900">
                  {logs.filter(l => l.action === 'Créer').length}
                </p>
              </div>
            </div>
          </Card>
          <Card className="stat-surface p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-blue-100 p-2">
                <Activity className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Mises à jour</p>
                <p className="text-2xl font-bold text-slate-900">
                  {logs.filter(l => l.action === 'Mise à jour').length}
                </p>
              </div>
            </div>
          </Card>
          <Card className="stat-surface p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-red-100 p-2">
                <Activity className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Suppressions</p>
                <p className="text-2xl font-bold text-slate-900">
                  {logs.filter(l => l.action === 'Supprimer').length}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Logs Table */}
        <Card>
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 mx-auto"></div>
            </div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center">
              <FileKey className="mx-auto mb-4 h-12 w-12 text-slate-300" />
              <p className="text-slate-500">Aucune activité enregistrée</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-slate-500">Utilisateur</TableHead>
                  <TableHead className="text-slate-500">Catégorie</TableHead>
                  <TableHead className="text-slate-500">Action</TableHead>
                  <TableHead className="text-slate-500">Élément</TableHead>
                  <TableHead className="text-slate-500">IP</TableHead>
                  <TableHead className="text-slate-500">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id} data-testid={`log-row-${log.id}`} className="hover:bg-slate-50/80">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100">
                          <User className="w-4 h-4 text-violet-600" />
                        </div>
                        <span className="font-medium text-slate-900">{log.user_name || 'Utilisateur'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(log.category)}`}>
                        {log.category}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`font-medium ${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium text-slate-900">{log.element}</TableCell>
                    <TableCell className="font-mono text-sm text-slate-500">
                      {log.ip_address || '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-slate-500">
                        <Calendar className="w-3 h-3" />
                        <span className="text-sm">{formatDate(log.created_at)}</span>
                      </div>
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

export default AccessLogsPage;
