import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Companies from "./pages/Companies";
import CompanyForm from "./pages/CompanyForm";
import Clients from "./pages/Clients";
import ClientForm from "./pages/ClientForm";
import Suppliers from "./pages/Suppliers";
import SupplierForm from "./pages/SupplierForm";
import Products from "./pages/Products";
import ProductForm from "./pages/ProductForm";
import Invoices from "./pages/Invoices";
import InvoiceForm from "./pages/InvoiceForm";
import InvoiceView from "./pages/InvoiceView";
import Quotes from "./pages/Quotes";
import QuoteForm from "./pages/QuoteForm";
import QuoteView from "./pages/QuoteView";
import Payments from "./pages/Payments";
import Settings from "./pages/Settings";
// Stock
import Warehouses from "./pages/Warehouses";
import Inventory from "./pages/Inventory";
import StockMovements from "./pages/StockMovements";
// Ventes avancées
import DeliveryNotes from "./pages/DeliveryNotes";
import CreditNotes from "./pages/CreditNotes";
// Achats
import PurchaseOrders from "./pages/PurchaseOrders";
import GoodsReceipts from "./pages/GoodsReceipts";
import SupplierInvoices from "./pages/SupplierInvoices";
// Comptabilité & Projets
import Accounting from "./pages/Accounting";
import Projects from "./pages/Projects";
// Public pages
import LandingPage from "./pages/LandingPage";
import Pricing from "./pages/Pricing";
import Blog from "./pages/Blog";
import Docs from "./pages/Docs";
import Mobile from "./pages/Mobile";
// Auth pages
import Login from "./pages/Login";
import Register from "./pages/Register";
// Account pages
import Profile from "./pages/Profile";
import Subscription from "./pages/Subscription";
import Referral from "./pages/Referral";

function Router() {
  return (
    <Switch>
      {/* Public marketing pages */}
      <Route path="/" component={LandingPage} />
      <Route path="/features" component={LandingPage} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/blog" component={Blog} />
      <Route path="/docs" component={Docs} />
      <Route path="/mobile" component={Mobile} />
      
      {/* Auth routes */}
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      
      {/* Protected routes - Dashboard */}
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/home" component={Home} />
      
      {/* Account settings */}
      <Route path="/profile" component={Profile} />
      <Route path="/subscription" component={Subscription} />
      <Route path="/referral" component={Referral} />
      
      {/* Companies */}
      <Route path="/companies" component={Companies} />
      <Route path="/companies/new" component={CompanyForm} />
      <Route path="/companies/:id/edit" component={CompanyForm} />
      
      {/* Contacts - Clients */}
      <Route path="/clients" component={Clients} />
      <Route path="/clients/new" component={ClientForm} />
      <Route path="/clients/:id/edit" component={ClientForm} />
      
      {/* Contacts - Suppliers */}
      <Route path="/suppliers" component={Suppliers} />
      <Route path="/suppliers/new" component={SupplierForm} />
      <Route path="/suppliers/:id/edit" component={SupplierForm} />
      
      {/* Stock - Products */}
      <Route path="/products" component={Products} />
      <Route path="/products/new" component={ProductForm} />
      <Route path="/products/:id/edit" component={ProductForm} />
      
      {/* Stock - Warehouses */}
      <Route path="/warehouses" component={Warehouses} />
      
      {/* Stock - Inventory */}
      <Route path="/inventory" component={Inventory} />
      
      {/* Stock - Movements */}
      <Route path="/stock-movements" component={StockMovements} />
      
      {/* Ventes - Invoices */}
      <Route path="/invoices" component={Invoices} />
      <Route path="/invoices/new" component={InvoiceForm} />
      <Route path="/invoices/:id" component={InvoiceView} />
      <Route path="/invoices/:id/edit" component={InvoiceForm} />
      
      {/* Ventes - Quotes */}
      <Route path="/quotes" component={Quotes} />
      <Route path="/quotes/new" component={QuoteForm} />
      <Route path="/quotes/:id" component={QuoteView} />
      <Route path="/quotes/:id/edit" component={QuoteForm} />
      
      {/* Ventes - Delivery Notes */}
      <Route path="/delivery-notes" component={DeliveryNotes} />
      
      {/* Ventes - Credit Notes */}
      <Route path="/credit-notes" component={CreditNotes} />
      
      {/* Ventes - Payments */}
      <Route path="/payments" component={Payments} />
      
      {/* Achats - Purchase Orders */}
      <Route path="/purchase-orders" component={PurchaseOrders} />
      
      {/* Achats - Goods Receipts */}
      <Route path="/goods-receipts" component={GoodsReceipts} />
      
      {/* Achats - Supplier Invoices */}
      <Route path="/supplier-invoices" component={SupplierInvoices} />
      
      {/* Comptabilité */}
      <Route path="/accounting" component={Accounting} />
      
      {/* Projets */}
      <Route path="/projects" component={Projects} />
      
      {/* Settings */}
      <Route path="/settings" component={Settings} />
      
      {/* 404 */}
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
