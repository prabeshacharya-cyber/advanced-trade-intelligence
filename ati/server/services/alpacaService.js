/**
 * Alpaca Markets Service
 * Supports both paper and live trading modes via ALPACA_MODE env var.
 * Paper mode: ALPACA_MODE=paper (default)
 * Live mode:  ALPACA_MODE=live
 */

const PAPER_TRADE_BASE = 'https://paper-api.alpaca.markets'
const LIVE_TRADE_BASE  = 'https://api.alpaca.markets'
const DATA_BASE        = 'https://data.alpaca.markets'

function getMode() {
  return (process.env.ALPACA_MODE || 'paper').toLowerCase()
}

function getKeys() {
  const mode = getMode()
  if (mode === 'live') {
    return {
      key:    process.env.ALPACA_LIVE_API_KEY,
      secret: process.env.ALPACA_LIVE_SECRET_KEY,
      base:   LIVE_TRADE_BASE,
    }
  }
  return {
    key:    process.env.ALPACA_PAPER_API_KEY,
    secret: process.env.ALPACA_PAPER_SECRET_KEY,
    base:   PAPER_TRADE_BASE,
  }
}

function headers(key, secret) {
  return {
    'APCA-API-KEY-ID':     key,
    'APCA-API-SECRET-KEY': secret,
    'Content-Type':        'application/json',
  }
}

async function alpacaFetch(url, options = {}) {
  const { key, secret } = getKeys()
  if (!key || !secret) throw new Error('Alpaca API keys not configured')
  const res = await fetch(url, {
    ...options,
    headers: { ...headers(key, secret), ...(options.headers || {}) },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Alpaca ${res.status}: ${body}`)
  }
  return res.json()
}

// ── Account ───────────────────────────────────────────────────────────────────

export async function getAccount() {
  const { base } = getKeys()
  return alpacaFetch(`${base}/v2/account`)
}

export async function getPositions() {
  const { base } = getKeys()
  return alpacaFetch(`${base}/v2/positions`)
}

export async function getOrders(status = 'open') {
  const { base } = getKeys()
  return alpacaFetch(`${base}/v2/orders?status=${status}&limit=50`)
}

// ── Market Data ───────────────────────────────────────────────────────────────

/**
 * Fetch 5-minute intraday bars for a symbol.
 * Returns array of { t, o, h, l, c, v } objects.
 */
export async function getIntradayBars(symbol, limit = 390) {
  const { key, secret } = getKeys()
  const url = `${DATA_BASE}/v2/stocks/${encodeURIComponent(symbol)}/bars?timeframe=5Min&limit=${limit}&adjustment=raw&feed=iex`
  const res = await fetch(url, { headers: headers(key, secret) })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Alpaca bars ${res.status}: ${body}`)
  }
  const j = await res.json()
  return j.bars || []
}

/**
 * Fetch daily bars for avg volume calculation (20 days).
 */
export async function getDailyBars(symbol, limit = 25) {
  const { key, secret } = getKeys()
  const url = `${DATA_BASE}/v2/stocks/${encodeURIComponent(symbol)}/bars?timeframe=1Day&limit=${limit}&adjustment=raw`
  const res = await fetch(url, { headers: headers(key, secret) })
  if (!res.ok) throw new Error(`Alpaca daily bars ${res.status}`)
  const j = await res.json()
  return j.bars || []
}

/**
 * Fetch latest quote/snapshot for a symbol.
 */
export async function getSnapshot(symbol) {
  const { key, secret } = getKeys()
  const url = `${DATA_BASE}/v2/stocks/${encodeURIComponent(symbol)}/snapshot`
  const res = await fetch(url, { headers: headers(key, secret) })
  if (!res.ok) throw new Error(`Alpaca snapshot ${res.status}`)
  return res.json()
}

/**
 * Fetch snapshots for multiple symbols at once.
 */
export async function getSnapshots(symbols) {
  const { key, secret } = getKeys()
  const url = `${DATA_BASE}/v2/stocks/snapshots?symbols=${symbols.map(encodeURIComponent).join(',')}`
  const res = await fetch(url, { headers: headers(key, secret) })
  if (!res.ok) throw new Error(`Alpaca snapshots ${res.status}`)
  return res.json()
}

// ── Momentum Calculations ─────────────────────────────────────────────────────

/**
 * Calculate EMA for an array of values with given span.
 */
function ema(values, span) {
  const k = 2 / (span + 1)
  const result = []
  let prev = null
  for (const v of values) {
    if (prev === null) {
      prev = v
    } else {
      prev = v * k + prev * (1 - k)
    }
    result.push(prev)
  }
  return result
}

/**
 * Run the full momentum strategy for a single symbol.
 * Returns structured signal object.
 */
export async function analyzeMomentum(symbol) {
  try {
    const [intraBars, dailyBars] = await Promise.all([
      getIntradayBars(symbol, 390),
      getDailyBars(symbol, 25),
    ])

    if (!intraBars || intraBars.length < 20) {
      return { symbol, error: 'Insufficient intraday data', action: 'NO DATA' }
    }

    // ── Gap % ────────────────────────────────────────────────────────────────
    const prevClose = dailyBars.length >= 2
      ? dailyBars[dailyBars.length - 2].c
      : null
    const todayOpen = intraBars[0].o
    const gapPct = prevClose && prevClose > 0
      ? ((todayOpen - prevClose) / prevClose) * 100
      : 0

    // ── RVOL ─────────────────────────────────────────────────────────────────
    const avgDailyVol = dailyBars.length > 1
      ? dailyBars.slice(0, -1).reduce((s, b) => s + (b.v || 0), 0) / (dailyBars.length - 1)
      : 0
    const todayVol = intraBars.reduce((s, b) => s + (b.v || 0), 0)
    const rvol = avgDailyVol > 0 ? todayVol / avgDailyVol : 0

    // ── VWAP ─────────────────────────────────────────────────────────────────
    let cumPV = 0, cumV = 0
    const vwapArr = intraBars.map(b => {
      const tp = (b.h + b.l + b.c) / 3
      cumPV += tp * (b.v || 0)
      cumV  += (b.v || 0)
      return cumV > 0 ? cumPV / cumV : tp
    })
    const vwap        = vwapArr[vwapArr.length - 1]
    const lastClose   = intraBars[intraBars.length - 1].c
    const isAboveVwap = lastClose > vwap

    // ── EMA 9 / 20 ───────────────────────────────────────────────────────────
    const closes  = intraBars.map(b => b.c)
    const ema9Arr = ema(closes, 9)
    const ema20Arr= ema(closes, 20)
    const ema9    = ema9Arr[ema9Arr.length - 1]
    const ema20   = ema20Arr[ema20Arr.length - 1]
    const emaBull = ema9 > ema20

    // ── Bull Flag Detection ───────────────────────────────────────────────────
    const n = intraBars.length
    // Pole: ≥2% move in any 3-bar window within last 10 bars
    let hasPole = false
    for (let i = Math.max(0, n - 10); i < n - 3; i++) {
      const move = (intraBars[i + 2].c - intraBars[i].c) / intraBars[i].c
      if (move > 0.02) { hasPole = true; break }
    }
    // Flag: last 3 bars consolidating (lower highs) on falling volume
    const last3H = intraBars.slice(-3).map(b => b.h)
    const last3V = intraBars.slice(-3).map(b => b.v)
    const prev3H = intraBars.slice(-4, -1).map(b => b.h)
    const prev3V = intraBars.slice(-4, -1).map(b => b.v)
    const isConsolidating = last3H.every((h, i) => h < prev3H[i])
    const volDropping     = last3V.every((v, i) => v < prev3V[i])
    const bullFlag        = hasPole && isConsolidating && volDropping

    // ── Signal ────────────────────────────────────────────────────────────────
    let action = 'IGNORE'
    let strength = 0
    if (gapPct > 4 && isAboveVwap && hasPole)        { action = 'BUY';   strength = 3 }
    else if (gapPct > 2 && (isAboveVwap || emaBull)) { action = 'WATCH'; strength = 2 }
    else if (gapPct > 0 && emaBull)                  { action = 'WATCH'; strength = 1 }

    return {
      symbol,
      price:       round(lastClose),
      prevClose:   prevClose ? round(prevClose) : null,
      gapPct:      round(gapPct),
      rvol:        round(rvol),
      vwap:        round(vwap),
      ema9:        round(ema9),
      ema20:       round(ema20),
      isAboveVwap,
      emaBull,
      bullFlag,
      hasPole,
      action,
      strength,
      barsAnalyzed: intraBars.length,
      asOf:        intraBars[intraBars.length - 1]?.t || new Date().toISOString(),
    }
  } catch (err) {
    return { symbol, error: err.message, action: 'ERROR' }
  }
}

function round(n, d = 2) {
  return Math.round(n * 10 ** d) / 10 ** d
}

// ── Order Execution ───────────────────────────────────────────────────────────

/**
 * Place a bracket order (entry + stop loss + take profit).
 * Calculates qty from account buying power with risk% per trade.
 * @param {string} symbol
 * @param {number} entryPrice   - current ask/last price
 * @param {object} opts         - { riskPct, stopPct, tpPct }
 */
export async function placeBracketOrder(symbol, entryPrice, opts = {}) {
  const {
    riskPct = 0.02,   // 2% of account per trade
    stopPct = 0.01,   // 1% stop loss below entry
    tpPct   = 0.02,   // 2% take profit above entry
  } = opts

  const { base } = getKeys()

  // Get account to calculate position size
  const account    = await getAccount()
  const buyingPow  = parseFloat(account.buying_power || account.daytrading_buying_power || 0)
  const tradeValue = buyingPow * riskPct
  const qty        = Math.max(1, Math.floor(tradeValue / entryPrice))

  const stopPrice   = round(entryPrice * (1 - stopPct))
  const limitPrice  = round(entryPrice * 1.001)   // slight limit above market
  const takeProfitP = round(entryPrice * (1 + tpPct))

  const body = {
    symbol,
    qty:          String(qty),
    side:         'buy',
    type:         'limit',
    time_in_force:'day',
    limit_price:  String(limitPrice),
    order_class:  'bracket',
    stop_loss:    { stop_price: String(stopPrice) },
    take_profit:  { limit_price: String(takeProfitP) },
  }

  const order = await alpacaFetch(`${base}/v2/orders`, {
    method: 'POST',
    body:   JSON.stringify(body),
  })

  return {
    orderId:    order.id,
    symbol,
    qty,
    entryLimit: limitPrice,
    stopLoss:   stopPrice,
    takeProfit: takeProfitP,
    mode:       getMode(),
    status:     order.status,
    raw:        order,
  }
}

/**
 * Cancel an open order.
 */
export async function cancelOrder(orderId) {
  const { base } = getKeys()
  const res = await fetch(`${base}/v2/orders/${orderId}`, {
    method:  'DELETE',
    headers: headers(getKeys().key, getKeys().secret),
  })
  return res.status === 204 ? { cancelled: true } : { cancelled: false }
}

/**
 * Close a position immediately at market.
 */
export async function closePosition(symbol) {
  const { base } = getKeys()
  return alpacaFetch(`${base}/v2/positions/${encodeURIComponent(symbol)}`, {
    method: 'DELETE',
  })
}

/**
 * Fetch account fill activities (executed trades) for P&L analysis.
 * Uses Alpaca's account activities endpoint filtered to FILL type.
 * Returns raw fill objects (chronological asc) with symbol, side, price, qty, transaction_time.
 * @param {number} limit  - max fill records (≤200 per Alpaca page)
 * @param {string|null} after - ISO-8601 datetime; only return fills after this timestamp
 */
export async function getClosedOrders(limit = 200, after = null) {
  const { base } = getKeys()
  let url = `${base}/v2/account/activities?activity_types=FILL&direction=asc&page_size=${limit}`
  if (after) url += `&after=${encodeURIComponent(after)}`
  const data = await alpacaFetch(url)
  return Array.isArray(data) ? data : []
}

/**
 * Fetch portfolio equity history for equity curve rendering.
 * Period: 1D, timeframe: 5Min (intraday) or 1D (multi-day)
 */
export async function getPortfolioHistory(period = '1M', timeframe = '1D') {
  const { base } = getKeys()
  const data = await alpacaFetch(
    `${base}/v2/account/portfolio/history?period=${period}&timeframe=${timeframe}&extended_hours=false`
  )
  return data
}

export function getMode_() { return getMode() }
