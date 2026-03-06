import React from 'react';
import AppLayout from '../components/layout/AppLayout';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Wallet, CreditCard, DollarSign } from 'lucide-react';

const Treasury = () => {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Trésorerie</h1>
          <p className="text-gray-500 mt-1">Gestion des paiements et flux de trésorerie</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <Wallet className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Solde actuel</p>
                <p className="text-2xl font-bold text-gray-900">186,450 TND</p>
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <CreditCard className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Paiements ce mois</p>
                <p className="text-2xl font-bold text-blue-600">255,000 TND</p>
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-orange-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">À recevoir</p>
                <p className="text-2xl font-bold text-orange-600">53,920 TND</p>
              </div>
            </div>
          </Card>
        </div>

        <Card className="p-8 text-center">
          <Wallet className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Module Trésorerie</h3>
          <p className="text-gray-600 mb-4">Gestion complète des flux de trésorerie, paiements et rapprochements bancaires</p>
          <Button className="bg-teal-600 hover:bg-teal-700 text-white">En savoir plus</Button>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Treasury;