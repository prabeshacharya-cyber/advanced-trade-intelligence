import { cacheGet, cacheSet, TTL } from '../services/cacheService.js'
import { canCall, trackCall, trackError } from '../services/apiBudgetService.js'

// FMP moved to /stable/ endpoints in Aug 2025 — v3 is legacy/premium-only
const BASE = 'https://financialmodelingprep.com/stable'
const KEY  = () => process.env.FMP_API_KEY

const meta = (extras = {}) => ({
  source: 'FMP', isRealData: true, isDemo: false, isStale: false,
  asOf: new Date().toISOString(), providerStatus: 'ok',
  missingFields: [], notes: [], ...extras,
})

async function fmpFetch(path) {
  if (!KEY()) return null
  if (!canCall('fmp', 5)) return null
  trackCall('fmp')
  const sep = path.includes('?') ? '&' : '?'
  const r = await fetch(`${BASE}${path}${sep}apikey=${KEY()}`)
  if (!r.ok) throw new Error(`FMP ${r.status} ${path}`)
  const data = await r.json()
  // Detect new legacy error message
  if (data?.['Error Message'] || data?.error) return null
  return data
}

export async function getQuote(symbol) {
  if (!KEY()) return null
  const cached = cacheGet('fmp', `q_${symbol}`)
  if (cached) return cached
  try {
    const data = await fmpFetch(`/profile?symbol=${symbol}`)
    const q = Array.isArray(data) ? data[0] : data
    if (!q?.price) return null
    const result = {
      symbol, price: q.price,
      change_percent: q.changePercentage,
      volume: q.volume, avg_volume: q.averageVolume,
      market_cap: q.marketCap, beta: q.beta,
      fifty_two_week_high: q.range?.split('-')?.[1],
      fifty_two_week_low:  q.range?.split('-')?.[0],
      ...meta(),
    }
    cacheSet('fmp', `q_${symbol}`, result, TTL.quotes)
    return result
  } catch (e) {
    trackError('fmp', 'getQuote', e.message)
    return null
  }
}

export async function getIncomeStatement(symbol, limit = 2) {
  if (!KEY()) return null
  const cached = cacheGet('fmp', `income_${symbol}`)
  if (cached) return cached
  try {
    const data = await fmpFetch(`/income-statement?symbol=${symbol}&limit=${limit}`)
    if (!Array.isArray(data) || !data.length) return null
    const result = {
      symbol,
      statements: data.map(s => ({
        date: s.date, revenue: s.revenue, grossProfit: s.grossProfit,
        operatingIncome: s.operatingIncome, netIncome: s.netIncome,
        eps: s.eps, ebitda: s.ebitda,
        grossMargin: s.revenue ? s.grossProfit / s.revenue : null,
        netMargin:   s.revenue ? s.netIncome   / s.revenue : null,
      })),
      ...meta(),
    }
    cacheSet('fmp', `income_${symbol}`, result, TTL.secFundamentals)
    return result
  } catch (e) {
    trackError('fmp', 'getIncomeStatement', e.message)
    return null
  }
}

export async function getNews(symbol, limit = 10) {
  if (!KEY()) return null
  const cached = cacheGet('fmp', `news_${symbol}`)
  if (cached) return cached
  try {
    const data = await fmpFetch(`/news/stock?symbol=${symbol}&limit=${limit}`)
    if (!Array.isArray(data)) return null
    const result = {
      symbol,
      items: data.map(n => ({
        headline: n.title, summary: n.text?.slice(0, 300), url: n.url,
        source: n.site, published_at: n.publishedDate,
      })),
      ...meta(),
    }
    cacheSet('fmp', `news_${symbol}`, result, TTL.news)
    return result
  } catch (e) {
    trackError('fmp', 'getNews', e.message)
    return null
  }
}

export function isConfigured() { return !!KEY() }
