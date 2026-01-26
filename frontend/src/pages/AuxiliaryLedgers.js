import React, { useState, useEffect } from 'react';
import { useCompany } from '../hooks/useCompany';
import AppLayout from '../components/layout/AppLayout';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { BookMarked, Download, Users, Building } from 'lucide-react';
import { toast } from '../hooks/use-toast';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const AuxiliaryLedgers = () => {
  const { currentCompany } = useCompany();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const exportLedger = async (ledgerType) => {
    if (!currentCompany) return;
    
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({ 
        company_id: currentCompany.id,
        ledger_type: ledgerType
      });
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      
      const response = await fetch(
        `${API_URL}/api/accounting/auxiliary-ledger/export/excel?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const typeName = ledgerType === 'customers' ? 'Clients' : 'Fournisseurs';
      link.download = `Livre_${typeName}_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast({
        title: 'Succès',
        description: `Livre des ${typeName.toLowerCase()} exporté avec succès`
      });
    } catch (error) {
      console.error('Error exporting:', error);
      toast({
        title: 'Erreur',
        description: 'Erreur lors de l\'export',
        variant: 'destructive'
      });
    }
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Livres de Tiers</h1>
          <p className="text-gray-500 mt-1">Exports comptables clients et fournisseurs</p>
        </div>

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Filtres de période</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Date de début</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div>
              <Label>Date de fin</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Livre Clients */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Livre des Clients</h2>
                <p className="text-sm text-gray-500">Compte 411 - Créances clients</p>
              </div>
            </div>
            
            <p className="text-gray-600 mb-6">
              Exportez le livre auxiliaire des clients avec le détail de toutes les transactions et soldes par client.
            </p>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <span className="text-sm">Format</span>
                <Badge className="bg-green-100 text-green-800">Excel (.xlsx)</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <span className="text-sm">Contenu</span>
                <span className="text-xs text-gray-600">Une feuille par client</span>
              </div>
            </div>
            
            <Button 
              className="w-full mt-6 bg-purple-600 hover:bg-purple-700"
              onClick={() => exportLedger('customers')}
            >
              <Download className="w-4 h-4 mr-2" />
              Exporter Livre Clients
            </Button>
          </Card>

          {/* Livre Fournisseurs */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-orange-100 rounded-lg">
                <Building className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Livre des Fournisseurs</h2>
                <p className="text-sm text-gray-500">Compte 401 - Dettes fournisseurs</p>
              </div>
            </div>
            
            <p className="text-gray-600 mb-6">
              Exportez le livre auxiliaire des fournisseurs avec le détail de toutes les transactions et soldes par fournisseur.
            </p>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <span className="text-sm">Format</span>
                <Badge className="bg-green-100 text-green-800">Excel (.xlsx)</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <span className="text-sm">Contenu</span>
                <span className="text-xs text-gray-600">Une feuille par fournisseur</span>
              </div>
            </div>
            
            <Button 
              className="w-full mt-6 bg-orange-600 hover:bg-orange-700"
              onClick={() => exportLedger('suppliers')}
            >
              <Download className="w-4 h-4 mr-2" />
              Exporter Livre Fournisseurs
            </Button>
          </Card>
        </div>

        {/* Info Card */}
        <Card className="p-6 bg-blue-50 border-blue-200">
          <div className="flex gap-3">
            <BookMarked className="w-6 h-6 text-blue-600 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-blue-900">À propos des livres de tiers</h3>
              <p className="text-sm text-blue-800 mt-2">
                Les livres de tiers (clients et fournisseurs) détaillent toutes les transactions comptables 
                avec vos partenaires commerciaux. Chaque feuille Excel contient les écritures d'un client 
                ou fournisseur avec le calcul automatique des soldes.
              </p>
              <ul className="text-sm text-blue-800 mt-3 space-y-1 list-disc list-inside">
                <li>Détail de chaque transaction (débit/crédit)</li>
                <li>Total par client/fournisseur</li>
                <li>Solde final (créance ou dette)</li>
                <li>Format Excel professionnel</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
};

export default AuxiliaryLedgers;
