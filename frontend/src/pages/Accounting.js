import React from 'react';
import AppLayout from '../components/layout/AppLayout';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Calculator, FileText, BookOpen } from 'lucide-react';

const Accounting = () => {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="page-header-title">Comptabilité</h1>
          <p className="page-header-subtitle">Gestion comptable automatisée et synchronisée</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="stat-surface p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-2xl bg-violet-100 p-3">
                <Calculator className="w-6 h-6 text-violet-700" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Écritures comptables</p>
                <p className="text-2xl font-bold tracking-[-0.03em] text-slate-900">1,247</p>
              </div>
            </div>
          </Card>
          <Card className="stat-surface p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-2xl bg-blue-100 p-3">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Documents</p>
                <p className="text-2xl font-bold text-blue-600">98</p>
              </div>
            </div>
          </Card>
          <Card className="stat-surface p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-2xl bg-amber-100 p-3">
                <BookOpen className="w-6 h-6 text-amber-700" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Grand livre</p>
                <p className="text-2xl font-bold text-amber-700">Jour</p>
              </div>
            </div>
          </Card>
        </div>

        <Card className="p-8 text-center">
          <Calculator className="mx-auto mb-4 h-16 w-16 text-slate-400" />
          <h3 className="mb-2 text-lg font-semibold text-slate-900">Module Comptabilité</h3>
          <p className="mb-4 text-slate-600">Comptabilité automatisée avec synchronisation en temps réel</p>
          <Button>En savoir plus</Button>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Accounting;