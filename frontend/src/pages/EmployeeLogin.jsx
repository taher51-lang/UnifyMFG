import { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '../api/supabase';
import { useAuth } from '../contexts/AuthContext';
import { getApiBaseUrl } from '../api/client';

export default function EmployeeLogin() {
  const { session, role, roleLoading, accessRestrictedError, clearAccessRestrictedError } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [accessInfo, setAccessInfo] = useState(null);

  useEffect(() => {
    // Check current employee access status on mount
    const checkStatus = async () => {
      try {
        const baseUrl = getApiBaseUrl();
        const res = await fetch(`${baseUrl}/employee/access-status`).then((r) => r.json());
        if (res?.data) {
          setAccessInfo(res.data);
        }
      } catch (err) {
        // Fallback: don't block display on fetch error
      }
    };
    checkStatus();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (clearAccessRestrictedError) clearAccessRestrictedError();
    setLoading(true);
    setError(null);

    // Pre-check if access is restricted
    if (accessInfo && !accessInfo.allowed) {
      setError(accessInfo.message || 'Employee login is currently disabled outside normal hours.');
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
    }
    setLoading(false);
  };

  if (session && !roleLoading) {
    if (role === 'admin') {
      return <Navigate to="/dashboard" replace />;
    }
    return <Navigate to="/employee" replace />;
  }

  const activeError = accessRestrictedError || error;

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.icon}>👷</div>
          <h1 style={styles.title}>Employee Login</h1>
          <p style={styles.subtitle}>Flavour & Essence</p>
        </div>

        {/* Live System / Business Hours Status Banner */}
        {accessInfo && !accessInfo.allowed && (
          <div style={styles.restrictionBanner}>
            <div style={{ fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <span>⛔</span> Access Restricted
            </div>
            <div style={{ fontSize: '12px', opacity: 0.9 }}>
              {accessInfo.message}
            </div>
            {accessInfo.current_time_str && (
              <div style={{ fontSize: '11px', marginTop: '6px', opacity: 0.75 }}>
                🕒 Server: {accessInfo.current_time_str}
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleLogin} style={styles.form}>
          {activeError && <div style={styles.error}>{activeError}</div>}

          <div style={styles.group}>
            <label style={styles.label}>📧 Email</label>
            <input
              type="email"
              style={styles.input}
              placeholder="your email..."
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div style={styles.group}>
            <label style={styles.label}>🔒 Password</label>
            <input
              type="password"
              style={styles.input}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            style={{
              ...styles.button,
              opacity: loading ? 0.7 : 1,
            }}
            disabled={loading}
          >
            {loading ? '⏳ Logging in...' : '✅ Login'}
          </button>
        </form>

        <div style={styles.adminLink}>
          <a href="/login" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', textDecoration: 'none' }}>
            Admin Login →
          </a>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
    padding: '20px',
  },
  card: {
    background: 'rgba(255,255,255,0.06)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '24px',
    padding: '40px 32px',
    width: '100%',
    maxWidth: '400px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  header: {
    textAlign: 'center',
    marginBottom: '32px',
  },
  icon: {
    fontSize: '48px',
    marginBottom: '12px',
  },
  title: {
    margin: '0 0 4px 0',
    fontSize: '24px',
    fontWeight: '700',
    color: '#fff',
  },
  subtitle: {
    margin: 0,
    color: 'rgba(255,255,255,0.5)',
    fontSize: '14px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
  },
  group: {
    marginBottom: '20px',
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    fontSize: '16px',
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },
  input: {
    width: '100%',
    padding: '14px 16px',
    fontSize: '16px',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.08)',
    color: '#fff',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  },
  button: {
    width: '100%',
    padding: '16px',
    fontSize: '18px',
    fontWeight: '700',
    borderRadius: '12px',
    border: 'none',
    background: 'linear-gradient(135deg, #10b981, #059669)',
    color: '#fff',
    cursor: 'pointer',
    marginTop: '8px',
    transition: 'all 0.2s',
  },
  error: {
    background: 'rgba(239,68,68,0.15)',
    border: '1px solid rgba(239,68,68,0.3)',
    color: '#fca5a5',
    padding: '12px',
    borderRadius: '10px',
    marginBottom: '16px',
    fontSize: '14px',
    textAlign: 'center',
  },
  restrictionBanner: {
    background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(185, 28, 28, 0.25))',
    border: '1px solid rgba(239, 68, 68, 0.4)',
    color: '#fecaca',
    padding: '14px 16px',
    borderRadius: '14px',
    marginBottom: '20px',
    textAlign: 'left',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  },
  adminLink: {
    textAlign: 'center',
    marginTop: '20px',
  },
};
