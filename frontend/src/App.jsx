// frontend/src/App.jsx
// Root component with React Router v6 — persistent sidebar layout

import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import TradingDashboard from './pages/TradingDashboard';
import RawMaterials from './pages/RawMaterials';
import Formulations from './pages/Formulations';
import Products from './pages/Products';
import Inventory from './pages/Inventory';
import Customers from './pages/Customers';
import Ledger from './pages/Ledger';
import Invoices from './pages/Invoices';
import Reports from './pages/Reports';
import './App.css';

import { AppProvider } from './context/AppContext';

const LoadingSpinner = () => (
  <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-primary)' }}>
    <div className="spinner" />
  </div>
);

// Layout for Admin Dashboard
const AdminProtectedLayout = () => {
  const { session, loading, role, roleLoading } = useAuth();
  
  if (loading || roleLoading) return <LoadingSpinner />;
  
  if (!session) return <Navigate to="/login" replace />;
  
  return (
    <AppProvider>
      <div className="app-layout">
        <Sidebar />
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </AppProvider>
  );
};


function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />

          {/* Admin Routes */}
          <Route element={<AdminProtectedLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/trading" element={<TradingDashboard />} />
            <Route path="/raw-materials" element={<RawMaterials />} />
            <Route path="/formulations" element={<Formulations />} />
            <Route path="/products" element={<Products />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/ledger" element={<Ledger />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/reports" element={<Reports />} />
          </Route>

          {/* Catch-all: redirect to login for role-based triage (NOT inside admin guard) */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
