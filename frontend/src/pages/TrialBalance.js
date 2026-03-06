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
      <div className="space-y-6" data-testid="trial-balance-page">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Balance des Comptes</h1>
            <p className="text-gray-500 mt-1">
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
              <Label className="text-xs text-gray-500">Date de clôture</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-48"
              />
            </div>
            <Button type="submit" className="bg-violet-600 hover:bg-violet-700">
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
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-violet-600" />
            <p className="mt-2 text-gray-500">Chargement...</p>
          </Card>
        ) : !balance || balance.accounts?.length === 0 ? (
          <Card className="p-12 text-center">
            <Scale className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-700">Aucun solde</h3>
            <p className="text-gray-500 mt-1">
              Aucun compte avec un solde non nul
            </p>
            <Button
              className="mt-4 bg-violet-600 hover:bg-violet-700"
              onClick={() => navigate('/journal-entries?action=new')}
            >
              Créer une écriture
            </Button>
          </Card>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-5 bg-gradient-to-br from-green-50 to-green-100/50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-green-600 font-medium">Total Débits</p>
                    <p className="text-2xl font-bold text-green-700">
                      {formatCurrency(balance.totals?.debit)}
                    </p>
                  </div>
                  <div className="p-3 bg-green-200 rounded-full">
                    <FileText className="w-6 h-6 text-green-700" />
                  </div>
                </div>
              </Card>
              <Card className="p-5 bg-gradient-to-br from-red-50 to-red-100/50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-red-600 font-medium">Total Crédits</p>
                    <p className="text-2xl font-bold text-red-700">
                      {formatCurrency(balance.totals?.credit)}
                    </p>
                  </div>
                  <div className="p-3 bg-red-200 rounded-full">
                    <FileText className="w-6 h-6 text-red-700" />
                  </div>
                </div>
              </Card>
              <Card
                className={`p-5 ${
                  balance.totals?.balanced
                    ? 'bg-gradient-to-br from-green-50 to-green-100/50'
                    : 'bg-gradient-to-br from-orange-50 to-orange-100/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p
                      className={`text-sm font-medium ${
                        balance.totals?.balanced ? 'text-green-600' : 'text-orange-600'
                      }`}
                    >
                      Différence
                    </p>
                    <p
                      className={`text-2xl font-bold ${
                        balance.totals?.balanced ? 'text-green-700' : 'text-orange-700'
                      }`}
                    >
                      {formatCurrency(
                        Math.abs(
                          (balance.totals?.debit || 0) - (balance.totals?.credit || 0)
                        )
                      )}
                    </p>
                  </div>
                  <div
                    className={`p-3 rounded-full ${
                      balance.totals?.balanced ? 'bg-green-200' : 'bg-orange-200'
                    }`}
                  >
                    {balance.totals?.balanced ? (
                      <CheckCircle
                        className={`w-6 h-6 ${
                          balance.totals?.balanced ? 'text-green-700' : 'text-orange-700'
                        }`}
                      />
                    ) : (
                      <XCircle className="w-6 h-6 text-orange-700" />
                    )}
                  </div>
                </div>
              </Card>
            </div>

            {/* Balance Table */}
            <Card className="overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Code
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Intitulé
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Type
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Débit
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Crédit
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {typeOrder.map((type) => {
                    const accounts = groupedAccounts[type] || [];
                    if (accounts.length === 0) return null;
                    
                    const typeDebit = accounts.reduce((sum, a) => sum + a.debit, 0);
                    const typeCredit = accounts.reduce((sum, a) => sum + a.credit, 0);
                    
                    return (
                      <React.Fragment key={type}>
                        {/* Type Header */}
                        <tr className="bg-gray-50/50">
                          <td colSpan={3} className="px-4 py-2 font-semibold">
                            <Badge className={getTypeColor(type)}>
                              {getTypeLabel(type)}
                            </Badge>
                            <span className="ml-2 text-gray-600 text-sm">
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
                            className="hover:bg-gray-50 cursor-pointer"
                            onClick={() =>
                              navigate(`/general-ledger?account_code=${account.code}`)
                            }
                          >
                            <td className="px-4 py-2 pl-8 font-mono text-violet-600">
                              {account.code}
                            </td>
                            <td className="px-4 py-2 text-sm">{account.name}</td>
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
                <tfoot className="bg-violet-50 border-t-2 border-violet-200">
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
