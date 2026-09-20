// frontend/src/components/InvoiceForm.jsx
// Create/edit invoice: customer picker, product rows, discount, GST, running totals

import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import client from '../api/client';

export default function InvoiceForm({ invoice, onSave, onCancel }) {
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    customer_id: invoice?.customer_id || '',
    invoice_date: invoice?.invoice_date || new Date().toISOString().split('T')[0],
    due_date: invoice?.due_date || '',
    discount_pct: invoice?.discount_pct || 0,
    gst_pct: invoice?.gst_pct || 18,
    notes: invoice?.notes || '',
  });

  const [items, setItems] = useState(
    invoice?.invoice_items?.map((it) => ({
      product_id: it.product_id,
      qty: it.qty,
      unit_price: it.unit_price,
    })) || [{ product_id: '', qty: '', unit_price: '' }]
  );

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [custRes, prodRes] = await Promise.all([
          client.get('/customers'),
          client.get('/products'),
        ]);
        setCustomers(custRes.data || []);
        setProducts(prodRes.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // When product is selected or qty changes, auto-fill unit price
  const updateItem = (index, field, value) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };

    const item = updated[index];
    const prod = products.find((p) => p.id === item.product_id);

    if (prod && (field === 'product_id' || field === 'qty')) {
      const qty = parseFloat(item.qty) || 0;
      const minWholesale = parseFloat(prod.wholesale_min_qty) || 1;
      
      if (qty >= minWholesale && parseFloat(prod.wholesale_price) > 0) {
        updated[index].unit_price = prod.wholesale_price;
      } else {
        // Fallback to retail price, or the legacy selling_price
        updated[index].unit_price = prod.retail_price || prod.selling_price || 0;
      }
    }

    setItems(updated);
  };

  const addItem = () => {
    setItems([...items, { product_id: '', qty: '', unit_price: '' }]);
  };

  const removeItem = (index) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  // Calculations
  const subtotal = items.reduce((sum, it) => {
    return sum + (parseFloat(it.qty) || 0) * (parseFloat(it.unit_price) || 0);
  }, 0);

  const discountPct = parseFloat(form.discount_pct) || 0;
  const discountAmt = subtotal * (discountPct / 100);
  const afterDiscount = subtotal - discountAmt;
  const gstPct = parseFloat(form.gst_pct) || 0;
  const gstAmt = afterDiscount * (gstPct / 100);
  const total = afterDiscount + gstAmt;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validItems = items
      .filter((it) => it.product_id && parseFloat(it.qty) > 0)
      .map((it) => ({
        product_id: it.product_id,
        qty: parseFloat(it.qty),
        unit_price: parseFloat(it.unit_price),
      }));

    if (validItems.length === 0) {
      alert('Add at least one product');
      return;
    }

    const payload = {
      customer_id: form.customer_id,
      invoice_date: form.invoice_date,
      due_date: form.due_date || null,
      discount_pct: discountPct,
      gst_pct: gstPct,
      notes: form.notes,
      items: validItems,
    };

    if (onSave) onSave(payload);
  };

  if (loading) {
    return <div className="loading-container"><div className="spinner" /></div>;
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Customer & Dates */}
      <div className="form-row">
        <div className="form-group">
          <label>Customer *</label>
          <select className="form-control" required value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })}>
            <option value="">— Select Customer —</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}{c.company_name ? ` (${c.company_name})` : ''}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Invoice Date</label>
          <input className="form-control" type="date" value={form.invoice_date} onChange={(e) => setForm({ ...form, invoice_date: e.target.value })} />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Due Date</label>
          <input className="form-control" type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
        </div>
        <div className="form-group">
          <label>Notes</label>
          <input className="form-control" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes" />
        </div>
      </div>

      {/* Line Items */}
      <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: '16px 0 10px', color: 'var(--text-secondary)' }}>Line Items</h3>
      <div className="table-container" style={{ marginBottom: '12px' }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: '35%' }}>Product</th>
              <th style={{ width: '15%' }}>Qty</th>
              <th style={{ width: '20%' }}>Unit Price (₹)</th>
              <th className="text-right" style={{ width: '20%' }}>Line Total (₹)</th>
              <th style={{ width: '50px' }}></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const lineTotal = (parseFloat(item.qty) || 0) * (parseFloat(item.unit_price) || 0);
              const prod = products.find((p) => p.id === item.product_id);
              const unit = prod?.selling_unit || '';
              const pkgSize = parseFloat(prod?.packaging_size) || 0;
              const stockQty = parseFloat(prod?.stock_qty || 0);
              const hasPkg = pkgSize > 0 && prod?.packaging_unit;
              const bags = hasPkg ? Math.floor(stockQty / pkgSize) : 0;
              return (
                <tr key={i}>
                  <td data-label="Product">
                    <select className="form-control" value={item.product_id} onChange={(e) => updateItem(i, 'product_id', e.target.value)}>
                      <option value="">— Select —</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}{p.selling_unit ? ` (${p.selling_unit})` : ''}</option>
                      ))}
                    </select>
                    {prod && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                        Stock: <strong>{stockQty.toLocaleString('en-IN')}{unit ? ` ${unit}` : ''}</strong>
                        {hasPkg && <span> ({bags} {prod.packaging_unit}{bags !== 1 ? 's' : ''})</span>}
                      </div>
                    )}
                  </td>
                  <td data-label="Qty">
                    <input className="form-control" type="number" step="0.01" min="0" value={item.qty} onChange={(e) => updateItem(i, 'qty', e.target.value)} placeholder={unit || '0'} />
                    {unit && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center' }}>{unit}</div>}
                  </td>
                  <td data-label="Unit Price (₹)">
                    <input className="form-control" type="number" step="0.01" min="0" value={item.unit_price} onChange={(e) => updateItem(i, 'unit_price', e.target.value)} />
                    {unit && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center' }}>per {unit}</div>}
                  </td>
                  <td data-label="Line Total (₹)" className="text-right font-bold">₹{lineTotal.toFixed(2)}</td>
                  <td data-label="">
                    <button type="button" className="btn btn-danger btn-icon btn-sm" onClick={() => removeItem(i)} disabled={items.length <= 1}><Trash2 size={14} /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <button type="button" className="btn btn-secondary btn-sm" onClick={addItem}>
        <Plus size={14} /> Add Product
      </button>

      {/* Discount & GST */}
      <div className="form-row mt-2">
        <div className="form-group">
          <label>Discount (%)</label>
          <input className="form-control" type="number" step="0.01" min="0" max="100" value={form.discount_pct} onChange={(e) => setForm({ ...form, discount_pct: e.target.value })} />
        </div>
        <div className="form-group">
          <label>GST (%)</label>
          <input className="form-control" type="number" step="0.01" min="0" max="100" value={form.gst_pct} onChange={(e) => setForm({ ...form, gst_pct: e.target.value })} />
        </div>
      </div>

      {/* Running Totals */}
      <div style={{
        padding: '16px 20px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-subtle)', marginTop: '16px',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.9rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="text-muted">Subtotal</span>
            <span>₹{subtotal.toFixed(2)}</span>
          </div>
          {discountPct > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="text-muted">Discount ({discountPct}%)</span>
              <span className="text-danger">-₹{discountAmt.toFixed(2)}</span>
            </div>
          )}
          {gstPct > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="text-muted">GST ({gstPct}%)</span>
              <span>+₹{gstAmt.toFixed(2)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-medium)', paddingTop: '8px', marginTop: '4px' }}>
            <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>Total</span>
            <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--accent-primary)' }}>₹{total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="modal-footer">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary">{invoice ? 'Update Invoice' : 'Create Invoice'}</button>
      </div>
    </form>
  );
}
