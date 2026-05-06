import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const INSIDER_DATA = [
  { name:'Jensen Huang',    role:'CEO', company:'NVDA', side:'Buy',  amount:'$1.2M', date:'2026-04-20' },
  { name:'Satya Nadella',   role:'CEO', company:'MSFT', side:'Buy',  amount:'$890K', date:'2026-04-18' },
  { name:'Lisa Su',         role:'CEO', company:'AMD',  side:'Buy',  amount:'$540K', date:'2026-04-15' },
  { name:'Tim Cook',        role:'CEO', company:'AAPL', side:'Sell', amount:'$22M',  date:'2026-04-10' },
  { name:'Andy Jassy',      role:'CEO', company:'AMZN', side:'Buy',  amount:'$1.8M', date:'2026-04-08' },
  { name:'Mark Zuckerberg', role:'CEO', company:'META', side:'Sell', amount:'$58M',  date:'2026-04-05' },
]

export default function InsiderPage() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState('All')
  const shown = INSIDER_DATA.filter(d => filter === 'All' || d.side === filter)

  const filterBtn = (f) => ({
    padding:'5px 12px', borderRadius:8, border:'1px solid', cursor:'pointer', fontSize:13, fontWeight:600,
    background: f === filter ? (f === 'Buy' ? 'rgba(34,197,94,0.12)' : f === 'Sell' ? 'rgba(239,68,68,0.12)' : 'rgba(99,102,241,0.12)') : 'transparent',
    color:       f === filter ? (f === 'Buy' ? 'var(--green)' : f === 'Sell' ? 'var(--red)' : '#818cf8') : 'var(--muted)',
    borderColor: f === filter ? (f === 'Buy' ? '#22c55e40' : f === 'Sell' ? '#ef444440' : '#818cf840') : 'var(--border)',
  })

  return (
    <div>
      <h2 style={{ fontSize:20, fontWeight:700, marginBottom:4 }}>Insider & Institutional Tracker</h2>
      <p style={{ fontSize:13, color:'var(--muted)', marginBottom:20 }}>SEC Form 4 filings — executive buying and selling activity.</p>

      <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:'10px 14px', marginBottom:16, fontSize:12, color:'var(--muted)' }}>
        ⚠ Insider trades sourced from SEC Form 4 filings. Real-time data requires SEC EDGAR integration — showing recent examples.
      </div>

      <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, padding:'16px 18px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
          <span style={{ fontWeight:700 }}>Recent Insider Transactions</span>
          <div style={{ display:'flex', gap:8 }}>
            {['All','Buy','Sell'].map(f => <button key={f} onClick={() => setFilter(f)} style={filterBtn(f)}>{f}</button>)}
          </div>
        </div>
        <p style={{ fontSize:13, color:'var(--muted)', marginBottom:14 }}>Executives spending personal money on their stock can signal confidence. Large insider sells may be routine diversification or a warning.</p>

        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {shown.map(d => (
            <div key={d.name+d.date} style={{
              border:`1px solid ${d.side==='Buy' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
              background: d.side==='Buy' ? 'rgba(34,197,94,0.05)' : 'rgba(239,68,68,0.05)',
              borderRadius:10, padding:'12px 14px',
            }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
                <span style={{ fontWeight:600 }}>
                  {d.name} <span style={{ color:'var(--muted)', fontWeight:400, fontSize:12 }}>({d.role})</span>
                  {' · '}
                  <span onClick={() => navigate(`/asset/${d.company}`)}
                    style={{ color:'var(--accent)', cursor:'pointer', textDecoration:'underline', fontWeight:700 }}>
                    {d.company}
                  </span>
                </span>
                <span style={{ fontWeight:700, fontSize:12, padding:'2px 8px', borderRadius:6, background: d.side==='Buy' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: d.side==='Buy' ? 'var(--green)' : 'var(--red)' }}>
                  {d.side}
                </span>
              </div>
              <div style={{ fontSize:12, color:'var(--muted)', marginBottom:2 }}>{d.amount} · disclosed {d.date}</div>
              <div style={{ fontSize:12, color:'var(--muted)' }}>
                {d.side==='Buy' ? 'Leadership buying can indicate belief that shares are undervalued.' : 'Insider selling can be routine; compare against historical sell patterns.'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
