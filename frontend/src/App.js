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