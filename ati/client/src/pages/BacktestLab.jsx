import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid,
  AreaChart, Area, Cell, ComposedChart, Line,
} from 'recharts'

export default function BacktestLab() {
  const [symbol,   setSymbol]   = useState('NVDA')
  const [lookback, setLookback] = useState(90)
  const [horizon,  setHorizon]  = useState(20)
  const [minScore, setMinScore] = useState(65)
  const [benchmark,setBenchmark]= useState('SPY')
  const [result,   setResult]   = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  async function runBacktest(e) {
    e.preventDefault()
    setLoading(true); setError(''); setResult(null)
    try {
      const r = await fetch(`/api/backtest/${symbol.toUpperCase()}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lookback, horizon, minScore, benchmark }),
      })
      const d = await r.json()
      if (d.error) throw new Error(d.error)
      setResult(d)
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  const equityCurve = result?.trades?.length ? (() => {
    let cumulative = 0
    return result.trades.map(t => {
      cumulative += t.excess_return || 0
      return { date: t.entry_date, excess_return: t.excess_return, cumulative: +cumulative.toFixed(2) }
    })
  })() : []

  const winTrades  = result?.trades?.filter(t => t.excess_return > 0) || []
  const lossTrades = result?.trades?.filter(t => t.excess_return <= 0) || []

  return (
    <div style={{ maxWidth:960 }}>
      <h1 style={{ fontSize:22, fontWeight:700, marginBottom:6 }}>Backtest Lab</h1>
      <p style={{ color:'var(--muted)', fontSize:13, marginBottom:20 }}>
        Simulate ATI Score trading signals on historical price data. Research tool only — not investment advice.
      </p>

      {/* Config */}
      <form onSubmit={runBacktest} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:22, marginBottom:24 }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:18 }}>
          <Field label="Symbol">
            <input value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())} style={iStyle} placeholder="NVDA" />
          </Field>
          <Field label="Benchmark">
            <input value={benchmark} onChange={e => setBenchmark(e.target.value.toUpperCase())} style={iStyle} placeholder="SPY" />
          </Field>
          <Field label={`Lookback: ${lookback} days`}>
            <input type="range" min={30} max={365} step={10} value={lookback} onChange={e => setLookback(+e.target.value)} style={{ width:'100%' }} />
          </Field>
          <Field label={`Hold Period: ${horizon} days`}>
            <input type="range" min={5} max={60} value={horizon} onChange={e => setHorizon(+e.target.value)} style={{ width:'100%' }} />
          </Field>
          <Field label={`Min Score Trigger: ${minScore}`}>
            <input type="range" min={40} max={90} step={5} value={minScore} onChange={e => setMinScore(+e.target.value)} style={{ width:'100%' }} />
          </Field>
        </div>
        <button type="submit" disabled={loading} style={{ marginTop:18, padding:'10px 28px', background:'var(--accent)', color:'#fff', border:'none', borderRadius:6, cursor:'pointer', fontSize:14, fontWeight:600, opacity:loading?0.6:1 }}>
          {loading ? '⟳ Running…' : '▶ Run Backtest'}
        </button>
      </form>

      {error && (
        <div style={{ padding:14, background:'#ef444415', border:'1px solid #ef444435', borderRadius:8, color:'var(--red)', marginBottom:16, fontSize:13 }}>{error}</div>
      )}

      {result && (
        <div>
          {/* Stats Grid */}
          {result.stats && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:12, marginBottom:24 }}>
              {[
                { label:'Win Rate',          val:`${result.stats.win_rate}%`,          color: result.stats.win_rate >= 55 ? 'var(--green)' : 'var(--yellow)' },
                { label:'Avg Excess Return', val:`${result.stats.avg_excess_return}%`, color: result.stats.avg_excess_return >= 0 ? 'var(--green)' : 'var(--red)' },
                { label:'Total Return',      val:`${result.stats.avg_asset_return}%`,  color: result.stats.avg_asset_return >= 0 ? 'var(--green)' : 'var(--red)' },
                { label:'Total Signals',     val:result.stats.total_signals,            color:'var(--text)' },
                { label:'Winners',           val:winTrades.length,                      color:'var(--green)' },
                { label:'Losers',            val:lossTrades.length,                     color:'var(--red)' },
                { label:'Best Trade',        val:`+${result.stats.best_trade}%`,        color:'var(--green)' },
                { label:'Worst Trade',       val:`${result.stats.worst_trade}%`,        color:'var(--red)' },
              ].map(c => (
                <div key={c.label} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, padding:'12px 16px' }}>
                  <div style={{ fontSize:11, color:'var(--muted)', marginBottom:6 }}>{c.label}</div>
                  <div style={{ fontSize:22, fontWeight:700, color:c.color }}>{c.val}</div>
                </div>
              ))}
            </div>
          )}

          {/* Equity Curve */}
          {equityCurve.length > 0 && (
            <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:18, marginBottom:16 }}>
              <div style={{ fontSize:12, color:'var(--muted)', marginBottom:12, fontWeight:600 }}>Cumulative Excess Return vs {benchmark}</div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={equityCurve} margin={{ top:5, right:5, bottom:0, left:0 }}>
                  <defs>
                    <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={equityCurve[equityCurve.length-1]?.cumulative >= 0 ? '#22c55e' : '#ef4444'} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={equityCurve[equityCurve.length-1]?.cumulative >= 0 ? '#22c55e' : '#ef4444'} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize:9, fill:'#94a3b8' }} />
                  <YAxis tick={{ fontSize:10, fill:'#94a3b8' }} tickFormatter={v => `${v}%`} />
                  <Tooltip contentStyle={{ background:'#1f2937', border:'1px solid #374151', fontSize:12 }} formatter={v => [`${v}%`, 'Cumulative Excess Return']} />
                  <ReferenceLine y={0} stroke="#374151" />
                  <Area type="monotone" dataKey="cumulative" stroke={equityCurve[equityCurve.length-1]?.cumulative >= 0 ? '#22c55e' : '#ef4444'} strokeWidth={2} fill="url(#eqGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Individual Trade Returns */}
          {result.trades?.length > 0 && (
            <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:18, marginBottom:16 }}>
              <div style={{ fontSize:12, color:'var(--muted)', marginBottom:12, fontWeight:600 }}>Excess Return per Signal vs {benchmark}</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={result.trades} margin={{ top:0, right:5, bottom:0, left:0 }}>
                  <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                  <XAxis dataKey="entry_date" tick={{ fontSize:9, fill:'#94a3b8' }} />
                  <YAxis tick={{ fontSize:10, fill:'#94a3b8' }} tickFormatter={v => `${v}%`} />
                  <Tooltip contentStyle={{ background:'#1f2937', border:'1px solid #374151', fontSize:12 }} formatter={v => [`${v}%`, 'Excess Return']} />
                  <ReferenceLine y={0} stroke="#374151" />
                  <Bar dataKey="excess_return" radius={[3,3,0,0]}>
                    {result.trades.map((t, i) => <Cell key={i} fill={t.excess_return >= 0 ? '#22c55e' : '#ef4444'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Trade Log */}
          {result.trades?.length > 0 && (
            <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden', marginBottom:16 }}>
              <div style={{ padding:'10px 16px', borderBottom:'1px solid var(--border)', fontSize:12, color:'var(--muted)', fontWeight:600 }}>Trade Log</div>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                  <thead>
                    <tr style={{ color:'var(--muted)', fontSize:10, textTransform:'uppercase', borderBottom:'1px solid var(--border)' }}>
                      <th style={{ textAlign:'left', padding:'7px 14px' }}>Entry</th>
                      <th style={{ textAlign:'left', padding:'7px 14px' }}>Exit</th>
                      <th style={{ textAlign:'right', padding:'7px 14px' }}>Score</th>
                      <th style={{ textAlign:'right', padding:'7px 14px' }}>Asset Ret.</th>
                      <th style={{ textAlign:'right', padding:'7px 14px' }}>Bench Ret.</th>
                      <th style={{ textAlign:'right', padding:'7px 14px' }}>Excess</th>
                      <th style={{ textAlign:'center', padding:'7px 14px' }}>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.trades.map((t, i) => (
                      <tr key={i} style={{ borderBottom:'1px solid var(--border)' }}>
                        <td style={{ padding:'7px 14px' }}>{t.entry_date}</td>
                        <td style={{ padding:'7px 14px', color:'var(--muted)' }}>{t.exit_date}</td>
                        <td style={{ padding:'7px 14px', textAlign:'right' }}>{t.score}</td>
                        <td style={{ padding:'7px 14px', textAlign:'right', color: t.asset_return >= 0 ? 'var(--green)' : 'var(--red)' }}>{t.asset_return?.toFixed(2)}%</td>
                        <td style={{ padding:'7px 14px', textAlign:'right', color:'var(--muted)' }}>{t.benchmark_return?.toFixed(2)}%</td>
                        <td style={{ padding:'7px 14px', textAlign:'right', fontWeight:600, color: t.excess_return >= 0 ? 'var(--green)' : 'var(--red)' }}>{t.excess_return >= 0 ? '+' : ''}{t.excess_return?.toFixed(2)}%</td>
                        <td style={{ padding:'7px 14px', textAlign:'center' }}>{t.excess_return >= 0 ? '✓' : '✗'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div style={{ padding:12, background:'#fbbf2410', border:'1px solid #fbbf2430', borderRadius:6, fontSize:12, color:'var(--yellow)' }}>
            {result.stats?.note || 'Simulated backtest. Past performance does not predict future returns. Not investment advice.'}
          </div>
        </div>
      )}
    </div>
  )
}

const iStyle = { width:'100%', background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--text)', padding:'7px 10px', borderRadius:6, fontSize:13 }

function Field({ label, children }) {
  return (
    <div>
      <label style={{ display:'block', fontSize:11, color:'var(--muted)', marginBottom:5 }}>{label}</label>
      {children}
    </div>
  )
}
