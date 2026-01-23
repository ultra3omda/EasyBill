import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Star, Zap, Crown } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

const plans = [
  {
    name: "Gratuit",
    price: "0",
    description: "Pour démarrer",
    features: [
      "1 entreprise",
      "50 factures/mois",
      "50 devis/mois",
      "Gestion des clients",
      "Gestion des produits",
      "Tableau de bord basique",
    ],
    limitations: [
      "Pas d'export PDF personnalisé",
      "Pas d'OCR",
      "Support communautaire",
    ],
    icon: Zap,
    current: true,
  },
  {
    name: "Premium",
    price: "29",
    description: "Pour les professionnels",
    features: [
      "Entreprises illimitées",
      "Factures illimitées",
      "Devis illimités",
      "Export PDF personnalisé",
      "OCR pour factures fournisseurs",
      "Rappels automatiques",
      "Envoi d'emails automatique",
      "Tableau de bord avancé",
      "Support prioritaire",
    ],
    limitations: [],
    icon: Crown,
    recommended: true,
  },
  {
    name: "Entreprise",
    price: "99",
    description: "Pour les grandes équipes",
    features: [
      "Tout Premium inclus",
      "Multi-utilisateurs",
      "Rôles et permissions",
      "API access",
      "Intégrations comptables",
      "Formation personnalisée",
      "Support dédié 24/7",
    ],
    limitations: [],
    icon: Star,
  },
];

function SubscriptionContent() {
  return (
    <div className="space-y-6">
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold tracking-tight">Choisissez votre plan</h1>
        <p className="text-muted-foreground mt-2">
          Sélectionnez le plan qui correspond le mieux à vos besoins. 
          Vous pouvez changer de plan à tout moment.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
        {plans.map((plan) => (
          <Card 
            key={plan.name} 
            className={`relative ${plan.recommended ? "border-primary shadow-lg" : ""}`}
          >
            {plan.recommended && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-primary">Recommandé</Badge>
              </div>
            )}
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 p-3 rounded-full bg-primary/10 w-fit">
                <plan.icon className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>{plan.name}</CardTitle>
              <CardDescription>{plan.description}</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold">{plan.price}</span>
                <span className="text-muted-foreground"> TND/mois</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
                {plan.limitations.map((limitation) => (
                  <li key={limitation} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="h-4 w-4 flex-shrink-0 text-center">-</span>
                    {limitation}
                  </li>
                ))}
              </ul>
              <Button 
                className="w-full" 
                variant={plan.current ? "outline" : "default"}
                disabled={plan.current}
                onClick={() => toast.info("Système de paiement à venir")}
              >
                {plan.current ? "Plan actuel" : "Choisir ce plan"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="text-center text-sm text-muted-foreground max-w-2xl mx-auto">
        <p>
          Tous les prix sont en Dinars Tunisiens (TND) et hors taxes.
          Les abonnements sont facturés mensuellement et peuvent être annulés à tout moment.
        </p>
      </div>

      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Questions fréquentes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium">Puis-je changer de plan à tout moment ?</h4>
            <p className="text-sm text-muted-foreground">
              Oui, vous pouvez passer à un plan supérieur ou inférieur à tout moment. 
              La différence sera calculée au prorata.
            </p>
          </div>
          <div>
            <h4 className="font-medium">Quels moyens de paiement acceptez-vous ?</h4>
            <p className="text-sm text-muted-foreground">
              Nous acceptons les cartes bancaires (Visa, Mastercard), les virements bancaires 
              et le paiement par chèque pour les plans annuels.
            </p>
          </div>
          <div>
            <h4 className="font-medium">Y a-t-il un engagement ?</h4>
            <p className="text-sm text-muted-foreground">
              Non, tous nos plans sont sans engagement. Vous pouvez annuler à tout moment 
              et votre abonnement restera actif jusqu'à la fin de la période payée.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Subscription() {
  return (
    <DashboardLayout>
      <SubscriptionContent />
    </DashboardLayout>
  );
}
