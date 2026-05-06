import getDb from '../db/index.js'
import { getNews, getMarketNews } from '../providers/providerManager.js'
import { enrichNewsItem } from './eventClassifierService.js'

export async function fetchAndStoreNews(symbol) {
  const result = await getNews(symbol)
  if (!result?.items?.length) return []
  const db = getDb()
  const insert = db.prepare(`
    INSERT OR IGNORE INTO news_events
      (symbol, headline, summary, url, source, published_at, event_type, sentiment, magnitude, confidence, is_demo)
    VALUES (@symbol, @headline, @summary, @url, @source, @published_at, @event_type, @sentiment, @magnitude, @confidence, @is_demo)
  `)
  const enriched = result.items.map(item => {
    const e = enrichNewsItem(item)
    return {
      symbol,
      headline:     e.headline || '',
      summary:      e.summary  || '',
      url:          e.url      || '',
      source:       e.source   || result.source || 'Unknown',
      published_at: e.published_at || new Date().toISOString(),
      event_type:   e.event_type   || 'general_news',
      sentiment:    e.sentiment    || 'neutral',
      magnitude:    e.magnitude    || 'low',
      confidence:   e.confidence   || 50,
      is_demo:      0,
    }
  })
  db.transaction(() => enriched.forEach(r => insert.run(r)))()
  return enriched
}

export async function fetchMarketNews() {
  const result = await getMarketNews()
  const db = getDb()
  const insert = db.prepare(`
    INSERT OR IGNORE INTO news_events
      (symbol, headline, summary, url, source, published_at, event_type, sentiment, magnitude, confidence, is_demo)
    VALUES (@symbol, @headline, @summary, @url, @source, @published_at, @event_type, @sentiment, @magnitude, @confidence, @is_demo)
  `)
  const enriched = (result?.items || []).map(item => ({
    symbol:       null,
    headline:     item.headline || '',
    summary:      item.summary  || '',
    url:          item.url      || '',
    source:       item.source   || 'RSS',
    published_at: item.published_at || new Date().toISOString(),
    event_type:   'market_news',
    sentiment:    'neutral',
    magnitude:    'low',
    confidence:   40,
    is_demo:      0,
  }))
  db.transaction(() => enriched.forEach(r => insert.run(r)))()
  return enriched
}

export function getRecentNews(symbol, limit = 20) {
  return getDb().prepare(
    'SELECT * FROM news_events WHERE symbol=? ORDER BY published_at DESC LIMIT ?'
  ).all(symbol, limit)
}

export function getMarketNewsFromDb(limit = 40) {
  return getDb().prepare(
    'SELECT * FROM news_events WHERE symbol IS NULL ORDER BY published_at DESC LIMIT ?'
  ).all(limit)
}

export function getBullishEvents(symbol, days = 30) {
  const since = new Date(Date.now() - days * 86400000).toISOString()
  return getDb().prepare(
    "SELECT * FROM news_events WHERE symbol=? AND sentiment IN ('bullish','slightly_bullish') AND published_at >= ? ORDER BY published_at DESC"
  ).all(symbol, since)
}

export function getBearishEvents(symbol, days = 30) {
  const since = new Date(Date.now() - days * 86400000).toISOString()
  return getDb().prepare(
    "SELECT * FROM news_events WHERE symbol=? AND sentiment IN ('bearish','slightly_bearish') AND published_at >= ? ORDER BY published_at DESC"
  ).all(symbol, since)
}
