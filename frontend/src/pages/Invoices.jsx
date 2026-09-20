// frontend/src/pages/Invoices.jsx
// Invoice creation, confirmation, viewing, PDF download — NO payment collection
// Payments are handled in the A/R Ledger page

import { useState, useEffect } from 'react';
import { Plus, Eye, Download, X, CheckCircle, XCircle, DollarSign, DownloadCloud } from 'lucide-react';
import client from '../api/client';
import InvoiceForm from '../components/InvoiceForm';
import InvoicePrint from '../components/InvoicePrint';
import VoiceBilling from '../components/VoiceBilling';
import ConfirmDialog from '../components/ConfirmDialog';
import { exportToCSV } from '../utils/csvExport';

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [viewInvoice, setViewInvoice] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchInvoices = async () => {
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      const res = await client.get('/invoices', { params });
      setInvoices(res.data || []);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInvoices(); }, [statusFilter]);

  const handleCreate = async (payload) => {
    try {
      await client.post('/invoices', payload);
      showToast('Invoice created');
      setShowCreateModal(false);
      setShowVoiceModal(false);
      fetchInvoices();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleViewInvoice = async (id) => {
    try {
      const res = await client.get(`/invoices/${id}`);
      setViewInvoice(res.data);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleConfirm = async (invoiceId) => {
    try {
      await client.put(`/invoices/${invoiceId}/status`, { status: 'confirmed' });
      showToast('Invoice confirmed');
      fetchInvoices();
    } catch (err) {
      showToast(err.response?.data?.error || err.message, 'error');
    }
  };

  const handleConfirmAndPaid = async (invoiceId) => {
    try {
      // Step 1: Confirm the draft
      await client.put(`/invoices/${invoiceId}/status`, { status: 'confirmed' });
      // Step 2: Immediately mark as fully paid
      await client.put(`/invoices/${invoiceId}/status`, { status: 'paid' });
      showToast('Invoice confirmed & paid');
      fetchInvoices();
    } catch (err) {
      showToast(err.response?.data?.error || err.message, 'error');
      fetchInvoices(); // Refresh in case step 1 succeeded but step 2 failed
    }
  };

  const handleCancel = async (invoiceId) => {
    try {
      await client.put(`/invoices/${invoiceId}/status`, { status: 'cancelled' });
      showToast('Invoice cancelled');
      fetchInvoices();
    } catch (err) {
      showToast(err.response?.data?.error || err.message, 'error');
    }
  };

  const downloadPdf = async (invoiceId, invoiceNumber) => {
    try {
      const res = await client.get(`/invoices/${invoiceId}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${invoiceNumber}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showToast('PDF downloaded');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleExport = () => {
    const columns = [
      { key: 'invoice_number', label: 'Invoice #' },
      { key: 'customers', label: 'Customer', formatter: (v) => v?.name || '' },
      { key: 'invoice_date', label: 'Date' },
      { key: 'status', label: 'Status' },
      { key: 'total', label: 'Total (₹)' },
      { key: 'amount_paid', label: 'Paid (₹)' }
    ];
    exportToCSV(invoices, 'invoices_export.csv', columns);
  };

  const statusLabel = (status) => {
    switch (status) {
      case 'confirmed': return 'Unpaid';
      case 'partial': return 'Partially Paid';
      default: return status;
    }
  };

  if (loading) {
    return <div className="loading-container"><div className="spinner" /></div>;
  }

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1>Sales & Billing</h1>
                  <p>Create and manage invoices. To collect payments, use the <strong>A/R Ledger</strong>.</p>
        </div>
      </div>

      <div className="toolbar">
        <select className="form-control" style={{ width: 'auto', minWidth: '150px' }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="confirmed">Confirmed (Unpaid)</option>
          <option value="paid">Paid</option>
          <option value="partial">Partially Paid</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <div style={{ flex: 1 }} />
        <button className="btn btn-secondary" onClick={handleExport} disabled={invoices.length === 0}>
          <DownloadCloud size={16} /> Export CSV
        </button>
        <button className="btn btn-secondary" onClick={() => setShowVoiceModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          🎤 Voice Sales Entry
        </button>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          <Plus size={16} /> New Invoice
        </button>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Status</th>
                <th className="text-right">Total (₹)</th>
                <th className="text-right">Paid (₹)</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr><td colSpan={7} className="text-center text-muted" style={{ padding: '40px' }}>No invoices found</td></tr>
              ) : invoices.map((inv) => {
                const total = parseFloat(inv.total || 0);
                const paid = parseFloat(inv.amount_paid || 0);
                return (
                  <tr key={inv.id}>
                    <td data-label="Invoice #"><strong>{inv.invoice_number}</strong></td>
                    <td data-label="Customer">{inv.customers?.name || '—'}{inv.customers?.company_name ? ` (${inv.customers.company_name})` : ''}</td>
                    <td data-label="Date">{inv.invoice_date}</td>
                    <td data-label="Status"><span className={`badge badge-${inv.status}`}>{statusLabel(inv.status)}</span></td>
                    <td data-label="Total (₹)" className="text-right">₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td data-label="Paid (₹)" className="text-right">₹{paid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td data-label="Actions" className="text-right">
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button className="btn btn-secondary btn-icon btn-sm" onClick={() => handleViewInvoice(inv.id)} title="View"><Eye size={14} /></button>
                        <button className="btn btn-secondary btn-icon btn-sm" onClick={() => downloadPdf(inv.id, inv.invoice_number)} title="Download PDF"><Download size={14} /></button>
                        {inv.status === 'draft' && (
                          <>
                            <button className="btn btn-success btn-sm" onClick={() => setConfirmAction({ type: 'confirm', inv })} title="Confirm (Pay Later)">
                              <CheckCircle size={14} /> Confirm
                            </button>
                            <button className="btn btn-primary btn-sm" onClick={() => setConfirmAction({ type: 'confirm_paid', inv })} title="Confirm & Mark Paid">
                              <DollarSign size={14} /> Confirm & Paid
                            </button>
                            <button className="btn btn-danger btn-sm" onClick={() => setConfirmAction({ type: 'cancel', inv })} title="Cancel Invoice">
                              <XCircle size={14} /> Cancel
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Invoice Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>New Invoice</h2>
              <button className="btn btn-secondary btn-icon" onClick={() => setShowCreateModal(false)}><X size={18} /></button>
            </div>
            <InvoiceForm onSave={handleCreate} onCancel={() => setShowCreateModal(false)} />
          </div>
        </div>
      )}

      {/* Voice Billing Modal */}
      {showVoiceModal && (
        <div className="modal-overlay" onClick={() => setShowVoiceModal(false)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🎤 Voice Sales Entry</h2>
              <button className="btn btn-secondary btn-icon" onClick={() => setShowVoiceModal(false)}><X size={18} /></button>
            </div>
            <VoiceBilling onSave={handleCreate} onCancel={() => setShowVoiceModal(false)} />
          </div>
        </div>
      )}

      {/* View Invoice Modal */}
      {viewInvoice && (
        <div className="modal-overlay" onClick={() => setViewInvoice(null)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '850px' }}>
            <div className="modal-header">
              <h2>Invoice Preview</h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => window.print()}>🖨 Print</button>
                <button className="btn btn-secondary btn-sm" onClick={() => downloadPdf(viewInvoice.id, viewInvoice.invoice_number)}>
                  <Download size={14} /> PDF
                </button>
                <button className="btn btn-secondary btn-icon" onClick={() => setViewInvoice(null)}><X size={18} /></button>
              </div>
            </div>
            <InvoicePrint invoice={viewInvoice} />
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction?.type === 'cancel' ? 'Cancel Invoice' : confirmAction?.type === 'confirm_paid' ? 'Confirm & Pay Invoice' : 'Confirm Invoice'}
        message={confirmAction?.type === 'cancel'
          ? 'Are you sure you want to cancel this invoice? This action cannot be undone.'
          : confirmAction?.type === 'confirm_paid'
          ? 'This will confirm the invoice and immediately mark it as fully paid. Continue?'
          : 'Are you sure you want to confirm this invoice? This action cannot be undone.'
        }
        onConfirm={() => {
          if (confirmAction?.type === 'confirm') {
            handleConfirm(confirmAction.inv.id);
          } else if (confirmAction?.type === 'confirm_paid') {
            handleConfirmAndPaid(confirmAction.inv.id);
          } else if (confirmAction?.type === 'cancel') {
            handleCancel(confirmAction.inv.id);
          }
          setConfirmAction(null);
        }}
        onCancel={() => setConfirmAction(null)}
      />

      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
