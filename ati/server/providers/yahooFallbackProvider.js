// Yahoo Finance fallback — unofficial, clearly labeled
// Only used when ENABLE_YAHOO_FALLBACK=true and no other provider succeeds
import { cacheGet, cacheSet, TTL } from '../services/cacheService.js'
import { trackCall, trackError } from '../services/apiBudgetService.js'

const ENABLED = () => process.env.ENABLE_YAHOO_FALLBACK !== 'false'

const meta = (extras = {}) => ({
  source: 'Yahoo Finance (unofficial fallback)',
  isRealData: true, isDemo: false, isStale: false,
  asOf: new Date().toISOString(), providerStatus: 'ok',
  missingFields: [],
  notes: ['Yahoo Finance is an unofficial fallback. Data accuracy not guaranteed.'],
  ...extras,
})

export async function getQuote(symbol) {
  if (!ENABLED()) return null
  const cached = cacheGet('yahoo', `q_${symbol}`)
  if (cached) return cached
  try {
    trackCall('yahoo')
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    if (!r.ok) throw new Error(`Yahoo ${r.status}`)
    const j = await r.json()
    const q = j?.chart?.result?.[0]
    if (!q) return null
    const m = q.meta
    const prevClose = m.previousClose ?? m.chartPreviousClose ?? null
    const chgPct = m.regularMarketChangePercent != null
      ? m.regularMarketChangePercent
      : (prevClose && m.regularMarketPrice)
          ? ((m.regularMarketPrice - prevClose) / prevClose * 100)
          : null
    const result = {
      symbol, price: m.regularMarketPrice,
      change_percent: (chgPct != null && !isNaN(chgPct)) ? chgPct : null,
      volume: m.regularMarketVolume,
      fifty_two_week_high: m.fiftyTwoWeekHigh,
      fifty_two_week_low:  m.fiftyTwoWeekLow,
      market_cap: m.marketCap,
      prev_close: prevClose,
      ...meta(),
    }
    cacheSet('yahoo', `q_${symbol}`, result, TTL.quotes)
    return result
  } catch (e) {
    trackError('yahoo', 'getQuote', e.message)
    return null
  }
}

export async function getHistory(symbol, days = 100) {
  if (!ENABLED()) return null
  const cached = cacheGet('yahoo', `hist_${symbol}`)
  if (cached) return cached
  try {
    trackCall('yahoo')
    const range = days > 365 ? '2y' : days > 60 ? '1y' : '3mo'
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=${range}`
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    if (!r.ok) throw new Error(`Yahoo hist ${r.status}`)
    const j = await r.json()
    const res = j?.chart?.result?.[0]
    if (!res?.timestamps) return null
    const history = res.timestamps.map((ts, i) => ({
      date: new Date(ts * 1000).toISOString().slice(0, 10),
      close: res.indicators?.adjclose?.[0]?.adjclose?.[i] ?? res.indicators?.quote?.[0]?.close?.[i],
      volume: res.indicators?.quote?.[0]?.volume?.[i],
    })).filter(d => d.close)
    const result = { symbol, history, ...meta() }
    cacheSet('yahoo', `hist_${symbol}`, result, TTL.priceHistory)
    return result
  } catch (e) {
    trackError('yahoo', 'getHistory', e.message)
    return null
  }
}
