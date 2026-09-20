import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../api/supabase';
import { getApiBaseUrl } from '../api/client';
import fuzzysort from 'fuzzysort';

export default function EmployeePanel() {
  const { signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('audio'); // 'audio' or 'price'

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerTitle}>👷 Employee Panel</div>
        <button onClick={signOut} style={styles.logoutBtn}>🚪 Logout</button>
      </header>

      <div style={styles.tabs}>
        <button 
          style={{...styles.tab, ...(activeTab === 'audio' ? styles.activeTab : {})}} 
          onClick={() => setActiveTab('audio')}
        >
          🎤 Send Audio Report
        </button>
        <button 
          style={{...styles.tab, ...(activeTab === 'price' ? styles.activeTab : {})}} 
          onClick={() => setActiveTab('price')}
        >
          🔍 Check Price
        </button>
      </div>

      <div style={styles.content}>
        {activeTab === 'audio' && <AudioRecorder />}
        {activeTab === 'price' && <PriceSearch />}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Audio Recorder Component
// ----------------------------------------------------------------------------
function AudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [timer, setTimer] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [uploadStatus, setUploadStatus] = useState(''); // 'idle', 'uploading', 'success', 'error'
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const { session } = useAuth();

  useEffect(() => {
    return () => clearInterval(timerRef.current);
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const mime = mediaRecorderRef.current?.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: mime });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setUploadStatus('idle');
      setTimer(0);
      
      timerRef.current = setInterval(() => {
        setTimer(t => t + 1);
      }, 1000);

    } catch (err) {
      console.error("Mic access error", err);
      alert("Please allow microphone access to record audio.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const uploadAudio = async () => {
    if (!audioBlob) return;
    setUploadStatus('uploading');

    const mime = audioBlob.type || '';
    const filename = mime.includes('mp4') ? 'report.mp4' : 'report.webm';

    const formData = new FormData();
    formData.append('audio', audioBlob, filename);
    formData.append('duration_seconds', timer);

    try {
      const resp = await fetch(`${getApiBaseUrl()}/employee/audio-report`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: formData
      });

      if (!resp.ok) throw new Error('Upload failed');
      
      setUploadStatus('success');
      setAudioBlob(null);
      setTimer(0);
    } catch (err) {
      console.error(err);
      setUploadStatus('error');
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div style={styles.card}>
      <h2 style={{fontSize: '28px', textAlign: 'center', margin: '0 0 20px 0'}}>Warehouse Audio Report</h2>
      
      <div style={styles.recordArea}>
        {!isRecording ? (
          <button 
            style={{...styles.micButton, ...(audioBlob ? styles.micButtonDisabled : {})}} 
            onClick={startRecording}
            disabled={!!audioBlob || uploadStatus === 'uploading'}
          >
            🎤<br/>
            <span style={{fontSize: '18px', marginTop: '10px', display: 'block'}}>TAP TO RECORD</span>
          </button>
        ) : (
          <button style={styles.stopButton} onClick={stopRecording}>
            ⏹️<br/>
            <span style={{fontSize: '18px', marginTop: '10px', display: 'block'}}>STOP RECORDING</span>
          </button>
        )}

        {(isRecording || timer > 0) && (
          <div style={styles.timer}>{formatTime(timer)}</div>
        )}
      </div>

      {audioBlob && (
        <div style={styles.actionArea}>
          <audio src={URL.createObjectURL(audioBlob)} controls style={{width: '100%', marginBottom: '20px'}} />
          
          <div style={{display: 'flex', gap: '15px'}}>
            <button 
              style={{...styles.btn, background: '#ef4444', flex: 1}} 
              onClick={() => { setAudioBlob(null); setTimer(0); }}
              disabled={uploadStatus === 'uploading'}
            >
              ❌ DELETE
            </button>
            <button 
              style={{...styles.btn, background: '#10b981', flex: 2}} 
              onClick={uploadAudio}
              disabled={uploadStatus === 'uploading'}
            >
              {uploadStatus === 'uploading' ? '⏳ SENDING...' : '✅ SEND TO ADMIN'}
            </button>
          </div>
        </div>
      )}

      {uploadStatus === 'success' && (
        <div style={styles.successMsg}>
          🎉 Sent successfully! Thank you.
        </div>
      )}
      {uploadStatus === 'error' && (
        <div style={styles.errorMsg}>
          ⚠️ Failed to send. Please try again.
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Price Search Component
// ----------------------------------------------------------------------------
function PriceSearch() {
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState([]);
  const [results, setResults] = useState([]);
  const { session, logActivity } = useAuth();
  const lastLoggedQuery = useRef('');

  useEffect(() => {
    // Fetch all products once for fuzzy sorting
    const fetchProducts = async () => {
      try {
        const resp = await fetch(`${getApiBaseUrl()}/employee/products-search`, {
          headers: { 'Authorization': `Bearer ${session?.access_token}` }
        });
        const json = await resp.json();
        if (json.data) {
          setProducts(json.data);
          setResults(json.data.slice(0, 50));
        }
      } catch (err) {
        console.error(err);
      }
    };
    if (session) fetchProducts();
  }, [session]);

  useEffect(() => {
    if (!query) {
      setResults(products.slice(0, 50));
      return;
    }

    const q = query.toLowerCase().trim();
    const words = q.split(/\s+/).filter(Boolean);

    // ── Tier 1: exact substring match (best) ──
    const tier1 = [];
    // ── Tier 2: all individual words found in name ──
    const tier2 = [];
    // ── Remaining: for fuzzy fallback ──
    const remaining = [];

    const seen = new Set();

    for (const p of products) {
      const nameLower = (p.name || '').toLowerCase();
      if (nameLower.includes(q)) {
        tier1.push(p);
        seen.add(p.name);
      } else if (words.length > 1 && words.every(w => nameLower.includes(w))) {
        tier2.push(p);
        seen.add(p.name);
      } else {
        remaining.push(p);
      }
    }

    // Sort tier1 by how early the match starts (closer to beginning = better)
    tier1.sort((a, b) => {
      const aIdx = (a.name || '').toLowerCase().indexOf(q);
      const bIdx = (b.name || '').toLowerCase().indexOf(q);
      return aIdx - bIdx;
    });

    // ── Tier 3: fuzzy search on what wasn't already matched ──
    let tier3 = [];
    if (tier1.length + tier2.length < 50) {
      const fuzzyResults = fuzzysort.go(query, remaining, { key: 'name', limit: 50 - tier1.length - tier2.length });
      tier3 = fuzzyResults.map(f => f.obj);
    }

    setResults([...tier1, ...tier2, ...tier3].slice(0, 50));

    // Debounced audit log for significant price searches (>= 3 chars)
    const timeout = setTimeout(() => {
      const clean = query.trim();
      if (clean.length >= 3 && clean.toLowerCase() !== lastLoggedQuery.current.toLowerCase()) {
        lastLoggedQuery.current = clean;
        if (logActivity) {
          logActivity('PRICE_SEARCH', { query: clean });
        }
      }
    }, 1500);

    return () => clearTimeout(timeout);
  }, [query, products, logActivity]);

  return (
    <div style={styles.card}>
      <input 
        type="text" 
        style={styles.searchInput}
        placeholder="🔍 Type product name..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div style={styles.resultsList}>
        {results.map((p, i) => (
          <div key={i} style={styles.resultItem}>
            <div style={styles.productName}>{p.name}</div>
            <div style={styles.productPrice}>₹ {p.retail_price}</div>
          </div>
        ))}
        {results.length === 0 && (
          <div style={{padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '20px'}}>
            No products found
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    background: '#0f172a',
    color: '#fff',
    padding: '20px',
    maxWidth: '800px',
    margin: '0 auto',
    fontFamily: 'system-ui, -apple-system, sans-serif'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    padding: '10px 0',
  },
  headerTitle: {
    fontSize: '24px',
    fontWeight: 'bold',
  },
  logoutBtn: {
    background: 'rgba(255,255,255,0.1)',
    border: 'none',
    color: '#fff',
    padding: '10px 16px',
    borderRadius: '12px',
    fontSize: '16px',
    cursor: 'pointer',
  },
  tabs: {
    display: 'flex',
    gap: '10px',
    marginBottom: '20px',
  },
  tab: {
    flex: 1,
    padding: '20px',
    fontSize: '20px',
    fontWeight: 'bold',
    border: 'none',
    borderRadius: '16px',
    background: 'rgba(255,255,255,0.05)',
    color: 'rgba(255,255,255,0.5)',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  activeTab: {
    background: '#3b82f6',
    color: '#fff',
  },
  card: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '24px',
    padding: '30px',
  },
  recordArea: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '40px 0',
  },
  micButton: {
    width: '180px',
    height: '180px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
    border: 'none',
    color: '#fff',
    fontSize: '60px',
    cursor: 'pointer',
    boxShadow: '0 10px 30px rgba(59, 130, 246, 0.4)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 0.1s',
  },
  micButtonDisabled: {
    background: '#475569',
    boxShadow: 'none',
    cursor: 'not-allowed',
    opacity: 0.5,
  },
  stopButton: {
    width: '180px',
    height: '180px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
    border: 'none',
    color: '#fff',
    fontSize: '60px',
    cursor: 'pointer',
    boxShadow: '0 10px 30px rgba(239, 68, 68, 0.4)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    animation: 'pulse 1.5s infinite',
  },
  timer: {
    fontSize: '48px',
    fontWeight: 'bold',
    marginTop: '30px',
    fontVariantNumeric: 'tabular-nums',
  },
  btn: {
    padding: '20px',
    fontSize: '20px',
    fontWeight: 'bold',
    border: 'none',
    borderRadius: '16px',
    color: '#fff',
    cursor: 'pointer',
  },
  successMsg: {
    background: 'rgba(16, 185, 129, 0.2)',
    color: '#34d399',
    padding: '20px',
    borderRadius: '16px',
    textAlign: 'center',
    fontSize: '22px',
    fontWeight: 'bold',
    marginTop: '20px',
  },
  errorMsg: {
    background: 'rgba(239, 68, 68, 0.2)',
    color: '#f87171',
    padding: '20px',
    borderRadius: '16px',
    textAlign: 'center',
    fontSize: '22px',
    fontWeight: 'bold',
    marginTop: '20px',
  },
  searchInput: {
    width: '100%',
    padding: '20px',
    fontSize: '24px',
    borderRadius: '16px',
    border: '2px solid rgba(255,255,255,0.2)',
    background: 'rgba(255,255,255,0.05)',
    color: '#fff',
    marginBottom: '20px',
    boxSizing: 'border-box',
    outline: 'none',
  },
  resultsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    maxHeight: '60vh',
    overflowY: 'auto',
  },
  resultItem: {
    background: 'rgba(255,255,255,0.05)',
    padding: '20px',
    borderRadius: '16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  productName: {
    fontSize: '24px',
    fontWeight: 'bold',
  },
  productPrice: {
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#10b981',
  }
};
