import { cacheGet, cacheSet } from '../services/cacheService.js'
import { trackCall, trackError } from '../services/apiBudgetService.js'

// Nasdaq Trader halt/resume RSS feed
const HALT_URL = 'https://www.nasdaqtrader.com/rss.aspx?feed=tradehalts'

const meta = (extras = {}) => ({
  source: 'Nasdaq RSS', isRealData: true, isDemo: false, isStale: false,
  asOf: new Date().toISOString(), providerStatus: 'ok',
  missingFields: [], notes: [], ...extras,
})

export async function getTradeHalts() {
  const cached = cacheGet('nasdaq_rss', 'halts')
  if (cached) return cached
  try {
    trackCall('nasdaq_rss')
    const r = await fetch(HALT_URL, {
      headers: { 'User-Agent': 'ATI Research / research@ati.dev' }
    })
    if (!r.ok) throw new Error(`Nasdaq RSS ${r.status}`)
    const xml = await r.text()
    const halts = parseHaltXml(xml)
    const result = { halts, count: halts.length, ...meta() }
    cacheSet('nasdaq_rss', 'halts', result, 5)   // 5-min TTL
    return result
  } catch (e) {
    trackError('nasdaq_rss', 'getTradeHalts', e.message)
    return { halts: [], count: 0, ...meta({ providerStatus: 'error', notes: [e.message] }) }
  }
}

function parseHaltXml(xml) {
  const items = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  let m
  while ((m = itemRegex.exec(xml)) !== null) {
    const get = (tag) => {
      const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`)
      return re.exec(m[1])?.[1]?.trim() || ''
    }
    const desc = get('description')
    items.push({
      symbol:          get('sym') || extractTag(desc, 'Issue Symbol'),
      issue_name:      get('issueName') || extractTag(desc, 'Issue Name'),
      market:          get('market') || extractTag(desc, 'Market'),
      halt_date:       get('haltDate') || extractTag(desc, 'Halt Date'),
      halt_time:       get('haltTime') || extractTag(desc, 'Halt Time'),
      reason_code:     get('reasonCode') || extractTag(desc, 'Reason Code'),
      resumption_date: get('resumptionDate') || '',
      resumption_time: get('resumptionTime') || '',
    })
  }
  return items
}

function extractTag(text, label) {
  const re = new RegExp(label + '[:\\s]+([\\w\\s-]+)')
  return re.exec(text)?.[1]?.trim() || ''
}
