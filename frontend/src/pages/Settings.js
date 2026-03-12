import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { User, Building, Bell, Lock, Mail, Phone, Save, Edit, Percent, FileText, Camera } from 'lucide-react';
import { toast } from '../hooks/use-toast';
import { toast as sonnerToast } from '../components/ui/sonner';
import { useCompany } from '../hooks/useCompany';
import { useAuth } from '../context/AuthContext';
import { authAPI, companiesAPI } from '../services/api';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

function getPhotoUrl(photo) {
  if (!photo) return null;
  if (photo.startsWith('http')) return photo;
  return `${API_URL.replace(/\/$/, '')}${photo.startsWith('/') ? '' : '/'}${photo}`;
}

function getLogoUrl(logo) {
  if (!logo) return null;
  if (logo.startsWith('http')) return logo;
  return `${API_URL.replace(/\/$/, '')}${logo.startsWith('/') ? '' : '/'}${logo}`;
}

function getCompanyInitials(name) {
  if (!name || !name.trim()) return 'E';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function getInitials(fullName) {
  if (!fullName || !fullName.trim()) return 'U';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return fullName.slice(0, 2).toUpperCase();
}

const PHONE_PREFIXES = [
  { value: '+216', label: '🇹🇳 +216' },
  { value: '+33', label: '🇫🇷 +33' },
  { value: '+213', label: '🇩🇿 +213' },
  { value: '+212', label: '🇲🇦 +212' },
  { value: '+218', label: '🇱🇾 +218' },
  { value: '+20', label: '🇪🇬 +20' },
  { value: '+32', label: '🇧🇪 +32' },
  { value: '+41', label: '🇨🇭 +41' },
  { value: '+39', label: '🇮🇹 +39' },
  { value: '+34', label: '🇪🇸 +34' },
  { value: '+1', label: '🇺🇸 +1' },
  { value: '+44', label: '🇬🇧 +44' },
  { value: '+49', label: '🇩🇪 +49' },
  { value: '+90', label: '🇹🇷 +90' },
  { value: '+971', label: '🇦🇪 +971' },
];

function parsePhone(full) {
  if (!full || !String(full).trim()) return { prefix: '+216', number: '' };
  const s = String(full).trim();
  const match = s.match(/^(\+\d{1,4})\s*(.*)$/);
  if (match) return { prefix: match[1], number: match[2].trim() };
  if (/^\+\d+/.test(s)) {
    const prefixMatch = s.match(/^(\+\d{1,4})/);
    const prefix = prefixMatch ? prefixMatch[1] : '+216';
    return { prefix, number: s.replace(/^\+\d{1,4}\s*/, '').trim() };
  }
  return { prefix: '+216', number: s };
}

const Settings = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentCompany, loadCompanies } = useCompany();
  const { updateUser } = useAuth();
  const pathname = location.pathname;
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const isProfile = pathname === '/settings';
  const isCompany = pathname === '/settings/company';
  const isNotifications = pathname === '/settings/notifications';
  const isSecurity = pathname === '/settings/security';
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [profileData, setProfileData] = useState({
    full_name: '',
    email: '',
    phone: ''
  });
  const [phonePrefix, setPhonePrefix] = useState('+216');
  const [phoneNumber, setPhoneNumber] = useState('');
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
  const [companyData, setCompanyData] = useState({
    name: '',
    fiscal_id: '',
    activity: '',
    logo: '',
    address: { street: '', city: '', postal_code: '', country: 'Tunisie' },
    primary_currency: 'TND'
  });
  const [savingCompany, setSavingCompany] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    loadUserData();
  }, []);

  useEffect(() => {
    if (currentCompany && pathname === '/settings/company') {
      const addr = currentCompany.address || {};
      setCompanyData({
        name: currentCompany.name || '',
        fiscal_id: currentCompany.fiscal_id || '',
        activity: currentCompany.activity || '',
        logo: currentCompany.logo || '',
        address: {
          street: addr.street || '',
          city: addr.city || '',
          postal_code: addr.postal_code || '',
          country: addr.country || 'Tunisie'
        },
        primary_currency: currentCompany.primary_currency || 'TND'
      });
    }
  }, [currentCompany, pathname]);

  const loadUserData = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUserData(res.data);
      const phone = res.data.phone || '';
      const parsed = parsePhone(phone);
      setProfileData({
        full_name: res.data.full_name || '',
        email: res.data.email || '',
        phone
      });
      setPhonePrefix(parsed.prefix);
      setPhoneNumber(parsed.number);
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

  const handlePhotoChange = async (e) => {
    const file = e.target?.files?.[0];
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowed.includes(file.type)) {
      sonnerToast.error('Format non autorisé', { description: 'Utilisez JPG, PNG, GIF ou WebP.' });
      return;
    }
    setUploadingPhoto(true);
    try {
      const res = await authAPI.uploadPhoto(file);
      const photoPath = res.data?.photo;
      if (photoPath) {
        const fullUrl = getPhotoUrl(photoPath);
        setUserData(prev => ({ ...prev, photo: fullUrl }));
        updateUser({ photo: fullUrl });
        sonnerToast.success('Photo mise à jour', { description: 'Votre photo de profil a été enregistrée.' });
      }
    } catch (err) {
      sonnerToast.error('Erreur', { description: err.response?.data?.detail || 'Impossible d\'enregistrer la photo.' });
    } finally {
      setUploadingPhoto(false);
      e.target.value = '';
    }
  };

  const updateProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API_URL}/api/auth/me`,
        { full_name: profileData.full_name, phone: profileData.phone || null },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      sonnerToast.success("Profil mis à jour", { description: "Vos modifications ont été enregistrées." });
      loadUserData();
    } catch (error) {
      sonnerToast.error("Erreur", {
        description: error.response?.data?.detail || "Erreur lors de la mise à jour du profil",
      });
    }
  };

  const handleCompanyLogoChange = async (e) => {
    const file = e.target?.files?.[0];
    if (!file || !currentCompany?.id) return;
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowed.includes(file.type)) {
      sonnerToast.error('Format non autorisé', { description: 'Utilisez JPG, PNG, GIF ou WebP.' });
      return;
    }
    setUploadingLogo(true);
    try {
      const res = await companiesAPI.uploadLogo(currentCompany.id, file);
      const logoPath = res.data?.logo;
      if (logoPath) {
        setCompanyData(prev => ({ ...prev, logo: logoPath }));
        loadCompanies();
        sonnerToast.success('Logo mis à jour', { description: 'Le logo de l\'entreprise a été enregistré.' });
      }
    } catch (err) {
      sonnerToast.error('Erreur', { description: err.response?.data?.detail || 'Impossible d\'enregistrer le logo.' });
    } finally {
      setUploadingLogo(false);
      e.target.value = '';
    }
  };

  const updateCompany = async () => {
    if (!currentCompany?.id) return;
    setSavingCompany(true);
    try {
      await companiesAPI.update(currentCompany.id, {
        address: companyData.address
      });
      sonnerToast.success("Entreprise mise à jour", { description: "Les modifications ont été enregistrées." });
      loadCompanies();
    } catch (error) {
      sonnerToast.error("Erreur", {
        description: error.response?.data?.detail || "Erreur lors de la mise à jour de l'entreprise.",
      });
    } finally {
      setSavingCompany(false);
    }
  };

  const [updatingPassword, setUpdatingPassword] = useState(false);

  const updatePassword = async () => {
    if (passwordData.new_password !== passwordData.confirm_password) {
      sonnerToast.error("Erreur", { description: "Les mots de passe ne correspondent pas." });
      return;
    }
    const hasPassword = userData?.has_password !== false;
    if (hasPassword && !passwordData.current_password?.trim()) {
      sonnerToast.error("Erreur", { description: "Veuillez saisir votre mot de passe actuel." });
      return;
    }
    if (!passwordData.new_password) {
      sonnerToast.error("Erreur", { description: "Veuillez saisir le nouveau mot de passe." });
      return;
    }

    setUpdatingPassword(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.put(
        `${API_URL}/api/auth/password`,
        {
          old_password: passwordData.current_password,
          new_password: passwordData.new_password,
          confirm_password: passwordData.confirm_password
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const message = res.data?.message || "Mot de passe modifié avec succès.";
      sonnerToast.success("Succès", { description: message });
      setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
    } catch (error) {
      const detail = error.response?.data?.detail;
      const message = Array.isArray(detail) ? detail.map((e) => e.msg || e).join(', ') : (detail || "Erreur lors du changement de mot de passe.");
      sonnerToast.error("Erreur", { description: message });
    } finally {
      setUpdatingPassword(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="text-center py-20">Chargement...</div>
      </AppLayout>
    );
  }

  const getTitle = () => {
    if (isCompany) return { title: 'Entreprise', desc: "Paramètres de l'entreprise" };
    if (isNotifications) return { title: 'Notifications', desc: 'Préférences de notification' };
    if (isSecurity) return { title: 'Sécurité', desc: 'Mot de passe et sessions' };
    return { title: 'Profil', desc: 'Informations personnelles et compte' };
  };
  const { title: pageTitle, desc: pageDesc } = getTitle();

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{pageTitle}</h1>
          <p className="text-gray-500 mt-1">{pageDesc}</p>
        </div>

        {isProfile && (
          <div className="space-y-6">
            <Card className="p-6">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                <div className="relative shrink-0">
                  <div className="w-24 h-24 rounded-full overflow-hidden bg-violet-100 border-2 border-violet-200 flex items-center justify-center">
                    {userData?.photo ? (
                      <img
                        src={getPhotoUrl(userData.photo)}
                        alt="Photo de profil"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-2xl font-semibold text-violet-600">
                        {getInitials(userData?.full_name)}
                      </span>
                    )}
                  </div>
                  <label className="absolute bottom-0 right-0 bg-violet-600 hover:bg-violet-700 text-white rounded-full p-2 cursor-pointer shadow-md">
                    <Camera className="w-4 h-4" />
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      className="hidden"
                      onChange={handlePhotoChange}
                      disabled={uploadingPhoto}
                    />
                  </label>
                </div>
                <div className="flex-1 text-center sm:text-left min-w-0">
                  <h2 className="text-xl font-semibold text-gray-900">{userData?.full_name || '—'}</h2>
                  <p className="text-gray-500 text-sm mt-1">{userData?.email}</p>
                  {userData?.email_verified ? (
                    <span className="inline-flex items-center gap-1 mt-2 text-sm text-green-600">✓ Email vérifié</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 mt-2 text-sm text-orange-600">Email non vérifié</span>
                  )}
                  {uploadingPhoto && <p className="text-sm text-gray-400 mt-2">Téléversement…</p>}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4 text-sm">
                    <span className="text-gray-500">
                      Créé le <span className="text-gray-700 font-medium">{userData?.created_at ? new Date(userData.created_at).toLocaleDateString('fr-FR') : '—'}</span>
                    </span>
                    <span className="text-gray-300">•</span>
                    <span className="text-gray-500">
                      Dernière connexion <span className="text-gray-700 font-medium">{userData?.last_login ? new Date(userData.last_login).toLocaleDateString('fr-FR') : '—'}</span>
                    </span>
                    <span className="text-gray-300">•</span>
                    <span className="text-gray-500">
                      Langue <span className="text-gray-700 font-medium">{userData?.preferences?.language === 'fr' ? 'Français' : 'Anglais'}</span>
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-6">Informations personnelles</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>Nom complet</Label>
                    <Input
                      value={profileData.full_name}
                      onChange={(e) => setProfileData({ ...profileData, full_name: e.target.value })}
                      placeholder="Votre nom complet"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input
                      value={profileData.email}
                      disabled
                      className="mt-1.5 bg-gray-50"
                    />
                  </div>
                  <div>
                    <Label>Téléphone</Label>
                    <div className="flex rounded-lg border border-input bg-background shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 mt-1.5">
                      <div className="flex items-center pl-3 bg-muted/50 border-r border-input">
                        <Phone className="h-4 w-4 text-muted-foreground mr-2 shrink-0" />
                        <Select
                          value={phonePrefix}
                          onValueChange={(v) => {
                            setPhonePrefix(v);
                            setProfileData({ ...profileData, phone: (v + ' ' + phoneNumber).trim() });
                          }}
                        >
                          <SelectTrigger className="w-[7rem] h-10 border-0 bg-transparent shadow-none focus:ring-0 focus-visible:ring-0">
                            <span className="truncate text-sm">
                              {PHONE_PREFIXES.find((p) => p.value === phonePrefix)?.label ?? '+216'}
                            </span>
                          </SelectTrigger>
                          <SelectContent>
                            {PHONE_PREFIXES.map((p) => (
                              <SelectItem key={p.value} value={p.value}>
                                {p.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Input
                        className="rounded-none border-0 focus-visible:ring-0 flex-1 min-w-0"
                        value={phoneNumber}
                        onChange={(e) => {
                          const v = e.target.value;
                          setPhoneNumber(v);
                          setProfileData({ ...profileData, phone: (phonePrefix + ' ' + v).trim() });
                        }}
                        placeholder="12 345 678"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button onClick={updateProfile} className="bg-purple-600 hover:bg-purple-700">
                    <Save className="w-4 h-4 mr-2" />
                    Enregistrer les modifications
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}

        {isCompany && (
          <div className="space-y-6">
            {!currentCompany ? (
              <Card className="p-6">
                <div className="text-center py-10 text-gray-500 bg-gray-50 rounded-lg">
                  <Building className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                  <p className="font-medium">Aucune entreprise sélectionnée</p>
                  <p className="text-sm mt-1">Sélectionnez une entreprise dans le menu latéral</p>
                </div>
              </Card>
            ) : (
              <>
                <Card className="p-6">
                  <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                    <div className="relative shrink-0">
                      <div className="w-24 h-24 rounded-xl overflow-hidden bg-violet-100 border-2 border-violet-200 flex items-center justify-center">
                        {companyData.logo ? (
                          <img
                            src={getLogoUrl(companyData.logo)}
                            alt="Logo"
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <span className="text-2xl font-semibold text-violet-600">
                            {getCompanyInitials(companyData.name)}
                          </span>
                        )}
                      </div>
                      <label className="absolute bottom-0 right-0 bg-violet-600 hover:bg-violet-700 text-white rounded-full p-2 cursor-pointer shadow-md">
                        <Camera className="w-4 h-4" />
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/gif,image/webp"
                          className="hidden"
                          onChange={handleCompanyLogoChange}
                          disabled={uploadingLogo}
                        />
                      </label>
                    </div>
                    <div className="flex-1 text-center sm:text-left min-w-0">
                      <h2 className="text-xl font-semibold text-gray-900">{companyData.name || '—'}</h2>
                      {companyData.activity && (
                        <p className="text-gray-500 text-sm mt-1">{companyData.activity}</p>
                      )}
                      {companyData.fiscal_id && (
                        <p className="text-gray-500 text-sm mt-0.5">N° fiscal : {companyData.fiscal_id}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4 text-sm">
                        <span className="text-gray-500">
                          Créée le <span className="text-gray-700 font-medium">{currentCompany.created_at ? new Date(currentCompany.created_at).toLocaleDateString('fr-FR') : '—'}</span>
                        </span>
                        <span className="text-gray-300">•</span>
                        <span className="text-gray-500">
                          Modifiée le <span className="text-gray-700 font-medium">{currentCompany.updated_at ? new Date(currentCompany.updated_at).toLocaleDateString('fr-FR') : '—'}</span>
                        </span>
                      </div>
                      {uploadingLogo && <p className="text-sm text-gray-400 mt-2">Téléversement…</p>}
                      <div className="flex flex-wrap gap-3 mt-4">
                        <Button variant="outline" size="sm" onClick={() => navigate('/taxes')} className="border-gray-200">
                          <Percent className="w-4 h-4 mr-2" />
                          Gérer les taxes
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => navigate('/access-logs')} className="border-gray-200">
                          <FileText className="w-4 h-4 mr-2" />
                          Logs d'accès
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="p-6">
                  <h2 className="text-xl font-semibold mb-6">Informations entreprise</h2>
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <Label className="text-gray-600">Nom de l'entreprise</Label>
                        <Input value={companyData.name || ''} disabled className="mt-1.5 bg-gray-50" />
                      </div>
                      <div>
                        <Label className="text-gray-600">N° fiscal / Matricule</Label>
                        <Input value={companyData.fiscal_id || ''} disabled className="mt-1.5 bg-gray-50" />
                      </div>
                      <div>
                        <Label className="text-gray-600">Activité</Label>
                        <Input value={companyData.activity || ''} disabled className="mt-1.5 bg-gray-50" />
                      </div>
                      <div>
                        <Label className="text-gray-600">Devise</Label>
                        <Input value={companyData.primary_currency || 'TND'} disabled className="mt-1.5 bg-gray-50" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-gray-600 block mb-2">Adresse</Label>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-3">
                          <Label className="text-gray-500 text-sm">Rue</Label>
                          <Input
                            value={companyData.address.street}
                            onChange={(e) => setCompanyData({ ...companyData, address: { ...companyData.address, street: e.target.value } })}
                            placeholder="Rue, numéro"
                            className="mt-1.5"
                          />
                        </div>
                        <div>
                          <Label className="text-gray-500 text-sm">Ville</Label>
                          <Input
                            value={companyData.address.city}
                            onChange={(e) => setCompanyData({ ...companyData, address: { ...companyData.address, city: e.target.value } })}
                            placeholder="Tunis"
                            className="mt-1.5"
                          />
                        </div>
                        <div>
                          <Label className="text-gray-500 text-sm">Code postal</Label>
                          <Input
                            value={companyData.address.postal_code}
                            onChange={(e) => setCompanyData({ ...companyData, address: { ...companyData.address, postal_code: e.target.value } })}
                            placeholder="1000"
                            className="mt-1.5"
                          />
                        </div>
                        <div>
                          <Label className="text-gray-500 text-sm">Pays</Label>
                          <Input
                            value={companyData.address.country}
                            onChange={(e) => setCompanyData({ ...companyData, address: { ...companyData.address, country: e.target.value } })}
                            placeholder="Tunisie"
                            className="mt-1.5"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end pt-2">
                      <Button onClick={updateCompany} disabled={savingCompany} className="bg-violet-600 hover:bg-violet-700">
                        <Save className="w-4 h-4 mr-2" />
                        {savingCompany ? 'Enregistrement…' : 'Enregistrer les modifications'}
                      </Button>
                    </div>
                  </div>
                </Card>
              </>
            )}
          </div>
        )}

        {isNotifications && (
          <div className="space-y-6">
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-amber-100 rounded-lg">
                  <Bell className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Préférences de notification</h2>
                  <p className="text-sm text-gray-500">Choisissez les types de notifications que vous souhaitez recevoir</p>
                </div>
              </div>
              <div className="space-y-0 divide-y divide-gray-100">
                <div className="flex items-center justify-between py-4 first:pt-0">
                  <div>
                    <p className="font-medium text-gray-900">Rappels de factures</p>
                    <p className="text-sm text-gray-500">Recevoir des rappels pour les factures impayées</p>
                  </div>
                  <Switch
                    checked={notificationPrefs.email_reminders}
                    onCheckedChange={(checked) => setNotificationPrefs({ ...notificationPrefs, email_reminders: checked })}
                  />
                </div>
                <div className="flex items-center justify-between py-4">
                  <div>
                    <p className="font-medium text-gray-900">Mises à jour de factures</p>
                    <p className="text-sm text-gray-500">Notifications quand une facture est payée</p>
                  </div>
                  <Switch
                    checked={notificationPrefs.invoice_updates}
                    onCheckedChange={(checked) => setNotificationPrefs({ ...notificationPrefs, invoice_updates: checked })}
                  />
                </div>
                <div className="flex items-center justify-between py-4">
                  <div>
                    <p className="font-medium text-gray-900">Paiements reçus</p>
                    <p className="text-sm text-gray-500">Notification à chaque paiement reçu</p>
                  </div>
                  <Switch
                    checked={notificationPrefs.payment_notifications}
                    onCheckedChange={(checked) => setNotificationPrefs({ ...notificationPrefs, payment_notifications: checked })}
                  />
                </div>
                <div className="flex items-center justify-between py-4">
                  <div>
                    <p className="font-medium text-gray-900">Mises à jour système</p>
                    <p className="text-sm text-gray-500">Nouvelles fonctionnalités et améliorations</p>
                  </div>
                  <Switch
                    checked={notificationPrefs.system_updates}
                    onCheckedChange={(checked) => setNotificationPrefs({ ...notificationPrefs, system_updates: checked })}
                  />
                </div>
              </div>
            </Card>
          </div>
        )}

        {isSecurity && (
          <div className="space-y-6">
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-violet-100 rounded-lg">
                  <Lock className="w-6 h-6 text-violet-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Changer le mot de passe</h2>
                  <p className="text-sm text-gray-500">Mettez à jour votre mot de passe pour sécuriser votre compte</p>
                </div>
              </div>
              <div className="space-y-4 max-w-md">
                <div>
                  <Label className="text-gray-600">
                    {userData?.has_password ? 'Mot de passe actuel' : 'Ancien mot de passe (compte social : laissez vide)'}
                  </Label>
                  <Input
                    type="password"
                    value={passwordData.current_password}
                    onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
                    className="mt-1.5"
                    placeholder={userData?.has_password ? '••••••••' : 'Laissez vide pour définir un mot de passe'}
                  />
                </div>
                <div>
                  <Label className="text-gray-600">Nouveau mot de passe</Label>
                  <Input
                    type="password"
                    value={passwordData.new_password}
                    onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                    className="mt-1.5"
                    placeholder="••••••••"
                  />
                </div>
                <div>
                  <Label className="text-gray-600">Confirmer le nouveau mot de passe</Label>
                  <Input
                    type="password"
                    value={passwordData.confirm_password}
                    onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                    className="mt-1.5"
                    placeholder="••••••••"
                  />
                </div>
                <Button onClick={updatePassword} disabled={updatingPassword} className="bg-violet-600 hover:bg-violet-700 mt-2">
                  <Lock className="w-4 h-4 mr-2" />
                  {updatingPassword ? 'Enregistrement…' : 'Changer le mot de passe'}
                </Button>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <FileText className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Sessions actives</h3>
                  <p className="text-sm text-gray-500">Gérez vos sessions sur différents appareils</p>
                </div>
              </div>
              <div className="space-y-3 mt-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <div>
                    <p className="font-medium text-gray-900">Session actuelle</p>
                    <p className="text-sm text-gray-500">Navigateur actuel</p>
                  </div>
                  <Badge className="bg-green-100 text-green-800 border-0">Active</Badge>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Settings;
