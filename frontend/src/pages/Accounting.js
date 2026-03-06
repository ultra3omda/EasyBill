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
          <h1 className="text-3xl font-bold text-gray-900">Comptabilité</h1>
          <p className="text-gray-500 mt-1">Gestion comptable automatisée et synchronisée</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Calculator className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Écritures comptables</p>
                <p className="text-2xl font-bold text-gray-900">1,247</p>
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Documents</p>
                <p className="text-2xl font-bold text-blue-600">98</p>
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-teal-100 rounded-lg">
                <BookOpen className="w-6 h-6 text-teal-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Grand livre</p>
                <p className="text-2xl font-bold text-teal-600">Jour</p>
              </div>
            </div>
          </Card>
        </div>

        <Card className="p-8 text-center">
          <Calculator className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Module Comptabilité</h3>
          <p className="text-gray-600 mb-4">Comptabilité automatisée avec synchronisation en temps réel</p>
          <Button className="bg-teal-600 hover:bg-teal-700 text-white">En savoir plus</Button>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Accounting;