import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card } from '../components/ui/card';
import { toast } from '../hooks/use-toast';
import { Mail, Lock, Chrome } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, loginWithGoogle } = useAuth();
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
        title: 'Erreur',
        description: 'Email ou mot de passe incorrect',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const result = await loginWithGoogle();
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
        description: 'Erreur lors de la connexion avec Google',
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

        <Button
          type="button"
          variant="outline"
          className="w-full py-6 border-2 hover:bg-violet-50"
          onClick={handleGoogleLogin}
          disabled={loading}
          data-testid="login-google-button"
        >
          <Chrome className="w-5 h-5 mr-2" />
          {t('auth.googleLogin')}
        </Button>

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
