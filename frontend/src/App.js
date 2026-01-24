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
import CompanyOnboarding from './pages/CompanyOnboarding';
import Dashboard from './pages/Dashboard';
import Invoices from './pages/Invoices';
import Quotes from './pages/Quotes';
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
import CreditNotes from './pages/CreditNotes';
import Payments from './pages/Payments';
import Reminders from './pages/Reminders';
import PurchaseOrders from './pages/PurchaseOrders';
import SupplierInvoices from './pages/SupplierInvoices';
import SupplierPayments from './pages/SupplierPayments';
import Warehouses from './pages/Warehouses';
import Inventory from './pages/Inventory';
import StockMovements from './pages/StockMovements';
import ChartOfAccounts from './pages/ChartOfAccounts';

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
      <Route path="/quotes" element={
        <ProtectedRoute>
          <Quotes />
        </ProtectedRoute>
      } />
      <Route path="/delivery-notes" element={
        <ProtectedRoute>
          <DeliveryNotes />
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
      <Route path="/chart-of-accounts" element={<ProtectedRoute><PlaceholderPage /></ProtectedRoute>} />
      <Route path="/journal-entries" element={<ProtectedRoute><PlaceholderPage /></ProtectedRoute>} />
      <Route path="/ledgers" element={<ProtectedRoute><PlaceholderPage /></ProtectedRoute>} />
      <Route path="/balances" element={<ProtectedRoute><PlaceholderPage /></ProtectedRoute>} />
      <Route path="/balance-tiers" element={<ProtectedRoute><PlaceholderPage /></ProtectedRoute>} />
      <Route path="/balance-generale" element={<ProtectedRoute><PlaceholderPage /></ProtectedRoute>} />
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