import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link, useLocation } from "wouter";
import { 
  Gift, 
  Users, 
  Copy, 
  Share2, 
  Check,
  ArrowLeft,
  Wallet,
  TrendingUp
} from "lucide-react";
import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";

export default function Referral() {
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [copied, setCopied] = useState(false);

  // Generate referral code from user ID
  const referralCode = user?.id ? `EASYBILL-${String(user.id).slice(0, 8).toUpperCase()}` : "EASYBILL-XXXXXX";
  const referralLink = `https://easybill.tn/register?ref=${referralCode}`;

  // Mock referral stats
  const stats = {
    totalReferrals: 5,
    pendingReferrals: 2,
    earnedCredits: 150,
    availableCredits: 75
  };

  const referrals = [
    { name: "Ahmed B.", date: "15/12/2025", status: "active", reward: 30 },
    { name: "Sonia M.", date: "10/12/2025", status: "active", reward: 30 },
    { name: "Karim T.", date: "05/12/2025", status: "pending", reward: 0 },
    { name: "Fatma H.", date: "01/12/2025", status: "active", reward: 30 },
    { name: "Mohamed S.", date: "28/11/2025", status: "pending", reward: 0 }
  ];

  if (!isAuthenticated) {
    setLocation("/login");
    return null;
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success("Lien copié dans le presse-papiers");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "EasyBill - Logiciel de facturation",
          text: "Rejoignez EasyBill et bénéficiez d'un mois gratuit !",
          url: referralLink
        });
      } catch (err) {
        // User cancelled share
      }
    } else {
      handleCopyLink();
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="mb-6">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-gray-600 hover:text-primary mb-4">
            <ArrowLeft className="w-4 h-4" />
            Retour au tableau de bord
          </Link>
          <h1 className="text-2xl font-bold">Programme de parrainage</h1>
          <p className="text-gray-600">Invitez vos amis et gagnez des crédits</p>
        </div>

        {/* Hero Section */}
        <Card className="bg-gradient-to-r from-primary to-primary/80 text-white mb-8">
          <CardContent className="py-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Gift className="w-8 h-8" />
                  <h2 className="text-2xl font-bold">Parrainez et gagnez !</h2>
                </div>
                <p className="text-white/80 max-w-md">
                  Pour chaque ami qui s'inscrit avec votre lien et souscrit à un abonnement, 
                  vous recevez <strong>30 DT de crédit</strong> et votre ami bénéficie de 
                  <strong> 15 DT de réduction</strong>.
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-4xl font-bold">30 DT</p>
                  <p className="text-white/80 text-sm">par parrainage</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Referral Link */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Votre lien de parrainage</CardTitle>
            <CardDescription>
              Partagez ce lien avec vos amis et collègues
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Input 
                  value={referralLink} 
                  readOnly 
                  className="pr-10"
                />
              </div>
              <Button onClick={handleCopyLink} variant="outline" className="gap-2">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copié !" : "Copier"}
              </Button>
              <Button onClick={handleShare} className="gap-2">
                <Share2 className="w-4 h-4" />
                Partager
              </Button>
            </div>
            <p className="text-sm text-gray-500 mt-3">
              Code de parrainage : <strong>{referralCode}</strong>
            </p>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalReferrals}</p>
                  <p className="text-sm text-gray-500">Parrainages</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.pendingReferrals}</p>
                  <p className="text-sm text-gray-500">En attente</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.earnedCredits} DT</p>
                  <p className="text-sm text-gray-500">Total gagné</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Gift className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.availableCredits} DT</p>
                  <p className="text-sm text-gray-500">Disponible</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Referral History */}
        <Card>
          <CardHeader>
            <CardTitle>Historique des parrainages</CardTitle>
            <CardDescription>
              Liste de vos filleuls et récompenses
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">Filleul</th>
                    <th className="text-left py-3 px-4 font-medium">Date</th>
                    <th className="text-left py-3 px-4 font-medium">Statut</th>
                    <th className="text-right py-3 px-4 font-medium">Récompense</th>
                  </tr>
                </thead>
                <tbody>
                  {referrals.map((referral, index) => (
                    <tr key={index} className="border-b last:border-0">
                      <td className="py-3 px-4">{referral.name}</td>
                      <td className="py-3 px-4 text-gray-500">{referral.date}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          referral.status === 'active' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {referral.status === 'active' ? 'Actif' : 'En attente'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-medium">
                        {referral.reward > 0 ? `+${referral.reward} DT` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* How it works */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Comment ça marche ?</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-xl font-bold text-primary">1</span>
                </div>
                <h3 className="font-semibold mb-2">Partagez votre lien</h3>
                <p className="text-sm text-gray-600">
                  Envoyez votre lien de parrainage à vos amis et collègues
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-xl font-bold text-primary">2</span>
                </div>
                <h3 className="font-semibold mb-2">Ils s'inscrivent</h3>
                <p className="text-sm text-gray-600">
                  Vos filleuls créent leur compte et souscrivent à un abonnement
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-xl font-bold text-primary">3</span>
                </div>
                <h3 className="font-semibold mb-2">Vous gagnez</h3>
                <p className="text-sm text-gray-600">
                  Recevez 30 DT de crédit pour chaque parrainage réussi
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
