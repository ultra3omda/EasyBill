import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card } from '../components/ui/card';
import { toast } from '../hooks/use-toast';
import { Lock, CheckCircle, AlertCircle } from 'lucide-react';
import axios from 'axios';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast({
        title: 'Erreur',
        description: 'Les mots de passe ne correspondent pas',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: 'Erreur',
        description: 'Le mot de passe doit contenir au moins 6 caractères',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/auth/reset-password`, {
        token,
        new_password: newPassword,
        confirm_password: confirmPassword
      });

      setSuccess(true);
      toast({
        title: 'Succès',
        description: 'Votre mot de passe a été réinitialisé avec succès',
      });

      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (error) {
      toast({
        title: 'Erreur',
        description: error.response?.data?.detail || 'Le lien de réinitialisation est invalide ou expiré',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(123,92,255,0.14),_transparent_38%),linear-gradient(180deg,_#fcfbff_0%,_#f7f4ff_55%,_#fffaf0_100%)] p-4">
        <Card className="w-full max-w-md p-8 shadow-2xl shadow-violet-100/60">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                <AlertCircle className="w-10 h-10 text-red-600" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Lien invalide</h1>
            <p className="text-slate-600">
              Le lien de réinitialisation est invalide ou manquant.
            </p>
            <Link to="/forgot-password">
              <Button className="w-full">
                Demander un nouveau lien
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

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
          <h1 className="mb-2 text-3xl font-bold tracking-[-0.03em] text-slate-900">
            {success ? 'Mot de passe réinitialisé' : 'Nouveau mot de passe'}
          </h1>
          <p className="text-slate-600">
            {success 
              ? 'Vous allez être redirigé vers la page de connexion' 
              : 'Choisissez un nouveau mot de passe sécurisé'}
          </p>
        </div>

        {!success ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="newPassword">Nouveau mot de passe</Label>
              <div className="relative mt-2">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pl-10"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">Au moins 6 caractères</p>
            </div>

            <div>
              <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
              <div className="relative mt-2">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full py-6"
              disabled={loading}
            >
              {loading ? 'Réinitialisation...' : 'Réinitialiser le mot de passe'}
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
              <p className="font-medium text-slate-700">
                Votre mot de passe a été réinitialisé avec succès !
              </p>
              <p className="text-sm text-slate-600">
                Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.
              </p>
            </div>
            <Link to="/login">
              <Button className="w-full">
                Se connecter
              </Button>
            </Link>
          </div>
        )}

        {!success && (
          <div className="mt-6 text-center">
            <Link 
              to="/login" 
              className="text-violet-600 hover:text-violet-700 font-semibold"
            >
              Retour à la connexion
            </Link>
          </div>
        )}
      </Card>
    </div>
  );
};

export default ResetPassword;
