// frontend/src/pages/Customers.jsx
// Customer CRUD with purchase history and outstanding dues view

import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Edit2, Trash2, X, Eye, DollarSign, DownloadCloud } from 'lucide-react';
import client from '../api/client';
import ConfirmDialog from '../components/ConfirmDialog';
import { exportToCSV } from '../utils/csvExport';

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detailModal, setDetailModal] = useState(null);
  const [purchases, setPurchases] = useState([]);
  const [dues, setDues] = useState(null);
  const [toast, setToast] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [form, setForm] = useState({
    name: '', company_name: '', phone: '', email: '', address: '', gst_number: '',
  });

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchCustomers = async () => {
    try {
      const res = await client.get('/customers', { params: { search } });
      setCustomers(res.data || []);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCustomers(); }, [search]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', company_name: '', phone: '', email: '', address: '', gst_number: '' });
    setShowModal(true);
  };

  const openEdit = (c) => {
    setEditing(c);
    setForm({
      name: c.name, company_name: c.company_name || '', phone: c.phone || '',
      email: c.email || '', address: c.address || '', gst_number: c.gst_number || '',
    });
    setShowModal(true);
  };

  const viewDetails = async (c) => {
    setDetailModal(c);
    try {
      const [purchRes, duesRes] = await Promise.all([
        client.get(`/customers/${c.id}/purchases`),
        client.get(`/customers/${c.id}/dues`),
      ]);
      setPurchases(purchRes.data || []);
      setDues(duesRes.data);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await client.put(`/customers/${editing.id}`, form);
        showToast('Customer updated');
      } else {
        await client.post('/customers', form);
        showToast('Customer added');
      }
      setShowModal(false);
      fetchCustomers();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await client.delete(`/customers/${deleteTarget}`);
      showToast('Customer deleted');
      fetchCustomers();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleExport = () => {
    const columns = [
      { key: 'name', label: 'Customer Name' },
      { key: 'company_name', label: 'Company Name' },
      { key: 'phone', label: 'Phone' },
      { key: 'email', label: 'Email' },
      { key: 'gst_number', label: 'GST Number' },
      { key: 'address', label: 'Address' }
    ];
    exportToCSV(customers, 'customers_export.csv', columns);
  };

  if (loading) {
    return <div className="loading-container"><div className="spinner" /></div>;
  }

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1>Customers</h1>
                  <p>Manage your customer directory</p>
        </div>
      </div>

      <div className="toolbar">
        <div className="search-wrapper">
          <Search />
          <input className="search-input" placeholder="Search customers..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button className="btn btn-secondary" onClick={handleExport} disabled={customers.length === 0}>
          <DownloadCloud size={16} /> Export
        </button>
        <button className="btn btn-primary" onClick={openCreate}><Plus size={16} /> Add Customer</button>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr><th>Name</th><th>Company</th><th>Phone</th><th>Email</th><th>GST</th><th className="text-right">Actions</th></tr>
            </thead>
            <tbody>
              {customers.length === 0 ? (
                <tr><td colSpan={6} className="text-center text-muted" style={{ padding: '40px' }}>No customers found</td></tr>
              ) : customers.map(c => (
                <tr key={c.id}>
                  <td data-label="Name"><strong>{c.name}</strong></td>
                  <td data-label="Company" className="text-muted">{c.company_name || '—'}</td>
                  <td data-label="Phone">{c.phone || '—'}</td>
                  <td data-label="Email">{c.email || '—'}</td>
                  <td data-label="GST" className="text-muted" style={{ fontSize: '0.82rem' }}>{c.gst_number || '—'}</td>
                  <td data-label="Actions" className="text-right">
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => viewDetails(c)}><Eye size={14} /> View</button>
                      <button className="btn btn-secondary btn-icon btn-sm" onClick={() => openEdit(c)}><Edit2 size={14} /></button>
                      <button className="btn btn-danger btn-icon btn-sm" onClick={() => setDeleteTarget(c.id)}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editing ? 'Edit Customer' : 'Add Customer'}</h2>
              <button className="btn btn-secondary btn-icon" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Name *</label>
                  <input className="form-control" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Company Name</label>
                  <input className="form-control" value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Phone</label>
                  <input className="form-control" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input className="form-control" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label>Address</label>
                <textarea className="form-control" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
              </div>
              <div className="form-group">
                <label>GST Number</label>
                <input className="form-control" value={form.gst_number} onChange={e => setForm({ ...form, gst_number: e.target.value })} />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editing ? 'Save Changes' : 'Add Customer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail View Modal */}
      {detailModal && (
        <div className="modal-overlay" onClick={() => { setDetailModal(null); setPurchases([]); setDues(null); }}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{detailModal.name}</h2>
              <button className="btn btn-secondary btn-icon" onClick={() => { setDetailModal(null); setPurchases([]); setDues(null); }}><X size={18} /></button>
            </div>

            {/* Customer Info */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', marginBottom: '20px', fontSize: '0.9rem' }}>
              {detailModal.company_name && <div><span className="text-muted">Company:</span> {detailModal.company_name}</div>}
              {detailModal.phone && <div><span className="text-muted">Phone:</span> {detailModal.phone}</div>}
              {detailModal.email && <div><span className="text-muted">Email:</span> {detailModal.email}</div>}
              {detailModal.gst_number && <div><span className="text-muted">GST:</span> {detailModal.gst_number}</div>}
              {detailModal.address && <div style={{ gridColumn: '1 / -1' }}><span className="text-muted">Address:</span> {detailModal.address}</div>}
            </div>

            {/* Outstanding Dues */}
            {dues && (
              <div style={{
                padding: '14px 18px', borderRadius: 'var(--radius-md)', marginBottom: '16px',
                background: dues.total_outstanding > 0 ? 'rgba(255,107,107,0.1)' : 'rgba(0,212,170,0.1)',
                border: `1px solid ${dues.total_outstanding > 0 ? 'rgba(255,107,107,0.2)' : 'rgba(0,212,170,0.2)'}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <DollarSign size={18} />
                  <span style={{ fontWeight: 600 }}>Outstanding: ₹{dues.total_outstanding.toLocaleString('en-IN')}</span>
                  {dues.unpaid_invoices?.length > 0 && (
                    <span className="text-muted">({dues.unpaid_invoices.length} unpaid invoice{dues.unpaid_invoices.length > 1 ? 's' : ''})</span>
                  )}
                </div>
              </div>
            )}

            {/* Purchase History */}
            <h3 style={{ fontSize: '1rem', marginBottom: '10px' }}>Purchase History</h3>
            {purchases.length === 0 ? (
              <div className="empty-state"><p>No purchase history</p></div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr><th>Invoice #</th><th>Date</th><th>Items Purchased</th><th>Status</th><th className="text-right">Total (₹)</th></tr>
                  </thead>
                  <tbody>
                    {purchases.map(inv => (
                      <tr key={inv.id}>
                        <td data-label="Invoice #">{inv.invoice_number}</td>
                        <td data-label="Date">{inv.invoice_date}</td>
                        <td data-label="Items Purchased" style={{ maxWidth: '250px' }}>
                          {inv.invoice_items && inv.invoice_items.length > 0 ? (
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                              {inv.invoice_items.map((item, idx) => (
                                <span key={idx} style={{ background: 'var(--surface)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                                  {item.products?.name} ({item.qty})
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted" style={{ fontSize: '0.85rem' }}>No items</span>
                          )}
                        </td>
                        <td data-label="Status"><span className={`badge badge-${inv.status}`}>{inv.status === 'confirmed' ? 'Unpaid (Pending)' : inv.status}</span></td>
                        <td data-label="Total (₹)" className="text-right">₹{parseFloat(inv.total || 0).toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Customer"
        message="This will permanently delete this customer. Any associated invoices will remain. Continue?"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
