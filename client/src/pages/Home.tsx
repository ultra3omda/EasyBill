import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getLoginUrl } from "@/const";
import { 
  FileText, 
  Users, 
  Package, 
  TrendingUp, 
  Shield, 
  Zap,
  CheckCircle,
  ArrowRight,
  Building2,
  Receipt,
  Calculator,
  BarChart3
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useEffect } from "react";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isAuthenticated && !loading) {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, loading, setLocation]);

  const features = [
    {
      icon: FileText,
      title: "Facturation Conforme",
      description: "Créez des factures conformes aux normes tunisiennes avec numérotation automatique et mentions légales obligatoires."
    },
    {
      icon: Calculator,
      title: "Calcul Automatique TVA",
      description: "Gestion automatique des taux de TVA (19%, 13%, 7%), FODEC et droit de consommation selon la réglementation tunisienne."
    },
    {
      icon: Users,
      title: "Gestion Clients & Fournisseurs",
      description: "Centralisez toutes les informations de vos contacts avec historique complet des transactions."
    },
    {
      icon: Package,
      title: "Gestion de Stock",
      description: "Suivez vos produits, gérez les niveaux de stock et recevez des alertes de réapprovisionnement."
    },
    {
      icon: Receipt,
      title: "Devis en 1 Clic",
      description: "Créez des devis professionnels et convertissez-les en factures instantanément."
    },
    {
      icon: BarChart3,
      title: "Tableau de Bord",
      description: "Visualisez vos KPIs financiers : chiffre d'affaires, marges, DSO et statistiques TVA."
    }
  ];

  const pricingPlans = [
    {
      name: "Gratuit",
      price: "0",
      period: "TND/mois",
      description: "Pour démarrer",
      features: [
        "10 factures/mois",
        "5 clients",
        "1 entreprise",
        "Calcul TVA automatique",
        "Export PDF"
      ],
      cta: "Commencer gratuitement",
      highlighted: false
    },
    {
      name: "Premium",
      price: "49",
      period: "TND/mois",
      description: "Pour les professionnels",
      features: [
        "Factures illimitées",
        "Clients illimités",
        "Multi-entreprises",
        "OCR factures fournisseurs",
        "Relances automatiques",
        "Support prioritaire",
        "Export comptable"
      ],
      cta: "Essai gratuit 14 jours",
      highlighted: true
    }
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold text-foreground">EasyBill</span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Fonctionnalités
            </a>
            <a href="#pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Tarifs
            </a>
            <a href="#contact" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Contact
            </a>
          </nav>
          <div className="flex items-center gap-4">
            <a href={getLoginUrl()}>
              <Button variant="outline">Se connecter</Button>
            </a>
            <a href={getLoginUrl()}>
              <Button>Créer un compte</Button>
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 md:py-32 bg-gradient-to-b from-primary/5 to-background">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Shield className="h-4 w-4" />
              Conforme à la réglementation tunisienne 2026
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground mb-6">
              La facturation simplifiée pour les entreprises{" "}
              <span className="text-primary">tunisiennes</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Créez des factures conformes, gérez vos clients et suivez votre trésorerie. 
              Tout ce dont vous avez besoin pour piloter votre activité.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href={getLoginUrl()}>
                <Button size="lg" className="gap-2">
                  Démarrer gratuitement
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </a>
              <a href="#features">
                <Button size="lg" variant="outline">
                  Découvrir les fonctionnalités
                </Button>
              </a>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              Aucune carte bancaire requise • Configuration en 2 minutes
            </p>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 border-y bg-muted/30">
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-primary">TVA 19%</div>
              <div className="text-sm text-muted-foreground mt-1">Taux standard</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-primary">TVA 7%</div>
              <div className="text-sm text-muted-foreground mt-1">Taux réduit</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-primary">0.600</div>
              <div className="text-sm text-muted-foreground mt-1">Timbre fiscal TND</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-primary">100%</div>
              <div className="text-sm text-muted-foreground mt-1">Conforme</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Tout ce dont vous avez besoin
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Une solution complète pour gérer votre facturation et votre comptabilité 
              en conformité avec les lois tunisiennes.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="border-2 hover:border-primary/50 transition-colors">
                <CardHeader>
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Tax Compliance Section */}
      <section className="py-20 bg-muted/30">
        <div className="container">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                Conformité fiscale tunisienne garantie
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                Notre système intègre automatiquement toutes les exigences légales 
                de la facturation en Tunisie, y compris la nouvelle réglementation 
                de facturation électronique 2026.
              </p>
              <ul className="space-y-4">
                {[
                  "Matricule fiscal format 0000000/L/A/M/000",
                  "Numérotation séquentielle obligatoire",
                  "Calcul automatique TVA (19%, 13%, 7%)",
                  "FODEC et droit de consommation",
                  "Timbre fiscal 0.600 TND",
                  "Mentions légales obligatoires"
                ].map((item, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span className="text-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white rounded-2xl shadow-xl p-8 border">
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-4 border-b">
                  <span className="font-semibold text-lg">Exemple de facture</span>
                  <span className="text-sm text-muted-foreground">FAC-2026-00001</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sous-total HT</span>
                    <span>1,000.000 TND</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">TVA 19%</span>
                    <span>190.000 TND</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Timbre fiscal</span>
                    <span>0.600 TND</span>
                  </div>
                  <div className="flex justify-between pt-4 border-t font-bold text-lg">
                    <span>Total TTC</span>
                    <span className="text-primary">1,190.600 TND</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Tarifs simples et transparents
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Choisissez le plan qui correspond à vos besoins. 
              Évoluez à tout moment.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {pricingPlans.map((plan, index) => (
              <Card 
                key={index} 
                className={`relative ${plan.highlighted ? 'border-primary border-2 shadow-lg' : ''}`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-full">
                      Populaire
                    </span>
                  </div>
                )}
                <CardHeader className="text-center pb-8">
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground ml-2">{plan.period}</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <ul className="space-y-3">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-center gap-3">
                        <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <a href={getLoginUrl()} className="block">
                    <Button 
                      className="w-full" 
                      variant={plan.highlighted ? "default" : "outline"}
                    >
                      {plan.cta}
                    </Button>
                  </a>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary text-primary-foreground">
        <div className="container text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Prêt à simplifier votre facturation ?
          </h2>
          <p className="text-lg opacity-90 mb-8 max-w-2xl mx-auto">
            Rejoignez des milliers d'entreprises tunisiennes qui font confiance 
            à EasyBill pour leur gestion commerciale.
          </p>
          <a href={getLoginUrl()}>
            <Button size="lg" variant="secondary" className="gap-2">
              Créer mon compte gratuit
              <ArrowRight className="h-4 w-4" />
            </Button>
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="py-12 border-t">
        <div className="container">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="h-6 w-6 text-primary" />
                <span className="font-bold">EasyBill</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Solution de facturation conforme à la réglementation tunisienne.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Produit</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground">Fonctionnalités</a></li>
                <li><a href="#pricing" className="hover:text-foreground">Tarifs</a></li>
                <li><a href="#" className="hover:text-foreground">Mises à jour</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Ressources</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground">Documentation</a></li>
                <li><a href="#" className="hover:text-foreground">Guide fiscal</a></li>
                <li><a href="#" className="hover:text-foreground">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Contact</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>support@factura.tn</li>
                <li>+216 XX XXX XXX</li>
                <li>Tunis, Tunisie</li>
              </ul>
            </div>
          </div>
          <div className="border-t mt-12 pt-8 text-center text-sm text-muted-foreground">
            <p>© 2026 EasyBill. Tous droits réservés.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
