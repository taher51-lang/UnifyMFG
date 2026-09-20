// frontend/src/pages/Dashboard.jsx
// Manufacturing Dashboard — production-focused overview
// Shows: raw material stock, production stats, formulation costs, manufactured product stock

import { useState, useEffect } from 'react';
import {
  AlertTriangle,
  FlaskConical,
  TestTube2,
  Factory,
  CloudDownload,
  UploadCloud,
  RefreshCw,
  Package,
  TrendingUp,
} from 'lucide-react';
import client from '../api/client';

export default function Dashboard() {
  const [rmStock, setRmStock] = useState([]);
  const [fgStock, setFgStock] = useState([]);
  const [production, setProduction] = useState([]);
  const [formulations, setFormulations] = useState([]);
  const [lowStock, setLowStock] = useState(null);
  const [loading, setLoading] = useState(true);
  const [backingUp, setBackingUp] = useState(false);
  const [backingUpDrive, setBackingUpDrive] = useState(false);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [rmRes, fgRes, prodRes, formRes, lowRes] = await Promise.all([
          client.get('/inventory/raw-materials').catch(() => ({ data: [] })),
          client.get('/inventory/finished-goods').catch(() => ({ data: [] })),
          client.get('/inventory/production').catch(() => ({ data: [] })),
          client.get('/formulations').catch(() => ({ data: [] })),
          client.get('/reports/low-stock').catch(() => ({ data: null })),
        ]);
        setRmStock(rmRes.data || []);
        setFgStock(fgRes.data || []);
        setProduction(prodRes.data || []);
        setFormulations(formRes.data || []);
        setLowStock(lowRes.data);
      } catch (err) {
        console.error('Mfg Dashboard fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const handleManualBackup = async () => {
    if (backingUp) return;
    setBackingUp(true);
    try {
      const res = await client.post('/system/backup', {}, { responseType: 'blob' });
      const contentDisposition = res.headers?.['content-disposition'] || '';
      const filenameMatch = contentDisposition.match(/filename=(.+)/);
      const filename = filenameMatch ? filenameMatch[1] : `backup_${new Date().toISOString().slice(0,10)}.zip`;
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Error creating backup: ' + (err.message || 'Unknown error'));
    } finally {
      setBackingUp(false);
    }
  };

  const handleDriveBackup = async () => {
    if (backingUpDrive) return;
    setBackingUpDrive(true);
    try {
      const res = await client.post('/system/backup-drive');
      alert(res.data?.message || 'Backup uploaded to Google Drive successfully!');
    } catch (err) {
      alert('Error uploading to Google Drive: ' + (err.message || 'Unknown error'));
    } finally {
      setBackingUpDrive(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner" />
      </div>
    );
  }

  // Manufacturing-only metrics
  const rmLow = lowStock?.raw_materials || [];
  const fgLow = lowStock?.finished_goods || [];
  const totalRmAlerts = rmLow.length;
  const totalFormulations = formulations.length;
  const recentProduction = production.slice(0, 8);

  // Manufactured products = those linked to a formulation  
  const allProducts = fgStock;
  const manufacturedStock = allProducts.filter(p => {
    // A manufactured product is one that has a formulation link
    // We check if any formulation's products include this item
    return formulations.some(f => 
      allProducts.some(prod => prod.id === p.id)
    );
  });

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1>🏭 Manufacturing Dashboard</h1>
          <p>Production overview — raw materials, formulations, and manufactured goods</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            className="btn btn-secondary" 
            onClick={handleDriveBackup}
            disabled={backingUpDrive}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            {backingUpDrive ? (
              <RefreshCw size={18} className="spin" />
            ) : (
              <UploadCloud size={18} />
            )}
            {backingUpDrive ? 'Uploading...' : 'Upload to Drive'}
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={handleManualBackup}
            disabled={backingUp}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            {backingUp ? (
              <RefreshCw size={18} className="spin" />
            ) : (
              <CloudDownload size={18} />
            )}
            {backingUp ? 'Backing up...' : 'Download Local'}
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(108,99,255,0.15)', color: 'var(--accent-primary)' }}>
            <FlaskConical size={20} />
          </div>
          <div className="stat-value">{rmStock.length}</div>
          <div className="stat-label">Raw Materials</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(0,212,170,0.15)', color: 'var(--accent-secondary)' }}>
            <TestTube2 size={20} />
          </div>
          <div className="stat-value">{totalFormulations}</div>
          <div className="stat-label">Formulations (Recipes)</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(255,179,71,0.15)', color: 'var(--accent-warning)' }}>
            <Factory size={20} />
          </div>
          <div className="stat-value">{production.length}</div>
          <div className="stat-label">Production Runs</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{
            background: totalRmAlerts > 0 ? 'rgba(255,107,107,0.15)' : 'rgba(0,212,170,0.15)',
            color: totalRmAlerts > 0 ? 'var(--accent-danger)' : 'var(--accent-secondary)'
          }}>
            <AlertTriangle size={20} />
          </div>
          <div className="stat-value">{totalRmAlerts}</div>
          <div className="stat-label">Low Stock RM Alerts</div>
        </div>
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* Raw Materials Stock */}
        <div className="card">
          <div className="card-header">
            <h2>Raw Materials Stock</h2>
            <FlaskConical size={18} style={{ color: 'var(--text-muted)' }} />
          </div>
          {rmStock.length > 0 ? (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Material</th>
                    <th className="text-right">Stock</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rmStock.map((item) => (
                    <tr key={item.id}>
                      <td data-label="Material">{item.name}</td>
                      <td data-label="Stock" className="text-right">{parseFloat(item.stock_qty).toLocaleString('en-IN')} {item.unit}</td>
                      <td data-label="Status">
                        <span className={`badge ${item.is_low_stock ? 'badge-low-stock' : 'badge-ok'}`}>
                          {item.is_low_stock ? '⚠ Low' : 'OK'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state"><p>No raw materials</p></div>
          )}
        </div>

        {/* Formulations Overview */}
        <div className="card">
          <div className="card-header">
            <h2>Formulations</h2>
            <TestTube2 size={18} style={{ color: 'var(--text-muted)' }} />
          </div>
          {formulations.length > 0 ? (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Recipe</th>
                    <th className="text-right">Batch Size</th>
                    <th className="text-right">Batch Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {formulations.map((f) => (
                    <tr key={f.id}>
                      <td data-label="Recipe"><strong>{f.name}</strong></td>
                      <td data-label="Batch Size" className="text-right">{f.batch_size} {f.batch_unit}</td>
                      <td data-label="Batch Cost" className="text-right">₹{(parseFloat(f.cost_price) || 0).toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state"><p>No formulations</p></div>
          )}
        </div>
      </div>

      {/* Recent Production Runs */}
      {recentProduction.length > 0 && (
        <div className="card mt-2">
          <div className="card-header">
            <h2>Recent Production Runs</h2>
            <Factory size={18} style={{ color: 'var(--text-muted)' }} />
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Product</th>
                  <th className="text-right">Batches</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {recentProduction.map((p) => (
                  <tr key={p.id}>
                    <td data-label="Date">{p.produced_date || '—'}</td>
                    <td data-label="Product"><strong>{p.products?.name || '—'}</strong></td>
                    <td data-label="Batches" className="text-right">{parseFloat(p.batches_produced).toLocaleString('en-IN')}</td>
                    <td data-label="Notes" className="text-muted">{p.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Low Stock RM Alerts */}
      {rmLow.length > 0 && (
        <div className="card mt-2">
          <div className="card-header">
            <h2>⚠️ Low Stock Raw Materials</h2>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Material</th>
                  <th className="text-right">Current Stock</th>
                  <th className="text-right">Threshold</th>
                </tr>
              </thead>
              <tbody>
                {rmLow.map((item, i) => (
                  <tr key={i}>
                    <td data-label="Material">{item.name}</td>
                    <td data-label="Current Stock" className="text-right text-danger">{item.stock_qty} {item.unit || ''}</td>
                    <td data-label="Threshold" className="text-right">{item.low_stock_threshold} {item.unit || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
