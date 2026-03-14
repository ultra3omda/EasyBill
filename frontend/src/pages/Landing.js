import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { 
  FileText, 
  Package, 
  DollarSign, 
  Users, 
  BarChart3, 
  Clock,
  Zap,
  Globe2,
  Settings,
  Bot,
  Receipt,
  ArrowRight
} from 'lucide-react';
import Navbar from '../components/layout/Navbar';

const Landing = () => {
  const { t } = useLanguage();

  const features = [
    {
      icon: FileText,
      title: t('landing.salesCycle'),
      description: t('landing.salesDesc'),
      image: 'https://finances.iberis.io/images/home/iberis-simple-dashboard.png'
    },
    {
      icon: Package,
      title: t('landing.stockManagement'),
      description: t('landing.stockDesc'),
      image: 'https://finances.iberis.io/images/home/iberis-stock-analysis.png'
    },
    {
      icon: DollarSign,
      title: t('landing.expenseTracking'),
      description: t('landing.expenseDesc'),
      image: 'https://finances.iberis.io/images/home/iberis-gestion-achats-expenses.png'
    },
    {
      icon: Clock,
      title: t('landing.treasury'),
      description: t('landing.treasuryDesc'),
      image: null
    },
    {
      icon: Receipt,
      title: t('landing.accounting'),
      description: t('landing.accountingDesc'),
      image: null
    },
    {
      icon: Users,
      title: 'Clients & Fournisseurs',
      description: 'Gérez efficacement vos clients et fournisseurs en centralisant toutes leurs transactions.',
      image: 'https://finances.iberis.io/images/home/iberis-gestion-clients.png'
    },
    {
      icon: Clock,
      title: 'Timesheets facturables',
      description: 'Gérez vos projets de A à Z avec un système qui simplifie l\'envoi rapide de devis et permet une facturation flexible.',
      image: 'https://finances.iberis.io/images/home/iberis-projects-timesheet.png'
    },
    {
      icon: BarChart3,
      title: 'Rapports & Analytics',
      description: 'Prenez des décisions éclairées grâce à des indicateurs avancés sur vos ventes, créances, revenus.',
      image: 'https://finances.iberis.io/images/home/iberis-rapports.png'
    }
  ];

  const highlights = [
    { icon: Bot, title: 'Traitement par OCR IA', description: 'Simplifiez votre comptabilité : transformez vos factures en données exploitables instantanément.' },
    { icon: Receipt, title: 'Gestion fiscale', description: 'Créez des factures conformes à la réglementation sans calculs fastidieux.' },
    { icon: Globe2, title: 'Rayonnement international', description: 'Développez votre entreprise à l\'internationale grâce aux fonctionnalités multidevises et multilingues.' },
    { icon: Settings, title: 'Personnalisation', description: 'Donnez à votre équipe un contrôle total sur l\'apparence et les fonctionnalités de chaque module.' },
    { icon: Zap, title: 'Automatisation', description: 'Fluidifiez votre workflow grâce à des processus automatisés pour gagner du temps.' },
    { icon: Settings, title: 'Open API', description: 'Personnalisez et automatisez votre gestion d\'entreprise grâce à notre API ouverte.' }
  ];

  const companies = [
    { name: 'Club Africain', logo: 'https://finances.iberis.io/images/home/club-africain.png' },
    { name: 'TRID', logo: 'https://finances.iberis.io/images/home/trid.png' },
    { name: 'BluePrinters', logo: 'https://finances.iberis.io/images/home/blueprinters.png' },
    { name: 'SBS', logo: 'https://finances.iberis.io/images/home/sbs.png' },
    { name: 'B&G', logo: 'https://finances.iberis.io/images/home/bg.png' },
    { name: 'GeoPRO', logo: 'https://finances.iberis.io/images/home/geopro.png' }
  ];

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* Hero Section */}
      <section className="bg-[radial-gradient(circle_at_top,_rgba(123,92,255,0.12),_transparent_35%),linear-gradient(180deg,_#fcfbff_0%,_#ffffff_100%)] py-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="mb-6 text-5xl font-bold tracking-[-0.04em] text-slate-900 md:text-6xl">
            {t('landing.title')}<br />
            <span className="text-violet-700">{t('landing.titleHighlight')}</span>
          </h1>
          <p className="mx-auto mb-8 max-w-3xl text-xl text-slate-600">
            {t('landing.subtitle')}
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
            <Button className="px-8 py-6 text-lg">
              {t('landing.requestDemo')}
            </Button>
            <Button variant="outline" className="border-violet-300 px-8 py-6 text-lg text-violet-700 hover:bg-violet-50">
              {t('landing.watchDemo')}
            </Button>
            <div className="flex gap-3">
              <img src="https://finances.iberis.io/images/mobile/google-play-badge.png" alt="Google Play" className="h-14" />
              <img src="https://finances.iberis.io/images/mobile/app-store-badge.png" alt="App Store" className="h-14" />
            </div>
          </div>

          <p className="mb-4 text-sm text-slate-500">
            Obtenez une démonstration de la version premium avec un conseiller qualifié.
          </p>

          <Button variant="outline" className="mb-8 px-6 py-3">
            {t('landing.createAccount')}
          </Button>

          {/* E-invoicing Banner */}
          <div className="bg-gradient-to-r from-violet-600 to-amber-500 rounded-2xl p-6 text-white flex flex-col md:flex-row items-center justify-between max-w-4xl mx-auto mt-8">
            <div className="flex items-center gap-4 mb-4 md:mb-0">
              <div className="bg-white/20 rounded-full p-3">
                <FileText className="w-6 h-6" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-lg">Facturation électronique obligatoire en 2026</h3>
                <p className="text-violet-100 text-sm">préparez votre entreprise à la nouvelle réglementation tunisienne</p>
              </div>
            </div>
            <Button className="bg-white text-violet-600 hover:bg-gray-100">
              Découvrir la solution
            </Button>
          </div>

          {/* Dashboard Preview */}
          <div className="mt-16">
            <img 
              src="https://finances.iberis.io/images/gestion_commerciale.png" 
              alt="Dashboard" 
              className="rounded-2xl shadow-2xl w-full max-w-5xl mx-auto"
            />
          </div>
        </div>
      </section>

      {/* Companies Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="mb-12 text-center text-2xl font-semibold text-slate-900">
            {t('landing.adoptedBy')}
          </h2>
          <div className="flex flex-wrap justify-center items-center gap-12 opacity-60">
            {/* Mock company logos */}
            <div className="w-32 h-16 bg-gray-200 rounded flex items-center justify-center">Logo 1</div>
            <div className="w-32 h-16 bg-gray-200 rounded flex items-center justify-center">Logo 2</div>
            <div className="w-32 h-16 bg-gray-200 rounded flex items-center justify-center">Logo 3</div>
            <div className="w-32 h-16 bg-gray-200 rounded flex items-center justify-center">Logo 4</div>
            <div className="w-32 h-16 bg-gray-200 rounded flex items-center justify-center">Logo 5</div>
            <div className="w-32 h-16 bg-gray-200 rounded flex items-center justify-center">Logo 6</div>
          </div>
        </div>
      </section>

      {/* Easy Fast Complete Section */}
      <section className="bg-slate-50/70 py-20">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="mb-4 text-center text-4xl font-bold tracking-[-0.04em] text-slate-900">
            {t('landing.easyFastComplete')}
          </h2>
          <p className="mb-16 text-center text-lg text-slate-600">
            {t('landing.easySubtitle')}
          </p>

          {/* Features Grid */}
          <div className="space-y-20">
            {features.map((feature, index) => (
              <div 
                key={index}
                className={`flex flex-col ${index % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'} gap-12 items-center`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="rounded-2xl bg-violet-100 p-3">
                      <feature.icon className="w-6 h-6 text-violet-700" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900">{feature.title}</h3>
                  </div>
                  <p className="text-lg leading-relaxed text-slate-600">{feature.description}</p>
                </div>
                {feature.image && (
                  <div className="flex-1">
                    <img 
                      src={feature.image} 
                      alt={feature.title}
                      className="rounded-xl shadow-lg w-full"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <p className="mb-2 text-center font-semibold text-violet-700">{t('landing.testimonials')}</p>
          <h2 className="mb-16 text-center text-4xl font-bold tracking-[-0.04em] text-slate-900">
            {t('landing.feelTheChange')}
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-6 transition-shadow duration-300 hover:shadow-xl">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-12 w-12 rounded-full bg-violet-100"></div>
                  <div>
                    <p className="font-semibold">Client {i}</p>
                    <p className="text-sm text-slate-500">Entreprise {i}</p>
                  </div>
                </div>
                <p className="text-slate-600">
                  "Iberis a transformé notre gestion quotidienne. Un outil indispensable pour toute entreprise moderne."
                </p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Highlights Section */}
      <section className="bg-slate-50/70 py-20">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="mb-4 text-center text-4xl font-bold tracking-[-0.04em] text-slate-900">
            {t('landing.feelTheChange')}
          </h2>
          <p className="mb-16 text-center text-lg text-slate-600">
            {t('landing.structuredForGrowth')}
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            {highlights.map((highlight, index) => (
              <Card key={index} className="p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100">
                  <highlight.icon className="w-7 h-7 text-violet-700" />
                </div>
                <h3 className="mb-3 text-xl font-bold text-slate-900">{highlight.title}</h3>
                <p className="text-slate-600">{highlight.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="mb-4 text-center text-4xl font-bold tracking-[-0.04em] text-slate-900">
            Des tarifs adaptées à vos besoins
          </h2>
          <p className="mb-12 text-center text-lg text-slate-600">
            Nos plans sont simples, directs et conçus pour s'adapter à l'évolution de votre entreprise
          </p>

          <div className="flex justify-center gap-4 mb-12">
            <Button variant="outline">Mensuel</Button>
            <Button>Annuel</Button>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Free Plan */}
            <Card className="border-2 border-slate-200 p-8">
              <h3 className="text-2xl font-bold mb-2">Gratuit</h3>
              <p className="mb-6 text-slate-600">Le meilleur plan pour essayer Iberis</p>
              <div className="mb-6">
                <span className="text-4xl font-bold">0 DT</span>
                <span className="text-slate-500"> HT / Mois</span>
              </div>
              <Button className="mb-6 w-full">
                Rejoignez-nous
              </Button>
              <ul className="space-y-3 text-sm">
                <li className="flex items-center gap-2">
                  <span className="font-semibold">1</span> Entreprises
                </li>
                <li className="flex items-center gap-2">
                  <span className="font-semibold">1</span> Utilisateurs
                </li>
                <li className="flex items-center gap-2">
                  <span className="font-semibold">5</span> Clients
                </li>
                <li className="flex items-center gap-2">
                  <span className="font-semibold">5</span> Factures de ventes
                </li>
              </ul>
            </Card>

            {/* Premium Plan */}
            <Card className="relative border-2 border-violet-600 p-8">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-violet-600 px-4 py-1 text-sm font-semibold text-white">
                LE PLUS POPULAIRE
              </div>
              <h3 className="text-2xl font-bold mb-2">Premium</h3>
              <p className="mb-6 text-slate-600">Pour les entreprises en croissance</p>
              <div className="mb-6">
                <span className="text-4xl font-bold">39 DT</span>
                <span className="text-slate-500"> HT / Mois</span>
              </div>
              <Button className="mb-6 w-full">
                Rejoignez-nous
              </Button>
              <ul className="space-y-3 text-sm">
                <li className="flex items-center gap-2">
                  <span className="font-semibold">1</span> Entreprises
                </li>
                <li className="flex items-center gap-2">
                  <span className="font-semibold">5</span> Utilisateurs
                </li>
                <li className="flex items-center gap-2">
                  <span className="font-semibold">∞</span> Clients illimités
                </li>
                <li className="flex items-center gap-2">
                  <span className="font-semibold">∞</span> Factures illimitées
                </li>
              </ul>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <h4 className="font-semibold mb-4">Liens</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link to="/features" className="hover:text-white">Fonctionnalités</Link></li>
                <li><Link to="/pricing" className="hover:text-white">Tarifs</Link></li>
                <li><Link to="/blog" className="hover:text-white">Blog</Link></li>
                <li><Link to="/help" className="hover:text-white">Aide</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Légal</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link to="/terms" className="hover:text-white">Conditions d'utilisation</Link></li>
                <li><Link to="/privacy" className="hover:text-white">Politique privée</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Mobile</h4>
              <div className="space-y-2">
                <img src="https://finances.iberis.io/images/mobile/google-play-badge.png" alt="Google Play" className="h-10" />
                <img src="https://finances.iberis.io/images/mobile/app-store-badge.png" alt="App Store" className="h-10" />
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Contactez nous</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li>(+216) 98 15 66 66</li>
                <li>(+216) 55 88 98 99</li>
                <li>support@iberis.io</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-gray-400 text-sm">
            Copyright © 2026 IBERIS SUITE Tous droits réservés v 3.0.1
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;