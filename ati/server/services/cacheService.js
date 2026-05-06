import getDb from '../db/index.js'

// Cache TTLs in minutes
export const TTL = {
  quotes:       5,
  priceHistory: 720,   // 12h
  secFundamentals: 1440, // 24h
  secFilings:   360,   // 6h
  news:         60,
  macro:        1440,
  fundHoldings: 10080, // 7d
  tradeHalts:   5,
  shortSale:    1440,
}

export function cacheGet(provider, key) {
  try {
    const db = getDb()
    const row = db.prepare(
      'SELECT response_json, expires_at FROM provider_cache WHERE provider=? AND cache_key=?'
    ).get(provider, key)
    if (!row) return null
    if (new Date(row.expires_at) < new Date()) return null
    return JSON.parse(row.response_json)
  } catch { return null }
}

export function cacheSet(provider, key, data, ttlMinutes = 60) {
  try {
    const db = getDb()
    const expires = new Date(Date.now() + ttlMinutes * 60_000).toISOString()
    db.prepare(`
      INSERT INTO provider_cache(provider, cache_key, response_json, expires_at, updated_at)
      VALUES(?,?,?,?,datetime('now'))
      ON CONFLICT(provider, cache_key) DO UPDATE SET
        response_json=excluded.response_json,
        expires_at=excluded.expires_at,
        updated_at=excluded.updated_at
    `).run(provider, key, JSON.stringify(data), expires)
  } catch {}
}

export function cacheClear(provider, key) {
  try {
    getDb().prepare('DELETE FROM provider_cache WHERE provider=? AND cache_key=?').run(provider, key)
  } catch {}
}

export function cacheStats() {
  try {
    const db = getDb()
    const total   = db.prepare('SELECT COUNT(*) as c FROM provider_cache').get().c
    const valid   = db.prepare("SELECT COUNT(*) as c FROM provider_cache WHERE expires_at > datetime('now')").get().c
    const stale   = total - valid
    return { total, valid, stale, hitRate: total ? Math.round(valid / total * 100) : 0 }
  } catch { return { total: 0, valid: 0, stale: 0, hitRate: 0 } }
}
