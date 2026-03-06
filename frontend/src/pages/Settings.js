import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Switch } from '../components/ui/switch';
import { User, Building, Bell, Lock, Mail, Phone, Save, Edit, Percent, FileText } from 'lucide-react';
import { toast } from '../hooks/use-toast';
import { useCompany } from '../hooks/useCompany';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const Settings = () => {
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [profileData, setProfileData] = useState({
    full_name: '',
    email: '',
    phone: ''
  });
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [notificationPrefs, setNotificationPrefs] = useState({
    email_reminders: true,
    invoice_updates: true,
    payment_notifications: true,
    system_updates: false
  });

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUserData(res.data);
      setProfileData({
        full_name: res.data.full_name || '',
        email: res.data.email || '',
        phone: res.data.phone || ''
      });
      if (res.data.preferences?.notifications) {
        setNotificationPrefs(prev => ({
          ...prev,
          ...res.data.preferences.notifications
        }));
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API_URL}/api/auth/me`,
        profileData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast({
        title: "Succès",
        description: "Profil mis à jour avec succès"
      });
      loadUserData();
    } catch (error) {
      toast({
        title: "Erreur",
        description: error.response?.data?.detail || "Erreur lors de la mise à jour",
        variant: "destructive"
      });
    }
  };

  const updatePassword = async () => {
    if (passwordData.new_password !== passwordData.confirm_password) {
      toast({
        title: "Erreur",
        description: "Les mots de passe ne correspondent pas",
        variant: "destructive"
      });
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API_URL}/api/auth/password`,
        {
          old_password: passwordData.current_password,
          new_password: passwordData.new_password,
          confirm_password: passwordData.confirm_password
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast({
        title: "Succès",
        description: "Mot de passe modifié avec succès"
      });
      setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
    } catch (error) {
      toast({
        title: "Erreur",
        description: error.response?.data?.detail || "Erreur lors du changement de mot de passe",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="text-center py-20">Chargement...</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Paramètres</h1>
          <p className="text-gray-500 mt-1">Gérez votre compte et vos préférences</p>
        </div>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile">
              <User className="w-4 h-4 mr-2" />
              Profil
            </TabsTrigger>
            <TabsTrigger value="company">
              <Building className="w-4 h-4 mr-2" />
              Entreprise
            </TabsTrigger>
            <TabsTrigger value="notifications">
              <Bell className="w-4 h-4 mr-2" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="security">
              <Lock className="w-4 h-4 mr-2" />
              Sécurité
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-4">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-6">Informations personnelles</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Nom complet</Label>
                    <Input
                      value={profileData.full_name}
                      onChange={(e) => setProfileData({ ...profileData, full_name: e.target.value })}
                      placeholder="Votre nom complet"
                    />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <div className="flex gap-2">
                      <Input
                        value={profileData.email}
                        disabled
                        className="bg-gray-50"
                      />
                      {userData?.email_verified ? (
                        <span className="text-green-600 text-sm flex items-center">✓ Vérifié</span>
                      ) : (
                        <span className="text-orange-600 text-sm flex items-center">Non vérifié</span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div>
                  <Label>Téléphone</Label>
                  <Input
                    value={profileData.phone}
                    onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                    placeholder="+216 XX XXX XXX"
                  />
                </div>

                <div className="flex justify-end pt-4">
                  <Button onClick={updateProfile} className="bg-purple-600 hover:bg-purple-700">
                    <Save className="w-4 h-4 mr-2" />
                    Enregistrer les modifications
                  </Button>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Informations du compte</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Date de création</p>
                  <p className="font-medium">
                    {userData?.created_at ? new Date(userData.created_at).toLocaleDateString('fr-FR') : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Dernière connexion</p>
                  <p className="font-medium">
                    {userData?.last_login ? new Date(userData.last_login).toLocaleDateString('fr-FR') : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Langue</p>
                  <p className="font-medium">{userData?.preferences?.language === 'fr' ? 'Français' : 'Anglais'}</p>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Company Tab */}
          <TabsContent value="company" className="space-y-4">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-6">Paramètres de l'entreprise</h2>
              {currentCompany ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Nom de l'entreprise</Label>
                      <Input value={currentCompany.name || ''} disabled className="bg-gray-50" />
                    </div>
                    <div>
                      <Label>Devise</Label>
                      <Input value={currentCompany.primary_currency || 'TND'} disabled className="bg-gray-50" />
                    </div>
                  </div>
                  <div className="flex gap-4 pt-4">
                    <Button variant="outline" onClick={() => navigate('/taxes')}>
                      <Percent className="w-4 h-4 mr-2" />
                      Gérer les taxes
                    </Button>
                    <Button variant="outline" onClick={() => navigate('/access-logs')}>
                      <FileText className="w-4 h-4 mr-2" />
                      Logs d'accès
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  Aucune entreprise sélectionnée
                </div>
              )}
            </Card>
          </TabsContent>


          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-4">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-6">Préférences de notification</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Rappels de factures</p>
                    <p className="text-sm text-gray-500">Recevoir des rappels pour les factures impayées</p>
                  </div>
                  <Switch
                    checked={notificationPrefs.email_reminders}
                    onCheckedChange={(checked) => setNotificationPrefs({ ...notificationPrefs, email_reminders: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Mises à jour de factures</p>
                    <p className="text-sm text-gray-500">Notifications quand une facture est payée</p>
                  </div>
                  <Switch
                    checked={notificationPrefs.invoice_updates}
                    onCheckedChange={(checked) => setNotificationPrefs({ ...notificationPrefs, invoice_updates: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Paiements reçus</p>
                    <p className="text-sm text-gray-500">Notification à chaque paiement reçu</p>
                  </div>
                  <Switch
                    checked={notificationPrefs.payment_notifications}
                    onCheckedChange={(checked) => setNotificationPrefs({ ...notificationPrefs, payment_notifications: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Mises à jour système</p>
                    <p className="text-sm text-gray-500">Nouvelles fonctionnalités et améliorations</p>
                  </div>
                  <Switch
                    checked={notificationPrefs.system_updates}
                    onCheckedChange={(checked) => setNotificationPrefs({ ...notificationPrefs, system_updates: checked })}
                  />
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-4">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-6">Changer le mot de passe</h2>
              <div className="space-y-4 max-w-md">
                <div>
                  <Label>Mot de passe actuel</Label>
                  <Input
                    type="password"
                    value={passwordData.current_password}
                    onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Nouveau mot de passe</Label>
                  <Input
                    type="password"
                    value={passwordData.new_password}
                    onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Confirmer le nouveau mot de passe</Label>
                  <Input
                    type="password"
                    value={passwordData.confirm_password}
                    onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                  />
                </div>
                <Button onClick={updatePassword} className="bg-purple-600 hover:bg-purple-700">
                  <Lock className="w-4 h-4 mr-2" />
                  Changer le mot de passe
                </Button>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Sessions actives</h3>
              <p className="text-sm text-gray-600 mb-4">Gérez vos sessions actives sur différents appareils</p>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">Session actuelle</p>
                    <p className="text-sm text-gray-500">Navigateur actuel</p>
                  </div>
                  <Badge className="bg-green-100 text-green-800">Active</Badge>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card 
            className="p-6 hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => navigate('/taxes')}
          >
            <div className="flex items-start gap-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Percent className="w-6 h-6 text-purple-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Taxes & TVA</h3>
                <p className="text-sm text-gray-600">Configurez les taux de TVA</p>
              </div>
            </div>
          </Card>

          <Card 
            className="p-6 hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => navigate('/access-logs')}
          >
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Logs d'accès</h3>
                <p className="text-sm text-gray-600">Historique des actions</p>
              </div>
            </div>
          </Card>

          {currentCompany && (
            <Card 
              className="p-6 hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate('/settings/company')}
            >
              <div className="flex items-start gap-4">
                <div className="p-3 bg-orange-100 rounded-lg">
                  <Building className="w-6 h-6 text-orange-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Paramètres entreprise</h3>
                  <p className="text-sm text-gray-600">{currentCompany.name}</p>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default Settings;
