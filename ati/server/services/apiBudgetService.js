import getDb from '../db/index.js'

const DEFAULTS = {
  alpha_vantage: parseInt(process.env.ALPHA_VANTAGE_DAILY_LIMIT) || 20,
  fmp:           parseInt(process.env.FMP_DAILY_LIMIT) || 200,
  finnhub:       parseInt(process.env.FINNHUB_DAILY_LIMIT) || 500,
  fred:          parseInt(process.env.FRED_DAILY_LIMIT) || 100,
  sec:           1000,
  yahoo:         200,
}

export function getLimit(provider) {
  return DEFAULTS[provider.toLowerCase()] ?? 100
}

export function getUsage(provider) {
  try {
    const db = getDb()
    const today = new Date().toISOString().slice(0, 10)
    const row = db.prepare(
      'SELECT request_count FROM provider_usage WHERE provider=? AND date=?'
    ).get(provider, today)
    return row?.request_count ?? 0
  } catch { return 0 }
}

export function canCall(provider, reserve = 0) {
  const used  = getUsage(provider)
  const limit = getLimit(provider)
  return used + reserve < limit
}

export function trackCall(provider, count = 1) {
  try {
    const db = getDb()
    const today = new Date().toISOString().slice(0, 10)
    db.prepare(`
      INSERT INTO provider_usage(provider, date, request_count, daily_limit, last_request_at)
      VALUES(?,?,?,?,datetime('now'))
      ON CONFLICT(provider, date) DO UPDATE SET
        request_count = request_count + ?,
        daily_limit   = ?,
        last_request_at = datetime('now')
    `).run(provider, today, count, getLimit(provider), count, getLimit(provider))
  } catch {}
}

export function trackError(provider, endpoint, message, status) {
  try {
    getDb().prepare(
      'INSERT INTO provider_errors(provider,endpoint_name,error_message,status_code) VALUES(?,?,?,?)'
    ).run(provider, endpoint, message, status ?? 0)
  } catch {}
}

export function budgetSummary() {
  try {
    const db = getDb()
    const today = new Date().toISOString().slice(0, 10)
    const rows = db.prepare(
      'SELECT provider, request_count, daily_limit, last_request_at FROM provider_usage WHERE date=?'
    ).all(today)
    return rows.map(r => ({
      provider: r.provider,
      used: r.request_count,
      limit: r.daily_limit,
      remaining: Math.max(0, r.daily_limit - r.request_count),
      pctUsed: r.daily_limit ? Math.round(r.request_count / r.daily_limit * 100) : 0,
      lastCall: r.last_request_at,
    }))
  } catch { return [] }
}
