import { useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { supabase } from '../api/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const { session, role, roleLoading, accessRestrictedError, clearAccessRestrictedError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (clearAccessRestrictedError) clearAccessRestrictedError();
    setLoading(true);
    setError(null);
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      setError(error.message);
    }
    setLoading(false);
  };

  // SECURITY: Only explicitly confirmed admin role goes to dashboard.
  // All other values (employee, null, undefined) go to employee panel.
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
          <h1 style={styles.title}>Flavour & Essence</h1>
          <p style={styles.subtitle}>Business Operations System</p>
        </div>
        
        <form onSubmit={handleLogin} style={styles.form}>
          {activeError && <div style={styles.error}>{activeError}</div>}
          
          <div className="form-group" style={styles.group}>
            <label style={styles.label}>Email Address</label>
            <input 
              type="email" 
              className="form-control" 
              placeholder="admin@flavour.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
            />
          </div>
          
          <div className="form-group" style={styles.group}>
            <label style={styles.label}>Password</label>
            <input 
              type="password" 
              className="form-control" 
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
            />
          </div>
          
          <button 
            type="submit" 
            className="btn btn-primary" 
            style={styles.button}
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <Link to="/employee-login" style={{ color: 'var(--text-secondary)', fontSize: '13px', textDecoration: 'none' }}>
            👷 Employee Login
          </Link>
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
    backgroundColor: 'var(--bg-primary)',
    padding: '20px'
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    padding: '40px',
    width: '100%',
    maxWidth: '420px',
    boxShadow: '0 12px 32px rgba(0,0,0,0.05), 0 2px 8px rgba(0,0,0,0.02)',
    border: '1px solid var(--border-color)',
  },
  header: {
    textAlign: 'center',
    marginBottom: '32px'
  },
  title: {
    margin: '0 0 8px 0',
    fontSize: '24px',
    fontWeight: '700',
    color: 'var(--text-primary)'
  },
  subtitle: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: '14px'
  },
  form: {
    display: 'flex',
    flexDirection: 'column'
  },
  group: {
    marginBottom: '20px'
  },
  label: {
    display: 'block',
    marginBottom: '6px',
    fontSize: '14px',
    fontWeight: '600',
    color: 'var(--text-primary)'
  },
  button: {
    width: '100%',
    padding: '12px',
    justifyContent: 'center',
    marginTop: '10px'
  },
  error: {
    backgroundColor: '#fff1f2',
    color: '#e11d48',
    padding: '12px',
    borderRadius: '8px',
    marginBottom: '20px',
    fontSize: '14px',
    textAlign: 'center',
    border: '1px solid #ffe4e6'
  }
};
