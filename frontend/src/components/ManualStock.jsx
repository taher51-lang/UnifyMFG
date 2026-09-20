// frontend/src/components/ManualStock.jsx
// Manual stock entry — search for products and add/deduct stock quantities

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import fuzzysort from "fuzzysort";
import { useAppContext } from "../context/AppContext";
import client from "../api/client";

// ── Styles ───────────────────────────────────────────────────────
const styles = {
  wrapper: {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "16px",
    padding: "24px",
    marginBottom: "24px",
  },
  title: {
    fontSize: "18px",
    fontWeight: "600",
    marginBottom: "6px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  subtitle: {
    fontSize: "13px",
    opacity: 0.6,
    marginBottom: "20px",
  },
  tag: {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: "99px",
    fontSize: "11px",
    fontWeight: "600",
    background: "rgba(59,130,246,0.2)",
    color: "#60a5fa",
    marginLeft: "8px",
  },
  btn: {
    padding: "8px 18px",
    borderRadius: "8px",
    border: "none",
    fontWeight: "600",
    cursor: "pointer",
    fontSize: "13px",
    transition: "all 0.15s",
    marginRight: "8px",
  },
  btnPrimary: {
    background: "linear-gradient(135deg, #3b82f6, #2563eb)",
    color: "#fff",
  },
  btnSecondary: {
    background: "rgba(255,255,255,0.08)",
    color: "#ccc",
    border: "1px solid rgba(255,255,255,0.15)",
  },
  btnDanger: {
    background: "rgba(239,68,68,0.15)",
    color: "#fca5a5",
    border: "1px solid rgba(239,68,68,0.25)",
    padding: "6px 12px",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "600",
  },
  btnAdd: {
    background: "linear-gradient(135deg, #10b981, #059669)",
    color: "#fff",
    padding: "10px 20px",
    borderRadius: "8px",
    border: "none",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "600",
    transition: "all 0.15s",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    marginTop: "16px",
    fontSize: "14px",
  },
  th: {
    textAlign: "left",
    padding: "10px 12px",
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    fontWeight: "600",
    borderBottom: "1px solid rgba(255,255,255,0.1)",
  },
  td: {
    padding: "10px 12px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    verticalAlign: "middle",
  },
  input: {
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: "6px",
    padding: "6px 10px",
    color: "inherit",
    fontSize: "14px",
    width: "80px",
  },
  dropdownWrapper: {
    position: "relative",
    display: "inline-block",
    width: "100%",
    maxWidth: "280px",
  },
  dropdownInput: {
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: "6px",
    padding: "6px 10px",
    color: "inherit",
    fontSize: "14px",
    width: "100%",
    boxSizing: "border-box",
    outline: "none",
  },
  dropdownInputFocused: {
    border: "1px solid rgba(99,179,237,0.6)",
    background: "rgba(255,255,255,0.1)",
  },
  dropdownMenu: {
    position: "absolute",
    top: "calc(100% + 4px)",
    left: 0,
    right: 0,
    background: "#1e2535",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: "8px",
    overflowY: "auto",
    maxHeight: "220px",
    zIndex: 9999,
    boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
    color: "#fff",
  },
  dropdownOption: {
    padding: "9px 12px",
    cursor: "pointer",
    fontSize: "13px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    transition: "background 0.1s",
  },
  dropdownOptionHover: {
    background: "rgba(99,179,237,0.15)",
  },
  matchScore: {
    fontSize: "11px",
    opacity: 0.5,
    marginLeft: "8px",
  },
  alert: {
    padding: "12px 16px",
    borderRadius: "8px",
    marginBottom: "12px",
    fontSize: "13px",
  },
  alertSuccess: { background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", color: "#86efac" },
  alertError:   { background: "rgba(239,68,68,0.15)",  border: "1px solid rgba(239,68,68,0.3)",  color: "#fca5a5" },
  alertInfo:    { background: "rgba(99,179,237,0.15)", border: "1px solid rgba(99,179,237,0.3)", color: "#93c5fd" },
  addRow: {
    display: "flex",
    gap: "10px",
    alignItems: "center",
    marginBottom: "20px",
    flexWrap: "wrap",
  },
};

// ── ProductDropdown — fuzzy search dropdown ───────────────────────
function ProductDropdown({ value, onChange, products, autoFocus }) {
  const [inputVal, setInputVal]     = useState(value || "");
  const [options, setOptions]       = useState([]);
  const [open, setOpen]             = useState(false);
  const [focused, setFocused]       = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState(-1);
  const wrapperRef  = useRef(null);
  const inputRef    = useRef(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });

  // Calculate fixed position from input's screen coordinates
  const updateDropdownPosition = () => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
  };

  // Reposition on scroll/resize while open
  useEffect(() => {
    if (!open) return;
    updateDropdownPosition();
    const reposition = () => updateDropdownPosition();
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open]);

  const fetchMatches = (query) => {
    if (!query.trim()) { setOptions([]); return; }
    
    const results = fuzzysort.go(query, products, {
      key: 'name',
      limit: 5,
      threshold: -10000,
    });

    const mapScore = (s) => Math.max(0, Math.min(100, Math.round(100 + (s / 10))));

    const matches = results.map(r => ({
      id: r.obj.id,
      name: r.obj.name,
      score: mapScore(r.score)
    }));
    
    setOptions(matches);
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputVal(val);
    setOpen(true);
    fetchMatches(val);
  };

  const selectOption = (opt) => {
    setInputVal(opt.name);
    onChange({ id: opt.id, name: opt.name });
    setOpen(false);
    setOptions([]);
  };

  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
        onChange({ name: inputVal });
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [inputVal, onChange]);

  useEffect(() => {
    if (autoFocus && inputRef.current) inputRef.current.focus();
  }, [autoFocus]);

  return (
    <div ref={wrapperRef} style={styles.dropdownWrapper}>
      <input
        ref={inputRef}
        style={{
          ...styles.dropdownInput,
          ...(focused ? styles.dropdownInputFocused : {}),
        }}
        type="text"
        placeholder="Search product..."
        value={inputVal}
        onChange={handleInputChange}
        onFocus={() => { setFocused(true); updateDropdownPosition(); setOpen(true); fetchMatches(inputVal); }}
        onBlur={() => setFocused(false)}
      />
      {open && options.length > 0 && createPortal(
        <div style={{
          ...styles.dropdownMenu,
          position: "fixed",
          top: `${dropdownPos.top}px`,
          left: `${dropdownPos.left}px`,
          width: `${dropdownPos.width}px`,
          right: "auto",
          zIndex: 9999,
        }}>
          {options.map((opt, idx) => (
            <div
              key={idx}
              style={{
                ...styles.dropdownOption,
                ...(hoveredIdx === idx ? styles.dropdownOptionHover : {}),
              }}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(-1)}
              onMouseDown={() => selectOption(opt)}
            >
              <span>{opt.name}</span>
              <span style={styles.matchScore}>{Math.round(opt.score)}%</span>
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

// ── Main ManualStock Component ────────────────────────────────────
export default function ManualStock() {
  const { products } = useAppContext();
  const [actionType, setActionType] = useState("outbound");
  const [items, setItems]           = useState([]);
  const [loading, setLoading]       = useState(false);
  const [message, setMessage]       = useState(null);
  const [done, setDone]             = useState(false);

  // ── Add a blank row ────────────────────────────────────────────
  const addRow = () => {
    setItems((prev) => [...prev, { product_id: null, product_name: "", qty_sold: "" }]);
  };

  const updateItem = (index, field, value) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  // Called when the ProductDropdown selects or blurs
  const updateProduct = (index, selection) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        return {
          ...item,
          product_name: selection.name || "",
          product_id: selection.id || null,
        };
      })
    );
  };

  const removeItem = (index) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // ── Confirm & Submit ───────────────────────────────────────────
  const handleConfirm = async () => {
    const valid = items.filter(
      (item) => item.product_name?.trim() && parseFloat(item.qty_sold) > 0
    );

    if (valid.length === 0) {
      setMessage({ type: "error", text: "No valid items to confirm. Add at least one product with a quantity." });
      return;
    }

    setLoading(true);
    setMessage({ type: "info", text: "Updating stock levels..." });

    try {
      const res = await client.post("/confirm-scan", { items: valid, action: actionType });
      const data   = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      const errors = res.data?.errors || [];

      let msg = `✅ Manual update: ${data.length} product(s) updated.`;
      if (errors.length > 0) {
        msg += ` ⚠️ SKIPPED ${errors.length} item(s): ${errors.join("; ")}`;
        setMessage({ type: "error", text: msg });
      } else {
        setMessage({ type: "success", text: msg });
      }
      
      setDone(true);
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.error || err.message || "Stock update failed." });
    }

    setLoading(false);
  };

  const handleReset = () => {
    setItems([]);
    setMessage(null);
    setDone(false);
  };

  return (
    <div style={styles.wrapper}>
      {/* Header */}
      <div style={styles.title}>
        ✏️ Manual Stock Entry
        <span style={styles.tag}>SEARCH & ADD</span>
      </div>

      {/* Action Type Toggle */}
      <div style={{ marginBottom: "16px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
        <button
          style={{ ...styles.btn, ...(actionType === "outbound" ? styles.btnPrimary : styles.btnSecondary) }}
          onClick={() => setActionType("outbound")}
          disabled={loading}
        >
          📤 Deduct Stock (Outbound)
        </button>
        <button
          style={{ ...styles.btn, ...(actionType === "inbound" ? styles.btnPrimary : styles.btnSecondary) }}
          onClick={() => setActionType("inbound")}
          disabled={loading}
        >
          📥 Add Stock (Inbound)
        </button>
      </div>

      <div style={styles.subtitle}>
        Search for products using the search bar below and manually enter quantities to {actionType === "outbound" ? "deduct" : "add"} stock.
      </div>

      {/* Alert Message */}
      {message && (
        <div style={{ ...styles.alert, ...styles[`alert${message.type.charAt(0).toUpperCase() + message.type.slice(1)}`] }}>
          {message.text}
        </div>
      )}

      {!done && (
        <>
          {/* Add Product Button */}
          <button
            style={styles.btnAdd}
            onClick={addRow}
            disabled={loading}
          >
            + Add Product
          </button>

          {/* Items List */}
          {items.length > 0 && (
            <>
              <div style={{ paddingBottom: "12px", display: "flex", flexDirection: "column", gap: "12px", marginTop: "16px" }}>
                {items.map((item, i) => (
                  <div
                    key={i}
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "10px",
                      padding: "14px",
                    }}
                  >
                    {/* Product Search */}
                    <div style={{ marginBottom: "10px" }}>
                      <div style={{ fontSize: "11px", textTransform: "uppercase", fontWeight: "600", opacity: 0.5, marginBottom: "6px", letterSpacing: "0.5px" }}>
                        Product Name
                      </div>
                      <ProductDropdown
                        value={item.product_name}
                        products={products}
                        onChange={(selection) => updateProduct(i, selection)}
                        autoFocus={i === items.length - 1}
                      />
                    </div>
                    {/* Qty + Remove row */}
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                      <div style={{ flex: "1", minWidth: "100px" }}>
                        <div style={{ fontSize: "11px", textTransform: "uppercase", fontWeight: "600", opacity: 0.5, marginBottom: "6px", letterSpacing: "0.5px" }}>
                          Qty {actionType === "outbound" ? "Sold" : "Added"}
                        </div>
                        <input
                          style={{ ...styles.input, width: "100%", boxSizing: "border-box" }}
                          type="number"
                          min="0"
                          step="any"
                          placeholder="0"
                          value={item.qty_sold}
                          onChange={(e) => updateItem(i, "qty_sold", e.target.value)}
                        />
                      </div>
                      <button
                        style={{ ...styles.btnDanger, alignSelf: "flex-end", marginBottom: "2px" }}
                        onClick={() => removeItem(i)}
                      >
                        ✕ Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Confirm / Cancel */}
              <div style={{ marginTop: "12px", display: "flex", flexWrap: "wrap", gap: "8px" }}>
                <button
                  style={{ ...styles.btn, ...styles.btnPrimary, marginRight: 0 }}
                  onClick={handleConfirm}
                  disabled={loading}
                >
                  {loading ? "Updating..." : "✅ Confirm & Update Stock"}
                </button>
                <button
                  style={{ ...styles.btn, ...styles.btnSecondary, marginRight: 0 }}
                  onClick={handleReset}
                  disabled={loading}
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </>
      )}

      {/* Done State */}
      {done && (
        <button
          style={{ ...styles.btn, ...styles.btnPrimary }}
          onClick={handleReset}
        >
          ✏️ Add More Items
        </button>
      )}
    </div>
  );
}
