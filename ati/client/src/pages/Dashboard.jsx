import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts'
import { ScoreBadge, ChangeChip } from '../components/ScoreBadge'

const SECTOR_COLORS = {
  'Technology':       '#3b82f6',
  'Financials':       '#10b981',
  'Healthcare':       '#8b5cf6',
  'Energy':           '#f59e0b',
  'Consumer Disc.':   '#ef4444',
  'Consumer Stapl.':  '#06b6d4',
  'Industrials':      '#f97316',
  'Comm. Services':   '#ec4899',
  'Real Estate':      '#84cc16',
  'Utilities':        '#a78bfa',
  'Materials':        '#14b8a6',
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [scores, setScores]     = useState([])
  const [macro, setMacro]       = useState(null)
  const [loading, setLoading]   = useState(true)
  const [commentary, setCommentary] = useState(null)
  const [stats, setStats]       = useState(null)

  useEffect(() => {
    Promise.allSettled([
      fetch('/api/scores/top?limit=150').then(r => r.json()),
      fetch('/api/macro').then(r => r.json()),
      fetch('/api/research/market-commentary').then(r => r.json()),
      fetch('/api/universe/stats').then(r => r.json()),
    ]).then(([s, m, c, st]) => {
      if (s.status === 'fulfilled') setScores(s.value.scores || [])
      if (m.status === 'fulfilled') setMacro(m.value)
      if (c.status === 'fulfilled') setCommentary(c.value)
      if (st.status === 'fulfilled') setStats(st.value)
      setLoading(false)
    })
  }, [])

  const topMovers  = [...scores].sort((a, b) => (b.change_percent || 0) - (a.change_percent || 0)).slice(0, 5)
  const topDecline = [...scores].sort((a, b) => (a.change_percent || 0) - (b.change_percent || 0)).slice(0, 5)
  const topScored  = [...scores].sort((a, b) => (b.apex_score || 0) - (a.apex_score || 0)).slice(0, 8)

  const sectorMap = {}
  scores.forEach(s => {
    if (!s.sector) return
    if (!sectorMap[s.sector]) sectorMap[s.sector] = { sector: s.sector, avg: 0, count: 0, bullish: 0 }
    sectorMap[s.sector].avg  += s.apex_score || 0
    sectorMap[s.sector].count++
    if ((s.apex_score || 0) >= 65) sectorMap[s.sector].bullish++
  })
  const sectorData = Object.values(sectorMap)
    .map(s => ({ ...s, avg: Math.round(s.avg / s.count) }))
    .sort((a, b) => b.avg - a.avg)

  const bullCount  = scores.filter(s => s.apex_score >= 65).length
  const bearCount  = scores.filter(s => s.apex_score < 45).length
  const neutCount  = scores.length - bullCount - bearCount
  const bullPct    = scores.length ? Math.round((bullCount / scores.length) * 100) : 0

  const macroIndicators = macro?.data ? [
    { key: 'fedFunds',     label: 'Fed Funds', suffix: '%', good: v => v < 3 },
    { key: 'tenYearYield', label: '10Y Yield',  suffix: '%', good: v => v < 4.5 },
    { key: 'twoYearYield', label: '2Y Yield',   suffix: '%', good: v => v < 4.5 },
    { key: 'cpi',          label: 'CPI Index',  suffix: '', good: v => v > 0 },
    { key: 'unemployment', label: 'Unemploy.',  suffix: '%', good: v => v < 5 },
    { key: 'vix',          label: 'VIX',        suffix: '', good: v => v < 20 },
    { key: 'creditSpread', label: 'HY Spread',  suffix: '%', good: v => v < 5 },
    { key: 'gdpGrowth',    label: 'GDP Growth', suffix: '%', good: v => v > 0 },
  ] : []

  const regime = macro?.regime || 'unknown'
  const REGIME_LABELS = {
    restrictive_high_inflation: { label: 'Restrictive / High Inflation', color: '#ef4444' },
    restrictive:                { label: 'Restrictive',                  color: '#f97316' },
    neutral:                    { label: 'Neutral',                      color: '#fbbf24' },
    accommodative:              { label: 'Accommodative',                color: '#22c55e' },
    accommodative_slowdown:     { label: 'Accommodative / Slow Growth',  color: '#84cc16' },
    unknown:                    { label: 'Regime Unknown',               color: '#6b7280' },
  }
  const regimeInfo = REGIME_LABELS[regime] || REGIME_LABELS.unknown

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', flexDirection:'column', gap:12 }}>
      <div style={{ fontSize:28, animation:'spin 1s linear infinite' }}>◎</div>
      <div style={{ color:'var(--muted)', fontSize:14 }}>Loading market intelligence…</div>
    </div>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* Header Row */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontSize:24, fontWeight:800, margin:0 }}>Market Dashboard</h1>
          <p style={{ color:'var(--muted)', fontSize:13, marginTop:4 }}>
            {new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' })}
          </p>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <div style={{ padding:'6px 14px', borderRadius:20, fontSize:12, fontWeight:700, background:`${regimeInfo.color}20`, color:regimeInfo.color, border:`1px solid ${regimeInfo.color}40` }}>
            {regimeInfo.label}
          </div>
          {stats && <div style={{ padding:'6px 14px', borderRadius:20, fontSize:12, fontWeight:600, background:'var(--bg3)', color:'var(--muted)', border:'1px solid var(--border)' }}>{stats.total} symbols tracked</div>}
        </div>
      </div>

      {/* Market Breadth Bar */}
      {scores.length > 0 && (
        <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:'16px 20px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10, fontSize:12 }}>
            <span style={{ color:'var(--muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:0.5 }}>Market Breadth</span>
            <span style={{ color:'var(--muted)' }}>{scores.length} scored</span>
          </div>
          <div style={{ display:'flex', height:12, borderRadius:8, overflow:'hidden', gap:2 }}>
            <div style={{ width:`${bullPct}%`, background:'var(--green)', borderRadius:'6px 0 0 6px', transition:'width 0.5s' }} />
            <div style={{ width:`${Math.round((neutCount/scores.length)*100)}%`, background:'var(--accent)', transition:'width 0.5s' }} />
            <div style={{ width:`${Math.round((bearCount/scores.length)*100)}%`, background:'var(--red)', borderRadius:'0 6px 6px 0', transition:'width 0.5s' }} />
          </div>
          <div style={{ display:'flex', gap:20, marginTop:8, fontSize:12 }}>
            <span style={{ color:'var(--green)' }}>▲ {bullCount} Bullish ({bullPct}%)</span>
            <span style={{ color:'var(--accent)' }}>◈ {neutCount} Neutral</span>
            <span style={{ color:'var(--red)' }}>▽ {bearCount} Bearish</span>
          </div>
        </div>
      )}

      {/* Top Row: Macro + AI Commentary */}
      <div className="mobile-grid-1" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>

        {/* Macro Panel */}
        <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:16 }}>
          <div style={{ fontSize:12, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:0.5, marginBottom:14 }}>Macro Indicators</div>
          {macroIndicators.length === 0 ? (
            <div style={{ color:'var(--muted)', fontSize:13 }}>Set FRED_API_KEY for live macro data.</div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              {macroIndicators.map(ind => {
                const d = macro.data[ind.key]
                if (!d) return null
                const isGood = ind.good(d.value)
                return (
                  <div key={ind.key} style={{ background:'var(--bg3)', borderRadius:8, padding:'10px 12px' }}>
                    <div style={{ fontSize:10, color:'var(--muted)', marginBottom:4, textTransform:'uppercase', letterSpacing:0.4 }}>{ind.label}</div>
                    <div style={{ display:'flex', alignItems:'baseline', gap:4 }}>
                      <span style={{ fontSize:22, fontWeight:800, color: isGood ? 'var(--green)' : '#f59e0b' }}>{d.value.toFixed(2)}</span>
                      <span style={{ fontSize:11, color:'var(--muted)' }}>{ind.suffix}</span>
                    </div>
                    <div style={{ fontSize:10, color:'var(--muted)', marginTop:2 }}>as of {d.date}</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* AI Commentary */}
        <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:16, display:'flex', flexDirection:'column' }}>
          <div style={{ fontSize:12, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:0.5, marginBottom:12 }}>AI Market Commentary</div>
          {commentary?.text ? (
            <div style={{ flex:1, overflow:'hidden' }}>
              <p style={{ fontSize:13, color:'var(--text)', lineHeight:1.65, margin:0, whiteSpace:'pre-line', overflow:'hidden', display:'-webkit-box', WebkitLineClamp:8, WebkitBoxOrient:'vertical' }}>{commentary.text}</p>
              <div style={{ marginTop:10, fontSize:11, color:'var(--muted)' }}>Powered by Gemini AI · {new Date().toLocaleDateString()}</div>
            </div>
          ) : (
            <div style={{ color:'var(--muted)', fontSize:13 }}>Commentary loads with Market Leaders page or on first data refresh.</div>
          )}
        </div>
      </div>

      {/* Sector Heatmap */}
      {sectorData.length > 0 && (
        <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:16 }}>
          <div style={{ fontSize:12, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:0.5, marginBottom:14 }}>Sector Intelligence</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(120px, 1fr))', gap:8 }}>
            {sectorData.map(s => {
              const color = s.avg >= 65 ? '#22c55e' : s.avg >= 50 ? '#3b82f6' : s.avg >= 40 ? '#f59e0b' : '#ef4444'
              return (
                <div key={s.sector} onClick={() => navigate(`/?sector=${s.sector}`)}
                  style={{ background:`${color}15`, border:`1px solid ${color}30`, borderRadius:8, padding:'12px 10px', cursor:'pointer', transition:'all 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = `${color}25`}
                  onMouseLeave={e => e.currentTarget.style.background = `${color}15`}
                >
                  <div style={{ fontSize:10, color:'var(--muted)', marginBottom:6, textTransform:'uppercase', letterSpacing:0.3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.sector}</div>
                  <div style={{ fontSize:26, fontWeight:800, color }}>{s.avg}</div>
                  <div style={{ fontSize:10, color:'var(--muted)', marginTop:3 }}>{s.count} stocks · {s.bullish} bullish</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Sector Bar Chart */}
      {sectorData.length > 0 && (
        <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:16 }}>
          <div style={{ fontSize:12, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:0.5, marginBottom:14 }}>Average Score by Sector</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={sectorData} margin={{ top:0, right:0, bottom:30, left:0 }}>
              <XAxis dataKey="sector" tick={{ fontSize:9, fill:'#94a3b8' }} angle={-35} textAnchor="end" interval={0} />
              <YAxis domain={[0, 100]} tick={{ fontSize:10, fill:'#94a3b8' }} width={28} />
              <Tooltip
                contentStyle={{ background:'var(--bg2)', border:'1px solid var(--border)', fontSize:12 }}
                formatter={(v, n, p) => [`${v} / 100`, 'Avg Score']}
              />
              <Bar dataKey="avg" radius={[4,4,0,0]}>
                {sectorData.map((s, i) => (
                  <Cell key={i} fill={SECTOR_COLORS[s.sector] || '#3b82f6'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Movers + Top Scores */}
      <div className="mobile-grid-1" style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1.5fr', gap:16 }}>

        {/* Top Gainers */}
        <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:16 }}>
          <div style={{ fontSize:12, fontWeight:600, color:'var(--green)', textTransform:'uppercase', letterSpacing:0.5, marginBottom:12 }}>Top Gainers Today</div>
          {topMovers.map(s => (
            <div key={s.symbol} onClick={() => navigate(`/asset/${s.symbol}`)}
              style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid var(--border)', cursor:'pointer' }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              <div>
                <div style={{ fontWeight:700, fontSize:13 }}>{s.symbol}</div>
                <div style={{ fontSize:10, color:'var(--muted)' }}>{s.name?.slice(0, 22)}</div>
              </div>
              <ChangeChip value={s.change_percent} />
            </div>
          ))}
        </div>

        {/* Top Decliners */}
        <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:16 }}>
          <div style={{ fontSize:12, fontWeight:600, color:'var(--red)', textTransform:'uppercase', letterSpacing:0.5, marginBottom:12 }}>Top Decliners Today</div>
          {topDecline.map(s => (
            <div key={s.symbol} onClick={() => navigate(`/asset/${s.symbol}`)}
              style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid var(--border)', cursor:'pointer' }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              <div>
                <div style={{ fontWeight:700, fontSize:13 }}>{s.symbol}</div>
                <div style={{ fontSize:10, color:'var(--muted)' }}>{s.name?.slice(0, 22)}</div>
              </div>
              <ChangeChip value={s.change_percent} />
            </div>
          ))}
        </div>

        {/* Top ATI Scores */}
        <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:16 }}>
          <div style={{ fontSize:12, fontWeight:600, color:'var(--accent)', textTransform:'uppercase', letterSpacing:0.5, marginBottom:12 }}>Highest ATI Scores</div>
          {topScored.length === 0 ? (
            <div style={{ color:'var(--muted)', fontSize:13 }}>Run a score refresh to populate.</div>
          ) : topScored.map(s => (
            <div key={s.symbol} onClick={() => navigate(`/asset/${s.symbol}`)}
              style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid var(--border)', cursor:'pointer' }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, fontSize:13 }}>{s.symbol} <span style={{ fontWeight:400, fontSize:11, color:'var(--muted)' }}>{s.name?.slice(0, 18)}</span></div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontSize:18, fontWeight:800, color: s.apex_score >= 65 ? 'var(--green)' : s.apex_score >= 45 ? 'var(--text)' : 'var(--red)' }}>{s.apex_score}</span>
                <ScoreBadge label={s.rating_label} score={s.apex_score} size="sm" />
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
