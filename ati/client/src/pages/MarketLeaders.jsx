import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ScoreBadge, ProbabilityBar, ChangeChip, DataBadge } from '../components/ScoreBadge'

const SECTORS = ['All', 'Technology', 'Financials', 'Healthcare', 'Energy', 'Consumer Disc.', 'Consumer Stapl.', 'Industrials', 'Comm. Services', 'Real Estate', 'Utilities']
const SORT_KEYS = [
  { key:'apex_score',           label:'Score',   dir:'desc' },
  { key:'probability_outperform',label:'Prob',   dir:'desc' },
  { key:'change_percent',       label:'Today',   dir:'desc' },
  { key:'price',                label:'Price',   dir:'desc' },
]

export default function MarketLeaders() {
  const navigate = useNavigate()
  const [params]  = useSearchParams()
  const [scores, setScores]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [sector, setSector]     = useState(params.get('sector') || 'All')
  const [search, setSearch]     = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [commentary, setCommentary] = useState(null)
  const [sortKey,   setSortKey]  = useState('apex_score')
  const [sortDir,   setSortDir]  = useState('desc')
  const [view,      setView]     = useState('table')
  const [minScore,  setMinScore] = useState(0)

  const loadScores = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/scores/top?limit=150')
      const d = await r.json()
      setScores(d.scores || [])
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => {
    loadScores()
    fetch('/api/research/market-commentary').then(r => r.json()).then(d => setCommentary(d)).catch(() => {})
  }, [loadScores])

  const filtered = scores
    .filter(s => {
      const matchSector = sector === 'All' || s.sector === sector
      const matchSearch = !search || s.symbol.includes(search.toUpperCase()) || (s.name || '').toLowerCase().includes(search.toLowerCase())
      const matchScore  = (s.apex_score || 0) >= minScore
      return matchSector && matchSearch && matchScore
    })
    .sort((a, b) => {
      const va = a[sortKey] ?? 0
      const vb = b[sortKey] ?? 0
      return sortDir === 'desc' ? vb - va : va - vb
    })

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  async function triggerRefresh() {
    setRefreshing(true)
    await fetch('/api/jobs/refresh', { method:'POST' })
    setTimeout(() => { loadScores(); setRefreshing(false) }, 3000)
  }

  const bullish = scores.filter(s => s.apex_score >= 65).length
  const bearish = scores.filter(s => s.apex_score < 45).length

  return (
    <div>
      {/* ── Header ── */}
      <div className="page-header-mobile" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12, gap:8 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, margin:0 }}>Market Leaders</h1>
          <p style={{ color:'var(--muted)', fontSize:12, marginTop:2 }}>
            {scores.length} symbols scored
          </p>
        </div>
        <div style={{ display:'flex', gap:6, alignItems:'center', flexShrink:0 }}>
          <button onClick={() => setView(v => v==='table' ? 'card' : 'table')}
            className="desktop-only"
            style={{ padding:'6px 10px', background:'var(--bg3)', color:'var(--muted)', border:'1px solid var(--border)', borderRadius:6, cursor:'pointer', fontSize:11 }}>
            {view === 'table' ? '▦ Cards' : '≡ Table'}
          </button>
          <button onClick={triggerRefresh} disabled={refreshing}
            style={{ padding:'6px 14px', background:'var(--accent)', color:'#fff', border:'none', borderRadius:6, cursor:'pointer', fontSize:13, opacity:refreshing?0.6:1, whiteSpace:'nowrap' }}>
            {refreshing ? '⟳' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {/* ── Market Breadth compact row ── */}
      {scores.length > 0 && (
        <div style={{ display:'flex', gap:8, marginBottom:10, fontSize:12, flexWrap:'wrap' }}>
          <span style={{ padding:'3px 10px', borderRadius:20, background:'#22c55e15', border:'1px solid #22c55e30', color:'var(--green)', whiteSpace:'nowrap' }}>▲ {bullish} Bullish</span>
          <span style={{ padding:'3px 10px', borderRadius:20, background:'#ef444415', border:'1px solid #ef444430', color:'var(--red)', whiteSpace:'nowrap' }}>▽ {bearish} Bearish</span>
          <span style={{ padding:'3px 10px', borderRadius:20, background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--muted)', whiteSpace:'nowrap' }}>◈ {scores.length - bullish - bearish} Neutral</span>
        </div>
      )}

      {/* ── AI Commentary — desktop only ── */}
      {commentary?.text && (
        <div className="desktop-only" style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, padding:12, marginBottom:12 }}>
          <div style={{ fontSize:10, color:'var(--accent)', fontWeight:600, marginBottom:4, textTransform:'uppercase', letterSpacing:0.5 }}>AI Market Commentary</div>
          <p style={{ fontSize:12, color:'var(--muted)', lineHeight:1.5, margin:0, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{commentary.text}</p>
        </div>
      )}

      {/* ── Search bar ── */}
      <div style={{ marginBottom:8 }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search symbol or name…"
          style={{ background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--text)', padding:'7px 12px', borderRadius:8, fontSize:13, width:'100%', boxSizing:'border-box' }}
        />
      </div>

      {/* ── Sector filter — horizontal scroll on mobile ── */}
      <div className="filter-scroll" style={{ display:'flex', gap:6, marginBottom:10, alignItems:'center' }}>
        {SECTORS.map(s => (
          <button key={s} onClick={() => setSector(s)} style={{
            padding:'5px 12px', borderRadius:20, fontSize:11, cursor:'pointer', flexShrink:0,
            background: sector === s ? 'var(--accent)' : 'var(--bg3)',
            color: sector === s ? '#fff' : 'var(--muted)',
            border:`1px solid ${sector === s ? 'var(--accent)' : 'var(--border)'}`,
          }}>{s}</button>
        ))}
      </div>

      {/* ── Sort + Score filter row ── */}
      <div style={{ display:'flex', gap:6, marginBottom:10, alignItems:'center', flexWrap:'wrap' }}>
        <span style={{ fontSize:11, color:'var(--muted)', flexShrink:0 }}>Sort:</span>
        {SORT_KEYS.map(sk => (
          <button key={sk.key} onClick={() => toggleSort(sk.key)} style={{
            padding:'4px 10px', borderRadius:6, fontSize:11, cursor:'pointer', flexShrink:0,
            background: sortKey === sk.key ? 'var(--accent)' : 'var(--bg3)',
            color: sortKey === sk.key ? '#fff' : 'var(--muted)',
            border:`1px solid ${sortKey === sk.key ? 'var(--accent)' : 'var(--border)'}`,
          }}>
            {sk.label}{sortKey === sk.key ? (sortDir==='desc'?' ↓':' ↑') : ''}
          </button>
        ))}
        <div style={{ display:'flex', alignItems:'center', gap:6, marginLeft:'auto', flexShrink:0 }}>
          <span style={{ fontSize:11, color:'var(--muted)' }}>Min:<strong style={{ color:'var(--text)', marginLeft:3 }}>{minScore}</strong></span>
          <input type="range" min={0} max={80} step={5} value={minScore} onChange={e => setMinScore(+e.target.value)} style={{ width:70 }} />
        </div>
        <span style={{ color:'var(--muted)', fontSize:11, flexShrink:0 }}>{filtered.length}</span>
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div style={{ textAlign:'center', padding:50, color:'var(--muted)', fontSize:14 }}>
          Loading scores…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:50, color:'var(--muted)', fontSize:14 }}>
          No scores yet.<br />
          <button onClick={triggerRefresh} style={{ marginTop:12, padding:'8px 16px', background:'var(--accent)', color:'#fff', border:'none', borderRadius:6, cursor:'pointer', fontSize:13 }}>
            Run First Refresh
          </button>
        </div>
      ) : (
        <>
          {/* Mobile list view */}
          <div className="mobile-only">
            <MobileList filtered={filtered} navigate={navigate} />
          </div>
          {/* Desktop: table or cards */}
          <div className="desktop-only">
            {view === 'card'
              ? <CardView filtered={filtered} navigate={navigate} />
              : <TableView filtered={filtered} navigate={navigate} />
            }
          </div>
        </>
      )}
    </div>
  )
}

/* ── Mobile compact list ── */
function MobileList({ filtered, navigate }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      {filtered.map((s, i) => {
        const color = s.apex_score >= 65 ? 'var(--green)' : s.apex_score >= 45 ? 'var(--text)' : 'var(--red)'
        return (
          <div key={s.symbol} onClick={() => navigate(`/asset/${s.symbol}`)}
            style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:'11px 14px', cursor:'pointer', display:'flex', alignItems:'center', gap:10 }}
          >
            {/* Rank */}
            <div style={{ width:24, height:24, borderRadius:6, background:'rgba(129,140,248,0.15)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <span style={{ fontSize:10, fontWeight:800, color:'#818cf8' }}>{i+1}</span>
            </div>
            {/* Symbol + name */}
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontWeight:700, fontSize:14 }}>{s.symbol}</div>
              <div style={{ color:'var(--muted)', fontSize:11, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.name} · {s.sector}</div>
            </div>
            {/* Price + Change */}
            <div style={{ textAlign:'right', flexShrink:0 }}>
              <div style={{ fontWeight:600, fontSize:13 }}>{s.price ? `$${s.price.toFixed(2)}` : '—'}</div>
              <ChangeChip value={s.change_percent} />
            </div>
            {/* Score */}
            <div style={{ textAlign:'center', flexShrink:0, minWidth:36 }}>
              <div style={{ fontSize:20, fontWeight:900, color, lineHeight:1 }}>{s.apex_score}</div>
              <div style={{ fontSize:9, color:'var(--muted)', marginTop:1 }}>SCORE</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function TableView({ filtered, navigate }) {
  return (
    <div className="table-scroll">
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
        <thead>
          <tr style={{ borderBottom:'1px solid var(--border)', color:'var(--muted)', fontSize:11, textTransform:'uppercase', letterSpacing:0.5 }}>
            <th style={{ textAlign:'left', padding:'8px 12px', width:32 }}>#</th>
            <th style={{ textAlign:'left', padding:'8px 12px' }}>Symbol</th>
            <th style={{ textAlign:'left', padding:'8px 12px' }}>Rating</th>
            <th style={{ textAlign:'right', padding:'8px 12px' }}>Score</th>
            <th style={{ textAlign:'left', padding:'8px 12px', minWidth:140 }}>Prob. Outperform</th>
            <th style={{ textAlign:'right', padding:'8px 12px' }}>Price</th>
            <th style={{ textAlign:'right', padding:'8px 12px' }}>Today</th>
            <th style={{ textAlign:'left', padding:'8px 12px' }}>Sector</th>
            <th style={{ textAlign:'center', padding:'8px 12px' }}>Data</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((s, i) => (
            <tr key={s.symbol} onClick={() => navigate(`/asset/${s.symbol}`)}
              style={{ borderBottom:'1px solid var(--border)', cursor:'pointer', transition:'background 0.1s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <td style={{ padding:'9px 12px', color:'var(--muted)', fontSize:12 }}>{i + 1}</td>
              <td style={{ padding:'9px 12px' }}>
                <div style={{ fontWeight:700 }}>{s.symbol}</div>
                <div style={{ color:'var(--muted)', fontSize:11 }}>{s.name}</div>
              </td>
              <td style={{ padding:'9px 12px' }}>
                <ScoreBadge label={s.rating_label} score={s.apex_score} size="sm" />
              </td>
              <td style={{ padding:'9px 12px', textAlign:'right' }}>
                <span style={{ fontSize:18, fontWeight:800, color: s.apex_score >= 65 ? 'var(--green)' : s.apex_score >= 45 ? 'var(--text)' : 'var(--red)' }}>{s.apex_score}</span>
              </td>
              <td style={{ padding:'9px 12px' }}>
                <ProbabilityBar value={s.probability_outperform} compact />
              </td>
              <td style={{ padding:'9px 12px', textAlign:'right', fontFamily:'monospace' }}>
                {s.price ? `$${s.price.toFixed(2)}` : '—'}
              </td>
              <td style={{ padding:'9px 12px', textAlign:'right' }}>
                <ChangeChip value={s.change_percent} />
              </td>
              <td style={{ padding:'9px 12px', color:'var(--muted)', fontSize:11 }}>{s.sector}</td>
              <td style={{ padding:'9px 12px', textAlign:'center' }}>
                <DataBadge />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CardView({ filtered, navigate }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))', gap:12 }}>
      {filtered.map(s => {
        const color = s.apex_score >= 65 ? 'var(--green)' : s.apex_score >= 45 ? 'var(--accent)' : 'var(--red)'
        return (
          <div key={s.symbol} onClick={() => navigate(`/asset/${s.symbol}`)}
            style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:16, cursor:'pointer', transition:'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--bg3)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg2)' }}
          >
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
              <div>
                <div style={{ fontWeight:800, fontSize:16 }}>{s.symbol}</div>
                <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>{s.name?.slice(0,24)}</div>
              </div>
              <div style={{ fontSize:28, fontWeight:900, color }}>{s.apex_score}</div>
            </div>
            <ScoreBadge label={s.rating_label} score={s.apex_score} size="sm" />
            <div style={{ marginTop:10, display:'flex', justifyContent:'space-between', fontSize:12 }}>
              <span style={{ color:'var(--muted)' }}>{s.price ? `$${s.price.toFixed(2)}` : '—'}</span>
              <ChangeChip value={s.change_percent} />
            </div>
            <div style={{ marginTop:8 }}>
              <ProbabilityBar value={s.probability_outperform} compact />
            </div>
          </div>
        )
      })}
    </div>
  )
}
