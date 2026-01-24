import React from 'react';
import { useLocation } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Plus, Construction } from 'lucide-react';

// Mapping des routes vers les titres
const routeTitles = {
  '/warehouses': 'Entrepôts',
  '/inventory': 'Inventaire',
  '/stock-movements': 'Mouvements de Stock',
  '/delivery-notes': 'Bons de livraison',
  '/exit-vouchers': 'Bons de sortie',
  '/credit-notes': "Factures d'avoir",
  '/expense-reports': 'Notes de débours',
  '/sales-payments': 'Paiements (Ventes)',
  '/reminders': 'Rappels',
  '/pos': 'Points de vente',
  '/reception-notes': 'Bons de réception',
  '/purchase-orders': 'Bons de commande',
  '/supplier-invoices': 'Factures fournisseur',
  '/services': 'Prestations de service',
  '/purchase-payments': 'Paiements (Achats)',
  '/withholding-tax': 'Retenue à la source',
  '/purchase-reminders': "Rappels d'achats",
  '/chart-of-accounts': 'Plan comptable',
  '/journal-entries': 'Écritures Comptables',
  '/ledgers': 'Grands Livres',
  '/balances': 'Balances',
  '/legal-journals': 'Journaux légaux',
  '/fiscal-years': 'Exercices comptables',
  '/financial-statements': 'États comptables'
};

const PlaceholderPage = () => {
  const location = useLocation();
  const title = routeTitles[location.pathname] || 'Page';

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
            <p className="text-gray-500 mt-1">Gestion des {title.toLowerCase()}</p>
          </div>
          <Button className="bg-violet-600 hover:bg-violet-700 text-white flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Nouveau
          </Button>
        </div>

        {/* Placeholder Content */}
        <Card className="p-12">
          <div className="text-center">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Construction className="w-8 h-8 text-amber-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Module en cours de développement</h2>
            <p className="text-gray-500 max-w-md mx-auto">
              Cette fonctionnalité sera bientôt disponible. Nous travaillons activement sur l'implémentation de ce module.
            </p>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
};

export default PlaceholderPage;
