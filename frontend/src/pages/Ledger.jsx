// frontend/src/pages/Ledger.jsx
// Accounts Receivable — Customer-centric payment collection hub
// Expandable rows showing unpaid invoices with inline payment actions

import { useState, useEffect } from 'react';
import { DollarSign, AlertCircle, ArrowUpDown, DownloadCloud, ChevronDown, ChevronRight, X } from 'lucide-react';
import client from '../api/client';
import { exportToCSV } from '../utils/csvExport';

export default function Ledger() {
  const [ledgers, setLedgers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState({ key: 'total_due', direction: 'desc' });
  const [expandedCustomer, setExpandedCustomer] = useState(null);
  const [paymentModal, setPaymentModal] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchLedgers = async () => {
    try {
      const res = await client.get('/customers/ledger');
      const data = (res.data || []).filter(c => c.total_due > 0);
      setLedgers(data);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLedgers(); }, []);

  const handleSort = (key) => {
    let direction = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  const sortedLedgers = [...ledgers].sort((a, b) => {
    if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
    if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const totalAR = ledgers.reduce((sum, item) => sum + item.total_due, 0);

  const handleExport = () => {
    const rows = [];
    sortedLedgers.forEach(cust => {
      (cust.unpaid_invoices || []).forEach(inv => {
        rows.push({
          customer: cust.name,
          company: cust.company_name,
          invoice_number: inv.invoice_number,
          invoice_date: inv.invoice_date,
          total: inv.total,
          paid: inv.paid,
          balance: inv.balance,
        });
      });
    });
    const columns = [
      { key: 'customer', label: 'Customer' },
      { key: 'company', label: 'Company' },
      { key: 'invoice_number', label: 'Invoice #' },
      { key: 'invoice_date', label: 'Date' },
      { key: 'total', label: 'Total (₹)' },
      { key: 'paid', label: 'Paid (₹)' },
      { key: 'balance', label: 'Balance (₹)' },
    ];
    exportToCSV(rows, 'accounts_receivable.csv', columns);
  };

  const toggleExpand = (customerId) => {
    setExpandedCustomer(expandedCustomer === customerId ? null : customerId);
  };

  const handlePayment = async (invoiceId, newStatus) => {
    try {
      const payload = { status: newStatus };
      if (newStatus === 'partial') {
        payload.amount_paid = parseFloat(paymentAmount) || 0;
      }
      await client.put(`/invoices/${invoiceId}/status`, payload);
      showToast(newStatus === 'paid' ? 'Invoice marked as paid' : 'Partial payment recorded');
      setPaymentModal(null);
      setPaymentAmount('');
      fetchLedgers();
    } catch (err) {
      showToast(err.response?.data?.error || err.message, 'error');
    }
  };

  const daysOverdue = (dateStr) => {
    if (!dateStr) return 0;
    return Math.floor((new Date() - new Date(dateStr)) / (1000 * 60 * 60 * 24));
  };

  if (loading) {
    return <div className="loading-container"><div className="spinner" /></div>;
  }

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1>Accounts Receivable</h1>
                  <p>Collect payments from customers. Click a row to see their unpaid invoices.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '16px', borderLeft: '4px solid var(--accent-primary)' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(108, 99, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)' }}>
            <DollarSign size={24} />
          </div>
          <div>
            <p className="text-muted" style={{ margin: '0 0 4px 0', fontSize: '0.9rem' }}>Total Outstanding</p>
            <h2 style={{ margin: 0, fontSize: '1.8rem' }}>₹{totalAR.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h2>
          </div>
        </div>

        <div className="card" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '16px', borderLeft: '4px solid var(--danger)' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(255, 107, 107, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--danger)' }}>
            <AlertCircle size={24} />
          </div>
          <div>
            <p className="text-muted" style={{ margin: '0 0 4px 0', fontSize: '0.9rem' }}>Customers with Dues</p>
            <h2 style={{ margin: 0, fontSize: '1.8rem' }}>{ledgers.length}</h2>
          </div>
        </div>
      </div>

      <div className="toolbar">
        <div style={{ flex: 1 }} />
        <button className="btn btn-secondary" onClick={handleExport} disabled={ledgers.length === 0}>
          <DownloadCloud size={16} /> Export Report
        </button>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th style={{ width: '30px' }}></th>
                <th onClick={() => handleSort('name')} style={{ cursor: 'pointer' }}>
                  Customer <ArrowUpDown size={12} style={{ marginLeft: '4px' }} />
                </th>
                <th>Company</th>
                <th onClick={() => handleSort('oldest_unpaid_date')} style={{ cursor: 'pointer' }}>
                  Oldest Pending <ArrowUpDown size={12} style={{ marginLeft: '4px' }} />
                </th>
                <th className="text-center" onClick={() => handleSort('unpaid_invoices_count')} style={{ cursor: 'pointer' }}>
                  Invoices <ArrowUpDown size={12} style={{ marginLeft: '4px' }} />
                </th>
                <th className="text-right" onClick={() => handleSort('total_due')} style={{ cursor: 'pointer' }}>
                  Total Due (₹) <ArrowUpDown size={12} style={{ marginLeft: '4px' }} />
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedLedgers.length === 0 ? (
                <tr><td colSpan={6} className="text-center text-muted" style={{ padding: '40px' }}>🎉 No outstanding dues — all clear!</td></tr>
              ) : sortedLedgers.map((item) => {
                const isExpanded = expandedCustomer === item.customer_id;
                const days = daysOverdue(item.oldest_unpaid_date);
                return (
                  <>
                    <tr 
                      key={item.customer_id} 
                      onClick={() => toggleExpand(item.customer_id)}
                      style={{ cursor: 'pointer', transition: 'background 0.15s' }}
                      className="hover-row"
                    >
                      <td data-label="" style={{ width: '30px', paddingRight: '0' }}>
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </td>
                      <td data-label="handleSort('name')} style={{ cursor: 'pointer' }}>
                  Customer"><strong>{item.name}</strong></td>
                      <td data-label="Company" className="text-muted">{item.company_name || '—'}</td>
                      <td data-label="handleSort('oldest_unpaid_date')} style={{ cursor: 'pointer' }}>
                  Oldest Pending">
                        <span style={{ 
                          color: days > 30 ? 'var(--danger)' : 'inherit',
                          fontWeight: days > 30 ? '600' : 'normal'
                        }}>
                          {item.oldest_unpaid_date}
                          {days > 30 && <span style={{ fontSize: '0.75rem', marginLeft: '6px' }}>({days}d overdue)</span>}
                        </span>
                      </td>
                      <td data-label="handleSort('unpaid_invoices_count')} style={{ cursor: 'pointer' }}>
                  Invoices" className="text-center">
                        <span className="badge badge-partial" style={{ padding: '4px 8px' }}>{item.unpaid_invoices_count}</span>
                      </td>
                      <td data-label="handleSort('total_due')} style={{ cursor: 'pointer' }}>
                  Total Due (₹)" className="text-right">
                        <strong style={{ color: 'var(--danger)' }}>₹{item.total_due.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                      </td>
                    </tr>
                    {isExpanded && (item.unpaid_invoices || []).map((inv) => (
                      <tr key={inv.id} style={{ background: 'var(--bg-tertiary)' }}>
                        <td data-label=""></td>
                        <td data-label="handleSort('name')} style={{ cursor: 'pointer' }}>
                  Customer" style={{ paddingLeft: '28px', fontSize: '0.88rem' }}>
                          <span className="text-muted">↳</span> {inv.invoice_number}
                        </td>
                        <td data-label="Company" className="text-muted" style={{ fontSize: '0.85rem' }}>{inv.invoice_date}</td>
                        <td data-label="handleSort('oldest_unpaid_date')} style={{ cursor: 'pointer' }}>
                  Oldest Pending" style={{ fontSize: '0.85rem' }}>
                          <span className={`badge badge-${inv.status}`} style={{ fontSize: '0.75rem' }}>
                            {inv.status === 'confirmed' ? 'Unpaid' : 'Partial'}
                          </span>
                          {inv.paid > 0 && (
                            <span className="text-muted" style={{ fontSize: '0.78rem', marginLeft: '6px' }}>
                              (₹{inv.paid.toLocaleString('en-IN')} paid)
                            </span>
                          )}
                        </td>
                        <td data-label="handleSort('unpaid_invoices_count')} style={{ cursor: 'pointer' }}>
                  Invoices" className="text-center" style={{ fontSize: '0.85rem' }}>
                          ₹{inv.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td data-label="handleSort('total_due')} style={{ cursor: 'pointer' }}>
                  Total Due (₹)" className="text-right">
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                            <strong style={{ color: 'var(--danger)', fontSize: '0.9rem' }}>
                              ₹{inv.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </strong>
                            <button 
                              className="btn btn-success btn-sm" 
                              onClick={(e) => { e.stopPropagation(); setPaymentModal(inv); setPaymentAmount(''); }}
                              style={{ fontSize: '0.78rem', padding: '4px 10px' }}
                            >
                              <DollarSign size={13} /> Pay
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Modal */}
      {paymentModal && (
        <div className="modal-overlay" onClick={() => { setPaymentModal(null); setPaymentAmount(''); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h2>Record Payment</h2>
              <button className="btn btn-secondary btn-icon" onClick={() => { setPaymentModal(null); setPaymentAmount(''); }}><X size={18} /></button>
            </div>
            <div style={{ padding: '0 0 16px 0' }}>
              <p className="text-muted" style={{ margin: '0 0 8px 0' }}>
                Invoice: <strong>{paymentModal.invoice_number}</strong>
              </p>
              <div style={{ 
                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px',
                padding: '14px', borderRadius: 'var(--radius-md)', 
                background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)',
                marginBottom: '16px', fontSize: '0.88rem', textAlign: 'center'
              }}>
                <div>
                  <div className="text-muted" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>Total</div>
                  <strong>₹{paymentModal.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                </div>
                <div>
                  <div className="text-muted" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>Already Paid</div>
                  <strong>₹{paymentModal.paid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                </div>
                <div>
                  <div className="text-muted" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>Remaining</div>
                  <strong style={{ color: 'var(--danger)' }}>₹{paymentModal.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Amount Received (₹)</label>
                <input 
                  className="form-control" type="number" step="0.01" min="0.01"
                  value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder={`Up to ₹${paymentModal.balance.toFixed(2)}`} autoFocus 
                />
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-secondary" 
                onClick={() => handlePayment(paymentModal.id, 'partial')}
                disabled={!paymentAmount || parseFloat(paymentAmount) <= 0}
              >
                Partial Payment
              </button>
              <button className="btn btn-primary" onClick={() => handlePayment(paymentModal.id, 'paid')}>
                Mark Fully Paid
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

      <style>{`
        .hover-row:hover {
          background: var(--bg-glass-hover) !important;
        }
      `}</style>
    </div>
  );
}
