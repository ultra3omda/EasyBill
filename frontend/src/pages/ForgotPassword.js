import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card } from '../components/ui/card';
import { toast } from '../hooks/use-toast';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import axios from 'axios';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/auth/forgot-password`, {
        email
      });

      setEmailSent(true);
      toast({
        title: 'Email envoyé',
        description: 'Si votre email existe, vous recevrez un lien de réinitialisation',
      });

      // For development: show reset link in console
      if (response.data.reset_link) {
        console.log('Reset link:', response.data.reset_link);
      }
    } catch (error) {
      toast({
        title: 'Erreur',
        description: error.response?.data?.detail || 'Une erreur est survenue',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(123,92,255,0.14),_transparent_38%),linear-gradient(180deg,_#fcfbff_0%,_#f7f4ff_55%,_#fffaf0_100%)] p-4">
      <Card className="w-full max-w-md p-8 shadow-2xl shadow-violet-100/60">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-violet-700">
              <span className="text-white font-bold text-xl">E</span>
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-amber-500 bg-clip-text text-transparent">
              EasyBill
            </span>
          </div>
          <h1 className="mb-2 text-3xl font-bold tracking-[-0.03em] text-slate-900">Mot de passe oublié</h1>
          <p className="text-slate-600">
            {emailSent 
              ? "Vérifiez votre boîte mail" 
              : "Entrez votre email pour réinitialiser votre mot de passe"}
          </p>
        </div>

        {!emailSent ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="email">Adresse email</Label>
              <div className="relative mt-2">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  placeholder="exemple@email.com"
                  required
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full py-6"
              disabled={loading}
            >
              {loading ? 'Envoi en cours...' : 'Envoyer le lien de réinitialisation'}
            </Button>
          </form>
        ) : (
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-slate-700">
                Un email a été envoyé à <strong>{email}</strong>
              </p>
              <p className="text-sm text-slate-600">
                Cliquez sur le lien dans l'email pour réinitialiser votre mot de passe.
                Le lien expire dans 30 minutes.
              </p>
            </div>
            <Button
              onClick={() => setEmailSent(false)}
              variant="outline"
              className="w-full"
            >
              Renvoyer l'email
            </Button>
          </div>
        )}

        <div className="mt-6 text-center">
          <Link 
            to="/login" 
            className="inline-flex items-center text-violet-600 hover:text-violet-700 font-semibold"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour à la connexion
          </Link>
        </div>
      </Card>
    </div>
  );
};

export default ForgotPassword;
