import { cacheGet, cacheSet, TTL } from '../services/cacheService.js'
import { trackCall, trackError } from '../services/apiBudgetService.js'

// FINRA Reg SHO Daily Short Sale Volume (public)
const BASE = 'https://www.finra.org/sites/default/files/ftp/short-sale-volume-files'

const meta = (extras = {}) => ({
  source: 'FINRA', isRealData: true, isDemo: false, isStale: false,
  asOf: new Date().toISOString(), providerStatus: 'ok',
  missingFields: [], notes: [], ...extras,
})

export async function getShortVolume(symbol) {
  const key = `shortvol_${symbol}`
  const cached = cacheGet('finra', key)
  if (cached) return cached
  try {
    // FINRA short volume is published as daily CSV files
    const today = new Date()
    const dates = [0, 1, 2, 3, 4].map(d => {
      const dt = new Date(today); dt.setDate(dt.getDate() - d)
      return dt.toISOString().slice(0, 10).replace(/-/g, '')
    })
    for (const date of dates) {
      const url = `${BASE}/CNMSshvol${date}.txt`
      try {
        trackCall('finra')
        const r = await fetch(url)
        if (!r.ok) continue
        const text = await r.text()
        const lines = text.split('\n')
        const line  = lines.find(l => l.startsWith(symbol + '|'))
        if (!line) continue
        const parts = line.split('|')
        const shortVol = parseInt(parts[1])
        const totalVol = parseInt(parts[2])
        const result = {
          symbol, date: `${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)}`,
          short_volume: shortVol, total_volume: totalVol,
          short_volume_ratio: totalVol ? +(shortVol / totalVol * 100).toFixed(2) : null,
          ...meta(),
        }
        cacheSet('finra', key, result, TTL.shortSale)
        return result
      } catch {}
    }
    return { symbol, short_volume: null, total_volume: null, short_volume_ratio: null,
      ...meta({ providerStatus: 'unavailable', notes: ['Short sale data not found for recent date'] }) }
  } catch (e) {
    trackError('finra', 'getShortVolume', e.message)
    return { symbol, ...meta({ providerStatus: 'error', notes: [e.message] }) }
  }
}
