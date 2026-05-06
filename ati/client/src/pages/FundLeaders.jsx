import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ScoreBadge, ProbabilityBar, ChangeChip, DataBadge } from '../components/ScoreBadge'

export default function FundLeaders() {
  const navigate = useNavigate()
  const [funds, setFunds] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/scores/top-funds?limit=50')
      .then(r => r.json())
      .then(d => { setFunds(d.scores || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = funds.filter(f =>
    !search || f.symbol.includes(search.toUpperCase()) || (f.name || '').toLowerCase().includes(search.toLowerCase()) || (f.sector || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700 }}>Fund & ETF Leaders</h1>
          <p style={{ color:'var(--muted)', fontSize:13, marginTop:3 }}>
            ETF momentum, volatility, and sentiment scoring against SPY benchmark
          </p>
        </div>
      </div>

      <div style={{ marginBottom:16 }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Filter funds…"
          style={{ background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--text)', padding:'6px 12px', borderRadius:6, fontSize:13, width:200 }} />
        <span style={{ marginLeft:12, color:'var(--muted)', fontSize:12 }}>{filtered.length} funds/ETFs</span>
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:60, color:'var(--muted)', fontSize:14 }}>Loading fund scores…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:60, color:'var(--muted)', fontSize:14 }}>No fund scores yet. Trigger a refresh from Market Leaders.</div>
      ) : (
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ borderBottom:'1px solid var(--border)', color:'var(--muted)', fontSize:11, textTransform:'uppercase', letterSpacing:0.5 }}>
                <th style={{ textAlign:'left', padding:'8px 12px', width:32 }}>#</th>
                <th style={{ textAlign:'left', padding:'8px 12px' }}>Fund / ETF</th>
                <th style={{ textAlign:'left', padding:'8px 12px' }}>Rating</th>
                <th style={{ textAlign:'right', padding:'8px 12px' }}>Score</th>
                <th style={{ textAlign:'left', padding:'8px 12px', width:160 }}>Prob. Outperform SPY</th>
                <th style={{ textAlign:'left', padding:'8px 12px' }}>Category</th>
                <th style={{ textAlign:'center', padding:'8px 12px' }}>Data</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((f, i) => {
                const dq = tryParse(f.data_quality_json, {})
                return (
                  <tr key={f.symbol} onClick={() => navigate(`/asset/${f.symbol}`)}
                    style={{ borderBottom:'1px solid var(--border)', cursor:'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding:'10px 12px', color:'var(--muted)', fontSize:12 }}>{i + 1}</td>
                    <td style={{ padding:'10px 12px' }}>
                      <div style={{ fontWeight:600 }}>{f.symbol}</div>
                      <div style={{ color:'var(--muted)', fontSize:11, marginTop:1 }}>{f.name}</div>
                    </td>
                    <td style={{ padding:'10px 12px' }}>
                      <ScoreBadge label={f.rating_label} score={f.apex_score} size="sm" />
                    </td>
                    <td style={{ padding:'10px 12px', textAlign:'right', fontWeight:700, fontSize:16, color: f.apex_score >= 65 ? 'var(--green)' : f.apex_score >= 45 ? 'var(--text)' : 'var(--red)' }}>
                      {f.apex_score}
                    </td>
                    <td style={{ padding:'10px 12px' }}>
                      <ProbabilityBar value={f.probability_outperform} compact />
                    </td>
                    <td style={{ padding:'10px 12px', color:'var(--muted)', fontSize:11 }}>{f.sector}</td>
                    <td style={{ padding:'10px 12px', textAlign:'center' }}>
                      <DataBadge />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function tryParse(str, fallback) {
  try { return JSON.parse(str) } catch { return fallback }
}
