// frontend/src/components/InvoicePrint.jsx
// Print-ready invoice view with clean layout

export default function InvoicePrint({ invoice }) {
  if (!invoice) return null;

  const customer = invoice.customers || {};
  const items = invoice.invoice_items || [];
  const subtotal = parseFloat(invoice.subtotal || 0);
  const discountPct = parseFloat(invoice.discount_pct || 0);
  const gstPct = parseFloat(invoice.gst_pct || 0);
  const total = parseFloat(invoice.total || 0);
  const amountPaid = parseFloat(invoice.amount_paid || 0);
  const balance = total - amountPaid;
  const discountAmt = subtotal * (discountPct / 100);
  const afterDiscount = subtotal - discountAmt;
  const gstAmt = afterDiscount * (gstPct / 100);

  return (
    <div className="invoice-print">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0, color: '#1a1a2e' }}>UnifyMFG</h1>
          <p style={{ color: '#666', fontSize: '0.85rem', margin: '4px 0 0' }}>Home Manufacturing Business</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1a1a2e', margin: 0 }}>INVOICE</h2>
          <p style={{ color: '#6c63ff', fontWeight: 600, fontSize: '1rem', margin: '4px 0' }}>{invoice.invoice_number}</p>
        </div>
      </div>

      <hr style={{ border: 'none', borderTop: '2px solid #eee', margin: '0 0 20px' }} />

      {/* Info Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
        <div>
          <p style={{ fontWeight: 600, color: '#888', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Bill To</p>
          <p style={{ fontWeight: 700, fontSize: '1rem' }}>{customer.name}</p>
          {customer.company_name && <p style={{ color: '#555' }}>{customer.company_name}</p>}
          {customer.address && <p style={{ color: '#555', fontSize: '0.85rem' }}>{customer.address}</p>}
          {customer.phone && <p style={{ color: '#555', fontSize: '0.85rem' }}>Tel: {customer.phone}</p>}
          {customer.gst_number && <p style={{ color: '#555', fontSize: '0.85rem' }}>GST: {customer.gst_number}</p>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '0.85rem' }}><span style={{ color: '#888' }}>Date:</span> {invoice.invoice_date}</p>
          {invoice.due_date && <p style={{ fontSize: '0.85rem' }}><span style={{ color: '#888' }}>Due:</span> {invoice.due_date}</p>}
          <p style={{ fontSize: '0.85rem' }}><span style={{ color: '#888' }}>Status:</span> <strong>{(invoice.status || 'draft').toUpperCase()}</strong></p>
        </div>
      </div>

      {/* Items Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
        <thead>
          <tr>
            <th style={{ padding: '10px 12px', background: '#1a1a2e', color: 'white', textAlign: 'left', fontSize: '0.82rem' }}>#</th>
            <th style={{ padding: '10px 12px', background: '#1a1a2e', color: 'white', textAlign: 'left', fontSize: '0.82rem' }}>Product</th>
            <th style={{ padding: '10px 12px', background: '#1a1a2e', color: 'white', textAlign: 'right', fontSize: '0.82rem' }}>Qty</th>
            <th style={{ padding: '10px 12px', background: '#1a1a2e', color: 'white', textAlign: 'right', fontSize: '0.82rem' }}>Unit Price</th>
            <th style={{ padding: '10px 12px', background: '#1a1a2e', color: 'white', textAlign: 'right', fontSize: '0.82rem' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} style={{ background: i % 2 === 1 ? '#f8f8ff' : 'white' }}>
              <td data-label="#" style={{ padding: '10px 12px', borderBottom: '1px solid #eee' }}>{i + 1}</td>
              <td data-label="Product" style={{ padding: '10px 12px', borderBottom: '1px solid #eee' }}>{item.products?.name || 'Unknown'}</td>
              <td data-label="Qty" style={{ padding: '10px 12px', borderBottom: '1px solid #eee', textAlign: 'right' }}>{item.qty}</td>
              <td data-label="Unit Price" style={{ padding: '10px 12px', borderBottom: '1px solid #eee', textAlign: 'right' }}>₹{parseFloat(item.unit_price).toFixed(2)}</td>
              <td data-label="Total" style={{ padding: '10px 12px', borderBottom: '1px solid #eee', textAlign: 'right', fontWeight: 600 }}>₹{parseFloat(item.line_total).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ width: '280px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '0.9rem' }}>
            <span style={{ color: '#666' }}>Subtotal</span>
            <span>₹{subtotal.toFixed(2)}</span>
          </div>
          {discountPct > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '0.9rem' }}>
              <span style={{ color: '#666' }}>Discount ({discountPct}%)</span>
              <span style={{ color: '#e74c3c' }}>-₹{discountAmt.toFixed(2)}</span>
            </div>
          )}
          {gstPct > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '0.9rem' }}>
              <span style={{ color: '#666' }}>GST ({gstPct}%)</span>
              <span>+₹{gstAmt.toFixed(2)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontSize: '1.1rem', fontWeight: 700, borderTop: '2px solid #1a1a2e', marginTop: '6px' }}>
            <span>Total</span>
            <span>₹{total.toFixed(2)}</span>
          </div>
          {amountPaid > 0 && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.9rem' }}>
                <span style={{ color: '#666' }}>Paid</span>
                <span style={{ color: '#27ae60' }}>₹{amountPaid.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.95rem', fontWeight: 600 }}>
                <span>Balance Due</span>
                <span style={{ color: balance > 0 ? '#e74c3c' : '#27ae60' }}>₹{balance.toFixed(2)}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Notes & Footer */}
      {invoice.notes && (
        <div style={{ marginTop: '24px', padding: '12px 16px', background: '#f8f8ff', borderRadius: '8px', fontSize: '0.85rem' }}>
          <strong>Notes:</strong> {invoice.notes}
        </div>
      )}
      <div style={{ marginTop: '32px', textAlign: 'center', color: '#aaa', fontSize: '0.78rem' }}>
        Thank you for your business!
      </div>
    </div>
  );
}
