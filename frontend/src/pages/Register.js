import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card } from '../components/ui/card';
import { toast } from '../hooks/use-toast';
import { toast as sonnerToast } from '../components/ui/sonner';
import { Mail, Lock, User, Building, Chrome } from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [company, setCompany] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({
        title: 'Erreur',
        description: 'Les mots de passe ne correspondent pas',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const result = await register(name, email, password, company);
      if (result.success) {
        if (result.requiresVerification) {
          toast({
            title: 'Inscription réussie',
            description: result.message || 'Consultez votre email pour vérifier votre compte avant de vous connecter.',
          });
          navigate('/login');
        } else {
          toast({
            title: 'Inscription réussie',
            description: 'Bienvenue sur EasyBill!',
          });
          navigate('/dashboard');
        }
      } else if (result.alreadyRegistered) {
        navigate('/login', {
          state: {
            fromRegister: true,
            message: result.message || 'Un compte existe déjà avec cet email. Vous pouvez vous connecter directement.',
          },
        });
      }
    } catch (error) {
      const detail = error.response?.data?.detail;
      const detailStr = typeof detail === 'string' ? detail : (Array.isArray(detail) ? detail[0]?.msg || '' : '');
      toast({
        title: 'Erreur',
        description: detailStr || 'Une erreur est survenue lors de l\'inscription',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      try {
        const result = await loginWithGoogle({ access_token: tokenResponse.access_token });
        if (result.success) {
          sonnerToast.success('Inscription réussie', { description: 'Bienvenue sur EasyBill!' });
          navigate('/dashboard');
        }
      } catch (error) {
        sonnerToast.error('Erreur Google', {
          description: error.response?.data?.detail || 'Erreur lors de la connexion avec Google',
        });
      } finally {
        setLoading(false);
      }
    },
    onError: (error) => {
      console.error('Google OAuth error:', error);
      sonnerToast.error('Connexion Google annulée', {
        description: 'La connexion Google a été annulée ou a échoué.',
      });
      setLoading(false);
    },
    flow: 'implicit',
  });
  
  const handleGoogleLogin = () => {
    // Redirection vers la page login pour la connexion Google (flux redirect)
    navigate('/login');
  };


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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('auth.registerTitle')}</h1>
          <p className="text-gray-600">Commencez votre essai gratuit</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-5" data-testid="register-form">
          <div>
            <Label htmlFor="name">{t('auth.fullName')}</Label>
            <div className="relative mt-2">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="pl-10"
                placeholder="Nom complet"
                required
                data-testid="register-name-input"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="company">{t('auth.companyName')}</Label>
            <div className="relative mt-2">
              <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                id="company"
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="pl-10"
                placeholder="Nom de l'entreprise"
                required
                data-testid="register-company-input"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="email">{t('auth.email')}</Label>
            <div className="relative mt-2">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                placeholder="exemple@email.com"
                required
                data-testid="register-email-input"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="password">{t('auth.password')}</Label>
            <div className="relative mt-2">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10"
                placeholder="••••••••"
                required
                data-testid="register-password-input"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="confirmPassword">{t('auth.confirmPassword')}</Label>
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
                data-testid="register-confirm-password-input"
              />
            </div>
          </div>

          <Button 
            type="submit" 
            className="w-full bg-violet-600 hover:bg-violet-700 text-white py-6"
            disabled={loading}
            data-testid="register-submit-button"
          >
            {loading ? 'Inscription...' : t('auth.registerButton')}
          </Button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">{t('auth.orContinueWith')}</span>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full py-6 border-2 hover:bg-violet-50"
          onClick={() => googleLogin()}
          disabled={loading}
          data-testid="register-google-button"
        >
          <Chrome className="w-5 h-5 mr-2" />
          {t('auth.googleLogin')}
        </Button>

        <p className="text-center mt-6 text-gray-600">
          {t('auth.hasAccount')}{' '}
          <Link to="/login" className="text-violet-600 hover:text-violet-700 font-semibold">
            {t('auth.loginButton')}
          </Link>
        </p>
      </Card>
    </div>
  );
};

export default Register;
