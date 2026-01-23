import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { Settings as SettingsIcon, User, Bell, Shield, CreditCard, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

function SettingsContent() {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Déconnexion réussie");
    } catch {
      toast.error("Erreur lors de la déconnexion");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Paramètres</h1>
        <p className="text-muted-foreground">Gérez votre compte et vos préférences</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Profile */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profil
            </CardTitle>
            <CardDescription>Informations de votre compte</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Nom</p>
              <p className="font-medium">{user?.name || "Non défini"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{user?.email || "Non défini"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Rôle</p>
              <Badge variant="outline">{user?.role === "admin" ? "Administrateur" : "Utilisateur"}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Subscription */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Abonnement
            </CardTitle>
            <CardDescription>Votre plan actuel</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold">Plan Gratuit</span>
                <Badge>Actif</Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Limité à 1 entreprise, 50 factures/mois
              </p>
              <Button className="w-full" onClick={() => toast.info("Fonctionnalité d'abonnement à venir")}>
                Passer au Premium
              </Button>
            </div>
            <div className="text-sm text-muted-foreground">
              <p>Plan Premium: 29 TND/mois</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Entreprises illimitées</li>
                <li>Factures illimitées</li>
                <li>Export PDF personnalisé</li>
                <li>OCR pour factures fournisseurs</li>
                <li>Support prioritaire</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
            </CardTitle>
            <CardDescription>Préférences de notification</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Rappels de paiement</p>
                  <p className="text-sm text-muted-foreground">Recevoir des alertes pour les factures en retard</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => toast.info("Fonctionnalité à venir")}>
                  Configurer
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Notifications par email</p>
                  <p className="text-sm text-muted-foreground">Recevoir un résumé hebdomadaire</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => toast.info("Fonctionnalité à venir")}>
                  Configurer
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Sécurité
            </CardTitle>
            <CardDescription>Paramètres de sécurité</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Authentification</p>
                <p className="text-sm text-muted-foreground">Connecté via Manus OAuth</p>
              </div>
              <Badge variant="outline" className="text-green-600">Sécurisé</Badge>
            </div>
            <Button 
              variant="destructive" 
              className="w-full gap-2"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              Se déconnecter
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function Settings() {
  return (
    <DashboardLayout>
      <SettingsContent />
    </DashboardLayout>
  );
}
