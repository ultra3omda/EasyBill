import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/_core/hooks/useAuth";
import { getGoogleLoginUrl, getLoginUrl } from "@/const";
import { Link, useLocation } from "wouter";
import { FileText, Mail, Lock, User, ArrowLeft, Check } from "lucide-react";
import { useState } from "react";

export default function Register() {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Redirect if already authenticated
  if (isAuthenticated) {
    setLocation("/dashboard");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      alert("Les mots de passe ne correspondent pas");
      return;
    }
    if (!acceptTerms) {
      alert("Veuillez accepter les conditions d'utilisation");
      return;
    }
    setIsLoading(true);
    // Redirect to OAuth login
    window.location.href = getLoginUrl();
  };

  const handleSocialLogin = (provider: string) => {
    if (provider === "google") {
      window.location.href = getGoogleLoginUrl("/dashboard");
      return;
    }
    window.location.href = getLoginUrl();
  };

  const benefits = [
    "Gestion complète de la facturation",
    "Conforme à la réglementation tunisienne",
    "Support client réactif",
    "Mises à jour régulières"
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex flex-col">
      {/* Header */}
      <header className="p-4">
        <Link href="/" className="inline-flex items-center gap-2 text-gray-600 hover:text-primary">
          <ArrowLeft className="w-4 h-4" />
          Retour à l'accueil
        </Link>
      </header>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-4xl grid lg:grid-cols-2 gap-8">
          {/* Benefits */}
          <div className="hidden lg:flex flex-col justify-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Rejoignez EasyBill
            </h2>
            <p className="text-gray-600 mb-8">
              Créez votre compte gratuitement et commencez à gérer votre facturation 
              en toute simplicité.
            </p>
            <ul className="space-y-4">
              {benefits.map((benefit, index) => (
                <li key={index} className="flex items-center gap-3">
                  <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-gray-700">{benefit}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Registration Form */}
          <Card>
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4 lg:hidden">
                <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center">
                  <FileText className="w-7 h-7 text-white" />
                </div>
              </div>
              <CardTitle className="text-2xl">Créer un compte</CardTitle>
              <CardDescription>
                Commencez gratuitement, sans engagement
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Social Login Buttons */}
              <div className="space-y-3 mb-6">
                <Button 
                  variant="outline" 
                  className="w-full gap-2"
                  onClick={() => handleSocialLogin('google')}
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  S'inscrire avec Google
                </Button>
                
                <Button 
                  variant="outline" 
                  className="w-full gap-2"
                  onClick={() => handleSocialLogin('apple')}
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                  </svg>
                  S'inscrire avec Apple
                </Button>
                
                <Button 
                  variant="outline" 
                  className="w-full gap-2"
                  onClick={() => handleSocialLogin('facebook')}
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#1877F2">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                  S'inscrire avec Facebook
                </Button>
              </div>

              <div className="relative mb-6">
                <Separator />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-2 text-sm text-gray-500">
                  ou
                </span>
              </div>

              {/* Registration Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nom complet</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input 
                      id="name"
                      type="text"
                      placeholder="Votre nom"
                      className="pl-10"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input 
                      id="email"
                      type="email"
                      placeholder="votre@email.com"
                      className="pl-10"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password">Mot de passe</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input 
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      className="pl-10"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input 
                      id="confirmPassword"
                      type="password"
                      placeholder="••••••••"
                      className="pl-10"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Checkbox 
                    id="terms" 
                    checked={acceptTerms}
                    onCheckedChange={(checked) => setAcceptTerms(checked as boolean)}
                  />
                  <Label htmlFor="terms" className="text-sm text-gray-600 leading-tight">
                    J'accepte les{" "}
                    <Link href="/terms" className="text-primary hover:underline">
                      conditions d'utilisation
                    </Link>{" "}
                    et la{" "}
                    <Link href="/privacy" className="text-primary hover:underline">
                      politique de confidentialité
                    </Link>
                  </Label>
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Création..." : "Créer mon compte"}
                </Button>
              </form>

              <p className="text-center text-sm text-gray-600 mt-6">
                Déjà un compte ?{" "}
                <Link href="/login" className="text-primary font-medium hover:underline">
                  Se connecter
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <footer className="p-4 text-center text-sm text-gray-500">
        © 2026 EasyBill. Tous droits réservés.
      </footer>
    </div>
  );
}
