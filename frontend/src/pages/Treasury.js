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
          <h1 className="page-header-title">Trésorerie</h1>
          <p className="page-header-subtitle">Gestion des paiements et flux de trésorerie</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="stat-surface p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-2xl bg-green-100 p-3">
                <Wallet className="w-6 h-6 text-green-700" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Solde actuel</p>
                <p className="text-2xl font-bold tracking-[-0.03em] text-slate-900">186,450 TND</p>
              </div>
            </div>
          </Card>
          <Card className="stat-surface p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-2xl bg-blue-100 p-3">
                <CreditCard className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Paiements ce mois</p>
                <p className="text-2xl font-bold text-blue-600">255,000 TND</p>
              </div>
            </div>
          </Card>
          <Card className="stat-surface p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-2xl bg-amber-100 p-3">
                <DollarSign className="w-6 h-6 text-amber-700" />
              </div>
              <div>
                <p className="text-sm text-slate-600">À recevoir</p>
                <p className="text-2xl font-bold text-amber-700">53,920 TND</p>
              </div>
            </div>
          </Card>
        </div>

        <Card className="p-8 text-center">
          <Wallet className="mx-auto mb-4 h-16 w-16 text-slate-400" />
          <h3 className="mb-2 text-lg font-semibold text-slate-900">Module Trésorerie</h3>
          <p className="mb-4 text-slate-600">Gestion complète des flux de trésorerie, paiements et rapprochements bancaires</p>
          <Button>En savoir plus</Button>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Treasury;