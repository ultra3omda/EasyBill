import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { toast } from 'sonner';
import { accountingAPI, companiesAPI } from '../services/api';
import {
  BookOpen,
  Search,
  Filter,
  RefreshCw,
  Calendar,
  ChevronDown,
  ChevronRight,
  FileText,
  Download,
} from 'lucide-react';

const GeneralLedger = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [expandedAccounts, setExpandedAccounts] = useState(new Set());
  const [filters, setFilters] = useState({
    account_code: '',
    date_from: '',
    date_to: '',
  });

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
      fetchAccounts();
      fetchLedger();
    }
  }, [companyId]);

  const fetchAccounts = async () => {
    try {
      const response = await accountingAPI.listAccounts(companyId);
      setAccounts(response.data.filter(a => !a.is_group));
    } catch (error) {
      console.error('Error fetching accounts:', error);
    }
  };

  const fetchLedger = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.account_code) params.account_code = filters.account_code;
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to) params.date_to = filters.date_to;
      
      const response = await accountingAPI.getGeneralLedger(companyId, params);
      setLedger(response.data);
      
      // Expand all by default if filtering by account
      if (filters.account_code) {
        setExpandedAccounts(new Set(response.data.map(a => a.account_code)));
      }
    } catch (error) {
      console.error('Error fetching ledger:', error);
      toast.error('Erreur lors du chargement du grand livre');
    } finally {
      setLoading(false);
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


  const exportToExcel = async () => {
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({ company_id: companyId });
      if (filters.account_code) params.append('account_code', filters.account_code);
      if (filters.date_from) params.append('date_from', filters.date_from);
      if (filters.date_to) params.append('date_to', filters.date_to);
      
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/accounting/general-ledger/export/excel?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Grand_Livre_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('Grand livre exporté en Excel avec succès');
    } catch (error) {
      console.error('Error exporting:', error);
      toast.error('Erreur lors de l\'export Excel');
    }
  };


  const toggleAccount = (code) => {
    setExpandedAccounts(prev => {
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
    setExpandedAccounts(new Set(ledger.map(a => a.account_code)));
  };

  const collapseAll = () => {
    setExpandedAccounts(new Set());
  };

  const getTypeColor = (type) => {
    const colors = {
      equity: 'text-purple-600',
      asset: 'text-blue-600',
      liability: 'text-orange-600',
      expense: 'text-red-600',
      income: 'text-green-600',
    };
    return colors[type] || 'text-gray-600';
  };

  const handleFilter = (e) => {
    e.preventDefault();
    fetchLedger();
  };

  const clearFilters = () => {
    setFilters({
      account_code: '',
      date_from: '',
      date_to: '',
    });
  };

  return (
    <AppLayout>
      <div className="space-y-4" data-testid="general-ledger-page">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="page-header-title">Grand Livre</h1>
            <p className="page-header-subtitle">
              Détail des mouvements par compte comptable
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={expandAll}>
              <ChevronDown className="w-4 h-4 mr-1" />
              Tout déplier
            </Button>
            <Button variant="outline" onClick={collapseAll}>
              <ChevronRight className="w-4 h-4 mr-1" />
              Tout replier
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="p-4">
          <form onSubmit={handleFilter} className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Label className="text-xs text-slate-500">Compte</Label>
              <Select
                value={filters.account_code}
                onValueChange={(value) =>
                  setFilters({ ...filters, account_code: value === 'all' ? '' : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tous les comptes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les comptes</SelectItem>
                  {accounts.map((a) => (
                    <SelectItem key={a.code} value={a.code}>
                      {a.code} - {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-slate-500">Date début</Label>
              <Input
                type="date"
                value={filters.date_from}
                onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs text-slate-500">Date fin</Label>
              <Input
                type="date"
                value={filters.date_to}
                onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
              />
            </div>
            <div className="flex items-end gap-2">
              <Button type="submit">
                <Filter className="w-4 h-4 mr-1" />
                Filtrer
              </Button>
              <Button type="button" variant="outline" onClick={clearFilters}>
                Effacer
              </Button>
              <Button type="button" variant="outline" onClick={exportToExcel}>
                <Download className="w-4 h-4 mr-2" />
                Exporter Excel
              </Button>

            </div>
          </form>
        </Card>

        {/* Ledger Content */}
        {loading ? (
          <Card className="p-12 text-center">
            <RefreshCw className="mx-auto h-8 w-8 animate-spin text-primary" />
            <p className="mt-2 text-slate-500">Chargement...</p>
          </Card>
        ) : ledger.length === 0 ? (
          <Card className="p-12 text-center">
            <BookOpen className="mx-auto mb-4 h-16 w-16 text-slate-300" />
            <h3 className="text-lg font-semibold text-slate-700">Aucune écriture</h3>
            <p className="mt-1 text-slate-500">
              Aucune écriture comptable validée pour la période sélectionnée
            </p>
            <Button className="mt-4" onClick={() => navigate('/journal-entries?action=new')}>
              Créer une écriture
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {ledger.map((account) => (
              <Card key={account.account_code} className="overflow-hidden">
                {/* Account Header */}
                <div
                  className="flex cursor-pointer items-center justify-between bg-slate-50/80 p-4 hover:bg-slate-100"
                  onClick={() => toggleAccount(account.account_code)}
                >
                  <div className="flex items-center gap-3">
                    {expandedAccounts.has(account.account_code) ? (
                      <ChevronDown className="w-5 h-5 text-slate-500" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-slate-500" />
                    )}
                    <span className="font-mono font-bold text-violet-700">
                      {account.account_code}
                    </span>
                    <span className="font-medium text-slate-900">{account.account_name}</span>
                    <Badge variant="outline" className={getTypeColor(account.account_type)}>
                      {account.account_type}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div>
                      <span className="text-slate-500">Débit:</span>{' '}
                      <span className="font-mono font-medium">
                        {formatCurrency(account.total_debit)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">Crédit:</span>{' '}
                      <span className="font-mono font-medium">
                        {formatCurrency(account.total_credit)}
                      </span>
                    </div>
                    <div className="font-bold">
                      <span className="text-slate-500">Solde:</span>{' '}
                      <span
                        className={`font-mono ${
                          account.balance >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {formatCurrency(account.balance)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Transactions */}
                {expandedAccounts.has(account.account_code) && (
                  <div className="border-t">
                    <table className="w-full">
                      <thead className="bg-slate-50/80">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">
                            Date
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">
                            N° Écriture
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">
                            Libellé
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">
                            Débit
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">
                            Crédit
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/80">
                        {account.transactions.map((tx, idx) => (
                          <tr
                            key={idx}
                            className="cursor-pointer hover:bg-slate-50"
                            onClick={() => navigate(`/journal-entries?id=${tx.entry_id}`)}
                          >
                            <td className="px-4 py-2 text-sm">{formatDate(tx.date)}</td>
                            <td className="px-4 py-2 text-sm font-mono text-violet-700">
                              {tx.entry_number}
                            </td>
                            <td className="px-4 py-2 text-sm text-slate-700">
                              {tx.line_description || tx.description}
                            </td>
                            <td className="px-4 py-2 text-sm text-right font-mono">
                              {tx.debit ? formatCurrency(tx.debit) : ''}
                            </td>
                            <td className="px-4 py-2 text-sm text-right font-mono">
                              {tx.credit ? formatCurrency(tx.credit) : ''}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default GeneralLedger;
