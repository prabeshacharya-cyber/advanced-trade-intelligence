import { cacheGet, cacheSet, TTL } from '../services/cacheService.js'
import { canCall, trackCall, trackError } from '../services/apiBudgetService.js'

const BASE = 'https://finnhub.io/api/v1'
const KEY  = () => process.env.FINNHUB_API_KEY

const meta = (extras = {}) => ({
  source: 'Finnhub', isRealData: true, isDemo: false, isStale: false,
  asOf: new Date().toISOString(), providerStatus: 'ok',
  missingFields: [], notes: [], ...extras,
})

async function fhFetch(path, params = {}) {
  if (!KEY()) return null
  if (!canCall('finnhub')) return null
  trackCall('finnhub')
  const url = `${BASE}${path}?${new URLSearchParams({ ...params, token: KEY() })}`
  const r = await fetch(url)
  if (!r.ok) throw new Error(`Finnhub ${r.status} ${path}`)
  return r.json()
}

export async function getQuote(symbol) {
  if (!KEY()) return null
  const cached = cacheGet('finnhub', `q_${symbol}`)
  if (cached) return cached
  try {
    const q = await fhFetch('/quote', { symbol })
    if (!q?.c) return null
    const result = {
      symbol, price: q.c, change_percent: q.dp,
      high: q.h, low: q.l, prev_close: q.pc,
      timestamp: new Date(q.t * 1000).toISOString(),
      ...meta(),
    }
    cacheSet('finnhub', `q_${symbol}`, result, TTL.quotes)
    return result
  } catch (e) {
    trackError('finnhub', 'getQuote', e.message)
    return null
  }
}

export async function getCompanyProfile(symbol) {
  if (!KEY()) return null
  const cached = cacheGet('finnhub', `profile_${symbol}`)
  if (cached) return cached
  try {
    const p = await fhFetch('/stock/profile2', { symbol })
    if (!p?.name) return null
    const result = { symbol, name: p.name, exchange: p.exchange, sector: p.finnhubIndustry, market_cap: p.marketCapitalization * 1e6, logo: p.logo, ipo: p.ipo, country: p.country, ...meta() }
    cacheSet('finnhub', `profile_${symbol}`, result, 720)
    return result
  } catch (e) {
    trackError('finnhub', 'getProfile', e.message)
    return null
  }
}

export async function getCompanyNews(symbol, from, to) {
  if (!KEY()) return null
  const cached = cacheGet('finnhub', `news_${symbol}`)
  if (cached) return cached
  try {
    const toDate  = to   || new Date().toISOString().slice(0, 10)
    const fromDate= from || new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
    const items = await fhFetch('/company-news', { symbol, from: fromDate, to: toDate })
    if (!Array.isArray(items)) return null
    const result = {
      symbol,
      items: items.slice(0, 15).map(n => ({
        headline: n.headline, summary: n.summary, url: n.url,
        source: n.source, published_at: new Date(n.datetime * 1000).toISOString(),
      })),
      ...meta(),
    }
    cacheSet('finnhub', `news_${symbol}`, result, TTL.news)
    return result
  } catch (e) {
    trackError('finnhub', 'getNews', e.message)
    return null
  }
}

export function isConfigured() { return !!KEY() }
