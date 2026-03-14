import React, { useEffect, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import axios from 'axios';

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [status, setStatus] = useState('loading'); // loading, success, error
  const [message, setMessage] = useState('');

  useEffect(() => {
    const verifyEmail = async () => {
      if (!token) {
        setStatus('error');
        setMessage('Token de vérification manquant');
        return;
      }

      try {
        await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/auth/verify-email/${token}`);
        setStatus('success');
        setMessage('Votre email a été vérifié avec succès !');
        
        // Redirect to login after 3 seconds
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      } catch (error) {
        setStatus('error');
        setMessage(error.response?.data?.detail || 'Le lien de vérification est invalide ou expiré');
      }
    };

    verifyEmail();
  }, [token, navigate]);

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
          <h1 className="mb-2 text-3xl font-bold tracking-[-0.03em] text-slate-900">Vérification d'email</h1>
        </div>

        <div className="text-center space-y-6">
          {status === 'loading' && (
            <>
              <div className="flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-violet-100">
                  <Loader2 className="w-10 h-10 text-violet-600 animate-spin" />
                </div>
              </div>
              <div className="space-y-2">
                <p className="font-medium text-slate-700">
                  Vérification en cours...
                </p>
                <p className="text-sm text-slate-600">
                  Veuillez patienter pendant que nous vérifions votre email.
                </p>
              </div>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle className="w-10 h-10 text-green-600" />
                </div>
              </div>
              <div className="space-y-2">
                <p className="font-medium text-slate-700">
                  Email vérifié avec succès !
                </p>
                <p className="text-sm text-slate-600">
                  Vous allez être redirigé vers la page de connexion...
                </p>
              </div>
              <Link to="/login">
                <Button className="w-full">
                  Se connecter maintenant
                </Button>
              </Link>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                  <AlertCircle className="w-10 h-10 text-red-600" />
                </div>
              </div>
              <div className="space-y-2">
                <p className="font-medium text-slate-700">
                  Erreur de vérification
                </p>
                <p className="text-sm text-slate-600">
                  {message}
                </p>
              </div>
              <div className="space-y-3">
                <Link to="/login">
                  <Button className="w-full">
                    Retour à la connexion
                  </Button>
                </Link>
                <Link to="/register">
                  <Button variant="outline" className="w-full">
                    Créer un nouveau compte
                  </Button>
                </Link>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  );
};

export default VerifyEmail;
