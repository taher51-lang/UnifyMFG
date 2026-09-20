// frontend/src/components/IngredientEditor.jsx
// Ingredient editor for Formulations.
// Features: ingredient table, batch converter, print batch sheet.

import { useState, useEffect } from 'react';
import { Plus, Trash2, FlaskConical, Printer, Scale, Image as ImageIcon, UploadCloud, X } from 'lucide-react';
import client from '../api/client';

export default function IngredientEditor({ formulationId, batchSize, batchUnit, onCostUpdate, imageUrl, onImageChange }) {
  const [lines, setLines] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [deletingImage, setDeletingImage] = useState(false);

  // Batch Converter state
  const [converterOpen, setConverterOpen] = useState(false);
  const [stdSizeOverride, setStdSizeOverride] = useState('');   // lets user fix it inline
  const [targetSize, setTargetSize] = useState('');

  // Use the override if set, otherwise fall back to the prop
  const stdSize = parseFloat(stdSizeOverride || batchSize) || 0;
  const tgtSize = parseFloat(targetSize) || 0;

  // Only compute factor when everything is valid
  const factor = (converterOpen && stdSize > 0 && tgtSize > 0) ? tgtSize / stdSize : null;
  const showScaled = factor !== null;

  useEffect(() => {
    if (!formulationId) return;
    const fetchData = async () => {
      try {
        const [rmRes, ingRes, prodRes] = await Promise.all([
          client.get('/raw-materials'),
          client.get(`/formulations/${formulationId}/ingredients`),
          client.get('/products')
        ]);
        setRawMaterials(rmRes.data || []);
        
        // Only allow formulated products (compounds) to be used as ingredients
        const compoundProducts = (prodRes.data || []).filter(p => p.formulation_id !== formulationId);
        setProducts(compoundProducts);
        
        setLines(
          (ingRes.data || []).map((i) => {
            const isCompound = !!i.product_id;
            return {
              id: i.id,
              type: isCompound ? 'product' : 'raw_material',
              raw_material_id: i.raw_material_id || '',
              product_id: i.product_id || '',
              qty_per_batch: String(i.qty_per_batch),
              price_per_unit: isCompound ? (parseFloat(i.products?.cost_price) || 0) : (parseFloat(i.raw_materials?.price_per_unit) || 0),
              name: isCompound ? i.products?.name : i.raw_materials?.name || '',
              unit: isCompound ? (i.products?.selling_unit || 'unit') : i.raw_materials?.unit || '',
            };
          })
        );
      } catch (err) {
        console.error('IngredientEditor fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [formulationId]);

  const addLine = () =>
    setLines([...lines, { id: null, type: 'raw_material', raw_material_id: '', product_id: '', qty_per_batch: '', price_per_unit: 0, name: '', unit: '' }]);

  const removeLine = (i) => setLines(lines.filter((_, idx) => idx !== i));

  const updateType = (i, type) => {
    const updated = [...lines];
    updated[i] = {
      ...updated[i],
      type,
      raw_material_id: '',
      product_id: '',
      price_per_unit: 0,
      name: '',
      unit: '',
    };
    setLines(updated);
  };

  const updateMaterial = (i, val) => {
    const updated = [...lines];
    const line = updated[i];
    if (line.type === 'raw_material') {
      const rm = rawMaterials.find((r) => r.id === val);
      updated[i] = {
        ...line,
        raw_material_id: val,
        price_per_unit: rm ? parseFloat(rm.price_per_unit) : 0,
        name: rm?.name || '',
        unit: rm?.unit || '',
      };
    } else {
      const p = products.find((r) => r.id === val);
      updated[i] = {
        ...line,
        product_id: val,
        price_per_unit: p ? parseFloat(p.cost_price) : 0,
        name: p?.name || '',
        unit: p?.selling_unit || 'unit',
      };
    }
    setLines(updated);
  };

  const updateQty = (i, qty) => {
    const updated = [...lines];
    updated[i] = { ...updated[i], qty_per_batch: qty };
    setLines(updated);
  };

  const totalCost = lines.reduce((sum, l) =>
    sum + (parseFloat(l.qty_per_batch) || 0) * (parseFloat(l.price_per_unit) || 0), 0
  );

  const save = async () => {
    setSaving(true);
    try {
      const validLines = lines
        .filter((l) => (l.raw_material_id || l.product_id) && parseFloat(l.qty_per_batch) > 0)
        .map((l) => ({
          raw_material_id: l.type === 'raw_material' ? l.raw_material_id : null,
          product_id: l.type === 'product' ? l.product_id : null,
          qty_per_batch: parseFloat(l.qty_per_batch),
        }));

      const res = await client.put(`/formulations/${formulationId}/ingredients/bulk`, {
        lines: validLines,
      });

      if (onCostUpdate && res.data?.new_cost_price !== undefined) {
        onCostUpdate(res.data.new_cost_price);
      }
      alert('Ingredients saved. All linked product costs updated.');
    } catch (err) {
      console.error('Save error:', err);
      alert('Failed to save ingredients.');
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = async () => {
    try {
      const params = (converterOpen && tgtSize > 0) ? { target_size: tgtSize } : {};
      const response = await client.get(`/formulations/${formulationId}/print`, {
        params,
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `BatchSheet_${formulationId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert('Failed to generate batch sheet.');
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await client.post(`/formulations/${formulationId}/image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (onImageChange) onImageChange(res.data.image_url);
    } catch (err) {
      console.error('Image upload error:', err);
      alert('Failed to upload image.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleImageDelete = async () => {
    if (!confirm('Are you sure you want to remove this image?')) return;
    setDeletingImage(true);
    try {
      await client.delete(`/formulations/${formulationId}/image`);
      if (onImageChange) onImageChange(null);
    } catch (err) {
      console.error('Image delete error:', err);
      alert('Failed to remove image.');
    } finally {
      setDeletingImage(false);
    }
  };

  if (loading) return <div className="loading-container"><div className="spinner" /></div>;

  return (
    <div>
      {/* BATCH CONVERTER */}
      <div style={{
        marginBottom: '16px',
        padding: converterOpen ? '14px 16px' : '0',
        background: converterOpen ? 'rgba(108,99,255,0.05)' : 'transparent',
        border: converterOpen ? '1px solid var(--border-accent)' : 'none',
        borderRadius: 'var(--radius-md)',
        transition: 'all 0.2s ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Standard batch: <strong>{parseFloat(batchSize) > 0 ? `${batchSize} ${batchUnit || ''}` : '(not set)'}</strong>
          </div>
          <button
            className={`btn btn-sm ${converterOpen ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => {
              setConverterOpen(!converterOpen);
              setTargetSize('');
              setStdSizeOverride('');
            }}
          >
            <Scale size={14} /> {converterOpen ? 'Close Converter' : 'Batch Converter'}
          </button>
        </div>

        {converterOpen && (
          <div style={{ marginTop: '14px', display: 'flex', alignItems: 'flex-end', gap: '16px', flexWrap: 'wrap' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                Standard Batch ({batchUnit || 'unit'})
              </label>
              <input
                className="form-control"
                type="number"
                step="0.01"
                min="0"
                value={stdSizeOverride !== '' ? stdSizeOverride : (batchSize || '')}
                onChange={(e) => setStdSizeOverride(e.target.value)}
                placeholder="e.g. 40"
                style={{ width: '110px' }}
              />
            </div>

            <div style={{ fontSize: '1.4rem', color: 'var(--text-muted)', paddingBottom: '4px' }}>&#8594;</div>

            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                Target Run ({batchUnit || 'unit'})
              </label>
              <input
                className="form-control"
                type="number"
                step="0.01"
                min="0"
                value={targetSize}
                onChange={(e) => setTargetSize(e.target.value)}
                placeholder="e.g. 20"
                style={{ width: '110px' }}
              />
            </div>

            {factor !== null ? (
              <div style={{ paddingBottom: '4px' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Scale Factor
                </label>
                <span style={{
                  display: 'inline-block',
                  padding: '6px 14px',
                  background: 'var(--accent-primary-glow)',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: 700,
                  color: 'var(--accent-primary)',
                  fontSize: '1rem',
                }}>
                  x {factor.toFixed(4)}
                </span>
              </div>
            ) : (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', paddingBottom: '4px', alignSelf: 'flex-end', margin: 0 }}>
                Enter both sizes to calculate
              </p>
            )}
          </div>
        )}
      </div>

      {/* INGREDIENTS TABLE */}
      <div className="table-container" style={{ marginBottom: '16px', overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: '38%' }}>Ingredient</th>
              <th className="text-right" style={{ width: '12%' }}>Qty / Batch</th>
              {showScaled && (
                <th className="text-right" style={{ width: '12%', color: 'var(--accent-primary)' }}>
                  Scaled ({tgtSize} {batchUnit})
                </th>
              )}
              <th className="text-right" style={{ width: '8%' }}>Unit</th>
              <th className="text-right" style={{ width: '12%' }}>Rs/Unit</th>
              <th className="text-right" style={{ width: '12%' }}>Line Cost</th>
              <th style={{ width: '40px' }}></th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td colSpan={showScaled ? 7 : 6} className="text-center text-muted" style={{ padding: '32px' }}>
                  <div style={{ opacity: 0.4, marginBottom: '8px' }}><FlaskConical size={24} /></div>
                  No ingredients yet
                </td>
              </tr>
            ) : lines.map((line, i) => {
              const qty = parseFloat(line.qty_per_batch) || 0;
              const price = parseFloat(line.price_per_unit) || 0;
              const lineCost = qty * price;
              const scaledQty = factor !== null ? qty * factor : null;

              return (
                <tr key={i}>
                  <td data-label="Ingredient" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <label style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                        <input type="radio" name={`type_${i}`} checked={line.type === 'raw_material'} onChange={() => updateType(i, 'raw_material')} /> Raw Material
                      </label>
                      <label style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                        <input type="radio" name={`type_${i}`} checked={line.type === 'product'} onChange={() => updateType(i, 'product')} /> Compound
                      </label>
                    </div>
                    {line.type === 'raw_material' ? (
                      <select
                        className="form-control"
                        value={line.raw_material_id}
                        onChange={(e) => updateMaterial(i, e.target.value)}
                      >
                        <option value="">Select Raw Material</option>
                        {rawMaterials.map((rm) => (
                          <option key={rm.id} value={rm.id}>{rm.name} ({rm.unit})</option>
                        ))}
                      </select>
                    ) : (
                      <select
                        className="form-control"
                        value={line.product_id}
                        onChange={(e) => updateMaterial(i, e.target.value)}
                      >
                        <option value="">Select Compound</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>{p.name} ({p.selling_unit})</option>
                        ))}
                      </select>
                    )}
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
                    <td data-label="Scaled ({tgtSize} {batchUnit})" className="text-right" style={{
                      fontWeight: 700,
                      color: 'var(--accent-primary)',
                      fontSize: '0.97rem',
                      background: 'rgba(108,99,255,0.04)',
                    }}>
                      {scaledQty !== null
                        ? scaledQty.toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
                        : '0.000'}
                    </td>
                  )}
                  <td data-label="Unit" className="text-right text-muted" style={{ fontSize: '0.85rem' }}>{line.unit || '—'}</td>
                  <td data-label="Rs/Unit" className="text-right">Rs {price.toFixed(2)}</td>
                  <td data-label="Line Cost" className="text-right" style={{ fontWeight: 600 }}>Rs {lineCost.toFixed(2)}</td>
                  <td data-label="">
                    <button className="btn btn-danger btn-icon btn-sm" onClick={() => removeLine(i)}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <button className="btn btn-secondary btn-sm" onClick={addLine}>
        <Plus size={14} /> Add Ingredient
      </button>

      {/* HANDWRITTEN FORMULATION IMAGE */}
      <div style={{ marginTop: '24px' }}>
        <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ImageIcon size={16} /> Handwritten Formulation
        </h3>
        
        {imageUrl ? (
          <div style={{ position: 'relative', display: 'inline-block', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            <img src={imageUrl} alt="Handwritten Formulation" style={{ display: 'block', maxWidth: '100%', maxHeight: '400px', objectFit: 'contain' }} />
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={handleImageDelete}
              disabled={deletingImage}
              style={{ position: 'absolute', top: '8px', right: '8px', opacity: 0.9 }}
            >
              <X size={14} /> Remove
            </button>
          </div>
        ) : (
          <div style={{ 
            border: '1px dashed var(--border-medium)', 
            borderRadius: 'var(--radius-md)', 
            padding: '32px', 
            textAlign: 'center',
            background: 'var(--bg-tertiary)' 
          }}>
            <UploadCloud size={24} style={{ color: 'var(--text-muted)', marginBottom: '8px' }} />
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
              Upload a photo of the original handwritten recipe
            </p>
            <button type="button" className="btn btn-secondary btn-sm" style={{ position: 'relative', overflow: 'hidden' }} disabled={uploadingImage}>
              {uploadingImage ? 'Uploading...' : 'Choose Image'}
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={uploadingImage}
                style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
              />
            </button>
          </div>
        )}
      </div>

      {/* SUMMARY BAR */}
      <div style={{
        marginTop: '20px', padding: '16px 20px',
        background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-subtle)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
              Batch Cost {stdSize > 0 ? `(${stdSize} ${batchUnit})` : ''}
            </span>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '2px' }}>
              Rs {totalCost.toFixed(2)}
            </div>
          </div>

          {stdSize > 0 && (
            <div>
              <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
                Cost per {batchUnit}
              </span>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--accent-primary)', marginTop: '2px' }}>
                Rs {(totalCost / stdSize).toFixed(4)}
              </div>
            </div>
          )}

          {showScaled && (
            <div>
              <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
                Cost for {tgtSize} {batchUnit}
              </span>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--accent-secondary)', marginTop: '2px' }}>
                Rs {(totalCost * factor).toFixed(2)}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', marginLeft: 'auto' }}>
            <button className="btn btn-secondary" onClick={handlePrint}>
              <Printer size={16} /> {showScaled ? `Print ${tgtSize} ${batchUnit} Sheet` : 'Print Batch Sheet'}
            </button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Saving...' : 'Save Ingredients'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
