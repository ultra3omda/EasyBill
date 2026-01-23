import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { 
  FileText, 
  ArrowLeft, 
  Smartphone, 
  Camera, 
  Wifi, 
  Bell,
  Check,
  Download
} from "lucide-react";

export default function Mobile() {
  const features = [
    {
      icon: Camera,
      title: "Scanner de documents",
      description: "Scannez vos factures fournisseurs avec l'appareil photo et importez-les automatiquement."
    },
    {
      icon: Wifi,
      title: "Mode hors-ligne",
      description: "Travaillez sans connexion internet. Vos données se synchronisent automatiquement."
    },
    {
      icon: Bell,
      title: "Notifications push",
      description: "Recevez des alertes pour les paiements reçus, les factures en retard et plus encore."
    },
    {
      icon: FileText,
      title: "Création rapide",
      description: "Créez des factures et devis en quelques clics, directement depuis votre téléphone."
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
            <Link href="/pricing" className="text-gray-600 hover:text-primary transition-colors">
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
      <section className="pt-32 pb-16 bg-gradient-to-b from-primary/5 to-white">
        <div className="container mx-auto px-4">
          <Link href="/" className="inline-flex items-center gap-2 text-gray-600 hover:text-primary mb-8">
            <ArrowLeft className="w-4 h-4" />
            Retour à l'accueil
          </Link>
          
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
                <Smartphone className="w-4 h-4" />
                Application mobile
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                EasyBill dans votre poche
              </h1>
              <p className="text-xl text-gray-600 mb-8">
                Gérez votre facturation où que vous soyez. Créez des factures, 
                suivez vos paiements et scannez vos documents depuis votre smartphone.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" className="gap-2">
                  <Download className="w-5 h-5" />
                  App Store
                </Button>
                <Button size="lg" variant="outline" className="gap-2">
                  <Download className="w-5 h-5" />
                  Google Play
                </Button>
              </div>
              
              <p className="text-sm text-gray-500 mt-4">
                Disponible sur iOS et Android. Gratuit à télécharger.
              </p>
            </div>
            
            <div className="flex justify-center">
              <div className="relative">
                {/* Phone mockup */}
                <div className="w-64 h-[500px] bg-gray-900 rounded-[3rem] p-3 shadow-2xl">
                  <div className="w-full h-full bg-gradient-to-b from-primary/20 to-primary/5 rounded-[2.5rem] flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <FileText className="w-8 h-8 text-white" />
                      </div>
                      <p className="text-gray-700 font-semibold">EasyBill Mobile</p>
                      <p className="text-gray-500 text-sm">Bientôt disponible</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-4">
            Toutes les fonctionnalités essentielles
          </h2>
          <p className="text-gray-600 text-center mb-12 max-w-2xl mx-auto">
            L'application mobile EasyBill vous offre tout ce dont vous avez besoin 
            pour gérer votre facturation en déplacement.
          </p>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <feature.icon className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">
            Web vs Mobile
          </h2>
          
          <div className="max-w-3xl mx-auto">
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div></div>
              <div className="text-center font-semibold">Web</div>
              <div className="text-center font-semibold">Mobile</div>
            </div>
            
            {[
              "Création de factures",
              "Création de devis",
              "Gestion des clients",
              "Suivi des paiements",
              "Scanner de documents",
              "Mode hors-ligne",
              "Notifications push",
              "Comptabilité avancée"
            ].map((feature, index) => (
              <div key={index} className="grid grid-cols-3 gap-4 py-3 border-b">
                <div className="text-gray-700">{feature}</div>
                <div className="flex justify-center">
                  <Check className="w-5 h-5 text-green-500" />
                </div>
                <div className="flex justify-center">
                  {index < 7 ? (
                    <Check className="w-5 h-5 text-green-500" />
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-primary">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Prêt à essayer EasyBill Mobile ?
          </h2>
          <p className="text-white/80 mb-8 max-w-xl mx-auto">
            Téléchargez l'application et commencez à gérer votre facturation 
            depuis votre smartphone dès aujourd'hui.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" variant="secondary" className="gap-2">
              <Download className="w-5 h-5" />
              Télécharger maintenant
            </Button>
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
