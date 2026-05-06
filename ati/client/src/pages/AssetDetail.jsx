import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ComposedChart, Line, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, CartesianGrid, AreaChart, Area,
} from 'recharts'
import { ScoreBadge, ProbabilityBar, ChangeChip, DataBadge } from '../components/ScoreBadge'

const RANGE_OPTIONS = [
  { label:'1M', days:30 },
  { label:'3M', days:90 },
  { label:'6M', days:180 },
  { label:'1Y', days:365 },
]

export default function AssetDetail() {
  const { symbol } = useParams()
  const navigate   = useNavigate()
  const sym        = symbol.toUpperCase()

  const [score,     setScore]     = useState(null)
  const [news,      setNews]      = useState([])
  const [filings,   setFilings]   = useState([])
  const [research,  setResearch]  = useState(null)
  const [backtest,  setBacktest]  = useState(null)
  const [history,   setHistory]   = useState([])
  const [loading,   setLoading]   = useState(true)
  const [tab,       setTab]       = useState('overview')
  const [refreshing,setRefreshing]= useState(false)
  const [range,     setRange]     = useState(90)
  const [inPortfolio, setInPortfolio] = useState(false)
  const [addingToPortfolio, setAddingToPortfolio] = useState(false)
  const [portfolioForm, setPortfolioForm] = useState({ shares:'', avg_cost:'' })

  useEffect(() => {
    setLoading(true)
    Promise.allSettled([
      fetch(`/api/scores/${sym}`).then(r => r.json()),
      fetch(`/api/news/${sym}?limit=20`).then(r => r.json()),
      fetch(`/api/filings/${sym}`).then(r => r.json()),
      fetch(`/api/portfolio`).then(r => r.json()),
    ]).then(([s, n, f, p]) => {
      if (s.status === 'fulfilled') setScore(s.value)
      if (n.status === 'fulfilled') setNews(n.value.items || [])
      if (f.status === 'fulfilled') setFilings(f.value.filings || [])
      if (p.status === 'fulfilled') {
        setInPortfolio((p.value.positions || []).some(pos => pos.symbol === sym))
      }
      setLoading(false)
    })
  }, [sym])

  useEffect(() => {
    fetch(`/api/scores/${sym}/history?days=${range}`)
      .then(r => r.json())
      .then(d => {
        if (d.history?.length) {
          setHistory(d.history.map(h => ({
            date:   h.date?.slice(5),
            close:  h.close ?? h.adjusted_close,
            volume: h.volume,
          })).filter(h => h.close))
        }
      })
      .catch(() => {})
  }, [sym, range])

  async function loadResearch() {
    const r = await fetch(`/api/research/${sym}`)
    setResearch(await r.json())
  }

  async function loadBacktest() {
    const r = await fetch(`/api/backtest/${sym}`, {
      method: 'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ lookback: range, horizon: 20 }),
    })
    setBacktest(await r.json())
  }

  async function triggerRefresh() {
    setRefreshing(true)
    await fetch(`/api/scores/${sym}/refresh`, { method:'POST' })
    setTimeout(async () => {
      const r = await fetch(`/api/scores/${sym}`)
      setScore(await r.json())
      setRefreshing(false)
    }, 4000)
  }

  async function addToPortfolio(e) {
    e.preventDefault()
    const r = await fetch('/api/portfolio', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ symbol: sym, shares: +portfolioForm.shares, avg_cost: +portfolioForm.avg_cost }),
    })
    const d = await r.json()
    if (d.ok) { setInPortfolio(true); setAddingToPortfolio(false) }
  }

  if (loading) return <div style={{ padding:60, textAlign:'center', color:'var(--muted)' }}>Loading {sym}…</div>

  const dq         = score?.dataQuality || tryParse(score?.data_quality_json, {})
  const bullish    = tryParse(score?.bullish_drivers_json, score?.bullishDrivers || [])
  const bearish    = tryParse(score?.bearish_risks_json,  score?.bearishRisks   || [])
  const components = score?.components || []
  const apexScore  = score?.apex_score ?? score?.apexScore
  const probability= score?.probability_outperform
  const price      = score?.quote?.price

  const chartMin   = history.length ? Math.min(...history.map(h => h.close)) * 0.97 : undefined
  const chartMax   = history.length ? Math.max(...history.map(h => h.close)) * 1.03 : undefined
  const startPrice = history[0]?.close
  const endPrice   = history[history.length - 1]?.close
  const periodChange = startPrice && endPrice ? ((endPrice - startPrice) / startPrice * 100) : null

  const TABS = ['overview', 'chart', 'news', 'filings', 'research', 'backtest']

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div>
          <button onClick={() => navigate(-1)} style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:13, marginBottom:8, padding:0 }}>← Back</button>
          <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
            <h1 style={{ fontSize:30, fontWeight:800, margin:0 }}>{sym}</h1>
            {score?.name && <span style={{ color:'var(--muted)', fontSize:15 }}>{score.name}</span>}
            {score?.rating_label && <ScoreBadge label={score.rating_label} score={apexScore} />}
            <DataBadge />
          </div>
          {score && <p style={{ color:'var(--muted)', fontSize:12, marginTop:6 }}>Scored {score.score_date || 'recently'} · Benchmark: {score.benchmark || 'SPY'} · {score.sector}</p>}
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {!inPortfolio ? (
            <button onClick={() => setAddingToPortfolio(v => !v)} style={{ padding:'8px 16px', background:'#22c55e20', color:'var(--green)', border:'1px solid #22c55e40', borderRadius:6, cursor:'pointer', fontSize:13 }}>
              + Portfolio
            </button>
          ) : (
            <span style={{ padding:'8px 14px', background:'#22c55e10', color:'var(--green)', border:'1px solid #22c55e30', borderRadius:6, fontSize:13 }}>✓ In Portfolio</span>
          )}
          <button onClick={triggerRefresh} disabled={refreshing} style={{ padding:'8px 16px', background:'var(--accent)', color:'#fff', border:'none', borderRadius:6, cursor:'pointer', fontSize:13, opacity:refreshing?0.6:1 }}>
            {refreshing ? '⟳ Refreshing…' : '↻ Refresh Score'}
          </button>
        </div>
      </div>

      {/* Quick Add to Portfolio */}
      {addingToPortfolio && (
        <form onSubmit={addToPortfolio} style={{ display:'flex', gap:10, alignItems:'flex-end', background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, padding:16, marginBottom:16, flexWrap:'wrap' }}>
          <div>
            <label style={{ display:'block', fontSize:11, color:'var(--muted)', marginBottom:4 }}>Shares</label>
            <input type="number" step="any" value={portfolioForm.shares} onChange={e => setPortfolioForm(f => ({...f, shares:e.target.value}))} placeholder="100" required style={{ width:100, background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--text)', padding:'7px 10px', borderRadius:6, fontSize:13 }} />
          </div>
          <div>
            <label style={{ display:'block', fontSize:11, color:'var(--muted)', marginBottom:4 }}>Avg Cost ($)</label>
            <input type="number" step="any" value={portfolioForm.avg_cost} onChange={e => setPortfolioForm(f => ({...f, avg_cost:e.target.value}))} placeholder={price ? price.toFixed(2) : '150.00'} required style={{ width:110, background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--text)', padding:'7px 10px', borderRadius:6, fontSize:13 }} />
          </div>
          <button type="submit" style={{ padding:'8px 16px', background:'var(--accent)', color:'#fff', border:'none', borderRadius:6, cursor:'pointer', fontSize:13 }}>Add</button>
          <button type="button" onClick={() => setAddingToPortfolio(false)} style={{ padding:'8px 12px', background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:6, cursor:'pointer', fontSize:13 }}>Cancel</button>
        </form>
      )}

      {/* Score Cards */}
      {score && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(155px, 1fr))', gap:12, marginBottom:24 }}>
          <ScoreCard label="ATI Score"    value={<span style={{ fontSize:36, fontWeight:800, color: apexScore >= 65 ? 'var(--green)' : apexScore >= 45 ? 'var(--text)' : 'var(--red)' }}>{apexScore}</span>} sub="/100" />
          <ScoreCard label="Prob. Outperform" value={<span style={{ fontSize:28, fontWeight:700, color: probability >= 60 ? 'var(--green)' : probability >= 50 ? 'var(--yellow)' : 'var(--red)' }}>{probability}%</span>} sub="20d horizon" />
          <ScoreCard label="Risk Score"   value={<span style={{ fontSize:28, fontWeight:700 }}>{score.risk_score ?? Math.max(0, 100 - apexScore)}</span>} sub="/100 lower=safer" />
          <ScoreCard label="Confidence"   value={<span style={{ fontSize:28, fontWeight:700, color: dq?.confidence >= 70 ? 'var(--green)' : dq?.confidence >= 50 ? 'var(--yellow)' : 'var(--red)' }}>{dq?.confidence ?? 50}%</span>} sub="data quality" />
          {price && <ScoreCard label="Last Price"  value={<span style={{ fontSize:26, fontWeight:700, fontFamily:'monospace' }}>${price.toFixed(2)}</span>} sub={<ChangeChip value={score.quote?.change_percent} />} />}
          {periodChange !== null && history.length > 0 && (
            <ScoreCard label={`${RANGE_OPTIONS.find(r=>r.days===range)?.label||''} Change`}
              value={<span style={{ fontSize:26, fontWeight:700, color: periodChange >= 0 ? 'var(--green)' : 'var(--red)' }}>{periodChange >= 0?'+':''}{periodChange.toFixed(2)}%</span>}
              sub={`${history.length} trading days`}
            />
          )}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:'flex', gap:2, borderBottom:'1px solid var(--border)', marginBottom:20, overflowX:'auto' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => { setTab(t); if (t==='research' && !research) loadResearch(); if (t==='backtest' && !backtest) loadBacktest() }} style={{
            padding:'9px 16px', background:'none', border:'none', cursor:'pointer', whiteSpace:'nowrap',
            color: tab === t ? 'var(--accent)' : 'var(--muted)',
            borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
            fontSize:13, fontWeight: tab === t ? 600 : 400, textTransform:'capitalize',
          }}>{t}</button>
        ))}
      </div>

      {/* Tab: Overview */}
      {tab === 'overview' && (
        <div className="mobile-grid-1" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
          <Card title="Score Components">
            {components.length === 0 ? <EmptyMsg text="Run a refresh to generate component scores" /> : components.map(c => (
              <div key={c.name} style={{ marginBottom:14 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:5 }}>
                  <span style={{ textTransform:'capitalize' }}>{c.name.replace(/_/g,' ')}</span>
                  <span style={{ fontWeight:700 }}>{Math.round(c.score)}<span style={{ color:'var(--muted)', fontWeight:400, fontSize:11 }}> / 100 · {c.weight}%</span></span>
                </div>
                <div style={{ height:8, background:'var(--bg3)', borderRadius:10, overflow:'hidden' }}>
                  <div style={{ width:`${c.score}%`, height:'100%', borderRadius:10, transition:'width 0.5s',
                    background: c.score >= 65 ? 'var(--green)' : c.score >= 45 ? 'var(--accent)' : 'var(--red)' }} />
                </div>
                {c.explanation && <div style={{ fontSize:11, color:'var(--muted)', marginTop:3 }}>{c.explanation}</div>}
              </div>
            ))}
          </Card>

          <Card title="Key Signals">
            {bullish.length > 0 && (
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:11, color:'var(--green)', fontWeight:700, marginBottom:8, textTransform:'uppercase', letterSpacing:0.5 }}>Bullish Drivers</div>
                {bullish.map((b, i) => <div key={i} style={{ display:'flex', gap:8, fontSize:13, padding:'5px 0', borderBottom:'1px solid var(--border)' }}><span style={{ color:'var(--green)', flexShrink:0 }}>▲</span>{b}</div>)}
              </div>
            )}
            {bearish.length > 0 && (
              <div>
                <div style={{ fontSize:11, color:'var(--red)', fontWeight:700, marginBottom:8, textTransform:'uppercase', letterSpacing:0.5 }}>Risk Factors</div>
                {bearish.map((b, i) => <div key={i} style={{ display:'flex', gap:8, fontSize:13, padding:'5px 0', borderBottom:'1px solid var(--border)' }}><span style={{ color:'var(--red)', flexShrink:0 }}>▽</span>{b}</div>)}
              </div>
            )}
            {!bullish.length && !bearish.length && <EmptyMsg text="Run a refresh to generate signals" />}
          </Card>

          {/* Probability bar */}
          {probability != null && (
            <Card title="Probability of Outperformance">
              <div style={{ marginBottom:8 }}>
                <ProbabilityBar value={probability} />
              </div>
              <div style={{ fontSize:12, color:'var(--muted)', marginTop:10 }}>
                Probability that {sym} will outperform {score?.benchmark || 'SPY'} over the next 20 trading days, based on current score and historical signal accuracy.
              </div>
            </Card>
          )}

          {dq && (
            <Card title="Data Sources">
              <div style={{ fontSize:13, color:'var(--muted)', marginBottom:8 }}>
                Sources: <span style={{ color:'var(--text)' }}>{(dq.sources || []).join(', ') || 'None'}</span>
              </div>
              {dq.dataNote && <div style={{ padding:'8px 12px', background:'#fbbf2410', border:'1px solid #fbbf2430', borderRadius:6, fontSize:12, color:'var(--yellow)', marginTop:8 }}>{dq.dataNote}</div>}
              <div style={{ marginTop:10, fontSize:11, color:'var(--muted)' }}>
                Research intelligence, not investment advice. Probability is a statistical estimate.
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Tab: Chart */}
      {tab === 'chart' && (
        <div>
          <div style={{ display:'flex', gap:8, marginBottom:16, alignItems:'center' }}>
            <span style={{ fontSize:12, color:'var(--muted)' }}>Range:</span>
            {RANGE_OPTIONS.map(r => (
              <button key={r.days} onClick={() => setRange(r.days)} style={{
                padding:'4px 12px', borderRadius:20, fontSize:12, cursor:'pointer',
                background: range === r.days ? 'var(--accent)' : 'var(--bg3)',
                color: range === r.days ? '#fff' : 'var(--muted)',
                border: `1px solid ${range === r.days ? 'var(--accent)' : 'var(--border)'}`,
              }}>{r.label}</button>
            ))}
            {periodChange !== null && (
              <span style={{ marginLeft:'auto', fontSize:14, fontWeight:700, color: periodChange >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {periodChange >= 0 ? '+' : ''}{periodChange.toFixed(2)}%
              </span>
            )}
          </div>

          {history.length === 0 ? (
            <div style={{ textAlign:'center', padding:60, color:'var(--muted)' }}>
              No price history available — trigger a score refresh to fetch price data.
            </div>
          ) : (
            <>
              {/* Price Area Chart */}
              <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:16, marginBottom:16 }}>
                <div style={{ fontSize:12, color:'var(--muted)', marginBottom:12 }}>Price ({RANGE_OPTIONS.find(r=>r.days===range)?.label})</div>
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={history} margin={{ top:5, right:5, bottom:0, left:0 }}>
                    <defs>
                      <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={periodChange >= 0 ? '#22c55e' : '#ef4444'} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={periodChange >= 0 ? '#22c55e' : '#ef4444'} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize:10, fill:'#94a3b8' }} interval={Math.floor(history.length / 6)} />
                    <YAxis domain={[chartMin, chartMax]} tick={{ fontSize:10, fill:'#94a3b8' }} tickFormatter={v => `$${v.toFixed(0)}`} width={55} />
                    <Tooltip
                      contentStyle={{ background:'#1f2937', border:'1px solid #374151', fontSize:12 }}
                      formatter={v => [`$${v.toFixed(2)}`, 'Price']}
                    />
                    {startPrice && <ReferenceLine y={startPrice} stroke="#374151" strokeDasharray="4 4" label={{ value:'Entry', fill:'#6b7280', fontSize:10 }} />}
                    <Area type="monotone" dataKey="close" stroke={periodChange >= 0 ? '#22c55e' : '#ef4444'} strokeWidth={2} fill="url(#priceGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Volume Bar Chart */}
              {history.some(h => h.volume) && (
                <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:16 }}>
                  <div style={{ fontSize:12, color:'var(--muted)', marginBottom:12 }}>Volume</div>
                  <ResponsiveContainer width="100%" height={100}>
                    <BarChart data={history} margin={{ top:0, right:5, bottom:0, left:0 }}>
                      <XAxis dataKey="date" tick={{ fontSize:9, fill:'#94a3b8' }} interval={Math.floor(history.length / 6)} />
                      <YAxis tick={{ fontSize:9, fill:'#94a3b8' }} tickFormatter={v => v >= 1e6 ? `${(v/1e6).toFixed(0)}M` : v >= 1e3 ? `${(v/1e3).toFixed(0)}K` : v} width={40} />
                      <Tooltip contentStyle={{ background:'#1f2937', border:'1px solid #374151', fontSize:11 }} formatter={v => [v?.toLocaleString(), 'Volume']} />
                      <Bar dataKey="volume" fill="#3b82f640" radius={[2,2,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Tab: News */}
      {tab === 'news' && (
        <div>
          {news.length === 0 ? <EmptyMsg text="No news stored — trigger a refresh" /> : news.map((n, i) => (
            <div key={i} style={{ padding:'14px 0', borderBottom:'1px solid var(--border)', display:'flex', gap:12, alignItems:'flex-start' }}>
              <SentimentDot s={n.sentiment} />
              <div style={{ flex:1 }}>
                <a href={n.url} target="_blank" rel="noreferrer" style={{ color:'var(--text)', textDecoration:'none', fontSize:14, fontWeight:500, lineHeight:1.5, display:'block', marginBottom:4 }}>{n.headline}</a>
                {n.summary && <p style={{ color:'var(--muted)', fontSize:12, margin:'0 0 6px' }}>{n.summary.slice(0, 200)}{n.summary.length > 200 ? '…' : ''}</p>}
                <div style={{ display:'flex', gap:10, fontSize:11, color:'var(--muted)' }}>
                  <span>{n.source}</span><span>·</span>
                  <span>{n.published_at ? new Date(n.published_at).toLocaleDateString() : ''}</span>
                  {n.event_type !== 'general_news' && <span style={{ color:'var(--accent)' }}>{n.event_type?.replace(/_/g,' ')}</span>}
                  <span style={{ marginLeft:'auto', color: n.sentiment === 'bullish' ? 'var(--green)' : n.sentiment === 'bearish' ? 'var(--red)' : 'var(--muted)' }}>{n.sentiment}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Filings */}
      {tab === 'filings' && (
        <div>
          {filings.length === 0 ? <EmptyMsg text="No SEC filings found — run a refresh to fetch" /> : filings.map((f, i) => (
            <div key={i} style={{ padding:'12px 0', borderBottom:'1px solid var(--border)', display:'flex', gap:14, alignItems:'flex-start' }}>
              <span style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:4, padding:'2px 8px', fontSize:11, fontWeight:700, whiteSpace:'nowrap', flexShrink:0 }}>{f.form_type}</span>
              <div>
                <a href={f.url} target="_blank" rel="noreferrer" style={{ color:'var(--text)', textDecoration:'none', fontSize:13, fontWeight:500 }}>{f.title || f.event_type?.replace(/_/g,' ') || f.form_type}</a>
                <div style={{ color:'var(--muted)', fontSize:11, marginTop:3 }}>{f.filing_date} · SEC EDGAR</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Research */}
      {tab === 'research' && (
        <div style={{ maxWidth:760 }}>
          {!research ? (
            <div style={{ textAlign:'center', padding:40, color:'var(--muted)' }}>Generating AI research…</div>
          ) : research.error ? (
            <div style={{ padding:20, background:'#ef444410', border:'1px solid #ef444430', borderRadius:8, color:'var(--red)', fontSize:13 }}>{research.text}</div>
          ) : (
            <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, padding:24 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
                <div style={{ fontSize:12, color:'var(--accent)', fontWeight:600 }}>AI Research Summary</div>
                <div style={{ fontSize:11, color:'var(--muted)' }}>{research.generated_at ? new Date(research.generated_at).toLocaleDateString() : ''}</div>
              </div>
              <div style={{ fontSize:14, lineHeight:1.75, color:'var(--text)', whiteSpace:'pre-line' }}>{research.text}</div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Backtest */}
      {tab === 'backtest' && (
        <div>
          {!backtest ? (
            <div style={{ textAlign:'center', padding:40, color:'var(--muted)' }}>Running simulated backtest…</div>
          ) : backtest.error ? (
            <div style={{ padding:16, background:'#ef444410', border:'1px solid #ef444430', borderRadius:8, color:'var(--red)', fontSize:13 }}>{backtest.error}</div>
          ) : (
            <div>
              {backtest.stats && (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:12, marginBottom:20 }}>
                  {[
                    { label:'Win Rate',         val:`${backtest.stats.win_rate}%`,         color: backtest.stats.win_rate >= 55 ? 'var(--green)' : 'var(--yellow)' },
                    { label:'Avg Excess Ret.',  val:`${backtest.stats.avg_excess_return}%`, color: backtest.stats.avg_excess_return >= 0 ? 'var(--green)' : 'var(--red)' },
                    { label:'Avg Asset Ret.',   val:`${backtest.stats.avg_asset_return}%`,  color: backtest.stats.avg_asset_return >= 0 ? 'var(--green)' : 'var(--red)' },
                    { label:'Signals',          val:backtest.stats.total_signals,           color:'var(--text)' },
                    { label:'Best Trade',       val:`+${backtest.stats.best_trade}%`,       color:'var(--green)' },
                    { label:'Worst Trade',      val:`${backtest.stats.worst_trade}%`,       color:'var(--red)' },
                  ].map(c => (
                    <div key={c.label} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, padding:'12px 16px' }}>
                      <div style={{ fontSize:11, color:'var(--muted)', marginBottom:6 }}>{c.label}</div>
                      <div style={{ fontSize:24, fontWeight:700, color:c.color }}>{c.val}</div>
                    </div>
                  ))}
                </div>
              )}
              {backtest.trades?.length > 0 && (
                <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, padding:16, marginBottom:16 }}>
                  <div style={{ fontSize:12, color:'var(--muted)', marginBottom:12 }}>Excess Return vs Benchmark per Signal</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <ComposedChart data={backtest.trades}>
                      <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                      <XAxis dataKey="entry_date" tick={{ fontSize:9, fill:'#94a3b8' }} />
                      <YAxis tick={{ fontSize:10, fill:'#94a3b8' }} />
                      <Tooltip contentStyle={{ background:'#1f2937', border:'1px solid #374151', fontSize:12 }} />
                      <ReferenceLine y={0} stroke="#374151" />
                      <Bar dataKey="excess_return" fill="#3b82f6" radius={[2,2,0,0]} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div style={{ padding:12, background:'#fbbf2410', border:'1px solid #fbbf2430', borderRadius:6, fontSize:12, color:'var(--yellow)' }}>
                Simulated backtest. Past performance does not predict future returns. Not investment advice.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ScoreCard({ label, value, sub }) {
  return (
    <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, padding:'14px 16px' }}>
      <div style={{ fontSize:11, color:'var(--muted)', marginBottom:8, textTransform:'uppercase', letterSpacing:0.5 }}>{label}</div>
      <div>{value}</div>
      {sub && <div style={{ fontSize:11, color:'var(--muted)', marginTop:4 }}>{sub}</div>}
    </div>
  )
}

function Card({ title, children }) {
  return (
    <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, padding:18 }}>
      <div style={{ fontSize:11, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:0.5, marginBottom:14 }}>{title}</div>
      {children}
    </div>
  )
}

function EmptyMsg({ text = 'No data' }) {
  return <div style={{ color:'var(--muted)', fontSize:13, padding:'12px 0' }}>{text}</div>
}

function SentimentDot({ s }) {
  const c = s === 'bullish' || s === 'slightly_bullish' ? 'var(--green)' : s === 'bearish' || s === 'slightly_bearish' ? 'var(--red)' : 'var(--muted)'
  return <div style={{ width:9, height:9, borderRadius:'50%', background:c, marginTop:5, flexShrink:0 }} />
}

function tryParse(str, fallback) {
  if (Array.isArray(str)) return str
  try { return JSON.parse(str) } catch { return fallback }
}
