// frontend/src/pages/RawMaterials.jsx
// Full CRUD for raw materials with search, filter, price history modal

import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Edit2, Trash2, History, X, Upload, FileSpreadsheet, Download, DownloadCloud } from 'lucide-react';
import client, { getApiBaseUrl } from '../api/client';
import ConfirmDialog from '../components/ConfirmDialog';
import { exportToCSV } from '../utils/csvExport';
import { UNITS, convertQty, canConvert } from '../utils/unitConversion';

export default function RawMaterials() {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [priceHistory, setPriceHistory] = useState(null);
  const [toast, setToast] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const [form, setForm] = useState({
    name: '', description: '', unit: 'kg', price_per_unit: '',
    stock_qty: '', low_stock_threshold: '', supplier_name: '',
  });

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchMaterials = useCallback(async () => {
    try {
      const params = {};
      if (search) params.search = search;
      if (unitFilter) params.unit = unitFilter;
      const res = await client.get('/raw-materials', { params });
      setMaterials(res.data || []);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [search, unitFilter]);

  useEffect(() => { fetchMaterials(); }, [fetchMaterials]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', description: '', unit: 'kg', price_per_unit: '', stock_qty: '', low_stock_threshold: '', supplier_name: '' });
    setShowModal(true);
  };

  const openEdit = (m) => {
    setEditing(m);
    setForm({
      name: m.name, description: m.description || '', unit: m.unit,
      price_per_unit: m.price_per_unit, stock_qty: m.stock_qty,
      low_stock_threshold: m.low_stock_threshold, supplier_name: m.supplier_name || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        price_per_unit: parseFloat(form.price_per_unit),
        stock_qty: parseFloat(form.stock_qty || 0),
        low_stock_threshold: parseFloat(form.low_stock_threshold || 0),
      };

      // If unit changed while editing, apply auto-conversion to stock values
      if (editing && form.unit !== editing.unit) {
        const convertedStock = convertQty(editing.stock_qty, editing.unit, form.unit);
        const convertedThreshold = convertQty(editing.low_stock_threshold, editing.unit, form.unit);
        if (convertedStock !== null) payload.stock_qty = convertedStock;
        if (convertedThreshold !== null) payload.low_stock_threshold = convertedThreshold;
      }

      if (editing) {
        await client.put(`/raw-materials/${editing.id}`, payload);
        showToast('Material updated');
      } else {
        await client.post('/raw-materials', payload);
        showToast('Material created');
      }
      setShowModal(false);
      fetchMaterials();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await client.delete(`/raw-materials/${deleteTarget}`);
      showToast('Material deleted');
      fetchMaterials();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setDeleteTarget(null);
    }
  };

  const viewPriceHistory = async (m) => {
    try {
      const res = await client.get(`/raw-materials/${m.id}/price-history`);
      setPriceHistory({ name: m.name, history: res.data || [] });
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleCsvImport = async () => {
    if (!csvFile) return;
    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append('file', csvFile);
      const res = await fetch(
        `${getApiBaseUrl()}/raw-materials/import-csv`,
        { method: 'POST', body: formData }
      );
      const json = await res.json();
      if (json.error) {
        setImportResult({ success: false, message: json.error });
      } else {
        setImportResult({
          success: true,
          imported: json.data.imported,
          skipped: json.data.skipped,
          errors: json.data.errors || [],
        });
        if (json.data.imported > 0) {
          showToast(`Imported ${json.data.imported} materials`);
          fetchMaterials();
        }
      }
    } catch (err) {
      setImportResult({ success: false, message: err.message });
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const header = 'name,unit,price_per_unit,description,stock_qty,low_stock_threshold,supplier_name';
    const example = 'Vanillin,kg,1200,Vanilla flavour compound,50,10,Supplier Co';
    // Add UTF-8 BOM so Excel opens it correctly, and set appropriate mime type
    const blob = new Blob(['\uFEFF' + header + '\n' + example + '\n'], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'raw_materials_template.csv';
    // Must append to body for Firefox/some browsers to trigger click
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExport = () => {
    const columns = [
      { key: 'name', label: 'Name' },
      { key: 'unit', label: 'Unit' },
      { key: 'price_per_unit', label: 'Price/Unit (₹)' },
      { key: 'stock_qty', label: 'Stock Quantity' },
      { key: 'supplier_name', label: 'Supplier' },
      { key: 'description', label: 'Description' }
    ];
    exportToCSV(materials, 'raw_materials_export.csv', columns);
  };

  if (loading) {
    return <div className="loading-container"><div className="spinner" /></div>;
  }

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1>Raw Materials</h1>
                  <p>Manage chemicals, ingredients, and supplies</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="search-wrapper">
          <Search />
          <input
            className="search-input"
            placeholder="Search materials..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="form-control" style={{ width: 'auto', minWidth: '120px' }} value={unitFilter} onChange={(e) => setUnitFilter(e.target.value)}>
          <option value="">All Units</option>
          {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        <button className="btn btn-secondary" onClick={() => { setShowImportModal(true); setCsvFile(null); setImportResult(null); }}>
          <Upload size={16} /> Import
        </button>
        <button className="btn btn-secondary" onClick={handleExport} disabled={materials.length === 0}>
          <DownloadCloud size={16} /> Export
        </button>
        <button className="btn btn-primary" onClick={openCreate}>
          <Plus size={16} /> Add Material
        </button>
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Unit</th>
                <th className="text-right">Price/Unit (₹)</th>
                <th className="text-right">Stock</th>
                <th>Supplier</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {materials.length === 0 ? (
                <tr><td colSpan={7} className="text-center text-muted" style={{ padding: '40px' }}>No raw materials found</td></tr>
              ) : materials.map((m) => {
                const isLow = parseFloat(m.low_stock_threshold) > 0 && parseFloat(m.stock_qty) <= parseFloat(m.low_stock_threshold);
                return (
                  <tr key={m.id}>
                    <td data-label="Name"><strong>{m.name}</strong>{m.description && <br />}{m.description && <span className="text-muted" style={{ fontSize: '0.8rem' }}>{m.description}</span>}</td>
                    <td data-label="Unit">{m.unit}</td>
                    <td data-label="Price/Unit (₹)" className="text-right">₹{parseFloat(m.price_per_unit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td data-label="Stock" className="text-right">{parseFloat(m.stock_qty).toLocaleString('en-IN')} {m.unit}</td>
                    <td data-label="Supplier" className="text-muted">{m.supplier_name || '—'}</td>
                    <td data-label="Status">
                      <span className={`badge ${isLow ? 'badge-low-stock' : 'badge-ok'}`}>
                        {isLow ? 'Low Stock' : 'OK'}
                      </span>
                    </td>
                    <td data-label="Actions" className="text-right">
                      <div className="action-btns">
                        <button className="btn btn-secondary btn-icon btn-sm" onClick={() => viewPriceHistory(m)} title="Price History"><History size={14} /></button>
                        <button className="btn btn-secondary btn-icon btn-sm" onClick={() => openEdit(m)} title="Edit"><Edit2 size={14} /></button>
                        <button className="btn btn-danger btn-icon btn-sm" onClick={() => setDeleteTarget(m.id)} title="Delete"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editing ? 'Edit Material' : 'Add Raw Material'}</h2>
              <button className="btn btn-secondary btn-icon" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Name *</label>
                  <input className="form-control" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Vanillin" />
                </div>
                <div className="form-group">
                  <label>Unit *</label>
                  <select className="form-control" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              {/* Unit conversion preview — shown when editing and unit has changed */}
              {editing && form.unit !== editing.unit && (() => {
                const newStock = convertQty(editing.stock_qty, editing.unit, form.unit);
                const newThreshold = convertQty(editing.low_stock_threshold, editing.unit, form.unit);
                return newStock !== null ? (
                  <div style={{
                    background: 'rgba(240, 147, 43, 0.1)',
                    border: '1px solid var(--accent-warning)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '10px 14px',
                    fontSize: '0.82rem',
                    color: 'var(--accent-warning)',
                    marginBottom: '12px'
                  }}>
                    <strong>⚡ Auto-converting stock:</strong><br />
                    Stock: <strong>{editing.stock_qty} {editing.unit}</strong> → <strong>{newStock} {form.unit}</strong>
                    {newThreshold !== null && (<><br />Threshold: <strong>{editing.low_stock_threshold} {editing.unit}</strong> → <strong>{newThreshold} {form.unit}</strong></>)}
                  </div>
                ) : (
                  <div style={{
                    background: 'rgba(231, 76, 60, 0.1)',
                    border: '1px solid var(--accent-danger)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '10px 14px',
                    fontSize: '0.82rem',
                    color: 'var(--accent-danger)',
                    marginBottom: '12px'
                  }}>
                    ⚠️ No automatic conversion available between <strong>{editing.unit}</strong> and <strong>{form.unit}</strong>. Stock quantity will stay unchanged.
                  </div>
                );
              })()}
              <div className="form-group">
                <label>Description</label>
                <input className="form-control" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional description" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Price per Unit (₹) *</label>
                  <input className="form-control" type="number" step="0.01" required value={form.price_per_unit} onChange={(e) => setForm({ ...form, price_per_unit: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Current Stock</label>
                  <input className="form-control" type="number" step="0.01" value={form.stock_qty} onChange={(e) => setForm({ ...form, stock_qty: e.target.value })} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Low Stock Threshold</label>
                  <input className="form-control" type="number" step="0.01" value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Supplier Name</label>
                  <input className="form-control" value={form.supplier_name} onChange={(e) => setForm({ ...form, supplier_name: e.target.value })} placeholder="Optional" />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editing ? 'Save Changes' : 'Add Material'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Price History Modal */}
      {priceHistory && (
        <div className="modal-overlay" onClick={() => setPriceHistory(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Price History — {priceHistory.name}</h2>
              <button className="btn btn-secondary btn-icon" onClick={() => setPriceHistory(null)}><X size={18} /></button>
            </div>
            {priceHistory.history.length === 0 ? (
              <div className="empty-state"><p>No price changes recorded</p></div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th className="text-right">Old Price (₹)</th>
                      <th className="text-right">New Price (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {priceHistory.history.map((h, i) => (
                      <tr key={i}>
                        <td data-label="Date">{new Date(h.changed_at).toLocaleString('en-IN')}</td>
                        <td data-label="Old Price (₹)" className="text-right">₹{parseFloat(h.old_price).toFixed(2)}</td>
                        <td data-label="New Price (₹)" className="text-right">₹{parseFloat(h.new_price).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Raw Material"
        message="This will permanently delete this raw material and may affect products that use it in their formula. Continue?"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Import CSV Modal */}
      {showImportModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>Import Raw Materials</h2>
              <button className="btn-icon" onClick={() => setShowImportModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '20px' }}>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  Upload a CSV file to bulk import raw materials.
                </p>
                <button className="btn btn-secondary" onClick={downloadTemplate} style={{ width: '100%', justifyContent: 'center' }}>
                  <Download size={16} /> Download Template
                </button>
              </div>

              <div className="form-group">
                <label>Select CSV File</label>
                <input
                  type="file"
                  accept=".csv"
                  className="form-control"
                  onChange={(e) => setCsvFile(e.target.files[0])}
                />
              </div>

              {importResult && (
                <div style={{
                  padding: '12px',
                  borderRadius: 'var(--radius-sm)',
                  background: importResult.success ? 'rgba(0, 184, 148, 0.1)' : 'rgba(231, 76, 60, 0.1)',
                  border: `1px solid ${importResult.success ? 'var(--accent-secondary)' : 'var(--accent-danger)'}`,
                  marginTop: '16px',
                  fontSize: '0.9rem'
                }}>
                  {importResult.success ? (
                    <div>
                      <p style={{ color: 'var(--accent-secondary)', fontWeight: 600 }}>Import Complete</p>
                      <p>Imported: {importResult.imported}</p>
                      <p>Skipped: {importResult.skipped}</p>
                      {importResult.errors?.length > 0 && (
                        <div style={{ marginTop: '8px', maxHeight: '100px', overflowY: 'auto' }}>
                          <p style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--accent-danger)' }}>Errors:</p>
                          <ul style={{ paddingLeft: '20px', color: 'var(--accent-danger)', fontSize: '0.8rem' }}>
                            {importResult.errors.map((err, i) => <li key={i}>{err}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p style={{ color: 'var(--accent-danger)' }}>{importResult.message}</p>
                  )}
                </div>
              )}

              <div className="form-actions" style={{ marginTop: '24px' }}>
                <button className="btn btn-secondary" onClick={() => setShowImportModal(false)}>
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleCsvImport}
                  disabled={!csvFile || importing}
                >
                  {importing ? 'Importing...' : 'Upload & Import'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
