import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { 
  FileText, 
  ArrowLeft, 
  Search, 
  Book, 
  Settings, 
  CreditCard, 
  Users, 
  Package, 
  Receipt, 
  Calculator,
  HelpCircle,
  Video,
  MessageCircle
} from "lucide-react";

export default function Docs() {
  const categories = [
    {
      icon: Book,
      title: "Premiers pas",
      description: "Commencez à utiliser EasyBill",
      articles: [
        "Créer votre compte",
        "Configurer votre entreprise",
        "Ajouter votre premier client",
        "Créer votre première facture"
      ]
    },
    {
      icon: Receipt,
      title: "Facturation",
      description: "Gérer vos factures et devis",
      articles: [
        "Créer une facture",
        "Créer un devis",
        "Convertir un devis en facture",
        "Personnaliser vos documents"
      ]
    },
    {
      icon: Users,
      title: "Clients & Fournisseurs",
      description: "Gérer vos contacts",
      articles: [
        "Ajouter un client",
        "Ajouter un fournisseur",
        "Importer des contacts",
        "Historique des transactions"
      ]
    },
    {
      icon: Package,
      title: "Produits & Stock",
      description: "Gérer votre catalogue",
      articles: [
        "Ajouter un produit",
        "Gérer les catégories",
        "Suivi du stock",
        "Mouvements de stock"
      ]
    },
    {
      icon: CreditCard,
      title: "Paiements",
      description: "Suivre vos encaissements",
      articles: [
        "Enregistrer un paiement",
        "Paiements partiels",
        "Rappels automatiques",
        "Historique des paiements"
      ]
    },
    {
      icon: Calculator,
      title: "Comptabilité",
      description: "Gérer votre comptabilité",
      articles: [
        "Plan comptable tunisien",
        "Écritures comptables",
        "Journaux légaux",
        "États financiers"
      ]
    },
    {
      icon: Settings,
      title: "Paramètres",
      description: "Configurer votre compte",
      articles: [
        "Paramètres de l'entreprise",
        "Gestion des utilisateurs",
        "Personnalisation",
        "Intégrations"
      ]
    },
    {
      icon: CreditCard,
      title: "Abonnement",
      description: "Gérer votre abonnement",
      articles: [
        "Changer de plan",
        "Ajouter des compléments",
        "Facturation",
        "Annulation"
      ]
    }
  ];

  const popularArticles = [
    "Comment créer une facture conforme ?",
    "Quels sont les taux de TVA en Tunisie ?",
    "Comment configurer le timbre fiscal ?",
    "Comment exporter mes factures en PDF ?",
    "Comment ajouter un utilisateur ?"
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
            <Link href="/docs" className="text-primary font-medium">
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
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Centre d'aide
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mb-8">
            Trouvez des réponses à vos questions et apprenez à utiliser EasyBill efficacement.
          </p>
          
          {/* Search */}
          <div className="relative max-w-xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input 
              placeholder="Rechercher dans l'aide..." 
              className="pl-12 h-12 text-lg"
            />
          </div>
        </div>
      </section>

      {/* Quick Links */}
      <section className="py-8 border-b">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap gap-4 justify-center">
            <Button variant="outline" className="gap-2">
              <Video className="w-4 h-4" />
              Tutoriels vidéo
            </Button>
            <Button variant="outline" className="gap-2">
              <HelpCircle className="w-4 h-4" />
              FAQ
            </Button>
            <Button variant="outline" className="gap-2">
              <MessageCircle className="w-4 h-4" />
              Contacter le support
            </Button>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold mb-8">Parcourir par catégorie</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {categories.map((category, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                    <category.icon className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{category.title}</CardTitle>
                  <CardDescription>{category.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {category.articles.map((article, i) => (
                      <li key={i}>
                        <a href="#" className="text-sm text-gray-600 hover:text-primary transition-colors">
                          {article}
                        </a>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Popular Articles */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold mb-8">Articles populaires</h2>
          <div className="grid md:grid-cols-2 gap-4 max-w-4xl">
            {popularArticles.map((article, index) => (
              <a 
                key={index} 
                href="#" 
                className="flex items-center gap-3 p-4 bg-white rounded-lg hover:shadow-md transition-shadow"
              >
                <Book className="w-5 h-5 text-primary flex-shrink-0" />
                <span className="text-gray-700 hover:text-primary transition-colors">{article}</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Support */}
      <section className="py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold mb-4">Vous n'avez pas trouvé votre réponse ?</h2>
          <p className="text-gray-600 mb-6">
            Notre équipe de support est là pour vous aider.
          </p>
          <Button size="lg" className="gap-2">
            <MessageCircle className="w-5 h-5" />
            Contacter le support
          </Button>
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
