import { useNavigate } from 'react-router-dom'

const OPTIONS_FLOW = [
  { ticker:'NVDA', side:'Call', strike:950,  expiry:'2026-05-03', premium:'$2.1M', sentiment:'Bullish' },
  { ticker:'TSLA', side:'Put',  strike:165,  expiry:'2026-05-10', premium:'$1.4M', sentiment:'Bearish' },
  { ticker:'AAPL', side:'Call', strike:210,  expiry:'2026-05-17', premium:'$890K', sentiment:'Bullish' },
  { ticker:'SPY',  side:'Put',  strike:510,  expiry:'2026-04-30', premium:'$3.2M', sentiment:'Bearish' },
]
const DARK_POOL = [
  { ticker:'AAPL', size:'400,000', price:'$199.20', time:'10:12 ET' },
  { ticker:'MSFT', size:'180,000', price:'$431.55', time:'11:02 ET' },
  { ticker:'NVDA', size:'95,000',  price:'$882.40', time:'09:48 ET' },
]
const CONGRESS = [
  { name:'Senator A', party:'D', ticker:'NVDA', side:'Buy',  amount:'$100K–$250K', date:'2026-03-31' },
  { name:'Rep. B',    party:'R', ticker:'XOM',  side:'Sell', amount:'$50K–$100K',  date:'2026-04-02' },
  { name:'Senator C', party:'R', ticker:'MSFT', side:'Buy',  amount:'$250K–$500K', date:'2026-04-10' },
]

const card = { background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, padding:'16px 18px', marginBottom:16 }
const chip = (green) => ({ background: green ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', color: green ? 'var(--green)' : 'var(--red)', borderRadius:6, padding:'2px 8px', fontSize:12, fontWeight:700 })

export default function FlowPage() {
  const navigate = useNavigate()
  const tickerLink = (ticker) => ({
    color:'var(--accent)', cursor:'pointer', fontWeight:700, textDecoration:'underline',
  })
  return (
    <div>
      <h2 style={{ fontSize:20, fontWeight:700, marginBottom:4 }}>Options Flow & Smart Money</h2>
      <p style={{ fontSize:13, color:'var(--muted)', marginBottom:20 }}>Unusual options activity, dark pool prints, and congressional disclosures.</p>

      <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:'10px 14px', marginBottom:18, fontSize:12, color:'var(--muted)' }}>
        ⚠ Options flow and dark pool data require paid data feeds (Unusual Whales, etc.) — showing representative examples.
      </div>

      <div className="mobile-grid-1" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
        <div style={card}>
          <h3 style={{ fontWeight:700, marginBottom:12 }}>Unusual Options Activity</h3>
          {OPTIONS_FLOW.map(o => (
            <div key={o.ticker+o.strike} style={{ border:'1px solid var(--border)', borderRadius:10, padding:'10px 12px', marginBottom:8 }}>
              <div style={{ fontWeight:600, color: o.side==='Call' ? 'var(--green)' : 'var(--red)', marginBottom:4 }}>
                <span onClick={() => navigate(`/asset/${o.ticker}`)} style={tickerLink(o.ticker)}>{o.ticker}</span>
                {' '}{o.side} ${o.strike} · {o.expiry} · {o.premium}
              </div>
              <div style={{ fontSize:12, color:'var(--muted)' }}>Large {o.side.toLowerCase()} bet — high premium indicates strong conviction from an institutional player.</div>
            </div>
          ))}
        </div>

        <div style={card}>
          <h3 style={{ fontWeight:700, marginBottom:12 }}>Dark Pool Prints</h3>
          {DARK_POOL.map(d => (
            <div key={d.ticker+d.time} style={{ border:'1px solid var(--border)', borderRadius:10, padding:'10px 12px', marginBottom:8 }}>
              <div style={{ fontWeight:600, marginBottom:4 }}>
                <span onClick={() => navigate(`/asset/${d.ticker}`)} style={tickerLink(d.ticker)}>{d.ticker}</span>
                {' '}{d.size} shares @ {d.price} <span style={{ color:'var(--muted)', fontWeight:400, fontSize:12 }}>({d.time})</span>
              </div>
              <div style={{ fontSize:12, color:'var(--muted)' }}>Large off-exchange block — can hint at institutions quietly building or trimming positions.</div>
            </div>
          ))}
        </div>
      </div>

      <div style={card}>
        <h3 style={{ fontWeight:700, marginBottom:12 }}>Congress & Senate Trades</h3>
        {CONGRESS.map(c => (
          <div key={c.name+c.ticker} style={{ border:'1px solid var(--border)', borderRadius:10, padding:'10px 12px', marginBottom:8 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
              <span style={{ fontWeight:600 }}>
                {c.name} <span style={{ color:'var(--muted)', fontWeight:400, fontSize:12 }}>({c.party})</span>
                {' · '}
                <span onClick={() => navigate(`/asset/${c.ticker}`)} style={tickerLink(c.ticker)}>{c.ticker}</span>
              </span>
              <span style={chip(c.side==='Buy')}>{c.side}</span>
            </div>
            <div style={{ fontSize:12, color:'var(--muted)' }}>{c.amount} · disclosed {c.date}</div>
          </div>
        ))}
        <p style={{ fontSize:12, color:'var(--muted)', marginTop:10 }}>Smart Money: Institutional flows concentrated in liquid mega-caps; volatility hedges remain active.</p>
      </div>
    </div>
  )
}
