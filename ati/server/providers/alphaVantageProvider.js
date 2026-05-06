import { cacheGet, cacheSet, TTL } from '../services/cacheService.js'
import { canCall, trackCall, trackError } from '../services/apiBudgetService.js'

const BASE = 'https://www.alphavantage.co/query'
const KEY  = () => process.env.ALPHA_VANTAGE_API_KEY

const meta = (extras = {}) => ({
  source: 'Alpha Vantage', isRealData: true, isDemo: false, isStale: false,
  asOf: new Date().toISOString(), providerStatus: 'ok',
  missingFields: [], notes: [], ...extras,
})

async function avFetch(params) {
  if (!KEY()) return { error: 'no_key' }
  if (!canCall('alpha_vantage', 2)) return { error: 'budget_exhausted' }
  trackCall('alpha_vantage')
  const url = `${BASE}?${new URLSearchParams({ ...params, apikey: KEY() })}`
  const r = await fetch(url)
  if (!r.ok) throw new Error(`AV ${r.status}`)
  return r.json()
}

export async function getQuote(symbol) {
  if (!KEY()) return null
  const cacheKey = `quote_${symbol}`
  const cached = cacheGet('alpha_vantage', cacheKey)
  if (cached) return cached
  try {
    const j = await avFetch({ function: 'GLOBAL_QUOTE', symbol })
    if (j.error) return null
    const q = j['Global Quote']
    if (!q?.['05. price']) return null
    const result = {
      symbol, price: parseFloat(q['05. price']),
      change_percent: parseFloat(q['10. change percent']),
      volume: parseInt(q['06. volume']),
      high: parseFloat(q['03. high']), low: parseFloat(q['04. low']),
      prev_close: parseFloat(q['08. previous close']),
      ...meta(),
    }
    cacheSet('alpha_vantage', cacheKey, result, TTL.quotes)
    return result
  } catch (e) {
    trackError('alpha_vantage', 'getQuote', e.message)
    return null
  }
}

export async function getNews(symbol, limit = 10) {
  if (!KEY()) return null
  const cacheKey = `news_${symbol}`
  const cached = cacheGet('alpha_vantage', cacheKey)
  if (cached) return cached
  try {
    const j = await avFetch({ function: 'NEWS_SENTIMENT', tickers: symbol, limit })
    if (j.error || !j.feed) return null
    const items = (j.feed || []).slice(0, limit).map(n => ({
      headline: n.title, summary: n.summary,
      url: n.url, source: n.source,
      published_at: n.time_published,
      sentiment: n.overall_sentiment_label?.toLowerCase() || 'neutral',
      sentiment_score: n.overall_sentiment_score,
    }))
    const result = { symbol, items, ...meta() }
    cacheSet('alpha_vantage', cacheKey, result, TTL.news)
    return result
  } catch (e) {
    trackError('alpha_vantage', 'getNews', e.message)
    return null
  }
}

export async function getDailyPrices(symbol, outputsize = 'compact') {
  if (!KEY()) return null
  const cacheKey = `daily_${symbol}`
  const cached = cacheGet('alpha_vantage', cacheKey)
  if (cached) return cached
  try {
    const j = await avFetch({ function: 'TIME_SERIES_DAILY', symbol, outputsize })
    if (j.error || !j['Time Series (Daily)']) return null
    const ts = j['Time Series (Daily)']
    const history = Object.entries(ts).slice(0, 100).map(([date, v]) => ({
      date, close: parseFloat(v['4. close']),
      open: parseFloat(v['1. open']), high: parseFloat(v['2. high']),
      low: parseFloat(v['3. low']), volume: parseInt(v['5. volume']),
    })).sort((a, b) => a.date.localeCompare(b.date))
    const result = { symbol, history, ...meta() }
    cacheSet('alpha_vantage', cacheKey, result, TTL.priceHistory)
    return result
  } catch (e) {
    trackError('alpha_vantage', 'getDailyPrices', e.message)
    return null
  }
}

export function isConfigured() { return !!KEY() }
