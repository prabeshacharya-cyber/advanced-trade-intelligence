import { cacheGet, cacheSet, TTL } from '../services/cacheService.js'
import { canCall, trackCall, trackError } from '../services/apiBudgetService.js'

const BASE = 'https://api.stlouisfed.org/fred/series/observations'
const KEY  = () => process.env.FRED_API_KEY

const SERIES = {
  fedFunds:      { id: 'FEDFUNDS',   name: 'Fed Funds Rate' },
  cpi:           { id: 'CPIAUCSL',   name: 'CPI (All Urban)' },
  unemployment:  { id: 'UNRATE',     name: 'Unemployment Rate' },
  tenYearYield:  { id: 'DGS10',      name: '10-Year Treasury Yield' },
  twoYearYield:  { id: 'DGS2',       name: '2-Year Treasury Yield' },
  gdpGrowth:     { id: 'A191RL1Q225SBEA', name: 'GDP Growth Rate' },
  creditSpread:  { id: 'BAMLH0A0HYM2',   name: 'HY Credit Spread' },
  vix:           { id: 'VIXCLS',     name: 'VIX' },
}

const meta = (extras = {}) => ({
  source: 'FRED', isRealData: true, isDemo: false, isStale: false,
  asOf: new Date().toISOString(), providerStatus: 'ok',
  missingFields: [], notes: [], ...extras,
})

async function fredFetch(seriesId) {
  if (!KEY()) return null
  if (!canCall('fred')) return null
  trackCall('fred')
  const url = `${BASE}?series_id=${seriesId}&api_key=${KEY()}&file_type=json&sort_order=desc&limit=10`
  const r = await fetch(url)
  if (!r.ok) throw new Error(`FRED ${r.status} ${seriesId}`)
  const j = await r.json()
  return j?.observations
}

async function getLatestValue(seriesId) {
  const cached = cacheGet('fred', `series_${seriesId}`)
  if (cached) return cached
  try {
    const obs = await fredFetch(seriesId)
    if (!obs?.length) return null
    const valid = obs.find(o => o.value !== '.')
    if (!valid) return null
    const result = { value: parseFloat(valid.value), date: valid.date }
    cacheSet('fred', `series_${seriesId}`, result, TTL.macro)
    return result
  } catch (e) {
    trackError('fred', 'getLatestValue', e.message)
    return null
  }
}

export async function getMacroSnapshot() {
  const key = 'macro_snapshot'
  const cached = cacheGet('fred', key)
  if (cached) return { ...cached, isStale: false }
  if (!KEY()) {
    return { ...meta({ providerStatus: 'missing_key', notes: ['Set FRED_API_KEY for real macro data'] }), data: {} }
  }
  try {
    const results = await Promise.allSettled(
      Object.entries(SERIES).map(async ([k, { id, name }]) => {
        const v = await getLatestValue(id)
        return [k, v ? { ...v, name, seriesId: id } : null]
      })
    )
    const data = Object.fromEntries(results.map(r => r.value || [null, null]).filter(([k]) => k))
    const snapshot = { data, regime: classifyRegime(data), ...meta() }
    cacheSet('fred', key, snapshot, TTL.macro)
    return snapshot
  } catch (e) {
    trackError('fred', 'getMacroSnapshot', e.message)
    return { data: {}, ...meta({ providerStatus: 'error', notes: [e.message] }) }
  }
}

function classifyRegime(data) {
  const rate = data.fedFunds?.value
  const cpi  = data.cpi?.value
  const unem = data.unemployment?.value
  if (!rate) return 'unknown'
  if (rate > 5 && cpi > 4) return 'restrictive_high_inflation'
  if (rate > 4) return 'restrictive'
  if (rate < 2 && unem > 5) return 'accommodative_slowdown'
  if (rate < 2) return 'accommodative'
  return 'neutral'
}

export function isConfigured() { return !!KEY() }
