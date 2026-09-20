// frontend/src/components/VoiceBilling.jsx

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Plus, Trash2 } from "lucide-react";
import fuzzysort from "fuzzysort";
import client from "../api/client";

// ── Styles ───────────────────────────────────────────────────────
const voiceStyles = {
  voiceArea: {
    border: "2px dashed rgba(255,255,255,0.15)",
    borderRadius: "12px",
    padding: "24px",
    textAlign: "center",
    marginBottom: "20px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(255,255,255,0.02)",
  },
  micButton: {
    width: "60px",
    height: "60px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, #a855f7, #7e22ce)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "none",
    color: "#fff",
    cursor: "pointer",
    fontSize: "24px",
    boxShadow: "0 4px 15px rgba(168, 85, 247, 0.4)",
    transition: "all 0.2s ease",
    marginBottom: "8px",
    outline: "none",
  },
  micButtonRecording: {
    background: "linear-gradient(135deg, #ef4444, #b91c1c)",
    boxShadow: "0 4px 20px rgba(239, 68, 68, 0.6)",
  },
  dropdownWrapper: {
    position: "relative",
    display: "inline-block",
    width: "100%",
  },
  dropdownInput: {
    width: "100%",
    boxSizing: "border-box",
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
    zIndex: 1000,
    boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
    color: "#fff",
    textAlign: "left",
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
    background: "rgba(168,85,247,0.15)",
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
    textAlign: "left",
  },
};

// ── ProductDropdown — customized for VoiceBilling ────────────────
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

  const fetchMatches = (query) => {
    if (!query.trim()) { setOptions([]); return; }
    
    const results = fuzzysort.go(query, products, {
      key: 'name',
      limit: 5,
      threshold: -10000,
    });

    const mapScore = (s) => Math.max(0, Math.min(100, Math.round(100 + (s / 10))));

    const matches = results.map(r => ({
      name: r.obj.name,
      score: mapScore(r.score)
    }));
    
    setOptions(matches);
    if (matches.length > 0) setTopScore(matches[0].score);
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputVal(val);
    setOpen(true);
    setTopScore(null);
    fetchMatches(val);
  };

  const selectOption = (name) => {
    setInputVal(name);
    onChange(name);
    setOpen(false);
    setOptions([]);
    setTopScore(null);
  };

  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
        onChange(inputVal);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [inputVal, onChange]);

  useEffect(() => {
    if (value) {
      setInputVal(value);
      // Run match for display
      fetchMatches(value);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const isLowConfidence = topScore !== null && topScore < 80;

  return (
    <div ref={wrapperRef} style={voiceStyles.dropdownWrapper}>
      <input
        ref={inputRef}
        className="form-control"
        style={{
          ...voiceStyles.dropdownInput,
          background: focused ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.06)",
        }}
        value={inputVal}
        onChange={handleInputChange}
        onFocus={() => { setFocused(true); updateDropdownPosition(); if (inputVal) setOpen(true); }}
        onBlur={() => setFocused(false)}
        placeholder="Type product name..."
      />
      {isLowConfidence && (
        <div style={voiceStyles.matchWarning}>⚠ Verify product name</div>
      )}
      {open && createPortal(
        <div style={{
          ...voiceStyles.dropdownMenu,
          position: "fixed",
          top: `${dropdownPos.top}px`,
          left: `${dropdownPos.left}px`,
          width: `${dropdownPos.width}px`,
          right: "auto",
          zIndex: 9999,
        }}>
          {loading && (
            <div style={{ ...voiceStyles.dropdownOption, opacity: 0.5 }}>Searching...</div>
          )}
          {!loading && options.length === 0 && inputVal && (
            <div style={{ ...voiceStyles.dropdownOption, opacity: 0.5 }}>No matches found</div>
          )}
          {!loading && options.map((opt, idx) => (
            <div
              key={idx}
              style={{
                ...voiceStyles.dropdownOption,
                ...(hoveredIdx === idx ? voiceStyles.dropdownOptionHover : {}),
              }}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(-1)}
              onMouseDown={() => selectOption(opt.name)}
            >
              <span>{opt.name}</span>
              <span style={voiceStyles.matchScore}>{Math.round(opt.score)}%</span>
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

import { useAppContext } from "../context/AppContext";

// ── Main Component ───────────────────────────────────────────────
export default function VoiceBilling({ onSave, onCancel }) {
  const { customers, products, loading } = useAppContext();
  
  const [processing, setProcessing] = useState(false);
  const [message, setMessage]     = useState(null);

  const [form, setForm] = useState({
    customer_id: customers.length > 0 ? customers[0].id : "",
    invoice_date: new Date().toISOString().split("T")[0],
    discount_pct: 0,
    gst_pct: 18,
    notes: "Voice Sales Entry",
  });

  const [items, setItems] = useState([]);

  // Voice Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef   = useRef([]);
  const timerIntervalRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  // ── Record Voice Handlers ──────────────────────────────────────
  const startRecording = async () => {
    audioChunksRef.current = [];
    setMessage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      let options = {};
      if (MediaRecorder.isTypeSupported("audio/webm")) {
        options = { mimeType: "audio/webm" };
      } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
        options = { mimeType: "audio/mp4" };
      } else if (MediaRecorder.isTypeSupported("audio/ogg")) {
        options = { mimeType: "audio/ogg" };
      } else if (MediaRecorder.isTypeSupported("audio/wav")) {
        options = { mimeType: "audio/wav" };
      }

      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const mimeType = recorder.mimeType || "audio/webm";
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        stream.getTracks().forEach((track) => track.stop());

        let ext = ".webm";
        if (mimeType.includes("mp4")) ext = ".mp4";
        else if (mimeType.includes("ogg")) ext = ".ogg";
        else if (mimeType.includes("wav")) ext = ".wav";

        const audioFile = new File([audioBlob], `recording${ext}`, { type: mimeType });
        handleVoiceUpload(audioFile);
      };

      recorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      
      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
      
    } catch (err) {
      console.error("Mic error:", err);
      setMessage({ type: "error", text: "Could not access microphone. Please check permissions." });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
  };

  const handleVoiceUpload = async (file) => {
    setProcessing(true);
    setMessage({ type: "info", text: "Transcribing and extracting products..." });

    try {
      const formData = new FormData();
      formData.append("audio", file);

      const { data: { session } } = await import('../api/supabase').then(m => m.supabase.auth.getSession());
      const res = await client.post("/voice-stock", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          "Authorization": `Bearer ${session?.access_token}`,
        },
        transformRequest: [(data) => data],
      });

      const extracted = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      const transcript = res.data?.transcript || "";

      if (extracted.length === 0) {
        setMessage({
          type: "error",
          text: transcript 
            ? `Transcribed: "${transcript}" — but couldn't parse products/quantities. Try: "Rose Essence 10, Vanillin 5"` 
            : "No speech recognized."
        });
        setProcessing(false);
        return;
      }

      // Map extracted names to matched product information and rates
      const newItems = extracted.map((item) => {
        const nameQuery = item.product_name;
        let pId = "";
        let rate = 0;
        let matchedName = item.product_name;

        try {
          const results = fuzzysort.go(nameQuery, products, { key: 'name', limit: 1, threshold: -10000 });
          if (results.length > 0) {
            const bestMatch = results[0].obj;
            pId = bestMatch.id;
            matchedName = bestMatch.name;
            const qty = parseFloat(item.qty_sold) || 1;
            const minWholesale = parseFloat(bestMatch.wholesale_min_qty) || 1;

            if (qty >= minWholesale && parseFloat(bestMatch.wholesale_price) > 0) {
              rate = parseFloat(bestMatch.wholesale_price);
            } else {
              rate = parseFloat(bestMatch.retail_price) || parseFloat(bestMatch.selling_price) || 0;
            }
          }
        } catch (err) {
          console.error("Match error for:", nameQuery, err);
        }

        return {
          product_name: matchedName,
          product_id: pId,
          qty: parseFloat(item.qty_sold) || 1,
          unit_price: rate,
        };
      });

      setItems((prev) => [...prev, ...newItems]);
      setMessage({
        type: "success",
        text: `Transcribed: "${transcript}". Matches added to list.`
      });
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.error || err.message || "Failed to parse audio." });
    }

    setProcessing(false);
  };

  // ── Pricing and Total Updates ───────────────────────────────────
  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    
    // If name/dropdown changed, try resolving it to fetch prices
    if (field === "product_name") {
      const pMatch = products.find(p => p.name === value);
      if (pMatch) {
        updated[index].product_id = pMatch.id;
        const qty = parseFloat(updated[index].qty) || 0;
        const minWholesale = parseFloat(pMatch.wholesale_min_qty) || 1;
        
        if (qty >= minWholesale && parseFloat(pMatch.wholesale_price) > 0) {
          updated[index].unit_price = parseFloat(pMatch.wholesale_price);
        } else {
          updated[index].unit_price = parseFloat(pMatch.retail_price) || parseFloat(pMatch.selling_price) || 0;
        }
      }
    }
    
    // If quantity changed, check if pricing needs to switch between retail & wholesale
    if (field === "qty" && updated[index].product_id) {
      const pMatch = products.find(p => p.id === updated[index].product_id);
      if (pMatch) {
        const qty = parseFloat(value) || 0;
        const minWholesale = parseFloat(pMatch.wholesale_min_qty) || 1;
        
        if (qty >= minWholesale && parseFloat(pMatch.wholesale_price) > 0) {
          updated[index].unit_price = parseFloat(pMatch.wholesale_price);
        } else {
          updated[index].unit_price = parseFloat(pMatch.retail_price) || parseFloat(pMatch.selling_price) || 0;
        }
      }
    }

    setItems(updated);
  };

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const addItem = () => {
    setItems([...items, { product_name: "", product_id: "", qty: 1, unit_price: 0 }]);
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

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const unmatchedItems = items.filter(it => !it.product_id);
    if (unmatchedItems.length > 0) {
      const names = unmatchedItems.map(it => it.product_name).join(", ");
      alert(`The following products could not be matched to products in database: ${names}. Please select a valid product or remove them before confirming.`);
      return;
    }

    const validItems = items
      .filter((it) => it.product_id && parseFloat(it.qty) > 0)
      .map((it) => ({
        product_id: it.product_id,
        qty: parseFloat(it.qty),
        unit_price: parseFloat(it.unit_price),
      }));

    if (validItems.length === 0) {
      alert("Please add at least one valid product.");
      return;
    }

    const payload = {
      customer_id: form.customer_id,
      invoice_date: form.invoice_date,
      due_date: null,
      discount_pct: discountPct,
      gst_pct: gstPct,
      notes: form.notes,
      items: validItems,
    };

    if (onSave) onSave(payload);
  };

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60).toString().padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  if (loading) {
    return <div className="loading-container"><div className="spinner" /></div>;
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* CSS Animations */}
      <style>{`
        @keyframes micPulse {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
          70% { transform: scale(1.06); box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
        .mic-recording {
          animation: micPulse 1.5s infinite !important;
        }
      `}</style>

      {/* Customer & Date */}
      <div className="form-row">
        <div className="form-group">
          <label>Customer *</label>
          <select
            className="form-control"
            required
            value={form.customer_id}
            onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
            disabled={processing}
          >
            <option value="">— Select Customer —</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.company_name ? ` (${c.company_name})` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Invoice Date</label>
          <input
            className="form-control"
            type="date"
            value={form.invoice_date}
            onChange={(e) => setForm({ ...form, invoice_date: e.target.value })}
            disabled={processing}
          />
        </div>
      </div>

      {/* Voice Recorder section */}
      <div style={voiceStyles.voiceArea}>
        <button
          type="button"
          className={isRecording ? "mic-recording" : ""}
          style={{
            ...voiceStyles.micButton,
            ...(isRecording ? voiceStyles.micButtonRecording : {}),
          }}
          onClick={isRecording ? stopRecording : startRecording}
          disabled={processing}
        >
          {isRecording ? "⏹" : "🎤"}
        </button>
        <div style={{ fontWeight: "600", fontSize: "14px", marginBottom: "4px" }}>
          {isRecording ? "Recording speech..." : "Tap mic and speak your sales entry"}
        </div>
        <div style={{ fontSize: "12px", opacity: 0.5 }}>
          {isRecording ? `Timer: ${formatTime(recordingSeconds)}` : "Format: \"[Product] [Qty], [Product] [Qty]\""}
        </div>
      </div>

      {/* Status Alerts */}
      {message && (
        <div className={`toast toast-${message.type}`} style={{ position: "static", transform: "none", marginBottom: "16px", width: "100%" }}>
          {message.text}
        </div>
      )}

      {/* Line Items Review Table */}
      <h3 style={{ fontSize: "0.95rem", fontWeight: 600, margin: "16px 0 10px", color: "var(--text-secondary)" }}>
        Sales Line Items Review
      </h3>

      <div className="table-container" style={{ marginBottom: "12px" }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: "40%" }}>Product Name</th>
              <th style={{ width: "15%" }}>Qty</th>
              <th style={{ width: "20%" }}>Unit Price (₹)</th>
              <th className="text-right" style={{ width: "20%" }}>Line Total (₹)</th>
              <th style={{ width: "50px" }}></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const lineTotal = (parseFloat(item.qty) || 0) * (parseFloat(item.unit_price) || 0);
              return (
                <tr key={i}>
                  <td data-label="Product Name">
                    <ProductDropdown
                      value={item.product_name}
                      onChange={(val) => handleItemChange(i, "product_name", val)}
                      products={products}
                    />
                  </td>
                  <td data-label="Qty">
                    <input
                      className="form-control"
                      type="number"
                      step="any"
                      min="0"
                      value={item.qty}
                      onChange={(e) => handleItemChange(i, "qty", e.target.value)}
                      placeholder="0"
                    />
                  </td>
                  <td data-label="Unit Price (₹)">
                    <input
                      className="form-control"
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.unit_price}
                      onChange={(e) => handleItemChange(i, "unit_price", e.target.value)}
                    />
                  </td>
                  <td data-label="Line Total (₹)" className="text-right font-bold">
                    ₹{lineTotal.toFixed(2)}
                  </td>
                  <td data-label="">
                    <button
                      type="button"
                      className="btn btn-danger btn-sm btn-icon"
                      onClick={() => removeItem(i)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-muted" style={{ padding: "24px" }}>
                  No items listed. Use voice command or add an item manually.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <button type="button" className="btn btn-secondary btn-sm mb-4" onClick={addItem} disabled={processing}>
        <Plus size={14} /> Add Product Manually
      </button>

      {/* Discount & GST */}
      <div className="form-row">
        <div className="form-group">
          <label>Discount (%)</label>
          <input
            className="form-control"
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={form.discount_pct}
            onChange={(e) => setForm({ ...form, discount_pct: e.target.value })}
            disabled={processing}
          />
        </div>
        <div className="form-group">
          <label>GST (%)</label>
          <input
            className="form-control"
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={form.gst_pct}
            onChange={(e) => setForm({ ...form, gst_pct: e.target.value })}
            disabled={processing}
          />
        </div>
      </div>

      {/* Running Totals */}
      <div style={{
        padding: "16px 20px",
        background: "var(--bg-tertiary)",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--border-subtle)",
        marginTop: "16px",
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "0.9rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="text-muted">Subtotal</span>
            <span>₹{subtotal.toFixed(2)}</span>
          </div>
          {discountPct > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="text-muted">Discount ({discountPct}%)</span>
              <span className="text-danger">-₹{discountAmt.toFixed(2)}</span>
            </div>
          )}
          {gstPct > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="text-muted">GST ({gstPct}%)</span>
              <span>+₹{gstAmt.toFixed(2)}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--border-medium)", paddingTop: "8px", marginTop: "4px" }}>
            <span style={{ fontWeight: 700, fontSize: "1.1rem" }}>Total</span>
            <span style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--accent-primary)" }}>
              ₹{total.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      <div className="modal-footer" style={{ marginTop: "20px" }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={processing}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={processing || items.length === 0}>
          Confirm & Record Sale
        </button>
      </div>
    </form>
  );
}
