import { Router } from 'express'
import {
  analyzeMomentum,
  getAccount,
  getPositions,
  getOrders,
  placeBracketOrder,
  cancelOrder,
  closePosition,
  getClosedOrders,
  getPortfolioHistory,
  getMode_,
} from '../services/alpacaService.js'
import {
  getAutoTradeConfig,
  setAutoTradeConfig,
  getAutoTradeLog,
  runAutoTradePass,
} from '../services/autoTradingService.js'
import getDb from '../db/index.js'

const router = Router()

// ── Helpers ───────────────────────────────────────────────────────────────────
function db() { return getDb() }

function ensureTable() {
  db().exec(`
    CREATE TABLE IF NOT EXISTS momentum_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      alpaca_order_id TEXT,
      symbol TEXT NOT NULL,
      qty INTEGER,
      entry_limit REAL,
      stop_loss REAL,
      take_profit REAL,
      mode TEXT DEFAULT 'paper',
      status TEXT DEFAULT 'submitted',
      gap_pct REAL, rvol REAL, vwap REAL,
      action TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_mom_orders_symbol ON momentum_orders(symbol, created_at);
  `)
}

// ── GET /api/momentum/account ─────────────────────────────────────────────────
router.get('/account', async (req, res) => {
  try {
    const [account, positions, orders] = await Promise.all([
      getAccount(),
      getPositions(),
      getOrders('open'),
    ])
    res.json({
      mode: getMode_(),
      account: {
        equity:           parseFloat(account.equity || 0),
        buyingPower:      parseFloat(account.buying_power || 0),
        cash:             parseFloat(account.cash || 0),
        daytradeCount:    account.daytrade_count || 0,
        patternDayTrader: account.pattern_day_trader || false,
        status:           account.status,
      },
      positions: positions.map(p => ({
        symbol:     p.symbol,
        qty:        parseFloat(p.qty),
        avgEntry:   parseFloat(p.avg_entry_price),
        currentPx:  parseFloat(p.current_price),
        unrealPnl:  parseFloat(p.unrealized_pl),
        unrealPnlPct: parseFloat(p.unrealized_plpc) * 100,
        marketVal:  parseFloat(p.market_value),
        side:       p.side,
      })),
      openOrders: orders.map(o => ({
        id:         o.id,
        symbol:     o.symbol,
        qty:        o.qty,
        side:       o.side,
        type:       o.type,
        status:     o.status,
        limitPrice: o.limit_price,
        createdAt:  o.created_at,
      })),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/momentum/scan ─────────────────────────────────────────────────────
// Query params: symbols=AAPL,TSLA,NVDA  (defaults to a curated gap list)
router.get('/scan', async (req, res) => {
  const DEFAULT_SYMBOLS = [
    'AAPL','TSLA','NVDA','AMD','META','MSFT','AMZN','GOOGL',
    'NFLX','PLTR','COIN','MARA','SOFI','RIVN','NIO','LCID',
    'GME','AMC','BBBY','SNDL',
  ]
  const raw = req.query.symbols
  const symbols = raw
    ? raw.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
    : DEFAULT_SYMBOLS

  if (symbols.length > 30) {
    return res.status(400).json({ error: 'Max 30 symbols per scan' })
  }

  try {
    const results = await Promise.allSettled(symbols.map(s => analyzeMomentum(s)))
    const signals = results.map((r, i) =>
      r.status === 'fulfilled' ? r.value : { symbol: symbols[i], error: r.reason?.message, action: 'ERROR' }
    )
    signals.sort((a, b) => (b.strength || 0) - (a.strength || 0))
    res.json({ mode: getMode_(), count: signals.length, signals, scannedAt: new Date().toISOString() })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/momentum/execute ─────────────────────────────────────────────────
// Body: { symbol, entryPrice, riskPct, stopPct, tpPct }
router.post('/execute', async (req, res) => {
  ensureTable()
  const { symbol, entryPrice, riskPct = 0.02, stopPct = 0.01, tpPct = 0.02 } = req.body
  if (!symbol || !entryPrice) {
    return res.status(400).json({ error: 'symbol and entryPrice required' })
  }

  // Safety: only allow during market hours (9:25–16:05 ET)
  const now = new Date()
  const et  = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const hm  = et.getHours() * 100 + et.getMinutes()
  if (hm < 925 || hm > 1605) {
    return res.status(400).json({
      error: 'Outside market hours. Orders only placed 9:25 AM – 4:05 PM ET.',
      currentET: et.toLocaleTimeString('en-US', { timeZone: 'America/New_York' }),
    })
  }

  // Safety: max 3 open positions
  const positions = await getPositions().catch(() => [])
  if (positions.length >= 3) {
    return res.status(400).json({ error: 'Max 3 open positions reached. Close one before opening new.' })
  }

  try {
    const order = await placeBracketOrder(symbol, entryPrice, { riskPct, stopPct, tpPct })

    // Log to SQLite — tag as MANUAL-BUY so history can distinguish from AUTO-BUY
    db().prepare(`
      INSERT INTO momentum_orders
        (alpaca_order_id, symbol, qty, entry_limit, stop_loss, take_profit, mode, status, action)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      order.orderId, symbol, order.qty,
      order.entryLimit, order.stopLoss, order.takeProfit,
      order.mode, order.status, 'MANUAL-BUY'
    )

    res.json({ success: true, order })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── DELETE /api/momentum/orders/:id ──────────────────────────────────────────
router.delete('/orders/:id', async (req, res) => {
  try {
    const result = await cancelOrder(req.params.id)
    if (result.cancelled) {
      db().prepare(`UPDATE momentum_orders SET status='cancelled', updated_at=datetime('now') WHERE alpaca_order_id=?`).run(req.params.id)
    }
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── DELETE /api/momentum/positions/:symbol ────────────────────────────────────
router.delete('/positions/:symbol', async (req, res) => {
  try {
    const result = await closePosition(req.params.symbol)
    res.json({ success: true, result })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/momentum/history ─────────────────────────────────────────────────
router.get('/history', (req, res) => {
  ensureTable()
  try {
    const rows = db().prepare(`
      SELECT * FROM momentum_orders ORDER BY created_at DESC LIMIT 100
    `).all()
    res.json({ orders: rows })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET  /api/momentum/auto-trade ────────────────────────────────────────────
router.get('/auto-trade', (req, res) => {
  try { res.json(getAutoTradeConfig()) }
  catch (e) { res.status(500).json({ error: e.message }) }
})

// ── POST /api/momentum/auto-trade ────────────────────────────────────────────
router.post('/auto-trade', (req, res) => {
  try {
    setAutoTradeConfig(req.body)
    res.json({ ok: true, config: getAutoTradeConfig() })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── GET  /api/momentum/auto-log ──────────────────────────────────────────────
router.get('/auto-log', (req, res) => {
  try { res.json({ log: getAutoTradeLog(80) }) }
  catch (e) { res.status(500).json({ error: e.message }) }
})

// ── POST /api/momentum/auto-run ──────────────────────────────────────────────
router.post('/auto-run', async (req, res) => {
  try {
    const result = await runAutoTradePass()
    res.json(result)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── GET /api/momentum/closed-orders ──────────────────────────────────────────
// Returns closed/filled trades with entry vs exit price, P&L, and summary analytics.
// Query params:
//   range=day   (default) — only today's ET trading session
//   range=all   — last 30 days (up to 200 fills)
router.get('/closed-orders', async (req, res) => {
  const range = req.query.range === 'all' ? 'all' : 'day'

  try {
    // For daily view use intraday portfolio history (5-min bars, 1D period)
    // For all-time view use monthly history (daily bars, 1M period)
    const phPeriod    = range === 'day' ? '1D' : '1M'
    const phTimeframe = range === 'day' ? '5Min' : '1D'

    // ── Compute date-bounded `after` timestamps ───────────────────────────────
    const etDateFmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York', year:'numeric', month:'2-digit', day:'2-digit',
    })
    const todayET = etDateFmt.format(new Date())  // YYYY-MM-DD in ET

    // For range=day: fetch only fills from today's ET session start (midnight ET)
    // For range=all: fetch fills from 30 days ago to bound the window precisely
    const afterDate = range === 'day'
      ? new Date(`${todayET}T00:00:00`).toISOString()
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const [fills, portfolioHistory] = await Promise.all([
      getClosedOrders(200, afterDate),
      getPortfolioHistory(phPeriod, phTimeframe).catch(() => null),
    ])

    // ── Pair buy/sell fills into completed trades (FIFO per symbol) ────────────
    // fills are returned in chronological (asc) order from getClosedOrders
    const chronological = fills

    const buyQueues = {}   // symbol -> [ { price, qty, time } ]
    const allTrades = []

    for (const fill of chronological) {
      const sym   = fill.symbol
      const price = parseFloat(fill.price)
      const qty   = parseFloat(fill.qty)
      const time  = fill.transaction_time

      if (!buyQueues[sym]) buyQueues[sym] = []

      if (fill.side === 'buy') {
        buyQueues[sym].push({ price, qty, time })
      } else if (fill.side === 'sell') {
        let remaining = qty
        while (remaining > 0 && buyQueues[sym] && buyQueues[sym].length > 0) {
          const entry   = buyQueues[sym][0]
          const matched = Math.min(entry.qty, remaining)
          const pnl     = (price - entry.price) * matched
          allTrades.push({
            symbol:     sym,
            entryPrice: entry.price,
            exitPrice:  price,
            qty:        matched,
            pnl:        Math.round(pnl * 100) / 100,
            entryTime:  entry.time,
            exitTime:   time,
            winner:     pnl > 0,
          })
          entry.qty -= matched
          remaining -= matched
          if (entry.qty <= 0) buyQueues[sym].shift()
        }
      }
    }

    // ── Filter to today's ET session when range=day ───────────────────────────
    const trades = range === 'day'
      ? allTrades.filter(t => etDateFmt.format(new Date(t.exitTime)) === todayET)
      : allTrades

    // Sort trades newest-first for display
    trades.sort((a, b) => new Date(b.exitTime) - new Date(a.exitTime))

    // ── Summary analytics (scoped to filtered trades) ──────────────────────────
    const totalTrades = trades.length
    const winners     = trades.filter(t => t.winner)
    const losers      = trades.filter(t => !t.winner)
    const winRate     = totalTrades > 0 ? (winners.length / totalTrades) * 100 : 0
    const totalPnl    = trades.reduce((s, t) => s + t.pnl, 0)
    const avgWin      = winners.length > 0 ? winners.reduce((s, t) => s + t.pnl, 0) / winners.length : 0
    const avgLoss     = losers.length  > 0 ? losers.reduce((s, t) => s + t.pnl, 0)  / losers.length  : 0

    // ── Equity curve ──────────────────────────────────────────────────────────
    // For daily view: use intraday portfolio equity (5-min bars) from Alpaca
    // Fallback: build cumulative P&L line from matched trades
    let equityCurve = []
    if (portfolioHistory && Array.isArray(portfolioHistory.timestamp)) {
      equityCurve = portfolioHistory.timestamp.map((ts, i) => ({
        date:   range === 'day'
          ? new Date(ts * 1000).toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', timeZone:'America/New_York' })
          : new Date(ts * 1000).toISOString().slice(0, 10),
        equity:  portfolioHistory.equity[i] || 0,
        pnl:     portfolioHistory.profit_loss[i] || 0,
        pnlPct:  portfolioHistory.profit_loss_pct[i] || 0,
      })).filter(p => p.equity > 0)
    } else {
      // Build cumulative P&L from individual trades (filtered window)
      const sorted = [...trades].sort((a, b) => new Date(a.exitTime) - new Date(b.exitTime))
      let cumPnl = 0
      equityCurve = sorted.map(t => {
        cumPnl += t.pnl
        return {
          date:   range === 'day'
            ? new Date(t.exitTime).toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', timeZone:'America/New_York' })
            : t.exitTime.slice(0, 10),
          pnl:    Math.round(cumPnl * 100) / 100,
          equity: null,
        }
      })
    }

    res.json({
      mode: getMode_(),
      range,
      analytics: {
        totalTrades,
        winRate:   Math.round(winRate * 10) / 10,
        avgWin:    Math.round(avgWin * 100) / 100,
        avgLoss:   Math.round(avgLoss * 100) / 100,
        totalPnl:  Math.round(totalPnl * 100) / 100,
        winners:   winners.length,
        losers:    losers.length,
      },
      trades,
      equityCurve,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/momentum/mode ────────────────────────────────────────────────────
router.get('/mode', (req, res) => {
  res.json({ mode: getMode_() })
})

// ── POST /api/momentum/mode ───────────────────────────────────────────────────
router.post('/mode', (req, res) => {
  const { mode } = req.body
  if (!['paper', 'live'].includes(mode)) {
    return res.status(400).json({ error: 'mode must be paper or live' })
  }
  process.env.ALPACA_MODE = mode
  res.json({ mode, message: `Switched to ${mode} trading mode` })
})

export default router
