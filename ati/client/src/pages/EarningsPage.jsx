import { useState, useEffect } from 'react'

const card = { background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, padding:'16px 18px' }
const btn = (primary) => ({ padding:'7px 14px', borderRadius:8, border:'1px solid', cursor:'pointer', fontSize:13, fontWeight:600, background: primary ? 'rgba(99,102,241,0.15)' : 'transparent', color: primary ? '#818cf8' : 'var(--muted)', borderColor: primary ? '#818cf840' : 'var(--border)' })

export default function EarningsPage() {
  const [stocks, setStocks]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [analyses, setAnalyses] = useState({})
  const [aiLoading, setAiLoading] = useState({})

  async function loadData() {
    setLoading(true); setError(null)
    try {
      const r = await fetch('/api/chat/earnings-calendar')
      if (!r.ok) throw new Error('Failed')
      setStocks(await r.json())
    } catch (e) {
      setError('Could not load earnings data. ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  async function handleAnalyse(s) {
    setAiLoading(p => ({ ...p, [s.ticker]: true }))
    try {
      const r = await fetch('/api/chat/earnings-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: s.ticker, eps: s.eps, date: s.when, price: s.price, change: s.change, score: s.score }),
      })
      const d = await r.json()
      setAnalyses(p => ({ ...p, [s.ticker]: d.text }))
    } catch {
      setAnalyses(p => ({ ...p, [s.ticker]: 'Could not generate analysis. Please try again.' }))
    } finally {
      setAiLoading(p => ({ ...p, [s.ticker]: false }))
    }
  }

  return (
    <div>
      <h2 style={{ fontSize:20, fontWeight:700, marginBottom:4 }}>Earnings Intelligence</h2>
      <p style={{ fontSize:13, color:'var(--muted)', marginBottom:20 }}>Upcoming earnings candidates with AI pre-earnings analysis.</p>

      <div style={{ ...card, marginBottom:16 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
          <span style={{ fontWeight:700 }}>Upcoming Earnings</span>
          <button onClick={loadData} style={btn(false)}>↻ Refresh</button>
        </div>
        <p style={{ fontSize:13, color:'var(--muted)', marginBottom:16 }}>Real-time price data for upcoming earnings. Click "Analyse" for AI pre-earnings intelligence.</p>

        {loading && <div style={{ color:'var(--muted)', fontSize:13, padding:'20px 0', textAlign:'center' }}>Loading earnings calendar…</div>}
        {error   && <div style={{ color:'var(--red)', fontSize:13 }}>{error} <button onClick={loadData} style={{ color:'var(--accent)', cursor:'pointer', background:'none', border:'none' }}>Retry</button></div>}

        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {stocks.map(s => (
            <div key={s.ticker} style={{ border:'1px solid var(--border)', borderRadius:10, padding:'12px 14px' }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
                <div>
                  <span style={{ fontWeight:700 }}>{s.ticker}</span>
                  {s.name && <span style={{ color:'var(--muted)', fontSize:13, fontWeight:400, marginLeft:6 }}>· {s.name}</span>}
                  <div style={{ fontSize:13, marginTop:4 }}>
                    {s.price && <span>${s.price}</span>}
                    {s.change != null && <span style={{ color: s.change >= 0 ? 'var(--green)' : 'var(--red)', marginLeft:6 }}>({s.change > 0 ? '+' : ''}{s.change}%)</span>}
                    {s.eps && <span style={{ color:'var(--muted)', marginLeft:6 }}>· Est. EPS: ${s.eps}</span>}
                  </div>
                  <div style={{ fontSize:12, color:'var(--muted)', marginTop:3 }}>Earnings: {s.when} — plan position size before the report.</div>
                </div>
                <button
                  onClick={() => handleAnalyse(s)}
                  disabled={aiLoading[s.ticker]}
                  style={{ ...btn(true), opacity: aiLoading[s.ticker] ? 0.5 : 1 }}
                >
                  {aiLoading[s.ticker] ? 'Analysing…' : 'AI Analyse'}
                </button>
              </div>
              {analyses[s.ticker] && (
                <div style={{ marginTop:12, padding:'12px 14px', borderRadius:10, background:'rgba(99,102,241,0.08)', border:'1px solid rgba(99,102,241,0.25)', fontSize:13, lineHeight:1.7, whiteSpace:'pre-wrap' }}>
                  {analyses[s.ticker]}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
