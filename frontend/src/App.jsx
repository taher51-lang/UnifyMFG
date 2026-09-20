// frontend/src/App.jsx
// Root component with React Router v6 — persistent sidebar layout

import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import EmployeeLogin from './pages/EmployeeLogin';
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
import EmployeePanel from './pages/EmployeePanel';
import EmployeeActivity from './pages/EmployeeActivity';
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
  
  if (role !== 'admin') return <Navigate to="/employee" replace />;
  
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

// Layout for Employee Panel
const EmployeeProtectedLayout = () => {
  const { session, loading, role, roleLoading } = useAuth();
  
  if (loading || roleLoading) return <LoadingSpinner />;
  
  if (!session) return <Navigate to="/employee-login" replace />;
  
  if (role === 'admin') return <Navigate to="/dashboard" replace />;
  
  return (
    <div className="app-layout" style={{ display: 'block' }}>
      <main className="main-content" style={{ marginLeft: 0, padding: 0 }}>
        <Outlet />
      </main>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/employee-login" element={<EmployeeLogin />} />
          
          {/* Employee Routes */}
          <Route element={<EmployeeProtectedLayout />}>
            <Route path="/employee" element={<EmployeePanel />} />
          </Route>

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
            <Route path="/employee-activity" element={<EmployeeActivity />} />
          </Route>

          {/* Catch-all: redirect to login for role-based triage (NOT inside admin guard) */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
