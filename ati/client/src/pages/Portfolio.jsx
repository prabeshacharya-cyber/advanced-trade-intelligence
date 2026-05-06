import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, ReferenceLine } from 'recharts'
import { ChangeChip, ScoreBadge } from '../components/ScoreBadge'

const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#ec4899','#84cc16','#a78bfa']

export default function Portfolio() {
  const navigate  = useNavigate()
  const [data, setData]         = useState(null)
  const [loading, setLoading]   = useState(true)
  const [showAdd, setShowAdd]   = useState(false)
  const [editPos, setEditPos]   = useState(null)
  const [form, setForm]         = useState({ symbol:'', shares:'', avg_cost:'', notes:'' })
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr]           = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/portfolio/summary')
      const d = await r.json()
      setData(d)
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function submit(e) {
    e.preventDefault()
    setSubmitting(true); setErr('')
    try {
      const url    = editPos ? `/api/portfolio/${editPos.symbol}` : '/api/portfolio'
      const method = editPos ? 'PUT' : 'POST'
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, shares: +form.shares, avg_cost: +form.avg_cost }),
      })
      const d = await r.json()
      if (!d.ok) throw new Error(d.error)
      setShowAdd(false); setEditPos(null); setForm({ symbol:'', shares:'', avg_cost:'', notes:'' })
      await load()
    } catch (e) { setErr(e.message) }
    setSubmitting(false)
  }

  async function remove(symbol) {
    if (!confirm(`Remove ${symbol} from portfolio?`)) return
    await fetch(`/api/portfolio/${symbol}`, { method: 'DELETE' })
    await load()
  }

  function startEdit(pos) {
    setEditPos(pos)
    setForm({ symbol: pos.symbol, shares: String(pos.shares), avg_cost: String(pos.avg_cost), notes: pos.notes || '' })
    setShowAdd(true)
  }

  const positions = data?.positions || []
  const pieData   = positions.map((p, i) => ({ name: p.symbol, value: Math.round(p.value * 100) / 100, fill: COLORS[i % COLORS.length] }))
  const pnlData   = [...positions].sort((a, b) => b.pnlPct - a.pnlPct)

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, margin:0 }}>Portfolio Tracker</h1>
          <p style={{ color:'var(--muted)', fontSize:13, marginTop:4 }}>Track positions with live P&amp;L from real market data</p>
        </div>
        <button onClick={() => { setShowAdd(true); setEditPos(null); setForm({ symbol:'', shares:'', avg_cost:'', notes:'' }) }}
          style={{ padding:'8px 18px', background:'var(--accent)', color:'#fff', border:'none', borderRadius:6, cursor:'pointer', fontSize:13, fontWeight:600 }}>
          + Add Position
        </button>
      </div>

      {/* Add/Edit Modal */}
      {showAdd && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, padding:28, width:380, maxWidth:'90vw' }}>
            <h2 style={{ margin:'0 0 18px', fontSize:16, fontWeight:700 }}>{editPos ? `Edit ${editPos.symbol}` : 'Add Position'}</h2>
            <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {!editPos && (
                <Field label="Symbol">
                  <input value={form.symbol} onChange={e => setForm(f => ({ ...f, symbol: e.target.value.toUpperCase() }))}
                    placeholder="e.g. AAPL" required style={iStyle} />
                </Field>
              )}
              <div className="mobile-grid-1" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <Field label="Shares">
                  <input type="number" step="any" value={form.shares} onChange={e => setForm(f => ({ ...f, shares: e.target.value }))}
                    placeholder="100" required style={iStyle} />
                </Field>
                <Field label="Avg Cost ($)">
                  <input type="number" step="any" value={form.avg_cost} onChange={e => setForm(f => ({ ...f, avg_cost: e.target.value }))}
                    placeholder="150.00" required style={iStyle} />
                </Field>
              </div>
              <Field label="Notes (optional)">
                <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Long-term hold, earnings play…" style={iStyle} />
              </Field>
              {err && <div style={{ color:'var(--red)', fontSize:12 }}>{err}</div>}
              <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:4 }}>
                <button type="button" onClick={() => { setShowAdd(false); setEditPos(null) }}
                  style={{ padding:'8px 16px', background:'var(--bg3)', color:'var(--muted)', border:'1px solid var(--border)', borderRadius:6, cursor:'pointer', fontSize:13 }}>
                  Cancel
                </button>
                <button type="submit" disabled={submitting}
                  style={{ padding:'8px 18px', background:'var(--accent)', color:'#fff', border:'none', borderRadius:6, cursor:'pointer', fontSize:13, fontWeight:600, opacity:submitting?0.6:1 }}>
                  {submitting ? 'Saving…' : editPos ? 'Update' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign:'center', padding:60, color:'var(--muted)' }}>Loading portfolio…</div>
      ) : positions.length === 0 ? (
        <div style={{ textAlign:'center', padding:80, color:'var(--muted)' }}>
          <div style={{ fontSize:40, marginBottom:12 }}>◈</div>
          <div style={{ fontSize:16, fontWeight:600, marginBottom:8 }}>No positions yet</div>
          <div style={{ fontSize:13, marginBottom:20 }}>Add your first position to start tracking P&amp;L</div>
          <button onClick={() => setShowAdd(true)} style={{ padding:'10px 24px', background:'var(--accent)', color:'#fff', border:'none', borderRadius:6, cursor:'pointer', fontSize:14 }}>Add First Position</button>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:12, marginBottom:24 }}>
            <SummaryCard label="Total Value"  value={`$${fmt(data.totalValue)}`}  color="var(--accent)" />
            <SummaryCard label="Total Cost"   value={`$${fmt(data.totalCost)}`}   color="var(--muted)" />
            <SummaryCard label="Total P&L"    value={`${data.totalPnl >= 0 ? '+' : ''}$${fmt(data.totalPnl)}`}  color={data.totalPnl >= 0 ? 'var(--green)' : 'var(--red)'} />
            <SummaryCard label="Return"       value={`${data.totalPnlPct >= 0 ? '+' : ''}${data.totalPnlPct.toFixed(2)}%`}  color={data.totalPnlPct >= 0 ? 'var(--green)' : 'var(--red)'} />
            <SummaryCard label="Positions"    value={positions.length}             color="var(--text)" />
          </div>

          {/* Charts Row */}
          <div className="mobile-grid-1" style={{ display:'grid', gridTemplateColumns:'1fr 1.5fr', gap:16, marginBottom:24 }}>

            {/* Allocation Pie */}
            <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:16 }}>
              <div style={{ fontSize:12, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:0.5, marginBottom:12 }}>Allocation</div>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip formatter={v => [`$${fmt(v)}`, 'Value']} contentStyle={{ background:'var(--bg2)', border:'1px solid var(--border)', fontSize:12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* P&L Bar Chart */}
            <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:16 }}>
              <div style={{ fontSize:12, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:0.5, marginBottom:12 }}>P&amp;L by Position (%)</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={pnlData} margin={{ top:5, right:5, bottom:0, left:-10 }}>
                  <XAxis dataKey="symbol" tick={{ fontSize:10, fill:'#94a3b8' }} />
                  <YAxis tick={{ fontSize:10, fill:'#94a3b8' }} tickFormatter={v => `${v.toFixed(0)}%`} />
                  <Tooltip contentStyle={{ background:'var(--bg2)', border:'1px solid var(--border)', fontSize:12 }} formatter={v => [`${v.toFixed(2)}%`, 'Return']} />
                  <ReferenceLine y={0} stroke="#374151" />
                  <Bar dataKey="pnlPct" radius={[3,3,0,0]}>
                    {pnlData.map((p, i) => <Cell key={i} fill={p.pnlPct >= 0 ? '#22c55e' : '#ef4444'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Positions Table */}
          <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' }}>
            <div style={{ padding:'12px 20px', borderBottom:'1px solid var(--border)', fontSize:12, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:0.5 }}>Positions</div>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead>
                  <tr style={{ borderBottom:'1px solid var(--border)', color:'var(--muted)', fontSize:11, textTransform:'uppercase', letterSpacing:0.5 }}>
                    <th style={{ textAlign:'left', padding:'8px 20px' }}>Symbol</th>
                    <th style={{ textAlign:'right', padding:'8px 16px' }}>Shares</th>
                    <th style={{ textAlign:'right', padding:'8px 16px' }}>Avg Cost</th>
                    <th style={{ textAlign:'right', padding:'8px 16px' }}>Current</th>
                    <th style={{ textAlign:'right', padding:'8px 16px' }}>Today</th>
                    <th style={{ textAlign:'right', padding:'8px 16px' }}>Cost Basis</th>
                    <th style={{ textAlign:'right', padding:'8px 16px' }}>Mkt Value</th>
                    <th style={{ textAlign:'right', padding:'8px 16px' }}>P&amp;L</th>
                    <th style={{ textAlign:'right', padding:'8px 16px' }}>Return</th>
                    <th style={{ textAlign:'center', padding:'8px 16px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map(p => (
                    <tr key={p.symbol} style={{ borderBottom:'1px solid var(--border)', cursor:'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding:'12px 20px' }} onClick={() => navigate(`/asset/${p.symbol}`)}>
                        <div style={{ fontWeight:700 }}>{p.symbol}</div>
                        {p.notes && <div style={{ fontSize:10, color:'var(--muted)', marginTop:2 }}>{p.notes}</div>}
                      </td>
                      <td style={{ padding:'12px 16px', textAlign:'right', fontFamily:'monospace' }}>{p.shares}</td>
                      <td style={{ padding:'12px 16px', textAlign:'right', fontFamily:'monospace' }}>${p.avg_cost.toFixed(2)}</td>
                      <td style={{ padding:'12px 16px', textAlign:'right', fontFamily:'monospace', fontWeight:600 }}>${p.currentPrice.toFixed(2)}</td>
                      <td style={{ padding:'12px 16px', textAlign:'right' }}><ChangeChip value={p.changePercent} /></td>
                      <td style={{ padding:'12px 16px', textAlign:'right', color:'var(--muted)', fontFamily:'monospace' }}>${fmt(p.cost)}</td>
                      <td style={{ padding:'12px 16px', textAlign:'right', fontFamily:'monospace', fontWeight:600 }}>${fmt(p.value)}</td>
                      <td style={{ padding:'12px 16px', textAlign:'right', fontFamily:'monospace', color: p.pnl >= 0 ? 'var(--green)' : 'var(--red)', fontWeight:600 }}>
                        {p.pnl >= 0 ? '+' : ''}{fmt(p.pnl)}
                      </td>
                      <td style={{ padding:'12px 16px', textAlign:'right', color: p.pnlPct >= 0 ? 'var(--green)' : 'var(--red)', fontWeight:600 }}>
                        {p.pnlPct >= 0 ? '+' : ''}{p.pnlPct.toFixed(2)}%
                      </td>
                      <td style={{ padding:'12px 16px', textAlign:'center' }}>
                        <div style={{ display:'flex', gap:6, justifyContent:'center' }}>
                          <button onClick={() => startEdit(p)} style={{ padding:'3px 10px', background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:4, cursor:'pointer', fontSize:11 }}>Edit</button>
                          <button onClick={() => remove(p.symbol)} style={{ padding:'3px 10px', background:'#ef444420', border:'1px solid #ef444440', color:'var(--red)', borderRadius:4, cursor:'pointer', fontSize:11 }}>Remove</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function fmt(n) {
  if (!n && n !== 0) return '—'
  return Math.abs(n).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 })
}

function SummaryCard({ label, value, color }) {
  return (
    <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:'14px 18px' }}>
      <div style={{ fontSize:11, color:'var(--muted)', marginBottom:6, textTransform:'uppercase', letterSpacing:0.5 }}>{label}</div>
      <div style={{ fontSize:22, fontWeight:800, color }}>{value}</div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label style={{ display:'block', fontSize:11, color:'var(--muted)', marginBottom:5, fontWeight:600 }}>{label}</label>
      {children}
    </div>
  )
}

const iStyle = {
  width:'100%', background:'var(--bg3)', border:'1px solid var(--border)',
  color:'var(--text)', padding:'8px 12px', borderRadius:6, fontSize:13,
  boxSizing:'border-box',
}
