import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FlaskConical,
  Package,
  Warehouse,
  Users,
  FileText,
  BarChart3,
  Beaker,
  TestTube2,
  Menu,
  X,
  BookOpen,
  Factory,
  Store,
  ShieldCheck,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const manufacturingNav = [
  { path: '/raw-materials', label: 'Raw Materials', icon: FlaskConical },
  { path: '/formulations', label: 'Formulations', icon: TestTube2 },
  { path: '/inventory', label: 'Production & Stock', icon: Warehouse },
];

const tradingNav = [
  { path: '/trading', label: 'Trading Dashboard', icon: Store },
  { path: '/products', label: 'Products', icon: Beaker },
  { path: '/customers', label: 'Customers', icon: Users },
  { path: '/invoices', label: 'Sales & Billing', icon: FileText },
  { path: '/ledger', label: 'A/R Ledger', icon: BookOpen },
  { path: '/reports', label: 'Reports', icon: BarChart3 },
];


export default function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { signOut } = useAuth();

  const renderNavSection = (items, sectionLabel, accentColor) => (
    <div className="sidebar-section">
      <div className="sidebar-section-label" style={{ color: accentColor }}>
        {sectionLabel}
      </div>
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path;
        return (
          <NavLink
            key={item.path}
            to={item.path}
            className={`sidebar-link ${isActive ? 'active' : ''}`}
            onClick={() => setMobileOpen(false)}
          >
            <div className={`sidebar-link-icon ${isActive ? 'icon-active' : ''}`}>
              <Icon size={18} />
            </div>
            <span>{item.label}</span>
            {isActive && <div className="sidebar-link-indicator" />}
          </NavLink>
        );
      })}
    </div>
  );

  return (
    <>
      {/* Mobile toggle button */}
      <button
        className="sidebar-toggle"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle sidebar"
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Overlay for mobile */}
      {mobileOpen && (
        <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        {/* Brand */}
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">
            <Package size={22} />
          </div>
          <div className="sidebar-brand-text">
            <span className="sidebar-brand-name">UnifyMFG</span>
            <span className="sidebar-brand-sub">Smart Factory OS</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {renderNavSection(manufacturingNav, '🏭 Manufacturing', 'var(--accent-primary)')}
          <div className="sidebar-divider" />
          {renderNavSection(tradingNav, '🏪 Trading', 'var(--accent-secondary)')}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <button 
            onClick={signOut} 
            className="btn btn-secondary" 
            style={{ width: '100%', fontSize: '0.8rem', padding: '6px' }}
          >
            Logout
          </button>
          <p style={{ marginTop: '10px' }}>v1.1</p>
        </div>
      </aside>

      <style>{`
        .sidebar-toggle {
          display: none;
          position: fixed;
          top: 14px;
          left: 14px;
          z-index: 1100;
          width: 40px;
          height: 40px;
          border-radius: var(--radius-sm);
          background: var(--bg-card);
          border: 1px solid var(--border-medium);
          color: var(--text-primary);
          cursor: pointer;
          align-items: center;
          justify-content: center;
        }
        @media (max-width: 768px) {
          .sidebar-toggle { display: flex; }
        }

        .sidebar-overlay {
          display: none;
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
          z-index: 900;
        }
        @media (max-width: 768px) {
          .sidebar-overlay { display: block; }
        }

        .sidebar {
          position: fixed;
          left: 0;
          top: 0;
          bottom: 0;
          width: var(--sidebar-width);
          background: var(--bg-secondary);
          border-right: 1px solid var(--border-subtle);
          display: flex;
          flex-direction: column;
          z-index: 1000;
          transition: transform var(--transition-normal);
          overflow-y: auto;
        }
        @media (max-width: 768px) {
          .sidebar {
            transform: translateX(-100%);
          }
          .sidebar.sidebar-open {
            transform: translateX(0);
          }
        }

        .sidebar-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 22px 20px 18px;
          border-bottom: 1px solid var(--border-subtle);
        }
        .sidebar-brand-icon {
          width: 38px;
          height: 38px;
          border-radius: var(--radius-md);
          background: var(--gradient-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          flex-shrink: 0;
        }
        .sidebar-brand-name {
          display: block;
          font-weight: 700;
          font-size: 0.95rem;
          color: var(--text-primary);
          line-height: 1.2;
        }
        .sidebar-brand-sub {
          display: block;
          font-size: 0.7rem;
          color: var(--text-muted);
          font-weight: 400;
          letter-spacing: 0.03em;
        }

        .sidebar-nav {
          flex: 1;
          padding: 12px 10px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .sidebar-section {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .sidebar-section-label {
          font-size: 0.68rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          padding: 10px 14px 6px;
          opacity: 0.9;
        }

        .sidebar-divider {
          height: 1px;
          background: var(--border-subtle);
          margin: 8px 14px;
        }

        .sidebar-link {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 14px;
          border-radius: var(--radius-sm);
          color: var(--text-secondary);
          text-decoration: none;
          font-size: 0.88rem;
          font-weight: 500;
          position: relative;
          transition: all var(--transition-fast);
        }
        .sidebar-link:hover {
          background: var(--bg-glass-hover);
          color: var(--text-primary);
        }
        .sidebar-link.active {
          background: rgba(108, 99, 255, 0.1);
          color: var(--accent-primary);
        }

        .sidebar-link-icon {
          width: 32px;
          height: 32px;
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all var(--transition-fast);
        }
        .sidebar-link-icon.icon-active {
          background: var(--gradient-primary);
          color: white;
          box-shadow: 0 2px 8px var(--accent-primary-glow);
        }

        .sidebar-link-indicator {
          position: absolute;
          right: 0;
          top: 50%;
          transform: translateY(-50%);
          width: 3px;
          height: 20px;
          background: var(--accent-primary);
          border-radius: 2px;
        }

        .sidebar-footer {
          padding: 14px 20px;
          border-top: 1px solid var(--border-subtle);
          text-align: center;
        }
        .sidebar-footer p {
          font-size: 0.72rem;
          color: var(--text-muted);
        }
      `}</style>
    </>
  );
}
