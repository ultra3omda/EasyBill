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
      await axios.post(`${process.env.REACT_APP_API_URL}/api/auth/reset-password`, {
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
      <div className="min-h-screen bg-gradient-to-br from-violet-50 to-amber-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 shadow-xl">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-10 h-10 text-red-600" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Lien invalide</h1>
            <p className="text-gray-600">
              Le lien de réinitialisation est invalide ou manquant.
            </p>
            <Link to="/forgot-password">
              <Button className="w-full bg-violet-600 hover:bg-violet-700 text-white">
                Demander un nouveau lien
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-amber-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 shadow-xl">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-violet-600 to-violet-700 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">E</span>
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-amber-500 bg-clip-text text-transparent">
              EasyBill
            </span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {success ? 'Mot de passe réinitialisé' : 'Nouveau mot de passe'}
          </h1>
          <p className="text-gray-600">
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
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
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
              <p className="text-xs text-gray-500 mt-1">Au moins 6 caractères</p>
            </div>

            <div>
              <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
              <div className="relative mt-2">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
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
              className="w-full bg-violet-600 hover:bg-violet-700 text-white py-6"
              disabled={loading}
            >
              {loading ? 'Réinitialisation...' : 'Réinitialiser le mot de passe'}
            </Button>
          </form>
        ) : (
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-gray-700 font-medium">
                Votre mot de passe a été réinitialisé avec succès !
              </p>
              <p className="text-sm text-gray-600">
                Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.
              </p>
            </div>
            <Link to="/login">
              <Button className="w-full bg-violet-600 hover:bg-violet-700 text-white">
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
