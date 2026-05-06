import { cacheGet, cacheSet, TTL } from '../services/cacheService.js'
import { trackCall, trackError } from '../services/apiBudgetService.js'

const RSS_FEEDS = [
  { name: 'Seeking Alpha', url: 'https://seekingalpha.com/market_currents.xml', type: 'market' },
  { name: 'MarketWatch', url: 'https://feeds.marketwatch.com/marketwatch/topstories/', type: 'market' },
  { name: 'Reuters Business', url: 'https://feeds.reuters.com/reuters/businessNews', type: 'market' },
  { name: 'Nasdaq News', url: 'https://www.nasdaq.com/feed/rssoutbound?category=Markets', type: 'market' },
]

const meta = (extras = {}) => ({
  source: 'RSS Feeds', isRealData: true, isDemo: false, isStale: false,
  asOf: new Date().toISOString(), providerStatus: 'ok',
  missingFields: [], notes: [], ...extras,
})

async function fetchRssFeed(feed) {
  trackCall('rss')
  const r = await fetch(feed.url, {
    headers: { 'User-Agent': 'ATI Research / research@ati.dev', 'Accept': 'application/rss+xml,application/xml,text/xml' }
  })
  if (!r.ok) throw new Error(`RSS ${r.status} ${feed.url}`)
  const xml = await r.text()
  return parseRss(xml, feed.name)
}

function parseRss(xml, source) {
  const items = []
  const itemRe = /<item>([\s\S]*?)<\/item>/g
  let m
  while ((m = itemRe.exec(xml)) !== null) {
    const g = (tag) => new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([^<]*)<\\/${tag}>`).exec(m[1])
    const title   = g('title')?.[1] || g('title')?.[2] || ''
    const desc    = g('description')?.[1] || g('description')?.[2] || ''
    const link    = g('link')?.[2]?.trim() || ''
    const pubDate = g('pubDate')?.[2] || ''
    if (!title) continue
    items.push({
      headline: title.trim(), summary: desc.replace(/<[^>]+>/g, '').trim().slice(0, 300),
      url: link, source, published_at: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
    })
  }
  return items
}

export async function getMarketNews(limit = 20) {
  const key = 'market_news'
  const cached = cacheGet('rss', key)
  if (cached) return cached
  try {
    const results = await Promise.allSettled(RSS_FEEDS.slice(0, 3).map(f => fetchRssFeed(f)))
    const items = results
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => r.value)
      .sort((a, b) => new Date(b.published_at) - new Date(a.published_at))
      .slice(0, limit)
    const result = { items, ...meta() }
    cacheSet('rss', key, result, TTL.news)
    return result
  } catch (e) {
    trackError('rss', 'getMarketNews', e.message)
    return { items: [], ...meta({ providerStatus: 'error', notes: [e.message] }) }
  }
}

export function extractTickersFromHeadline(headline) {
  const matches = headline.match(/\b[A-Z]{2,5}\b/g) || []
  const NOISE = new Set(['THE', 'AND', 'FOR', 'WITH', 'FROM', 'WILL', 'THAT', 'THIS', 'MORE', 'BEEN', 'HAVE', 'SAYS', 'WHEN', 'WHAT', 'ALSO', 'INTO', 'OVER', 'THEIR', 'THEY'])
  return [...new Set(matches.filter(t => !NOISE.has(t)))]
}
