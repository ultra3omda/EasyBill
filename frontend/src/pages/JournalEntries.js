import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { toast } from 'sonner';
import { journalEntriesAPI, accountingAPI, companiesAPI } from '../services/api';
import {
  Plus,
  Search,
  Filter,
  RefreshCw,
  FileText,
  CheckCircle,
  XCircle,
  Edit,
  Trash2,
  Eye,
  Calendar,
  PlusCircle,
  MinusCircle,
} from 'lucide-react';

const JournalEntries = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [entries, setEntries] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [journalFilter, setJournalFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    reference: '',
    description: '',
    journal_type: 'general',
    lines: [
      { account_code: '', debit: '', credit: '', description: '' },
      { account_code: '', debit: '', credit: '', description: '' },
    ],
  });

  const journalTypes = [
    { value: 'all', label: 'Tous les journaux' },
    { value: 'general', label: 'Journal général' },
    { value: 'sales', label: 'Journal des ventes' },
    { value: 'purchases', label: 'Journal des achats' },
    { value: 'bank', label: 'Journal de banque' },
    { value: 'cash', label: 'Journal de caisse' },
  ];

  const statusOptions = [
    { value: 'all', label: 'Tous les statuts' },
    { value: 'draft', label: 'Brouillon' },
    { value: 'posted', label: 'Validée' },
    { value: 'cancelled', label: 'Annulée' },
  ];

  useEffect(() => {
    const fetchCompanyId = async () => {
      try {
        const response = await companiesAPI.list();
        if (response.data.length > 0) {
          setCompanyId(response.data[0].id);
        }
      } catch (error) {
        console.error('Error fetching company:', error);
      }
    };
    fetchCompanyId();
  }, []);

  useEffect(() => {
    if (companyId) {
      fetchEntries();
      fetchAccounts();
      
      // Check if we need to open the new entry modal
      if (searchParams.get('action') === 'new') {
        setShowModal(true);
      }
    }
  }, [companyId, statusFilter, journalFilter, searchParams]);

  const fetchEntries = async () => {
    try {
      setLoading(true);
      const params = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (journalFilter !== 'all') params.journal_type = journalFilter;
      
      const response = await journalEntriesAPI.list(companyId, params);
      setEntries(response.data);
    } catch (error) {
      console.error('Error fetching entries:', error);
      toast.error('Erreur lors du chargement des écritures');
    } finally {
      setLoading(false);
    }
  };

  const fetchAccounts = async () => {
    try {
      const response = await accountingAPI.listAccounts(companyId);
      // Filter to only get detail accounts (not groups)
      setAccounts(response.data.filter(a => !a.is_group));
    } catch (error) {
      console.error('Error fetching accounts:', error);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('fr-TN', {
      style: 'currency',
      currency: 'TND',
      minimumFractionDigits: 3,
    }).format(value || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('fr-TN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const calculateTotals = () => {
    const totalDebit = formData.lines.reduce(
      (sum, line) => sum + (parseFloat(line.debit) || 0),
      0
    );
    const totalCredit = formData.lines.reduce(
      (sum, line) => sum + (parseFloat(line.credit) || 0),
      0
    );
    return { totalDebit, totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.01 };
  };

  const addLine = () => {
    setFormData({
      ...formData,
      lines: [
        ...formData.lines,
        { account_code: '', debit: '', credit: '', description: '' },
      ],
    });
  };

  const removeLine = (index) => {
    if (formData.lines.length <= 2) {
      toast.error('Une écriture doit avoir au moins 2 lignes');
      return;
    }
    const newLines = formData.lines.filter((_, i) => i !== index);
    setFormData({ ...formData, lines: newLines });
  };

  const updateLine = (index, field, value) => {
    const newLines = [...formData.lines];
    newLines[index] = { ...newLines[index], [field]: value };
    
    // If entering debit, clear credit and vice versa
    if (field === 'debit' && value) {
      newLines[index].credit = '';
    } else if (field === 'credit' && value) {
      newLines[index].debit = '';
    }
    
    setFormData({ ...formData, lines: newLines });
  };

  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      reference: '',
      description: '',
      journal_type: 'general',
      lines: [
        { account_code: '', debit: '', credit: '', description: '' },
        { account_code: '', debit: '', credit: '', description: '' },
      ],
    });
    setSelectedEntry(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const { totalDebit, totalCredit, balanced } = calculateTotals();
    
    if (!balanced) {
      toast.error(`L'écriture n'est pas équilibrée. Débit: ${formatCurrency(totalDebit)}, Crédit: ${formatCurrency(totalCredit)}`);
      return;
    }
    
    // Validate all lines have accounts
    const invalidLines = formData.lines.filter(
      (line) => !line.account_code || (!line.debit && !line.credit)
    );
    if (invalidLines.length > 0) {
      toast.error('Toutes les lignes doivent avoir un compte et un montant');
      return;
    }
    
    try {
      const payload = {
        date: formData.date,
        reference: formData.reference || null,
        description: formData.description,
        journal_type: formData.journal_type,
        lines: formData.lines.map((line) => ({
          account_code: line.account_code,
          debit: parseFloat(line.debit) || 0,
          credit: parseFloat(line.credit) || 0,
          description: line.description || null,
        })),
      };
      
      if (selectedEntry) {
        await journalEntriesAPI.update(companyId, selectedEntry.id, payload);
        toast.success('Écriture mise à jour');
      } else {
        await journalEntriesAPI.create(companyId, payload);
        toast.success('Écriture créée');
      }
      
      setShowModal(false);
      resetForm();
      fetchEntries();
    } catch (error) {
      console.error('Error saving entry:', error);
      toast.error(error.response?.data?.detail || 'Erreur lors de l\'enregistrement');
    }
  };

  const handlePost = async (entry) => {
    if (!window.confirm(`Valider l'écriture ${entry.entry_number} ? Cette action est irréversible.`)) {
      return;
    }
    try {
      await journalEntriesAPI.post(companyId, entry.id);
      toast.success('Écriture validée');
      fetchEntries();
    } catch (error) {
      console.error('Error posting entry:', error);
      toast.error(error.response?.data?.detail || 'Erreur lors de la validation');
    }
  };

  const handleCancel = async (entry) => {
    if (!window.confirm(`Annuler l'écriture ${entry.entry_number} ?`)) {
      return;
    }
    try {
      await journalEntriesAPI.cancel(companyId, entry.id);
      toast.success('Écriture annulée');
      fetchEntries();
    } catch (error) {
      console.error('Error cancelling entry:', error);
      toast.error(error.response?.data?.detail || 'Erreur lors de l\'annulation');
    }
  };

  const handleDelete = async (entry) => {
    if (!window.confirm(`Supprimer l'écriture ${entry.entry_number} ?`)) {
      return;
    }
    try {
      await journalEntriesAPI.delete(companyId, entry.id);
      toast.success('Écriture supprimée');
      fetchEntries();
    } catch (error) {
      console.error('Error deleting entry:', error);
      toast.error(error.response?.data?.detail || 'Erreur lors de la suppression');
    }
  };

  const openEditModal = (entry) => {
    setSelectedEntry(entry);
    setFormData({
      date: entry.date ? entry.date.split('T')[0] : '',
      reference: entry.reference || '',
      description: entry.description || '',
      journal_type: entry.journal_type || 'general',
      lines: entry.lines.length > 0
        ? entry.lines.map((l) => ({
            account_code: l.account_code,
            debit: l.debit || '',
            credit: l.credit || '',
            description: l.description || '',
          }))
        : [
            { account_code: '', debit: '', credit: '', description: '' },
            { account_code: '', debit: '', credit: '', description: '' },
          ],
    });
    setShowModal(true);
  };

  const openViewModal = (entry) => {
    setSelectedEntry(entry);
    setShowViewModal(true);
  };

  const { totalDebit, totalCredit, balanced } = calculateTotals();

  const filteredEntries = searchTerm
    ? entries.filter(
        (e) =>
          e.entry_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          e.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          e.reference?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : entries;

  return (
    <AppLayout>
      <div className="space-y-6" data-testid="journal-entries-page">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Écritures Comptables</h1>
            <p className="text-gray-500 mt-1">Gestion des écritures du journal général</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportToExcel}>
              <Download className="w-4 h-4 mr-2" />
              Exporter Excel
            </Button>
            <Button
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
              className="bg-violet-600 hover:bg-violet-700"
              data-testid="new-entry-btn"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nouvelle écriture
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Rechercher par numéro, description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={journalFilter} onValueChange={setJournalFilter}>
              <SelectTrigger className="w-48">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {journalTypes.map((j) => (
                  <SelectItem key={j.value} value={j.value}>
                    {j.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={fetchEntries}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </Card>

        {/* Entries List */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Numéro
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Journal
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Description
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Débit
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Crédit
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    Statut
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto text-violet-600" />
                    </td>
                  </tr>
                ) : filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                      Aucune écriture trouvée
                    </td>
                  </tr>
                ) : (
                  filteredEntries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className="font-mono text-violet-600 font-medium">
                          {entry.entry_number}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">{formatDate(entry.date)}</td>
                      <td className="px-4 py-3 text-sm capitalize">
                        {journalTypes.find((j) => j.value === entry.journal_type)?.label ||
                          entry.journal_type}
                      </td>
                      <td className="px-4 py-3 text-sm max-w-xs truncate">
                        {entry.description}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-mono">
                        {formatCurrency(entry.total_debit)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-mono">
                        {formatCurrency(entry.total_credit)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge
                          className={
                            entry.status === 'posted'
                              ? 'bg-green-100 text-green-800'
                              : entry.status === 'draft'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }
                        >
                          {entry.status === 'posted'
                            ? 'Validée'
                            : entry.status === 'draft'
                            ? 'Brouillon'
                            : 'Annulée'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openViewModal(entry)}
                            title="Voir"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {entry.status === 'draft' && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditModal(entry)}
                                title="Modifier"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handlePost(entry)}
                                className="text-green-600 hover:text-green-700"
                                title="Valider"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(entry)}
                                className="text-red-600 hover:text-red-700"
                                title="Supprimer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                          {entry.status === 'posted' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCancel(entry)}
                              className="text-orange-600 hover:text-orange-700"
                              title="Annuler"
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Create/Edit Modal */}
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedEntry ? 'Modifier l\'écriture' : 'Nouvelle écriture comptable'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <Label>Date *</Label>
                  <Input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Référence</Label>
                  <Input
                    value={formData.reference}
                    onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                    placeholder="Ex: FAC-001"
                  />
                </div>
                <div className="col-span-2">
                  <Label>Journal *</Label>
                  <Select
                    value={formData.journal_type}
                    onValueChange={(value) =>
                      setFormData({ ...formData, journal_type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {journalTypes
                        .filter((j) => j.value !== 'all')
                        .map((j) => (
                          <SelectItem key={j.value} value={j.value}>
                            {j.label}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Description *</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Description de l'écriture..."
                  required
                  rows={2}
                />
              </div>

              {/* Lines */}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                        Compte
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                        Libellé
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 w-32">
                        Débit
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 w-32">
                        Crédit
                      </th>
                      <th className="px-3 py-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {formData.lines.map((line, index) => (
                      <tr key={index}>
                        <td className="px-3 py-2">
                          <Select
                            value={line.account_code}
                            onValueChange={(value) => updateLine(index, 'account_code', value)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Sélectionner..." />
                            </SelectTrigger>
                            <SelectContent>
                              {accounts.map((a) => (
                                <SelectItem key={a.code} value={a.code}>
                                  {a.code} - {a.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            value={line.description}
                            onChange={(e) => updateLine(index, 'description', e.target.value)}
                            placeholder="Libellé ligne"
                            className="h-9"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            step="0.001"
                            min="0"
                            value={line.debit}
                            onChange={(e) => updateLine(index, 'debit', e.target.value)}
                            className="text-right h-9"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            step="0.001"
                            min="0"
                            value={line.credit}
                            onChange={(e) => updateLine(index, 'credit', e.target.value)}
                            className="text-right h-9"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeLine(index)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <MinusCircle className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan={2} className="px-3 py-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={addLine}
                          className="text-violet-600"
                        >
                          <PlusCircle className="w-4 h-4 mr-1" />
                          Ajouter une ligne
                        </Button>
                      </td>
                      <td className="px-3 py-2 text-right font-bold">
                        {formatCurrency(totalDebit)}
                      </td>
                      <td className="px-3 py-2 text-right font-bold">
                        {formatCurrency(totalCredit)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {balanced ? (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-500" />
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {!balanced && (
                <p className="text-sm text-red-500">
                  L'écriture n'est pas équilibrée. Différence:{' '}
                  {formatCurrency(Math.abs(totalDebit - totalCredit))}
                </p>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                  Annuler
                </Button>
                <Button
                  type="submit"
                  className="bg-violet-600 hover:bg-violet-700"
                  disabled={!balanced}
                >
                  {selectedEntry ? 'Mettre à jour' : 'Créer'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* View Modal */}
        <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                Écriture {selectedEntry?.entry_number}
              </DialogTitle>
            </DialogHeader>
            {selectedEntry && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Date</p>
                    <p className="font-medium">{formatDate(selectedEntry.date)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Journal</p>
                    <p className="font-medium capitalize">
                      {journalTypes.find((j) => j.value === selectedEntry.journal_type)?.label}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Référence</p>
                    <p className="font-medium">{selectedEntry.reference || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Statut</p>
                    <Badge
                      className={
                        selectedEntry.status === 'posted'
                          ? 'bg-green-100 text-green-800'
                          : selectedEntry.status === 'draft'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }
                    >
                      {selectedEntry.status === 'posted'
                        ? 'Validée'
                        : selectedEntry.status === 'draft'
                        ? 'Brouillon'
                        : 'Annulée'}
                    </Badge>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Description</p>
                  <p className="font-medium">{selectedEntry.description}</p>
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                          Compte
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                          Libellé
                        </th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">
                          Débit
                        </th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">
                          Crédit
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {selectedEntry.lines?.map((line, index) => (
                        <tr key={index}>
                          <td className="px-3 py-2 font-mono text-violet-600">
                            {line.account_code}
                          </td>
                          <td className="px-3 py-2 text-sm">
                            {line.account_name || line.description}
                          </td>
                          <td className="px-3 py-2 text-right font-mono">
                            {line.debit ? formatCurrency(line.debit) : ''}
                          </td>
                          <td className="px-3 py-2 text-right font-mono">
                            {line.credit ? formatCurrency(line.credit) : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 font-bold">
                      <tr>
                        <td colSpan={2} className="px-3 py-2 text-right">
                          Total
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {formatCurrency(selectedEntry.total_debit)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {formatCurrency(selectedEntry.total_credit)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default JournalEntries;
