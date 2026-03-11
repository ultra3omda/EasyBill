import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../hooks/useCompany';
import AppLayout from '../components/layout/AppLayout';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { Plus, Search, Send, Eye, MoreVertical, AlertCircle, Clock, FileText, Mail } from 'lucide-react';
import { toast } from '../hooks/use-toast';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const Reminders = () => {
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const [reminders, setReminders] = useState([]);
  const [overdueInvoices, setOverdueInvoices] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);

  useEffect(() => {
    if (currentCompany) {
      loadData();
    }
  }, [currentCompany]);

  const loadData = async () => {
    if (!currentCompany) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      // Charger les rappels
      const remindersRes = await axios.get(`${API_URL}/api/reminders/?company_id=${currentCompany.id}`, { headers });
      setReminders(Array.isArray(remindersRes.data) ? remindersRes.data : (remindersRes.data.items || []));

      // Charger les factures en retard
      const overdueRes = await axios.get(`${API_URL}/api/reminders/overdue-invoices?company_id=${currentCompany.id}`, { headers });
      setOverdueInvoices(overdueRes.data.items || []);

      // Charger les templates
      const templatesRes = await axios.get(`${API_URL}/api/reminders/templates/list?company_id=${currentCompany.id}`, { headers });
      setTemplates(templatesRes.data.items || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les rappels",
        variant: "destructive"
      });
      setReminders([]);
      setOverdueInvoices([]);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  const initializeDefaultTemplates = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/api/reminders/templates/initialize-defaults?company_id=${currentCompany.id}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast({
        title: "Succès",
        description: "Templates par défaut créés"
      });
      loadData();
    } catch (error) {
      toast({
        title: "Erreur",
        description: error.response?.data?.detail || "Erreur lors de la création des templates",
        variant: "destructive"
      });
    }
  };

  const sendAutomaticReminder = async (invoiceId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/api/reminders/send-automatic/${invoiceId}?company_id=${currentCompany.id}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast({
        title: "Succès",
        description: "Rappel envoyé avec succès"
      });
      loadData();
    } catch (error) {
      toast({
        title: "Erreur",
        description: error.response?.data?.detail || "Erreur lors de l'envoi du rappel",
        variant: "destructive"
      });
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      draft: { label: 'Brouillon', variant: 'secondary' },
      sent: { label: 'Envoyé', variant: 'default' },
      received: { label: 'Reçu', variant: 'success' },
      resolved: { label: 'Résolu', variant: 'success' }
    };
    const config = statusConfig[status] || statusConfig.draft;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getLevelBadge = (level) => {
    const levelConfig = {
      1: { label: '1er Rappel', color: 'bg-yellow-100 text-yellow-800' },
      2: { label: '2e Rappel', color: 'bg-orange-100 text-orange-800' },
      3: { label: 'Mise en demeure', color: 'bg-red-100 text-red-800' }
    };
    const config = levelConfig[level] || levelConfig[1];
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  const filteredReminders = reminders.filter(reminder =>
    reminder.number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    reminder.customer_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Rappels</h1>
            <p className="text-gray-500 mt-1">Gérez les relances clients</p>
          </div>
          <div className="flex gap-2">
            {templates.length === 0 && (
              <Button onClick={initializeDefaultTemplates} variant="outline">
                <Mail className="w-4 h-4 mr-2" />
                Créer templates par défaut
              </Button>
            )}
            <Button onClick={() => setIsTemplateModalOpen(true)} variant="outline">
              <FileText className="w-4 h-4 mr-2" />
              Templates ({templates.length})
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Factures en retard</p>
                <h3 className="text-2xl font-bold text-red-600 mt-1">{overdueInvoices.length}</h3>
              </div>
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Rappels envoyés</p>
                <h3 className="text-2xl font-bold text-blue-600 mt-1">
                  {reminders.filter(r => r.status === 'sent').length}
                </h3>
              </div>
              <Send className="w-8 h-8 text-blue-600" />
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Montant total en retard</p>
                <h3 className="text-2xl font-bold text-orange-600 mt-1">
                  {overdueInvoices.reduce((sum, inv) => sum + inv.balance_due, 0).toFixed(3)} TND
                </h3>
              </div>
              <Clock className="w-8 h-8 text-orange-600" />
            </div>
          </Card>
        </div>

        {/* Factures en retard */}
        {overdueInvoices.length > 0 && (
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center">
              <AlertCircle className="w-5 h-5 mr-2 text-red-600" />
              Factures en retard nécessitant un rappel
            </h2>
            <div className="space-y-2">
              {overdueInvoices.slice(0, 5).map(invoice => (
                <div key={invoice.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                  <div>
                    <p className="font-medium">{invoice.number}</p>
                    <p className="text-sm text-gray-600">{invoice.customer_name}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-semibold">{invoice.balance_due.toFixed(3)} TND</p>
                      <p className="text-sm text-red-600">{invoice.days_overdue} jours de retard</p>
                    </div>
                    <Button size="sm" onClick={() => sendAutomaticReminder(invoice.id)}>
                      <Send className="w-4 h-4 mr-2" />
                      Envoyer rappel
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Liste des rappels */}
        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Historique des rappels</h2>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Rechercher..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8">Chargement...</div>
          ) : filteredReminders.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Aucun rappel trouvé
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numéro</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Niveau</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Montant dû</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReminders.map((reminder) => (
                  <TableRow key={reminder.id}>
                    <TableCell className="font-medium">{reminder.number}</TableCell>
                    <TableCell>{reminder.customer_name}</TableCell>
                    <TableCell>{getLevelBadge(reminder.level)}</TableCell>
                    <TableCell>{new Date(reminder.date).toLocaleDateString('fr-FR')}</TableCell>
                    <TableCell>{reminder.total_due?.toFixed(3)} TND</TableCell>
                    <TableCell>{getStatusBadge(reminder.status)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Eye className="w-4 h-4 mr-2" />
                            Voir détails
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Send className="w-4 h-4 mr-2" />
                            Renvoyer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        {/* Modal Templates */}
        <Dialog open={isTemplateModalOpen} onOpenChange={setIsTemplateModalOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Templates de rappels</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {templates.map((template) => (
                <Card key={template.id} className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-semibold">{template.name}</h3>
                      <p className="text-sm text-gray-500 mt-1">Niveau {template.reminder_level} - {template.days_after_due} jours après échéance</p>
                      <p className="text-sm text-gray-600 mt-2">{template.subject}</p>
                    </div>
                    <Badge variant={template.is_active ? "success" : "secondary"}>
                      {template.is_active ? "Actif" : "Inactif"}
                    </Badge>
                  </div>
                </Card>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default Reminders;
