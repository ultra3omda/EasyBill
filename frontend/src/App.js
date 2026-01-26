import React, { useEffect, useState } from 'react';
import './App.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { Toaster } from './components/ui/sonner';
import { companiesAPI } from './services/api';

// Pages
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import VerifyEmail from './pages/VerifyEmail';
import ClientPortal from './pages/ClientPortal';
import CompanyOnboarding from './pages/CompanyOnboarding';
import Dashboard from './pages/Dashboard';
import Invoices from './pages/Invoices';
import InvoiceForm from './pages/InvoiceForm';
import Quotes from './pages/Quotes';
import QuoteForm from './pages/QuoteForm';
import Customers from './pages/Customers';
import Suppliers from './pages/Suppliers';
import Products from './pages/Products';
import Purchases from './pages/Purchases';
import Expenses from './pages/Expenses';
import Treasury from './pages/Treasury';
import Accounting from './pages/Accounting';
import Projects from './pages/Projects';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import PlaceholderPage from './pages/PlaceholderPage';
import TaxesPage from './pages/TaxesPage';
import AdditionalEntriesPage from './pages/AdditionalEntriesPage';
import AccessLogsPage from './pages/AccessLogsPage';
import DeliveryNotes from './pages/DeliveryNotes';
import DeliveryNoteForm from './pages/DeliveryNoteForm';
import CreditNotes from './pages/CreditNotes';
import Payments from './pages/Payments';
import Reminders from './pages/Reminders';
import ExitVouchers from './pages/ExitVouchers';
import Receipts from './pages/Receipts';
import Disbursements from './pages/Disbursements';
import WithholdingTaxes from './pages/WithholdingTaxes';
import CustomerSummary from './pages/CustomerSummary';
import SupplierSummary from './pages/SupplierSummary';
import PurchaseOrders from './pages/PurchaseOrders';
import SupplierInvoices from './pages/SupplierInvoices';
import SupplierPayments from './pages/SupplierPayments';
import Warehouses from './pages/Warehouses';
import Inventory from './pages/Inventory';
import StockMovements from './pages/StockMovements';
import ChartOfAccounts from './pages/ChartOfAccounts';
import AccountingDashboard from './pages/AccountingDashboard';
import JournalEntries from './pages/JournalEntries';
import GeneralLedger from './pages/GeneralLedger';
import TrialBalance from './pages/TrialBalance';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const [hasCompany, setHasCompany] = useState(null);
  const [checkingCompany, setCheckingCompany] = useState(true);

  useEffect(() => {
    const checkCompany = async () => {
      if (user) {
        try {
          const response = await companiesAPI.list();
          setHasCompany(response.data.length > 0);
        } catch (error) {
          console.error('Error checking company:', error);
          setHasCompany(false);
        }
      }
      setCheckingCompany(false);
    };

    if (!loading) {
      checkCompany();
    }
  }, [user, loading]);

  if (loading || checkingCompany) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (hasCompany === false) {
    return <Navigate to="/onboarding" />;
  }

  return children;
};

const AppRoutes = () => {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/portal/:token" element={<ClientPortal />} />
      
      {/* Onboarding - requires auth but not company */}
      <Route path="/onboarding" element={
        user ? <CompanyOnboarding /> : <Navigate to="/login" />
      } />
      
      {/* Protected Routes - require both auth and company */}
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      } />
      <Route path="/invoices" element={
        <ProtectedRoute>
          <Invoices />
        </ProtectedRoute>
      } />
      <Route path="/invoices/new" element={
        <ProtectedRoute>
          <InvoiceForm />
        </ProtectedRoute>
      } />
      <Route path="/invoices/:id/edit" element={
        <ProtectedRoute>
          <InvoiceForm />
        </ProtectedRoute>
      } />
      <Route path="/quotes" element={
        <ProtectedRoute>
          <Quotes />
        </ProtectedRoute>
      } />
      <Route path="/quotes/new" element={
        <ProtectedRoute>
          <QuoteForm />
        </ProtectedRoute>
      } />
      <Route path="/quotes/:id/edit" element={
        <ProtectedRoute>
          <QuoteForm />
        </ProtectedRoute>
      } />
      <Route path="/delivery-notes" element={
        <ProtectedRoute>
          <DeliveryNotes />
        </ProtectedRoute>
      } />
      <Route path="/delivery-notes/new" element={
        <ProtectedRoute>
          <DeliveryNoteForm />
        </ProtectedRoute>
      } />
      <Route path="/delivery-notes/:id/edit" element={
        <ProtectedRoute>
          <DeliveryNoteForm />
        </ProtectedRoute>
      } />
      <Route path="/credit-notes" element={
        <ProtectedRoute>
          <CreditNotes />
        </ProtectedRoute>
      } />
      <Route path="/payments" element={
        <ProtectedRoute>
          <Payments />
        </ProtectedRoute>
      } />
      <Route path="/reminders" element={
        <ProtectedRoute>
          <Reminders />
        </ProtectedRoute>
      } />
      <Route path="/customers" element={
        <ProtectedRoute>
          <Customers />
        </ProtectedRoute>
      } />
      <Route path="/suppliers" element={
        <ProtectedRoute>
          <Suppliers />
      <Route path="/contacts/customers/:customerId/summary" element={<ProtectedRoute><CustomerSummary /></ProtectedRoute>} />
      <Route path="/contacts/suppliers/:supplierId/summary" element={<ProtectedRoute><SupplierSummary /></ProtectedRoute>} />

        </ProtectedRoute>
      } />
      <Route path="/products" element={
        <ProtectedRoute>
          <Products />
        </ProtectedRoute>
      } />
      <Route path="/purchase-orders" element={
        <ProtectedRoute>
          <PurchaseOrders />
        </ProtectedRoute>
      } />
      <Route path="/supplier-invoices" element={
        <ProtectedRoute>
          <SupplierInvoices />
        </ProtectedRoute>
      } />
      <Route path="/supplier-payments" element={
        <ProtectedRoute>
          <SupplierPayments />
        </ProtectedRoute>
      } />
      <Route path="/warehouses" element={
        <ProtectedRoute>
          <Warehouses />
        </ProtectedRoute>
      } />
      <Route path="/inventory" element={
        <ProtectedRoute>
          <Inventory />
        </ProtectedRoute>
      } />
      <Route path="/stock-movements" element={
        <ProtectedRoute>
          <StockMovements />
        </ProtectedRoute>
      } />
      <Route path="/purchases" element={
        <ProtectedRoute>
          <Purchases />
        </ProtectedRoute>
      } />
      <Route path="/expenses" element={
        <ProtectedRoute>
          <Expenses />
        </ProtectedRoute>
      } />
      <Route path="/treasury" element={
        <ProtectedRoute>
          <Treasury />
        </ProtectedRoute>
      } />
      <Route path="/accounting" element={
        <ProtectedRoute>
          <Accounting />
        </ProtectedRoute>
      } />
      <Route path="/projects" element={
        <ProtectedRoute>
          <Projects />
        </ProtectedRoute>
      } />
      <Route path="/reports" element={
        <ProtectedRoute>
          <Reports />
        </ProtectedRoute>
      } />
      <Route path="/settings" element={
        <ProtectedRoute>
          <Settings />
        </ProtectedRoute>
      } />
      
      {/* Stock Routes */}
      <Route path="/warehouses" element={<ProtectedRoute><PlaceholderPage /></ProtectedRoute>} />
      <Route path="/inventory" element={<ProtectedRoute><PlaceholderPage /></ProtectedRoute>} />
      <Route path="/stock-movements" element={<ProtectedRoute><PlaceholderPage /></ProtectedRoute>} />
      
      {/* Sales Routes with /sales prefix */}
      <Route path="/sales/invoices" element={<ProtectedRoute><Invoices /></ProtectedRoute>} />
      <Route path="/sales/invoices/new" element={<ProtectedRoute><InvoiceForm /></ProtectedRoute>} />
      <Route path="/sales/invoices/:id/edit" element={<ProtectedRoute><InvoiceForm /></ProtectedRoute>} />
      <Route path="/sales/quotes" element={<ProtectedRoute><Quotes /></ProtectedRoute>} />
      <Route path="/sales/quotes/new" element={<ProtectedRoute><QuoteForm /></ProtectedRoute>} />
      <Route path="/sales/quotes/:id/edit" element={<ProtectedRoute><QuoteForm /></ProtectedRoute>} />
      <Route path="/sales/delivery-notes" element={<ProtectedRoute><DeliveryNotes /></ProtectedRoute>} />
      <Route path="/sales/delivery-notes/new" element={<ProtectedRoute><DeliveryNoteForm /></ProtectedRoute>} />
      <Route path="/sales/delivery-notes/:id/edit" element={<ProtectedRoute><DeliveryNoteForm /></ProtectedRoute>} />
      <Route path="/sales/payments" element={<ProtectedRoute><Payments /></ProtectedRoute>} />
      <Route path="/sales/credit-notes" element={<ProtectedRoute><CreditNotes /></ProtectedRoute>} />
      <Route path="/sales/reminders" element={<ProtectedRoute><Reminders /></ProtectedRoute>} />
      <Route path="/sales/exit-vouchers" element={<ProtectedRoute><ExitVouchers /></ProtectedRoute>} />
      <Route path="/purchases/receipts" element={<ProtectedRoute><Receipts /></ProtectedRoute>} />
      <Route path="/sales/disbursements" element={<ProtectedRoute><Disbursements /></ProtectedRoute>} />
      <Route path="/accounting/withholding-taxes" element={<ProtectedRoute><WithholdingTaxes /></ProtectedRoute>} />
      
      {/* Compatibility routes - redirect old paths to new */}
      <Route path="/invoices" element={<ProtectedRoute><Invoices /></ProtectedRoute>} />
      <Route path="/quotes" element={<ProtectedRoute><Quotes /></ProtectedRoute>} />
      <Route path="/delivery-notes" element={<ProtectedRoute><DeliveryNotes /></ProtectedRoute>} />
      <Route path="/credit-notes" element={<ProtectedRoute><CreditNotes /></ProtectedRoute>} />
      <Route path="/payments" element={<ProtectedRoute><Payments /></ProtectedRoute>} />
      <Route path="/reminders" element={<ProtectedRoute><Reminders /></ProtectedRoute>} />
      <Route path="/exit-vouchers" element={<ProtectedRoute><ExitVouchers /></ProtectedRoute>} />
      <Route path="/receipts" element={<ProtectedRoute><Receipts /></ProtectedRoute>} />
      <Route path="/disbursements" element={<ProtectedRoute><Disbursements /></ProtectedRoute>} />
      <Route path="/withholding-taxes" element={<ProtectedRoute><WithholdingTaxes /></ProtectedRoute>} />
      <Route path="/purchase-orders" element={<ProtectedRoute><PurchaseOrders /></ProtectedRoute>} />


      
      {/* Stock Routes with /stock prefix */}
      <Route path="/stock/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
      <Route path="/stock/warehouses" element={<ProtectedRoute><Warehouses /></ProtectedRoute>} />
      <Route path="/stock/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
      <Route path="/stock/movements" element={<ProtectedRoute><StockMovements /></ProtectedRoute>} />
      
      {/* Ventes Routes */}
      <Route path="/delivery-notes" element={<ProtectedRoute><PlaceholderPage /></ProtectedRoute>} />
      <Route path="/exit-vouchers" element={<ProtectedRoute><PlaceholderPage /></ProtectedRoute>} />
      <Route path="/credit-notes" element={<ProtectedRoute><PlaceholderPage /></ProtectedRoute>} />
      <Route path="/expense-reports" element={<ProtectedRoute><PlaceholderPage /></ProtectedRoute>} />
      <Route path="/sales-payments" element={<ProtectedRoute><PlaceholderPage /></ProtectedRoute>} />
      <Route path="/reminders" element={<ProtectedRoute><PlaceholderPage /></ProtectedRoute>} />
      <Route path="/pos" element={<ProtectedRoute><PlaceholderPage /></ProtectedRoute>} />
      
      {/* Achats Routes */}
      <Route path="/reception-notes" element={<ProtectedRoute><PlaceholderPage /></ProtectedRoute>} />
      <Route path="/purchase-orders" element={<ProtectedRoute><PlaceholderPage /></ProtectedRoute>} />
      <Route path="/supplier-invoices" element={<ProtectedRoute><PlaceholderPage /></ProtectedRoute>} />
      <Route path="/services" element={<ProtectedRoute><PlaceholderPage /></ProtectedRoute>} />
      <Route path="/purchase-payments" element={<ProtectedRoute><PlaceholderPage /></ProtectedRoute>} />
      <Route path="/withholding-tax" element={<ProtectedRoute><PlaceholderPage /></ProtectedRoute>} />
      <Route path="/purchase-reminders" element={<ProtectedRoute><PlaceholderPage /></ProtectedRoute>} />
      
      {/* Comptabilité Routes */}
      <Route path="/chart-of-accounts" element={<ProtectedRoute><ChartOfAccounts /></ProtectedRoute>} />
      <Route path="/accounting-dashboard" element={<ProtectedRoute><AccountingDashboard /></ProtectedRoute>} />
      <Route path="/journal-entries" element={<ProtectedRoute><JournalEntries /></ProtectedRoute>} />
      <Route path="/general-ledger" element={<ProtectedRoute><GeneralLedger /></ProtectedRoute>} />
      <Route path="/trial-balance" element={<ProtectedRoute><TrialBalance /></ProtectedRoute>} />
      <Route path="/ledgers" element={<ProtectedRoute><GeneralLedger /></ProtectedRoute>} />
      <Route path="/balances" element={<ProtectedRoute><TrialBalance /></ProtectedRoute>} />
      <Route path="/balance-tiers" element={<ProtectedRoute><PlaceholderPage /></ProtectedRoute>} />
      <Route path="/balance-generale" element={<ProtectedRoute><TrialBalance /></ProtectedRoute>} />
      <Route path="/legal-journals" element={<ProtectedRoute><PlaceholderPage /></ProtectedRoute>} />
      <Route path="/fiscal-years" element={<ProtectedRoute><PlaceholderPage /></ProtectedRoute>} />
      <Route path="/financial-statements" element={<ProtectedRoute><PlaceholderPage /></ProtectedRoute>} />
      <Route path="/bilan" element={<ProtectedRoute><PlaceholderPage /></ProtectedRoute>} />
      <Route path="/income-statement" element={<ProtectedRoute><PlaceholderPage /></ProtectedRoute>} />
      <Route path="/cash-flow" element={<ProtectedRoute><PlaceholderPage /></ProtectedRoute>} />
      
      {/* Paramètres Routes */}
      <Route path="/collaborators" element={<ProtectedRoute><PlaceholderPage /></ProtectedRoute>} />
      <Route path="/roles-permissions" element={<ProtectedRoute><PlaceholderPage /></ProtectedRoute>} />
      <Route path="/additional-entries" element={<ProtectedRoute><AdditionalEntriesPage /></ProtectedRoute>} />
      <Route path="/taxes" element={<ProtectedRoute><TaxesPage /></ProtectedRoute>} />
      <Route path="/banks" element={<ProtectedRoute><PlaceholderPage /></ProtectedRoute>} />
      <Route path="/customization" element={<ProtectedRoute><PlaceholderPage /></ProtectedRoute>} />
      <Route path="/calendar" element={<ProtectedRoute><PlaceholderPage /></ProtectedRoute>} />
      <Route path="/access-logs" element={<ProtectedRoute><AccessLogsPage /></ProtectedRoute>} />
      <Route path="/access-logs" element={<ProtectedRoute><PlaceholderPage /></ProtectedRoute>} />
      <Route path="/files" element={<ProtectedRoute><PlaceholderPage /></ProtectedRoute>} />
      <Route path="/integrations" element={<ProtectedRoute><PlaceholderPage /></ProtectedRoute>} />
      <Route path="/workflows" element={<ProtectedRoute><PlaceholderPage /></ProtectedRoute>} />
      
      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <LanguageProvider>
          <div className="App">
            <AppRoutes />
            <Toaster />
          </div>
        </LanguageProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;