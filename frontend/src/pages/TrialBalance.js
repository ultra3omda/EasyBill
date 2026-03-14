import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { accountingAPI, companiesAPI } from '../services/api';
import {
  Scale,
  RefreshCw,
  Calendar,
  CheckCircle,
  XCircle,
  Download,
  FileText,
  Filter,
} from 'lucide-react';

const TrialBalance = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState(null);
  const [balance, setBalance] = useState(null);
  const [dateTo, setDateTo] = useState('');

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
      fetchBalance();
    }
  }, [companyId]);

  const fetchBalance = async () => {
    try {
      setLoading(true);
      const params = {};
      if (dateTo) params.date_to = dateTo;
      
      const response = await accountingAPI.getTrialBalance(companyId, params);
      setBalance(response.data);
    } catch (error) {
      console.error('Error fetching balance:', error);
      toast.error('Erreur lors du chargement de la balance');
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = async () => {
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({ company_id: companyId });
      if (dateTo) params.append('date_to', dateTo);
      
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/accounting/trial-balance/export/excel?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (!response.ok) {
        throw new Error('Export failed');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Balance_Comptes_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('Balance exportée en Excel avec succès');
    } catch (error) {
      console.error('Error exporting:', error);
      toast.error('Erreur lors de l\'export Excel');
    }
  };


  const formatCurrency = (value) => {
    return new Intl.NumberFormat('fr-TN', {
      style: 'currency',
      currency: 'TND',
      minimumFractionDigits: 3,
    }).format(value || 0);
  };

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

  const handleFilter = (e) => {
    e.preventDefault();
    fetchBalance();
  };

  // Group accounts by type
  const groupedAccounts = balance?.accounts
    ? balance.accounts.reduce((acc, account) => {
        const type = account.type || 'other';
        if (!acc[type]) acc[type] = [];
        acc[type].push(account);
        return acc;
      }, {})
    : {};

  const typeOrder = ['asset', 'liability', 'equity', 'income', 'expense'];

  return (
    <AppLayout>
      <div className="space-y-4" data-testid="trial-balance-page">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="page-header-title">Balance des Comptes</h1>
            <p className="page-header-subtitle">
              État récapitulatif des soldes de tous les comptes
            </p>
          </div>
          {balance?.totals && (
            <div className="flex items-center gap-2">
              {balance.totals.balanced ? (
                <Badge className="bg-green-100 text-green-800 gap-1">
                  <CheckCircle className="w-4 h-4" />
                  Équilibrée
                </Badge>
              ) : (
                <Badge className="bg-red-100 text-red-800 gap-1">
                  <XCircle className="w-4 h-4" />
                  Déséquilibrée
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Filter */}
        <Card className="p-4">
          <form onSubmit={handleFilter} className="flex flex-col md:flex-row gap-4 items-end">
            <div>
              <Label className="text-xs text-slate-500">Date de clôture</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-48"
              />
            </div>
            <Button type="submit">
              <Filter className="w-4 h-4 mr-1" />
              Actualiser
            </Button>
            {dateTo && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDateTo('');
                  setTimeout(fetchBalance, 0);
                }}
              >
                Balance actuelle
            <Button
              type="button"
              variant="outline"
              onClick={exportToExcel}
            >
              <Download className="w-4 h-4 mr-2" />
              Exporter Excel
            </Button>

              </Button>
            )}
          </form>
        </Card>

        {/* Balance Content */}
        {loading ? (
          <Card className="p-12 text-center">
            <RefreshCw className="mx-auto h-8 w-8 animate-spin text-primary" />
            <p className="mt-2 text-slate-500">Chargement...</p>
          </Card>
        ) : !balance || balance.accounts?.length === 0 ? (
          <Card className="p-12 text-center">
            <Scale className="mx-auto mb-4 h-16 w-16 text-slate-300" />
            <h3 className="text-lg font-semibold text-slate-700">Aucun solde</h3>
            <p className="mt-1 text-slate-500">
              Aucun compte avec un solde non nul
            </p>
            <Button className="mt-4" onClick={() => navigate('/journal-entries?action=new')}>
              Créer une écriture
            </Button>
          </Card>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="stat-surface p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Total Débits</p>
                    <p className="text-2xl font-bold tracking-[-0.03em] text-slate-900">
                      {formatCurrency(balance.totals?.debit)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-green-100 p-3">
                    <FileText className="w-6 h-6 text-green-700" />
                  </div>
                </div>
              </Card>
              <Card className="stat-surface p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Total Crédits</p>
                    <p className="text-2xl font-bold tracking-[-0.03em] text-slate-900">
                      {formatCurrency(balance.totals?.credit)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-rose-100 p-3">
                    <FileText className="w-6 h-6 text-rose-700" />
                  </div>
                </div>
              </Card>
              <Card
                className="stat-surface p-5"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p
                      className="text-sm font-medium text-slate-500"
                    >
                      Différence
                    </p>
                    <p
                      className="text-2xl font-bold tracking-[-0.03em] text-slate-900"
                    >
                      {formatCurrency(
                        Math.abs(
                          (balance.totals?.debit || 0) - (balance.totals?.credit || 0)
                        )
                      )}
                    </p>
                  </div>
                  <div
                    className={`rounded-2xl p-3 ${
                      balance.totals?.balanced ? 'bg-green-100' : 'bg-amber-100'
                    }`}
                  >
                    {balance.totals?.balanced ? (
                      <CheckCircle
                        className={`w-6 h-6 ${
                          balance.totals?.balanced ? 'text-green-700' : 'text-amber-700'
                        }`}
                      />
                    ) : (
                      <XCircle className="w-6 h-6 text-amber-700" />
                    )}
                  </div>
                </div>
              </Card>
            </div>

            {/* Balance Table */}
            <Card className="overflow-hidden">
              <table className="w-full">
                <thead className="border-b bg-slate-50/80">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                      Code
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                      Intitulé
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                      Type
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                      Débit
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                      Crédit
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/80">
                  {typeOrder.map((type) => {
                    const accounts = groupedAccounts[type] || [];
                    if (accounts.length === 0) return null;
                    
                    const typeDebit = accounts.reduce((sum, a) => sum + a.debit, 0);
                    const typeCredit = accounts.reduce((sum, a) => sum + a.credit, 0);
                    
                    return (
                      <React.Fragment key={type}>
                        {/* Type Header */}
                        <tr className="bg-slate-50/70">
                          <td colSpan={3} className="px-4 py-2 font-semibold">
                            <Badge className={getTypeColor(type)}>
                              {getTypeLabel(type)}
                            </Badge>
                            <span className="ml-2 text-sm text-slate-600">
                              ({accounts.length} comptes)
                            </span>
                          </td>
                          <td className="px-4 py-2 text-right font-semibold font-mono text-green-600">
                            {formatCurrency(typeDebit)}
                          </td>
                          <td className="px-4 py-2 text-right font-semibold font-mono text-red-600">
                            {formatCurrency(typeCredit)}
                          </td>
                        </tr>
                        {/* Accounts */}
                        {accounts.map((account) => (
                          <tr
                            key={account.code}
                            className="cursor-pointer hover:bg-slate-50"
                            onClick={() =>
                              navigate(`/general-ledger?account_code=${account.code}`)
                            }
                          >
                            <td className="px-4 py-2 pl-8 font-mono text-violet-700">
                              {account.code}
                            </td>
                            <td className="px-4 py-2 text-sm text-slate-700">{account.name}</td>
                            <td className="px-4 py-2 text-center">
                              <Badge variant="outline" className="text-xs">
                                {getTypeLabel(account.type)}
                              </Badge>
                            </td>
                            <td className="px-4 py-2 text-right font-mono">
                              {account.debit > 0 ? formatCurrency(account.debit) : ''}
                            </td>
                            <td className="px-4 py-2 text-right font-mono">
                              {account.credit > 0 ? formatCurrency(account.credit) : ''}
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </tbody>
                <tfoot className="border-t-2 border-violet-200 bg-violet-50/70">
                  <tr className="font-bold">
                    <td colSpan={3} className="px-4 py-3 text-right text-violet-900">
                      TOTAUX
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-green-700">
                      {formatCurrency(balance.totals?.debit)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-red-700">
                      {formatCurrency(balance.totals?.credit)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default TrialBalance;
