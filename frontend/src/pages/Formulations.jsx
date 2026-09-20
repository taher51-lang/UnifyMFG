// frontend/src/pages/Formulations.jsx
// Manage compound recipes (formulations) independently of products.
// Each formulation has a batch size and ingredient list.
// Multiple products can link to one formulation with their own fill volumes.

import { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, X, FlaskConical, Printer, DownloadCloud } from 'lucide-react';
import client from '../api/client';
import { exportToCSV } from '../utils/csvExport';
import IngredientEditor from '../components/IngredientEditor';
import ConfirmDialog from '../components/ConfirmDialog';

export default function Formulations() {
  const [formulations, setFormulations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showEditorModal, setShowEditorModal] = useState(null); // formulation object
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toast, setToast] = useState(null);

  const [form, setForm] = useState({ name: '', description: '', batch_size: '', batch_unit: 'kg' });

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchData = async () => {
    try {
      const res = await client.get('/formulations');
      setFormulations(res.data || []);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = formulations.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', description: '', batch_size: '', batch_unit: 'kg' });
    setShowModal(true);
  };

  const openEdit = (f) => {
    setEditing(f);
    setForm({
      name: f.name,
      description: f.description || '',
      batch_size: f.batch_size || '',
      batch_unit: f.batch_unit || 'kg',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        batch_size: form.batch_size ? parseFloat(form.batch_size) : null,
      };
      if (editing) {
        await client.put(`/formulations/${editing.id}`, payload);
        showToast('Formulation updated');
      } else {
        await client.post('/formulations', payload);
        showToast('Formulation created');
      }
      setShowModal(false);
      fetchData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await client.delete(`/formulations/${deleteTarget}`);
      showToast('Formulation deleted');
      fetchData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleExport = () => {
    const columns = [
      { key: 'name', label: 'Formulation Name' },
      { key: 'description', label: 'Description' },
      { key: 'batch_size', label: 'Batch Size' },
      { key: 'batch_unit', label: 'Batch Unit' },
      { key: 'cost_price', label: 'Batch Cost (₹)' },
      { key: 'product_count', label: 'Linked Products' },
    ];
    exportToCSV(formulations, 'formulations_export.csv', columns);
  };

  if (loading) return <div className="loading-container"><div className="spinner" /></div>;

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1>Formulations</h1>
                  <p>Manage compound recipes — one formulation can serve many products</p>
        </div>
      </div>

      <div className="toolbar">
        <div className="search-wrapper">
          <Search />
          <input
            className="search-input"
            placeholder="Search formulations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button className="btn btn-secondary" onClick={handleExport} disabled={formulations.length === 0}>
          <DownloadCloud size={16} /> Export CSV
        </button>
        <button className="btn btn-primary" onClick={openCreate}>
          <Plus size={16} /> New Formulation
        </button>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Formulation Name</th>
                <th>Standard Batch</th>
                <th className="text-right">Batch Cost (₹)</th>
                <th className="text-right">Linked Products</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center text-muted" style={{ padding: '40px' }}>
                    No formulations yet — create your first recipe
                  </td>
                </tr>
              ) : filtered.map((f) => (
                <tr key={f.id}>
                  <td data-label="Formulation Name">
                    <strong>{f.name}</strong>
                    {f.description && (
                      <><br /><span className="text-muted" style={{ fontSize: '0.8rem' }}>{f.description}</span></>
                    )}
                  </td>
                  <td data-label="Standard Batch">
                    {f.batch_size ? `${f.batch_size} ${f.batch_unit || ''}` : <span className="text-muted">—</span>}
                  </td>
                  <td data-label="Batch Cost (₹)" className="text-right">
                    ₹{parseFloat(f.cost_price || 0).toFixed(2)}
                  </td>
                  <td data-label="Linked Products" className="text-right">
                    <span className={`badge ${f.product_count > 0 ? 'badge-confirmed' : 'badge-draft'}`}>
                      {f.product_count} {f.product_count === 1 ? 'product' : 'products'}
                    </span>
                  </td>
                  <td data-label="Actions" className="text-right">
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setShowEditorModal(f)}
                        title="Edit Ingredients"
                      >
                        <FlaskConical size={14} /> Ingredients
                      </button>
                      <button
                        className="btn btn-secondary btn-icon btn-sm"
                        onClick={() => openEdit(f)}
                        title="Edit Details"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        className="btn btn-danger btn-icon btn-sm"
                        onClick={() => setDeleteTarget(f.id)}
                        title={f.product_count > 0 ? `Cannot delete — ${f.product_count} product(s) linked. Unlink them first.` : 'Delete'}
                        disabled={f.product_count > 0}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Formulation Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editing ? 'Edit Formulation' : 'New Formulation'}</h2>
              <button className="btn btn-secondary btn-icon" onClick={() => setShowModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Formulation Name *</label>
                <input
                  className="form-control"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Mango Flavour Compound"
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <input
                  className="form-control"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Optional notes about this compound"
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Standard Batch Size</label>
                  <input
                    className="form-control"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.batch_size}
                    onChange={(e) => setForm({ ...form, batch_size: e.target.value })}
                    placeholder="e.g. 40"
                  />
                </div>
                <div className="form-group">
                  <label>Batch Unit</label>
                  <input
                    className="form-control"
                    value={form.batch_unit}
                    onChange={(e) => setForm({ ...form, batch_unit: e.target.value })}
                    placeholder="e.g. L, kg"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editing ? 'Save Changes' : 'Create Formulation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ingredient Editor Modal */}
      {showEditorModal && (
        <div className="modal-overlay" onClick={() => { setShowEditorModal(null); fetchData(); }}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>{showEditorModal.name}</h2>
                <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '2px' }}>
                  Ingredient Editor — {showEditorModal.batch_size} {showEditorModal.batch_unit} standard batch
                </p>
              </div>
              <button
                className="btn btn-secondary btn-icon"
                onClick={() => { setShowEditorModal(null); fetchData(); }}
              >
                <X size={18} />
              </button>
            </div>
            <IngredientEditor
              formulationId={showEditorModal.id}
              batchSize={showEditorModal.batch_size}
              batchUnit={showEditorModal.batch_unit}
              imageUrl={showEditorModal.image_url}
              onImageChange={(newUrl) => {
                setShowEditorModal(prev => ({ ...prev, image_url: newUrl }));
                setFormulations(prev =>
                  prev.map(f => f.id === showEditorModal.id ? { ...f, image_url: newUrl } : f)
                );
              }}
              onCostUpdate={(newCost) => {
                setFormulations(prev =>
                  prev.map(f => f.id === showEditorModal.id ? { ...f, cost_price: newCost } : f)
                );
              }}
            />
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Formulation"
        message="This will permanently delete this formulation and all its ingredients. Products linked to it will be unlinked. Continue?"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
