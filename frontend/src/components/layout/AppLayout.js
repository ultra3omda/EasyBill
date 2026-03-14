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
  User,
  Brain,
  UserPlus,
  Shield,
  Lock,
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
  CheckCircle,
  Banknote,
  Wallet,
  Bot,
  Scan,
  Phone,
  FileSpreadsheet
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
import ChatbotModal from '../ChatbotModal';

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

// Phone prefixes (country code)
const PHONE_PREFIXES = [
  { value: '+216', label: '🇹🇳 +216' },
  { value: '+33', label: '🇫🇷 +33' },
  { value: '+213', label: '🇩🇿 +213' },
  { value: '+212', label: '🇲🇦 +212' },
  { value: '+218', label: '🇱🇾 +218' },
  { value: '+20', label: '🇪🇬 +20' },
  { value: '+32', label: '🇧🇪 +32' },
  { value: '+41', label: '🇨🇭 +41' },
  { value: '+39', label: '🇮🇹 +39' },
  { value: '+34', label: '🇪🇸 +34' },
  { value: '+1', label: '🇺🇸 +1' },
  { value: '+44', label: '🇬🇧 +44' },
  { value: '+49', label: '🇩🇪 +49' },
  { value: '+90', label: '🇹🇷 +90' },
  { value: '+971', label: '🇦🇪 +971' },
];

function parsePhone(full) {
  if (!full || !String(full).trim()) return { prefix: '+216', number: '' };
  const s = String(full).trim();
  const match = s.match(/^(\+\d{1,4})\s*(.*)$/);
  if (match) return { prefix: match[1], number: match[2].trim() };
  if (/^\+\d+/.test(s)) {
    const prefixMatch = s.match(/^(\+\d{1,4})/);
    const prefix = prefixMatch ? prefixMatch[1] : '+216';
    return { prefix, number: s.replace(/^\+\d{1,4}\s*/, '').trim() };
  }
  return { prefix: '+216', number: s };
}

// Pays avec code ISO pour drapeaux (flagcdn.com)
const COUNTRIES = [
  { code: 'TN', name: 'Tunisie' },
  { code: 'FR', name: 'France' },
  { code: 'DZ', name: 'Algérie' },
  { code: 'MA', name: 'Maroc' },
  { code: 'LY', name: 'Libye' },
  { code: 'EG', name: 'Égypte' },
  { code: 'BE', name: 'Belgique' },
  { code: 'CH', name: 'Suisse' },
  { code: 'IT', name: 'Italie' },
  { code: 'ES', name: 'Espagne' },
  { code: 'DE', name: 'Allemagne' },
  { code: 'GB', name: 'Royaume-Uni' },
  { code: 'US', name: 'États-Unis' },
  { code: 'CA', name: 'Canada' },
  { code: 'TR', name: 'Turquie' },
  { code: 'AE', name: 'Émirats arabes unis' },
  { code: 'SA', name: 'Arabie saoudite' },
  { code: 'NL', name: 'Pays-Bas' },
  { code: 'PT', name: 'Portugal' },
  { code: 'LU', name: 'Luxembourg' },
];

function getUserInitials(fullName) {
  if (!fullName || !String(fullName).trim()) return 'U';
  const parts = String(fullName).trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return fullName.slice(0, 2).toUpperCase();
}

const AppLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const { language, changeLanguage, t } = useLanguage();
  const { companies, currentCompany, switchCompany, loadCompanies } = useCompany();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState({});
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [chatModalOpen, setChatModalOpen] = useState(false);
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
  const [companyPhonePrefix, setCompanyPhonePrefix] = useState('+216');
  const [companyPhoneNumber, setCompanyPhoneNumber] = useState('');

  useEffect(() => {
    if (newCompanyModalOpen) {
      const parsed = parsePhone(newCompanyData.phone);
      setCompanyPhonePrefix(parsed.prefix);
      setCompanyPhoneNumber(parsed.number);
    }
  }, [newCompanyModalOpen]);

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
      setCompanyPhonePrefix('+216');
      setCompanyPhoneNumber('');
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
      key: 'caisse',
      icon: Banknote,
      label: 'Caisse & Cash',
      items: [
        { icon: Wallet, label: 'Tableau de bord caisse', path: '/cash' },
        { icon: Banknote, label: 'Configurer caisse', path: '/cash-accounts' },
        { icon: Bot, label: 'Assistant chatbot', path: '/chatbot' },
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
        { icon: CreditCard, label: 'Paiements', path: '/purchases/supplier-payments' },
        { icon: Scan, label: 'Scanner une facture', path: '/purchases/invoice-scanner' },
        { icon: Building2, label: 'Lettrage bancaire', path: '/purchases/bank-reconciliation' },
        { icon: FileSpreadsheet, label: 'Import extraits (Document AI)', path: '/purchases/bank-statement-import' }
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
        { icon: Settings, label: 'Mappings fournisseurs', path: '/accounting/supplier-mappings' },
        { icon: Brain, label: 'Patterns appris', path: '/accounting/learning-patterns' },
        { icon: PenLine, label: 'Écritures Comptables', path: '/journal-entries' },
        { icon: BookMarked, label: 'Grand Livre', path: '/general-ledger' },
        { icon: Scale, label: 'Balance des comptes', path: '/trial-balance' },
        { icon: BookOpen, label: 'Livres de tiers', path: '/auxiliary-ledgers' },
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
      type: 'group',
      key: 'rh',
      icon: Briefcase,
      label: 'Ressources Humaines',
      items: [
        { icon: PieChart, label: 'Tableau de bord RH', path: '/hr/dashboard' },
        { icon: Users, label: 'Employes', path: '/hr/employees' },
        { icon: Calculator, label: 'Paie', path: '/hr/payroll' },
        { icon: Calendar, label: 'Conges', path: '/hr/leaves' },
        { icon: FileBarChart, label: 'Declarations', path: '/hr/declarations' },
        { icon: Settings, label: 'Configuration RH', path: '/hr/config' },
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
        { icon: User, label: 'Profil', path: '/settings' },
        { icon: Building2, label: 'Entreprise', path: '/settings/company' },
        { icon: Bell, label: 'Notifications', path: '/settings/notifications' },
        { icon: Lock, label: 'Sécurité', path: '/settings/security' },
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

  const isActiveItem = (path) => path && location.pathname === path;
  const isActiveGroup = (items, groupKey) => {
    if (!items) return false;
    if (groupKey === 'parametres' && location.pathname.startsWith('/settings')) return true;
    return items.some(item => {
      if (item.type === 'nested') {
        return item.items?.some(subItem => location.pathname === subItem.path);
      }
      return location.pathname === item.path;
    });
  };
  const isGroupExpanded = (item) => expandedMenus[item.key];

  // À la navigation, ouvrir le(s) menu(s) parent(s) qui contiennent la page actuelle (l'utilisateur peut les fermer ensuite)
  useEffect(() => {
    const pathname = location.pathname;
    const pathInGroup = (items, groupKey) => {
      if (!items) return false;
      if (groupKey === 'parametres' && pathname.startsWith('/settings')) return true;
      return items.some(it => {
        if (it.type === 'nested') return it.items?.some(s => s.path === pathname);
        return it.path === pathname;
      });
    };
    setExpandedMenus(prev => {
      const next = { ...prev };
      menuStructure.forEach((item) => {
        if (item.type !== 'group' || !item.items) return;
        if (pathInGroup(item.items, item.key)) next[item.key] = true;
        item.items.forEach((subItem) => {
          if (subItem.type === 'nested' && subItem.items?.some(s => s.path === pathname))
            next[subItem.key] = true;
        });
      });
      return next;
    });
  }, [location.pathname]);

  // Render menu item (handles nested submenus)
  const renderMenuItem = (item, depth = 0) => {
    if (item.type === 'nested') {
      const hasActiveChild = item.items?.some(subItem => location.pathname === subItem.path);
      const isExpanded = expandedMenus[item.key];
      
      return (
        <div key={item.key}>
          <button
            onClick={() => toggleMenu(item.key)}
            className={`flex items-center justify-between w-full rounded-2xl px-3 py-2.5 text-sm font-medium transition-all ${
              hasActiveChild
                ? 'bg-white text-violet-900 shadow-sm'
                : 'text-slate-300 hover:bg-white/10 hover:text-white'
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
            <div className="ml-5 mt-2 space-y-1 border-l border-white/10 pl-3">
              {item.items.map((subItem) => {
                const SubIcon = subItem.icon;
                const isSubActive = isActiveItem(subItem.path);
                return (
                  <Link
                    key={subItem.path}
                    to={subItem.path}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium transition-all ${
                      isSubActive
                        ? 'bg-violet-50 text-violet-700'
                        : 'text-slate-400 hover:bg-white/10 hover:text-white'
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
        className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all ${
          isActive
            ? 'bg-white text-violet-800 shadow-sm'
            : 'text-slate-300 hover:bg-white/10 hover:text-white'
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
    <div className="h-screen flex overflow-hidden bg-[#f5f4fb]">
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-[290px] bg-[#4f2cc8] text-white transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="h-full flex flex-col">
          {/* Logo */}
          <div className="flex h-20 items-center justify-between px-5 border-b border-white/10">
            <Link to="/dashboard" className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/12 ring-1 ring-white/15">
                <span className="text-white font-bold text-lg">E</span>
              </div>
              <span className="text-xl font-extrabold tracking-[-0.03em] text-white">
                EasyBill
              </span>
            </Link>
            <button 
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 rounded-xl hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Company Section */}
          <div className="border-b border-white/10 p-4">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-100/70">Mes Entreprises</p>
            
            {/* List of companies */}
            <div className="space-y-2 max-h-36 overflow-y-auto">
              {companies.map((company) => (
                <button
                  key={company.id}
                  onClick={() => handleCompanySelect(company.id)}
                  className={`flex items-center gap-3 w-full rounded-2xl p-3 transition-all ${
                    currentCompany?.id === company.id
                      ? 'bg-white text-violet-900 shadow-sm'
                      : 'bg-white/5 text-white hover:bg-white/10'
                  }`}
                  data-testid={`company-${company.id}`}
                >
                  <div className={`w-9 h-9 rounded-2xl flex items-center justify-center ${
                    currentCompany?.id === company.id ? 'bg-amber-100' : 'bg-white/10'
                  }`}>
                    <Building2 className={`w-4 h-4 ${
                      currentCompany?.id === company.id ? 'text-amber-700' : 'text-white/75'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className={`text-sm font-medium truncate ${
                      currentCompany?.id === company.id ? 'text-slate-900' : 'text-white'
                    }`}>
                      {company.name}
                    </p>
                  </div>
                  {currentCompany?.id === company.id && (
                    <Check className="w-4 h-4 text-violet-700" />
                  )}
                </button>
              ))}
            </div>

            {/* Add new company button */}
            <button 
              onClick={() => setNewCompanyModalOpen(true)}
              className="mt-3 flex w-full items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm font-medium text-white hover:bg-white/10 transition-colors"
              data-testid="add-company-btn"
            >
              <Plus className="w-4 h-4" />
              Nouvelle entreprise
            </button>
          </div>

          {/* Menu Items */}
          <nav className="flex-1 overflow-y-auto py-4">
            <p className="mb-3 px-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-100/70">Menu Principal</p>
            <div className="space-y-1.5 px-3">
              {menuStructure.map((item, index) => {
                if (item.type === 'single') {
                  const Icon = item.icon;
                  const isActive = isActiveItem(item.path);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-white text-violet-800 shadow-sm'
                          : 'text-slate-200 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      {item.label}
                    </Link>
                  );
                } else {
                  const Icon = item.icon;
                  const hasActiveChild = isActiveGroup(item.items, item.key);
                  const isExpanded = isGroupExpanded(item);
                  return (
                    <div key={item.key}>
                      <button
                        onClick={() => toggleMenu(item.key)}
                        className={`flex items-center justify-between w-full rounded-2xl px-3 py-3 text-sm font-medium transition-all ${
                          hasActiveChild
                            ? 'bg-white text-violet-900 shadow-sm'
                            : 'text-slate-200 hover:bg-white/10 hover:text-white'
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
                        <div className="ml-5 mt-2 space-y-1.5 border-l border-white/10 pl-3">
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
          <div className="border-t border-white/10 p-4">
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium text-rose-200 hover:bg-white/10 hover:text-white transition-colors"
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
        <header className="flex h-20 items-center justify-between border-b border-slate-200/70 bg-white/75 px-5 backdrop-blur-sm lg:px-8">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl hover:bg-slate-100"
            >
              <Menu className="w-6 h-6" />
            </button>
            
            <div className="hidden md:flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 w-[28rem]">
              <Search className="w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher..."
                className="w-full border-none bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Notifications Dropdown */}
            <DropdownMenu open={notificationsOpen} onOpenChange={setNotificationsOpen}>
              <DropdownMenuTrigger asChild>
                <button 
                  className="relative rounded-2xl border border-slate-200 bg-white p-2.5 hover:bg-slate-50"
                  data-testid="notifications-btn"
                >
                  <Bell className="w-5 h-5 text-slate-600" />
                  {unreadCount > 0 && (
                  <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-medium text-white">
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
                  <Button variant="ghost" className="w-full text-sm text-primary">
                    Voir toutes les notifications
                  </Button>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Language Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center space-x-1 rounded-2xl border border-slate-200 bg-white p-2.5 hover:bg-slate-50">
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
                <button className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 hover:bg-slate-50">
                  {user?.photo ? (
                    <img
                      src={user.photo.startsWith('http') ? user.photo : `${process.env.REACT_APP_BACKEND_URL || ''}${user.photo}`}
                      alt=""
                      className="h-9 w-9 rounded-2xl object-cover border border-slate-200"
                    />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-violet-700 text-sm font-semibold text-white">
                      {getUserInitials(user?.full_name || user?.name || user?.email)}
                    </div>
                  )}
                  <ChevronDown className="w-4 h-4 text-slate-500" />
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
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="app-page min-h-full p-4 lg:p-6">
            {children}
          </div>
        </main>
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-950/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Floating chatbot button */}
      {currentCompany && (
        <button
          onClick={() => setChatModalOpen(true)}
          className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-violet-500 via-violet-600 to-blue-600 shadow-lg shadow-violet-500/30 hover:shadow-xl hover:shadow-violet-500/40 hover:scale-110 active:scale-95 transition-all duration-200 flex items-center justify-center text-white"
          title="Assistant Financier"
          aria-label="Ouvrir l'assistant chatbot"
        >
          <Bot className="w-7 h-7" />
        </button>
      )}

      {/* Chatbot modal */}
      <ChatbotModal open={chatModalOpen} onOpenChange={setChatModalOpen} />

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
                  <div className="flex rounded-lg border border-input bg-background shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 mt-1">
                    <div className="flex items-center pl-3 bg-muted/50 border-r border-input">
                      <Phone className="h-4 w-4 text-muted-foreground mr-2 shrink-0" />
                      <Select
                        value={companyPhonePrefix}
                        onValueChange={(v) => {
                          setCompanyPhonePrefix(v);
                          setNewCompanyData(prev => ({ ...prev, phone: (v + ' ' + companyPhoneNumber).trim() }));
                        }}
                      >
                        <SelectTrigger className="w-[7.5rem] h-10 border-0 bg-transparent shadow-none focus:ring-0 focus-visible:ring-0">
                          <span className="truncate text-sm">
                            {PHONE_PREFIXES.find((p) => p.value === companyPhonePrefix)?.label ?? '+216'}
                          </span>
                        </SelectTrigger>
                        <SelectContent>
                          {PHONE_PREFIXES.map((p) => (
                            <SelectItem key={p.value} value={p.value}>
                              {p.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Input
                      className="rounded-none border-0 focus-visible:ring-0 flex-1 min-w-0"
                      value={companyPhoneNumber}
                      onChange={(e) => {
                        const v = e.target.value;
                        setCompanyPhoneNumber(v);
                        setNewCompanyData(prev => ({ ...prev, phone: (companyPhonePrefix + ' ' + v).trim() }));
                      }}
                      placeholder="12 345 678"
                    />
                  </div>
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
                      <SelectValue placeholder="Choisir un pays" />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map((c) => (
                        <SelectItem key={c.code} value={c.name}>
                          <span className="flex items-center gap-2">
                            <img
                              src={`https://flagcdn.com/w40/${c.code.toLowerCase()}.png`}
                              alt=""
                              className="w-5 h-4 object-cover rounded"
                            />
                            {c.name}
                          </span>
                        </SelectItem>
                      ))}
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
