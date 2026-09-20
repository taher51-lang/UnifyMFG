// frontend/src/pages/EmployeeActivity.jsx
// Admin page to monitor employee login times, active sessions, and in-app activities

import { useState, useEffect, useMemo } from 'react';
import {
  Users,
  LogIn,
  LogOut,
  Mic,
  Search,
  Clock,
  Activity,
  RefreshCw,
  Calendar,
  Filter,
  CheckCircle2,
  XCircle,
  Smartphone,
  Laptop,
  ShieldCheck,
  Volume2,
} from 'lucide-react';
import client from '../api/client';
import AudioReports from '../components/AudioReports';

export default function EmployeeActivity() {
  const [activeTab, setActiveTab] = useState('feed'); // 'feed' | 'directory' | 'audio'
  const [activities, setActivities] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [timeFilter, setTimeFilter] = useState('today'); // 'today' | 'yesterday' | '7' | '30' | 'all'
  const [eventTypeFilter, setEventTypeFilter] = useState('ALL');
  const [employeeFilter, setEmployeeFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchAuditData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    try {
      // Calculate date filters
      let daysParam = '';
      let dateParam = '';
      const todayIso = new Date().toISOString().slice(0, 10);

      if (timeFilter === 'today') {
        dateParam = todayIso;
      } else if (timeFilter === 'yesterday') {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        dateParam = yesterday.toISOString().slice(0, 10);
      } else if (timeFilter === '7') {
        daysParam = '7';
      } else if (timeFilter === '30') {
        daysParam = '30';
      }

      const params = new URLSearchParams();
      if (dateParam) params.append('date', dateParam);
      else if (daysParam) params.append('days', daysParam);
      if (eventTypeFilter !== 'ALL') params.append('event_type', eventTypeFilter);
      if (employeeFilter !== 'ALL') params.append('user_id', employeeFilter);
      params.append('limit', '150');

      const [activitiesRes, summaryRes] = await Promise.all([
        client.get(`/admin/employee-activities?${params.toString()}`).catch(() => ({ data: [] })),
        client.get('/admin/employee-summary').catch(() => ({ data: null })),
      ]);

      setActivities(activitiesRes.data || []);
      setSummary(summaryRes.data || null);
    } catch (err) {
      console.error('Failed to load employee activity data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAuditData();
  }, [timeFilter, eventTypeFilter, employeeFilter]);

  // Client-side search filtering
  const filteredActivities = useMemo(() => {
    if (!searchQuery.trim()) return activities;
    const q = searchQuery.toLowerCase();
    return activities.filter((act) => {
      const name = (act.employee_name || '').toLowerCase();
      const email = (act.employee_email || '').toLowerCase();
      const type = (act.event_type || '').toLowerCase();
      const detailsStr = JSON.stringify(act.details || {}).toLowerCase();
      return name.includes(q) || email.includes(q) || type.includes(q) || detailsStr.includes(q);
    });
  }, [activities, searchQuery]);

  // Format date helper
  const formatTime = (isoString) => {
    if (!isoString) return '—';
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    let relative = '';
    if (diffMins < 1) relative = 'Just now';
    else if (diffMins < 60) relative = `${diffMins}m ago`;
    else if (diffHours < 24) relative = `${diffHours}h ago`;
    else relative = `${Math.floor(diffHours / 24)}d ago`;

    const formattedTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const formattedDate = date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

    return { relative, exact: `${formattedDate} at ${formattedTime}` };
  };

  const getEventBadge = (eventType) => {
    switch (eventType) {
      case 'LOGIN':
        return {
          label: 'Logged In',
          color: '#10b981',
          bg: 'rgba(16, 185, 129, 0.12)',
          icon: <LogIn size={15} />,
        };
      case 'LOGOUT':
        return {
          label: 'Logged Out',
          color: '#64748b',
          bg: 'rgba(100, 116, 139, 0.12)',
          icon: <LogOut size={15} />,
        };
      case 'AUDIO_REPORT':
        return {
          label: 'Voice Memo',
          color: '#8b5cf6',
          bg: 'rgba(139, 92, 246, 0.12)',
          icon: <Mic size={15} />,
        };
      case 'PRICE_SEARCH':
        return {
          label: 'Price Check',
          color: '#3b82f6',
          bg: 'rgba(59, 130, 246, 0.12)',
          icon: <Search size={15} />,
        };
      default:
        return {
          label: eventType,
          color: '#f59e0b',
          bg: 'rgba(245, 158, 11, 0.12)',
          icon: <Activity size={15} />,
        };
    }
  };

  const renderEventDetails = (act) => {
    const details = act.details || {};
    if (act.event_type === 'LOGIN') {
      const source = details.eventSource ? `(${details.eventSource})` : '';
      return (
        <span style={{ color: 'var(--text-secondary)' }}>
          Started session {source}
        </span>
      );
    }
    if (act.event_type === 'LOGOUT') {
      return (
        <span style={{ color: 'var(--text-muted)' }}>
          Signed out of system
        </span>
      );
    }
    if (act.event_type === 'AUDIO_REPORT') {
      const duration = details.duration_seconds ? `${details.duration_seconds}s` : 'audio memo';
      return (
        <span style={{ color: 'var(--accent-primary)', fontWeight: 500 }}>
          Uploaded voice report ({duration})
        </span>
      );
    }
    if (act.event_type === 'PRICE_SEARCH') {
      return (
        <span style={{ color: 'var(--text-primary)' }}>
          Searched price for: <strong style={{ color: 'var(--accent-info)' }}>"{details.query || ''}"</strong>
        </span>
      );
    }
    return <span>{JSON.stringify(details)}</span>;
  };

  const employeesList = summary?.employees || [];
  const metrics = summary?.metrics || {
    total_employees: employeesList.length,
    active_today: employeesList.filter((e) => e.is_active_today).length,
    today_total_events: 0,
  };

  // Find most recent login
  const latestLoginUser = useMemo(() => {
    if (!employeesList.length) return null;
    const sorted = [...employeesList]
      .filter((e) => e.last_login)
      .sort((a, b) => new Date(b.last_login) - new Date(a.last_login));
    return sorted.length > 0 ? sorted[0] : null;
  }, [employeesList]);

  return (
    <div className="page-container" style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: '8px', background: 'rgba(108, 99, 255, 0.12)', borderRadius: '10px', color: 'var(--accent-primary)' }}>
              <ShieldCheck size={26} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.6rem', fontWeight: 700, margin: 0 }}>Employee Activity & Audit</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '4px 0 0 0' }}>
                Monitor staff login timestamps, shifts, voice memos, and active operations in real time.
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            className="btn btn-secondary"
            onClick={() => fetchAuditData(true)}
            disabled={refreshing}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}
          >
            <RefreshCw size={16} className={refreshing ? 'spin' : ''} />
            {refreshing ? 'Refreshing...' : 'Refresh Logs'}
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="stat-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
            <Users size={22} />
          </div>
          <div className="stat-value">
            {metrics.active_today} <span style={{ fontSize: '0.9rem', fontWeight: 400, color: 'var(--text-secondary)' }}>/ {metrics.total_employees}</span>
          </div>
          <div className="stat-label">Active Employees Today</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(108, 99, 255, 0.15)', color: 'var(--accent-primary)' }}>
            <Clock size={22} />
          </div>
          <div className="stat-value" style={{ fontSize: '1.2rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {latestLoginUser ? (
              <span>{latestLoginUser.display_name}</span>
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>No logins today</span>
            )}
          </div>
          <div className="stat-label">
            {latestLoginUser?.last_login ? `Latest Login: ${formatTime(latestLoginUser.last_login).relative}` : 'Most Recent Login'}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6' }}>
            <Mic size={22} />
          </div>
          <div className="stat-value">
            {employeesList.reduce((sum, e) => sum + (e.audio_reports || 0), 0)}
          </div>
          <div className="stat-label">Total Audio Reports (30d)</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
            <Activity size={22} />
          </div>
          <div className="stat-value">{metrics.today_total_events}</div>
          <div className="stat-label">Total Operations Today</div>
        </div>
      </div>

      {/* Main Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-medium)', marginBottom: '20px' }}>
        <button
          onClick={() => setActiveTab('feed')}
          style={{
            padding: '10px 18px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.95rem',
            color: activeTab === 'feed' ? 'var(--accent-primary)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'feed' ? '2px solid var(--accent-primary)' : '2px solid transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Activity size={18} />
          Live Activity Feed ({activities.length})
        </button>

        <button
          onClick={() => setActiveTab('directory')}
          style={{
            padding: '10px 18px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.95rem',
            color: activeTab === 'directory' ? 'var(--accent-primary)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'directory' ? '2px solid var(--accent-primary)' : '2px solid transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Users size={18} />
          Employee Directory & Status ({employeesList.length})
        </button>

        <button
          onClick={() => setActiveTab('audio')}
          style={{
            padding: '10px 18px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.95rem',
            color: activeTab === 'audio' ? 'var(--accent-primary)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'audio' ? '2px solid var(--accent-primary)' : '2px solid transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Volume2 size={18} />
          Audio Voice Reports
        </button>
      </div>

      {/* Tab 1: Live Feed */}
      {activeTab === 'feed' && (
        <div>
          {/* Filter Bar */}
          <div
            className="card"
            style={{
              padding: '16px 20px',
              marginBottom: '20px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '14px',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
              {/* Date Filter Buttons */}
              <div style={{ display: 'flex', background: 'var(--bg-tertiary)', borderRadius: '8px', padding: '3px' }}>
                {[
                  { id: 'today', label: 'Today' },
                  { id: 'yesterday', label: 'Yesterday' },
                  { id: '7', label: 'Last 7 Days' },
                  { id: '30', label: '30 Days' },
                  { id: 'all', label: 'All Time' },
                ].map((tf) => (
                  <button
                    key={tf.id}
                    onClick={() => setTimeFilter(tf.id)}
                    style={{
                      padding: '6px 12px',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.82rem',
                      fontWeight: 500,
                      background: timeFilter === tf.id ? 'var(--bg-secondary)' : 'transparent',
                      color: timeFilter === tf.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
                      boxShadow: timeFilter === tf.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    }}
                  >
                    {tf.label}
                  </button>
                ))}
              </div>

              {/* Event Type Filter */}
              <select
                value={eventTypeFilter}
                onChange={(e) => setEventTypeFilter(e.target.value)}
                style={{
                  padding: '7px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-medium)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                }}
              >
                <option value="ALL">All Event Types</option>
                <option value="LOGIN">🟢 Logins Only</option>
                <option value="LOGOUT">⚪ Logouts Only</option>
                <option value="AUDIO_REPORT">🎙️ Voice Reports</option>
                <option value="PRICE_SEARCH">🔍 Price Checks</option>
              </select>

              {/* Employee Filter */}
              {employeesList.length > 0 && (
                <select
                  value={employeeFilter}
                  onChange={(e) => setEmployeeFilter(e.target.value)}
                  style={{
                    padding: '7px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-medium)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                  }}
                >
                  <option value="ALL">All Employees</option>
                  {employeesList.map((emp) => (
                    <option key={emp.user_id} value={emp.user_id}>
                      {emp.display_name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Search Input */}
            <div style={{ minWidth: '220px', flex: '1 1 200px', maxWidth: '320px' }}>
              <input
                type="text"
                placeholder="Search by name, action, or query..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-medium)',
                  background: 'var(--bg-secondary)',
                  fontSize: '0.85rem',
                }}
              />
            </div>
          </div>

          {/* Activity Timeline List */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                Activity Log
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Showing {filteredActivities.length} records
              </div>
            </div>

            {loading ? (
              <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <RefreshCw size={24} className="spin" style={{ margin: '0 auto 12px auto' }} />
                <div>Loading activity logs...</div>
              </div>
            ) : filteredActivities.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Clock size={36} style={{ margin: '0 auto 12px auto', opacity: 0.4 }} />
                <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>No activity logs found</div>
                <div style={{ fontSize: '0.85rem', marginTop: '6px' }}>
                  {timeFilter === 'today' ? 'No employees have logged in or recorded activity today yet.' : 'Try adjusting the date range or event filters.'}
                </div>
              </div>
            ) : (
              <div className="table-container">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-medium)' }}>
                      <th style={{ textAlign: 'left', padding: '12px 18px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>TIMESTAMP</th>
                      <th style={{ textAlign: 'left', padding: '12px 18px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>EMPLOYEE</th>
                      <th style={{ textAlign: 'left', padding: '12px 18px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>EVENT</th>
                      <th style={{ textAlign: 'left', padding: '12px 18px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>DETAILS</th>
                      <th style={{ textAlign: 'left', padding: '12px 18px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>DEVICE & IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredActivities.map((act) => {
                      const badge = getEventBadge(act.event_type);
                      const time = formatTime(act.created_at);
                      const isMobile = (act.user_agent || '').toLowerCase().includes('mobile') || (act.user_agent || '').toLowerCase().includes('android') || (act.user_agent || '').toLowerCase().includes('iphone');

                      return (
                        <tr
                          key={act.id}
                          style={{
                            borderBottom: '1px solid var(--border-subtle)',
                            transition: 'background var(--transition-fast)',
                          }}
                          className="table-row-hover"
                        >
                          {/* Timestamp */}
                          <td style={{ padding: '14px 18px', whiteSpace: 'nowrap' }}>
                            <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                              {time.relative}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {time.exact}
                            </div>
                          </td>

                          {/* Employee */}
                          <td style={{ padding: '14px 18px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div
                                style={{
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '50%',
                                  background: 'var(--gradient-primary)',
                                  color: '#ffffff',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 700,
                                  fontSize: '0.85rem',
                                  flexShrink: 0,
                                }}
                              >
                                {(act.employee_name || 'E').slice(0, 1).toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                                  {act.employee_name || 'Employee'}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                  {act.employee_email}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Event Type Badge */}
                          <td style={{ padding: '14px 18px', whiteSpace: 'nowrap' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '4px 10px',
                                borderRadius: '20px',
                                fontSize: '0.78rem',
                                fontWeight: 600,
                                color: badge.color,
                                background: badge.bg,
                              }}
                            >
                              {badge.icon}
                              {badge.label}
                            </span>
                          </td>

                          {/* Event Details */}
                          <td style={{ padding: '14px 18px', fontSize: '0.86rem' }}>
                            {renderEventDetails(act)}
                          </td>

                          {/* Device / IP */}
                          <td style={{ padding: '14px 18px', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                              {isMobile ? <Smartphone size={14} /> : <Laptop size={14} />}
                              <span>{isMobile ? 'Mobile' : 'Desktop'}</span>
                              {act.ip_address && (
                                <span style={{ color: 'var(--text-muted)' }}>• {act.ip_address}</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Directory & Status */}
      {activeTab === 'directory' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>Employee Login Status & History</h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Check who is logged in today, last seen times, and overall activity volume.
            </p>
          </div>

          <div className="table-container">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-medium)' }}>
                  <th style={{ textAlign: 'left', padding: '12px 18px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>EMPLOYEE</th>
                  <th style={{ textAlign: 'left', padding: '12px 18px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>TODAY'S STATUS</th>
                  <th style={{ textAlign: 'left', padding: '12px 18px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>LAST LOGIN</th>
                  <th style={{ textAlign: 'left', padding: '12px 18px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>LAST ACTIVE</th>
                  <th style={{ textAlign: 'right', padding: '12px 18px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>TODAY'S ACTIONS</th>
                  <th style={{ textAlign: 'right', padding: '12px 18px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>AUDIO REPORTS</th>
                </tr>
              </thead>
              <tbody>
                {employeesList.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No employee profiles found. Once employees register/login, they will be listed here.
                    </td>
                  </tr>
                ) : (
                  employeesList.map((emp) => {
                    const lastLoginInfo = emp.last_login ? formatTime(emp.last_login) : null;
                    const lastActiveInfo = emp.last_active ? formatTime(emp.last_active) : null;

                    return (
                      <tr key={emp.user_id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '14px 18px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div
                              style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '50%',
                                background: emp.is_active_today ? 'rgba(16, 185, 129, 0.2)' : 'var(--bg-tertiary)',
                                color: emp.is_active_today ? '#10b981' : 'var(--text-muted)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: '0.95rem',
                              }}
                            >
                              {(emp.display_name || 'E').slice(0, 1).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>{emp.display_name}</div>
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{emp.email}</div>
                            </div>
                          </div>
                        </td>

                        {/* Today's status */}
                        <td style={{ padding: '14px 18px' }}>
                          {emp.is_active_today ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '4px 10px',
                                borderRadius: '16px',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                background: 'rgba(16, 185, 129, 0.12)',
                                color: '#10b981',
                              }}
                            >
                              <CheckCircle2 size={14} /> Active Today
                            </span>
                          ) : (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '4px 10px',
                                borderRadius: '16px',
                                fontSize: '0.8rem',
                                color: 'var(--text-muted)',
                                background: 'var(--bg-tertiary)',
                              }}
                            >
                              <XCircle size={14} /> Not Seen Today
                            </span>
                          )}
                        </td>

                        {/* Last login */}
                        <td style={{ padding: '14px 18px' }}>
                          {lastLoginInfo ? (
                            <div>
                              <div style={{ fontWeight: 500, fontSize: '0.85rem' }}>{lastLoginInfo.relative}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{lastLoginInfo.exact}</div>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Never</span>
                          )}
                        </td>

                        {/* Last active */}
                        <td style={{ padding: '14px 18px' }}>
                          {lastActiveInfo ? (
                            <div>
                              <div style={{ fontWeight: 500, fontSize: '0.85rem' }}>{lastActiveInfo.relative}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{lastActiveInfo.exact}</div>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Never</span>
                          )}
                        </td>

                        {/* Today's actions */}
                        <td style={{ padding: '14px 18px', textAlign: 'right', fontWeight: 600, fontSize: '0.9rem' }}>
                          {emp.today_events}
                        </td>

                        {/* Audio reports */}
                        <td style={{ padding: '14px 18px', textAlign: 'right', fontWeight: 600, fontSize: '0.9rem', color: 'var(--accent-primary)' }}>
                          {emp.audio_reports}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Audio Reports Component */}
      {activeTab === 'audio' && (
        <div style={{ marginTop: '10px' }}>
          <AudioReports />
        </div>
      )}
    </div>
  );
}
