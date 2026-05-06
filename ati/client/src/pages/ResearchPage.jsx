import { useState } from 'react'

const RESEARCH_TICKERS = ['NVDA','AAPL','MSFT','TSLA','META','AMZN','GOOGL','AMD','PLTR','COIN']
const RESEARCH_QUESTIONS = [
  'What is the current state of the AI semiconductor cycle?',
  'Which sectors historically outperform in a high-VIX environment?',
  'Explain the relationship between Fed policy and small-cap stocks',
  'What are the best technical indicators for momentum trading?',
  'How does dark pool data affect retail traders?',
]

const card = { background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, padding:'16px 18px', marginBottom:16 }
const modeBtn = (active) => ({ padding:'7px 14px', borderRadius:8, border:'1px solid', cursor:'pointer', fontSize:13, fontWeight:600, background: active ? 'rgba(99,102,241,0.15)' : 'transparent', color: active ? '#818cf8' : 'var(--muted)', borderColor: active ? '#818cf840' : 'var(--border)' })
const chip = (active) => ({ padding:'4px 10px', borderRadius:8, border:'1px solid', cursor:'pointer', fontSize:12, background: active ? 'rgba(99,102,241,0.15)' : 'transparent', color: active ? '#818cf8' : 'var(--muted)', borderColor: active ? '#818cf840' : 'var(--border)' })

export default function ResearchPage() {
  const [mode, setMode]       = useState('ticker')
  const [ticker, setTicker]   = useState('')
  const [question, setQuestion] = useState('')
  const [result, setResult]   = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  const [history, setHistory] = useState([])

  async function runResearch(overrideTicker, overrideQuestion) {
    const t = overrideTicker  ?? ticker.trim().toUpperCase()
    const q = overrideQuestion ?? question.trim()
    if (mode==='ticker' && !t) return
    if (mode==='question' && !q) return
    setLoading(true); setError(null); setResult(null)
    try {
      const r = await fetch('/api/chat/research', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ ticker: mode==='ticker' ? t : null, question: mode==='question' ? q : null }),
      })
      const d = await r.json()
      const entry = { mode, label: mode==='ticker' ? t : q, text: d.text, ts: new Date().toLocaleTimeString() }
      setResult(entry)
      setHistory(h => [entry, ...h].slice(0, 10))
    } catch {
      setError('Research failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h2 style={{ fontSize:20, fontWeight:700, marginBottom:4 }}>Deep Research</h2>
      <p style={{ fontSize:13, color:'var(--muted)', marginBottom:20 }}>AI-powered stock and market research reports powered by Gemini.</p>

      <div style={card}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
          <span style={{ fontWeight:700 }}>Research Engine</span>
          <span style={{ fontSize:11, color:'#818cf8', border:'1px solid rgba(129,140,248,0.35)', borderRadius:20, padding:'2px 10px' }}>Gemini Pro</span>
        </div>
        <div style={{ display:'flex', gap:8, marginBottom:16 }}>
          <button onClick={() => setMode('ticker')}   style={modeBtn(mode==='ticker')}>📊 Stock Research</button>
          <button onClick={() => setMode('question')} style={modeBtn(mode==='question')}>🔍 Market Question</button>
        </div>

        {mode==='ticker' ? (
          <div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
              {RESEARCH_TICKERS.map(t => <button key={t} onClick={() => setTicker(t)} style={chip(ticker===t)}>{t}</button>)}
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <input value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())} placeholder="Or type any ticker (e.g. NFLX)"
                style={{ flex:1, background:'var(--bg)', border:'1px solid var(--border)', color:'var(--text)', padding:'8px 12px', borderRadius:8, fontSize:13, outline:'none' }} />
              <button onClick={() => runResearch()} disabled={loading || !ticker.trim()} style={{ padding:'8px 16px', borderRadius:8, background:'rgba(99,102,241,0.15)', border:'1px solid rgba(129,140,248,0.4)', color:'#818cf8', fontWeight:700, cursor:'pointer', opacity:(loading||!ticker.trim())?0.4:1 }}>
                {loading ? 'Researching…' : 'Research'}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:12 }}>
              {RESEARCH_QUESTIONS.map(q => (
                <button key={q} onClick={() => setQuestion(q)} style={{ textAlign:'left', padding:'6px 10px', borderRadius:8, border:'1px solid var(--border)', color:'var(--muted)', background:'transparent', cursor:'pointer', fontSize:12 }}>{q}</button>
              ))}
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <textarea value={question} onChange={e => setQuestion(e.target.value)} placeholder="Ask a deep market research question…" rows={2}
                style={{ flex:1, background:'var(--bg)', border:'1px solid var(--border)', color:'var(--text)', padding:'8px 12px', borderRadius:8, fontSize:13, outline:'none', resize:'none', fontFamily:'inherit' }} />
              <button onClick={() => runResearch()} disabled={loading || !question.trim()} style={{ padding:'8px 16px', borderRadius:8, background:'rgba(99,102,241,0.15)', border:'1px solid rgba(129,140,248,0.4)', color:'#818cf8', fontWeight:700, cursor:'pointer', opacity:(loading||!question.trim())?0.4:1 }}>
                {loading ? 'Researching…' : 'Research'}
              </button>
            </div>
          </div>
        )}
      </div>

      {loading && (
        <div style={{ ...card, display:'flex', alignItems:'center', gap:10, fontSize:13, color:'var(--muted)' }}>
          <span style={{ width:14, height:14, borderRadius:'50%', border:'2px solid rgba(129,140,248,0.3)', borderTopColor:'#818cf8', display:'inline-block', animation:'spin 0.8s linear infinite' }} />
          Gemini is generating a deep research report — this may take 15–30 seconds…
        </div>
      )}

      <style>{`@keyframes spin { to { transform:rotate(360deg) } }`}</style>

      {error && <div style={card}><p style={{ color:'var(--red)', fontSize:13 }}>{error}</p></div>}

      {result && (
        <div style={card}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <h3 style={{ fontWeight:700, fontSize:15 }}>{result.mode==='ticker' ? `${result.label} — Research Report` : 'Research Answer'}</h3>
            <span style={{ fontSize:12, color:'var(--muted)' }}>{result.ts}</span>
          </div>
          <div style={{ fontSize:13, lineHeight:1.75, whiteSpace:'pre-wrap', color:'var(--text)' }}>{result.text}</div>
        </div>
      )}

      {history.length > 1 && (
        <div style={card}>
          <h3 style={{ fontWeight:700, fontSize:14, marginBottom:10 }}>Recent Research</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {history.slice(1).map((h, i) => (
              <button key={i} onClick={() => setResult(h)} style={{ textAlign:'left', border:'1px solid var(--border)', borderRadius:10, padding:'8px 12px', fontSize:13, background:'transparent', cursor:'pointer', color:'var(--text)' }}>
                <span style={{ fontWeight:600 }}>{h.label}</span>
                <span style={{ color:'var(--muted)', marginLeft:8, fontSize:12 }}>{h.ts}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
