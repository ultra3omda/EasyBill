import React, { useState, useEffect, useMemo } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { TableSkeleton } from '../components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { toast } from 'sonner';
import { accountingAPI, companiesAPI, accountingMappingsAPI } from '../services/api';
import {
  BookOpen,
  Search,
  Plus,
  ChevronRight,
  ChevronDown,
  Filter,
  Folder,
  FolderOpen,
  FileText,
  RefreshCw,
  Edit,
  Trash2,
  Download,
} from 'lucide-react';

const ChartOfAccounts = () => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [expandedNodes, setExpandedNodes] = useState(new Set(['1', '2', '3', '4', '5', '6', '7']));
  const [companyId, setCompanyId] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [chartMeta, setChartMeta] = useState(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    type: 'asset',
    parent_code: '',
    is_group: false,
    notes: '',
  });

  const accountTypes = [
    { value: 'all', label: 'Tous les types', color: 'gray' },
    { value: 'equity', label: 'Capitaux propres', color: 'purple' },
    { value: 'asset', label: 'Actifs', color: 'blue' },
    { value: 'liability', label: 'Passifs', color: 'orange' },
    { value: 'expense', label: 'Charges', color: 'red' },
    { value: 'income', label: 'Produits', color: 'green' },
  ];

  const getTypeColor = (type) => {
    const colors = {
      equity: 'bg-purple-100 text-purple-800',
      asset: 'bg-blue-100 text-blue-800',
      liability: 'bg-orange-100 text-orange-800',
      expense: 'bg-red-100 text-red-800',
      income: 'bg-green-100 text-green-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const getTypeLabel = (type) => {
    const labels = {
      equity: 'Capitaux',
      asset: 'Actif',
      liability: 'Passif',
      expense: 'Charge',
      income: 'Produit',
    };
    return labels[type] || type;
  };

  useEffect(() => {
    const fetchCompanyId = async () => {
      try {
        const response = await companiesAPI.list();
        if (response.data.length > 0) {
          setCompanyId(response.data[0].id);
        }
      } catch (error) {
        console.error('Error fetching company:', error);
        toast.error('Erreur lors du chargement de l\'entreprise');
      }
    };
    fetchCompanyId();
  }, []);

  useEffect(() => {
    if (companyId) {
      fetchAccounts();
    }
  }, [companyId, typeFilter]);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const params = {};
      if (typeFilter !== 'all') {
        params.type = typeFilter;
      }
      const response = await accountingAPI.listAccounts(companyId, params);
      setAccounts(response.data);
      const metaResponse = await accountingMappingsAPI.getChartMetadata(companyId);
      setChartMeta(metaResponse.data);
    } catch (error) {
      console.error('Error fetching accounts:', error);
      toast.error('Erreur lors du chargement du plan comptable');
    } finally {
      setLoading(false);
    }
  };

  // Build hierarchical tree structure
  const accountTree = useMemo(() => {
    const filtered = searchTerm
      ? accounts.filter(
          (a) =>
            a.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
            a.name.toLowerCase().includes(searchTerm.toLowerCase())
        )
      : accounts;

    // If searching, return flat list
    if (searchTerm) {
      return filtered.sort((a, b) => a.code.localeCompare(b.code));
    }

    // Build tree
    const tree = [];
    const accountMap = new Map();

    // First pass: create map
    filtered.forEach((account) => {
      accountMap.set(account.code, { ...account, children: [] });
    });

    // Second pass: build tree
    filtered.forEach((account) => {
      const node = accountMap.get(account.code);
      if (account.parent_code && accountMap.has(account.parent_code)) {
        accountMap.get(account.parent_code).children.push(node);
      } else if (!account.parent_code || !accountMap.has(account.parent_code)) {
        // Root level or orphan
        if (account.code.length <= 1) {
          tree.push(node);
        } else {
          // Find nearest parent
          let parentCode = account.code.slice(0, -1);
          while (parentCode.length > 0) {
            if (accountMap.has(parentCode)) {
              accountMap.get(parentCode).children.push(node);
              break;
            }
            parentCode = parentCode.slice(0, -1);
          }
          if (parentCode.length === 0) {
            tree.push(node);
          }
        }
      }
    });

    // Sort children
    const sortChildren = (nodes) => {
      nodes.sort((a, b) => a.code.localeCompare(b.code));
      nodes.forEach((node) => {
        if (node.children.length > 0) {
          sortChildren(node.children);
        }
      });
    };
    sortChildren(tree);

    return tree;
  }, [accounts, searchTerm]);

  const toggleNode = (code) => {
    setExpandedNodes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(code)) {
        newSet.delete(code);
      } else {
        newSet.add(code);
      }
      return newSet;
    });
  };

  const expandAll = () => {
    const allCodes = accounts.filter((a) => a.is_group).map((a) => a.code);
    setExpandedNodes(new Set(allCodes));
  };

  const collapseAll = () => {
    setExpandedNodes(new Set());
  };

  const handleSeedChartOfAccounts = async () => {
    try {
      setSeeding(true);
      const response = await accountingMappingsAPI.initializeChart(companyId, false);
      toast.success(`${response.data.count || 0} comptes initialisés`);
      fetchAccounts();
    } catch (error) {
      console.error('Error seeding chart of accounts:', error);
      toast.error('Erreur lors de la création du plan comptable');
    } finally {
      setSeeding(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingAccount) {
        await accountingAPI.updateAccount(companyId, editingAccount.id, {
          name: formData.name,
          notes: formData.notes,
          is_active: true,
        });
        toast.success('Compte mis à jour');
      } else {
        await accountingAPI.createAccount(companyId, formData);
        toast.success('Compte créé');
      }
      setShowAddModal(false);
      setEditingAccount(null);
      resetForm();
      fetchAccounts();
    } catch (error) {
      console.error('Error saving account:', error);
      toast.error(error.response?.data?.detail || 'Erreur lors de l\'enregistrement');
    }
  };

  const handleDelete = async (account) => {
    if (account.is_system) {
      toast.error('Impossible de supprimer un compte système');
      return;
    }
    if (!window.confirm(`Supprimer le compte ${account.code} - ${account.name} ?`)) {
      return;
    }
    try {
      await accountingAPI.deleteAccount(companyId, account.id);
      toast.success('Compte supprimé');
      fetchAccounts();
    } catch (error) {
      console.error('Error deleting account:', error);
      toast.error(error.response?.data?.detail || 'Erreur lors de la suppression');
    }
  };

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      type: 'asset',
      parent_code: '',
      is_group: false,
      notes: '',
    });
  };

  const openEditModal = (account) => {
    setEditingAccount(account);
    setFormData({
      code: account.code,
      name: account.name,
      type: account.type,
      parent_code: account.parent_code || '',
      is_group: account.is_group,
      notes: account.notes || '',
    });
    setShowAddModal(true);
  };

  const renderAccountNode = (node, depth = 0) => {
    const isExpanded = expandedNodes.has(node.code);
    const hasChildren = node.children && node.children.length > 0;
    const paddingLeft = depth * 24;

    return (
      <div key={node.code}>
        <div
          className={`flex items-center border-b border-slate-100 px-3 py-2 hover:bg-slate-50 transition-colors ${
            node.is_group ? 'font-medium' : ''
          }`}
          style={{ paddingLeft: `${paddingLeft + 12}px` }}
        >
          {/* Expand/Collapse button */}
          <div className="w-6 flex-shrink-0">
            {hasChildren ? (
              <button
                onClick={() => toggleNode(node.code)}
                className="rounded p-0.5 hover:bg-slate-200"
                data-testid={`toggle-${node.code}`}
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                )}
              </button>
            ) : null}
          </div>

          {/* Icon */}
          <div className="w-6 flex-shrink-0">
            {node.is_group ? (
              isExpanded ? (
                <FolderOpen className="w-4 h-4 text-amber-500" />
              ) : (
                <Folder className="w-4 h-4 text-amber-500" />
              )
            ) : (
              <FileText className="w-4 h-4 text-slate-400" />
            )}
          </div>

          {/* Code */}
          <div className="w-20 flex-shrink-0 font-mono text-sm text-violet-700">
            {node.code}
          </div>

          {/* Name */}
          <div className="flex-1 truncate text-sm text-slate-800" title={node.name}>
            {node.name}
          </div>

          {/* Type badge */}
          <div className="w-24 flex-shrink-0">
            <Badge className={`text-xs ${getTypeColor(node.type)}`}>
              {getTypeLabel(node.type)}
            </Badge>
          </div>

          {/* System indicator */}
          <div className="w-20 flex-shrink-0 text-center">
            {node.is_system ? (
              <span className="text-xs text-slate-400">Système</span>
            ) : (
              <span className="text-xs text-violet-600">Personnalisé</span>
            )}
          </div>

          {/* Actions */}
          <div className="w-20 flex-shrink-0 flex gap-1 justify-end">
            <button
              onClick={() => openEditModal(node)}
              className="rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-violet-600"
              title="Modifier"
              data-testid={`edit-${node.code}`}
            >
              <Edit className="w-4 h-4" />
            </button>
            {!node.is_system && (
              <button
                onClick={() => handleDelete(node)}
                className="rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-red-600"
                title="Supprimer"
                data-testid={`delete-${node.code}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Children */}
        {isExpanded && hasChildren && (
          <div>
            {node.children.map((child) => renderAccountNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // Stats
  const stats = useMemo(() => {
    return {
      total: accounts.length,
      groups: accounts.filter((a) => a.is_group).length,
      byType: accountTypes
        .filter((t) => t.value !== 'all')
        .map((t) => ({
          ...t,
          count: accounts.filter((a) => a.type === t.value).length,
        })),
    };
  }, [accounts]);

  return (
    <AppLayout>
      <div className="page-shell section-stack" data-testid="chart-of-accounts-page">
        {/* Header */}
        <div className="page-header">
          <div>
            <h1 className="page-header-title">Plan Comptable</h1>
            <p className="page-header-subtitle">
              Plan comptable configurable par société et pays
            </p>
            {chartMeta && (
              <div className="flex gap-2 mt-3 flex-wrap">
                <Badge variant="outline">Pays {chartMeta.active_chart_country_code || chartMeta.country_code || 'TN'}</Badge>
                <Badge variant="outline">{chartMeta.active_chart_code_system || 'Template standard'}</Badge>
                <Badge variant="outline">{chartMeta.semantic_account_count || 0} comptes sémantiques</Badge>
              </div>
            )}
          </div>
          <Button
            onClick={() => {
              resetForm();
              setEditingAccount(null);
              setShowAddModal(true);
            }}
            data-testid="add-account-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nouveau compte
          </Button>
        </div>

        <Card className="border-blue-200 bg-blue-50/70">
          <div className="p-5">
            <p className="text-sm font-semibold text-blue-900">Configuration comptable sensible</p>
            <p className="mt-2 text-sm text-blue-800">
              Le plan comptable structure toutes les imputations, mappings et écritures générées. Toute modification doit rester cohérente avec les règles de la société et le référentiel actif.
            </p>
          </div>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-7">
          <Card className="stat-surface interactive-lift p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-violet-100 p-2.5">
                <BookOpen className="w-5 h-5 text-violet-700" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Total</p>
                <p className="text-xl font-bold tracking-[-0.03em] text-slate-900">{stats.total}</p>
              </div>
            </div>
          </Card>
          {stats.byType.map((type) => (
            <Card key={type.value} className="stat-surface interactive-lift p-4">
              <div>
                <p className="text-xs text-slate-500">{type.label}</p>
                <p className="text-xl font-bold tracking-[-0.03em] text-slate-900">{type.count}</p>
              </div>
            </Card>
          ))}
        </div>

        {/* Filters & Search */}
        <Card className="p-4 md:p-5">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Rechercher par code ou nom..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-11"
                data-testid="search-input"
              />
            </div>
            <div className="flex gap-2">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-48" data-testid="type-filter">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {accountTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={expandAll} title="Tout déplier">
                <ChevronDown className="w-4 h-4" />
              </Button>
              <Button variant="outline" onClick={collapseAll} title="Tout replier">
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button variant="outline" onClick={fetchAccounts} title="Actualiser">
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>

        {/* Accounts Tree */}
        <Card className="overflow-hidden">
          {/* Header */}
          <div className="flex items-center border-b bg-slate-50/80 px-3 py-3 text-sm font-medium text-slate-600">
            <div className="w-6 flex-shrink-0"></div>
            <div className="w-6 flex-shrink-0"></div>
            <div className="w-20 flex-shrink-0">Code</div>
            <div className="flex-1">Intitulé du compte</div>
            <div className="w-24 flex-shrink-0">Type</div>
            <div className="w-20 flex-shrink-0 text-center">Source</div>
            <div className="w-20 flex-shrink-0 text-right">Actions</div>
          </div>

          {/* Content */}
          <div className="max-h-[600px] overflow-y-auto">
            {loading ? (
              <div className="p-4">
                <TableSkeleton rows={10} columns={6} showToolbar={false} />
              </div>
            ) : searchTerm ? (
              // Flat search results
              accountTree.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  Aucun compte trouvé pour "{searchTerm}"
                </div>
              ) : (
                accountTree.map((account) => (
                  <div
                    key={account.code}
                    className="flex items-center border-b border-slate-100 px-3 py-2 hover:bg-slate-50"
                  >
                    <div className="w-6 flex-shrink-0"></div>
                    <div className="w-6 flex-shrink-0">
                      {account.is_group ? (
                        <Folder className="w-4 h-4 text-amber-500" />
                      ) : (
                        <FileText className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                    <div className="w-20 flex-shrink-0 font-mono text-sm text-violet-700">
                      {account.code}
                    </div>
                    <div className="flex-1 truncate text-sm text-slate-800">
                      {account.name}
                    </div>
                    <div className="w-24 flex-shrink-0">
                      <Badge className={`text-xs ${getTypeColor(account.type)}`}>
                        {getTypeLabel(account.type)}
                      </Badge>
                    </div>
                    <div className="w-20 flex-shrink-0 text-center">
                      {account.is_system ? (
                        <span className="text-xs text-slate-400">Système</span>
                      ) : (
                        <span className="text-xs text-violet-600">Personnalisé</span>
                      )}
                    </div>
                    <div className="w-20 flex-shrink-0 flex gap-1 justify-end">
                      <button
                        onClick={() => openEditModal(account)}
                        className="rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-violet-600"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      {!account.is_system && (
                        <button
                          onClick={() => handleDelete(account)}
                          className="rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )
            ) : accountTree.length === 0 && !loading ? (
              <div className="py-16 text-center">
                <BookOpen className="mx-auto mb-4 w-16 h-16 text-slate-300" />
                <h3 className="mb-2 text-lg font-semibold text-slate-700">
                  Plan comptable vide
                </h3>
                <p className="mx-auto mb-6 max-w-md text-slate-500">
                  Votre plan comptable n'a pas encore été initialisé. Cliquez sur le bouton ci-dessous pour créer automatiquement le plan comptable tunisien (SCE).
                </p>
                <Button
                  onClick={handleSeedChartOfAccounts}
                  disabled={seeding}
                  data-testid="seed-chart-btn"
                >
                  {seeding ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Création en cours...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Initialiser le plan comptable tunisien
                    </>
                  )}
                </Button>
              </div>
            ) : (
              accountTree.map((node) => renderAccountNode(node))
            )}
          </div>
        </Card>

        {/* Add/Edit Modal */}
        <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingAccount ? 'Modifier le compte' : 'Nouveau compte'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="code">Code *</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({ ...formData, code: e.target.value })
                    }
                    disabled={editingAccount?.is_system}
                    required
                    placeholder="ex: 4111"
                    data-testid="account-code-input"
                  />
                </div>
                <div>
                  <Label htmlFor="type">Type *</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) =>
                      setFormData({ ...formData, type: value })
                    }
                    disabled={editingAccount?.is_system}
                  >
                    <SelectTrigger data-testid="account-type-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="equity">Capitaux propres</SelectItem>
                      <SelectItem value="asset">Actif</SelectItem>
                      <SelectItem value="liability">Passif</SelectItem>
                      <SelectItem value="expense">Charge</SelectItem>
                      <SelectItem value="income">Produit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="name">Intitulé *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                  placeholder="Nom du compte"
                  data-testid="account-name-input"
                />
              </div>

              <div>
                <Label htmlFor="parent_code">Compte parent</Label>
                <Input
                  id="parent_code"
                  value={formData.parent_code}
                  onChange={(e) =>
                    setFormData({ ...formData, parent_code: e.target.value })
                  }
                  disabled={editingAccount?.is_system}
                  placeholder="ex: 41"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_group"
                  checked={formData.is_group}
                  onChange={(e) =>
                    setFormData({ ...formData, is_group: e.target.checked })
                  }
                  disabled={editingAccount?.is_system}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="is_group">Compte de regroupement</Label>
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  placeholder="Notes ou commentaires"
                  rows={3}
                  data-testid="account-notes-input"
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddModal(false)}
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  data-testid="save-account-btn"
                >
                  {editingAccount ? 'Mettre à jour' : 'Créer'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default ChartOfAccounts;
