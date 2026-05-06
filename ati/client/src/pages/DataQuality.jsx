import { useState, useEffect } from 'react'

const KEY_LINKS = [
  { name:'Alpha Vantage', env:'ALPHA_VANTAGE_API_KEY', url:'https://www.alphavantage.co/support/#api-key', free:'25 req/day free', notes:'Quotes, OHLCV history, news sentiment', required:false },
  { name:'Finnhub',       env:'FINNHUB_API_KEY',        url:'https://finnhub.io',                          free:'60 req/min free', notes:'Real-time quotes, company news',      required:false },
  { name:'FMP',           env:'FMP_API_KEY',             url:'https://financialmodelingprep.com',           free:'250 req/day',    notes:'Income statements, margins, EPS',    required:false },
  { name:'FRED',          env:'FRED_API_KEY',            url:'https://fred.stlouisfed.org/docs/api/api_key.html', free:'Free unlimited', notes:'Macro: fed funds, CPI, yields', required:false },
  { name:'Gemini AI',     env:'GEMINI_API_KEY',          url:'https://ai.google.dev',                       free:'Free tier',      notes:'AI research summaries + commentary', required:false },
  { name:'SEC EDGAR',     env:'(no key needed)',          url:'https://efts.sec.gov',                        free:'Free public',    notes:'10-K, 10-Q, 8-K, XBRL facts',       required:false },
  { name:'FINRA',         env:'(no key needed)',          url:'https://www.finra.org',                       free:'Free public',    notes:'Daily short-sale volume',            required:false },
  { name:'Nasdaq RSS',    env:'(no key needed)',          url:'https://www.nasdaqtrader.com',                free:'Free public',    notes:'Trade halt/resume feed',             required:false },
  { name:'Market RSS',    env:'(no key needed)',          url:'',                                            free:'Free public',    notes:'News from MarketWatch, Reuters, etc.',required:false },
  { name:'Yahoo Finance', env:'(no key needed)',          url:'https://finance.yahoo.com',                   free:'Unofficial',     notes:'Quote + price history fallback',     required:false },
]

function Pill({ ok, label }) {
  return (
    <span style={{
      fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:10, marginLeft:6,
      background: ok ? '#22c55e20' : '#ef444420',
      color: ok ? '#22c55e' : '#ef4444',
      border: `1px solid ${ok ? '#22c55e40' : '#ef444440'}`,
    }}>{label}</span>
  )
}

export default function DataQuality() {
  const [status, setStatus]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/jobs/data-quality')
      .then(r => r.json())
      .then(d => { setStatus(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding:60, textAlign:'center', color:'var(--muted)' }}>Loading data quality…</div>

  const providers = status?.providers || {}
  const budget    = status?.budget    || []
  const cache     = status?.cache     || {}
  const missing   = status?.missingOptionalKeys || []
  const warnings  = status?.rateLimitWarnings   || []

  const configured   = Object.entries(providers).filter(([,v]) => v.configured).length
  const unconfigured = Object.entries(providers).filter(([,v]) => !v.configured).length

  return (
    <div style={{ maxWidth:920 }}>
      <h1 style={{ fontSize:22, fontWeight:700, marginBottom:6 }}>Data Quality & Sources</h1>
      <p style={{ color:'var(--muted)', fontSize:13, marginBottom:20 }}>
        ATI runs entirely on free data sources. No paid API is required. Add free keys to improve signal quality.
      </p>

      {/* No-paid-API confirmation */}
      <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap' }}>
        <StatusCard icon="✓" color="var(--green)" title="No paid API required" sub="App works without any keys" />
        <StatusCard icon={configured} color="var(--accent)" title="Active providers" sub="SEC, FINRA, RSS always on" />
        {missing.length > 0 && <StatusCard icon={missing.length} color="var(--yellow)" title="Optional keys missing" sub="App still works, lower confidence" />}
        {warnings.length > 0 && <StatusCard icon="⚠" color="var(--orange)" title="Rate limit warnings" sub="Some providers near daily budget" />}
      </div>

      {/* Rate Limit Warnings */}
      {warnings.length > 0 && (
        <div style={{ background:'#f9731615', border:'1px solid #f9731640', borderRadius:8, padding:14, marginBottom:20 }}>
          <div style={{ fontSize:12, fontWeight:600, color:'var(--orange)', marginBottom:8 }}>⚠ Rate Limit Warnings</div>
          {warnings.map((w, i) => (
            <div key={i} style={{ fontSize:13, color:'var(--text)', padding:'3px 0' }}>
              {w.warning}
            </div>
          ))}
        </div>
      )}

      {/* Missing Optional Keys */}
      {missing.length > 0 && (
        <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, padding:16, marginBottom:20 }}>
          <div style={{ fontSize:12, fontWeight:600, color:'var(--yellow)', marginBottom:10 }}>Missing Optional Keys — Add These for Better Signals</div>
          {missing.map(m => (
            <div key={m.key} style={{ display:'flex', gap:12, alignItems:'flex-start', padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
              <code style={{ background:'var(--bg3)', padding:'2px 8px', borderRadius:4, fontSize:11, color:'var(--accent)', whiteSpace:'nowrap' }}>{m.key}</code>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, color:'var(--text)' }}>{m.impact}</div>
                <a href={m.url} target="_blank" rel="noreferrer" style={{ fontSize:11, color:'var(--accent)' }}>Get free key ↗</a>
              </div>
            </div>
          ))}
          <div style={{ marginTop:10, fontSize:12, color:'var(--muted)' }}>
            Add these to your <code style={{ background:'var(--bg3)', padding:'1px 5px', borderRadius:3 }}>.env</code> file. The app works without them — keys only improve signal quality.
          </div>
        </div>
      )}

      {/* Today's API Budget */}
      <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, padding:16, marginBottom:20 }}>
        <div style={{ fontSize:12, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:0.5, marginBottom:12 }}>API Usage Today</div>
        {budget.length === 0 ? (
          <div style={{ color:'var(--muted)', fontSize:13 }}>No API calls made today — usage tracking starts on first refresh.</div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:10 }}>
            {budget.map(b => (
              <div key={b.provider} style={{ background:'var(--bg3)', borderRadius:6, padding:10 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                  <span style={{ fontSize:11, color:'var(--muted)', textTransform:'capitalize' }}>{b.provider.replace(/_/g,' ')}</span>
                  {b.pctUsed > 80 && <span style={{ fontSize:9, color:'var(--orange)', fontWeight:700 }}>NEAR LIMIT</span>}
                  {b.pctUsed > 95 && <span style={{ fontSize:9, color:'var(--red)', fontWeight:700 }}>AT LIMIT</span>}
                </div>
                <div style={{ height:4, background:'var(--border)', borderRadius:10, overflow:'hidden', marginBottom:5 }}>
                  <div style={{ width:`${b.pctUsed}%`, height:'100%', background: b.pctUsed > 90 ? 'var(--red)' : b.pctUsed > 70 ? 'var(--orange)' : 'var(--green)', transition:'width 0.4s', borderRadius:10 }} />
                </div>
                <div style={{ fontSize:12, fontWeight:600 }}>{b.used} <span style={{ color:'var(--muted)', fontWeight:400 }}>/ {b.limit}</span></div>
                {b.remaining < 5 && <div style={{ fontSize:10, color:'var(--red)', marginTop:2 }}>{b.remaining} calls remaining</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cache Status */}
      <div className="mobile-grid-2" style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:12, marginBottom:20 }}>
        {[
          { label:'Cache Entries', val:cache.total   ?? '—' },
          { label:'Valid (fresh)', val:cache.valid   ?? '—' },
          { label:'Stale/expired', val:cache.stale   ?? '—' },
          { label:'Cache hit rate',val:cache.hitRate != null ? `${cache.hitRate}%` : '—' },
        ].map(c => (
          <div key={c.label} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, padding:'12px 14px' }}>
            <div style={{ fontSize:11, color:'var(--muted)', marginBottom:5 }}>{c.label}</div>
            <div style={{ fontSize:22, fontWeight:700 }}>{c.val}</div>
          </div>
        ))}
      </div>

      {/* Provider Status */}
      <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, overflow:'hidden', marginBottom:20 }}>
        <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', fontSize:12, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:0.5 }}>
          Provider Status
        </div>
        {Object.entries(providers).map(([name, info]) => (
          <div key={name} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 16px', borderBottom:'1px solid var(--border)' }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background: info.configured ? 'var(--green)' : '#374151', flexShrink:0 }} />
            <div style={{ fontWeight:600, fontSize:13, width:140, textTransform:'capitalize' }}>{name.replace(/_/g,' ')}</div>
            <div style={{ fontSize:12, color: info.configured ? 'var(--muted)' : '#6b7280', flex:1 }}>{info.note}</div>
            <Pill ok={info.configured} label={info.configured ? 'ACTIVE' : 'INACTIVE'} />
          </div>
        ))}
      </div>

      {/* Free API Key Setup Guide */}
      <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, overflow:'hidden' }}>
        <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', fontSize:12, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:0.5 }}>
          Free Data Sources Reference
        </div>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead>
            <tr style={{ borderBottom:'1px solid var(--border)', color:'var(--muted)', fontSize:11, textTransform:'uppercase' }}>
              <th style={{ textAlign:'left', padding:'8px 16px' }}>Source</th>
              <th style={{ textAlign:'left', padding:'8px 16px' }}>Env Variable</th>
              <th style={{ textAlign:'left', padding:'8px 16px' }}>Free Tier</th>
              <th style={{ textAlign:'left', padding:'8px 16px' }}>Coverage</th>
              <th style={{ textAlign:'center', padding:'8px 16px' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {KEY_LINKS.map(k => {
              const providerKey = k.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z_]/g, '')
              const isActive    = providers[providerKey]?.configured
                || (k.env.startsWith('(') && true) // no-key sources always active
              return (
                <tr key={k.name} style={{ borderBottom:'1px solid var(--border)' }}>
                  <td style={{ padding:'10px 16px' }}>
                    {k.url ? (
                      <a href={k.url} target="_blank" rel="noreferrer" style={{ color:'var(--accent)', textDecoration:'none', fontWeight:600 }}>
                        {k.name} ↗
                      </a>
                    ) : <span style={{ fontWeight:600 }}>{k.name}</span>}
                  </td>
                  <td style={{ padding:'10px 16px', fontFamily:'monospace', fontSize:11, color:'var(--muted)' }}>{k.env}</td>
                  <td style={{ padding:'10px 16px', fontSize:12, color:'var(--green)' }}>{k.free}</td>
                  <td style={{ padding:'10px 16px', fontSize:12, color:'var(--muted)' }}>{k.notes}</td>
                  <td style={{ padding:'10px 16px', textAlign:'center' }}>
                    {k.env.startsWith('(')
                      ? <span style={{ fontSize:10, color:'var(--green)', background:'var(--green)18', padding:'2px 6px', borderRadius:8, fontWeight:700 }}>BUILT-IN</span>
                      : <Pill ok={!!providers[k.name.toLowerCase().replace(' ','_')]?.configured} label={providers[k.name.toLowerCase().replace(' ','_')]?.configured ? 'SET' : 'NOT SET'} />
                    }
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div style={{ padding:'12px 16px', fontSize:12, color:'var(--muted)', borderTop:'1px solid var(--border)' }}>
          Add keys to <code style={{ background:'var(--bg3)', padding:'1px 5px', borderRadius:3 }}>.env</code> file. Copy from <code style={{ background:'var(--bg3)', padding:'1px 5px', borderRadius:3 }}>.env.example</code>. App always works — keys improve signal quality.
        </div>
      </div>

      <div style={{ marginTop:16, padding:14, background:'#3b82f615', border:'1px solid #3b82f630', borderRadius:6, fontSize:12, color:'#93c5fd' }}>
        <strong>Fallback behaviour:</strong> When an API key is missing or a provider fails, ATI automatically tries the next source in priority order. Quotes and price history fall back to Yahoo Finance. News falls back to RSS feeds. SEC EDGAR and FINRA always run without keys. Every score includes a data quality object listing which sources contributed.
      </div>
    </div>
  )
}

function StatusCard({ icon, color, title, sub }) {
  return (
    <div style={{ background:'var(--bg2)', border:`1px solid ${color}40`, borderRadius:8, padding:'12px 16px', display:'flex', alignItems:'center', gap:12, minWidth:180 }}>
      <div style={{ fontSize:20, fontWeight:800, color, minWidth:28, textAlign:'center' }}>{icon}</div>
      <div>
        <div style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{title}</div>
        <div style={{ fontSize:11, color:'var(--muted)' }}>{sub}</div>
      </div>
    </div>
  )
}
