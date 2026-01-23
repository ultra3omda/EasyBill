import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { Globe, Sun, Moon } from 'lucide-react';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

const Navbar = () => {
  const { language, changeLanguage, t } = useLanguage();
  const [theme, setTheme] = React.useState('light');

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.classList.toggle('dark');
  };

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center space-x-2">
            <img 
              src="https://finances.iberis.io/images/logo-iberis.png" 
              alt="Iberis" 
              className="h-8"
            />
          </Link>

          <div className="hidden md:flex items-center space-x-8">
            <Link to="/features" className="text-gray-700 hover:text-teal-600 transition-colors">
              {t('nav.features')}
            </Link>
            <Link to="/mobile" className="text-gray-700 hover:text-teal-600 transition-colors flex items-center gap-1">
              {t('nav.mobile')}
              <span className="bg-teal-100 text-teal-700 text-xs px-2 py-0.5 rounded-full font-medium">New</span>
            </Link>
            <Link to="/pricing" className="text-gray-700 hover:text-teal-600 transition-colors">
              {t('nav.pricing')}
            </Link>
            <Link to="/blog" className="text-gray-700 hover:text-teal-600 transition-colors">
              {t('nav.blog')}
            </Link>
            <Link to="/help" className="text-gray-700 hover:text-teal-600 transition-colors">
              {t('nav.help')}
            </Link>
            <Link to="/sponsors" className="text-gray-700 hover:text-teal-600 transition-colors">
              {t('nav.sponsors')}
            </Link>
          </div>

          <div className="flex items-center space-x-4">
            <button onClick={toggleTheme} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              {theme === 'light' ? <Moon className="w-5 h-5 text-gray-600" /> : <Sun className="w-5 h-5 text-gray-600" />}
            </button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center space-x-1 p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <img 
                    src={language === 'fr' ? 'https://finances.iberis.io/images/flags/4x3/fr.svg' : 'https://finances.iberis.io/images/flags/4x3/gb.svg'}
                    alt={language}
                    className="w-5 h-4"
                  />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => changeLanguage('fr')}>
                  <img src="https://finances.iberis.io/images/flags/4x3/fr.svg" alt="FR" className="w-5 h-4 mr-2" />
                  Français
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => changeLanguage('en')}>
                  <img src="https://finances.iberis.io/images/flags/4x3/gb.svg" alt="EN" className="w-5 h-4 mr-2" />
                  English
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Link to="/login">
              <Button variant="ghost" className="text-gray-700">
                {t('nav.login')}
              </Button>
            </Link>
            <Link to="/register">
              <Button className="bg-teal-600 hover:bg-teal-700 text-white">
                {t('nav.register')}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;