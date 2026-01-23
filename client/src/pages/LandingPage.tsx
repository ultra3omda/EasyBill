import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Link } from "wouter";
import { 
  FileText, 
  Package, 
  Receipt, 
  Wallet, 
  Calculator, 
  Users, 
  Clock, 
  BarChart3,
  Scan,
  Globe,
  Palette,
  Zap,
  Code,
  Shield,
  Check,
  ArrowRight,
  Star,
  Phone,
  Mail,
  MapPin
} from "lucide-react";

export default function LandingPage() {
  const { isAuthenticated } = useAuth();

  const features = [
    {
      icon: FileText,
      title: "Cycle de vente intégral",
      description: "Gérez vos devis, factures et bons de livraisons en toute simplicité. Suivez vos projets et feuilles de temps efficacement."
    },
    {
      icon: Package,
      title: "Gestion de stock intuitive",
      description: "Simplifiez la gestion de vos produits, services et tarifs avec un catalogue détaillé et des stratégies de tarification flexibles."
    },
    {
      icon: Receipt,
      title: "Suivi de dépenses facile",
      description: "Suivez vos factures fournisseurs et autres dépenses en toute simplicité, ajoutez des frais récurrents."
    },
    {
      icon: Wallet,
      title: "Trésorerie à jour",
      description: "Gérez facilement les paiements partiels et en masse grâce à plusieurs modes de paiement et des rappels automatisés."
    },
    {
      icon: Calculator,
      title: "Comptabilité Automatisée",
      description: "Assurez une comptabilité toujours à jour avec une synchronisation automatique des écritures comptables."
    },
    {
      icon: Users,
      title: "Clients & Fournisseurs",
      description: "Gérez efficacement vos clients et fournisseurs en centralisant toutes leurs transactions et historiques."
    },
    {
      icon: Clock,
      title: "Timesheets facturables",
      description: "Gérez vos projets de A à Z avec un système qui simplifie l'envoi rapide de devis et permet une facturation flexible."
    },
    {
      icon: BarChart3,
      title: "Rapports & Analytics",
      description: "Prenez des décisions éclairées grâce à des indicateurs avancés sur vos ventes, créances et revenus."
    }
  ];

  const advancedFeatures = [
    {
      icon: Scan,
      title: "Traitement par OCR IA",
      description: "Transformez vos factures en données exploitables instantanément grâce à notre IA intelligente."
    },
    {
      icon: Shield,
      title: "Gestion fiscale tunisienne",
      description: "Créez des factures conformes à la réglementation tunisienne avec TVA, FODEC et timbre fiscal."
    },
    {
      icon: Globe,
      title: "Rayonnement international",
      description: "Développez votre entreprise grâce aux fonctionnalités multidevises et multilingues."
    },
    {
      icon: Palette,
      title: "Personnalisation",
      description: "Adaptez l'interface selon vos besoins grâce aux champs additionnels et modules sur mesure."
    },
    {
      icon: Zap,
      title: "Automatisation",
      description: "Fluidifiez votre workflow grâce à des processus automatisés et des rappels intelligents."
    },
    {
      icon: Code,
      title: "Open API",
      description: "Personnalisez et automatisez votre gestion d'entreprise grâce à notre API ouverte."
    }
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
            <Link href="/mobile" className="text-gray-600 hover:text-primary transition-colors flex items-center gap-1">
              Mobile
              <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">New</span>
            </Link>
            <Link href="/pricing" className="text-gray-600 hover:text-primary transition-colors">
              Tarifs
            </Link>
            <Link href="/blog" className="text-gray-600 hover:text-primary transition-colors">
              Blog
            </Link>
            <Link href="/docs" className="text-gray-600 hover:text-primary transition-colors">
              Aide
            </Link>
            <Link href="/referral" className="text-gray-600 hover:text-primary transition-colors">
              Parrainage
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Link href="/dashboard">
                <Button>Tableau de bord</Button>
              </Link>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost">Connexion</Button>
                </Link>
                <Link href="/register">
                  <Button>S'inscrire</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 bg-gradient-to-b from-gray-50 to-white">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
            Le Logiciel de Facturation<br />
            <span className="text-primary">qu'il vous faut</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            EasyBill est spécialement conçu pour les dirigeants de TPME tunisiennes, 
            avec une solution intuitive, pratique et parfaitement adaptée à leurs besoins.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Button size="lg" className="text-lg px-8">
              Demander une Démo
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8">
              Voir la Démo
            </Button>
          </div>
          <p className="text-sm text-gray-500">
            Obtenez une démonstration de la version premium avec un conseiller qualifié.
          </p>
        </div>

        {/* E-invoice Banner */}
        <div className="container mx-auto px-4 mt-12">
          <div className="bg-gradient-to-r from-primary to-primary/80 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between text-white">
            <div>
              <h3 className="text-lg font-semibold">Facturation électronique obligatoire en 2026</h3>
              <p className="text-white/80">Préparez votre entreprise à la nouvelle réglementation tunisienne</p>
            </div>
            <Button variant="secondary" className="mt-4 md:mt-0">
              Découvrir la solution
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Facile, Rapide et Complet.
            </h2>
            <p className="text-xl text-gray-600">
              Un seul outil pour gérer efficacement une ou plusieurs entreprises
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="border-0 shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader>
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-gray-600">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Advanced Features Section */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Ressentez le changement
            </h2>
            <p className="text-xl text-gray-600">
              Structuré pour accélérer votre développement
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {advancedFeatures.map((feature, index) => (
              <div key={index} className="flex gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                  <p className="text-gray-600">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Des tarifs adaptés à vos besoins
            </h2>
            <p className="text-xl text-gray-600">
              Nos plans sont simples, directs et conçus pour s'adapter à l'évolution de votre entreprise
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Free Plan */}
            <Card className="border-2">
              <CardHeader className="text-center pb-8">
                <CardTitle className="text-2xl">Gratuit</CardTitle>
                <CardDescription>Le meilleur plan pour essayer EasyBill</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">0 DT</span>
                  <span className="text-gray-500">/mois</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {[
                    "1 Entreprise",
                    "1 Utilisateur",
                    "5 Clients",
                    "5 Factures de ventes",
                    "10 Articles",
                    "5 Devis",
                    "5 Factures d'achat"
                  ].map((item, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <Check className="w-5 h-5 text-green-500" />
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
                  <span className="text-4xl font-bold">39 DT</span>
                  <span className="text-gray-500">/mois</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {[
                    "1 Entreprise",
                    "5 Utilisateurs",
                    "Clients illimités",
                    "Factures de vente illimitées",
                    "Articles illimités",
                    "Devis illimités",
                    "Factures d'achat illimitées"
                  ].map((item, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <Check className="w-5 h-5 text-green-500" />
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
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Prêt à simplifier votre facturation ?
          </h2>
          <p className="text-xl text-white/80 mb-8">
            Rejoignez des milliers d'entreprises tunisiennes qui font confiance à EasyBill
          </p>
          <Link href="/register">
            <Button size="lg" variant="secondary" className="text-lg px-8">
              Commencer gratuitement <ArrowRight className="ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-16">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <span className="text-xl font-bold">EasyBill</span>
              </div>
              <p className="text-gray-400">
                La solution de facturation tunisienne simple et efficace.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Liens</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/features" className="hover:text-white transition-colors">Fonctionnalités</Link></li>
                <li><Link href="/pricing" className="hover:text-white transition-colors">Tarifs</Link></li>
                <li><Link href="/blog" className="hover:text-white transition-colors">Blog</Link></li>
                <li><Link href="/docs" className="hover:text-white transition-colors">Aide</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Légal</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/terms" className="hover:text-white transition-colors">Conditions d'utilisation</Link></li>
                <li><Link href="/privacy" className="hover:text-white transition-colors">Politique de confidentialité</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Contact</h4>
              <ul className="space-y-2 text-gray-400">
                <li className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  (+216) 98 15 66 66
                </li>
                <li className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  support@easybill.tn
                </li>
                <li className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Tunis, Tunisie
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 mt-12 pt-8 text-center text-gray-400">
            <p>© 2026 EasyBill. Tous droits réservés.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
