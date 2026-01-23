import React from 'react';
import AppLayout from '../components/layout/AppLayout';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Settings as SettingsIcon, User, Building, Bell, Lock } from 'lucide-react';

const Settings = () => {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Paramètres</h1>
          <p className="text-gray-500 mt-1">Configurez votre compte et vos préférences</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-teal-100 rounded-lg">
                <User className="w-6 h-6 text-teal-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Profil utilisateur</h3>
                <p className="text-sm text-gray-600">Gérez vos informations personnelles et préférences</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Building className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Entreprise</h3>
                <p className="text-sm text-gray-600">Informations et paramètres de votre entreprise</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-orange-100 rounded-lg">
                <Bell className="w-6 h-6 text-orange-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Notifications</h3>
                <p className="text-sm text-gray-600">Configurez vos préférences de notification</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-red-100 rounded-lg">
                <Lock className="w-6 h-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Sécurité</h3>
                <p className="text-sm text-gray-600">Mot de passe et paramètres de sécurité</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default Settings;