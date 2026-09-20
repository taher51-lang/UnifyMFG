// frontend/src/pages/Products.jsx
// Products are sellable SKUs. Each can optionally link to a Formulation.
// Cost price is auto-derived: (formulation_batch_cost / batch_size) × fill_volume

import { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, X, Tag, DownloadCloud, UploadCloud } from 'lucide-react';
import client from '../api/client';
import ConfirmDialog from '../components/ConfirmDialog';
import { exportToCSV } from '../utils/csvExport';
import { useAppContext } from '../context/AppContext';

export default function Products() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [formulations, setFormulations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [catFilterSearch, setCatFilterSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [toast, setToast] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [categorySearch, setCategorySearch] = useState('');
  const { refreshGlobalData } = useAppContext();

  const [form, setForm] = useState({
    name: '', category_id: '', description: '',
    formulation_id: '', fill_volume: '',
    wholesale_price: '', retail_price: '', wholesale_min_qty: '1',
    stock_qty: '', low_stock_threshold: '',
    cost_price: '', supplier_name: '', supplier_number: '',
    selling_unit: '', packaging_size: '', packaging_unit: '',
  });

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchData = async () => {
    try {
      const [prodRes, catRes, formRes] = await Promise.all([
        client.get('/products', { params: { search, category_id: catFilter } }),
        client.get('/products/categories'),
        client.get('/formulations'),
      ]);
      setProducts(prodRes.data || []);
      setCategories(catRes.data || []);
      setFormulations(formRes.data || []);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [search, catFilter]);

  const openCreate = () => {
    setEditing(null);
    setCategorySearch('');
    setForm({ 
      name: '', category_id: '', description: '', 
      formulation_id: '', fill_volume: '', 
      wholesale_price: '', retail_price: '', wholesale_min_qty: '1',
      stock_qty: '', low_stock_threshold: '',
      cost_price: '', supplier_name: '', supplier_number: '',
      selling_unit: '', packaging_size: '', packaging_unit: '',
    });
    setShowModal(true);
  };

  const openEdit = (p) => {
    setEditing(p);
    setCategorySearch(categories.find(c => c.id === p.category_id)?.name || '');
    setForm({
      name: p.name,
      category_id: p.category_id || '',
      description: p.description || '',
      formulation_id: p.formulation_id || '',
      fill_volume: p.fill_volume || '',
      wholesale_price: p.wholesale_price || '',
      retail_price: p.retail_price || '',
      wholesale_min_qty: p.wholesale_min_qty || '1',
      cost_price: p.cost_price || '',
      stock_qty: p.stock_qty || '',
      low_stock_threshold: p.low_stock_threshold || '',
      supplier_name: p.supplier_name || '',
      supplier_number: p.supplier_number || '',
      selling_unit: p.selling_unit || '',
      packaging_size: p.packaging_size || '',
      packaging_unit: p.packaging_unit || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: form.name,
        category_id: form.category_id || null,
        description: form.description,
        formulation_id: form.formulation_id || null,
        fill_volume: form.fill_volume ? parseFloat(form.fill_volume) : null,
        wholesale_price: parseFloat(form.wholesale_price || 0),
        retail_price: parseFloat(form.retail_price || 0),
        wholesale_min_qty: parseFloat(form.wholesale_min_qty || 1),
        cost_price: form.formulation_id ? undefined : parseFloat(form.cost_price || 0),
        stock_qty: parseFloat(form.stock_qty || 0),
        low_stock_threshold: parseFloat(form.low_stock_threshold || 0),
        supplier_name: form.supplier_name,
        supplier_number: form.supplier_number,
        selling_unit: form.selling_unit,
        packaging_size: form.packaging_size ? parseFloat(form.packaging_size) : null,
        packaging_unit: form.packaging_unit,
      };
      if (editing) {
        await client.put(`/products/${editing.id}`, payload);
        showToast('Product updated');
      } else {
        await client.post('/products', payload);
        showToast('Product created');
      }
      setShowModal(false);
      fetchData();
      refreshGlobalData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await client.delete(`/products/${deleteTarget}`);
      showToast('Product deleted');
      fetchData();
      refreshGlobalData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setDeleteTarget(null);
    }
  };

  const addCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      await client.post('/products/categories', { name: newCategoryName.trim() });
      setShowCategoryModal(false);
      showToast('Category added');
      fetchData();
      refreshGlobalData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const deleteCategory = async (id) => {
    try {
      await client.delete(`/products/categories/${id}`);
      showToast('Category deleted');
      fetchData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleExport = () => {
    const columns = [
      { key: 'name', label: 'Product Name' },
      { key: 'category_id', label: 'Category', formatter: (val) => categories.find(c => c.id === val)?.name || '' },
      { key: 'cost_price', label: 'Cost Price (₹)' },
      { key: 'wholesale_price', label: 'Wholesale Price (₹)' },
      { key: 'retail_price', label: 'Retail Price (₹)' },
      { key: 'wholesale_min_qty', label: 'Wholesale Min Qty' },
      { key: 'stock_qty', label: 'Stock Quantity' },
      { key: 'selling_unit', label: 'Selling Unit' },
      { key: 'packaging_size', label: 'Packaging Size' },
      { key: 'packaging_unit', label: 'Packaging Unit' },
      { key: 'supplier_name', label: 'Supplier' },
      { key: 'supplier_number', label: 'Supplier #' },
      { key: 'description', label: 'Description' },
    ];
    exportToCSV(products, 'products_export.csv', columns);
  };

  const handleImportCSV = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      setLoading(true);
      const res = await client.post('/products/import-csv', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      showToast(`Successfully imported ${res.data.imported} products`);
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.error || err.message, 'error');
    } finally {
      setLoading(false);
      e.target.value = ''; // Reset file input
    }
  };

  // Derive the selected formulation for the form
  const selectedFormulation = formulations.find(f => f.id === form.formulation_id);

  // Preview derived cost in the modal
  const previewCost = (() => {
    if (!selectedFormulation || !form.fill_volume) return null;
    const batchCost = parseFloat(selectedFormulation.cost_price) || 0;
    const batchSize = parseFloat(selectedFormulation.batch_size) || 0;
    const fillVol = parseFloat(form.fill_volume) || 0;
    if (batchSize <= 0 || fillVol <= 0) return null;
    return (batchCost / batchSize) * fillVol;
  })();

  // Preview derived cost per selling unit for bulk products
  const previewCostPerUnit = (() => {
    if (form.formulation_id) return null; // Formulation products use their own cost
    const costPrice = parseFloat(form.cost_price) || 0;
    const pkgSize = parseFloat(form.packaging_size) || 0;
    if (costPrice <= 0 || pkgSize <= 0) return null;
    return costPrice / pkgSize;
  })();

  const round2 = (v) => Math.round(v * 100) / 100;

  if (loading) return <div className="loading-container"><div className="spinner" /></div>;

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1>Products</h1>
                  <p>Manage sellable SKUs — link each to a Formulation to auto-derive cost price</p>
        </div>
      </div>

      <div className="toolbar">
        <div className="search-wrapper" style={{ maxWidth: '360px' }}>
          <Search />
          <input className="search-input" placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
          <input
            className="form-control"
            style={{ width: '160px', flex: 'none' }}
            list="filter-category-options"
            placeholder="All Categories"
            value={catFilterSearch}
            onChange={(e) => {
              setCatFilterSearch(e.target.value);
              const matched = categories.find(c => c.name.toLowerCase() === e.target.value.toLowerCase());
              if (e.target.value.trim() === '') {
                setCatFilter('');
              } else if (matched) {
                setCatFilter(matched.id);
              }
            }}
          />
          <datalist id="filter-category-options">
            {categories.map(c => <option key={c.id} value={c.name} />)}
          </datalist>
        <button type="button" className="btn btn-secondary" onClick={() => setShowCategoryModal(true)}>
          <Tag size={14} /> Categories
        </button>
        <button className="btn btn-secondary" onClick={handleExport} disabled={products.length === 0}>
          <DownloadCloud size={16} /> Export
        </button>
        <button className="btn btn-secondary" style={{ position: 'relative', overflow: 'hidden' }}>
          <UploadCloud size={16} /> Import CSV
          <input
            type="file"
            accept=".csv"
            onChange={handleImportCSV}
            style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
          />
        </button>
        <button className="btn btn-primary" onClick={openCreate}>
          <Plus size={16} /> Add Product
        </button>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Formulation</th>
                <th className="text-right">Fill Vol.</th>
                <th className="text-right">Cost (₹)</th>
                <th className="text-right">Wholesale (₹)</th>
                <th className="text-right">Retail (₹)</th>
                <th className="text-right">Stock</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr><td colSpan={9} className="text-center text-muted" style={{ padding: '40px' }}>No products found</td></tr>
              ) : products.map((p) => {
                const cost = parseFloat(p.cost_price) || 0;
                const pkgSize = parseFloat(p.packaging_size) || 0;
                const costPerUnit = pkgSize > 0 ? cost / pkgSize : cost;
                const sell = parseFloat(p.retail_price || p.selling_price) || 0;
                const marginPct = sell > 0 ? ((sell - costPerUnit) / sell * 100) : 0;
                const catName = p.product_categories?.name || '—';
                const linkedFormulation = formulations.find(f => f.id === p.formulation_id);

                // Dual stock display for bulk products
                const stockQty = parseFloat(p.stock_qty || 0);
                const hasPkg = pkgSize > 0 && p.packaging_unit;
                const bags = hasPkg ? Math.floor(stockQty / pkgSize) : 0;
                const loose = hasPkg ? round2(stockQty % pkgSize) : 0;
                const unit = p.selling_unit || p.batch_unit || 'pcs';

                return (
                  <tr key={p.id}>
                    <td data-label="Product">
                      <strong>{p.name}</strong>
                      {p.description && <><br /><span className="text-muted" style={{ fontSize: '0.8rem' }}>{p.description}</span></>}
                    </td>
                    <td data-label="Category"><span className="badge badge-confirmed">{catName}</span></td>
                    <td data-label="Formulation">
                      {linkedFormulation
                        ? <span className="badge badge-paid">{linkedFormulation.name}</span>
                        : <span className="text-muted" style={{ fontSize: '0.8rem' }}>—</span>}
                    </td>
                    <td data-label="Fill Vol." className="text-right text-muted" style={{ fontSize: '0.85rem' }}>
                      {p.fill_volume ? `${p.fill_volume} ${linkedFormulation?.batch_unit || ''}` : '—'}
                    </td>
                    <td data-label="Cost (₹)" className="text-right">
                      {hasPkg ? (
                        <div>
                          <div style={{ fontWeight: 600 }}>₹{costPerUnit.toFixed(2)}/{unit}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>₹{cost.toFixed(0)}/{p.packaging_unit}</div>
                        </div>
                      ) : (
                        <span>₹{cost.toFixed(2)}</span>
                      )}
                    </td>
                    <td data-label="Wholesale (₹)" className="text-right">
                      <div style={{ fontWeight: 600 }}>₹{(parseFloat(p.wholesale_price) || 0).toFixed(2)}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>min {p.wholesale_min_qty || 1} {unit}</div>
                    </td>
                    <td data-label="Retail (₹)" className="text-right">
                      <div style={{ fontWeight: 600 }}>₹{(parseFloat(p.retail_price) || 0).toFixed(2)}{unit ? `/${unit}` : ''}</div>
                      <span className={`margin-display ${marginPct >= 0 ? 'margin-positive' : 'margin-negative'}`} style={{ fontSize: '0.7rem' }}>
                        {marginPct.toFixed(1)}%
                      </span>
                    </td>
                    <td data-label="Stock" className="text-right">
                      {hasPkg ? (
                        <div>
                          <div style={{ fontWeight: 600 }}>{stockQty.toLocaleString('en-IN')} {unit}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {bags} {p.packaging_unit}{bags !== 1 ? 's' : ''}{loose > 0 ? ` + ${loose} ${unit}` : ''}
                          </div>
                        </div>
                      ) : (
                        <span>{stockQty.toLocaleString('en-IN')}{unit ? ` ${unit}` : ''}</span>
                      )}
                    </td>
                    <td data-label="Actions" className="text-right">
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button className="btn btn-secondary btn-icon btn-sm" onClick={() => openEdit(p)} title="Edit"><Edit2 size={14} /></button>
                        <button className="btn btn-danger btn-icon btn-sm" onClick={() => setDeleteTarget(p.id)} title="Delete"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Product Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editing ? 'Edit Product' : 'Add Product'}</h2>
              <button className="btn btn-secondary btn-icon" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Name *</label>
                  <input className="form-control" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Mango Flavour 100ml" />
                </div>
                <div className="form-group">
                  <label>Category</label>
                  <input
                    className="form-control"
                    list="category-options"
                    placeholder="— Type or Select Category —"
                    value={categorySearch}
                    onChange={(e) => {
                      setCategorySearch(e.target.value);
                      const matched = categories.find(c => c.name.toLowerCase() === e.target.value.toLowerCase());
                      setForm({ ...form, category_id: matched ? matched.id : '' });
                    }}
                  />
                  <datalist id="category-options">
                    {categories.map(c => <option key={c.id} value={c.name} />)}
                  </datalist>
                </div>
              </div>

              <div className="form-group">
                <label>Description</label>
                <input className="form-control" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>

              {/* Formulation Link */}
              <div style={{
                padding: '14px 16px', marginBottom: '16px',
                background: 'rgba(108, 99, 255, 0.04)',
                borderRadius: 'var(--radius-md)', border: '1px solid var(--border-accent)',
              }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-primary)', marginBottom: '12px' }}>
                  Formulation Link — Cost Auto-Derived
                </p>
                <div className="form-row">
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Formulation (Recipe)</label>
                    <select className="form-control" value={form.formulation_id} onChange={(e) => setForm({ ...form, formulation_id: e.target.value })}>
                      <option value="">— None (manual cost) —</option>
                      {formulations.map(f => (
                        <option key={f.id} value={f.id}>
                          {f.name} ({f.batch_size} {f.batch_unit})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Fill Volume ({selectedFormulation?.batch_unit || 'units'})</label>
                    <input
                      className="form-control"
                      type="number"
                      step="0.001"
                      min="0"
                      value={form.fill_volume}
                      onChange={(e) => setForm({ ...form, fill_volume: e.target.value })}
                      placeholder={`e.g. 0.1 for 100ml`}
                      disabled={!form.formulation_id}
                    />
                  </div>
                </div>
                {previewCost !== null && (
                  <p style={{ marginTop: '10px', fontSize: '0.85rem', color: 'var(--accent-secondary)' }}>
                    ✓ Derived cost price: <strong>₹{previewCost.toFixed(4)}</strong> per unit
                  </p>
                )}
                {!form.formulation_id && (
                  <p style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    No formulation linked — cost price will be 0 unless set via the Formulations page.
                  </p>
                )}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Wholesale Price (₹)</label>
                  <input className="form-control" type="number" step="0.01" value={form.wholesale_price} onChange={(e) => setForm({ ...form, wholesale_price: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Retail Price (₹)</label>
                  <input className="form-control" type="number" step="0.01" value={form.retail_price} onChange={(e) => setForm({ ...form, retail_price: e.target.value })} />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Wholesale Min Qty</label>
                  <input className="form-control" type="number" step="1" value={form.wholesale_min_qty} onChange={(e) => setForm({ ...form, wholesale_min_qty: e.target.value })} />
                </div>
                {!form.formulation_id && (
                  <div className="form-group">
                    <label>Cost Price (₹)</label>
                    <input className="form-control" type="number" step="0.01" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} />
                  </div>
                )}
              </div>

              {/* Packaging & Units — for bulk/traded products */}
              <div style={{
                padding: '14px 16px', marginBottom: '16px',
                background: 'rgba(0, 212, 170, 0.04)',
                borderRadius: 'var(--radius-md)', border: '1px solid rgba(0, 212, 170, 0.2)',
              }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-secondary)', marginBottom: '12px' }}>
                  📦 Packaging & Units
                </p>
                <div className="form-row">
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Selling Unit</label>
                    <select className="form-control" value={form.selling_unit} onChange={(e) => setForm({ ...form, selling_unit: e.target.value })}>
                      <option value="">— None —</option>
                      <option value="kg">kg</option>
                      <option value="g">g</option>
                      <option value="L">L</option>
                      <option value="ml">ml</option>
                      <option value="pcs">pcs</option>
                      <option value="bottles">bottles</option>
                      <option value="packets">packets</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Packaging Unit</label>
                    <input className="form-control" value={form.packaging_unit} onChange={(e) => setForm({ ...form, packaging_unit: e.target.value })} placeholder="e.g. bag, sack, drum" />
                  </div>
                </div>
                <div className="form-row" style={{ marginTop: '10px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Packaging Size ({form.selling_unit || 'units'} per {form.packaging_unit || 'package'})</label>
                    <input className="form-control" type="number" step="0.01" min="0" value={form.packaging_size} onChange={(e) => setForm({ ...form, packaging_size: e.target.value })} placeholder="e.g. 25 for 25kg bag" />
                  </div>
                </div>
                {previewCostPerUnit !== null && (
                  <p style={{ marginTop: '10px', fontSize: '0.85rem', color: 'var(--accent-secondary)' }}>
                    ✓ Derived cost: <strong>₹{previewCostPerUnit.toFixed(2)}/{form.selling_unit || 'unit'}</strong>
                    <span className="text-muted"> (from ₹{parseFloat(form.cost_price || 0).toFixed(0)}/{form.packaging_unit || 'package'})</span>
                  </p>
                )}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Stock Qty{form.selling_unit ? ` (${form.selling_unit})` : ''}</label>
                  <input className="form-control" type="number" step="0.01" value={form.stock_qty} onChange={(e) => setForm({ ...form, stock_qty: e.target.value })} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Low Stock Threshold{form.selling_unit ? ` (${form.selling_unit})` : ''}</label>
                  <input className="form-control" type="number" step="0.01" value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })} />
                </div>
              </div>
              <div style={{
                padding: '14px 16px', marginTop: '8px',
                background: 'rgba(0,0,0,0.02)',
                borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-subtle)',
              }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                  Supplier Information
                </p>
                <div className="form-row">
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Supplier Name</label>
                    <input className="form-control" value={form.supplier_name} onChange={(e) => setForm({ ...form, supplier_name: e.target.value })} placeholder="e.g. ABC Chemicals" />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Supplier Contact #</label>
                    <input className="form-control" value={form.supplier_number} onChange={(e) => setForm({ ...form, supplier_number: e.target.value })} placeholder="Phone or ID" />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editing ? 'Save Changes' : 'Add Product'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Management Modal */}
      {showCategoryModal && (
        <div className="modal-overlay" onClick={() => setShowCategoryModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2>Product Categories</h2>
              <button className="btn btn-secondary btn-icon" onClick={() => setShowCategoryModal(false)}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <input className="form-control" placeholder="New category name" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addCategory()} />
              <button type="button" className="btn btn-primary" onClick={addCategory}><Plus size={16} /></button>
            </div>
            {categories.length === 0 ? (
              <p className="text-muted text-center">No categories yet</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {categories.map(c => (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)' }}>
                    <span>{c.name}</span>
                    <button className="btn btn-danger btn-icon btn-sm" onClick={() => deleteCategory(c.id)}><Trash2 size={12} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Product"
        message="This will permanently delete this product. Continue?"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
