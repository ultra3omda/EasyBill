import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card } from '../components/ui/card';
import { toast } from '../hooks/use-toast';
import { Mail, Lock, Facebook, Chrome } from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, loginWithGoogle, loginWithFacebook } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await login(email, password);
      if (result.success) {
        toast({
          title: 'Connexion réussie',
          description: 'Bienvenue sur EasyBill!',
        });
        navigate('/dashboard');
      }
    } catch (error) {
      toast({
        title: 'Connexion échouée',
        description: error.response?.data?.detail || 'Email ou mot de passe incorrect',
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
        // tokenResponse.access_token → le backend appelle /userinfo pour récupérer email/name
        const result = await loginWithGoogle({ access_token: tokenResponse.access_token });
        if (result.success) {
          toast({ title: 'Connexion réussie', description: 'Bienvenue sur EasyBill!' });
          navigate('/dashboard');
        }
      } catch (error) {
        toast({
          title: 'Erreur Google',
          description: error.response?.data?.detail || 'Erreur lors de la connexion avec Google',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    },
    onError: (error) => {
      console.error('Google OAuth error:', error);
      toast({
        title: 'Connexion Google annulée',
        description: 'La connexion Google a été annulée ou a échoué.',
        variant: 'destructive',
      });
    },
    flow: 'implicit',
  });

  const handleFacebookLogin = async () => {
    setLoading(true);
    try {
      const result = await loginWithFacebook();
      if (result.success) {
        toast({
          title: 'Connexion réussie',
          description: 'Bienvenue sur EasyBill!',
        });
        navigate('/dashboard');
      }
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Erreur lors de la connexion avec Facebook',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('auth.loginTitle')}</h1>
          <p className="text-gray-600">Accédez à votre espace de gestion</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6" data-testid="login-form">
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
                data-testid="login-email-input"
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
                data-testid="login-password-input"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center">
              <input type="checkbox" className="mr-2 accent-violet-600" data-testid="login-remember-checkbox" />
              <span className="text-sm text-gray-600">Se souvenir de moi</span>
            </label>
            <Link to="/forgot-password" className="text-sm text-violet-600 hover:text-violet-700">
              {t('auth.forgotPassword')}
            </Link>
          </div>

          <Button 
            type="submit" 
            className="w-full bg-violet-600 hover:bg-violet-700 text-white py-6"
            disabled={loading}
            data-testid="login-submit-button"
          >
            {loading ? 'Connexion...' : t('auth.loginButton')}
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

        <div className="space-y-3">
          <Button
            type="button"
            variant="outline"
            className="w-full py-6 border-2 hover:bg-red-50 border-gray-300"
            onClick={() => googleLogin()}
            data-testid="login-google-button"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Se connecter avec Google
          </Button>
          
          <Button
            type="button"
            variant="outline"
            className="w-full py-6 border-2 hover:bg-blue-50"
            onClick={handleFacebookLogin}
            disabled={loading}
            data-testid="login-facebook-button"
          >
            <Facebook className="w-5 h-5 mr-2" />
            Continuer avec Facebook
          </Button>
        </div>

        <p className="text-center mt-6 text-gray-600">
          {t('auth.noAccount')}{' '}
          <Link to="/register" className="text-violet-600 hover:text-violet-700 font-semibold">
            {t('auth.registerButton')}
          </Link>
        </p>
      </Card>
    </div>
  );
};

export default Login;
