// frontend/src/pages/Reports.jsx
// Read-only dashboard: revenue, top products/customers, profit, consumption, low stock
// Now with Manufacturing vs Trading financial breakdown

import { useState, useEffect } from 'react';
import {
  DollarSign, TrendingUp, Package, Users, AlertTriangle, BarChart3, Factory, Store,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import client from '../api/client';

const CHART_COLORS = ['#6c63ff', '#00d4aa', '#ffb347', '#ff6b6b', '#4ecdc4', '#f093fb', '#3b82f6'];

export default function Reports() {
  const [revenue, setRevenue] = useState(null);
  const [topProducts, setTopProducts] = useState(null);
  const [topCustomers, setTopCustomers] = useState(null);
  const [profit, setProfit] = useState(null);
  const [consumption, setConsumption] = useState(null);
  const [lowStock, setLowStock] = useState(null);
  const [valuation, setValuation] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [revRes, topProdRes, topCustRes, profitRes, consRes, lowRes, valRes] = await Promise.all([
          client.get('/reports/revenue').catch(() => ({ data: null })),
          client.get('/reports/top-products').catch(() => ({ data: null })),
          client.get('/reports/top-customers').catch(() => ({ data: null })),
          client.get('/reports/profit-per-product').catch(() => ({ data: null })),
          client.get('/reports/consumption').catch(() => ({ data: null })),
          client.get('/reports/low-stock').catch(() => ({ data: null })),
          client.get('/reports/valuation').catch(() => ({ data: null })),
        ]);
        setRevenue(revRes.data);
        setTopProducts(topProdRes.data);
        setTopCustomers(topCustRes.data);
        setProfit(profitRes.data);
        setConsumption(consRes.data);
        setLowStock(lowRes.data);
        setValuation(valRes.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  if (loading) {
    return <div className="loading-container"><div className="spinner" /></div>;
  }

  const monthRevenue = revenue?.month_revenue || 0;
  const yearRevenue = revenue?.year_revenue || 0;
  const totalAlerts = lowStock?.total_alerts || 0;
  const totalCapital = valuation?.total_capital || 0;
  const rmCapital = valuation?.raw_material_capital || 0;
  const fgCapital = valuation?.finished_goods_capital || 0;

  // Split profit data into manufactured vs traded
  const allProfit = profit || [];
  const mfgProfit = allProfit.filter(p => p.product_type === 'manufactured');
  const tradedProfit = allProfit.filter(p => p.product_type === 'traded');

  const mfgTotalRevenue = mfgProfit.reduce((s, p) => s + p.revenue, 0);
  const mfgTotalProfit = mfgProfit.reduce((s, p) => s + p.profit, 0);
  const tradedTotalRevenue = tradedProfit.reduce((s, p) => s + p.revenue, 0);
  const tradedTotalProfit = tradedProfit.reduce((s, p) => s + p.profit, 0);

  // Prepare chart data
  const profitChartData = allProfit.slice(0, 8).map((p) => ({
    name: p.name?.length > 12 ? p.name.slice(0, 12) + '…' : p.name,
    profit: p.profit,
    revenue: p.revenue,
    type: p.product_type,
  }));

  const topProductsPieData = (topProducts?.by_revenue || []).map((p) => ({
    name: p.name,
    value: p.total_revenue,
  }));

  // Business split pie data
  const splitPieData = [
    ...(mfgTotalRevenue > 0 ? [{ name: '🏭 Manufacturing', value: mfgTotalRevenue }] : []),
    ...(tradedTotalRevenue > 0 ? [{ name: '🏪 Trading', value: tradedTotalRevenue }] : []),
  ];

  // Aggregate consumption by raw material
  const consumptionAgg = {};
  (consumption || []).forEach((c) => {
    const key = c.raw_material;
    if (!consumptionAgg[key]) consumptionAgg[key] = { name: key, qty: 0, unit: c.unit };
    consumptionAgg[key].qty += c.qty_consumed;
  });
  const consumptionChartData = Object.values(consumptionAgg)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10);

  const renderProfitTable = (data, label, icon, accentColor) => (
    <div className="card">
      <div className="card-header">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {icon} {label} Profitability
        </h2>
        <div style={{ fontSize: '0.8rem', color: accentColor, fontWeight: 600 }}>
          Rev: ₹{data.reduce((s, p) => s + p.revenue, 0).toLocaleString('en-IN')} | 
          Profit: ₹{data.reduce((s, p) => s + p.profit, 0).toLocaleString('en-IN')}
        </div>
      </div>
      {data.length > 0 ? (
        <div className="table-container">
          <table>
            <thead><tr><th>Product</th><th className="text-right">Qty Sold</th><th className="text-right">Revenue</th><th className="text-right">Profit</th><th className="text-right">Margin</th></tr></thead>
            <tbody>
              {data.map((p, i) => (
                <tr key={i}>
                  <td data-label="Product">{p.name}</td>
                  <td data-label="Qty Sold" className="text-right">{p.qty_sold}</td>
                  <td data-label="Revenue" className="text-right">₹{p.revenue.toLocaleString('en-IN')}</td>
                  <td data-label="Profit" className="text-right" style={{ color: p.profit >= 0 ? 'var(--accent-secondary)' : 'var(--accent-danger)' }}>₹{p.profit.toLocaleString('en-IN')}</td>
                  <td data-label="Margin" className="text-right">
                    <span className={`margin-display ${p.margin_pct >= 0 ? 'margin-positive' : 'margin-negative'}`}>
                      {p.margin_pct}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <div className="empty-state"><p>No {label.toLowerCase()} sales data</p></div>}
    </div>
  );

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1>Reports</h1>
                  <p>Business analytics — Manufacturing vs Trading breakdown</p>
        </div>
      </div>

      {/* Capital in Stock Stat Card */}
      {valuation && (
        <div className="card" style={{ marginBottom: '28px', background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
          <div style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(108,99,255,0.15)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Package size={24} />
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Capital in Stock</div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>₹{totalCapital.toLocaleString('en-IN')}</div>
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', background: 'var(--bg-tertiary)', padding: '16px', borderRadius: '8px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-secondary)' }} />
                  Raw Materials
                </div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>₹{rmCapital.toLocaleString('en-IN')}</div>
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-primary)' }} />
                  Finished Goods
                </div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>₹{fgCapital.toLocaleString('en-IN')}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Revenue Cards */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(108,99,255,0.15)', color: 'var(--accent-primary)' }}>
            <DollarSign size={20} />
          </div>
          <div className="stat-value">₹{monthRevenue.toLocaleString('en-IN')}</div>
          <div className="stat-label">{revenue?.month || 'This Month'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(0,212,170,0.15)', color: 'var(--accent-secondary)' }}>
            <TrendingUp size={20} />
          </div>
          <div className="stat-value">₹{yearRevenue.toLocaleString('en-IN')}</div>
          <div className="stat-label">Year to Date</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(255,179,71,0.15)', color: 'var(--accent-warning)' }}>
            <BarChart3 size={20} />
          </div>
          <div className="stat-value">{allProfit.length}</div>
          <div className="stat-label">Products Sold</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{
            background: totalAlerts > 0 ? 'rgba(255,107,107,0.15)' : 'rgba(0,212,170,0.15)',
            color: totalAlerts > 0 ? 'var(--accent-danger)' : 'var(--accent-secondary)'
          }}>
            <AlertTriangle size={20} />
          </div>
          <div className="stat-value">{totalAlerts}</div>
          <div className="stat-label">Low Stock Alerts</div>
        </div>
      </div>

      {/* Manufacturing vs Trading Summary */}
      {(mfgTotalRevenue > 0 || tradedTotalRevenue > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 0.8fr', gap: '16px', marginBottom: '16px' }}>
          <div className="stat-card" style={{ borderLeft: '4px solid var(--accent-primary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Factory size={18} style={{ color: 'var(--accent-primary)' }} />
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent-primary)' }}>Manufacturing</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Revenue</div>
                <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>₹{mfgTotalRevenue.toLocaleString('en-IN')}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Profit</div>
                <div style={{ fontWeight: 700, fontSize: '1.1rem', color: mfgTotalProfit >= 0 ? 'var(--accent-secondary)' : 'var(--accent-danger)' }}>₹{mfgTotalProfit.toLocaleString('en-IN')}</div>
              </div>
            </div>
          </div>

          <div className="stat-card" style={{ borderLeft: '4px solid var(--accent-secondary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Store size={18} style={{ color: 'var(--accent-secondary)' }} />
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent-secondary)' }}>Trading</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Revenue</div>
                <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>₹{tradedTotalRevenue.toLocaleString('en-IN')}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Profit</div>
                <div style={{ fontWeight: 700, fontSize: '1.1rem', color: tradedTotalProfit >= 0 ? 'var(--accent-secondary)' : 'var(--accent-danger)' }}>₹{tradedTotalProfit.toLocaleString('en-IN')}</div>
              </div>
            </div>
          </div>

          {/* Split Pie Chart */}
          {splitPieData.length > 0 && (
            <div className="stat-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px' }}>
              <ResponsiveContainer width="100%" height={120}>
                <PieChart>
                  <Pie data={splitPieData} cx="50%" cy="50%" innerRadius={30} outerRadius={50} paddingAngle={4} dataKey="value">
                    <Cell fill="#6c63ff" />
                    <Cell fill="#00d4aa" />
                  </Pie>
                  <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '8px', color: '#1a1a2e', fontSize: '0.8rem' }} formatter={(value) => [`₹${value.toLocaleString('en-IN')}`, 'Revenue']} />
                  <Legend wrapperStyle={{ fontSize: '0.7rem' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '16px', marginBottom: '16px' }}>
        {/* Profit Chart */}
        <div className="card">
          <div className="card-header">
            <h2>Profit per Product</h2>
          </div>
          {profitChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={profitChartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <XAxis dataKey="name" tick={{ fill: '#636e80', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#636e80', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '8px', color: '#1a1a2e' }}
                  formatter={(value) => [`₹${value.toLocaleString('en-IN')}`, '']}
                />
                <Bar dataKey="profit" fill="url(#profitGradient)" radius={[4, 4, 0, 0]} />
                <defs>
                  <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6c63ff" />
                    <stop offset="100%" stopColor="#3b82f6" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state"><p>No profit data yet</p></div>
          )}
        </div>

        {/* Top Products Pie */}
        <div className="card">
          <div className="card-header">
            <h2>Revenue by Product</h2>
          </div>
          {topProductsPieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={topProductsPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} labelLine={false}>
                  {topProductsPieData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '8px', color: '#1a1a2e' }} formatter={(value) => [`₹${value.toLocaleString('en-IN')}`, 'Revenue']} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state"><p>No sales data yet</p></div>
          )}
        </div>
      </div>

      {/* Manufacturing vs Trading Profit Tables */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        {renderProfitTable(mfgProfit, 'Manufacturing', <Factory size={16} style={{ color: 'var(--accent-primary)' }} />, 'var(--accent-primary)')}
        {renderProfitTable(tradedProfit, 'Trading', <Store size={16} style={{ color: 'var(--accent-secondary)' }} />, 'var(--accent-secondary)')}
      </div>

      {/* Top Customers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <div className="card">
          <div className="card-header">
            <h2>Top Customers</h2>
            <Users size={18} style={{ color: 'var(--text-muted)' }} />
          </div>
          {(topCustomers || []).length > 0 ? (
            <div className="table-container">
              <table>
                <thead><tr><th>Customer</th><th className="text-right">Invoices</th><th className="text-right">Revenue</th></tr></thead>
                <tbody>
                  {topCustomers.map((c, i) => (
                    <tr key={i}>
                      <td data-label="Customer"><strong>{c.name}</strong>{c.company ? <span className="text-muted"> ({c.company})</span> : ''}</td>
                      <td data-label="Invoices" className="text-right">{c.invoice_count}</td>
                      <td data-label="Revenue" className="text-right">₹{c.total_revenue.toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="empty-state"><p>No customer data</p></div>}
        </div>

        {/* Raw Material Consumption */}
        <div className="card">
          <div className="card-header">
            <h2>Raw Material Consumption</h2>
          </div>
          {consumptionChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={consumptionChartData} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 80 }}>
                <XAxis type="number" tick={{ fill: '#636e80', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#9898b0', fontSize: 11 }} axisLine={false} tickLine={false} width={80} />
                <Tooltip
                  contentStyle={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '8px', color: '#1a1a2e' }}
                  formatter={(value, name, props) => [`${value.toFixed(2)} ${props.payload.unit}`, 'Consumed']}
                />
                <Bar dataKey="qty" fill="url(#consumptionGradient)" radius={[0, 4, 4, 0]} />
                <defs>
                  <linearGradient id="consumptionGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#00d4aa" />
                    <stop offset="100%" stopColor="#00b4d8" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state"><p>No consumption data yet — record some production batches to see trends</p></div>
          )}
        </div>
      </div>

      {/* Low Stock Summary */}
      {totalAlerts > 0 && (
        <div className="card">
          <div className="card-header">
            <h2>⚠️ Low Stock Summary</h2>
          </div>
          <div className="table-container">
            <table>
              <thead><tr><th>Item</th><th>Type</th><th className="text-right">Stock</th><th className="text-right">Threshold</th><th className="text-right">Deficit</th></tr></thead>
              <tbody>
                {[...(lowStock?.raw_materials || []), ...(lowStock?.finished_goods || [])].map((item, i) => (
                  <tr key={i}>
                    <td data-label="Item"><strong>{item.name}</strong></td>
                    <td data-label="Type"><span className="badge badge-low-stock">{item.type === 'raw_material' ? 'Raw Material' : 'Product'}</span></td>
                    <td data-label="Stock" className="text-right text-danger">{item.stock_qty}</td>
                    <td data-label="Threshold" className="text-right">{item.low_stock_threshold}</td>
                    <td data-label="Deficit" className="text-right text-danger font-bold">{item.deficit}</td>
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
