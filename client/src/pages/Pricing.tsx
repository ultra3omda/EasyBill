import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "wouter";
import { Check, FileText, ArrowLeft } from "lucide-react";

export default function Pricing() {
  const freePlanFeatures = [
    "1 Entreprise",
    "1 Utilisateur",
    "5 Clients",
    "5 Factures de ventes",
    "10 Articles",
    "5 Devis",
    "5 Factures d'achat",
    "Open API 100 requêtes/jour"
  ];

  const premiumPlanFeatures = [
    "1 Entreprise",
    "5 Utilisateurs",
    "Clients illimités",
    "Factures de vente illimitées",
    "Articles illimités",
    "Devis illimités",
    "Factures d'achat illimitées",
    "Open API 1000 requêtes/jour",
    "Support prioritaire",
    "Export PDF personnalisé",
    "Rappels automatiques"
  ];

  const addons = [
    { name: "Entreprise supplémentaire", price: "15 DT/mois" },
    { name: "Utilisateur supplémentaire", price: "10 DT/mois" },
    { name: "Point de vente", price: "20 DT/mois" },
    { name: "API supplémentaire (1000 req)", price: "5 DT/mois" }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-b z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">EasyBill</span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/features" className="text-gray-600 hover:text-primary transition-colors">
              Fonctionnalités
            </Link>
            <Link href="/pricing" className="text-primary font-medium">
              Tarifs
            </Link>
            <Link href="/blog" className="text-gray-600 hover:text-primary transition-colors">
              Blog
            </Link>
            <Link href="/docs" className="text-gray-600 hover:text-primary transition-colors">
              Aide
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost">Connexion</Button>
            </Link>
            <Link href="/register">
              <Button>S'inscrire</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-16 bg-gradient-to-b from-gray-50 to-white">
        <div className="container mx-auto px-4 text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-gray-600 hover:text-primary mb-8">
            <ArrowLeft className="w-4 h-4" />
            Retour à l'accueil
          </Link>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Des tarifs adaptés à vos besoins
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Nos plans sont simples, directs et conçus pour s'adapter à l'évolution 
            des besoins de votre entreprise au fil du temps.
          </p>
        </div>
      </section>

      {/* Pricing Toggle */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <Tabs defaultValue="monthly" className="w-full">
            <div className="flex justify-center mb-12">
              <TabsList>
                <TabsTrigger value="monthly">Mensuel</TabsTrigger>
                <TabsTrigger value="annual">Annuel (-20%)</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="monthly">
              <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                {/* Free Plan */}
                <Card className="border-2">
                  <CardHeader className="text-center pb-8">
                    <CardTitle className="text-2xl">Gratuit</CardTitle>
                    <CardDescription>Le meilleur plan pour essayer EasyBill</CardDescription>
                    <div className="mt-4">
                      <span className="text-5xl font-bold">0</span>
                      <span className="text-2xl font-bold"> DT</span>
                      <span className="text-gray-500 block">HT / Mois</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {freePlanFeatures.map((item, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                    <Link href="/register">
                      <Button variant="outline" className="w-full mt-8">
                        Commencer gratuitement
                      </Button>
                    </Link>
                  </CardContent>
                </Card>

                {/* Premium Plan */}
                <Card className="border-2 border-primary relative">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-sm px-3 py-1 rounded-full">
                    LE PLUS POPULAIRE
                  </div>
                  <CardHeader className="text-center pb-8">
                    <CardTitle className="text-2xl">Premium</CardTitle>
                    <CardDescription>Pour les entreprises en croissance</CardDescription>
                    <div className="mt-4">
                      <span className="text-5xl font-bold">39</span>
                      <span className="text-2xl font-bold"> DT</span>
                      <span className="text-gray-500 block">HT / Mois</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {premiumPlanFeatures.map((item, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                    <Link href="/register">
                      <Button className="w-full mt-8">
                        Mettre à niveau
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="annual">
              <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                {/* Free Plan Annual */}
                <Card className="border-2">
                  <CardHeader className="text-center pb-8">
                    <CardTitle className="text-2xl">Gratuit</CardTitle>
                    <CardDescription>Le meilleur plan pour essayer EasyBill</CardDescription>
                    <div className="mt-4">
                      <span className="text-5xl font-bold">0</span>
                      <span className="text-2xl font-bold"> DT</span>
                      <span className="text-gray-500 block">HT / An</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {freePlanFeatures.map((item, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                    <Link href="/register">
                      <Button variant="outline" className="w-full mt-8">
                        Commencer gratuitement
                      </Button>
                    </Link>
                  </CardContent>
                </Card>

                {/* Premium Plan Annual */}
                <Card className="border-2 border-primary relative">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-sm px-3 py-1 rounded-full">
                    ÉCONOMISEZ 20%
                  </div>
                  <CardHeader className="text-center pb-8">
                    <CardTitle className="text-2xl">Premium</CardTitle>
                    <CardDescription>Pour les entreprises en croissance</CardDescription>
                    <div className="mt-4">
                      <span className="text-gray-400 line-through text-xl">468 DT</span>
                      <div>
                        <span className="text-5xl font-bold">374</span>
                        <span className="text-2xl font-bold"> DT</span>
                      </div>
                      <span className="text-gray-500 block">HT / An</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {premiumPlanFeatures.map((item, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                    <Link href="/register">
                      <Button className="w-full mt-8">
                        Mettre à niveau
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {/* Addons */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-8">Compléments disponibles</h2>
          <div className="grid md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {addons.map((addon, index) => (
              <Card key={index}>
                <CardContent className="pt-6 text-center">
                  <p className="font-medium">{addon.name}</p>
                  <p className="text-primary font-bold mt-2">{addon.price}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-2xl font-bold text-center mb-8">Questions fréquentes</h2>
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-2">Puis-je changer de plan à tout moment ?</h3>
              <p className="text-gray-600">Oui, vous pouvez passer au plan Premium à tout moment. La mise à niveau est immédiate.</p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Y a-t-il un engagement ?</h3>
              <p className="text-gray-600">Non, aucun engagement. Vous pouvez annuler votre abonnement à tout moment.</p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Comment fonctionne la facturation ?</h3>
              <p className="text-gray-600">Vous êtes facturé mensuellement ou annuellement selon votre choix. Le paiement se fait par carte bancaire ou virement.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8">
        <div className="container mx-auto px-4 text-center">
          <p className="text-gray-400">© 2026 EasyBill. Tous droits réservés.</p>
        </div>
      </footer>
    </div>
  );
}
