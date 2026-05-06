// Provider Manager — routes data requests to the best available source
// Priority: configured API keys → public free sources (FINRA, RSS, SEC) → Yahoo fallback
import * as sec    from './secProvider.js'
import * as av     from './alphaVantageProvider.js'
import * as fh     from './finnhubProvider.js'
import * as fmp    from './fmpProvider.js'
import * as fred   from './fredProvider.js'
import * as finra  from './finraProvider.js'
import * as nasdaq from './nasdaqRssProvider.js'
import * as rss    from './rssNewsProvider.js'
import * as yahoo  from './yahooFallbackProvider.js'

/** Safely call a provider function that may return null or a Promise */
async function tryProvider(fn) {
  try {
    const result = fn()
    if (result == null) return null
    return await Promise.resolve(result)
  } catch { return null }
}

// ─── Quotes ───────────────────────────────────────────────────────────────────
export async function getQuote(symbol) {
  const providers = [
    () => fh.isConfigured()  ? fh.getQuote(symbol)  : null,
    () => fmp.isConfigured() ? fmp.getQuote(symbol) : null,
    () => av.isConfigured()  ? av.getQuote(symbol)  : null,
    () => yahoo.getQuote(symbol),
  ]
  for (const fn of providers) {
    const r = await tryProvider(fn)
    if (r?.price) return r
  }
  return null
}

// ─── Price History ─────────────────────────────────────────────────────────────
export async function getPriceHistory(symbol, days = 100) {
  const providers = [
    () => av.isConfigured() ? av.getDailyPrices(symbol) : null,
    () => yahoo.getHistory(symbol, days),
  ]
  for (const fn of providers) {
    const r = await tryProvider(fn)
    if (r?.history?.length) return r
  }
  return null
}

// ─── News ──────────────────────────────────────────────────────────────────────
export async function getNews(symbol) {
  const providers = [
    () => av.isConfigured()  ? av.getNews(symbol)        : null,
    () => fh.isConfigured()  ? fh.getCompanyNews(symbol) : null,
    () => fmp.isConfigured() ? fmp.getNews(symbol)       : null,
    () => rss.getMarketNews(15),
  ]
  for (const fn of providers) {
    const r = await tryProvider(fn)
    if (r?.items?.length) return r
  }
  return { symbol, items: [] }
}

// ─── Market News (no symbol) ──────────────────────────────────────────────────
export async function getMarketNews() {
  const r = await tryProvider(() => rss.getMarketNews())
  return r?.items?.length ? r : { items: [] }
}

// ─── SEC Filings ───────────────────────────────────────────────────────────────
export async function getFilings(symbol) {
  const r = await tryProvider(() => sec.getRecentFilings(symbol))
  return r || { symbol, filings: [] }
}

// ─── SEC Company Facts ────────────────────────────────────────────────────────
export async function getCompanyFacts(symbol) {
  const r = await tryProvider(() => sec.getCompanyFacts(symbol))
  return r || { symbol, facts: {} }
}

// ─── Fundamentals ─────────────────────────────────────────────────────────────
export async function getFundamentals(symbol) {
  const [secRes, fmpRes] = await Promise.allSettled([
    getCompanyFacts(symbol),
    fmp.isConfigured() ? fmp.getIncomeStatement(symbol) : Promise.resolve(null),
  ])
  return {
    sec: secRes.status === 'fulfilled' ? secRes.value : { facts: {} },
    fmp: fmpRes.status === 'fulfilled' ? fmpRes.value : null,
  }
}

// ─── Macro ────────────────────────────────────────────────────────────────────
export async function getMacro() {
  const r = await tryProvider(() => fred.getMacroSnapshot())
  return r?.data ? r : { data: {} }
}

// ─── Short Volume ─────────────────────────────────────────────────────────────
export async function getShortVolume(symbol) {
  const r = await tryProvider(() => finra.getShortVolume(symbol))
  return r || { symbol, short_volume: null, total_volume: null, short_volume_ratio: null,
    providerStatus: 'unavailable', notes: ['FINRA short-sale data unavailable'] }
}

// ─── Trade Halts ─────────────────────────────────────────────────────────────
export async function getTradeHalts() {
  const r = await tryProvider(() => nasdaq.getTradeHalts())
  return r || { halts: [], count: 0 }
}

// ─── Provider Status Report ──────────────────────────────────────────────────
export function getProviderStatus() {
  return {
    sec:           { configured: true,               note: 'No key required — polite User-Agent used' },
    alpha_vantage: { configured: av.isConfigured(),  note: av.isConfigured()  ? 'Key set' : 'Set ALPHA_VANTAGE_API_KEY (free at alphavantage.co)' },
    finnhub:       { configured: fh.isConfigured(),  note: fh.isConfigured()  ? 'Key set' : 'Set FINNHUB_API_KEY (free at finnhub.io)' },
    fmp:           { configured: fmp.isConfigured(), note: fmp.isConfigured() ? 'Key set' : 'Set FMP_API_KEY (free at financialmodelingprep.com)' },
    fred:          { configured: fred.isConfigured(),note: fred.isConfigured()? 'Key set' : 'Set FRED_API_KEY (free at fred.stlouisfed.org)' },
    finra:         { configured: true,               note: 'Public short-sale data (no key required)' },
    nasdaq_rss:    { configured: true,               note: 'Public trade halt RSS feed (no key required)' },
    rss:           { configured: true,               note: 'Public RSS market news (no key required)' },
    yahoo:         { configured: true,               note: 'Quote + price history fallback (no key required)' },
    gemini:        { configured: !!process.env.GEMINI_API_KEY, note: process.env.GEMINI_API_KEY ? 'AI research enabled' : 'Set GEMINI_API_KEY for AI research (free tier at ai.google.dev)' },
  }
}

export function getMissingOptionalKeys() {
  const missing = []
  if (!av.isConfigured())   missing.push({ key: 'ALPHA_VANTAGE_API_KEY', impact: 'Quotes, OHLCV history, news sentiment', url: 'https://www.alphavantage.co/support/#api-key' })
  if (!fh.isConfigured())   missing.push({ key: 'FINNHUB_API_KEY',       impact: 'Real-time quotes, company news',        url: 'https://finnhub.io' })
  if (!fmp.isConfigured())  missing.push({ key: 'FMP_API_KEY',            impact: 'Income statements, margins, EPS',       url: 'https://financialmodelingprep.com' })
  if (!fred.isConfigured()) missing.push({ key: 'FRED_API_KEY',           impact: 'Macro: Fed funds, CPI, yields',         url: 'https://fred.stlouisfed.org/docs/api/api_key.html' })
  if (!process.env.GEMINI_API_KEY) missing.push({ key: 'GEMINI_API_KEY',  impact: 'AI research summaries + commentary',    url: 'https://ai.google.dev' })
  return missing
}
