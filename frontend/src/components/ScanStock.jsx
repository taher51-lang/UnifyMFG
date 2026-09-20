// frontend/src/components/ScanStock.jsx

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
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
  uploadArea: {
    border: "2px dashed rgba(255,255,255,0.2)",
    borderRadius: "12px",
    padding: "32px",
    textAlign: "center",
    cursor: "pointer",
    transition: "all 0.2s",
    marginBottom: "16px",
  },
  uploadAreaHover: {
    border: "2px dashed rgba(99,179,237,0.6)",
    background: "rgba(99,179,237,0.05)",
  },
  preview: {
    width: "100%",
    maxHeight: "220px",
    objectFit: "contain",
    borderRadius: "8px",
    marginBottom: "16px",
  },
  btn: {
    padding: "10px 22px",
    borderRadius: "8px",
    border: "none",
    cursor: "pointer",
    fontWeight: "600",
    fontSize: "14px",
    transition: "opacity 0.2s",
  },
  btnPrimary: {
    background: "linear-gradient(135deg, #22c55e, #16a34a)",
    color: "#fff",
    marginRight: "10px",
  },
  btnSecondary: {
    background: "var(--bg-secondary, rgba(0,0,0,0.05))",
    color: "var(--text-primary, #333)",
    border: "1px solid var(--border-color, rgba(0,0,0,0.1))",
  },
  btnDanger: {
    background: "rgba(239,68,68,0.15)",
    border: "1px solid rgba(239,68,68,0.3)",
    color: "#fca5a5",
    padding: "5px 14px",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "600",
    fontSize: "13px",
    transition: "all 0.2s",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    marginBottom: "16px",
    fontSize: "14px",
  },
  th: {
    padding: "10px 12px",
    textAlign: "left",
    background: "rgba(255,255,255,0.08)",
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
  // Dropdown wrapper for product name column
  dropdownWrapper: {
    position: "relative",
    display: "inline-block",
    width: "220px",
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
    overflow: "hidden",
    zIndex: 100,
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
  matchWarning: {
    fontSize: "11px",
    color: "#fbbf24",
    marginTop: "3px",
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
  tag: {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: "99px",
    fontSize: "11px",
    fontWeight: "600",
    background: "rgba(99,179,237,0.2)",
    color: "#93c5fd",
    marginLeft: "8px",
  },
};

// ── ProductDropdown — one per row ───────────────────────────────
function ProductDropdown({ value, onChange, products }) {
  const [inputVal, setInputVal]     = useState(value || "");
  const [options, setOptions]       = useState([]);
  const [open, setOpen]             = useState(false);
  const [loading, setLoading]       = useState(false);
  const [focused, setFocused]       = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState(-1);
  const [topScore, setTopScore]     = useState(null);
  const debounceRef = useRef(null);
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

  // Fetch fuzzy matches locally
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
    if (matches.length > 0) setTopScore(matches[0].score);
  };

  // Debounce input changes
  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputVal(val);
    setOpen(true);
    setTopScore(null);
    fetchMatches(val);
  };

  // When user picks an option
  const selectOption = (opt) => {
    setInputVal(opt.name);
    onChange({ id: opt.id, name: opt.name });
    setOpen(false);
    setOptions([]);
    setTopScore(null);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
        // Commit whatever is typed as the value
        onChange({ name: inputVal });
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [inputVal, onChange]);

  // Auto-fetch on mount for the OCR-provided value
  useEffect(() => {
    if (value) {
      setInputVal(value);
      fetchMatches(value).then(() => setOpen(true));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isLowConfidence = topScore !== null && topScore < 80;

  return (
    <div ref={wrapperRef} style={styles.dropdownWrapper}>
      <input
        ref={inputRef}
        style={{
          ...styles.dropdownInput,
          ...(focused ? styles.dropdownInputFocused : {}),
        }}
        value={inputVal}
        onChange={handleInputChange}
        onFocus={() => { setFocused(true); updateDropdownPosition(); if (inputVal) setOpen(true); }}
        onBlur={() => setFocused(false)}
        placeholder="Type to search..."
      />
      {isLowConfidence && (
        <div style={styles.matchWarning}>⚠ Low confidence — please verify</div>
      )}
      {open && createPortal(
        <div style={{
          ...styles.dropdownMenu,
          position: "fixed",
          top: `${dropdownPos.top}px`,
          left: `${dropdownPos.left}px`,
          width: `${dropdownPos.width}px`,
          right: "auto",
          zIndex: 9999,
        }}>
          {loading && (
            <div style={{ ...styles.dropdownOption, opacity: 0.5 }}>Searching...</div>
          )}
          {!loading && options.length === 0 && inputVal && (
            <div style={{ ...styles.dropdownOption, opacity: 0.5 }}>No matches found</div>
          )}
          {!loading && options.map((opt, idx) => (
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

import fuzzysort from "fuzzysort";
import { useAppContext } from "../context/AppContext";

// ── Main Component ───────────────────────────────────────────────
export default function ScanStock() {
  const { products } = useAppContext();
  const [stage, setStage]         = useState("upload");
  const [actionType, setActionType] = useState("outbound"); // "outbound" or "inbound"
  const [imageFile, setImageFile] = useState(null);
  const [imageUrl, setImageUrl]   = useState(null);
  const [items, setItems]         = useState([]);
  const [loading, setLoading]     = useState(false);
  const [message, setMessage]     = useState(null);
  const [hover, setHover]         = useState(false);
  const fileRef = useRef();

  const handleFile = (file) => {
    if (!file) return;
    setImageFile(file);
    setImageUrl(URL.createObjectURL(file));
    setMessage(null);
    setStage("upload");
    setItems([]);
  };

  const onFileChange = (e) => handleFile(e.target.files[0]);

  const onDrop = (e) => {
    e.preventDefault();
    setHover(false);
    handleFile(e.dataTransfer.files[0]);
  };

  // ── Scan image via OCR ─────────────────────────────────────────
  const handleScan = async () => {
    if (!imageFile) return;
    setLoading(true);
    setMessage({ type: "info", text: "Reading handwriting… this may take a few seconds." });

    try {
      const formData = new FormData();
      formData.append("image", imageFile);

      const { data: { session } } = await import('../api/supabase').then(m => m.supabase.auth.getSession());
      const res = await client.post("/scan-stock", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          "Authorization": `Bearer ${session?.access_token}`,
        },
        transformRequest: [(data) => data],
      });

      const extracted = Array.isArray(res.data) ? res.data : (res.data?.data || []);

      if (extracted.length === 0) {
        setMessage({ type: "error", text: "Could not read any rows. Try a clearer photo in good lighting." });
        setLoading(false);
        return;
      }

      setItems(extracted);
      setStage("preview");
      setMessage({ type: "info", text: `Found ${extracted.length} item(s). Verify each product name using the dropdown, then confirm.` });
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.error || err.message || "Scan failed. Please try again." });
    }

    setLoading(false);
  };

  // ── Edit a cell ────────────────────────────────────────────────
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

  // ── Remove a row ───────────────────────────────────────────────
  const removeItem = (index) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // ── Confirm & update stock ────────────────────────────────────
  const handleConfirm = async () => {
    const valid = items.filter(
      (item) => item.product_name?.trim() && parseFloat(item.qty_sold) > 0
    );

    if (valid.length === 0) {
      setMessage({ type: "error", text: "No valid items to confirm." });
      return;
    }

    setLoading(true);
    setMessage({ type: "info", text: "Updating stock…" });

    try {
      const res = await client.post("/confirm-scan", { items: valid, action: actionType });
      const data   = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      const errors = res.data?.errors || [];

      let msg = `✅ Updated ${data.length} product(s) successfully.`;
      if (errors.length > 0) {
        msg += ` ⚠️ SKIPPED ${errors.length} item(s): ${errors.join("; ")}`;
        setMessage({ type: "error", text: msg }); // Use error styling to make it obvious
      } else {
        setMessage({ type: "success", text: msg });
      }
      
      setStage("done");
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.error || err.message || "Confirm failed." });
    }

    setLoading(false);
  };

  const handleReset = () => {
    setStage("upload");
    setImageFile(null);
    setImageUrl(null);
    setItems([]);
    setMessage(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div style={styles.wrapper}>
      {/* Header */}
      <div style={styles.title}>
        📷 Scan Stock Sheet
        <span style={styles.tag}>OCR</span>
      </div>
      <div style={{ marginBottom: "16px", display: "flex", gap: "10px" }}>
        <button
          style={{ ...styles.btn, ...(actionType === "outbound" ? styles.btnPrimary : styles.btnSecondary) }}
          onClick={() => setActionType("outbound")}
        >
          📤 Deduct Stock (Outbound)
        </button>
        <button
          style={{ ...styles.btn, ...(actionType === "inbound" ? styles.btnPrimary : styles.btnSecondary) }}
          onClick={() => setActionType("inbound")}
        >
          📥 Add Stock (Inbound)
        </button>
      </div>
      <div style={styles.subtitle}>
        Take a photo of your handwritten 2-column sheet (Product Name | Qty {actionType === "outbound" ? "Sold" : "Added"}). We'll read it and let you verify each product before updating stock.
      </div>

      {/* Alert */}
      {message && (
        <div style={{ ...styles.alert, ...styles[`alert${message.type.charAt(0).toUpperCase() + message.type.slice(1)}`] }}>
          {message.text}
        </div>
      )}

      {/* Upload area */}
      {stage !== "done" && (
        <>
          <div
            style={{ ...styles.uploadArea, ...(hover ? styles.uploadAreaHover : {}) }}
            onClick={() => fileRef.current.click()}
            onDragOver={(e) => { e.preventDefault(); setHover(true); }}
            onDragLeave={() => setHover(false)}
            onDrop={onDrop}
          >
            {imageUrl ? (
              <img src={imageUrl} alt="Sheet preview" style={styles.preview} />
            ) : (
              <>
                <div style={{ fontSize: "40px", marginBottom: "8px" }}>📄</div>
                <div style={{ fontWeight: "600", marginBottom: "4px" }}>Click or drag a photo here</div>
                <div style={{ fontSize: "12px", opacity: 0.5 }}>JPG, PNG, HEIC supported</div>
              </>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onFileChange}
            style={{ display: "none" }}
          />

          {imageFile && stage === "upload" && (
            <button
              style={{ ...styles.btn, ...styles.btnPrimary }}
              onClick={handleScan}
              disabled={loading}
            >
              {loading ? "Scanning…" : "🔍 Scan Sheet"}
            </button>
          )}
        </>
      )}

      {/* Preview table with dropdowns */}
      {stage === "preview" && items.length > 0 && (
        <>
          <div style={{ overflowX: "auto", paddingBottom: "12px" }}>
            <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Product Name</th>
                <th style={styles.th}>Qty {actionType === "outbound" ? "Sold" : "Added"}</th>
                <th style={{ ...styles.th, width: "80px" }}>Remove</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i}>
                  {/* Product name — fuzzy-match dropdown */}
                  <td data-label="Product Name" style={styles.td}>
                    <ProductDropdown
                      value={item.product_name}
                      products={products}
                      onChange={(selection) => updateProduct(i, selection)}
                    />
                  </td>

                  {/* Qty sold — plain number input */}
                  <td data-label={`Qty ${actionType === "outbound" ? "Sold" : "Added"}`} style={styles.td}>
                    <input
                      style={styles.input}
                      type="number"
                      min="0"
                      value={item.qty_sold}
                      onChange={(e) => updateItem(i, "qty_sold", e.target.value)}
                    />
                  </td>

                  {/* Remove button */}
                  <td data-label="Remove" style={styles.td}>
                    <button
                      style={styles.btnDanger}
                      onClick={() => removeItem(i)}
                      title="Remove this row"
                    >
                      ✕ Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>

          <button
            style={{ ...styles.btn, ...styles.btnPrimary }}
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? "Updating…" : "✅ Confirm & Update Stock"}
          </button>
          <button
            style={{ ...styles.btn, ...styles.btnSecondary }}
            onClick={handleReset}
            disabled={loading}
          >
            Cancel
          </button>
        </>
      )}

      {/* Done state */}
      {stage === "done" && (
        <button
          style={{ ...styles.btn, ...styles.btnPrimary }}
          onClick={handleReset}
        >
          📷 Scan Another Sheet
        </button>
      )}
    </div>
  );
}