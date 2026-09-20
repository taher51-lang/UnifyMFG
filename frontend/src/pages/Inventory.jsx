// frontend/src/pages/Inventory.jsx
// Stock levels, low-stock alerts, purchase log, and production log
// Tabbed interface: Stock | Purchases | Production

import { useState, useEffect } from 'react';
import { Plus, X, AlertTriangle, Package, ShoppingCart, Factory, DownloadCloud, PackagePlus } from 'lucide-react';
import client from '../api/client';
import { exportToCSV } from '../utils/csvExport';
import ScanStock from "../components/ScanStock";
import VoiceStock from "../components/VoiceStock";
import ManualStock from "../components/ManualStock";

export default function Inventory() {
  const [activeTab, setActiveTab] = useState('stock');
  const [updateMode, setUpdateMode] = useState('scan');
  const [rmStock, setRmStock] = useState([]);
  const [fgStock, setFgStock] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [productPurchases, setProductPurchases] = useState([]);
  const [production, setProduction] = useState([]);
  const [loosePacking, setLoosePacking] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [products, setProducts] = useState([]);
  const [formulations, setFormulations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showProductPurchaseModal, setShowProductPurchaseModal] = useState(false);
  const [showProductionModal, setShowProductionModal] = useState(false);
  const [showLoosePackingModal, setShowLoosePackingModal] = useState(false);
  const [toast, setToast] = useState(null);

  const [purchaseForm, setPurchaseForm] = useState({
    raw_material_id: '', qty: '', price_paid: '', supplier: '', purchase_date: '', notes: '',
  });
  const [productionForm, setProductionForm] = useState({
    formulation_id: '', batches_produced: '', produced_date: '', notes: '', yields: {}
  });
  const [loosePackingForm, setLoosePackingForm] = useState({
    bulk_product_id: '', yield_product_id: '', bulk_product_qty: '', yield_product_qty: '', packing_date: new Date().toISOString().split('T')[0], notes: ''
  });

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const [productPurchaseForm, setProductPurchaseForm] = useState({
    product_id: '', qty_packages: '', price_paid: '', supplier: '', purchase_date: '', notes: '',
  });

  const fetchData = async () => {
    try {
      const [rmRes, fgRes, purRes, ppRes, prodRes, looseRes, rmListRes, prodListRes, formRes, ledgerRes] = await Promise.all([
        client.get('/inventory/raw-materials'),
        client.get('/inventory/finished-goods'),
        client.get('/inventory/purchases'),
        client.get('/inventory/product-purchases'),
        client.get('/inventory/production'),
        client.get('/inventory/loose-packing'),
        client.get('/raw-materials'),
        client.get('/products'),
        client.get('/formulations'),
        client.get('/inventory/ledger')
      ]);
      setRmStock(rmRes.data || []);
      setFgStock(fgRes.data || []);
      setPurchases(purRes.data || []);
      setProductPurchases(ppRes.data || []);
      setProduction(prodRes.data || []);
      setLoosePacking(looseRes.data || []);
      setRawMaterials(rmListRes.data || []);
      setProducts(prodListRes.data || []);
      setFormulations(formRes.data || []);
      setLedger(ledgerRes.data || []);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handlePurchase = async (e) => {
    e.preventDefault();
    try {
      await client.post('/inventory/purchases', {
        ...purchaseForm,
        qty: parseFloat(purchaseForm.qty),
        price_paid: parseFloat(purchaseForm.price_paid || 0),
      });
      showToast('Purchase recorded — stock updated');
      setShowPurchaseModal(false);
      setPurchaseForm({ raw_material_id: '', qty: '', price_paid: '', supplier: '', purchase_date: '', notes: '' });
      fetchData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleProduction = async (e) => {
    e.preventDefault();
    try {
      const yieldsArray = Object.entries(productionForm.yields)
        .map(([product_id, quantity]) => ({ product_id, quantity: parseFloat(quantity) }))
        .filter(y => !isNaN(y.quantity) && y.quantity > 0);

      const res = await client.post('/inventory/production', {
        formulation_id: productionForm.formulation_id,
        batches_produced: parseFloat(productionForm.batches_produced),
        produced_date: productionForm.produced_date,
        notes: productionForm.notes,
        yields: yieldsArray
      });
      const data = res.data;
      showToast(`Recorded yield of ${data.products_yielded} products — raw materials deducted`);
      setShowProductionModal(false);
      setProductionForm({ formulation_id: '', batches_produced: '', produced_date: '', notes: '', yields: {} });
      fetchData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleProductPurchase = async (e) => {
    e.preventDefault();
    try {
      await client.post('/inventory/product-purchases', {
        ...productPurchaseForm,
        qty_packages: parseFloat(productPurchaseForm.qty_packages),
        price_paid: parseFloat(productPurchaseForm.price_paid || 0),
      });
      showToast('Product purchase recorded — stock updated');
      setShowProductPurchaseModal(false);
      setProductPurchaseForm({ product_id: '', qty_packages: '', price_paid: '', supplier: '', purchase_date: '', notes: '' });
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.error || err.message, 'error');
    }
  };

  const handleLoosePacking = async (e) => {
    e.preventDefault();
    try {
      await client.post('/inventory/loose-packing', {
        ...loosePackingForm,
        bulk_product_qty: parseFloat(loosePackingForm.bulk_product_qty),
        yield_product_qty: parseFloat(loosePackingForm.yield_product_qty)
      });
      showToast('Loose products packed — stock updated');
      setShowLoosePackingModal(false);
      setLoosePackingForm({ bulk_product_id: '', yield_product_id: '', bulk_product_qty: '', yield_product_qty: '', packing_date: '', notes: '' });
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.error || err.message, 'error');
    }
  };

  // Helper for selected product in product purchase form
  const selectedPurchaseProduct = products.find(p => p.id === productPurchaseForm.product_id);
  const purchasePreviewUnits = (() => {
    if (!selectedPurchaseProduct || !productPurchaseForm.qty_packages) return null;
    const pkgSize = parseFloat(selectedPurchaseProduct.packaging_size) || 0;
    const qty = parseFloat(productPurchaseForm.qty_packages) || 0;
    if (pkgSize > 0) return qty * pkgSize;
    return qty;
  })();

  const round2 = (v) => Math.round(v * 100) / 100;

  const exportRMStock = () => {
    exportToCSV(rmStock, 'raw_materials_stock.csv', [
      { key: 'name', label: 'Material' },
      { key: 'unit', label: 'Unit' },
      { key: 'stock_qty', label: 'Current Stock' },
      { key: 'low_stock_threshold', label: 'Low Stock Threshold' },
      { key: 'is_low_stock', label: 'Status', formatter: (v) => v ? 'Low Stock' : 'OK' }
    ]);
  };

  const exportFGStock = () => {
    exportToCSV(fgStock, 'finished_goods_stock.csv', [
      { key: 'name', label: 'Product' },
      { key: 'batch_unit', label: 'Unit' },
      { key: 'stock_qty', label: 'Current Stock' },
      { key: 'low_stock_threshold', label: 'Low Stock Threshold' },
      { key: 'is_low_stock', label: 'Status', formatter: (v) => v ? 'Low Stock' : 'OK' }
    ]);
  };

  const exportPurchases = () => {
    exportToCSV(purchases, 'purchases_log.csv', [
      { key: 'purchase_date', label: 'Date' },
      { key: 'raw_materials', label: 'Material', formatter: (v) => v?.name || '' },
      { key: 'qty', label: 'Quantity' },
      { key: 'price_paid', label: 'Price Paid (₹)' },
      { key: 'supplier', label: 'Supplier' },
      { key: 'notes', label: 'Notes' }
    ]);
  };
  const exportProduction = () => {
    exportToCSV(production, 'production_log.csv', [
      { key: 'produced_date', label: 'Date' },
      { key: 'products', label: 'Product', formatter: (v) => v?.name || '' },
      { key: 'batches_produced', label: 'Batches Produced' },
      { key: 'notes', label: 'Notes' }
    ]);
  };

  if (loading) {
    return <div className="loading-container"><div className="spinner" /></div>;
  }

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1>Inventory</h1>
                  <p>Stock levels, purchases, and production tracking</p>
        </div>
      </div>
      {/* Quick Stock Update Section (Scan vs Voice) */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <button 
          className={`btn btn-sm ${updateMode === 'scan' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setUpdateMode('scan')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          📷 Scan Stock Sheet
        </button>
        <button 
          className={`btn btn-sm ${updateMode === 'voice' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setUpdateMode('voice')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          🎤 Voice Stock Update
        </button>
        <button 
          className={`btn btn-sm ${updateMode === 'manual' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setUpdateMode('manual')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          ✏️ Manual Entry
        </button>
      </div>

      {updateMode === 'scan' ? <ScanStock /> : updateMode === 'voice' ? <VoiceStock /> : <ManualStock />}


      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${activeTab === 'stock' ? 'active' : ''}`} onClick={() => setActiveTab('stock')}>
          <Package size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Stock Levels
        </button>
        <button className={`tab ${activeTab === 'ledger' ? 'active' : ''}`} onClick={() => setActiveTab('ledger')}>
          <DownloadCloud size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Stock Ledger
        </button>
        <button className={`tab ${activeTab === 'purchases' ? 'active' : ''}`} onClick={() => setActiveTab('purchases')}>
          <ShoppingCart size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> RM Purchases
        </button>
        <button className={`tab ${activeTab === 'product-purchases' ? 'active' : ''}`} onClick={() => setActiveTab('product-purchases')}>
          <PackagePlus size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Product Purchases
        </button>
        <button className={`tab ${activeTab === 'production' ? 'active' : ''}`} onClick={() => setActiveTab('production')}>
          <Factory size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Production
        </button>
        <button className={`tab ${activeTab === 'loose-packing' ? 'active' : ''}`} onClick={() => setActiveTab('loose-packing')}>
          <PackagePlus size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Loose Products
        </button>
      </div>

      {/* Stock Tab */}
      {activeTab === 'stock' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '1rem', margin: 0, color: 'var(--text-secondary)' }}>Raw Materials</h3>
            <button className="btn btn-secondary btn-sm" onClick={exportRMStock} disabled={rmStock.length === 0}>
              <DownloadCloud size={14} /> Export CSV
            </button>
          </div>
          <div className="card mb-2">
            <div className="table-container">
              <table>
                <thead>
                  <tr><th>Name</th><th>Unit</th><th className="text-right">Stock</th><th className="text-right">Threshold</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {rmStock.map(item => (
                    <tr key={item.id}>
                      <td data-label="Name"><strong>{item.name}</strong></td>
                      <td data-label="Unit">{item.unit}</td>
                      <td data-label="Stock" className="text-right">{parseFloat(item.stock_qty).toLocaleString('en-IN')}</td>
                      <td data-label="Threshold" className="text-right">{parseFloat(item.low_stock_threshold).toLocaleString('en-IN')}</td>
                      <td data-label="Status">
                        <span className={`badge ${item.is_low_stock ? 'badge-low-stock' : 'badge-ok'}`}>
                          {item.is_low_stock ? '⚠ Low' : 'OK'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {rmStock.length === 0 && <tr><td colSpan={5} className="text-center text-muted" style={{ padding: '20px' }}>No raw materials</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', marginTop: '24px' }}>
            <h3 style={{ fontSize: '1rem', margin: 0, color: 'var(--text-secondary)' }}>Finished Goods</h3>
            <button className="btn btn-secondary btn-sm" onClick={exportFGStock} disabled={fgStock.length === 0}>
              <DownloadCloud size={14} /> Export CSV
            </button>
          </div>
          <div className="card">
            <div className="table-container">
              <table>
                <thead>
                  <tr><th>Product</th><th className="text-right">Stock</th><th>Packaging</th><th className="text-right">Threshold</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {fgStock.map(item => {
                    const stockQty = parseFloat(item.stock_qty || 0);
                    const pkgSize = parseFloat(item.packaging_size) || 0;
                    const hasPkg = pkgSize > 0 && item.packaging_unit;
                    const bags = hasPkg ? Math.floor(stockQty / pkgSize) : 0;
                    const loose = hasPkg ? round2(stockQty % pkgSize) : 0;
                    const unit = item.selling_unit || item.batch_unit || '';
                    return (
                      <tr key={item.id}>
                        <td data-label="Product"><strong>{item.name}</strong></td>
                        <td data-label="Stock" className="text-right">
                          {hasPkg ? (
                            <div>
                              <div style={{ fontWeight: 600 }}>{stockQty.toLocaleString('en-IN')} {unit}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {bags} {item.packaging_unit}{bags !== 1 ? 's' : ''}{loose > 0 ? ` + ${loose} ${unit}` : ''}
                              </div>
                            </div>
                          ) : (
                            <span>{stockQty.toLocaleString('en-IN')} {unit}</span>
                          )}
                        </td>
                        <td data-label="Packaging">
                          {hasPkg ? (
                            <span className="badge badge-confirmed" style={{ fontSize: '0.72rem' }}>
                              {pkgSize} {unit}/{item.packaging_unit}
                            </span>
                          ) : <span className="text-muted">—</span>}
                        </td>
                        <td data-label="Threshold" className="text-right">{parseFloat(item.low_stock_threshold).toLocaleString('en-IN')}{unit ? ` ${unit}` : ''}</td>
                        <td data-label="Status">
                          <span className={`badge ${item.is_low_stock ? 'badge-low-stock' : 'badge-ok'}`}>
                            {item.is_low_stock ? '⚠ Low' : 'OK'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {fgStock.length === 0 && <tr><td colSpan={5} className="text-center text-muted" style={{ padding: '20px' }}>No finished goods</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Purchases Tab */}
      {activeTab === 'purchases' && (
        <>
          <div className="toolbar">
            <div style={{ flex: 1 }} />
            <button className="btn btn-secondary" onClick={exportPurchases} disabled={purchases.length === 0}>
              <DownloadCloud size={16} /> Export CSV
            </button>
            <button className="btn btn-primary" onClick={() => setShowPurchaseModal(true)}>
              <Plus size={16} /> Record Purchase
            </button>
          </div>
          <div className="card">
            <div className="table-container">
              <table>
                <thead>
                  <tr><th>Date</th><th>Material</th><th className="text-right">Qty</th><th className="text-right">Price Paid (₹)</th><th>Supplier</th><th>Notes</th></tr>
                </thead>
                <tbody>
                  {purchases.map(p => (
                    <tr key={p.id}>
                      <td data-label="Date">{p.purchase_date}</td>
                      <td data-label="Material">{p.raw_materials?.name || '—'} ({p.raw_materials?.unit || ''})</td>
                      <td data-label="Qty" className="text-right">{parseFloat(p.qty).toLocaleString('en-IN')}</td>
                      <td data-label="Price Paid (₹)" className="text-right">₹{parseFloat(p.price_paid || 0).toLocaleString('en-IN')}</td>
                      <td data-label="Supplier">{p.supplier || '—'}</td>
                      <td data-label="Notes" className="text-muted">{p.notes || '—'}</td>
                    </tr>
                  ))}
                  {purchases.length === 0 && <tr><td colSpan={6} className="text-center text-muted" style={{ padding: '40px' }}>No purchases recorded</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Product Purchases Tab */}
      {activeTab === 'product-purchases' && (
        <>
          <div className="toolbar">
            <div style={{ flex: 1 }} />
            <button className="btn btn-primary" onClick={() => setShowProductPurchaseModal(true)}>
              <Plus size={16} /> Buy Product (Bags)
            </button>
          </div>
          <div className="card">
            <div className="table-container">
              <table>
                <thead>
                  <tr><th>Date</th><th>Product</th><th className="text-right">Packages</th><th className="text-right">Units Added</th><th className="text-right">Price Paid (₹)</th><th>Supplier</th><th>Notes</th></tr>
                </thead>
                <tbody>
                  {productPurchases.map(pp => {
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
                        <td data-label="Price Paid (₹)" className="text-right">₹{parseFloat(pp.price_paid || 0).toLocaleString('en-IN')}</td>
                        <td data-label="Supplier">{pp.supplier || '—'}</td>
                        <td data-label="Notes" className="text-muted">{pp.notes || '—'}</td>
                      </tr>
                    );
                  })}
                  {productPurchases.length === 0 && <tr><td colSpan={7} className="text-center text-muted" style={{ padding: '40px' }}>No product purchases recorded</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === 'ledger' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '1rem', margin: 0, color: 'var(--text-secondary)' }}>Inventory Ledger</h3>
          </div>
          <div className="card">
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>Item</th>
                    <th>Type</th>
                    <th className="text-right">Change</th>
                    <th className="text-right">New Stock</th>
                    <th>Source</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.length === 0 ? (
                    <tr><td colSpan="7" className="text-center text-muted">No stock movements recorded yet.</td></tr>
                  ) : ledger.map(log => {
                    const itemName = log.item_type === 'raw_material' ? log.raw_materials?.name : log.products?.name;
                    const itemUnit = log.item_type === 'raw_material' ? log.raw_materials?.unit : log.products?.selling_unit;
                    const isAddition = parseFloat(log.change_amount) > 0;
                    
                    return (
                      <tr key={log.id}>
                        <td data-label="Date & Time">{new Date(log.created_at).toLocaleString()}</td>
                        <td data-label="Item"><strong>{itemName}</strong></td>
                        <td data-label="Type">
                          <span style={{
                            display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600,
                            background: log.item_type === 'raw_material' ? 'rgba(108,99,255,0.1)' : 'rgba(255,166,0,0.1)',
                            color: log.item_type === 'raw_material' ? 'var(--accent-primary)' : 'var(--accent-secondary)'
                          }}>
                            {log.item_type === 'raw_material' ? 'Raw Material' : 'Product'}
                          </span>
                        </td>
                        <td data-label="Change" className="text-right" style={{ 
                          color: isAddition ? 'var(--status-success)' : 'var(--status-error)', 
                          fontWeight: 'bold' 
                        }}>
                          {isAddition ? '+' : ''}{parseFloat(log.change_amount).toLocaleString('en-IN')} {itemUnit}
                        </td>
                        <td data-label="New Stock" className="text-right">{parseFloat(log.new_stock_qty).toLocaleString('en-IN')} {itemUnit}</td>
                        <td data-label="Source">
                          <span style={{
                            display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem',
                            background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)'
                          }}>
                            {log.source.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td data-label="Notes" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{log.notes}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Production Tab */}
      {activeTab === 'production' && (
        <>
          <div className="toolbar">
            <div style={{ flex: 1 }} />
            <button className="btn btn-secondary" onClick={exportProduction} disabled={production.length === 0}>
              <DownloadCloud size={16} /> Export CSV
            </button>
            <button className="btn btn-primary" onClick={() => setShowProductionModal(true)}>
              <Plus size={16} /> Record Production
            </button>
          </div>
          <div className="card">
            <div className="table-container">
              <table>
                <thead>
                  <tr><th>Date</th><th>Product</th><th className="text-right">Qty Yielded</th><th>Notes</th></tr>
                </thead>
                <tbody>
                  {production.map(p => (
                    <tr key={p.id}>
                      <td data-label="Date">{p.produced_date}</td>
                      <td data-label="Product">{p.products?.name || '—'}</td>
                      <td data-label="Qty Yielded" className="text-right">{parseFloat(p.batches_produced).toLocaleString('en-IN')}</td>
                      <td data-label="Notes" className="text-muted">{p.notes || '—'}</td>
                    </tr>
                  ))}
                  {production.length === 0 && <tr><td colSpan={4} className="text-center text-muted" style={{ padding: '40px' }}>No production recorded</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Loose Packing Tab */}
      {activeTab === 'loose-packing' && (
        <>
          <div className="toolbar">
            <div style={{ flex: 1 }} />
            <button className="btn btn-primary" onClick={() => setShowLoosePackingModal(true)}>
              <Plus size={16} /> Pack Loose Products
            </button>
          </div>
          <div className="card">
            <div className="table-container">
              <table>
                <thead>
                  <tr><th>Date</th><th>Bulk Product</th><th>Loose Product</th><th className="text-right">Bulk Used</th><th className="text-right">Qty Yielded</th><th>Notes</th></tr>
                </thead>
                <tbody>
                  {loosePacking.map(lp => (
                    <tr key={lp.id}>
                      <td data-label="Date">{lp.packing_date}</td>
                      <td data-label="Bulk Product">{lp.bulk_product?.name || '—'}</td>
                      <td data-label="Loose Product">{lp.yield_product?.name || '—'}</td>
                      <td data-label="Bulk Used" className="text-right">
                        {parseFloat(lp.bulk_product_qty).toLocaleString('en-IN')} {lp.bulk_product?.selling_unit || lp.bulk_product?.batch_unit || ''}
                      </td>
                      <td data-label="Qty Yielded" className="text-right">
                        {parseFloat(lp.yield_product_qty).toLocaleString('en-IN')} {lp.yield_product?.selling_unit || lp.yield_product?.batch_unit || ''}
                      </td>
                      <td data-label="Notes" className="text-muted">{lp.notes || '—'}</td>
                    </tr>
                  ))}
                  {loosePacking.length === 0 && <tr><td colSpan={6} className="text-center text-muted" style={{ padding: '40px' }}>No loose products packed yet</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Purchase Modal */}
      {showPurchaseModal && (
        <div className="modal-overlay" onClick={() => setShowPurchaseModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Record Purchase</h2>
              <button className="btn btn-secondary btn-icon" onClick={() => setShowPurchaseModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handlePurchase}>
              <div className="form-group">
                <label>Raw Material *</label>
                <select className="form-control" required value={purchaseForm.raw_material_id} onChange={e => setPurchaseForm({ ...purchaseForm, raw_material_id: e.target.value })}>
                  <option value="">— Select —</option>
                  {rawMaterials.map(rm => <option key={rm.id} value={rm.id}>{rm.name} ({rm.unit})</option>)}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Quantity *</label>
                  <input className="form-control" type="number" step="0.01" required value={purchaseForm.qty} onChange={e => setPurchaseForm({ ...purchaseForm, qty: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Price Paid (₹)</label>
                  <input className="form-control" type="number" step="0.01" value={purchaseForm.price_paid} onChange={e => setPurchaseForm({ ...purchaseForm, price_paid: e.target.value })} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Supplier</label>
                  <input className="form-control" value={purchaseForm.supplier} onChange={e => setPurchaseForm({ ...purchaseForm, supplier: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Date</label>
                  <input className="form-control" type="date" value={purchaseForm.purchase_date} onChange={e => setPurchaseForm({ ...purchaseForm, purchase_date: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea className="form-control" value={purchaseForm.notes} onChange={e => setPurchaseForm({ ...purchaseForm, notes: e.target.value })} />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowPurchaseModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Record Purchase</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Production Modal */}
      {showProductionModal && (
        <div className="modal-overlay" onClick={() => setShowProductionModal(false)}>
          <div className="modal" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Record Production (Yield Allocation)</h2>
              <button className="btn btn-secondary btn-icon" onClick={() => setShowProductionModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleProduction}>
              <div className="form-group">
                <label>Formulation *</label>
                <select className="form-control" required value={productionForm.formulation_id} onChange={e => setProductionForm({ ...productionForm, formulation_id: e.target.value, yields: {} })}>
                  <option value="">— Select —</option>
                  {formulations.map(f => <option key={f.id} value={f.id}>{f.name} ({f.batch_size} {f.batch_unit})</option>)}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Formulation Batches Produced *</label>
                  <input className="form-control" type="number" step="0.01" required value={productionForm.batches_produced} onChange={e => setProductionForm({ ...productionForm, batches_produced: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Date</label>
                  <input className="form-control" type="date" value={productionForm.produced_date} onChange={e => setProductionForm({ ...productionForm, produced_date: e.target.value })} />
                </div>
              </div>
              
              {productionForm.formulation_id && (
                <div className="yield-section" style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '14px', marginTop: 0, marginBottom: '12px' }}>Yield Allocation</h3>
                  {products.filter(p => p.formulation_id === productionForm.formulation_id).map(p => (
                    <div key={p.id} className="form-row" style={{ alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ flex: 1, fontSize: '14px', fontWeight: '500' }}>{p.name} (Fill: {p.fill_volume} kg/L)</div>
                      <div style={{ width: '120px' }}>
                        <input 
                          className="form-control" 
                          type="number" 
                          placeholder="Qty Yielded"
                          min="0"
                          step="1"
                          value={productionForm.yields[p.id] || ''}
                          onChange={e => setProductionForm({
                            ...productionForm,
                            yields: { ...productionForm.yields, [p.id]: e.target.value }
                          })}
                        />
                      </div>
                    </div>
                  ))}
                  
                  {(() => {
                    const form = formulations.find(f => f.id === productionForm.formulation_id);
                    const expectedVol = parseFloat(productionForm.batches_produced || 0) * parseFloat(form?.batch_size || 0);
                    let yieldedVol = 0;
                    products.filter(p => p.formulation_id === productionForm.formulation_id).forEach(p => {
                      const qty = parseFloat(productionForm.yields[p.id] || 0);
                      yieldedVol += qty * parseFloat(p.fill_volume || 0);
                    });
                    
                    const isValid = Math.abs(expectedVol - yieldedVol) <= 0.01;
                    
                    return (
                      <div style={{ marginTop: '16px', padding: '12px', background: isValid ? '#ecfdf5' : '#fef2f2', borderRadius: '6px', border: `1px solid ${isValid ? '#a7f3d0' : '#fecaca'}`, display: 'flex', justifyContent: 'space-between' }}>
                        <div style={{ color: isValid ? '#065f46' : '#991b1b', fontSize: '13px' }}>
                          <strong>Expected Liquid:</strong> {expectedVol.toFixed(2)} {form?.batch_unit}
                        </div>
                        <div style={{ color: isValid ? '#065f46' : '#991b1b', fontSize: '13px' }}>
                          <strong>Yielded Bottled:</strong> {yieldedVol.toFixed(2)} kg/L
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              <div className="form-group">
                <label>Notes</label>
                <textarea className="form-control" value={productionForm.notes} onChange={e => setProductionForm({ ...productionForm, notes: e.target.value })} />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowProductionModal(false)}>Cancel</button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={!productionForm.formulation_id || (() => {
                    const form = formulations.find(f => f.id === productionForm.formulation_id);
                    const expectedVol = parseFloat(productionForm.batches_produced || 0) * parseFloat(form?.batch_size || 0);
                    let yieldedVol = 0;
                    products.filter(p => p.formulation_id === productionForm.formulation_id).forEach(p => {
                      const qty = parseFloat(productionForm.yields[p.id] || 0);
                      yieldedVol += qty * parseFloat(p.fill_volume || 0);
                    });
                    return Math.abs(expectedVol - yieldedVol) > 0.01 || expectedVol === 0;
                  })()}
                >
                  Record Production
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Product Purchase Modal */}
      {showProductPurchaseModal && (
        <div className="modal-overlay" onClick={() => setShowProductPurchaseModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📦 Buy Product (Bulk)</h2>
              <button className="btn btn-secondary btn-icon" onClick={() => setShowProductPurchaseModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleProductPurchase}>
              <div className="form-group">
                <label>Product *</label>
                <select className="form-control" required value={productPurchaseForm.product_id} onChange={e => setProductPurchaseForm({ ...productPurchaseForm, product_id: e.target.value })}>
                  <option value="">— Select Product —</option>
                  {products.map(p => {
                    const pkgLabel = p.packaging_size && p.packaging_unit
                      ? ` (${p.packaging_size} ${p.selling_unit || 'units'}/${p.packaging_unit})`
                      : '';
                    return <option key={p.id} value={p.id}>{p.name}{pkgLabel}</option>;
                  })}
                </select>
              </div>

              {selectedPurchaseProduct && selectedPurchaseProduct.packaging_size && (
                <div style={{
                  background: 'rgba(108, 99, 255, 0.06)', border: '1px solid var(--border-accent)',
                  borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: '12px', fontSize: '0.82rem',
                }}>
                  <strong>{selectedPurchaseProduct.name}</strong> —{' '}
                  {selectedPurchaseProduct.packaging_size} {selectedPurchaseProduct.selling_unit || 'units'} per {selectedPurchaseProduct.packaging_unit || 'package'}
                  <br />
                  <span className="text-muted">Current stock: {parseFloat(selectedPurchaseProduct.stock_qty || 0).toLocaleString('en-IN')} {selectedPurchaseProduct.selling_unit || ''}</span>
                </div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label style={selectedPurchaseProduct?.packaging_unit ? { color: 'var(--accent-primary)', fontWeight: 700 } : {}}>
                    {selectedPurchaseProduct?.packaging_unit 
                      ? `Number of ${selectedPurchaseProduct.packaging_unit}s (NOT ${selectedPurchaseProduct.selling_unit || 'units'}) *` 
                      : 'Quantity *'}
                  </label>
                  <input className="form-control" type="number" step="0.01" min="0.01" required value={productPurchaseForm.qty_packages} onChange={e => setProductPurchaseForm({ ...productPurchaseForm, qty_packages: e.target.value })} placeholder="e.g. 3" />
                </div>
                <div className="form-group">
                  <label>Price Paid (₹)</label>
                  <input className="form-control" type="number" step="0.01" value={productPurchaseForm.price_paid} onChange={e => setProductPurchaseForm({ ...productPurchaseForm, price_paid: e.target.value })} />
                </div>
              </div>

              {purchasePreviewUnits !== null && (
                <div style={{
                  background: 'rgba(0, 212, 170, 0.1)', border: '1px solid var(--accent-secondary)',
                  borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: '12px', fontSize: '0.85rem',
                  color: 'var(--accent-secondary)', fontWeight: 600,
                }}>
                  → Will add <strong>{purchasePreviewUnits.toLocaleString('en-IN')} {selectedPurchaseProduct?.selling_unit || 'units'}</strong> to stock
                </div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label>Supplier</label>
                  <input className="form-control" value={productPurchaseForm.supplier} onChange={e => setProductPurchaseForm({ ...productPurchaseForm, supplier: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Date</label>
                  <input className="form-control" type="date" value={productPurchaseForm.purchase_date} onChange={e => setProductPurchaseForm({ ...productPurchaseForm, purchase_date: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea className="form-control" value={productPurchaseForm.notes} onChange={e => setProductPurchaseForm({ ...productPurchaseForm, notes: e.target.value })} />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowProductPurchaseModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Record Purchase</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Loose Packing Modal */}
      {showLoosePackingModal && (
        <div className="modal-overlay" onClick={() => setShowLoosePackingModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Pack Loose Products</h2>
              <button className="btn btn-secondary btn-icon" onClick={() => setShowLoosePackingModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleLoosePacking}>
              <div className="form-group">
                <label>Bulk Product (Material Used) *</label>
                <select className="form-control" required value={loosePackingForm.bulk_product_id} onChange={e => setLoosePackingForm({ ...loosePackingForm, bulk_product_id: e.target.value })}>
                  <option value="">— Select Bulk Product —</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} {p.selling_unit ? `(${p.selling_unit})` : ''}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Loose Product (Finished Good) *</label>
                <select className="form-control" required value={loosePackingForm.yield_product_id} onChange={e => setLoosePackingForm({ ...loosePackingForm, yield_product_id: e.target.value })}>
                  <option value="">— Select Loose Product —</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} {p.selling_unit ? `(${p.selling_unit})` : ''}</option>)}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Bulk Quantity Used *</label>
                  <input className="form-control" type="number" step="0.01" min="0.01" required value={loosePackingForm.bulk_product_qty} onChange={e => setLoosePackingForm({ ...loosePackingForm, bulk_product_qty: e.target.value })} placeholder="e.g. 25" />
                </div>
                <div className="form-group">
                  <label>Product Quantity Yielded *</label>
                  <input className="form-control" type="number" step="0.01" min="0.01" required value={loosePackingForm.yield_product_qty} onChange={e => setLoosePackingForm({ ...loosePackingForm, yield_product_qty: e.target.value })} placeholder="e.g. 50" />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Date</label>
                  <input className="form-control" type="date" value={loosePackingForm.packing_date} onChange={e => setLoosePackingForm({ ...loosePackingForm, packing_date: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea className="form-control" value={loosePackingForm.notes} onChange={e => setLoosePackingForm({ ...loosePackingForm, notes: e.target.value })} placeholder="Optional notes..."/>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowLoosePackingModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Record Packing</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
