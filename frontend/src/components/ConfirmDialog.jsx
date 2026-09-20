// frontend/src/components/ConfirmDialog.jsx
// Themed confirmation dialog — replaces native confirm() which breaks under StrictMode

import { AlertTriangle, X } from 'lucide-react';

export default function ConfirmDialog({ open, title, message, onConfirm, onCancel }) {
  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
        <div className="modal-header">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle size={20} style={{ color: 'var(--accent-danger)' }} />
            {title || 'Confirm Action'}
          </h2>
          <button className="btn btn-secondary btn-icon" onClick={onCancel}>
            <X size={18} />
          </button>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6 }}>
          {message || 'Are you sure? This action cannot be undone.'}
        </p>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button className="btn btn-danger" onClick={onConfirm} style={{
            background: 'var(--accent-danger)',
            color: 'white',
            border: 'none',
          }}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
