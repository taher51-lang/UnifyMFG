import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import ConfirmDialog from './ConfirmDialog';
import { getApiBaseUrl } from '../api/client';
import { Volume2, Clock, Trash2, CheckCircle2, RefreshCw } from 'lucide-react';

export default function AudioReports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'unreviewed'
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const { session } = useAuth();

  const fetchReports = async (showSpinner = true) => {
    try {
      if (showSpinner) setLoading(true);
      const baseUrl = getApiBaseUrl();
      // VITE_API_URL is intentionally `/api` in production. `new URL()` only
      // accepts absolute URLs unless a base is supplied, whereas fetch accepts
      // this same-origin relative API path directly.
      const query = filter === 'unreviewed' ? '?reviewed=false' : '';
      const url = `${baseUrl}/admin/audio-reports${query}`;

      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      const json = await res.json();
      if (json.data) setReports(json.data);
    } catch (err) {
      console.error('Failed to fetch audio reports:', err);
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  useEffect(() => {
    if (session) fetchReports();
  }, [session, filter]);

  const markReviewed = async (id, currentReviewed, notes = '') => {
    try {
      setReports(prev => prev.map(r => r.id === id ? { ...r, reviewed: !currentReviewed, notes } : r));
      await fetch(`${getApiBaseUrl()}/admin/audio-reports/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ reviewed: !currentReviewed, notes })
      });
    } catch (err) {
      console.error(err);
      fetchReports(false);
    }
  };

  const updateNotes = async (id, notes, currentReviewed) => {
    try {
      setReports(prev => prev.map(r => r.id === id ? { ...r, notes } : r));
      await fetch(`${getApiBaseUrl()}/admin/audio-reports/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ reviewed: currentReviewed, notes })
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleting(true);
    try {
      setReports(prev => prev.filter(r => r.id !== id));
      setDeleteTarget(null);
      await fetch(`${getApiBaseUrl()}/admin/audio-reports/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
    } catch (err) {
      console.error(err);
      fetchReports(false);
    } finally {
      setDeleting(false);
    }
  };

  const playUrl = (id) => `${getApiBaseUrl()}/admin/audio-reports/${id}/play?token=${encodeURIComponent(session?.access_token || '')}`;

  const formatDuration = (seconds) => {
    if (seconds === null || seconds === undefined || seconds === '') return 'Voice Memo';
    const s = parseInt(seconds, 10);
    if (isNaN(s)) return 'Voice Memo';
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h2 style={{ margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Volume2 size={24} style={{ color: 'var(--accent-primary)' }} />
            Warehouse Audio Reports
          </h2>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Listen to voice memos sent by employees directly from the warehouse floor.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            style={filter === 'all' ? styles.btnActive : styles.btn}
            onClick={() => setFilter('all')}
          >
            All ({reports.length})
          </button>
          <button
            style={filter === 'unreviewed' ? styles.btnActive : styles.btn}
            onClick={() => setFilter('unreviewed')}
          >
            Unreviewed
          </button>
          <button
            style={styles.btn}
            onClick={() => fetchReports(true)}
            title="Refresh reports"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ margin: '0 auto 12px' }} />
          Loading audio reports...
        </div>
      ) : reports.length === 0 ? (
        <div style={styles.emptyCard}>
          <Volume2 size={36} style={{ color: 'var(--text-muted)', marginBottom: '10px', opacity: 0.6 }} />
          <div style={{ fontSize: '1rem', fontWeight: 600 }}>No audio reports found</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            When employees record voice memos in their panel, they will show up here.
          </div>
        </div>
      ) : (
        <div style={styles.grid}>
          {reports.map(r => (
            <div key={r.id} style={{ ...styles.card, ...(r.reviewed ? styles.cardReviewed : {}) }}>
              <div style={styles.cardHeader}>
                <div>
                  <div style={styles.employeeName}>👷 {r.employee_name}</div>
                  <div style={styles.timestamp}>
                    {new Date(r.created_at).toLocaleString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
                <div style={styles.badgeRow}>
                  {r.duration_seconds !== null && (
                    <span style={styles.durationBadge}>
                      <Clock size={12} style={{ marginRight: '4px' }} />
                      {formatDuration(r.duration_seconds)}
                    </span>
                  )}
                  <span style={r.reviewed ? styles.statusBadgeReviewed : styles.statusBadgePending}>
                    {r.reviewed ? 'Reviewed' : 'Pending'}
                  </span>
                </div>
              </div>

              <div style={styles.audioWrapper}>
                <audio
                  controls
                  preload="metadata"
                  src={playUrl(r.id)}
                  style={styles.audioElement}
                >
                  Your browser does not support the audio element.
                </audio>
              </div>

              <div style={styles.notesArea}>
                <textarea
                  style={styles.notesInput}
                  placeholder="Add admin notes or transcription summary..."
                  defaultValue={r.notes || ''}
                  onBlur={(e) => updateNotes(r.id, e.target.value, r.reviewed)}
                />
              </div>

              <div style={styles.actions}>
                <button
                  style={{
                    ...styles.actionBtn,
                    ...(r.reviewed ? styles.reviewedBtn : styles.unreviewedBtn)
                  }}
                  onClick={() => markReviewed(r.id, r.reviewed, r.notes)}
                >
                  <CheckCircle2 size={14} style={{ marginRight: '6px' }} />
                  {r.reviewed ? 'Marked Reviewed' : 'Mark Reviewed'}
                </button>
                <button
                  style={styles.deleteBtn}
                  onClick={() => setDeleteTarget(r)}
                  disabled={deleting}
                  title="Delete voice memo"
                >
                  <Trash2 size={14} style={{ marginRight: '4px' }} />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Themed Confirmation Dialog (does not glitch or auto-close under React StrictMode) */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Voice Report"
        message={`Are you sure you want to delete the audio report recorded by ${deleteTarget?.employee_name || 'employee'} on ${deleteTarget ? new Date(deleteTarget.created_at).toLocaleDateString() : ''}? This audio file will be permanently removed.`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

const styles = {
  container: {
    padding: '20px 0',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    flexWrap: 'wrap',
    gap: '12px',
  },
  btn: {
    padding: '8px 14px',
    borderRadius: 'var(--radius-sm, 8px)',
    border: '1px solid var(--border-medium, rgba(255,255,255,0.1))',
    background: 'var(--bg-card, #1e293b)',
    color: 'var(--text-primary, #fff)',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all 0.15s',
  },
  btnActive: {
    padding: '8px 14px',
    borderRadius: 'var(--radius-sm, 8px)',
    border: 'none',
    background: 'var(--accent-primary, #6c63ff)',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    boxShadow: '0 2px 8px var(--accent-primary-glow, rgba(108,99,255,0.3))',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '16px',
  },
  card: {
    border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
    borderRadius: 'var(--radius-md, 12px)',
    padding: '16px',
    background: 'var(--bg-card, #1e293b)',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    transition: 'transform 0.15s, border-color 0.15s',
  },
  cardReviewed: {
    opacity: 0.9,
    borderLeft: '4px solid #10b981',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '12px',
    gap: '8px',
  },
  employeeName: {
    fontWeight: 600,
    fontSize: '0.92rem',
    color: 'var(--text-primary, #fff)',
  },
  timestamp: {
    fontSize: '0.75rem',
    color: 'var(--text-muted, #94a3b8)',
    marginTop: '2px',
  },
  badgeRow: {
    display: 'flex',
    gap: '6px',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  durationBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: '0.72rem',
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: '12px',
    background: 'rgba(108, 99, 255, 0.15)',
    color: 'var(--accent-primary, #818cf8)',
  },
  statusBadgePending: {
    fontSize: '0.72rem',
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: '12px',
    background: 'rgba(245, 158, 11, 0.15)',
    color: '#fbbf24',
  },
  statusBadgeReviewed: {
    fontSize: '0.72rem',
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: '12px',
    background: 'rgba(16, 185, 129, 0.15)',
    color: '#34d399',
  },
  audioWrapper: {
    margin: '8px 0 12px',
    background: 'rgba(0, 0, 0, 0.2)',
    borderRadius: '8px',
    padding: '6px',
  },
  audioElement: {
    width: '100%',
    height: '36px',
    display: 'block',
    outline: 'none',
  },
  notesArea: {
    marginBottom: '12px',
    flex: 1,
  },
  notesInput: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '8px 10px',
    borderRadius: 'var(--radius-sm, 6px)',
    border: '1px solid var(--border-medium, rgba(255,255,255,0.12))',
    background: 'var(--bg-secondary, #0f172a)',
    color: 'var(--text-primary, #fff)',
    fontSize: '0.82rem',
    resize: 'vertical',
    minHeight: '56px',
    fontFamily: 'inherit',
    lineHeight: 1.4,
  },
  actions: {
    display: 'flex',
    gap: '8px',
  },
  actionBtn: {
    flex: 2,
    padding: '7px 12px',
    borderRadius: 'var(--radius-sm, 6px)',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s',
  },
  reviewedBtn: {
    background: 'rgba(16, 185, 129, 0.15)',
    color: '#34d399',
    border: '1px solid rgba(16, 185, 129, 0.3)',
  },
  unreviewedBtn: {
    background: 'rgba(255, 255, 255, 0.05)',
    color: 'var(--text-primary, #fff)',
    border: '1px solid var(--border-medium, rgba(255,255,255,0.15))',
  },
  deleteBtn: {
    flex: 1,
    padding: '7px 10px',
    borderRadius: 'var(--radius-sm, 6px)',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 600,
    background: 'rgba(239, 68, 68, 0.15)',
    color: '#f87171',
    border: '1px solid rgba(239, 68, 68, 0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s',
  },
  emptyCard: {
    padding: '48px 24px',
    textAlign: 'center',
    background: 'var(--bg-card, #1e293b)',
    borderRadius: 'var(--radius-md, 12px)',
    border: '1px dashed var(--border-medium, rgba(255,255,255,0.15))',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  }
};
