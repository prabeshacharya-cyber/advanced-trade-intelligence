/**
 * worldNewsService.js
 * Fetches top world/financial news from free public RSS feeds.
 * No API keys required. Returns headlines with title, url, source, published_at.
 */

const RSS_SOURCES = [
  { name: 'Yahoo Finance',  url: 'https://finance.yahoo.com/rss/topstories' },
  { name: 'CNBC',           url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html' },
  { name: 'MarketWatch',    url: 'https://feeds.marketwatch.com/marketwatch/topstories/' },
  { name: 'BBC Business',   url: 'https://feeds.bbci.co.uk/news/business/rss.xml' },
  { name: 'Reuters',        url: 'https://feeds.reuters.com/reuters/businessNews' },
  { name: 'AP Business',    url: 'https://apnews.com/rss/apf-business' },
  { name: 'Google Finance', url: 'https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=en-US&gl=US&ceid=US:en' },
]

/* Extract text content between an XML tag (handles CDATA) */
function getTagText(xml, tag) {
  const open  = `<${tag}`
  const close = `</${tag}>`
  const start = xml.indexOf(open)
  if (start === -1) return ''
  const end = xml.indexOf('>', start)
  if (end === -1) return ''
  const closeStart = xml.indexOf(close, end)
  if (closeStart === -1) return ''
  let inner = xml.slice(end + 1, closeStart).trim()
  /* Strip CDATA wrapper */
  if (inner.startsWith('<![CDATA[') && inner.endsWith(']]>')) {
    inner = inner.slice(9, -3).trim()
  }
  return decodeEntities(inner)
}

/* Extract link — handles <link>url</link> and <link href="url"/> */
function getLink(block) {
  /* Atom: <link href="..." /> */
  const hrefMatch = block.match(/<link[^>]+href=["']([^"']+)["']/i)
  if (hrefMatch) return hrefMatch[1]
  /* RSS: <link>url</link> */
  const tagMatch = block.match(/<link[^>]*>([^<]+)<\/link>/i)
  if (tagMatch) return tagMatch[1].trim()
  /* Google News wraps in <guid> */
  const guidMatch = block.match(/<guid[^>]*>(https?:\/\/[^<]+)<\/guid>/i)
  if (guidMatch) return guidMatch[1].trim()
  return ''
}

function decodeEntities(str) {
  return str
    .replace(/&amp;/g,  '&')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g,  "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x2019;/g, '\u2019')
    .replace(/&#x2018;/g, '\u2018')
    .replace(/&#x201C;/g, '\u201C')
    .replace(/&#x201D;/g, '\u201D')
    .replace(/&#x2013;/g, '\u2013')
    .replace(/&#x2014;/g, '\u2014')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/<[^>]+>/g, '')   /* strip any remaining HTML tags */
    .trim()
}

/* Split XML into <item> or <entry> blocks */
function splitItems(xml) {
  const blocks = []
  let search = xml
  while (true) {
    const itemStart = search.indexOf('<item>')
    const entryStart = search.indexOf('<entry>')
    const useItem  = itemStart !== -1 && (entryStart === -1 || itemStart < entryStart)
    const useEntry = entryStart !== -1 && !useItem
    if (!useItem && !useEntry) break
    const tag = useItem ? 'item' : 'entry'
    const start = useItem ? itemStart : entryStart
    const end = search.indexOf(`</${tag}>`, start)
    if (end === -1) break
    blocks.push(search.slice(start + tag.length + 2, end))
    search = search.slice(end + tag.length + 3)
  }
  return blocks
}

function parseRss(xml, sourceName) {
  const items = []
  const blocks = splitItems(xml)
  for (const block of blocks) {
    const title = getTagText(block, 'title').slice(0, 180)
    const link  = getLink(block)
    const pub   = getTagText(block, 'pubDate') || getTagText(block, 'published') || getTagText(block, 'updated') || ''
    if (title && link) {
      items.push({
        title,
        url: link.trim(),
        source: sourceName,
        published_at: pub ? (() => { try { return new Date(pub).toISOString() } catch { return new Date().toISOString() } })() : new Date().toISOString(),
      })
    }
    if (items.length >= 8) break
  }
  return items
}

let _cache = { ts: 0, items: [] }
const CACHE_MS = 15 * 60 * 1000   /* 15-minute cache */

export async function fetchWorldNews(limit = 20) {
  if (Date.now() - _cache.ts < CACHE_MS && _cache.items.length > 0) {
    return _cache.items.slice(0, limit)
  }

  const results = await Promise.allSettled(
    RSS_SOURCES.map(async ({ name, url }) => {
      const ctrl  = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 7000)
      try {
        const r = await fetch(url, {
          signal: ctrl.signal,
          headers: { 'User-Agent': 'ATI-NewsBot/1.0 (Advanced Trade Intelligence)' },
        })
        clearTimeout(timer)
        if (!r.ok) return []
        const xml = await r.text()
        return parseRss(xml, name)
      } catch {
        clearTimeout(timer)
        return []
      }
    })
  )

  const all = []
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value)
  }

  /* Deduplicate by lowercased title prefix */
  const seen   = new Set()
  const unique = []
  for (const item of all) {
    const key = item.title.toLowerCase().slice(0, 80)
    if (!seen.has(key)) { seen.add(key); unique.push(item) }
  }

  /* Sort newest first */
  unique.sort((a, b) => new Date(b.published_at) - new Date(a.published_at))

  _cache = { ts: Date.now(), items: unique }
  console.log(`[worldNews] Fetched ${unique.length} headlines from ${RSS_SOURCES.length} sources`)
  return unique.slice(0, limit)
}
