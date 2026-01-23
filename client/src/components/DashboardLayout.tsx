import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { 
  LayoutDashboard, 
  LogOut, 
  PanelLeft, 
  Users, 
  Building2,
  FileText,
  FileCheck,
  Package,
  Truck,
  CreditCard,
  Settings,
  Crown,
  ChevronDown,
  ChevronRight,
  ShoppingCart,
  BookOpen,
  FolderKanban,
  Warehouse,
  ClipboardList,
  ArrowLeftRight,
  FileOutput,
  FileMinus,
  Receipt,
  Bell,
  Store,
  FileInput,
  FileBox,
  Banknote,
  Calculator,
  BookMarked,
  Scale,
  Calendar,
  BarChart3,
  Plus
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState, createContext, useContext } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";
import { trpc } from "@/lib/trpc";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

// Company context
interface CompanyContextType {
  selectedCompanyId: number | null;
  setSelectedCompanyId: (id: number | null) => void;
  companies: any[];
  isLoading: boolean;
}

const CompanyContext = createContext<CompanyContextType>({
  selectedCompanyId: null,
  setSelectedCompanyId: () => {},
  companies: [],
  isLoading: true,
});

export const useCompany = () => useContext(CompanyContext);

// Menu structure like Iberis
interface MenuItem {
  icon: any;
  label: string;
  path?: string;
  children?: { icon: any; label: string; path: string }[];
}

const menuItems: MenuItem[] = [
  { icon: LayoutDashboard, label: "Tableau de bord", path: "/dashboard" },
  { 
    icon: Users, 
    label: "Contacts",
    children: [
      { icon: Users, label: "Clients", path: "/clients" },
      { icon: Truck, label: "Fournisseurs", path: "/suppliers" },
    ]
  },
  { 
    icon: Package, 
    label: "Stock",
    children: [
      { icon: Package, label: "Articles", path: "/products" },
      { icon: Warehouse, label: "Entrepôts", path: "/warehouses" },
      { icon: ClipboardList, label: "Inventaire", path: "/inventory" },
      { icon: ArrowLeftRight, label: "Mouvements", path: "/stock-movements" },
    ]
  },
  { 
    icon: ShoppingCart, 
    label: "Ventes",
    children: [
      { icon: FileOutput, label: "Bons de livraison", path: "/delivery-notes" },
      { icon: FileOutput, label: "Bons de sortie", path: "/exit-vouchers" },
      { icon: FileCheck, label: "Devis", path: "/quotes" },
      { icon: FileText, label: "Factures", path: "/invoices" },
      { icon: FileMinus, label: "Factures d'avoir", path: "/credit-notes" },
      { icon: Receipt, label: "Notes de débours", path: "/expense-notes" },
      { icon: CreditCard, label: "Paiements", path: "/payments" },
      { icon: Bell, label: "Rappels", path: "/reminders" },
      { icon: Store, label: "Points de vente", path: "/pos" },
    ]
  },
  { 
    icon: FileInput, 
    label: "Achats",
    children: [
      { icon: FileInput, label: "Bons de réception", path: "/reception-notes" },
      { icon: FileBox, label: "Bons de commande", path: "/purchase-orders" },
      { icon: FileText, label: "Factures fournisseur", path: "/supplier-invoices" },
      { icon: Receipt, label: "Prestations de service", path: "/service-invoices" },
      { icon: Banknote, label: "Paiements", path: "/supplier-payments" },
      { icon: Calculator, label: "Retenue à la source", path: "/withholding-tax" },
      { icon: Bell, label: "Rappels d'achats", path: "/purchase-reminders" },
    ]
  },
  { 
    icon: BookOpen, 
    label: "Comptabilité",
    children: [
      { icon: BookMarked, label: "Plan comptable", path: "/chart-of-accounts" },
      { icon: FileText, label: "Écritures Comptable", path: "/journal-entries" },
      { icon: BookOpen, label: "Grands Livres", path: "/general-ledger" },
      { icon: Scale, label: "Balances", path: "/trial-balance" },
      { icon: FileText, label: "Journaux légaux", path: "/legal-journals" },
      { icon: Calendar, label: "Exercices comptables", path: "/fiscal-years" },
      { icon: BarChart3, label: "États comptables", path: "/financial-statements" },
    ]
  },
  { icon: FolderKanban, label: "Projets", path: "/projects" },
];

const bottomMenuItems = [
  { icon: Building2, label: "Entreprises", path: "/companies" },
  { icon: Settings, label: "Paramètres", path: "/settings" },
  { icon: Crown, label: "Abonnement", path: "/subscription" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(() => {
    const saved = localStorage.getItem("selected-company-id");
    return saved ? parseInt(saved, 10) : null;
  });

  const { data: companies = [], isLoading: companiesLoading } = trpc.company.list.useQuery(
    undefined,
    { enabled: !!user }
  );

  // Auto-select first company if none selected
  useEffect(() => {
    if (companies.length > 0 && !selectedCompanyId) {
      setSelectedCompanyId(companies[0].id);
    }
  }, [companies, selectedCompanyId]);

  // Save selected company to localStorage
  useEffect(() => {
    if (selectedCompanyId) {
      localStorage.setItem("selected-company-id", selectedCompanyId.toString());
    }
  }, [selectedCompanyId]);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-primary/5 to-background">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-10 w-10 text-primary" />
            <span className="text-2xl font-bold">EasyBill</span>
          </div>
          <div className="flex flex-col items-center gap-6">
            <h1 className="text-2xl font-semibold tracking-tight text-center">
              Connectez-vous pour continuer
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Accédez à votre espace de facturation et gérez votre activité en toute simplicité.
            </p>
          </div>
          <Button
            onClick={() => {
              window.location.href = getLoginUrl();
            }}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all"
          >
            Se connecter
          </Button>
        </div>
      </div>
    );
  }

  return (
    <CompanyContext.Provider value={{ 
      selectedCompanyId, 
      setSelectedCompanyId, 
      companies, 
      isLoading: companiesLoading 
    }}>
      <SidebarProvider
        style={
          {
            "--sidebar-width": `${sidebarWidth}px`,
          } as CSSProperties
        }
      >
        <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
          {children}
        </DashboardLayoutContent>
      </SidebarProvider>
    </CompanyContext.Provider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const { selectedCompanyId, setSelectedCompanyId, companies } = useCompany();
  const [openMenus, setOpenMenus] = useState<string[]>([]);

  // Find active menu for highlighting
  const findActiveMenu = () => {
    for (const item of menuItems) {
      if (item.path && location.startsWith(item.path)) return item.label;
      if (item.children) {
        for (const child of item.children) {
          if (location.startsWith(child.path)) return item.label;
        }
      }
    }
    for (const item of bottomMenuItems) {
      if (location.startsWith(item.path)) return item.label;
    }
    return null;
  };

  const activeMenu = findActiveMenu();

  // Auto-open menu containing active item
  useEffect(() => {
    for (const item of menuItems) {
      if (item.children) {
        for (const child of item.children) {
          if (location.startsWith(child.path) && !openMenus.includes(item.label)) {
            setOpenMenus(prev => [...prev, item.label]);
            break;
          }
        }
      }
    }
  }, [location]);

  const toggleMenu = (label: string) => {
    setOpenMenus(prev => 
      prev.includes(label) 
        ? prev.filter(l => l !== label)
        : [...prev, label]
    );
  };

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center border-b">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-5 w-5 text-primary shrink-0" />
                  <span className="font-bold tracking-tight truncate text-primary">
                    EasyBill
                  </span>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          {/* Company Selector with Add Button */}
          {!isCollapsed && (
            <div className="px-3 py-3 border-b">
              <div className="flex items-center gap-2">
                <Select 
                  value={selectedCompanyId?.toString() || ""} 
                  onValueChange={(val) => setSelectedCompanyId(parseInt(val))}
                >
                  <SelectTrigger className="flex-1 h-9 text-sm">
                    <SelectValue placeholder="Sélectionner une entreprise" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id.toString()}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-9 w-9 shrink-0"
                  onClick={() => setLocation("/companies/new")}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Menu Principal label */}
          {!isCollapsed && (
            <div className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Menu Principal
            </div>
          )}

          <SidebarContent className="gap-0">
            <SidebarMenu className="px-2 py-1">
              {menuItems.map(item => {
                if (item.children) {
                  const isOpen = openMenus.includes(item.label);
                  const hasActiveChild = item.children.some(child => location.startsWith(child.path));
                  
                  return (
                    <Collapsible
                      key={item.label}
                      open={isOpen}
                      onOpenChange={() => toggleMenu(item.label)}
                    >
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton
                            className={`h-10 transition-all font-normal ${hasActiveChild ? 'bg-accent' : ''}`}
                            tooltip={item.label}
                          >
                            <item.icon className={`h-4 w-4 ${hasActiveChild ? 'text-primary' : ''}`} />
                            <span className="flex-1">{item.label}</span>
                            <ChevronRight className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {item.children.map(child => {
                              const isActive = location.startsWith(child.path);
                              return (
                                <SidebarMenuSubItem key={child.path}>
                                  <SidebarMenuSubButton
                                    isActive={!!isActive}
                                    onClick={() => setLocation(child.path)}
                                    className="h-9"
                                  >
                                    <child.icon className={`h-4 w-4 ${isActive ? 'text-primary' : ''}`} />
                                    <span>{child.label}</span>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              );
                            })}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  );
                }

                const isActive = item.path && location.startsWith(item.path);
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={!!isActive}
                      onClick={() => item.path && setLocation(item.path)}
                      tooltip={item.label}
                      className="h-10 transition-all font-normal"
                    >
                      <item.icon className={`h-4 w-4 ${isActive ? 'text-primary' : ''}`} />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>

            <div className="mt-auto">
              <SidebarMenu className="px-2 py-2 border-t">
                {bottomMenuItems.map(item => {
                  const isActive = location.startsWith(item.path);
                  return (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton
                        isActive={!!isActive}
                        onClick={() => setLocation(item.path)}
                        tooltip={item.label}
                        className="h-10 transition-all font-normal"
                      >
                        <item.icon className={`h-4 w-4 ${isActive ? 'text-primary' : ''}`} />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </div>
          </SidebarContent>

          <SidebarFooter className="border-t">
            <SidebarMenu>
              <SidebarMenuItem>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton className="h-14">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary/10 text-primary text-sm">
                          {user?.name?.charAt(0)?.toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                      {!isCollapsed && (
                        <div className="flex flex-col items-start min-w-0 flex-1">
                          <span className="text-sm font-medium truncate w-full">
                            {user?.name || "Utilisateur"}
                          </span>
                          <span className="text-xs text-muted-foreground truncate w-full">
                            {user?.email || ""}
                          </span>
                        </div>
                      )}
                      {!isCollapsed && <ChevronDown className="h-4 w-4 shrink-0" />}
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    side={isMobile ? "top" : "right"}
                    className="w-56"
                  >
                    <div className="px-2 py-1.5">
                      <p className="text-sm font-medium">{user?.name}</p>
                      <p className="text-xs text-muted-foreground">{user?.email}</p>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setLocation("/settings")}>
                      <Settings className="mr-2 h-4 w-4" />
                      Paramètres
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => logout()}
                      className="text-destructive focus:text-destructive"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Déconnexion
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>

        {/* Resize handle */}
        {!isCollapsed && (
          <div
            className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors z-10"
            onMouseDown={() => setIsResizing(true)}
          />
        )}
      </div>

      <SidebarInset className="flex flex-col min-h-screen">
        {/* Mobile header */}
        {isMobile && (
          <header className="flex h-14 items-center gap-4 border-b bg-background px-4 lg:hidden">
            <SidebarTrigger />
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <span className="font-bold">EasyBill</span>
            </div>
          </header>
        )}

        <main className="flex-1 overflow-auto bg-muted/30">
          {children}
        </main>
      </SidebarInset>
    </>
  );
}
