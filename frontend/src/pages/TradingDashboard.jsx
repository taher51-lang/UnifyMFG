// frontend/src/pages/TradingDashboard.jsx
// Trading dashboard — buy/sell overview for general trading products
// Shows: revenue, product stock, recent invoices, top customers, product purchase summary

import { useState, useEffect } from 'react';
import {
  TrendingUp,
  Package,
  AlertTriangle,
  Users,
  DollarSign,
  ShoppingCart,
  PackagePlus,
} from 'lucide-react';
import client from '../api/client';

export default function TradingDashboard() {
  const [revenue, setRevenue] = useState(null);
  const [lowStock, setLowStock] = useState(null);
  const [topProducts, setTopProducts] = useState(null);
  const [topCustomers, setTopCustomers] = useState(null);
  const [productPurchases, setProductPurchases] = useState([]);
  const [fgStock, setFgStock] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [revRes, lowRes, topProdRes, topCustRes, ppRes, fgRes] = await Promise.all([
          client.get('/reports/revenue').catch(() => ({ data: null })),
          client.get('/reports/low-stock').catch(() => ({ data: null })),
          client.get('/reports/top-products').catch(() => ({ data: null })),
          client.get('/reports/top-customers').catch(() => ({ data: null })),
          client.get('/inventory/product-purchases').catch(() => ({ data: [] })),
          client.get('/inventory/finished-goods').catch(() => ({ data: [] })),
        ]);
        setRevenue(revRes.data);
        setLowStock(lowRes.data);
        setTopProducts(topProdRes.data);
        setTopCustomers(topCustRes.data);
        setProductPurchases(ppRes.data || []);
        setFgStock(fgRes.data || []);
      } catch (err) {
        console.error('Trading Dashboard fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner" />
      </div>
    );
  }

  const monthRevenue = revenue?.month_revenue || 0;
  const yearRevenue = revenue?.year_revenue || 0;
  const fgAlerts = lowStock?.finished_goods?.length || 0;
  const totalPurchaseSpent = productPurchases.reduce((sum, p) => sum + parseFloat(p.price_paid || 0), 0);
  const recentPurchases = productPurchases.slice(0, 5);

  // Split stock into bulk products (with packaging) and regular
  const bulkProducts = fgStock.filter(p => parseFloat(p.packaging_size) > 0);
  const lowStockFG = fgStock.filter(p => p.is_low_stock);

  const round2 = (v) => Math.round(v * 100) / 100;

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1>🏪 Trading Dashboard</h1>
          <p>Buy & sell products — revenue, stock, and customer overview</p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(108,99,255,0.15)', color: 'var(--accent-primary)' }}>
            <DollarSign size={20} />
          </div>
          <div className="stat-value">₹{monthRevenue.toLocaleString('en-IN')}</div>
          <div className="stat-label">Revenue This Month</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(0,212,170,0.15)', color: 'var(--accent-secondary)' }}>
            <TrendingUp size={20} />
          </div>
          <div className="stat-value">₹{yearRevenue.toLocaleString('en-IN')}</div>
          <div className="stat-label">Revenue This Year</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(255,179,71,0.15)', color: 'var(--accent-warning)' }}>
            <PackagePlus size={20} />
          </div>
          <div className="stat-value">₹{totalPurchaseSpent.toLocaleString('en-IN')}</div>
          <div className="stat-label">Total Product Purchases</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{
            background: fgAlerts > 0 ? 'rgba(255,107,107,0.15)' : 'rgba(0,212,170,0.15)',
            color: fgAlerts > 0 ? 'var(--accent-danger)' : 'var(--accent-secondary)'
          }}>
            <AlertTriangle size={20} />
          </div>
          <div className="stat-value">{fgAlerts}</div>
          <div className="stat-label">Low Stock Products</div>
        </div>
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* Top Products */}
        <div className="card">
          <div className="card-header">
            <h2>Top Products (by Revenue)</h2>
            <Package size={18} style={{ color: 'var(--text-muted)' }} />
          </div>
          {topProducts?.by_revenue?.length > 0 ? (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th className="text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.by_revenue.map((p, i) => (
                    <tr key={i}>
                      <td data-label="Product">{p.name}</td>
                      <td data-label="Revenue" className="text-right">₹{(p.total_revenue || 0).toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <p>No sales data yet</p>
            </div>
          )}
        </div>

        {/* Top Customers */}
        <div className="card">
          <div className="card-header">
            <h2>Top Customers</h2>
            <Users size={18} style={{ color: 'var(--text-muted)' }} />
          </div>
          {topCustomers?.length > 0 ? (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th className="text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {topCustomers.map((c, i) => (
                    <tr key={i}>
                      <td data-label="Customer">{c.name}{c.company ? ` (${c.company})` : ''}</td>
                      <td data-label="Revenue" className="text-right">₹{(c.total_revenue || 0).toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <p>No customer data yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Bulk Product Stock */}
      {bulkProducts.length > 0 && (
        <div className="card mt-2">
          <div className="card-header">
            <h2>📦 Bulk Product Stock</h2>
            <ShoppingCart size={18} style={{ color: 'var(--text-muted)' }} />
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="text-right">Stock</th>
                  <th>Packaging</th>
                  <th className="text-right">Bags</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {bulkProducts.map((item) => {
                  const stockQty = parseFloat(item.stock_qty || 0);
                  const pkgSize = parseFloat(item.packaging_size);
                  const unit = item.selling_unit || '';
                  const bags = Math.floor(stockQty / pkgSize);
                  const loose = round2(stockQty % pkgSize);
                  return (
                    <tr key={item.id}>
                      <td data-label="Product"><strong>{item.name}</strong></td>
                      <td data-label="Stock" className="text-right" style={{ fontWeight: 600 }}>
                        {stockQty.toLocaleString('en-IN')} {unit}
                      </td>
                      <td data-label="Packaging">
                        <span className="badge badge-confirmed" style={{ fontSize: '0.72rem' }}>
                          {pkgSize} {unit}/{item.packaging_unit}
                        </span>
                      </td>
                      <td data-label="Bags" className="text-right">
                        {bags} {item.packaging_unit}{bags !== 1 ? 's' : ''}
                        {loose > 0 && <span className="text-muted"> + {loose} {unit}</span>}
                      </td>
                      <td data-label="Status">
                        <span className={`badge ${item.is_low_stock ? 'badge-low-stock' : 'badge-ok'}`}>
                          {item.is_low_stock ? '⚠ Low' : 'OK'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Product Purchases */}
      {recentPurchases.length > 0 && (
        <div className="card mt-2">
          <div className="card-header">
            <h2>Recent Product Purchases</h2>
            <PackagePlus size={18} style={{ color: 'var(--text-muted)' }} />
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Product</th>
                  <th className="text-right">Packages</th>
                  <th className="text-right">Units Added</th>
                  <th className="text-right">Price Paid</th>
                  <th>Supplier</th>
                </tr>
              </thead>
              <tbody>
                {recentPurchases.map((pp) => {
                  const prod = pp.products || {};
                  const unit = prod.selling_unit || '';
                  const pkgUnit = prod.packaging_unit || 'units';
                  return (
                    <tr key={pp.id}>
                      <td data-label="Date">{pp.purchase_date || '—'}</td>
                      <td data-label="Product"><strong>{prod.name || '—'}</strong></td>
                      <td data-label="Packages" className="text-right">
                        {parseFloat(pp.qty_packages).toLocaleString('en-IN')} {pkgUnit}{parseFloat(pp.qty_packages) !== 1 ? 's' : ''}
                      </td>
                      <td data-label="Units Added" className="text-right" style={{ color: 'var(--accent-secondary)', fontWeight: 600 }}>
                        +{parseFloat(pp.qty_units).toLocaleString('en-IN')} {unit}
                      </td>
                      <td data-label="Price Paid" className="text-right">₹{parseFloat(pp.price_paid || 0).toLocaleString('en-IN')}</td>
                      <td data-label="Supplier">{pp.supplier || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Low Stock Products */}
      {lowStockFG.length > 0 && (
        <div className="card mt-2">
          <div className="card-header">
            <h2>⚠️ Low Stock Products</h2>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="text-right">Current Stock</th>
                  <th className="text-right">Threshold</th>
                </tr>
              </thead>
              <tbody>
                {lowStockFG.map((item, i) => {
                  const unit = item.selling_unit || item.batch_unit || '';
                  return (
                    <tr key={i}>
                      <td data-label="Product">{item.name}</td>
                      <td data-label="Current Stock" className="text-right text-danger">{item.stock_qty} {unit}</td>
                      <td data-label="Threshold" className="text-right">{item.low_stock_threshold} {unit}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
