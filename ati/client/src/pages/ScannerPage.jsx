import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { loadJSON, saveJSON } from '../lib/storage'

const TAGS = ['momentum','earnings','breakout','short squeeze','low float','swing','avoid']
const fmtVol = v => !Number.isFinite(Number(v)) ? '-' : `${(Number(v)/1e6).toFixed(1)}M`

const card   = { background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, padding:'16px 18px', marginBottom:16 }
const input_ = { background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--text)', padding:'6px 10px', borderRadius:8, fontSize:13, outline:'none', width:'100%' }

function WatchlistPanel({ rows, watchlist, setWatchlist }) {
  const [newSym, setNewSym] = useState('')
  const add = () => {
    const s = newSym.trim().toUpperCase()
    if (!s || watchlist.some(w => w.symbol===s)) return
    setWatchlist([...watchlist, { symbol:s, tags:[], note:'', alert:false }])
    setNewSym('')
  }
  return (
    <div>
      <div style={{ display:'flex', gap:8, marginBottom:12 }}>
        <input value={newSym} onChange={e => setNewSym(e.target.value)} onKeyDown={e => e.key==='Enter' && add()} placeholder="Add symbol (e.g. TSLA)"
          style={{ ...input_, flex:1 }} />
        <button onClick={add} style={{ padding:'6px 12px', borderRadius:8, border:'1px solid var(--border)', color:'var(--text)', background:'transparent', cursor:'pointer', fontSize:13 }}>Add</button>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:8, maxHeight:280, overflowY:'auto' }}>
        {watchlist.length===0 && <p style={{ color:'var(--muted)', fontSize:13 }}>No symbols yet. Add one above.</p>}
        {watchlist.map(item => {
          const row = rows.find(r => r.symbol===item.symbol)
          return (
            <div key={item.symbol} style={{ border:'1px solid var(--border)', borderRadius:10, padding:'10px 12px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                <span style={{ fontWeight:700, fontSize:14 }}>{item.symbol}</span>
                <button onClick={() => setWatchlist(watchlist.filter(w => w.symbol!==item.symbol))} style={{ color:'var(--muted)', background:'none', border:'none', cursor:'pointer', fontSize:14 }}>✕</button>
              </div>
              <p style={{ fontSize:12, color:'var(--muted)', marginBottom:6 }}>
                Price <span style={{ color:'var(--text)' }}>{row?.price ?? '—'}</span> ·
                Change <span style={{ color: (row?.changePct??0)>=0 ? 'var(--green)' : 'var(--red)' }}>{row?.changePct ?? '—'}%</span> ·
                Vol <span style={{ color:'var(--text)' }}>{fmtVol(row?.volume)}</span>
              </p>
              <div style={{ marginBottom:6 }}>
                <button onClick={() => setWatchlist(watchlist.map(w => w.symbol===item.symbol ? { ...w, alert:!w.alert } : w))}
                  style={{ fontSize:11, padding:'2px 8px', borderRadius:6, border:`1px solid ${item.alert ? 'var(--green)' : 'var(--border)'}`, color: item.alert ? 'var(--green)' : 'var(--muted)', background:'transparent', cursor:'pointer' }}>
                  {item.alert ? '🔔 Alert on' : '🔕 Alert off'}
                </button>
              </div>
              <input value={item.note} placeholder="Quick note..." onChange={e => setWatchlist(watchlist.map(w => w.symbol===item.symbol ? { ...w, note:e.target.value } : w))}
                style={{ ...input_, marginBottom:6, fontSize:12 }} />
              <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                {TAGS.map(t => (
                  <button key={t} onClick={() => setWatchlist(watchlist.map(w => w.symbol===item.symbol ? { ...w, tags:w.tags.includes(t) ? w.tags.filter(x=>x!==t) : [...w.tags,t] } : w))}
                    style={{ fontSize:10, padding:'2px 6px', borderRadius:5, border:'1px solid', cursor:'pointer', background:'transparent', color: item.tags.includes(t) ? 'var(--green)' : 'var(--muted)', borderColor: item.tags.includes(t) ? 'var(--green)' : 'var(--border)' }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function ScannerPage() {
  const navigate = useNavigate()
  const [rows, setRows]         = useState([])
  const [watchlist, setWatchlist_] = useState(() => loadJSON('ati_watchlist', []))
  const [filters, setFilters]   = useState({ minPrice:0, maxPrice:9999, minChange:-50, maxChange:50, minGap:0, minRV:0, minVolume:0, newsOnly:false })

  function setWatchlist(v) { setWatchlist_(v); saveJSON('ati_watchlist', v) }

  useEffect(() => {
    fetch('/api/scores/top?limit=50')
      .then(r => r.json())
      .then(d => {
        const list = d.scores || d
        setRows(list.map(s => ({
          symbol: s.symbol ?? s.ticker,
          price: s.price ?? null,
          changePct: s.change_pct ?? s.change ?? 0,
          volume: s.volume ?? 0,
          relativeVolume: s.relative_volume ?? 1,
          premarketGapPct: 0,
          marketCap: s.market_cap ?? 0,
          floatShares: 0,
          newsCount: s.news_count ?? 0,
        })))
      })
      .catch(() => {})
  }, [])

  const scannerRows = useMemo(() => rows.filter(r => {
    if (r.price !== null && (r.price < filters.minPrice || r.price > filters.maxPrice)) return false
    if (r.changePct < filters.minChange || r.changePct > filters.maxChange) return false
    if (r.relativeVolume < filters.minRV) return false
    return true
  }), [rows, filters])

  const topGainers = [...rows].sort((a,b) => b.changePct - a.changePct).slice(0,5)
  const topLosers  = [...rows].sort((a,b) => a.changePct - b.changePct).slice(0,5)

  const numInput = (label, key) => (
    <label style={{ display:'flex', flexDirection:'column', gap:4, fontSize:12, color:'var(--muted)' }}>
      {label}
      <input type="number" value={filters[key]} onChange={e => setFilters(s => ({ ...s, [key]:+e.target.value }))}
        style={{ ...input_, fontSize:13 }} />
    </label>
  )

  return (
    <div>
      <h2 style={{ fontSize:20, fontWeight:700, marginBottom:4 }}>Setup Scanner</h2>
      <p style={{ fontSize:13, color:'var(--muted)', marginBottom:20 }}>Filter scored stocks by price, momentum, and volume. Track your watchlist.</p>

      <div className="mobile-grid-1" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
        <div style={card}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <span style={{ fontWeight:700 }}>Setup Scanner</span>
            <span style={{ fontSize:12, color:'var(--muted)' }}>{scannerRows.length} matches</span>
          </div>
          <div className="mobile-grid-2" style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:14 }}>
            {numInput('Min Price $','minPrice')}
            {numInput('Max Price $','maxPrice')}
            {numInput('Min Change %','minChange')}
            {numInput('Max Change %','maxChange')}
            {numInput('Min Rel. Vol','minRV')}
            {numInput('Min Volume','minVolume')}
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {scannerRows.length===0
              ? <p style={{ color:'var(--muted)', fontSize:13 }}>No matches with current filters.</p>
              : scannerRows.map(r => (
                  <div key={r.symbol} onClick={() => navigate(`/asset/${r.symbol}`)}
                    style={{ border:'1px solid var(--border)', borderRadius:8, padding:'6px 10px', fontSize:13, cursor:'pointer', transition:'border-color 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor='var(--accent)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor='var(--border)'}>
                    <span style={{ fontWeight:700 }}>{r.symbol}</span>
                    <span style={{ marginLeft:6, color: r.changePct>=0 ? 'var(--green)' : 'var(--red)' }}>{r.changePct}%</span>
                    <span style={{ marginLeft:6, color:'var(--muted)', fontSize:11 }}>RV {r.relativeVolume}x</span>
                  </div>
                ))
            }
          </div>
        </div>

        <div style={card}>
          <h3 style={{ fontWeight:700, marginBottom:14 }}>Personal Watchlist</h3>
          <WatchlistPanel rows={rows} watchlist={watchlist} setWatchlist={setWatchlist} />
        </div>
      </div>

      <div style={card}>
        <h3 style={{ fontWeight:700, marginBottom:12 }}>Market Overview</h3>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', fontSize:13, borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ textAlign:'left', color:'var(--muted)', borderBottom:'1px solid var(--border)' }}>
                <th style={{ paddingBottom:8, paddingRight:16 }}>Symbol</th>
                <th style={{ paddingBottom:8, paddingRight:16 }}>Change %</th>
                <th style={{ paddingBottom:8, paddingRight:16 }}>Rel. Vol</th>
                <th style={{ paddingBottom:8, paddingRight:16 }}>Volume</th>
                <th style={{ paddingBottom:8, paddingRight:16 }}>Mkt Cap</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0,15).map(r => (
                <tr key={r.symbol} onClick={() => navigate(`/asset/${r.symbol}`)} style={{ borderTop:'1px solid rgba(255,255,255,0.04)', cursor:'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background='var(--bg3)'}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                  <td style={{ padding:'8px 16px 8px 0', fontWeight:700, color:'var(--accent)' }}>{r.symbol}</td>
                  <td style={{ padding:'8px 16px 8px 0', color: r.changePct>=0 ? 'var(--green)' : 'var(--red)' }}>{r.changePct}%</td>
                  <td style={{ padding:'8px 16px 8px 0', color:'var(--muted)' }}>{r.relativeVolume}x</td>
                  <td style={{ padding:'8px 16px 8px 0', color:'var(--muted)' }}>{fmtVol(r.volume)}</td>
                  <td style={{ padding:'8px 16px 8px 0', color:'var(--muted)' }}>{r.marketCap > 0 ? `${(r.marketCap/1e9).toFixed(1)}B` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length > 0 && (
          <div style={{ marginTop:10, display:'flex', gap:16, fontSize:12 }}>
            <span style={{ color:'var(--green)' }}>Top gainers: {topGainers.map(x => x.symbol).join(', ')}</span>
            <span style={{ color:'var(--red)' }}>Top losers: {topLosers.map(x => x.symbol).join(', ')}</span>
          </div>
        )}
      </div>
    </div>
  )
}
