// frontend/src/components/VoiceStock.jsx

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
  voiceArea: {
    border: "2px dashed rgba(255,255,255,0.2)",
    borderRadius: "12px",
    padding: "32px",
    textAlign: "center",
    marginBottom: "16px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },
  micButton: {
    width: "72px",
    height: "72px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, #ef4444, #dc2626)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "none",
    color: "#fff",
    cursor: "pointer",
    fontSize: "28px",
    boxShadow: "0 4px 15px rgba(239, 68, 68, 0.4)",
    transition: "all 0.2s ease",
    marginBottom: "12px",
    outline: "none",
  },
  micButtonRecording: {
    background: "linear-gradient(135deg, #dc2626, #991b1b)",
    boxShadow: "0 4px 25px rgba(239, 68, 68, 0.6)",
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
  alertError: { background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5" },
  alertInfo: { background: "rgba(99,179,237,0.15)", border: "1px solid rgba(99,179,237,0.3)", color: "#93c5fd" },
  tag: {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: "99px",
    fontSize: "11px",
    fontWeight: "600",
    background: "rgba(168,85,247,0.2)",
    color: "#c084fc",
    marginLeft: "8px",
  },
};

// ── ProductDropdown — with server-side candidate suggestions ─────
function ProductDropdown({ value, onChange, products, candidates = [] }) {
  const [inputVal, setInputVal] = useState(value || "");
  const [options, setOptions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState(-1);
  const [topScore, setTopScore] = useState(null);
  const [showCandidates, setShowCandidates] = useState(true);
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);
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

    // Filter out any names already in candidates to avoid duplicates
    const candidateNames = new Set(candidates.map(c => c.name));
    const matches = results
      .map(r => ({ id: r.obj.id, name: r.obj.name, score: mapScore(r.score) }))
      .filter(m => !candidateNames.has(m.name));

    setOptions(matches);
    if (matches.length > 0) setTopScore(matches[0].score);
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputVal(val);
    setOpen(true);
    setTopScore(null);
    setShowCandidates(false); // User is typing — prioritize search results
    fetchMatches(val);
  };

  const selectOption = (opt) => {
    setInputVal(opt.name);
    onChange({ id: opt.id, name: opt.name });
    setOpen(false);
    setOptions([]);
    setTopScore(null);
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
    if (value) {
      setInputVal(value);
      // Don't auto-open — wait for user to click
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Determine confidence badge color
  const matchScore = candidates.length > 0 ? candidates[0].score : null;
  const isLowConfidence = matchScore !== null && matchScore < 80;
  const scoreColor = matchScore >= 90 ? "#22c55e" : matchScore >= 75 ? "#fbbf24" : "#ef4444";

  return (
    <div ref={wrapperRef} style={styles.dropdownWrapper}>
      <div style={{ position: "relative" }}>
        <input
          style={{
            ...styles.dropdownInput,
            ...(focused ? styles.dropdownInputFocused : {}),
            paddingRight: "10px",
          }}
          value={inputVal}
          onChange={handleInputChange}
          onFocus={() => {
            setFocused(true);
            setOpen(true);
            setShowCandidates(true);
            if (inputVal) fetchMatches(inputVal);
          }}
          onBlur={() => setFocused(false)}
          placeholder="Type to search..."
        />
      </div>
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
        <div style={styles.matchWarning}>⚠ Low confidence — click to see alternatives</div>
      )}
      {open && (
        <div style={{ ...styles.dropdownMenu, maxHeight: "220px", overflowY: "auto" }}>
          {/* ── Server-side candidates (from voice matching) ── */}
          {showCandidates && candidates.length > 1 && (
            <>
              <div style={{
                padding: "5px 12px",
                fontSize: "10px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                opacity: 0.4,
                borderBottom: "1px solid rgba(255,255,255,0.06)",
              }}>
                Voice Match Suggestions
              </div>
              {candidates.map((c, idx) => (
                <div
                  key={`cand-${idx}`}
                  style={{
                    ...styles.dropdownOption,
                    ...(hoveredIdx === `c${idx}` ? styles.dropdownOptionHover : {}),
                    background: c.name === inputVal ? "rgba(99,179,237,0.1)" : undefined,
                  }}
                  onMouseEnter={() => setHoveredIdx(`c${idx}`)}
                  onMouseLeave={() => setHoveredIdx(-1)}
                  onMouseDown={() => selectOption({ id: c.id, name: c.name })}
                >
                  <span>
                    {c.name}
                    {c.name === inputVal && <span style={{ fontSize: "10px", marginLeft: "6px", opacity: 0.5 }}>✓ selected</span>}
                  </span>
                </div>
              ))}
              <div style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", margin: "4px 0" }} />
            </>
          )}

          {/* ── Live search results (fuzzysort) ── */}
          {loading && (
            <div style={{ ...styles.dropdownOption, opacity: 0.5 }}>Searching...</div>
          )}
          {!loading && options.length === 0 && !showCandidates && inputVal && (
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import fuzzysort from "fuzzysort";
import { useAppContext } from "../context/AppContext";

// ── Main VoiceStock Component ─────────────────────────────────────
export default function VoiceStock() {
  const { products } = useAppContext();
  const [stage, setStage] = useState("upload"); // "upload", "preview", "done"
  const [actionType, setActionType] = useState("outbound"); // "outbound" or "inbound"
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // Voice Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);

  // Clean timers on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  // ── Record Voice handlers ──────────────────────────────────────
  const startRecording = async () => {
    audioChunksRef.current = [];
    setMessage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Get browser-supported audio mime type
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

        // Release mic
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
    setLoading(true);
    setMessage({ type: "info", text: "Transcribing and parsing your speech command..." });

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
            ? `Transcribed: "${transcript}" — but couldn't parse any product quantities. Try saying: "Rose Essence 10, Vanillin 5"`
            : "No speech recognized. Please try again."
        });
        setLoading(false);
        return;
      }

      setItems(extracted);
      setStage("preview");
      setMessage({
        type: "info",
        text: `Transcribed: "${transcript}". Please verify products and quantities below.`
      });
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.error || err.message || "Speech processing failed." });
    }

    setLoading(false);
  };

  // ── Edit cells and Confirm ──────────────────────────────────────
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

  const handleConfirm = async () => {
    const valid = items.filter(
      (item) => item.product_name?.trim() && parseFloat(item.qty_sold) > 0
    );

    if (valid.length === 0) {
      setMessage({ type: "error", text: "No valid items to confirm." });
      return;
    }

    setLoading(true);
    setMessage({ type: "info", text: "Updating stock levels..." });

    try {
      const res = await client.post("/confirm-scan", { items: valid, action: actionType });
      const data = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      const errors = res.data?.errors || [];

      let msg = `✅ Voice update: ${data.length} product(s) updated.`;
      if (errors.length > 0) {
        msg += ` ⚠️ SKIPPED ${errors.length} item(s): ${errors.join("; ")}`;
        setMessage({ type: "error", text: msg });
      } else {
        setMessage({ type: "success", text: msg });
      }

      setStage("done");
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.error || err.message || "Failed to confirm stock updates." });
    }

    setLoading(false);
  };

  const handleReset = () => {
    setStage("upload");
    setItems([]);
    setMessage(null);
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60).toString().padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <div style={styles.wrapper}>
      {/* Dynamic Keyframes Injection */}
      <style>{`
        @keyframes micPulse {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
          70% { transform: scale(1.08); box-shadow: 0 0 0 12px rgba(239, 68, 68, 0); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
        .mic-recording-pulse {
          animation: micPulse 1.5s infinite;
        }
      `}</style>

      {/* Header */}
      <div style={styles.title}>
        🎤 Voice Stock Update
        <span style={styles.tag}>SPEECH-TO-TEXT</span>
      </div>
      <div style={{ marginBottom: "16px", display: "flex", gap: "10px" }}>
        <button
          style={{ ...styles.btn, ...(actionType === "outbound" ? styles.btnPrimary : styles.btnSecondary) }}
          onClick={() => setActionType("outbound")}
          disabled={isRecording || loading}
        >
          📤 Deduct Stock (Outbound)
        </button>
        <button
          style={{ ...styles.btn, ...(actionType === "inbound" ? styles.btnPrimary : styles.btnSecondary) }}
          onClick={() => setActionType("inbound")}
          disabled={isRecording || loading}
        >
          📥 Add Stock (Inbound)
        </button>
      </div>
      <div style={styles.subtitle}>
        Speak into the microphone. State product name and quantity (e.g., "Rose Essence 50, Vanillin 12.5"). We will transcribe, extract products, and update stock ({actionType === "outbound" ? "Outbound/Deduct" : "Inbound/Add"}).
      </div>

      {/* Alert Message */}
      {message && (
        <div style={{ ...styles.alert, ...styles[`alert${message.type.charAt(0).toUpperCase() + message.type.slice(1)}`] }}>
          {message.text}
        </div>
      )}

      {/* Voice area */}
      {stage !== "done" && (
        <>
          {stage === "upload" && (
            <div style={styles.voiceArea}>
              <button
                className={isRecording ? "mic-recording-pulse" : ""}
                style={{
                  ...styles.micButton,
                  ...(isRecording ? styles.micButtonRecording : {}),
                }}
                onClick={isRecording ? stopRecording : startRecording}
                disabled={loading}
              >
                {isRecording ? "⏹" : "🎤"}
              </button>
              <div style={{ fontWeight: "600", marginBottom: "4px" }}>
                {isRecording ? "Recording..." : "Tap microphone to speak"}
              </div>
              <div style={{ fontSize: "12px", opacity: 0.5 }}>
                {isRecording ? `Duration: ${formatTime(recordingSeconds)}` : "Whisper AI filters background noise"}
              </div>
            </div>
          )}
        </>
      )}

      {/* Preview Table */}
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
                    <td data-label="Product Name" style={styles.td}>
                      <ProductDropdown
                        value={item.product_name}
                        products={products}
                        candidates={item.candidates || []}
                        onChange={(selection) => updateProduct(i, selection)}
                      />
                    </td>
                    <td data-label={`Qty ${actionType === "outbound" ? "Sold" : "Added"}`} style={styles.td}>
                      <input
                        style={styles.input}
                        type="number"
                        min="0"
                        step="any"
                        value={item.qty_sold}
                        onChange={(e) => updateItem(i, "qty_sold", e.target.value)}
                      />
                    </td>
                    <td data-label="Remove" style={styles.td}>
                      <button
                        style={styles.btnDanger}
                        onClick={() => removeItem(i)}
                      >
                        ✕ Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: "12px" }}>
            <button
              style={{ ...styles.btn, ...styles.btnPrimary }}
              onClick={handleConfirm}
              disabled={loading}
            >
              {loading ? "Updating..." : "✅ Confirm & Update Stock"}
            </button>
            <button
              style={{ ...styles.btn, ...styles.btnSecondary }}
              onClick={handleReset}
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </>
      )}

      {/* Success / Done */}
      {stage === "done" && (
        <button
          style={{ ...styles.btn, ...styles.btnPrimary }}
          onClick={handleReset}
        >
          🎤 Record Another Command
        </button>
      )}
    </div>
  );
}
