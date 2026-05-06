import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const TREND = [
  { d:'Mon', m:40, b:35 },
  { d:'Tue', m:55, b:48 },
  { d:'Wed', m:78, b:65 },
  { d:'Thu', m:62, b:70 },
  { d:'Fri', m:90, b:82 },
]

const card = { background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, padding:'16px 18px', marginBottom:16 }

export default function SentimentPage() {
  const navigate = useNavigate()
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/scores/top?limit=5')
      .then(r => r.json())
      .then(d => { setAssets((d.scores || d).slice(0, 5)); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div>
      <h2 style={{ fontSize:20, fontWeight:700, marginBottom:4 }}>Sentiment Radar</h2>
      <p style={{ fontSize:13, color:'var(--muted)', marginBottom:20 }}>Social mention volume and bullish sentiment trends across the market.</p>

      <div style={card}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
          <span style={{ fontSize:11, color:'var(--muted)', fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase' }}>Social Sentiment Radar</span>
          <div style={{ display:'flex', gap:12, fontSize:12, color:'var(--muted)' }}>
            <span style={{ display:'flex', alignItems:'center', gap:5 }}><span style={{ display:'inline-block', width:8, height:8, borderRadius:'50%', background:'#0a84ff' }}/>Mentions</span>
            <span style={{ display:'flex', alignItems:'center', gap:5 }}><span style={{ display:'inline-block', width:8, height:8, borderRadius:'50%', background:'var(--green)' }}/>Bullish %</span>
          </div>
        </div>
        <div style={{ height:200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={TREND} margin={{ top:4, right:4, left:-20, bottom:0 }}>
              <defs>
                <linearGradient id="gMentions" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#0a84ff" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#0a84ff" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gBull" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#30d158" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#30d158" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="d" stroke="none" tick={{ fill:'#8e8e93', fontSize:11 }} axisLine={false} tickLine={false} />
              <YAxis stroke="none" tick={{ fill:'#8e8e93', fontSize:11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background:'rgba(28,28,30,0.95)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:10, fontSize:12 }}
                labelStyle={{ color:'#fff', fontWeight:500 }}
              />
              <Area type="monotone" dataKey="m" stroke="#0a84ff" strokeWidth={1.5} fill="url(#gMentions)" dot={false} name="Mentions" />
              <Area type="monotone" dataKey="b" stroke="#30d158" strokeWidth={1.5} fill="url(#gBull)"    dot={false} name="Bullish %" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <p style={{ fontSize:12, color:'var(--muted)', marginTop:10 }}>Blue = mention volume index · Green = bullish sentiment % · Rising both = strong crowd-confirmation signal.</p>
      </div>

      <div style={card}>
        <h3 style={{ fontWeight:700, marginBottom:14 }}>Top Scored Assets — Sentiment View</h3>
        {loading ? (
          <div style={{ color:'var(--muted)', fontSize:13 }}>Loading…</div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {assets.map(a => {
              const sentiment = Math.round(Math.min(99, Math.max(1, a.score100 ?? a.apex_score ?? a.score ?? 50)))
              const chg = a.change ?? a.change_pct ?? 0
              return (
                <div key={a.ticker ?? a.symbol}
                  onClick={() => navigate(`/asset/${a.ticker ?? a.symbol}`)}
                  style={{ border:'1px solid var(--border)', borderRadius:10, padding:'12px 14px', cursor:'pointer', transition:'border-color 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor='var(--accent)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor='var(--border)'}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                    <span style={{ fontWeight:700, color:'var(--accent)' }}>{a.ticker ?? a.symbol} <span style={{ color:'var(--muted)', fontSize:13, fontWeight:400 }}>{a.name}</span></span>
                    <span style={{ color: chg >= 0 ? 'var(--green)' : 'var(--red)', fontWeight:600, fontSize:13 }}>{chg > 0 ? '+' : ''}{chg}%</span>
                  </div>
                  <p style={{ fontSize:12, color:'var(--muted)', marginBottom:6 }}>
                    {a.price ? `$${a.price} · ` : ''}ATI sentiment score: {sentiment}/100
                  </p>
                  <div style={{ height:6, borderRadius:3, background:'var(--bg3)', overflow:'hidden' }}>
                    <div style={{ width:`${sentiment}%`, height:'100%', borderRadius:3, background: sentiment >= 60 ? 'var(--green)' : sentiment >= 40 ? 'var(--yellow)' : 'var(--red)' }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
