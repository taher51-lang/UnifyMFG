// frontend/src/components/FormulaBuilder.jsx
// Recipe editor: ingredient lines, recipe settings, and batch converter tool.
// batch_size / batch_unit live here — they are recipe metadata, not product identity.

import { useState, useEffect } from 'react';
import { Plus, Trash2, FlaskConical, Printer, Scale } from 'lucide-react';
import client from '../api/client';

export default function FormulaBuilder({
  productId,
  sellingPrice,
  initialBatchSize,
  initialBatchUnit,
  onCostUpdate,
  onBatchUpdate,
}) {
  const [lines, setLines] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Recipe-level settings (saved with the formula)
  const [batchSize, setBatchSize] = useState('');
  const [batchUnit, setBatchUnit] = useState('kg');

  // Batch Converter (pure front-end, never saved)
  const [targetSize, setTargetSize] = useState('');
  const [converterOpen, setConverterOpen] = useState(false);

  // When the parent opens this modal for a product, sync recipe settings
  useEffect(() => {
    setBatchSize(initialBatchSize != null ? String(initialBatchSize) : '');
    setBatchUnit(initialBatchUnit || 'kg');
    setTargetSize('');
    setConverterOpen(false);
  }, [productId, initialBatchSize, initialBatchUnit]);

  // Fetch raw materials list + existing formula lines
  useEffect(() => {
    if (!productId) return;
    const fetchData = async () => {
      try {
        const [rmRes, formulaRes] = await Promise.all([
          client.get('/raw-materials'),
          client.get(`/products/${productId}/formula`),
        ]);
        setRawMaterials(rmRes.data || []);
        setLines(
          (formulaRes.data || []).map((f) => ({
            id: f.id,
            raw_material_id: f.raw_material_id,
            qty_per_batch: f.qty_per_batch,
            price_per_unit: f.raw_materials?.price_per_unit || 0,
            name: f.raw_materials?.name || '',
            unit: f.raw_materials?.unit || '',
          }))
        );
      } catch (err) {
        console.error('FormulaBuilder fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [productId]);

  // ── Line mutations ────────────────────────────────────────────────────
  const addLine = () =>
    setLines([...lines, { id: null, raw_material_id: '', qty_per_batch: '', price_per_unit: 0, name: '', unit: '' }]);

  const removeLine = (i) => setLines(lines.filter((_, idx) => idx !== i));

  const updateMaterial = (i, rmId) => {
    const rm = rawMaterials.find((r) => r.id === rmId);
    const updated = [...lines];
    updated[i] = {
      ...updated[i],
      raw_material_id: rmId,
      price_per_unit: rm ? parseFloat(rm.price_per_unit) : 0,
      name: rm?.name || '',
      unit: rm?.unit || '',
    };
    setLines(updated);
  };

  const updateQty = (i, qty) => {
    const updated = [...lines];
    updated[i] = { ...updated[i], qty_per_batch: qty };
    setLines(updated);
  };

  // ── Derived values ────────────────────────────────────────────────────
  const stdSize = parseFloat(batchSize) || 0;
  const tgtSize = parseFloat(targetSize) || 0;
  // Factor is only meaningful when converter is open and both sizes are valid
  const factor = converterOpen && stdSize > 0 && tgtSize > 0 ? tgtSize / stdSize : null;

  const totalCost = lines.reduce((sum, l) => {
    return sum + (parseFloat(l.qty_per_batch) || 0) * (parseFloat(l.price_per_unit) || 0);
  }, 0);

  const sp = parseFloat(sellingPrice) || 0;
  const margin = sp > 0 ? ((sp - totalCost) / sp) * 100 : 0;

  // ── Save ──────────────────────────────────────────────────────────────
  const saveFormula = async () => {
    setSaving(true);
    try {
      // 1. Persist recipe settings (batch_size, batch_unit) on the product row
      await client.put(`/products/${productId}`, {
        batch_size: stdSize || null,
        batch_unit: batchUnit.trim() || null,
      });

      // 2. Persist ingredient lines
      const validLines = lines
        .filter((l) => l.raw_material_id && parseFloat(l.qty_per_batch) > 0)
        .map((l) => ({
          raw_material_id: l.raw_material_id,
          qty_per_batch: parseFloat(l.qty_per_batch),
        }));
      const res = await client.put(`/products/${productId}/formula/bulk`, { lines: validLines });

      // 3. Notify parent
      if (onCostUpdate && res.data?.new_cost_price !== undefined) {
        onCostUpdate(res.data.new_cost_price);
      }
      if (onBatchUpdate) {
        onBatchUpdate(stdSize || null, batchUnit.trim() || null);
      }

      alert('Formulation saved.');
    } catch (err) {
      console.error('Save formula error:', err);
      alert('Failed to save formulation.');
    } finally {
      setSaving(false);
    }
  };

  // ── Print ─────────────────────────────────────────────────────────────
  const handlePrint = async () => {
    try {
      const params = converterOpen && tgtSize > 0 ? { target_size: tgtSize } : {};
      const response = await client.get(`/products/${productId}/print-formula`, {
        params,
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `BatchSheet_${productId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Print formula error:', err);
      alert('Failed to generate print sheet.');
    }
  };

  // ── Render ────────────────────────────────────────────────────────────
  if (loading) return <div className="loading-container"><div className="spinner" /></div>;

  const showScaled = factor !== null;

  return (
    <div>
      {/* ── RECIPE SETTINGS ─────────────────────────────────────────── */}
      <div style={{
        marginBottom: '16px',
        padding: '14px 18px',
        background: 'var(--bg-tertiary)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-subtle)',
      }}>
        <p style={{
          fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '10px'
        }}>
          Recipe Settings — all quantities below are per this standard batch
        </p>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ margin: 0, flex: '0 0 140px' }}>
            <label>Standard Batch Size</label>
            <input
              className="form-control"
              type="number"
              step="0.01"
              min="0"
              placeholder="e.g. 10"
              value={batchSize}
              onChange={(e) => setBatchSize(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ margin: 0, flex: '0 0 100px' }}>
            <label>Unit</label>
            <input
              className="form-control"
              placeholder="kg"
              value={batchUnit}
              onChange={(e) => setBatchUnit(e.target.value)}
            />
          </div>
          <button
            className={`btn btn-sm ${converterOpen ? 'btn-primary' : 'btn-secondary'}`}
            style={{ marginBottom: '0', height: '38px' }}
            onClick={() => { setConverterOpen(!converterOpen); setTargetSize(''); }}
            title="Calculate quantities for a different production run size"
          >
            <Scale size={14} />
            {converterOpen ? 'Close Converter' : 'Batch Converter'}
          </button>
        </div>
      </div>

      {/* ── BATCH CONVERTER ─────────────────────────────────────────── */}
      {converterOpen && (
        <div className="animate-in" style={{
          marginBottom: '16px',
          padding: '14px 18px',
          background: 'rgba(108, 99, 255, 0.04)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-accent)',
        }}>
          <p style={{
            fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase',
            letterSpacing: '0.06em', color: 'var(--accent-primary)', marginBottom: '10px'
          }}>
            Batch Converter — front-end only, does not change the saved recipe
          </p>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Standard: <strong>{stdSize > 0 ? `${stdSize} ${batchUnit}` : '—'}</strong>
            </div>
            <div style={{ color: 'var(--text-muted)' }}>→</div>
            <div className="form-group" style={{ margin: 0, flex: '0 0 160px' }}>
              <label>Target Run Size ({batchUnit})</label>
              <input
                className="form-control"
                type="number"
                step="0.01"
                min="0"
                placeholder={`e.g. ${stdSize > 0 ? stdSize * 2 : 20}`}
                value={targetSize}
                onChange={(e) => setTargetSize(e.target.value)}
              />
            </div>
            {factor !== null && (
              <div style={{
                padding: '6px 14px',
                background: 'var(--accent-primary-glow)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.9rem',
                fontWeight: 700,
                color: 'var(--accent-primary)',
              }}>
                × {factor.toFixed(4)}
              </div>
            )}
          </div>
          {stdSize <= 0 && (
            <p style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--accent-warning)' }}>
              ⚠ Set a Standard Batch Size above before using the converter.
            </p>
          )}
        </div>
      )}

      {/* ── INGREDIENTS TABLE ───────────────────────────────────────── */}
      <div className="table-container" style={{ marginBottom: '16px' }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: '35%' }}>Raw Material</th>
              <th className="text-right" style={{ width: showScaled ? '12%' : '15%' }}>
                Qty / Batch
              </th>
              {showScaled && (
                <th className="text-right" style={{ width: '12%', color: 'var(--accent-primary)' }}>
                  Scaled Qty
                </th>
              )}
              <th className="text-right" style={{ width: '10%' }}>Unit</th>
              <th className="text-right" style={{ width: showScaled ? '12%' : '15%' }}>Price/Unit</th>
              <th className="text-right" style={{ width: showScaled ? '12%' : '15%' }}>Line Cost</th>
              <th style={{ width: '50px' }}></th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td colSpan={showScaled ? 7 : 6} className="text-center text-muted" style={{ padding: '30px' }}>
                  <FlaskConical size={24} style={{ opacity: 0.3, marginBottom: '8px' }} />
                  <br />
                  No ingredients yet — add your first one below
                </td>
              </tr>
            ) : (
              lines.map((line, i) => {
                const qty = parseFloat(line.qty_per_batch) || 0;
                const price = parseFloat(line.price_per_unit) || 0;
                const lineCost = qty * price;
                const scaledQty = factor !== null ? qty * factor : null;

                return (
                  <tr key={i}>
                    <td data-label="Raw Material">
                      <select
                        className="form-control"
                        value={line.raw_material_id}
                        onChange={(e) => updateMaterial(i, e.target.value)}
                      >
                        <option value="">— Select —</option>
                        {rawMaterials.map((rm) => (
                          <option key={rm.id} value={rm.id}>
                            {rm.name} ({rm.unit})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td data-label="Qty / Batch">
                      <input
                        className="form-control text-right"
                        type="number"
                        step="0.0001"
                        min="0"
                        value={line.qty_per_batch}
                        onChange={(e) => updateQty(i, e.target.value)}
                        placeholder="0"
                      />
                    </td>
                    {showScaled && (
                      <td data-label="Scaled Qty" className="text-right" style={{
                        fontWeight: 700,
                        color: 'var(--accent-primary)',
                        fontSize: '0.95rem',
                      }}>
                        {scaledQty.toLocaleString('en-IN', {
                          minimumFractionDigits: 3,
                          maximumFractionDigits: 3,
                        })}
                      </td>
                    )}
                    <td data-label="Unit" className="text-right text-muted">{line.unit || '—'}</td>
                    <td data-label="Price/Unit" className="text-right">₹{price.toFixed(2)}</td>
                    <td data-label="Line Cost" className="text-right font-bold">₹{lineCost.toFixed(2)}</td>
                    <td data-label="">
                      <button
                        className="btn btn-danger btn-icon btn-sm"
                        onClick={() => removeLine(i)}
                        title="Remove"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add ingredient */}
      <button className="btn btn-secondary btn-sm" onClick={addLine}>
        <Plus size={14} /> Add Ingredient
      </button>

      {/* ── SUMMARY BAR ─────────────────────────────────────────────── */}
      <div style={{
        marginTop: '20px',
        padding: '16px 20px',
        background: 'var(--bg-tertiary)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-subtle)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <span className="text-muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Cost / Std Batch
            </span>
            <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>₹{totalCost.toFixed(2)}</div>
          </div>
          {showScaled && (
            <div>
              <span className="text-muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Cost / {tgtSize} {batchUnit}
              </span>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
                ₹{(totalCost * factor).toFixed(2)}
              </div>
            </div>
          )}
          <div>
            <span className="text-muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Selling Price
            </span>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
              ₹{sp.toFixed(2)}
            </div>
          </div>
          <div>
            <span className="text-muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Gross Margin
            </span>
            <div className={`margin-display ${margin >= 0 ? 'margin-positive' : 'margin-negative'}`}
              style={{ fontSize: '1.1rem', marginTop: '2px' }}>
              {margin.toFixed(1)}%
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              className="btn btn-secondary"
              onClick={handlePrint}
              title={showScaled ? `Print scaled sheet for ${tgtSize} ${batchUnit}` : 'Print standard batch sheet'}
            >
              <Printer size={16} /> {showScaled ? `Print ${tgtSize} ${batchUnit}` : 'Print Sheet'}
            </button>
            <button className="btn btn-primary" onClick={saveFormula} disabled={saving}>
              {saving ? 'Saving...' : 'Save Formulation'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
