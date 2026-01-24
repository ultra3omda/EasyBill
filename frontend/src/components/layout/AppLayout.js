import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
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
  DollarSign,
  TrendingUp,
  Activity,
  PieChart
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '../ui/dropdown-menu';

const AppLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const { language, changeLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState({});

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
        { icon: Truck, label: 'Bons de livraison', path: '/delivery-notes' },
        { icon: FileOutput, label: 'Bons de sortie', path: '/exit-vouchers' },
        { icon: FileText, label: 'Devis', path: '/quotes' },
        { icon: Receipt, label: 'Factures', path: '/invoices' },
        { icon: FileInput, label: "Factures d'avoir", path: '/credit-notes' },
        { icon: ClipboardCheck, label: 'Notes de débours', path: '/expense-reports' },
        { icon: CreditCard, label: 'Paiements', path: '/payments' },
        { icon: AlertCircle, label: 'Rappels', path: '/reminders' },
        { icon: Store, label: 'Points de vente', path: '/pos' }
      ]
    },
    {
      type: 'group',
      key: 'achats',
      icon: ShoppingCart,
      label: 'Achats',
      items: [
        { icon: FileText, label: 'Bons de commande', path: '/purchase-orders' },
        { icon: Receipt, label: 'Factures fournisseur', path: '/supplier-invoices' },
        { icon: CreditCard, label: 'Paiements', path: '/supplier-payments' },
        { icon: ClipboardCheck, label: 'Bons de réception', path: '/reception-notes' },
        { icon: Briefcase, label: 'Prestations de service', path: '/services' },
        { icon: Percent, label: 'Retenue à la source', path: '/withholding-tax' }
      ]
    },
    {
      type: 'group',
      key: 'comptabilite',
      icon: Calculator,
      label: 'Comptabilité',
      items: [
        { icon: BookOpen, label: 'Plan comptable', path: '/chart-of-accounts' },
        { icon: PenLine, label: 'Écritures Comptables', path: '/journal-entries' },
        { icon: BookMarked, label: 'Grands Livres', path: '/ledgers' },
        { 
          type: 'nested',
          key: 'balances',
          icon: Scale, 
          label: 'Balances',
          items: [
            { icon: Users, label: 'Balance tiers', path: '/balance-tiers' },
            { icon: Scale, label: 'Balance générale', path: '/balance-generale' }
          ]
        },
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
            <div className="flex items-center gap-3 p-2 bg-violet-50 rounded-lg border-l-4 border-violet-600">
              <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                <Building2 className="w-4 h-4 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{user?.company || 'Mon Entreprise'}</p>
              </div>
            </div>
            <button className="flex items-center gap-2 mt-2 w-full p-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
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
            <button className="p-2 hover:bg-gray-100 rounded-lg relative">
              <Bell className="w-5 h-5 text-gray-600" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>

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

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded-lg">
                  <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-violet-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                    {user?.name?.charAt(0) || 'U'}
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-600" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-semibold">{user?.name || 'Utilisateur'}</p>
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
    </div>
  );
};

export default AppLayout;
