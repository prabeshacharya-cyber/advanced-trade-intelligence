import { useState, useEffect, useRef, useCallback } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { loadJSON, saveJSON } from '../lib/storage.js'

const REFRESH_OPTIONS = [
  { label: '15s', value: 15 },
  { label: '30s', value: 30 },
  { label: '60s', value: 60 },
  { label: '2m',  value: 120 },
]
const STORAGE_KEY_INTERVAL = 'ati_scanner_refresh_interval'
const VALID_INTERVALS = new Set(REFRESH_OPTIONS.map(o => o.value))
function loadInterval() {
  const v = loadJSON(STORAGE_KEY_INTERVAL, 60)
  return VALID_INTERVALS.has(v) ? v : 60
}

function isMarketHours() {
  const now = new Date()
  // Convert to US/Eastern
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const day = et.getDay() // 0=Sun, 6=Sat
  if (day === 0 || day === 6) return false
  const h = et.getHours()
  const m = et.getMinutes()
  const mins = h * 60 + m
  return mins >= 9 * 60 + 30 && mins < 16 * 60
}

const card  = { background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, padding:'16px 18px', marginBottom:16 }
const inp   = { background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--text)', padding:'6px 10px', borderRadius:8, fontSize:13, outline:'none' }
const btn   = (variant='default') => ({
  padding:'7px 14px', borderRadius:8, fontSize:13, cursor:'pointer', fontWeight:600,
  border: variant==='green' ? '1px solid var(--green)' : variant==='red' ? '1px solid var(--red)' : '1px solid var(--border)',
  color:  variant==='green' ? 'var(--green)'            : variant==='red' ? 'var(--red)'            : 'var(--text)',
  background: 'transparent',
})

const ACTION_COLOR = { BUY:'var(--green)', WATCH:'#f59e0b', IGNORE:'var(--muted)', ERROR:'var(--red)', 'NO DATA':'var(--muted)' }
const fmtPct  = v => `${v >= 0 ? '+' : ''}${Number(v).toFixed(2)}%`
const fmtUSD  = v => `$${Number(v).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 })}`
const fmtNum  = v => Number(v).toLocaleString('en-US', { maximumFractionDigits:2 })

const DEFAULT_SYMBOLS = 'AAPL,TSLA,NVDA,AMD,META,MSFT,PLTR,COIN,MARA,SOFI'

function Badge({ val, label, color }) {
  return (
    <span style={{ fontSize:11, padding:'2px 7px', borderRadius:5, border:`1px solid ${color || 'var(--border)'}`, color: color || 'var(--muted)', marginRight:4 }}>
      {label ?? (val ? '✓' : '✗')}
    </span>
  )
}

function SignalRow({ sig, onExecute, executing }) {
  const ac = ACTION_COLOR[sig.action] || 'var(--muted)'
  const [showExec, setShowExec] = useState(false)

  return (
    <tr style={{ borderTop:'1px solid rgba(255,255,255,0.04)' }}>
      <td style={{ padding:'10px 12px 10px 0', fontWeight:700 }}>{sig.symbol}</td>
      <td style={{ padding:'10px 12px 10px 0', color: (sig.gapPct||0)>=0?'var(--green)':'var(--red)' }}>
        {sig.gapPct != null ? fmtPct(sig.gapPct) : '—'}
      </td>
      <td style={{ padding:'10px 12px 10px 0', color:'var(--text)' }}>
        {sig.rvol != null ? `${fmtNum(sig.rvol)}x` : '—'}
      </td>
      <td style={{ padding:'10px 12px 10px 0', color:'var(--muted)', fontSize:12 }}>
        {sig.vwap ? fmtUSD(sig.vwap) : '—'}
      </td>
      <td style={{ padding:'10px 8px' }}>
        <Badge val={sig.isAboveVwap} color={sig.isAboveVwap ? 'var(--green)' : 'var(--red)'} label={sig.isAboveVwap ? '▲ VWAP' : '▼ VWAP'} />
      </td>
      <td style={{ padding:'10px 8px' }}>
        <Badge val={sig.emaBull} color={sig.emaBull ? 'var(--green)' : 'var(--red)'} label={sig.emaBull ? 'EMA ↑' : 'EMA ↓'} />
      </td>
      <td style={{ padding:'10px 8px' }}>
        <Badge val={sig.bullFlag} color={sig.bullFlag ? '#f59e0b' : 'var(--muted)'} label={sig.bullFlag ? '🚩 Flag' : 'No Flag'} />
      </td>
      <td style={{ padding:'10px 8px' }}>
        <span style={{ fontWeight:700, color:ac, fontSize:13 }}>{sig.action}</span>
      </td>
      <td style={{ padding:'10px 0 10px 8px' }}>
        {sig.action === 'BUY' || sig.action === 'WATCH' ? (
          showExec ? (
            <div style={{ display:'flex', gap:6 }}>
              <button
                disabled={executing === sig.symbol}
                onClick={() => { onExecute(sig); setShowExec(false) }}
                style={{ ...btn('green'), fontSize:11, padding:'4px 10px' }}>
                {executing === sig.symbol ? '…' : '✓ Confirm'}
              </button>
              <button onClick={() => setShowExec(false)} style={{ ...btn(), fontSize:11, padding:'4px 8px' }}>✗</button>
            </div>
          ) : (
            <button onClick={() => setShowExec(true)} style={{ ...btn('green'), fontSize:11, padding:'4px 10px' }}>
              Execute
            </button>
          )
        ) : null}
        {sig.error && <span style={{ color:'var(--red)', fontSize:11 }}>{sig.error.slice(0,40)}</span>}
      </td>
    </tr>
  )
}

export default function MomentumPage() {
  const [mode, setMode]         = useState('paper')
  const [account, setAccount]   = useState(null)
  const [positions, setPositions] = useState([])
  const [openOrders, setOpenOrders] = useState([])
  const [signals, setSignals]   = useState([])
  const [history, setHistory]   = useState([])
  const [closedTrades, setClosedTrades]     = useState([])
  const [tradeAnalytics, setTradeAnalytics] = useState(null)
  const [equityCurve, setEquityCurve]       = useState([])
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analyticsRange, setAnalyticsRange] = useState('day')
  const [symbols, setSymbols]   = useState(DEFAULT_SYMBOLS)
  const [scanning, setScanning] = useState(false)
  const [executing, setExecuting] = useState(null)
  const [acctLoading, setAcctLoading] = useState(false)
  const [error, setError]       = useState(null)
  const [lastScan, setLastScan] = useState(null)
  const [tab, setTab]           = useState('scanner')
  const [autoRefresh, setAutoRefresh]       = useState(true)
  const [refreshInterval, setRefreshInterval] = useState(loadInterval)
  const [countdown, setCountdown]           = useState(loadInterval)
  const [marketOpen, setMarketOpen]         = useState(isMarketHours())
  const refreshIntervalRef = useRef(loadInterval())
  const countdownRef = useRef(null)
  const runScanRef   = useRef(null)
  const scanningRef  = useRef(false)

  const loadAccount = useCallback(async () => {
    setAcctLoading(true)
    try {
      const r = await fetch('/api/momentum/account')
      const d = await r.json()
      if (d.error) throw new Error(d.error)
      setMode(d.mode)
      setAccount(d.account)
      setPositions(d.positions || [])
      setOpenOrders(d.openOrders || [])
    } catch (e) { setError(e.message) }
    finally { setAcctLoading(false) }
  }, [])

  const loadHistory = useCallback(async () => {
    try {
      const r = await fetch('/api/momentum/history')
      const d = await r.json()
      setHistory(d.orders || [])
    } catch {}
  }, [])

  const loadClosedOrders = useCallback(async (range = 'day') => {
    setAnalyticsLoading(true)
    try {
      const r = await fetch(`/api/momentum/closed-orders?range=${range}`)
      const d = await r.json()
      if (d.error) throw new Error(d.error)
      setClosedTrades(d.trades || [])
      setTradeAnalytics(d.analytics || null)
      setEquityCurve(d.equityCurve || [])
    } catch (e) { setError(e.message) }
    finally { setAnalyticsLoading(false) }
  }, [])

  useEffect(() => { loadAccount(); loadHistory() }, [loadAccount, loadHistory])

  // Auto-load analytics whenever the History tab is opened
  useEffect(() => {
    if (tab === 'history') {
      loadClosedOrders(analyticsRange)
    }
  }, [tab]) // eslint-disable-line react-hooks/exhaustive-deps

  const switchMode = async (m) => {
    await fetch('/api/momentum/mode', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ mode:m }) })
    setMode(m)
    loadAccount()
  }

  const runScan = async () => {
    setScanning(true); scanningRef.current = true
    setError(null)
    try {
      const r = await fetch(`/api/momentum/scan?symbols=${encodeURIComponent(symbols)}`)
      const d = await r.json()
      if (d.error) throw new Error(d.error)
      setSignals(d.signals || [])
      setLastScan(d.scannedAt)
    } catch (e) { setError(e.message) }
    finally { setScanning(false); scanningRef.current = false }
  }

  // Keep runScanRef current so the countdown interval always calls the latest version
  useEffect(() => { runScanRef.current = runScan }, [runScan])

  // Keep refreshIntervalRef in sync so the interval callback always reads the latest value
  useEffect(() => { refreshIntervalRef.current = refreshInterval }, [refreshInterval])

  // Countdown timer — only ticks during market hours when autoRefresh is on
  useEffect(() => {
    clearInterval(countdownRef.current)
    if (!autoRefresh) return

    setMarketOpen(isMarketHours())
    setCountdown(refreshIntervalRef.current)

    countdownRef.current = setInterval(() => {
      const open = isMarketHours()
      setMarketOpen(open)
      if (!open) { setCountdown(refreshIntervalRef.current); return }
      setCountdown(prev => {
        if (prev <= 1) {
          if (!scanningRef.current) runScanRef.current?.()
          return refreshIntervalRef.current
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(countdownRef.current)
  }, [autoRefresh, refreshInterval])

  const executeOrder = async (sig) => {
    setExecuting(sig.symbol)
    setError(null)
    try {
      const r = await fetch('/api/momentum/execute', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ symbol: sig.symbol, entryPrice: sig.price }),
      })
      const d = await r.json()
      if (d.error) throw new Error(d.error)
      await loadAccount()
      await loadHistory()
    } catch (e) { setError(e.message) }
    finally { setExecuting(null) }
  }

  const cancelOrderFn = async (id) => {
    await fetch(`/api/momentum/orders/${id}`, { method:'DELETE' })
    loadAccount()
    loadHistory()
  }

  const closePositionFn = async (symbol) => {
    await fetch(`/api/momentum/positions/${symbol}`, { method:'DELETE' })
    loadAccount()
  }

  const buyCount   = signals.filter(s => s.action === 'BUY').length
  const watchCount = signals.filter(s => s.action === 'WATCH').length

  const [dailyLossHalted, setDailyLossHalted] = useState(false)

  // ── Auto-bot state ──────────────────────────────────────────────────────────
  const [botCfg, setBotCfg]       = useState(null)
  const [botLog, setBotLog]       = useState([])
  const [botSaving, setBotSaving] = useState(false)
  const [botRunning, setBotRunning] = useState(false)
  const [botMsg, setBotMsg]       = useState(null)

  const loadBot = useCallback(async () => {
    try {
      const [cfgR, logR] = await Promise.all([
        fetch('/api/momentum/auto-trade').then(r => r.json()),
        fetch('/api/momentum/auto-log').then(r => r.json()),
      ])
      setBotCfg(cfgR)
      setBotLog(logR.log || [])
      // Detect if daily loss limit has halted the bot today (compare in ET to match server)
      const todayET = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
      }).format(new Date())
      setDailyLossHalted(cfgR.dailyLossHaltedDate === todayET)
    } catch {}
  }, [])

  useEffect(() => { if (tab === 'bot') loadBot() }, [tab, loadBot])

  const saveBot = async () => {
    setBotSaving(true); setBotMsg(null)
    try {
      const r = await fetch('/api/momentum/auto-trade', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify(botCfg),
      })
      const d = await r.json()
      if (d.ok) {
        setBotCfg(d.config)
        setBotMsg({ ok:true, text:'Settings saved.' })
        // Recompute halt status from freshly saved config (dailyLossHaltedDate may have changed)
        const todayET = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
        }).format(new Date())
        setDailyLossHalted(d.config.dailyLossHaltedDate === todayET)
      } else setBotMsg({ ok:false, text: d.error || 'Save failed.' })
    } catch (e) { setBotMsg({ ok:false, text: e.message }) }
    setBotSaving(false)
  }

  const runBotNow = async () => {
    setBotRunning(true); setBotMsg(null)
    try {
      const r = await fetch('/api/momentum/auto-run', { method:'POST' })
      const d = await r.json()
      if (d.skipped) setBotMsg({ ok:false, text: `Skipped: ${d.reason}` })
      else setBotMsg({ ok:true, text:`Scan complete — ${d.executed?.length || 0} order(s) placed, ${d.signals} BUY signal(s).` })
      loadBot()
    } catch (e) { setBotMsg({ ok:false, text: e.message }) }
    setBotRunning(false)
  }

  const tabStyle = (t) => ({
    padding:'6px 16px', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', border:'1px solid',
    borderColor: tab===t ? 'var(--green)' : 'var(--border)',
    color:       tab===t ? 'var(--green)' : 'var(--muted)',
    background:  'transparent',
  })

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16, flexWrap:'wrap', gap:10 }}>
        <div>
          <h2 style={{ fontSize:20, fontWeight:700, marginBottom:2 }}>Day Trading Automation</h2>
          <p style={{ fontSize:13, color:'var(--muted)' }}>Momentum strategy · Gap% · RVOL · VWAP · EMA 9/20 · Bull Flag</p>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <span style={{ fontSize:12, color:'var(--muted)' }}>Mode:</span>
          <button onClick={() => switchMode('paper')} style={{ ...btn(mode==='paper'?'green':'default'), fontSize:12 }}>Paper</button>
          <button onClick={() => switchMode('live')}  style={{ ...btn(mode==='live'?'red':'default'),  fontSize:12 }}>Live</button>
          {mode === 'live' && (
            <span style={{ fontSize:11, color:'var(--red)', fontWeight:700, border:'1px solid var(--red)', borderRadius:5, padding:'2px 6px' }}>
              ⚠ LIVE MONEY
            </span>
          )}
        </div>
      </div>

      {error && (
        <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid var(--red)', borderRadius:8, padding:'10px 14px', marginBottom:14, fontSize:13, color:'var(--red)' }}>
          {error}
        </div>
      )}

      {/* Account Summary */}
      {account && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:16 }} className="mobile-grid-2">
          {[
            { label:'Equity',       val: fmtUSD(account.equity) },
            { label:'Buying Power', val: fmtUSD(account.buyingPower) },
            { label:'Open Positions', val: positions.length },
            { label:'Day Trades',   val: account.daytradeCount },
          ].map(({ label, val }) => (
            <div key={label} style={{ ...card, marginBottom:0, textAlign:'center' }}>
              <div style={{ fontSize:11, color:'var(--muted)', marginBottom:4 }}>{label}</div>
              <div style={{ fontSize:16, fontWeight:700 }}>{val}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
        <button style={tabStyle('scanner')} onClick={() => setTab('scanner')}>Scanner</button>
        <button style={tabStyle('positions')} onClick={() => setTab('positions')}>
          Positions {positions.length > 0 && `(${positions.length})`}
        </button>
        <button style={tabStyle('orders')} onClick={() => setTab('orders')}>
          Orders {openOrders.length > 0 && `(${openOrders.length})`}
        </button>
        <button style={tabStyle('history')} onClick={() => setTab('history')}>History</button>
        <button
          style={{ ...tabStyle('bot'), borderColor: tab==='bot' ? '#818cf8' : 'var(--border)', color: tab==='bot' ? '#818cf8' : 'var(--muted)' }}
          onClick={() => setTab('bot')}
        >
          ⚡ Auto-Bot
        </button>
      </div>

      {/* Scanner Tab */}
      {tab === 'scanner' && (
        <div style={card}>
          <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
            <input
              value={symbols}
              onChange={e => setSymbols(e.target.value)}
              placeholder="AAPL,TSLA,NVDA,..."
              style={{ ...inp, flex:1, minWidth:200 }}
            />
            <button onClick={runScan} disabled={scanning} style={{ ...btn('green'), minWidth:100 }}>
              {scanning ? 'Scanning…' : '▶ Run Scan'}
            </button>
            <button onClick={loadAccount} disabled={acctLoading} style={btn()}>
              {acctLoading ? '…' : '⟳ Refresh'}
            </button>
            <button
              onClick={() => { setAutoRefresh(p => !p); setCountdown(refreshInterval) }}
              style={{ ...btn(autoRefresh ? 'green' : 'default'), fontSize:12, minWidth:90 }}
              title={autoRefresh ? 'Pause auto-refresh' : 'Resume auto-refresh'}
            >
              {autoRefresh ? '⏸ Pause' : '▶ Auto'}
            </button>
            <select
              value={refreshInterval}
              onChange={e => {
                const v = Number(e.target.value)
                setRefreshInterval(v)
                saveJSON(STORAGE_KEY_INTERVAL, v)
                setCountdown(v)
              }}
              style={{ ...inp, fontSize:12, padding:'6px 8px', cursor:'pointer' }}
              title="Auto-refresh interval"
            >
              {REFRESH_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Auto-refresh status bar */}
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10, flexWrap:'wrap' }}>
            {autoRefresh ? (
              marketOpen ? (
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ width:8, height:8, borderRadius:'50%', background:'var(--green)', display:'inline-block', boxShadow:'0 0 6px var(--green)' }} />
                  <span style={{ fontSize:11, color:'var(--muted)' }}>
                    Market open · Auto-refresh in <span style={{ color:'var(--green)', fontWeight:700 }}>{countdown}s</span>
                  </span>
                </div>
              ) : (
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ width:8, height:8, borderRadius:'50%', background:'var(--muted)', display:'inline-block' }} />
                  <span style={{ fontSize:11, color:'var(--muted)' }}>Market closed · Auto-refresh paused until 9:30 AM ET</span>
                </div>
              )
            ) : (
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ width:8, height:8, borderRadius:'50%', background:'#f59e0b', display:'inline-block' }} />
                <span style={{ fontSize:11, color:'var(--muted)' }}>Auto-refresh paused</span>
              </div>
            )}
            {lastScan && (
              <span style={{ fontSize:11, color:'var(--muted)' }}>
                Last scan: {new Date(lastScan).toLocaleTimeString()} ·
                <span style={{ color:'var(--green)', marginLeft:6 }}>{buyCount} BUY</span>
                <span style={{ color:'#f59e0b', marginLeft:6 }}>{watchCount} WATCH</span>
              </span>
            )}
          </div>

          {signals.length === 0 && !scanning && (
            <p style={{ color:'var(--muted)', fontSize:13 }}>Enter symbols above and click Run Scan to analyze momentum signals.</p>
          )}

          {signals.length > 0 && (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', fontSize:12, borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ textAlign:'left', color:'var(--muted)', borderBottom:'1px solid var(--border)' }}>
                    {['Symbol','Gap %','RVOL','VWAP','vs VWAP','EMA','Bull Flag','Signal','Action'].map(h => (
                      <th key={h} style={{ paddingBottom:8, paddingRight:8, whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {signals.map(sig => (
                    <SignalRow key={sig.symbol} sig={sig} onExecute={executeOrder} executing={executing} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Positions Tab */}
      {tab === 'positions' && (
        <div style={card}>
          <h3 style={{ fontWeight:700, marginBottom:12 }}>Open Positions</h3>
          {positions.length === 0
            ? <p style={{ color:'var(--muted)', fontSize:13 }}>No open positions.</p>
            : (
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', fontSize:13, borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ textAlign:'left', color:'var(--muted)', borderBottom:'1px solid var(--border)' }}>
                      {['Symbol','Qty','Avg Entry','Current','Unreal P&L','Mkt Value',''].map(h => (
                        <th key={h} style={{ paddingBottom:8, paddingRight:10 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {positions.map(p => (
                      <tr key={p.symbol} style={{ borderTop:'1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding:'8px 10px 8px 0', fontWeight:700 }}>{p.symbol}</td>
                        <td style={{ padding:'8px 10px 8px 0' }}>{p.qty}</td>
                        <td style={{ padding:'8px 10px 8px 0', color:'var(--muted)' }}>{fmtUSD(p.avgEntry)}</td>
                        <td style={{ padding:'8px 10px 8px 0' }}>{fmtUSD(p.currentPx)}</td>
                        <td style={{ padding:'8px 10px 8px 0', color: p.unrealPnl >= 0 ? 'var(--green)' : 'var(--red)', fontWeight:600 }}>
                          {fmtUSD(p.unrealPnl)} ({p.unrealPnlPct.toFixed(2)}%)
                        </td>
                        <td style={{ padding:'8px 10px 8px 0', color:'var(--muted)' }}>{fmtUSD(p.marketVal)}</td>
                        <td style={{ padding:'8px 0' }}>
                          <button onClick={() => closePositionFn(p.symbol)} style={{ ...btn('red'), fontSize:11, padding:'3px 8px' }}>
                            Close
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }
        </div>
      )}

      {/* Orders Tab */}
      {tab === 'orders' && (
        <div style={card}>
          <h3 style={{ fontWeight:700, marginBottom:12 }}>Open Orders</h3>
          {openOrders.length === 0
            ? <p style={{ color:'var(--muted)', fontSize:13 }}>No open orders.</p>
            : (
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', fontSize:13, borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ textAlign:'left', color:'var(--muted)', borderBottom:'1px solid var(--border)' }}>
                      {['Symbol','Qty','Side','Type','Limit','Status','Created',''].map(h => (
                        <th key={h} style={{ paddingBottom:8, paddingRight:10 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {openOrders.map(o => (
                      <tr key={o.id} style={{ borderTop:'1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding:'8px 10px 8px 0', fontWeight:700 }}>{o.symbol}</td>
                        <td style={{ padding:'8px 10px 8px 0' }}>{o.qty}</td>
                        <td style={{ padding:'8px 10px 8px 0', color:'var(--green)' }}>{o.side?.toUpperCase()}</td>
                        <td style={{ padding:'8px 10px 8px 0', color:'var(--muted)' }}>{o.type}</td>
                        <td style={{ padding:'8px 10px 8px 0' }}>{o.limitPrice ? fmtUSD(o.limitPrice) : '—'}</td>
                        <td style={{ padding:'8px 10px 8px 0', color:'#f59e0b' }}>{o.status}</td>
                        <td style={{ padding:'8px 10px 8px 0', color:'var(--muted)', fontSize:11 }}>
                          {new Date(o.createdAt).toLocaleTimeString()}
                        </td>
                        <td style={{ padding:'8px 0' }}>
                          <button onClick={() => cancelOrderFn(o.id)} style={{ ...btn('red'), fontSize:11, padding:'3px 8px' }}>
                            Cancel
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }
        </div>
      )}

      {/* History Tab */}
      {tab === 'history' && (
        <div>
          {/* Analytics Header: range toggle + refresh */}
          <div style={{ ...card, display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
            <div style={{ display:'flex', gap:6, alignItems:'center' }}>
              <span style={{ fontSize:12, color:'var(--muted)' }}>Period:</span>
              {['day','all'].map(r => (
                <button
                  key={r}
                  onClick={() => { setAnalyticsRange(r); setTradeAnalytics(null); loadClosedOrders(r) }}
                  style={{
                    ...btn(analyticsRange === r ? 'green' : 'default'),
                    fontSize:12, padding:'4px 12px',
                  }}>
                  {r === 'day' ? 'Today' : 'All Time'}
                </button>
              ))}
            </div>
            <button
              onClick={() => loadClosedOrders(analyticsRange)}
              disabled={analyticsLoading}
              style={{ ...btn(), fontSize:11, padding:'4px 10px' }}>
              {analyticsLoading ? 'Loading…' : '⟳ Refresh'}
            </button>
          </div>

          {analyticsLoading && (
            <div style={{ ...card, textAlign:'center', color:'var(--muted)', fontSize:13 }}>
              Loading {analyticsRange === 'day' ? "today's" : 'all-time'} trade analytics from Alpaca…
            </div>
          )}

          {/* Analytics Summary Cards */}
          {tradeAnalytics && !analyticsLoading && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10, marginBottom:16 }} className="mobile-grid-2">
              {[
                { label: analyticsRange === 'day' ? "Today's Trades" : 'Total Trades',
                  val: tradeAnalytics.totalTrades, color:'var(--text)' },
                { label:'Win Rate',
                  val: `${tradeAnalytics.winRate.toFixed(1)}%`,
                  color: tradeAnalytics.winRate >= 50 ? 'var(--green)' : 'var(--red)' },
                { label:'Avg Win',  val: fmtUSD(tradeAnalytics.avgWin),  color:'var(--green)' },
                { label:'Avg Loss', val: fmtUSD(tradeAnalytics.avgLoss), color:'var(--red)' },
                { label: analyticsRange === 'day' ? "Today's P&L" : 'Total P&L',
                  val: fmtUSD(tradeAnalytics.totalPnl),
                  color: tradeAnalytics.totalPnl >= 0 ? 'var(--green)' : 'var(--red)' },
              ].map(({ label, val, color }) => (
                <div key={label} style={{ ...card, marginBottom:0, textAlign:'center' }}>
                  <div style={{ fontSize:11, color:'var(--muted)', marginBottom:4 }}>{label}</div>
                  <div style={{ fontSize:15, fontWeight:700, color }}>{val}</div>
                </div>
              ))}
            </div>
          )}

          {/* Win/Loss breakdown */}
          {tradeAnalytics && !analyticsLoading && tradeAnalytics.totalTrades > 0 && (
            <div style={{ ...card, marginBottom:16 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                <span style={{ fontSize:13, fontWeight:700 }}>
                  {analyticsRange === 'day' ? "Today's" : 'All-Time'} Win / Loss Breakdown
                </span>
              </div>
              <div style={{ display:'flex', height:8, borderRadius:4, overflow:'hidden', background:'var(--bg3)' }}>
                <div style={{
                  width: `${tradeAnalytics.winRate}%`,
                  background:'var(--green)',
                  transition:'width 0.4s',
                }} />
                <div style={{
                  width: `${100 - tradeAnalytics.winRate}%`,
                  background:'var(--red)',
                  transition:'width 0.4s',
                }} />
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', marginTop:6, fontSize:11, color:'var(--muted)' }}>
                <span style={{ color:'var(--green)' }}>✓ {tradeAnalytics.winners} wins</span>
                <span style={{ color:'var(--red)' }}>✗ {tradeAnalytics.losers} losses</span>
              </div>
            </div>
          )}

          {/* Equity Curve Chart */}
          {equityCurve.length > 1 && !analyticsLoading && (
            <div style={{ ...card, marginBottom:16 }}>
              <div style={{ fontSize:13, fontWeight:700, marginBottom:12 }}>
                {analyticsRange === 'day'
                  ? (equityCurve[0].equity != null ? "Today's Account Equity" : "Today's Cumulative P&L")
                  : (equityCurve[0].equity != null ? 'Account Equity Curve' : 'All-Time Cumulative P&L')}
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={equityCurve} margin={{ top:4, right:12, left:0, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize:10, fill:'var(--muted)' }}
                    tickFormatter={d => analyticsRange === 'day' ? d : d.slice(5)}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize:10, fill:'var(--muted)' }}
                    tickFormatter={v => `$${v >= 1000 ? (v/1000).toFixed(1)+'k' : v}`}
                    width={52}
                  />
                  <Tooltip
                    contentStyle={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, fontSize:12 }}
                    labelStyle={{ color:'var(--muted)' }}
                    formatter={(v, name) => [`$${Number(v).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 })}`, name === 'equity' ? 'Equity' : 'Cum. P&L']}
                  />
                  <ReferenceLine y={equityCurve[0].equity || 0} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4" />
                  <Line
                    type="monotone"
                    dataKey={equityCurve[0].equity != null ? 'equity' : 'pnl'}
                    stroke="var(--green)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r:4, fill:'var(--green)' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Closed Trades Table */}
          {tradeAnalytics && !analyticsLoading && (
            <div style={card}>
              <h3 style={{ fontWeight:700, marginBottom:12, fontSize:14 }}>
                {analyticsRange === 'day' ? "Today's Closed Trades" : 'Closed Trades (Last 30 Days)'}
              </h3>
              {closedTrades.length === 0
                ? <p style={{ color:'var(--muted)', fontSize:13 }}>
                    No closed trades found {analyticsRange === 'day' ? 'today' : 'in the last 30 days'}.
                  </p>
                : (
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', fontSize:12, borderCollapse:'collapse' }}>
                      <thead>
                        <tr style={{ textAlign:'left', color:'var(--muted)', borderBottom:'1px solid var(--border)' }}>
                          {['Symbol','Qty','Entry','Exit','P&L','Date'].map(h => (
                            <th key={h} style={{ paddingBottom:8, paddingRight:10, whiteSpace:'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {closedTrades.map((t, i) => (
                          <tr key={i} style={{ borderTop:'1px solid rgba(255,255,255,0.04)' }}>
                            <td style={{ padding:'8px 10px 8px 0', fontWeight:700 }}>{t.symbol}</td>
                            <td style={{ padding:'8px 10px 8px 0' }}>{t.qty}</td>
                            <td style={{ padding:'8px 10px 8px 0', color:'var(--muted)' }}>{fmtUSD(t.entryPrice)}</td>
                            <td style={{ padding:'8px 10px 8px 0', color:'var(--muted)' }}>{fmtUSD(t.exitPrice)}</td>
                            <td style={{ padding:'8px 10px 8px 0', fontWeight:700, color: t.pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                              {t.pnl >= 0 ? '+' : ''}{fmtUSD(t.pnl)}
                            </td>
                            <td style={{ padding:'8px 0', color:'var(--muted)', fontSize:11 }}>
                              {new Date(t.exitTime).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              }
            </div>
          )}

          {/* Raw order log */}
          <div style={card}>
            <h3 style={{ fontWeight:700, marginBottom:12, fontSize:14 }}>Submitted Orders Log</h3>
            {history.length === 0
              ? <p style={{ color:'var(--muted)', fontSize:13 }}>No orders placed yet.</p>
              : (
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', fontSize:12, borderCollapse:'collapse' }}>
                    <thead>
                      <tr style={{ textAlign:'left', color:'var(--muted)', borderBottom:'1px solid var(--border)' }}>
                        {['Symbol','Qty','Entry','Stop','TP','Source','Mode','Status','Time'].map(h => (
                          <th key={h} style={{ paddingBottom:8, paddingRight:10 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {history.map(o => {
                        const isAuto = o.action === 'AUTO-BUY'
                        return (
                          <tr key={o.id} style={{ borderTop:'1px solid rgba(255,255,255,0.04)' }}>
                            <td style={{ padding:'8px 10px 8px 0', fontWeight:700 }}>{o.symbol}</td>
                            <td style={{ padding:'8px 10px 8px 0' }}>{o.qty}</td>
                            <td style={{ padding:'8px 10px 8px 0' }}>{o.entry_limit ? fmtUSD(o.entry_limit) : '—'}</td>
                            <td style={{ padding:'8px 10px 8px 0', color:'var(--red)' }}>{o.stop_loss ? fmtUSD(o.stop_loss) : '—'}</td>
                            <td style={{ padding:'8px 10px 8px 0', color:'var(--green)' }}>{o.take_profit ? fmtUSD(o.take_profit) : '—'}</td>
                            <td style={{ padding:'8px 10px 8px 0' }}>
                              <span style={{
                                fontSize:10, padding:'2px 6px', borderRadius:4, fontWeight:700,
                                background: isAuto ? 'rgba(129,140,248,0.15)' : 'rgba(255,255,255,0.06)',
                                color:      isAuto ? '#818cf8'                : 'var(--muted)',
                                border:     `1px solid ${isAuto ? 'rgba(129,140,248,0.4)' : 'var(--border)'}`,
                              }}>
                                {isAuto ? '⚡ AUTO' : '👤 MANUAL'}
                              </span>
                            </td>
                            <td style={{ padding:'8px 10px 8px 0' }}>
                              <span style={{ color: o.mode==='live'?'var(--red)':'#f59e0b', fontWeight:600, fontSize:11 }}>
                                {o.mode?.toUpperCase()}
                              </span>
                            </td>
                            <td style={{ padding:'8px 10px 8px 0', color:'var(--muted)' }}>{o.status}</td>
                            <td style={{ padding:'8px 0', color:'var(--muted)', fontSize:11 }}>
                              {new Date(o.created_at).toLocaleString()}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )
            }
          </div>
        </div>
      )}

      {/* Auto-Bot Tab */}
      {tab === 'bot' && (
        <div>
          {/* Enable/Disable Banner */}
          {dailyLossHalted && botCfg?.enabled && (
            <div style={{ ...card, marginBottom:12, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.4)', display:'flex', alignItems:'center', gap:12 }}>
              <span style={{ fontSize:18 }}>🛑</span>
              <div>
                <div style={{ fontWeight:700, fontSize:13, color:'var(--red)' }}>Daily Loss Limit Reached — Bot Halted</div>
                <div style={{ fontSize:12, color:'var(--muted)', marginTop:2 }}>
                  The auto-bot has been suspended for today after hitting the daily loss limit.
                  It will resume automatically tomorrow at market open.
                </div>
              </div>
            </div>
          )}

          {botCfg && (
            <div style={{
              ...card, marginBottom:12,
              background: botCfg.enabled && !dailyLossHalted ? 'rgba(52,211,153,0.07)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${botCfg.enabled && !dailyLossHalted ? 'rgba(52,211,153,0.4)' : 'var(--border)'}`,
              display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12,
            }}>
              <div>
                <div style={{ fontWeight:700, fontSize:15, color: botCfg.enabled && !dailyLossHalted ? 'var(--green)' : 'var(--muted)' }}>
                  {botCfg.enabled && !dailyLossHalted ? '● Auto-Trading ACTIVE' : botCfg.enabled && dailyLossHalted ? '⏸ Auto-Trading HALTED (loss limit)' : '○ Auto-Trading DISABLED'}
                </div>
                <div style={{ fontSize:12, color:'var(--muted)', marginTop:3 }}>
                  {botCfg.enabled && !dailyLossHalted
                    ? 'Bot scans every 5 minutes during market hours and places bracket orders automatically.'
                    : botCfg.enabled && dailyLossHalted
                    ? 'Daily loss limit triggered. Bot will resume tomorrow.'
                    : 'Enable the bot below to auto-execute BUY signals during market hours.'}
                </div>
              </div>
              <button
                onClick={async () => {
                  const next = !botCfg.enabled
                  const updated = { ...botCfg, enabled: next }
                  setBotCfg(updated)
                  setBotSaving(true); setBotMsg(null)
                  try {
                    await fetch('/api/momentum/auto-trade', {
                      method:'POST', headers:{'Content-Type':'application/json'},
                      body: JSON.stringify(updated),
                    })
                    setBotMsg({ ok: true, text: next ? 'Auto-trading enabled. Bot will scan every 5 minutes during market hours.' : 'Auto-trading disabled.' })
                  } catch (e) {
                    setBotCfg(c => ({ ...c, enabled: !next }))
                    setBotMsg({ ok: false, text: 'Failed to save: ' + e.message })
                  }
                  setBotSaving(false)
                }}
                disabled={botSaving}
                style={{ ...btn(botCfg.enabled ? 'red' : 'green'), fontSize:13, padding:'8px 20px' }}
              >
                {botSaving ? '…' : botCfg.enabled ? 'Disable Bot' : 'Enable Bot'}
              </button>
            </div>
          )}

          {botMsg && (
            <div style={{ background: botMsg.ok ? 'rgba(52,211,153,0.1)' : 'rgba(239,68,68,0.1)', border:`1px solid ${botMsg.ok ? 'var(--green)' : 'var(--red)'}`, borderRadius:8, padding:'10px 14px', marginBottom:12, fontSize:13, color: botMsg.ok ? 'var(--green)' : 'var(--red)' }}>
              {botMsg.text}
            </div>
          )}

          {/* Config Form */}
          {botCfg && (
            <div style={card}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:8 }}>
                <h3 style={{ fontWeight:700, fontSize:14, margin:0 }}>Bot Configuration</h3>
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={runBotNow} disabled={botRunning} style={{ ...btn('default'), fontSize:12 }}>
                    {botRunning ? 'Running…' : '▶ Run Now'}
                  </button>
                  <button onClick={saveBot} disabled={botSaving} style={{ ...btn('green'), fontSize:12 }}>
                    {botSaving ? 'Saving…' : 'Save Settings'}
                  </button>
                </div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }} className="mobile-grid-1">
                <label style={{ display:'block' }}>
                  <span style={{ fontSize:12, color:'var(--muted)', display:'block', marginBottom:5 }}>Watch Symbols (comma-separated)</span>
                  <input
                    value={botCfg.symbols}
                    onChange={e => setBotCfg(c => ({ ...c, symbols: e.target.value }))}
                    style={{ ...inp, fontSize:12 }}
                    placeholder="AAPL,TSLA,NVDA,AMD,..."
                  />
                </label>
                <label style={{ display:'block' }}>
                  <span style={{ fontSize:12, color:'var(--muted)', display:'block', marginBottom:5 }}>Alert Email (for drop alerts & EOD summary)</span>
                  <input
                    type="email"
                    value={botCfg.alertEmail || ''}
                    onChange={e => setBotCfg(c => ({ ...c, alertEmail: e.target.value }))}
                    style={{ ...inp, fontSize:12 }}
                    placeholder="you@example.com"
                  />
                </label>
                <label style={{ display:'block' }}>
                  <span style={{ fontSize:12, color:'var(--muted)', display:'block', marginBottom:5 }}>Portfolio Drop Alert Threshold (%)</span>
                  <input
                    type="number" min="1" max="50" step="0.5"
                    value={botCfg.dropAlertPct}
                    onChange={e => setBotCfg(c => ({ ...c, dropAlertPct: parseFloat(e.target.value) }))}
                    style={{ ...inp, fontSize:12 }}
                  />
                </label>
                <label style={{ display:'block' }}>
                  <span style={{ fontSize:12, color:'var(--muted)', display:'block', marginBottom:5 }}>Min Signal Strength to Auto-Trade (1–3)</span>
                  <input
                    type="number" min="1" max="3"
                    value={botCfg.minStrength}
                    onChange={e => setBotCfg(c => ({ ...c, minStrength: parseInt(e.target.value) }))}
                    style={{ ...inp, fontSize:12 }}
                  />
                </label>
                <label style={{ display:'block' }}>
                  <span style={{ fontSize:12, color:'var(--muted)', display:'block', marginBottom:5 }}>Stop Loss % (e.g. 0.01 = 1%)</span>
                  <input
                    type="number" min="0.005" max="0.1" step="0.005"
                    value={botCfg.stopPct}
                    onChange={e => setBotCfg(c => ({ ...c, stopPct: parseFloat(e.target.value) }))}
                    style={{ ...inp, fontSize:12 }}
                  />
                </label>
                <label style={{ display:'block' }}>
                  <span style={{ fontSize:12, color:'var(--muted)', display:'block', marginBottom:5 }}>Take Profit % (e.g. 0.02 = 2%)</span>
                  <input
                    type="number" min="0.005" max="0.2" step="0.005"
                    value={botCfg.tpPct}
                    onChange={e => setBotCfg(c => ({ ...c, tpPct: parseFloat(e.target.value) }))}
                    style={{ ...inp, fontSize:12 }}
                  />
                </label>
              </div>

              {/* Daily Loss Limit */}
              <div style={{ marginTop:16, padding:'14px 16px', background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.25)', borderRadius:8 }}>
                <div style={{ fontWeight:700, fontSize:13, color:'var(--red)', marginBottom:10 }}>🛑 Daily Loss Limit</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }} className="mobile-grid-1">
                  <label style={{ display:'block' }}>
                    <span style={{ fontSize:12, color:'var(--muted)', display:'block', marginBottom:5 }}>Limit Type</span>
                    <select
                      value={botCfg.dailyLossLimitType || 'dollar'}
                      onChange={e => setBotCfg(c => ({ ...c, dailyLossLimitType: e.target.value }))}
                      style={{ ...inp, fontSize:12, width:'100%' }}
                    >
                      <option value="dollar">Dollar amount ($)</option>
                      <option value="pct">Percentage of equity (%)</option>
                    </select>
                  </label>
                  <label style={{ display:'block' }}>
                    <span style={{ fontSize:12, color:'var(--muted)', display:'block', marginBottom:5 }}>
                      {botCfg.dailyLossLimitType === 'pct' ? 'Max Daily Loss (%) — 0 = disabled' : 'Max Daily Loss ($) — 0 = disabled'}
                    </span>
                    <input
                      type="number" min="0" step={botCfg.dailyLossLimitType === 'pct' ? '0.5' : '10'}
                      value={botCfg.dailyLossLimit ?? 0}
                      onChange={e => setBotCfg(c => ({ ...c, dailyLossLimit: parseFloat(e.target.value) || 0 }))}
                      style={{ ...inp, fontSize:12 }}
                      placeholder="0 = disabled"
                    />
                  </label>
                </div>
                <div style={{ fontSize:11, color:'var(--muted)', marginTop:8 }}>
                  When the daily loss limit is hit, the bot stops placing new orders for the rest of the day.
                  {dailyLossHalted && <span style={{ color:'var(--red)', fontWeight:700, marginLeft:6 }}>⚠ Currently halted today.</span>}
                </div>
              </div>

              {/* Email info box */}
              <div style={{ marginTop:16, padding:'10px 14px', background:'rgba(129,140,248,0.06)', border:'1px solid rgba(129,140,248,0.2)', borderRadius:8, fontSize:12, color:'var(--muted)' }}>
                <span style={{ color:'#818cf8', fontWeight:700 }}>📧 Email setup:</span>
                {' '}All emails (drop alerts, EOD summaries) also go to your briefing subscribers + admin email set in Briefing settings.
                Add your email above to ensure you receive them even if you have no subscribers.
              </div>
            </div>
          )}

          {/* Bot schedule reference */}
          <div style={{ ...card, display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, fontSize:12 }} className="mobile-grid-2">
            {[
              { icon:'⚡', label:'Auto-Trade Scan', detail:'Every 5 min · Market hours only · BUY signals with strength ≥ threshold' },
              { icon:'🛑', label:'Daily Loss Limit', detail: botCfg?.dailyLossLimit > 0 ? `Halts bot if loss exceeds ${botCfg.dailyLossLimitType === 'pct' ? botCfg.dailyLossLimit + '%' : '$' + botCfg.dailyLossLimit} from day open · Resets next day` : 'Not configured — set a limit above to enable' },
              { icon:'📉', label:'Drop Alert Email', detail:`Triggered when portfolio falls >${botCfg?.dropAlertPct ?? 5}% from day open · Sent once per day` },
              { icon:'📊', label:'EOD Summary Email', detail:'Sent daily at 4:35 PM ET · P&L, open positions, all orders placed today' },
            ].map(({ icon, label, detail }) => (
              <div key={label} style={{ background:'var(--bg3)', borderRadius:8, padding:'12px 14px' }}>
                <div style={{ fontSize:16, marginBottom:6 }}>{icon}</div>
                <div style={{ fontWeight:700, color:'var(--text)', marginBottom:4 }}>{label}</div>
                <div style={{ color:'var(--muted)', lineHeight:1.6 }}>{detail}</div>
              </div>
            ))}
          </div>

          {/* Activity Log */}
          <div style={card}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12, flexWrap:'wrap', gap:8 }}>
              <h3 style={{ fontWeight:700, fontSize:14, margin:0 }}>Activity Log</h3>
              <button onClick={loadBot} style={{ ...btn(), fontSize:11, padding:'3px 10px' }}>⟳ Refresh</button>
            </div>
            {botLog.length === 0
              ? <p style={{ fontSize:12, color:'var(--muted)' }}>No activity yet. Enable the bot or click Run Now to start.</p>
              : (
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', fontSize:12, borderCollapse:'collapse' }}>
                    <thead>
                      <tr style={{ textAlign:'left', color:'var(--muted)', borderBottom:'1px solid var(--border)' }}>
                        {['Time','Event','Symbol','Detail'].map(h => (
                          <th key={h} style={{ paddingBottom:8, paddingRight:10, whiteSpace:'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {botLog.map(row => {
                        const evCol = row.event === 'ORDER_PLACED'           ? 'var(--green)'
                          : row.event === 'ORDER_FAILED'                     ? 'var(--red)'
                          : row.event === 'DROP_ALERT'                       ? '#f59e0b'
                          : row.event === 'DAILY_LOSS_LIMIT_HIT'             ? 'var(--red)'
                          : row.event === 'EOD_SENT'                         ? '#818cf8'
                          : 'var(--muted)'
                        return (
                          <tr key={row.id} style={{ borderTop:'1px solid rgba(255,255,255,0.04)' }}>
                            <td style={{ padding:'6px 10px 6px 0', color:'var(--muted)', whiteSpace:'nowrap' }}>
                              {new Date(row.created_at).toLocaleString()}
                            </td>
                            <td style={{ padding:'6px 10px 6px 0', color:evCol, fontWeight:600, whiteSpace:'nowrap' }}>
                              {row.event}
                            </td>
                            <td style={{ padding:'6px 10px 6px 0', fontWeight:700 }}>{row.symbol || '—'}</td>
                            <td style={{ padding:'6px 0', color:'var(--muted)', maxWidth:280, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                              {row.detail || '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )
            }
          </div>
        </div>
      )}

      {/* Strategy Info */}
      <div style={{ ...card, opacity:0.8 }}>
        <h4 style={{ fontWeight:700, marginBottom:10, fontSize:13 }}>Strategy Logic</h4>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, fontSize:12, color:'var(--muted)' }} className="mobile-grid-1">
          <div>
            <p style={{ color:'var(--text)', fontWeight:600, marginBottom:4 }}>Signal Criteria</p>
            <p>🟢 <strong>BUY</strong> — Gap &gt;4% + Above VWAP + Pole detected</p>
            <p>🟡 <strong>WATCH</strong> — Gap &gt;2% + VWAP or EMA bullish</p>
            <p>⚪ <strong>IGNORE</strong> — Conditions not met</p>
          </div>
          <div>
            <p style={{ color:'var(--text)', fontWeight:600, marginBottom:4 }}>Risk Management</p>
            <p>📐 Position size: 2% of account per trade</p>
            <p>🛑 Stop loss: 1% below entry (auto bracket)</p>
            <p>🎯 Take profit: 2% above entry (1:2 R/R)</p>
            <p>🔒 Max 3 open positions at once</p>
          </div>
        </div>
      </div>
    </div>
  )
}
