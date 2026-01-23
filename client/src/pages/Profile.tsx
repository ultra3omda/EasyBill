import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link, useLocation } from "wouter";
import { 
  User, 
  Mail, 
  Phone, 
  Building, 
  Bell, 
  Shield, 
  Key, 
  Globe,
  Camera,
  Save,
  ArrowLeft
} from "lucide-react";
import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";

export default function Profile() {
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [isSaving, setIsSaving] = useState(false);

  // Profile form state
  const [profile, setProfile] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: "",
    company: "",
    language: "fr",
    timezone: "Africa/Tunis"
  });

  // Notification preferences
  const [notifications, setNotifications] = useState({
    emailInvoices: true,
    emailPayments: true,
    emailReminders: true,
    pushNotifications: false,
    weeklyReport: true
  });

  if (!isAuthenticated) {
    setLocation("/login");
    return null;
  }

  const handleSaveProfile = async () => {
    setIsSaving(true);
    // Simulate save
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsSaving(false);
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="mb-6">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-gray-600 hover:text-primary mb-4">
            <ArrowLeft className="w-4 h-4" />
            Retour au tableau de bord
          </Link>
          <h1 className="text-2xl font-bold">Mon profil</h1>
          <p className="text-gray-600">Gérez vos informations personnelles et préférences</p>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList>
            <TabsTrigger value="profile">Profil</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="security">Sécurité</TabsTrigger>
            <TabsTrigger value="preferences">Préférences</TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Informations personnelles</CardTitle>
                <CardDescription>
                  Mettez à jour vos informations de profil
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Avatar */}
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
                    <User className="w-10 h-10 text-primary" />
                  </div>
                  <div>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Camera className="w-4 h-4" />
                      Changer la photo
                    </Button>
                    <p className="text-sm text-gray-500 mt-1">JPG, PNG. Max 2MB</p>
                  </div>
                </div>

                <Separator />

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nom complet</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input 
                        id="name"
                        className="pl-10"
                        value={profile.name}
                        onChange={(e) => setProfile({...profile, name: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input 
                        id="email"
                        type="email"
                        className="pl-10"
                        value={profile.email}
                        onChange={(e) => setProfile({...profile, email: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Téléphone</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input 
                        id="phone"
                        className="pl-10"
                        placeholder="+216 XX XXX XXX"
                        value={profile.phone}
                        onChange={(e) => setProfile({...profile, phone: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="company">Entreprise</Label>
                    <div className="relative">
                      <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input 
                        id="company"
                        className="pl-10"
                        value={profile.company}
                        onChange={(e) => setProfile({...profile, company: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSaveProfile} disabled={isSaving} className="gap-2">
                    <Save className="w-4 h-4" />
                    {isSaving ? "Enregistrement..." : "Enregistrer"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle>Préférences de notification</CardTitle>
                <CardDescription>
                  Choisissez comment vous souhaitez être notifié
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Nouvelles factures</Label>
                      <p className="text-sm text-gray-500">Recevoir un email pour chaque nouvelle facture</p>
                    </div>
                    <Switch 
                      checked={notifications.emailInvoices}
                      onCheckedChange={(checked) => setNotifications({...notifications, emailInvoices: checked})}
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Paiements reçus</Label>
                      <p className="text-sm text-gray-500">Être notifié lors de la réception d'un paiement</p>
                    </div>
                    <Switch 
                      checked={notifications.emailPayments}
                      onCheckedChange={(checked) => setNotifications({...notifications, emailPayments: checked})}
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Rappels de paiement</Label>
                      <p className="text-sm text-gray-500">Recevoir des rappels pour les factures en retard</p>
                    </div>
                    <Switch 
                      checked={notifications.emailReminders}
                      onCheckedChange={(checked) => setNotifications({...notifications, emailReminders: checked})}
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Notifications push</Label>
                      <p className="text-sm text-gray-500">Activer les notifications push sur mobile</p>
                    </div>
                    <Switch 
                      checked={notifications.pushNotifications}
                      onCheckedChange={(checked) => setNotifications({...notifications, pushNotifications: checked})}
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Rapport hebdomadaire</Label>
                      <p className="text-sm text-gray-500">Recevoir un résumé hebdomadaire de votre activité</p>
                    </div>
                    <Switch 
                      checked={notifications.weeklyReport}
                      onCheckedChange={(checked) => setNotifications({...notifications, weeklyReport: checked})}
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button className="gap-2">
                    <Save className="w-4 h-4" />
                    Enregistrer
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="w-5 h-5" />
                    Mot de passe
                  </CardTitle>
                  <CardDescription>
                    Modifiez votre mot de passe
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Mot de passe actuel</Label>
                    <Input id="currentPassword" type="password" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">Nouveau mot de passe</Label>
                    <Input id="newPassword" type="password" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmNewPassword">Confirmer le nouveau mot de passe</Label>
                    <Input id="confirmNewPassword" type="password" />
                  </div>
                  <Button>Changer le mot de passe</Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Authentification à deux facteurs
                  </CardTitle>
                  <CardDescription>
                    Ajoutez une couche de sécurité supplémentaire à votre compte
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Statut: Désactivé</p>
                      <p className="text-sm text-gray-500">Protégez votre compte avec l'authentification 2FA</p>
                    </div>
                    <Button variant="outline">Activer</Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Preferences Tab */}
          <TabsContent value="preferences">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5" />
                  Préférences régionales
                </CardTitle>
                <CardDescription>
                  Configurez vos préférences de langue et de fuseau horaire
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="language">Langue</Label>
                    <select 
                      id="language"
                      className="w-full h-10 px-3 rounded-md border border-input bg-background"
                      value={profile.language}
                      onChange={(e) => setProfile({...profile, language: e.target.value})}
                    >
                      <option value="fr">Français</option>
                      <option value="ar">العربية</option>
                      <option value="en">English</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="timezone">Fuseau horaire</Label>
                    <select 
                      id="timezone"
                      className="w-full h-10 px-3 rounded-md border border-input bg-background"
                      value={profile.timezone}
                      onChange={(e) => setProfile({...profile, timezone: e.target.value})}
                    >
                      <option value="Africa/Tunis">Tunis (GMT+1)</option>
                      <option value="Europe/Paris">Paris (GMT+1)</option>
                      <option value="UTC">UTC</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button className="gap-2">
                    <Save className="w-4 h-4" />
                    Enregistrer
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
