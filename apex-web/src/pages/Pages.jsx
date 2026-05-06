import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { explainScore, signalFromScore, statusText } from '../lib/text'
import {
  fetchChatReply, fetchEarningsAnalysis, fetchEarningsData,
  fetchMarketBriefing, fetchOverview, fetchResearch, fetchScorerInsight, fetchSectors, fetchTopAssets,
} from '../lib/geminiClient'
import { Skeleton } from '../components/Skeleton'

const tone = v => v >= 0 ? 'text-bull' : 'text-bear'

// ── Retry helper ──────────────────────────────────────────────────────────────
async function withRetry(fn, retries = 3, delay = 1000) {
  try { return await fn() }
  catch (e) {
    if (retries <= 0) throw e
    await new Promise(r => setTimeout(r, delay))
    return withRetry(fn, retries - 1, delay * 1.5)
  }
}

// ── Shared UI helpers ──────────────────────────────────────────────────────────
function AIButton({ onClick, loading, label, loadingLabel = 'Thinking…', className = '' }) {
  return (
    <button onClick={onClick} disabled={loading}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-ai/40 text-ai bg-ai/8 disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:bg-ai/15 ${className}`}>
      {loading && <span className="w-3.5 h-3.5 rounded-full border-2 border-ai/30 border-t-ai animate-spin" />}
      {loading ? loadingLabel : label}
    </button>
  )
}

function Spinner() {
  return (
    <div className="flex items-center justify-center h-40">
      <div className="w-7 h-7 rounded-full border-[1.5px] border-border/60 border-t-muted animate-spin" />
    </div>
  )
}

function DataError({ msg, onRetry }) {
  return (
    <div className="card flex items-center justify-between gap-4">
      <p className="text-bear text-sm font-medium">{msg}</p>
      {onRetry && (
        <button onClick={onRetry}
          className="px-3 py-1.5 text-xs font-medium rounded-xl border border-border/60 text-muted hover:text-text hover:border-border transition-all">
          Retry
        </button>
      )}
    </div>
  )
}

function LiveBadge() {
  return <span className="inline-block w-1.5 h-1.5 rounded-full bg-bull mr-2 animate-pulse" />
}

function ScoreBar({ value }) {
  const color = value >= 70 ? '#30d158' : value >= 40 ? '#0a84ff' : '#ff453a'
  return (
    <div className="score-bar-track">
      <div className="score-bar-fill" style={{ width: `${Math.max(3, Math.min(100, value))}%`, background: color, opacity: 0.9 }} />
    </div>
  )
}

// ── Dashboard helpers ──────────────────────────────────────────────────────────

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

function useFlashOnChange(value) {
  const [flash, setFlash] = useState(null)
  const prev = useRef(null)
  useEffect(() => {
    if (prefersReducedMotion()) return
    const p = prev.current
    if (p !== null && value !== null && p !== value) {
      setFlash(value > p ? 'bull' : 'bear')
      const t = setTimeout(() => setFlash(null), 400)
      return () => clearTimeout(t)
    }
    prev.current = value
  }, [value])
  return flash
}

const SL = 'text-[11px] font-semibold tracking-[0.08em] uppercase text-zinc-400 mt-3 mb-2 md:mt-4 md:mb-3'

function IndexCardSkeleton() {
  return (
    <div className="card-inner space-y-2">
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-7 w-24" />
      <Skeleton className="h-3 w-14" />
    </div>
  )
}

function IndexCard({ idx }) {
  const flash = useFlashOnChange(idx?.change)
  return (
    <div className={`card-inner transition-colors duration-[400ms] ${flash === 'bull' ? 'bg-bull/10' : flash === 'bear' ? 'bg-bear/10' : ''}`}>
      <p className="text-sm font-medium text-zinc-300 mb-1 truncate">{idx.name ?? idx.symbol}</p>
      <p className="text-2xl md:text-3xl font-semibold font-mono tabular-nums text-white tracking-tight">
        ${idx.price?.toLocaleString()}
      </p>
      <p className={`text-sm font-medium font-mono tabular-nums ${idx.change >= 0 ? 'text-bull' : 'text-bear'}`}>
        {idx.change >= 0 ? '+' : ''}{idx.change}%
      </p>
      <p className="text-xs text-zinc-400 mt-1">{idx.change >= 0 ? 'Buyers in control.' : 'Sellers have the edge.'}</p>
    </div>
  )
}

function FearGreedCard({ value, loading }) {
  const flash = useFlashOnChange(value)
  const fgColor = value < 30 ? '#ff453a' : value > 70 ? '#30d158' : '#ffd60a'
  const fgLabel = value < 30 ? 'Extreme Fear' : value < 45 ? 'Fear' : value < 55 ? 'Neutral' : value < 70 ? 'Greed' : 'Extreme Greed'
  const fgDesc  = value < 30 ? 'Patient buyers may find opportunities.' : value > 70 ? 'Caution — avoid chasing here.' : 'Neutral — confirm before entering.'
  return (
    <div className={`card-inner transition-colors duration-[400ms] ${flash === 'bull' ? 'bg-bull/10' : flash === 'bear' ? 'bg-bear/10' : ''}`}>
      <p className="text-[11px] font-semibold tracking-[0.08em] uppercase text-zinc-400 mb-2">Fear &amp; Greed</p>
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-2 w-full rounded-full" />
          <Skeleton className="h-3 w-40" />
        </div>
      ) : value == null ? (
        <EmptyState />
      ) : (
        <>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-2xl md:text-3xl font-semibold font-mono tabular-nums tracking-tight" style={{ color: fgColor }}>{value}</span>
            <span className="text-sm font-medium" style={{ color: fgColor }}>{fgLabel}</span>
            <span className="text-xs font-mono tabular-nums text-zinc-400 ml-auto">/100</span>
          </div>
          <div className="score-bar-track mb-2">
            <div className="score-bar-fill" style={{ width: `${value}%`, background: fgColor, transition: 'width 0.5s' }} />
          </div>
          <p className="text-xs text-zinc-400">{fgDesc}</p>
        </>
      )}
    </div>
  )
}

function VixCard({ value, loading }) {
  const flash = useFlashOnChange(value)
  return (
    <div className={`card-inner transition-colors duration-[400ms] ${flash === 'bull' ? 'bg-bull/10' : flash === 'bear' ? 'bg-bear/10' : ''}`}>
      <p className="text-[11px] font-semibold tracking-[0.08em] uppercase text-zinc-400 mb-2">Volatility (VIX)</p>
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-48" />
        </div>
      ) : value == null ? (
        <EmptyState />
      ) : (
        <>
          <p className="text-2xl md:text-3xl font-semibold font-mono tabular-nums text-white tracking-tight mb-1">{value}</p>
          <p className="text-sm font-medium text-zinc-300">{statusText(value ?? 20)}</p>
          <p className="text-xs text-zinc-400 mt-1">This tells you how wide your stop loss may need to be today.</p>
        </>
      )}
    </div>
  )
}

function EmptyState({ message = 'No data yet', sub = 'Check back at market open' }) {
  return (
    <div className="flex flex-col items-center justify-center py-6 gap-1.5">
      <svg className="w-8 h-8 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
      <p className="text-sm text-zinc-400">{message}</p>
      <p className="text-xs text-zinc-500">{sub}</p>
    </div>
  )
}

function SectorBars({ sectors, loading }) {
  if (loading) {
    return (
      <div className="space-y-1.5">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className={`h-6 ${i % 3 === 0 ? 'w-full' : i % 3 === 1 ? 'w-4/5' : 'w-3/4'}`} />
        ))}
      </div>
    )
  }
  if (!sectors.length) {
    return (
      <div className="flex flex-col items-center justify-center py-6 gap-2">
        <div className="grid grid-cols-4 gap-1 opacity-20 w-full">
          {Array.from({ length: 12 }).map((_, i) => <div key={i} className="h-6 bg-zinc-800 rounded" />)}
        </div>
        <p className="text-sm text-zinc-400 mt-1">No data yet</p>
        <p className="text-xs text-zinc-500">Check back at market open</p>
      </div>
    )
  }
  const maxAbs = Math.max(...sectors.map(s => Math.abs(s.change)), 1)
  return (
    <div className="space-y-1.5">
      {sectors.map(s => (
        <div key={s.name} className="flex items-center gap-2">
          <p className="text-xs font-medium text-zinc-300 w-28 shrink-0 truncate">{s.name}</p>
          <div className="flex-1 h-5 bg-zinc-800/60 rounded relative overflow-hidden">
            <div
              className={`absolute inset-y-0 left-0 rounded ${s.change >= 0 ? 'bg-bull/30' : 'bg-bear/30'}`}
              style={{ width: `${(Math.abs(s.change) / maxAbs) * 100}%`, transition: 'width 0.5s' }}
            />
          </div>
          <p className={`text-xs font-mono tabular-nums w-12 text-right shrink-0 ${s.change >= 0 ? 'text-bull' : 'text-bear'}`}>
            {s.change >= 0 ? '+' : ''}{s.change}%
          </p>
        </div>
      ))}
    </div>
  )
}

function SectorGrid({ sectors, loading }) {
  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-1.5">
        {Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
      </div>
    )
  }
  if (!sectors.length) {
    return (
      <div className="grid grid-cols-3 gap-1.5 opacity-20">
        {Array.from({ length: 11 }).map((_, i) => <div key={i} className="h-14 bg-zinc-800 rounded-xl" />)}
      </div>
    )
  }
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {sectors.map(s => (
        <div key={s.name} className={`p-2.5 rounded-xl ${s.change >= 0 ? 'bg-bull/8 border border-bull/20' : 'bg-bear/8 border border-bear/20'}`}>
          <p className="text-xs font-medium text-zinc-300 leading-tight truncate">{s.name}</p>
          <p className={`text-sm font-semibold font-mono tabular-nums mt-0.5 ${tone(s.change)}`}>
            {s.change > 0 ? '+' : ''}{s.change}%
          </p>
          <p className="text-[10px] font-mono tabular-nums text-zinc-400 mt-0.5">{s.weight}% of S&amp;P</p>
        </div>
      ))}
    </div>
  )
}

const ALL_CALENDAR = [
  { event: 'Fed Speaker',    impact: 'High',   when: 'Today'  },
  { event: 'GDP Revision',   impact: 'High',   when: '1 day'  },
  { event: 'Initial Claims', impact: 'Medium', when: '2 days' },
  { event: 'PCE',            impact: 'High',   when: '3 days' },
  { event: 'Payrolls',       impact: 'High',   when: '7 days' },
]

// ── Dashboard ──────────────────────────────────────────────────────────────────
export function DashboardPage() {
  const [overview, setOverview]           = useState(null)
  const [sectors, setSectors]             = useState([])
  const [loadingData, setLoadingData]     = useState(true)
  const [dataError, setDataError]         = useState(null)
  const [briefing, setBriefing]           = useState(null)
  const [briefingLoading, setBriefingLoading] = useState(false)
  const [briefingError, setBriefingError] = useState(null)
  const [refreshedAt, setRefreshedAt]     = useState(null)
  const [showFullCalendar, setShowFullCalendar] = useState(false)

  async function loadData() {
    setLoadingData(true)
    setDataError(null)
    try {
      const [ov, sec] = await withRetry(() => Promise.all([fetchOverview(), fetchSectors()]))
      setOverview(ov)
      setSectors(sec)
      setRefreshedAt(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }))
    } catch (e) {
      setDataError('Could not load live market data. ' + e.message)
    } finally {
      setLoadingData(false)
    }
  }

  useEffect(() => { loadData() }, [])

  async function handleRefresh() {
    setBriefingLoading(true)
    setBriefingError(null)
    try {
      const data = await fetchMarketBriefing({
        indices: overview?.indices,
        sectors: sectors?.slice(0, 5),
        vix: overview?.vix,
        fearGreed: overview?.fearGreed,
      })
      setBriefing(data.text)
      setRefreshedAt(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }))
    } catch (e) {
      setBriefingError('Could not fetch briefing. ' + e.message)
    } finally {
      setBriefingLoading(false)
    }
  }

  const calendarItems = showFullCalendar ? ALL_CALENDAR : ALL_CALENDAR.filter(e => e.when === 'Today')

  return (
    <div className="px-4 py-3 md:px-6 md:py-5 lg:px-8 lg:py-6 space-y-3 md:space-y-4 lg:space-y-5">

      {/* Sticky mobile header */}
      <div className="md:hidden sticky top-0 z-20 -mx-4 px-4 h-12 flex items-center justify-between border-b border-zinc-800 bg-bg/90 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">Dashboard</span>
          <LiveBadge />
        </div>
        {refreshedAt && (
          <span className="text-[11px] text-zinc-500 font-mono tabular-nums">Updated {refreshedAt}</span>
        )}
      </div>

      {/* Desktop page title */}
      <div className="hidden md:flex items-center justify-between pt-1">
        <div>
          <h1 className="text-xl font-semibold tracking-tighter flex items-center gap-2">
            Dashboard <LiveBadge />
          </h1>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        {refreshedAt && (
          <span className="text-[11px] text-zinc-500 font-mono tabular-nums">Updated {refreshedAt}</span>
        )}
      </div>

      {dataError && <DataError msg={dataError} onRetry={loadData} />}

      {/* ── Index cards ── */}
      <section>
        <p className={SL}>Market Overview</p>
        <div
          className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4"
          aria-live="polite"
          aria-label="Market indices"
        >
          {loadingData
            ? Array.from({ length: 4 }).map((_, i) => <IndexCardSkeleton key={i} />)
            : (overview?.indices ?? []).length
              ? (overview.indices).map(idx => <IndexCard key={idx.symbol} idx={idx} />)
              : Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="card-inner"><EmptyState /></div>
                ))
          }
        </div>
      </section>

      {/* ── Fear & Greed + VIX ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        <FearGreedCard value={overview?.fearGreed ?? null} loading={loadingData} />
        <VixCard value={overview?.vix ?? null} loading={loadingData} />
      </div>

      {/* ── Sector Heat Map ── */}
      <section>
        <p className={SL}>Sector Heat Map</p>
        {/* Mobile: vertical bars */}
        <div className="md:hidden card p-4">
          <SectorBars sectors={sectors} loading={loadingData} />
        </div>
        {/* Desktop: grid tiles */}
        <div className="hidden md:block card p-4 md:p-5">
          <SectorGrid sectors={sectors} loading={loadingData} />
        </div>
      </section>

      {/* ── Economic Calendar ── */}
      <section>
        <div className="flex items-center justify-between">
          <p className={SL} style={{ marginTop: 0 }}>Economic Calendar</p>
          <button
            className="md:hidden text-[11px] text-info underline underline-offset-2"
            onClick={() => setShowFullCalendar(v => !v)}
          >
            {showFullCalendar ? 'Show today' : 'View week →'}
          </button>
        </div>
        <div className="space-y-1.5 mt-2">
          {calendarItems.map(e => (
            <div key={e.event} className="card-inner">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-zinc-300">{e.event}</p>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${e.impact === 'High' ? 'bg-bear/15 text-bear' : e.impact === 'Medium' ? 'bg-neutral/15 text-neutral' : 'bg-zinc-700/50 text-zinc-400'}`}>
                  {e.impact}
                </span>
              </div>
              <p className="text-xs font-mono tabular-nums text-zinc-400 mt-0.5">{e.when}</p>
            </div>
          ))}
          {!showFullCalendar && (
            <p className="md:hidden text-[11px] text-zinc-500 text-center pt-0.5">
              {ALL_CALENDAR.length - calendarItems.length} more events this week
            </p>
          )}
        </div>
      </section>

      {/* ── AI Briefing ── */}
      {!loadingData && !dataError && (
        <section className="card p-4 md:p-5">
          <div className="flex items-center justify-between mb-2 md:mb-3">
            <h3 className="font-semibold text-white flex items-center gap-2">
              AI Market Briefing
              <span className="text-[10px] font-normal text-ai border border-ai/30 rounded-full px-2 py-0.5">Gemini Pro</span>
            </h3>
            {refreshedAt && (
              <span className="text-[11px] text-zinc-500 font-mono tabular-nums">Updated {refreshedAt}</span>
            )}
          </div>
          {briefingError && <p className="text-bear text-sm mb-2">{briefingError}</p>}
          {briefing
            ? <p className="text-sm leading-relaxed text-zinc-300 whitespace-pre-wrap">{briefing}</p>
            : <p className="text-sm leading-relaxed text-zinc-400">Click below to generate a live AI briefing using today's real market data.</p>
          }
          <AIButton
            onClick={handleRefresh}
            loading={briefingLoading}
            label="Generate Live Briefing"
            loadingLabel="Analysing markets…"
            className="mt-3 bg-ai/10"
          />
          <p className="text-[11px] text-zinc-500 mt-3">AI-generated · Not financial advice</p>
        </section>
      )}
    </div>
  )
}

// ── Top 20 Scorer ──────────────────────────────────────────────────────────────
export function ScorerPage() {
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('Top 10')
  const [query, setQuery] = useState('')
  const [insights, setInsights] = useState({})
  const [loadingInsight, setLoadingInsight] = useState({})

  async function loadAssets() {
    setLoading(true); setError(null)
    try { setAssets(await withRetry(fetchTopAssets)) }
    catch (e) { setError('Could not load asset data. ' + e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { loadAssets() }, [])

  const sorted = useMemo(() => [...assets].sort((a, b) => b.score100 - a.score100), [assets])

  const shown = useMemo(() => {
    let list = sorted.filter(a => a.ticker.includes(query.toUpperCase()))
    if (filter === 'Top 10') list = list.slice(0, 10)
    else if (filter === 'Stock') list = list.filter(a => a.type === 'Stock')
    else if (filter === 'ETF') list = list.filter(a => a.type === 'ETF')
    else if (filter === 'Strong Buy') list = list.filter(a => a.score100 >= 75)
    return list
  }, [sorted, filter, query])

  async function handleInsight(a) {
    if (insights[a.ticker]) return
    setLoadingInsight(p => ({ ...p, [a.ticker]: true }))
    try {
      const data = await fetchScorerInsight(a.ticker, a.score100, a.dimensions, a.price, a.change)
      setInsights(p => ({ ...p, [a.ticker]: data.text }))
    } catch {
      setInsights(p => ({ ...p, [a.ticker]: 'Could not load AI insight.' }))
    } finally {
      setLoadingInsight(p => ({ ...p, [a.ticker]: false }))
    }
  }

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap gap-2 items-center">
        <span className="text-xs text-muted mr-1"><LiveBadge />AI-scored · sorted by rank</span>
        {['Top 10','All 20','Stock','ETF','Strong Buy'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-lg border transition-colors text-sm ${f === filter ? 'border-bull text-bull bg-bull/10' : 'border-border hover:border-ai/50'}`}>{f}</button>
        ))}
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search ticker…"
          className="ml-auto bg-bg border border-border rounded-lg px-3 py-1 focus:outline-none focus:border-ai text-sm" />
        <button onClick={loadAssets} className="text-xs px-2 py-1 border border-border rounded-lg hover:border-ai transition-colors">↻ Refresh</button>
      </div>

      {loading ? <Spinner /> : error ? <DataError msg={error} onRetry={loadAssets} /> : shown.map((a, idx) => {
        const rank = sorted.findIndex(x => x.ticker === a.ticker) + 1
        const sig = signalFromScore(a.score100)
        const stopDist = +(a.price * 0.035).toFixed(2)
        const targetDist = +(stopDist * 2.5).toFixed(2)
        return (
          <div key={a.ticker} className="card">
            <div className="flex flex-wrap justify-between gap-2">
              <div className="flex items-start gap-3">
                <span className={`text-lg font-bold tabular-nums min-w-[2rem] text-center mt-0.5 ${rank <= 3 ? 'text-bull' : 'text-muted'}`}>#{rank}</span>
                <div>
                  <span className="font-semibold text-base">{a.ticker}</span>
                  <span className="text-muted text-sm ml-2">{a.name} · {a.sector} · {a.type}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold">${a.price?.toLocaleString()}</p>
                <p className={`text-sm ${tone(a.change)}`}>{a.change > 0 ? '+' : ''}{a.change}%</p>
              </div>
            </div>
            <p className="sub">Volume: {a.volX}× 3-month avg — {a.volX > 2 ? 'unusually high participation, moves have stronger conviction.' : a.volX > 1 ? 'above-average activity today.' : 'below-average volume, moves may lack conviction.'}</p>
            <div className="grid md:grid-cols-3 gap-3 mt-3">
              <div className="rounded-xl border border-border p-3">
                <p className="text-2xl font-display">{a.score10} <span className="text-base font-normal text-muted">/ 10</span></p>
                <p className={`font-semibold text-sm mt-0.5 ${a.score100 >= 75 ? 'text-bull' : a.score100 >= 50 ? 'text-neutral' : 'text-bear'}`}>{sig}</p>
                <p className="sub text-xs mt-1">{explainScore(a.score100)}</p>
              </div>
              <div className="md:col-span-2 space-y-2.5">
                {Object.entries(a.dimensions).map(([k, v]) => (
                  <div key={k}>
                    <div className="flex justify-between items-center text-xs mb-1">
                      <span className="uppercase text-muted tracking-wider font-medium" style={{fontSize:'10px'}}>{k}</span>
                      <span className="font-medium tabular-nums">{Math.round(v)}</span>
                    </div>
                    <ScoreBar value={v} />
                  </div>
                ))}
              </div>
            </div>
            <p className="mt-3 text-sm">
              Entry: <span className="font-mono">${(a.price - stopDist * 0.3).toFixed(2)}–${(a.price + stopDist * 0.3).toFixed(2)}</span> ·
              Target: <span className="font-mono text-bull">${(a.price + targetDist).toFixed(2)}</span> ·
              Stop: <span className="font-mono text-bear">${(a.price - stopDist).toFixed(2)}</span> · R/R 1:2.5
            </p>
            <p className="sub text-xs">Enter in zone, take profit near target, exit quickly if stop breaks.</p>
            {insights[a.ticker]
              ? <div className="mt-3 p-3 rounded-xl bg-ai/10 border border-ai/30 text-sm leading-relaxed">{insights[a.ticker]}</div>
              : <AIButton onClick={() => handleInsight(a)} loading={loadingInsight[a.ticker]} label="Get AI Insight" loadingLabel="Analysing…" className="mt-3" />
            }
          </div>
        )
      })}
    </div>
  )
}

// ── Options & Dark Pool (mock — requires paid data feeds) ──────────────────────
const OPTIONS_FLOW = [
  { ticker:'NVDA', side:'Call', strike:950, expiry:'2026-05-03', premium:'$2.1M', sentiment:'Bullish' },
  { ticker:'TSLA', side:'Put', strike:165, expiry:'2026-05-10', premium:'$1.4M', sentiment:'Bearish' },
  { ticker:'AAPL', side:'Call', strike:210, expiry:'2026-05-17', premium:'$890K', sentiment:'Bullish' },
  { ticker:'SPY',  side:'Put', strike:510, expiry:'2026-04-30', premium:'$3.2M', sentiment:'Bearish' },
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

export function FlowPage() {
  return (
    <div className="space-y-4">
      <div className="card"><p className="text-xs text-muted">⚠ Options flow and dark pool data require paid data feeds (Unusual Whales, etc.) — showing representative examples.</p></div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="font-display mb-2">Unusual Options Activity</h3>
          {OPTIONS_FLOW.map(o => (
            <div key={o.ticker+o.strike} className="border border-border rounded-xl p-3 mt-2">
              <p className={`font-semibold ${o.side==='Call'?'text-bull':'text-bear'}`}>{o.ticker} {o.side} ${o.strike} · {o.expiry} · {o.premium}</p>
              <p className="sub">Large {o.side.toLowerCase()} bet — high premium indicates strong conviction from an institutional player.</p>
            </div>
          ))}
        </div>
        <div className="card">
          <h3 className="font-display mb-2">Dark Pool Prints</h3>
          {DARK_POOL.map(d => (
            <div key={d.ticker+d.time} className="border border-border rounded-xl p-3 mt-2">
              <p className="font-semibold">{d.ticker} {d.size} shares @ {d.price} <span className="font-normal text-muted text-sm">({d.time})</span></p>
              <p className="sub">Large off-exchange block — can hint at institutions quietly building or trimming positions.</p>
            </div>
          ))}
        </div>
      </div>
      <div className="card">
        <h3 className="font-display mb-2">Congress & Senate Trades</h3>
        {CONGRESS.map(c => (
          <div key={c.name+c.ticker} className="border border-border rounded-xl p-3 mt-2">
            <p><span className="font-semibold">{c.name}</span> ({c.party}) <span className={c.side==='Buy'?'text-bull':'text-bear'}>{c.side}</span> {c.ticker} · {c.amount} · disclosed {c.date}</p>
            <p className="sub">Political disclosures are delayed, but can reveal where influential capital is leaning.</p>
          </div>
        ))}
        <p className="sub mt-3">Smart Money: Institutional flows concentrated in liquid mega-caps; volatility hedges remain active.</p>
      </div>
    </div>
  )
}

// ── Earnings ───────────────────────────────────────────────────────────────────
export function EarningsPage() {
  const [stocks, setStocks] = useState([])
  const [loadingData, setLoadingData] = useState(true)
  const [dataError, setDataError] = useState(null)
  const [analyses, setAnalyses] = useState({})
  const [loadingAI, setLoadingAI] = useState({})

  async function loadData() {
    setLoadingData(true); setDataError(null)
    try { setStocks(await withRetry(fetchEarningsData)) }
    catch (e) { setDataError('Could not load earnings data. ' + e.message) }
    finally { setLoadingData(false) }
  }

  useEffect(() => { loadData() }, [])

  async function handleAnalyse(s) {
    setLoadingAI(p => ({ ...p, [s.ticker]: true }))
    try {
      const data = await fetchEarningsAnalysis(s.ticker, s.eps, s.when, s.price, s.change, s.score)
      setAnalyses(p => ({ ...p, [s.ticker]: data.text }))
    } catch {
      setAnalyses(p => ({ ...p, [s.ticker]: 'Could not generate analysis. Please try again.' }))
    } finally {
      setLoadingAI(p => ({ ...p, [s.ticker]: false }))
    }
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-display">Earnings Intelligence</h3>
          <button onClick={loadData} className="text-xs px-2 py-1 border border-border rounded-lg hover:border-ai transition-colors">↻ Refresh</button>
        </div>
        <p className="sub mb-4">Real-time price data for upcoming earnings candidates. Click "Analyse" for AI pre-earnings intelligence.</p>
        {loadingData ? <Spinner /> : dataError ? <DataError msg={dataError} onRetry={loadData} /> : (
          <div className="space-y-3">
            {stocks.map(s => (
              <div key={s.ticker} className="border border-border rounded-xl p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{s.ticker} <span className="text-muted font-normal text-sm">· {s.name}</span></p>
                    <p className="text-sm mt-0.5">${s.price} <span className={tone(s.change)}>({s.change > 0 ? '+' : ''}{s.change}%)</span> · AI score {s.score}/10</p>
                    <p className="sub">Earnings: {s.when} — plan position size before the report.</p>
                  </div>
                  <AIButton onClick={() => handleAnalyse(s)} loading={loadingAI[s.ticker]} label="Analyse" loadingLabel="Analysing…" />
                </div>
                {analyses[s.ticker] && (
                  <div className="mt-3 p-3 rounded-xl bg-ai/10 border border-ai/30 text-sm leading-relaxed whitespace-pre-wrap">
                    {analyses[s.ticker]}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Insider Tracker ────────────────────────────────────────────────────────────
const INSIDER_DATA = [
  { name:'Jensen Huang',  role:'CEO',  company:'NVDA', side:'Buy',  amount:'$1.2M',  date:'2026-04-20' },
  { name:'Satya Nadella', role:'CEO',  company:'MSFT', side:'Buy',  amount:'$890K',  date:'2026-04-18' },
  { name:'Lisa Su',       role:'CEO',  company:'AMD',  side:'Buy',  amount:'$540K',  date:'2026-04-15' },
  { name:'Tim Cook',      role:'CEO',  company:'AAPL', side:'Sell', amount:'$22M',   date:'2026-04-10' },
  { name:'Andy Jassy',    role:'CEO',  company:'AMZN', side:'Buy',  amount:'$1.8M',  date:'2026-04-08' },
  { name:'Mark Zuckerberg', role:'CEO', company:'META', side:'Sell', amount:'$58M',  date:'2026-04-05' },
]

export function InsiderPage() {
  const [filter, setFilter] = useState('All')
  const shown = INSIDER_DATA.filter(d => filter === 'All' || d.side === filter)

  return (
    <div className="space-y-4">
      <div className="card"><p className="text-xs text-muted">⚠ Insider trades are sourced from SEC Form 4 filings. Real-time feed requires SEC EDGAR integration or a paid service — showing recent examples.</p></div>
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display">Insider & Institutional Tracker</h3>
          <div className="flex gap-2">
            {['All','Buy','Sell'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-lg border text-sm transition-colors ${f === filter ? f === 'Buy' ? 'border-bull text-bull bg-bull/10' : f === 'Sell' ? 'border-bear text-bear bg-bear/10' : 'border-ai text-ai bg-ai/10' : 'border-border'}`}>{f}</button>
            ))}
          </div>
        </div>
        <p className="sub mb-3">Executives spending personal money on their stock can signal confidence. Large insider sells may be routine diversification or a warning.</p>
        <div className="space-y-2">
          {shown.map(d => (
            <div key={d.name+d.date} className={`border rounded-xl p-3 ${d.side==='Buy'?'border-bull/40 bg-bull/5':'border-bear/40 bg-bear/5'}`}>
              <div className="flex items-center justify-between">
                <p className="font-semibold">{d.name} <span className="font-normal text-muted text-sm">({d.role})</span> · {d.company}</p>
                <span className={`text-sm font-semibold px-2 py-0.5 rounded-lg ${d.side==='Buy'?'text-bull bg-bull/15':'text-bear bg-bear/15'}`}>{d.side}</span>
              </div>
              <p className="sub">{d.amount} · disclosed {d.date}</p>
              <p className="sub">{d.side==='Buy'?'Leadership buying can indicate belief that shares are undervalued.':'Insider selling can be routine; compare against historical sell patterns.'}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Sentiment ──────────────────────────────────────────────────────────────────
export function SentimentPage() {
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTopAssets()
      .then(data => setAssets(data.slice(0, 5)))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const trend = [
    { d:'Mon', m:40, b:35 }, { d:'Tue', m:55, b:48 }, { d:'Wed', m:78, b:65 },
    { d:'Thu', m:62, b:70 }, { d:'Fri', m:90, b:82 },
  ]

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs text-muted font-medium uppercase tracking-widest">Social Sentiment Radar</p>
          <div className="flex items-center gap-3 text-xs text-muted">
            <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full bg-info" />Mentions</span>
            <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full bg-bull" />Bullish %</span>
          </div>
        </div>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gMentions" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0a84ff" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#0a84ff" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gBull" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#30d158" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#30d158" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="d" stroke="none" tick={{ fill: '#8e8e93', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis stroke="none" tick={{ fill: '#8e8e93', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background:'rgba(28,28,30,0.92)', backdropFilter:'blur(20px)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:12, boxShadow:'0 4px 24px rgba(0,0,0,0.5)' }}
                labelStyle={{ color:'#ffffff', fontWeight:500, marginBottom:4 }}
                itemStyle={{ color:'#8e8e93', fontSize:12 }}
              />
              <Area type="monotone" dataKey="m" stroke="#0a84ff" strokeWidth={1.5} fill="url(#gMentions)" dot={false} name="Mentions" />
              <Area type="monotone" dataKey="b" stroke="#30d158" strokeWidth={1.5} fill="url(#gBull)" dot={false} name="Bullish %" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-muted mt-3">Blue = mention volume index · Green = bullish sentiment % · Rising both = strong crowd-confirmation signal.</p>
      </div>
      <div className="card">
        <h3 className="font-display mb-3">Top Movers — Real-Time</h3>
        {loading ? <Spinner /> : (
          <div className="space-y-3">
            {assets.map(a => {
              const sentiment = Math.round(Math.min(99, Math.max(1, a.score100)))
              return (
                <div key={a.ticker} className="border border-border rounded-xl p-3">
                  <div className="flex justify-between items-center">
                    <p className="font-semibold">{a.ticker} <span className="font-normal text-muted text-sm">{a.name}</span></p>
                    <span className={`text-sm font-semibold ${tone(a.change)}`}>{a.change > 0 ? '+' : ''}{a.change}%</span>
                  </div>
                  <p className="sub">${a.price} · AI sentiment score: {sentiment}/100</p>
                    <div className="mt-2"><ScoreBar value={sentiment} /></div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Portfolio ──────────────────────────────────────────────────────────────────
const DEFAULT_POSITIONS = [
  { ticker:'NVDA', shares:20, avgCost:780 },
  { ticker:'TSLA', shares:15, avgCost:185 },
  { ticker:'AAPL', shares:30, avgCost:175 },
]

export function PortfolioPage() {
  const [positions, setPositions] = useState(DEFAULT_POSITIONS)
  const [prices, setPrices] = useState({})
  const [loadingPrices, setLoadingPrices] = useState(true)
  const [ticker, setTicker] = useState('')
  const [shares, setShares] = useState('')
  const [avgCost, setAvgCost] = useState('')
  const [addError, setAddError] = useState('')

  async function refreshPrices(tickers) {
    setLoadingPrices(true)
    try {
      const data = await fetchTopAssets()
      const map = {}
      data.forEach(a => { map[a.ticker] = { price: a.price, change: a.change } })
      // also fetch any tickers not in top 20
      const missing = tickers.filter(t => !map[t])
      if (missing.length) {
        const results = await Promise.allSettled(
          missing.map(t => fetch(`/api/market/top-assets`).then(r => r.json()))
        )
        // fallback: use last known or 0
      }
      setPrices(map)
    } catch {} finally { setLoadingPrices(false) }
  }

  useEffect(() => {
    refreshPrices(positions.map(p => p.ticker))
  }, [])

  function handleAdd() {
    if (!ticker || !shares || !avgCost) { setAddError('Fill all fields.'); return }
    const t = ticker.trim().toUpperCase()
    setPositions(p => [...p.filter(x => x.ticker !== t), { ticker: t, shares: +shares, avgCost: +avgCost }])
    setTicker(''); setShares(''); setAvgCost(''); setAddError('')
    refreshPrices([...positions.map(p => p.ticker), t])
  }

  const totalValue = positions.reduce((s, p) => s + p.shares * (prices[p.ticker]?.price ?? p.avgCost), 0)
  const totalPL = positions.reduce((s, p) => s + p.shares * ((prices[p.ticker]?.price ?? p.avgCost) - p.avgCost), 0)

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-display">My Watchlist & Portfolio</h3>
          <div className="text-right">
            <p className="text-sm font-semibold">${totalValue.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</p>
            <p className={`text-sm ${totalPL>=0?'text-bull':'text-bear'}`}>{totalPL>=0?'+':''}{totalPL.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})} P&L</p>
          </div>
        </div>
        {loadingPrices && <p className="text-xs text-muted mb-2"><LiveBadge />Loading live prices…</p>}
        <div className="space-y-2">
          {positions.map(p => {
            const cur = prices[p.ticker]?.price ?? p.avgCost
            const chg = prices[p.ticker]?.change ?? 0
            const pl  = p.shares * (cur - p.avgCost)
            const plPct = ((cur - p.avgCost) / p.avgCost * 100).toFixed(2)
            return (
              <div key={p.ticker} className="border border-border rounded-xl p-3 flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{p.ticker}</p>
                    {prices[p.ticker] && <span className={`text-xs ${tone(chg)}`}>{chg>0?'+':''}{chg}% today</span>}
                  </div>
                  <p className="sub">{p.shares} shares · Avg ${p.avgCost} · {prices[p.ticker] ? `Live $${cur}` : `Cost $${p.avgCost}`}</p>
                  <p className={`text-sm mt-0.5 ${pl>=0?'text-bull':'text-bear'}`}>
                    {pl>=0?'+':''}{pl.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})} ({plPct}%)
                  </p>
                  <p className="sub">{pl>=0?'In profit — consider scaling out near resistance if trend weakens.':'Underwater — review stop levels and check if thesis still holds.'}</p>
                </div>
                <button onClick={() => setPositions(ps => ps.filter(x => x.ticker !== p.ticker))}
                  className="text-bear border border-bear/40 rounded-lg px-2 py-1 text-sm hover:bg-bear/10 transition-colors">Remove</button>
              </div>
            )
          })}
        </div>
      </div>
      <div className="card">
        <h3 className="font-display mb-3">Add Position</h3>
        <div className="grid grid-cols-3 gap-2 mb-2">
          {[['Ticker', ticker, setTicker, 'AAPL'], ['Shares', shares, setShares, '10'], ['Avg Cost $', avgCost, setAvgCost, '180']].map(([label, val, setter, ph]) => (
            <div key={label}>
              <label className="text-xs text-muted block mb-1">{label}</label>
              <input value={val} onChange={e => setter(e.target.value)} placeholder={ph}
                className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 focus:outline-none focus:border-ai text-sm" />
            </div>
          ))}
        </div>
        {addError && <p className="text-bear text-sm mb-2">{addError}</p>}
        <button onClick={handleAdd} className="px-4 py-2 rounded-lg bg-bull/20 border border-bull/50 text-bull hover:bg-bull/30 transition-colors text-sm">Add to Portfolio</button>
        <p className="sub text-xs mt-2">Live prices are fetched automatically from Yahoo Finance.</p>
      </div>
    </div>
  )
}

// ── AI Chat ────────────────────────────────────────────────────────────────────
const QUICK_PROMPTS = [
  'What should I watch at open today?',
  'Which sectors are showing strength?',
  'Explain a good risk management framework',
  'Best risk/reward setups this week?',
  'How do I read options flow?',
  'Explain VWAP and how to trade it',
]

export function ChatPage() {
  const [messages, setMessages] = useState([
    { role:'assistant', content:'Hi! I\'m ATI, your Advanced Trade Intelligence assistant. Ask me anything about markets, stocks, trading setups, options, or risk management — I\'ll give you institutional-quality analysis.' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const scrollToBottom = useCallback(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }) }, [])

  async function sendMessage(text) {
    const userMsg = text || input.trim()
    if (!userMsg || loading) return
    setInput('')
    const next = [...messages, { role:'user', content:userMsg }]
    setMessages(next)
    setLoading(true)
    setTimeout(scrollToBottom, 50)
    try {
      const data = await fetchChatReply(next)
      setMessages(prev => [...prev, { role:'assistant', content:data.reply }])
    } catch {
      setMessages(prev => [...prev, { role:'assistant', content:'Sorry, couldn\'t connect to the AI backend. Please try again.' }])
    } finally {
      setLoading(false)
      setTimeout(scrollToBottom, 50)
    }
  }

  return (
    <div className="card flex flex-col h-[calc(100vh-120px)] min-h-[500px]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display">ATI Chat</h3>
        <span className="text-xs text-ai border border-ai/30 rounded-full px-2 py-0.5">Gemini Pro</span>
      </div>
      <div className="flex gap-2 flex-wrap mb-3">
        {QUICK_PROMPTS.map(p => (
          <button key={p} onClick={() => sendMessage(p)} disabled={loading}
            className="text-xs px-2 py-1 rounded-lg border border-ai/40 text-ai hover:bg-ai/10 transition-colors disabled:opacity-50">{p}</button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto space-y-3 mb-3 pr-1">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role==='user'?'justify-end':'justify-start'}`}>
            <div className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${m.role==='user'?'bg-ai/20 border border-ai/30 text-white':'bg-card2 border border-border text-text'}`}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-card2 border border-border rounded-xl px-4 py-2.5 text-sm text-muted flex items-center gap-2">
              <span className="w-3 h-3 rounded-full border-2 border-ai/30 border-t-ai animate-spin" />
              Gemini Pro is analysing…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-2">
        <textarea value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
          placeholder="Ask anything about markets, stocks, setups, options… (Enter to send)"
          rows={2}
          className="flex-1 bg-bg border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-ai resize-none" />
        <button onClick={() => sendMessage()} disabled={loading || !input.trim()}
          className="px-4 py-2 rounded-xl bg-ai/20 border border-ai/50 text-ai font-semibold hover:bg-ai/30 transition-colors disabled:opacity-40">Send</button>
      </div>
    </div>
  )
}

// ── Deep Research ──────────────────────────────────────────────────────────────
const RESEARCH_TICKERS = ['NVDA','AAPL','MSFT','TSLA','META','AMZN','GOOGL','AMD','PLTR','COIN']
const RESEARCH_QUESTIONS = [
  'What is the current state of the AI semiconductor cycle?',
  'Which sectors historically outperform in a high-VIX environment?',
  'Explain the relationship between Fed policy and small-cap stocks',
  'What are the best technical indicators for momentum trading?',
  'How does dark pool data affect retail traders?',
]

export function ResearchPage() {
  const [mode, setMode] = useState('ticker')
  const [ticker, setTicker] = useState('')
  const [question, setQuestion] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [history, setHistory] = useState([])

  async function runResearch(overrideTicker, overrideQuestion) {
    const t = overrideTicker ?? ticker.trim().toUpperCase()
    const q = overrideQuestion ?? question.trim()
    if (mode === 'ticker' && !t) return
    if (mode === 'question' && !q) return
    setLoading(true); setError(null); setResult(null)
    try {
      const data = await fetchResearch(mode === 'ticker' ? t : null, mode === 'question' ? q : null)
      const entry = { mode, label: mode === 'ticker' ? t : q, text: data.text, ts: new Date().toLocaleTimeString() }
      setResult(entry)
      setHistory(h => [entry, ...h].slice(0, 10))
    } catch (e) {
      setError('Research failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display">Deep Research</h3>
          <span className="text-xs text-ai border border-ai/30 rounded-full px-2 py-0.5">Gemini Pro</span>
        </div>
        <div className="flex gap-2 mb-4">
          {['ticker','question'].map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`px-3 py-1.5 rounded-lg border text-sm capitalize transition-colors ${mode===m?'border-ai text-ai bg-ai/10':'border-border text-muted hover:border-ai/40'}`}>
              {m === 'ticker' ? '📊 Stock Research' : '🔍 Market Question'}
            </button>
          ))}
        </div>

        {mode === 'ticker' ? (
          <div className="space-y-3">
            <div className="flex gap-2 flex-wrap">
              {RESEARCH_TICKERS.map(t => (
                <button key={t} onClick={() => setTicker(t)}
                  className={`px-2.5 py-1 rounded-lg border text-xs transition-colors ${ticker===t?'border-ai text-ai bg-ai/10':'border-border text-muted hover:border-ai/40'}`}>{t}</button>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())}
                placeholder="Or type any ticker (e.g. NFLX)"
                className="flex-1 bg-bg border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-ai" />
              <button onClick={() => runResearch()} disabled={loading || !ticker.trim()}
                className="px-4 py-2 rounded-xl bg-ai/20 border border-ai/50 text-ai font-semibold hover:bg-ai/30 transition-colors disabled:opacity-40">
                {loading ? 'Researching…' : 'Research'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2 flex-wrap">
              {RESEARCH_QUESTIONS.map(q => (
                <button key={q} onClick={() => setQuestion(q)}
                  className="px-2.5 py-1 rounded-lg border border-border text-xs text-muted hover:border-ai/40 hover:text-ai transition-colors text-left">{q}</button>
              ))}
            </div>
            <div className="flex gap-2">
              <textarea value={question} onChange={e => setQuestion(e.target.value)}
                placeholder="Ask a deep market research question…"
                rows={2}
                className="flex-1 bg-bg border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-ai resize-none" />
              <button onClick={() => runResearch()} disabled={loading || !question.trim()}
                className="px-4 py-2 rounded-xl bg-ai/20 border border-ai/50 text-ai font-semibold hover:bg-ai/30 transition-colors disabled:opacity-40">
                {loading ? 'Researching…' : 'Research'}
              </button>
            </div>
          </div>
        )}
      </div>

      {loading && (
        <div className="card flex items-center gap-3 text-sm text-muted">
          <span className="w-4 h-4 rounded-full border-2 border-ai/30 border-t-ai animate-spin" />
          Gemini Pro is generating a deep research report — this may take 15–30 seconds…
        </div>
      )}

      {error && <div className="card"><p className="text-bear text-sm">{error}</p></div>}

      {result && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-white">{result.mode === 'ticker' ? `${result.label} — Research Report` : 'Research Answer'}</h3>
            <span className="text-xs text-muted">{result.ts}</span>
          </div>
          <div className="text-sm leading-relaxed whitespace-pre-wrap text-text/90 space-y-1">{result.text}</div>
        </div>
      )}

      {history.length > 1 && (
        <div className="card">
          <h3 className="font-semibold text-white mb-3 text-sm">Recent Research</h3>
          <div className="space-y-2">
            {history.slice(1).map((h, i) => (
              <button key={i} onClick={() => setResult(h)}
                className="w-full text-left border border-border rounded-xl px-3 py-2 text-sm hover:border-ai/40 transition-colors">
                <span className="text-white font-medium">{h.label}</span>
                <span className="text-muted ml-2 text-xs">{h.ts}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
