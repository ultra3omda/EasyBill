import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { Globe, Sun, Moon, LayoutDashboard } from 'lucide-react';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

const Navbar = () => {
  const { language, changeLanguage, t } = useLanguage();
  const { user } = useAuth();
  const [theme, setTheme] = React.useState('light');

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.classList.toggle('dark');
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-violet-100/80 bg-white/85 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-violet-700">
              <span className="text-white font-bold text-lg">E</span>
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-violet-600 to-amber-500 bg-clip-text text-transparent">
              EasyBill
            </span>
          </Link>

          <div className="hidden md:flex items-center space-x-8">
            <Link to="/features" className="text-slate-700 transition-colors hover:text-violet-600">
              {t('nav.features')}
            </Link>
            <Link to="/mobile" className="flex items-center gap-1 text-slate-700 transition-colors hover:text-violet-600">
              {t('nav.mobile')}
              <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full font-medium">New</span>
            </Link>
            <Link to="/pricing" className="text-slate-700 transition-colors hover:text-violet-600">
              {t('nav.pricing')}
            </Link>
            <Link to="/blog" className="text-slate-700 transition-colors hover:text-violet-600">
              {t('nav.blog')}
            </Link>
            <Link to="/help" className="text-slate-700 transition-colors hover:text-violet-600">
              {t('nav.help')}
            </Link>
          </div>

          <div className="flex items-center space-x-4">
            <button onClick={toggleTheme} className="rounded-xl p-2 transition-colors hover:bg-violet-50">
              {theme === 'light' ? <Moon className="h-5 w-5 text-slate-600" /> : <Sun className="h-5 w-5 text-slate-600" />}
            </button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center space-x-1 rounded-xl p-2 transition-colors hover:bg-violet-50">
                  <img 
                    src={language === 'fr' ? 'https://flagcdn.com/w40/fr.png' : 'https://flagcdn.com/w40/gb.png'}
                    alt={language}
                    className="w-5 h-4 object-cover rounded"
                  />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => changeLanguage('fr')}>
                  <img src="https://flagcdn.com/w40/fr.png" alt="FR" className="w-5 h-4 mr-2 object-cover rounded" />
                  Français
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => changeLanguage('en')}>
                  <img src="https://flagcdn.com/w40/gb.png" alt="EN" className="w-5 h-4 mr-2 object-cover rounded" />
                  English
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {user ? (
              <Link to="/dashboard">
                <Button className="gap-2">
                  <LayoutDashboard className="w-4 h-4" />
                  Tableau de bord
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" className="text-slate-700">
                    {t('nav.login')}
                  </Button>
                </Link>
                <Link to="/register">
                  <Button>
                    {t('nav.register')}
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
