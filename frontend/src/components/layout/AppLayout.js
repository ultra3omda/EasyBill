import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useCompany } from '../../hooks/useCompany';
import {
  LayoutDashboard,
  Users,
  Package,
  ShoppingBag,
  ShoppingCart,
  Calculator,
  FolderKanban,
  LogOut,
  ChevronDown,
  ChevronRight,
  Bell,
  Search,
  Menu,
  X,
  Building2,
  Plus,
  FileText,
  Truck,
  Warehouse,
  ClipboardList,
  ArrowLeftRight,
  Receipt,
  FileOutput,
  CreditCard,
  AlertCircle,
  Store,
  ClipboardCheck,
  FileInput,
  Briefcase,
  Percent,
  BookOpen,
  PenLine,
  BookMarked,
  Scale,
  Calendar,
  FileBarChart,
  Settings,
  UserPlus,
  Shield,
  PlusCircle,
  Landmark,
  Palette,
  CalendarDays,
  FileKey,
  FolderOpen,
  BarChart3,
  Link2,
  Workflow,
  TrendingUp,
  Activity,
  PieChart,
  Check,
  Clock,
  Info,
  CheckCircle
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '../ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { companiesAPI } from '../../services/api';
import { toast } from '../../hooks/use-toast';

// Legal Forms for Tunisia
const LEGAL_FORMS = [
  { value: 'SARL', label: 'SARL - Société à responsabilité limitée' },
  { value: 'SA', label: 'SA - Société anonyme' },
  { value: 'SUARL', label: 'SUARL - Société unipersonnelle' },
  { value: 'SNC', label: 'SNC - Société en nom collectif' },
  { value: 'SCS', label: 'SCS - Société en commandite simple' },
  { value: 'GIE', label: 'GIE - Groupement d\'intérêt économique' },
  { value: 'EI', label: 'Entreprise Individuelle' },
  { value: 'OTHER', label: 'Autre' }
];

// Tunisian Governorates
const GOVERNORATES = [
  'Tunis', 'Ariana', 'Ben Arous', 'Manouba', 'Nabeul', 'Zaghouan', 'Bizerte',
  'Béja', 'Jendouba', 'Le Kef', 'Siliana', 'Sousse', 'Monastir', 'Mahdia',
  'Sfax', 'Kairouan', 'Kasserine', 'Sidi Bouzid', 'Gabès', 'Medenine',
  'Tataouine', 'Gafsa', 'Tozeur', 'Kébili'
];

// Activity Types
const ACTIVITIES = [
  'Agence ou société commerciale',
  'Industrie',
  'Services',
  'Commerce de gros',
  'Commerce de détail',
  'Import/Export',
  'Construction et BTP',
  'Transport et logistique',
  'Technologies de l\'information',
  'Conseil et consulting',
  'Santé et pharmaceutique',
  'Agriculture et agroalimentaire',
  'Banques et assurances',
  'Immobilier',
  'Autre'
];

// Currencies
const CURRENCIES = [
  { value: 'TND', label: 'Dinar(s) tunisien' },
  { value: 'EUR', label: 'Euro' },
  { value: 'USD', label: 'Dollar américain' },
  { value: 'GBP', label: 'Livre sterling' }
];

// Fiscal Year options
const FISCAL_YEARS = [
  { value: 'jan-dec', label: 'Janvier - Décembre' },
  { value: 'apr-mar', label: 'Avril - Mars' },
  { value: 'jul-jun', label: 'Juillet - Juin' },
  { value: 'oct-sep', label: 'Octobre - Septembre' }
];

const AppLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const { language, changeLanguage, t } = useLanguage();
  const { companies, currentCompany, switchCompany, loadCompanies } = useCompany();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState({});
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [newCompanyModalOpen, setNewCompanyModalOpen] = useState(false);
  const [creatingCompany, setCreatingCompany] = useState(false);
  const [newCompanyData, setNewCompanyData] = useState({
    name: '',
    activity: '',
    phone: '',
    website: '',
    fiscal_id: '',
    fiscal_year: 'jan-dec',
    currency: 'TND',
    logo: null,
    address: {
      street: '',
      governorate: '',
      postal_code: '',
      country: 'Tunisie'
    }
  });

  // Mock notifications
  const [notifications] = useState([
    { id: 1, type: 'info', title: 'Bienvenue sur EasyBill', message: 'Commencez par créer votre première facture', time: 'Il y a 2h', read: false },
    { id: 2, type: 'success', title: 'Paiement reçu', message: 'Le client ABC a payé la facture #001', time: 'Il y a 5h', read: false },
    { id: 3, type: 'warning', title: 'Facture en retard', message: 'La facture #003 est en retard de 5 jours', time: 'Hier', read: true }
  ]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleMenu = (menuKey) => {
    setExpandedMenus(prev => ({
      ...prev,
      [menuKey]: !prev[menuKey]
    }));
  };

  const handleCompanySelect = (companyId) => {
    switchCompany(companyId);
    navigate('/dashboard');
    toast({ title: 'Entreprise sélectionnée', description: 'Vous travaillez maintenant sur cette entreprise' });
  };

  const handleCreateCompany = async () => {
    if (!newCompanyData.name.trim()) {
      toast({ title: 'Erreur', description: 'Le nom de l\'entreprise est requis', variant: 'destructive' });
      return;
    }
    if (!newCompanyData.activity) {
      toast({ title: 'Erreur', description: 'L\'activité est requise', variant: 'destructive' });
      return;
    }

    setCreatingCompany(true);
    try {
      await companiesAPI.create(newCompanyData);
      toast({ title: 'Succès', description: 'Entreprise créée avec succès' });
      await loadCompanies();
      setNewCompanyModalOpen(false);
      setNewCompanyData({
        name: '',
        activity: '',
        phone: '',
        website: '',
        fiscal_id: '',
        fiscal_year: 'jan-dec',
        currency: 'TND',
        logo: null,
        address: { street: '', governorate: '', postal_code: '', country: 'Tunisie' }
      });
      navigate('/dashboard');
    } catch (error) {
      console.error('Error creating company:', error);
      toast({ title: 'Erreur', description: 'Impossible de créer l\'entreprise', variant: 'destructive' });
    } finally {
      setCreatingCompany(false);
    }
  };

  // Menu structure based on iberis.io with nested submenus
  const menuStructure = [
    {
      type: 'single',
      icon: LayoutDashboard,
      label: 'Tableau de bord',
      path: '/dashboard'
    },
    {
      type: 'group',
      key: 'contacts',
      icon: Users,
      label: 'Contacts',
      items: [
        { icon: Users, label: 'Clients', path: '/customers' },
        { icon: Truck, label: 'Fournisseurs', path: '/suppliers' }
      ]
    },
    {
      type: 'group',
      key: 'stock',
      icon: Package,
      label: 'Stock',
      items: [
        { icon: Package, label: 'Articles', path: '/products' },
        { icon: Warehouse, label: 'Entrepôts', path: '/warehouses' },
        { icon: ClipboardList, label: 'Inventaire', path: '/inventory' },
        { icon: ArrowLeftRight, label: 'Mouvements', path: '/stock-movements' }
      ]
    },
    {
      type: 'group',
      key: 'ventes',
      icon: ShoppingBag,
      label: 'Ventes',
      items: [
        { icon: Truck, label: 'Bons de livraison', path: '/sales/delivery-notes' },
        { icon: FileOutput, label: 'Bons de sortie', path: '/sales/exit-vouchers' },
        { icon: FileText, label: 'Devis', path: '/sales/quotes' },
        { icon: Receipt, label: 'Factures', path: '/sales/invoices' },
        { icon: FileInput, label: "Factures d'avoir", path: '/sales/credit-notes' },
        { icon: ClipboardCheck, label: 'Notes de débours', path: '/sales/disbursements' },
        { icon: CreditCard, label: 'Paiements', path: '/sales/payments' },
        { icon: AlertCircle, label: 'Rappels', path: '/sales/reminders' }
      ]
    },
    {
      type: 'group',
      key: 'achats',
      icon: ShoppingCart,
      label: 'Achats',
      items: [
        { icon: FileText, label: 'Bons de commande', path: '/purchases/purchase-orders' },
        { icon: FileInput, label: 'Bons de réception', path: '/purchases/receipts' },
        { icon: Receipt, label: 'Factures fournisseur', path: '/purchases/supplier-invoices' },
        { icon: CreditCard, label: 'Paiements', path: '/purchases/supplier-payments' }
      ]
    },
    {
      type: 'group',
      key: 'comptabilite',
      icon: Calculator,
      label: 'Comptabilité',
      items: [
        { icon: PieChart, label: 'Tableau de bord', path: '/accounting-dashboard' },
        { icon: BookOpen, label: 'Plan comptable', path: '/chart-of-accounts' },
        { icon: PenLine, label: 'Écritures Comptables', path: '/journal-entries' },
        { icon: BookMarked, label: 'Grand Livre', path: '/general-ledger' },
        { icon: Scale, label: 'Balance des comptes', path: '/trial-balance' },
        { icon: Percent, label: 'Retenues à la source', path: '/accounting/withholding-taxes' },
        { icon: FileText, label: 'Journaux légaux', path: '/legal-journals' },
        { icon: Calendar, label: 'Exercices comptables', path: '/fiscal-years' },
        { 
          type: 'nested',
          key: 'etats-comptables',
          icon: FileBarChart, 
          label: 'États comptables',
          items: [
            { icon: FileBarChart, label: 'Bilan', path: '/bilan' },
            { icon: TrendingUp, label: 'État de résultat', path: '/income-statement' },
            { icon: Activity, label: 'État des flux de trésorerie', path: '/cash-flow' },
            { icon: PieChart, label: 'États financiers', path: '/financial-statements' }
          ]
        }
      ]
    },
    {
      type: 'single',
      icon: FolderKanban,
      label: 'Projets',
      path: '/projects'
    },
    {
      type: 'group',
      key: 'parametres',
      icon: Settings,
      label: 'Paramètres',
      items: [
        { icon: UserPlus, label: 'Collaborateurs', path: '/collaborators' },
        { icon: Shield, label: 'Rôles & permissions', path: '/roles-permissions' },
        { icon: PlusCircle, label: 'Entrées supplémentaires', path: '/additional-entries' },
        { icon: Percent, label: 'Taxes', path: '/taxes' },
        { icon: Landmark, label: 'Banques', path: '/banks' },
        { icon: Palette, label: 'Personnalisation', path: '/customization' },
        { icon: CalendarDays, label: 'Calendrier', path: '/calendar' },
        { icon: FileKey, label: "Journal d'accès", path: '/access-logs' },
        { icon: FolderOpen, label: 'Mes Fichiers', path: '/files' },
        { icon: BarChart3, label: 'Mes Rapports', path: '/reports' },
        { icon: Link2, label: 'Intégrations', path: '/integrations' },
        { icon: Workflow, label: 'Workflows', path: '/workflows' }
      ]
    }
  ];

  const isActiveItem = (path) => location.pathname === path;
  const isActiveGroup = (items) => items?.some(item => {
    if (item.type === 'nested') {
      return item.items?.some(subItem => location.pathname === subItem.path);
    }
    return location.pathname === item.path;
  });

  // Render menu item (handles nested submenus)
  const renderMenuItem = (item, depth = 0) => {
    if (item.type === 'nested') {
      const isExpanded = expandedMenus[item.key];
      const hasActiveChild = item.items?.some(subItem => location.pathname === subItem.path);
      
      return (
        <div key={item.key}>
          <button
            onClick={() => toggleMenu(item.key)}
            className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm transition-colors ${
              hasActiveChild
                ? 'bg-violet-50 text-violet-600'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <div className="flex items-center gap-3">
              <item.icon className="w-4 h-4" />
              {item.label}
            </div>
            {isExpanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </button>
          
          {isExpanded && (
            <div className="ml-4 mt-1 space-y-1 border-l border-gray-200">
              {item.items.map((subItem) => {
                const SubIcon = subItem.icon;
                const isSubActive = isActiveItem(subItem.path);
                return (
                  <Link
                    key={subItem.path}
                    to={subItem.path}
                    className={`flex items-center gap-3 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                      isSubActive
                        ? 'bg-violet-50 text-violet-600 font-medium'
                        : 'text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    <SubIcon className="w-3 h-3" />
                    {subItem.label}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      );
    }
    
    // Regular item
    const Icon = item.icon;
    const isActive = isActiveItem(item.path);
    return (
      <Link
        key={item.path}
        to={item.path}
        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
          isActive
            ? 'bg-violet-50 text-violet-600 font-medium'
            : 'text-gray-600 hover:bg-gray-100'
        }`}
      >
        <Icon className="w-4 h-4" />
        {item.label}
      </Link>
    );
  };

  const getNotificationIcon = (type) => {
    switch(type) {
      case 'success': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'warning': return <AlertCircle className="w-5 h-5 text-amber-500" />;
      default: return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  return (
    <div className="h-screen flex overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="h-full flex flex-col">
          {/* Logo */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
            <Link to="/dashboard" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-violet-600 to-violet-700 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">E</span>
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-violet-600 to-amber-500 bg-clip-text text-transparent">
                EasyBill
              </span>
            </Link>
            <button 
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Company Section */}
          <div className="p-3 border-b border-gray-200">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Mes Entreprises</p>
            
            {/* List of companies */}
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {companies.map((company) => (
                <button
                  key={company.id}
                  onClick={() => handleCompanySelect(company.id)}
                  className={`flex items-center gap-3 w-full p-2 rounded-lg transition-colors ${
                    currentCompany?.id === company.id
                      ? 'bg-violet-50 border-l-4 border-violet-600'
                      : 'hover:bg-gray-100'
                  }`}
                  data-testid={`company-${company.id}`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    currentCompany?.id === company.id ? 'bg-amber-100' : 'bg-gray-100'
                  }`}>
                    <Building2 className={`w-4 h-4 ${
                      currentCompany?.id === company.id ? 'text-amber-600' : 'text-gray-500'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className={`text-sm font-medium truncate ${
                      currentCompany?.id === company.id ? 'text-gray-900' : 'text-gray-700'
                    }`}>
                      {company.name}
                    </p>
                  </div>
                  {currentCompany?.id === company.id && (
                    <Check className="w-4 h-4 text-violet-600" />
                  )}
                </button>
              ))}
            </div>

            {/* Add new company button */}
            <button 
              onClick={() => setNewCompanyModalOpen(true)}
              className="flex items-center gap-2 mt-2 w-full p-2 text-sm text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
              data-testid="add-company-btn"
            >
              <Plus className="w-4 h-4" />
              Nouvelle entreprise
            </button>
          </div>

          {/* Menu Items */}
          <nav className="flex-1 overflow-y-auto py-3">
            <p className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Menu Principal</p>
            <div className="space-y-1 px-3">
              {menuStructure.map((item, index) => {
                if (item.type === 'single') {
                  const Icon = item.icon;
                  const isActive = isActiveItem(item.path);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-violet-50 text-violet-600 border-l-4 border-violet-600 -ml-0.5'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      {item.label}
                    </Link>
                  );
                } else {
                  const Icon = item.icon;
                  const isExpanded = expandedMenus[item.key];
                  const hasActiveChild = isActiveGroup(item.items);
                  
                  return (
                    <div key={item.key}>
                      <button
                        onClick={() => toggleMenu(item.key)}
                        className={`flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                          hasActiveChild
                            ? 'bg-violet-50 text-violet-600'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="w-5 h-5" />
                          {item.label}
                        </div>
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                      
                      {isExpanded && (
                        <div className="ml-4 mt-1 space-y-1 border-l-2 border-gray-200">
                          {item.items.map((subItem) => renderMenuItem(subItem, 1))}
                        </div>
                      )}
                    </div>
                  );
                }
              })}
            </div>
          </nav>

          {/* Logout */}
          <div className="p-4 border-t border-gray-200">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              Déconnexion
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
            >
              <Menu className="w-6 h-6" />
            </button>
            
            <div className="hidden md:flex items-center gap-2 bg-gray-100 rounded-lg px-4 py-2 w-96">
              <Search className="w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher..."
                className="bg-transparent border-none outline-none text-sm w-full"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Notifications Dropdown */}
            <DropdownMenu open={notificationsOpen} onOpenChange={setNotificationsOpen}>
              <DropdownMenuTrigger asChild>
                <button 
                  className="p-2 hover:bg-gray-100 rounded-lg relative"
                  data-testid="notifications-btn"
                >
                  <Bell className="w-5 h-5 text-gray-600" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center font-medium">
                      {unreadCount}
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <div className="px-4 py-3 border-b">
                  <h3 className="font-semibold text-gray-900">Notifications</h3>
                  <p className="text-xs text-gray-500">{unreadCount} non lue{unreadCount > 1 ? 's' : ''}</p>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 text-sm">
                      Aucune notification
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <div 
                        key={notif.id} 
                        className={`px-4 py-3 border-b hover:bg-gray-50 cursor-pointer ${
                          !notif.read ? 'bg-blue-50/50' : ''
                        }`}
                      >
                        <div className="flex gap-3">
                          {getNotificationIcon(notif.type)}
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm ${!notif.read ? 'font-medium' : ''} text-gray-900`}>
                              {notif.title}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">{notif.message}</p>
                            <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {notif.time}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="p-2 border-t">
                  <Button variant="ghost" className="w-full text-sm text-violet-600">
                    Voir toutes les notifications
                  </Button>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Language Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center space-x-1 p-2 hover:bg-gray-100 rounded-lg">
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

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded-lg">
                  <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-violet-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                    {user?.name?.charAt(0) || user?.full_name?.charAt(0) || 'U'}
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-600" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-semibold">{user?.name || user?.full_name || 'Utilisateur'}</p>
                  <p className="text-xs text-gray-500">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/settings')}>
                  <Settings className="w-4 h-4 mr-2" />
                  Paramètres
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                  <LogOut className="w-4 h-4 mr-2" />
                  Déconnexion
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* New Company Modal - Iberis Style */}
      <Dialog open={newCompanyModalOpen} onOpenChange={setNewCompanyModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="new-company-modal">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Créer une nouvelle entreprise</DialogTitle>
            <p className="text-sm text-gray-500">Renseignez les informations de votre entreprise</p>
          </DialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
            {/* Left Column - Logo & Accounting Info */}
            <div className="space-y-6">
              {/* Logo Upload */}
              <div className="bg-gray-50 rounded-lg p-6">
                <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-8 hover:border-violet-400 transition-colors cursor-pointer">
                  <div className="w-20 h-20 bg-gray-200 rounded-lg flex items-center justify-center mb-3">
                    <Building2 className="w-10 h-10 text-gray-400" />
                  </div>
                  <p className="text-sm text-gray-600 text-center">Glissez votre logo ici</p>
                  <p className="text-xs text-gray-400 mt-1">ou cliquez pour parcourir</p>
                  <Button variant="outline" size="sm" className="mt-3">
                    Choisir un fichier
                  </Button>
                </div>
              </div>

              {/* Accounting Info */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                <div className="flex items-center gap-2 text-gray-700 font-medium">
                  <Calculator className="w-4 h-4" />
                  <span>Informations comptables</span>
                </div>

                <div>
                  <Label>Numéro d'identification fiscale</Label>
                  <Input
                    value={newCompanyData.fiscal_id}
                    onChange={(e) => setNewCompanyData(prev => ({ ...prev, fiscal_id: e.target.value }))}
                    placeholder="0000000/A/A/000"
                    className="mt-1"
                    data-testid="new-company-fiscal-id"
                  />
                </div>

                <div>
                  <Label>Exercice</Label>
                  <Select 
                    value={newCompanyData.fiscal_year} 
                    onValueChange={(v) => setNewCompanyData(prev => ({ ...prev, fiscal_year: v }))}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FISCAL_YEARS.map(fy => (
                        <SelectItem key={fy.value} value={fy.value}>{fy.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Devise principale</Label>
                  <Select 
                    value={newCompanyData.currency} 
                    onValueChange={(v) => setNewCompanyData(prev => ({ ...prev, currency: v }))}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map(c => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Right Column - General Info */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-4">
              <div className="flex items-center gap-2 text-gray-700 font-medium">
                <Building2 className="w-4 h-4" />
                <span>Informations générales</span>
              </div>

              <div>
                <Label>Nom de l'entreprise *</Label>
                <Input
                  value={newCompanyData.name}
                  onChange={(e) => setNewCompanyData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Ma Société SARL"
                  className="mt-1"
                  data-testid="new-company-name"
                />
              </div>

              <div>
                <Label>Activité *</Label>
                <Select 
                  value={newCompanyData.activity} 
                  onValueChange={(v) => setNewCompanyData(prev => ({ ...prev, activity: v }))}
                >
                  <SelectTrigger className="mt-1" data-testid="new-company-activity">
                    <SelectValue placeholder="Sélectionner une activité" />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTIVITIES.map(act => (
                      <SelectItem key={act} value={act}>{act}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Téléphone</Label>
                  <Input
                    value={newCompanyData.phone}
                    onChange={(e) => setNewCompanyData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="+216 XX XXX XXX"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Site Internet</Label>
                  <Input
                    value={newCompanyData.website}
                    onChange={(e) => setNewCompanyData(prev => ({ ...prev, website: e.target.value }))}
                    placeholder="www.exemple.com"
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label>Adresse</Label>
                <Input
                  value={newCompanyData.address.street}
                  onChange={(e) => setNewCompanyData(prev => ({ 
                    ...prev, 
                    address: { ...prev.address, street: e.target.value }
                  }))}
                  placeholder="Rue, avenue, boulevard..."
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Gouvernorat</Label>
                  <Select 
                    value={newCompanyData.address.governorate} 
                    onValueChange={(v) => setNewCompanyData(prev => ({ 
                      ...prev, 
                      address: { ...prev.address, governorate: v }
                    }))}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      {GOVERNORATES.map(g => (
                        <SelectItem key={g} value={g}>{g}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Code postal</Label>
                  <Input
                    value={newCompanyData.address.postal_code}
                    onChange={(e) => setNewCompanyData(prev => ({ 
                      ...prev, 
                      address: { ...prev.address, postal_code: e.target.value }
                    }))}
                    placeholder="1000"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Pays</Label>
                  <Select 
                    value={newCompanyData.address.country} 
                    onValueChange={(v) => setNewCompanyData(prev => ({ 
                      ...prev, 
                      address: { ...prev.address, country: v }
                    }))}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Tunisie">Tunisie</SelectItem>
                      <SelectItem value="France">France</SelectItem>
                      <SelectItem value="Algérie">Algérie</SelectItem>
                      <SelectItem value="Maroc">Maroc</SelectItem>
                      <SelectItem value="Libye">Libye</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setNewCompanyModalOpen(false)}>
              Annuler
            </Button>
            <Button 
              onClick={handleCreateCompany}
              disabled={creatingCompany}
              className="bg-violet-600 hover:bg-violet-700"
              data-testid="create-company-btn"
            >
              {creatingCompany ? 'Création...' : 'Créer l\'entreprise'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AppLayout;
