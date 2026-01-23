import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { FileText, ArrowLeft, Calendar, User, ArrowRight } from "lucide-react";

export default function Blog() {
  const articles = [
    {
      id: 1,
      title: "Facturation électronique en Tunisie : ce qui change en 2026",
      excerpt: "La Tunisie s'apprête à rendre obligatoire la facturation électronique. Découvrez les nouvelles obligations et comment vous y préparer.",
      date: "15 Décembre 2025",
      author: "Équipe EasyBill",
      category: "Réglementation",
      image: "📋"
    },
    {
      id: 2,
      title: "Guide complet : Les mentions obligatoires sur une facture tunisienne",
      excerpt: "Tout ce que vous devez savoir sur les mentions légales obligatoires pour vos factures en Tunisie.",
      date: "10 Décembre 2025",
      author: "Équipe EasyBill",
      category: "Comptabilité",
      image: "📝"
    },
    {
      id: 3,
      title: "TVA en Tunisie : taux, calcul et déclaration",
      excerpt: "Comprendre les différents taux de TVA (19%, 13%, 7%) et comment les appliquer correctement sur vos factures.",
      date: "5 Décembre 2025",
      author: "Équipe EasyBill",
      category: "Fiscalité",
      image: "💰"
    },
    {
      id: 4,
      title: "Comment optimiser la gestion de votre trésorerie",
      excerpt: "Conseils pratiques pour améliorer le suivi de vos paiements et réduire les délais de recouvrement.",
      date: "1 Décembre 2025",
      author: "Équipe EasyBill",
      category: "Gestion",
      image: "📊"
    },
    {
      id: 5,
      title: "FODEC et Droit de consommation : guide pratique",
      excerpt: "Tout savoir sur le FODEC et le droit de consommation en Tunisie et comment les intégrer dans vos factures.",
      date: "25 Novembre 2025",
      author: "Équipe EasyBill",
      category: "Fiscalité",
      image: "🏛️"
    },
    {
      id: 6,
      title: "5 erreurs à éviter dans votre facturation",
      excerpt: "Les erreurs les plus courantes en facturation et comment les éviter pour rester conforme.",
      date: "20 Novembre 2025",
      author: "Équipe EasyBill",
      category: "Conseils",
      image: "⚠️"
    }
  ];

  const categories = ["Tous", "Réglementation", "Comptabilité", "Fiscalité", "Gestion", "Conseils"];

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
            <Link href="/blog" className="text-primary font-medium">
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
        <div className="container mx-auto px-4">
          <Link href="/" className="inline-flex items-center gap-2 text-gray-600 hover:text-primary mb-8">
            <ArrowLeft className="w-4 h-4" />
            Retour à l'accueil
          </Link>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Blog EasyBill
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl">
            Actualités, conseils et guides pour optimiser la gestion de votre entreprise 
            et rester conforme à la réglementation tunisienne.
          </p>
        </div>
      </section>

      {/* Categories */}
      <section className="py-8 border-b">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap gap-2">
            {categories.map((category, index) => (
              <Button 
                key={index} 
                variant={index === 0 ? "default" : "outline"}
                size="sm"
              >
                {category}
              </Button>
            ))}
          </div>
        </div>
      </section>

      {/* Articles */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {articles.map((article) => (
              <Card key={article.id} className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <div className="text-6xl mb-4">{article.image}</div>
                  <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                    <span className="bg-primary/10 text-primary px-2 py-0.5 rounded">
                      {article.category}
                    </span>
                  </div>
                  <CardTitle className="text-xl hover:text-primary transition-colors">
                    {article.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-gray-600 mb-4">
                    {article.excerpt}
                  </CardDescription>
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {article.date}
                      </span>
                    </div>
                    <span className="flex items-center gap-1">
                      <User className="w-4 h-4" />
                      {article.author}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Load More */}
          <div className="text-center mt-12">
            <Button variant="outline" size="lg">
              Charger plus d'articles <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <section className="py-16 bg-primary">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">
            Restez informé
          </h2>
          <p className="text-white/80 mb-6">
            Recevez nos derniers articles et conseils directement dans votre boîte mail.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <input 
              type="email" 
              placeholder="Votre email" 
              className="flex-1 px-4 py-2 rounded-lg border-0 focus:ring-2 focus:ring-white/50"
            />
            <Button variant="secondary">S'abonner</Button>
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
