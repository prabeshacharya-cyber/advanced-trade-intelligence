/**
 * Auto-Trading Service
 * Handles automated order execution, portfolio drop alerts, and EOD summaries.
 */
import getDb from '../db/index.js'
import {
  analyzeMomentum,
  getAccount,
  getPositions,
  getOrders,
  placeBracketOrder,
} from './alpacaService.js'

// ── Tables ────────────────────────────────────────────────────────────────────
function db() { return getDb() }

function ensureTables() {
  db().exec(`
    CREATE TABLE IF NOT EXISTS auto_trade_config (
      key   TEXT PRIMARY KEY,
      value TEXT
    );
    CREATE TABLE IF NOT EXISTS auto_trade_log (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      event      TEXT NOT NULL,
      symbol     TEXT,
      detail     TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `)
}
ensureTables()

// ── Config helpers ────────────────────────────────────────────────────────────
function getCfg(key, def) {
  try {
    const row = db().prepare('SELECT value FROM auto_trade_config WHERE key=?').get(key)
    return row ? row.value : def
  } catch { return def }
}
function setCfg(key, value) {
  db().prepare('INSERT OR REPLACE INTO auto_trade_config(key,value) VALUES(?,?)').run(key, String(value))
}

function addLog(event, symbol, detail) {
  try {
    db().prepare('INSERT INTO auto_trade_log(event,symbol,detail) VALUES(?,?,?)').run(
      event, symbol || null, detail || null
    )
    console.log(`[auto-trade] ${event}${symbol ? ' ' + symbol : ''}${detail ? ' — ' + detail : ''}`)
  } catch (e) { console.error('[auto-trade] log error:', e.message) }
}

// ── Market hours ──────────────────────────────────────────────────────────────
export function isMarketHours() {
  const now = new Date()
  const et  = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const day = et.getDay()
  if (day === 0 || day === 6) return false
  const hm = et.getHours() * 100 + et.getMinutes()
  return hm >= 930 && hm <= 1600
}

// ── Public config API ─────────────────────────────────────────────────────────
export function getAutoTradeConfig() {
  return {
    enabled:              getCfg('enabled', 'false') === 'true',
    symbols:              getCfg('symbols', 'AAPL,TSLA,NVDA,AMD,META,MSFT,PLTR,COIN'),
    stopPct:              parseFloat(getCfg('stopPct',   '0.01')),
    tpPct:                parseFloat(getCfg('tpPct',     '0.02')),
    riskPct:              parseFloat(getCfg('riskPct',   '0.02')),
    minStrength:          parseInt(getCfg('minStrength', '3')),
    dropAlertPct:         parseFloat(getCfg('dropAlertPct', '5')),
    alertEmail:           getCfg('alertEmail', ''),
    dailyLossLimitType:   getCfg('dailyLossLimitType', 'dollar'),
    dailyLossLimit:       parseFloat(getCfg('dailyLossLimit', '0')),
    dailyLossHaltedDate:  getCfg('dailyLossHaltedDate', ''),
  }
}

export function setAutoTradeConfig(cfg) {
  const allowed = ['enabled','symbols','stopPct','tpPct','riskPct','minStrength','dropAlertPct','alertEmail','dailyLossLimitType','dailyLossLimit']
  for (const [k, v] of Object.entries(cfg)) {
    if (allowed.includes(k)) setCfg(k, v)
  }
  addLog('CONFIG_UPDATED', null, JSON.stringify(cfg))
}

// ── ET date helper (avoids UTC midnight mismatches for day-scoped risk controls)
function todayET() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())  // returns YYYY-MM-DD in ET
}

// ── Daily loss limit check ────────────────────────────────────────────────────
// Returns { halt: boolean, reason: string } so callers can surface the right message.
async function isDailyLossLimitHit(cfg) {
  const today = todayET()

  // Check persisted halt FIRST — must honor regardless of current limit config.
  // This prevents a same-day bypass where a user sets limit to 0 after halt fires.
  if (getCfg('dailyLossHaltedDate', '') === today) {
    return { halt: true, reason: 'Daily loss limit reached — bot halted for today' }
  }

  // If no limit configured, no further check needed
  if (!cfg.dailyLossLimit || cfg.dailyLossLimit <= 0) return { halt: false }

  try {
    const account = await getAccount()
    const equity  = parseFloat(account.equity || 0)
    const dayKey  = `dayStart_${today}`
    let   stored  = getCfg(dayKey, null)

    // Self-initialize day-start baseline on first check of the day
    if (!stored) {
      setCfg(dayKey, equity.toString())
      addLog('DAY_START_LOSS_CHECK', null, `Baseline equity recorded: $${equity.toFixed(2)}`)
      return { halt: false }   // can't have lost money yet — no prior baseline
    }

    const dayStart = parseFloat(stored)
    const loss     = dayStart - equity

    let limitHit = false
    if (cfg.dailyLossLimitType === 'pct') {
      const lossPct = dayStart > 0 ? (loss / dayStart) * 100 : 0
      limitHit = lossPct >= cfg.dailyLossLimit
    } else {
      limitHit = loss >= cfg.dailyLossLimit
    }

    if (limitHit) {
      setCfg('dailyLossHaltedDate', today)
      const lossStr = cfg.dailyLossLimitType === 'pct'
        ? `${(dayStart > 0 ? (loss / dayStart) * 100 : 0).toFixed(2)}% / limit ${cfg.dailyLossLimit}%`
        : `$${loss.toFixed(2)} / limit $${cfg.dailyLossLimit}`
      addLog('DAILY_LOSS_LIMIT_HIT', null, `Bot halted for today — loss: ${lossStr}`)
      return { halt: true, reason: 'Daily loss limit reached — bot halted for today' }
    }

    return { halt: false }
  } catch (e) {
    // Fail-closed: if account data cannot be retrieved, halt the bot rather than
    // allow trading without enforcing the risk guardrail. Persist the halt date
    // so subsequent passes and the UI correctly reflect "halted today".
    const today = todayET()
    setCfg('dailyLossHaltedDate', today)
    console.error('[auto-trade] dailyLossLimit check failed — halting bot as safety measure:', e.message)
    addLog('DAILY_LOSS_LIMIT_ERROR', null, `Account read error — bot halted as failsafe: ${e.message}`)
    return { halt: true, reason: `Risk check failed (account API error) — bot halted as failsafe: ${e.message}` }
  }
}

// ── Auto-trade pass ───────────────────────────────────────────────────────────
let autoRunning = false

export async function runAutoTradePass() {
  if (autoRunning) return { skipped: true, reason: 'Already running' }
  autoRunning = true

  try {
    const cfg = getAutoTradeConfig()
    if (!cfg.enabled)    return { skipped: true, reason: 'Auto-trading disabled' }
    if (!isMarketHours()) return { skipped: true, reason: 'Outside market hours' }

    // Check daily loss limit before scanning
    const lossCheck = await isDailyLossLimitHit(cfg)
    if (lossCheck.halt) return { skipped: true, reason: lossCheck.reason }

    const symbols = cfg.symbols.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
    if (!symbols.length) return { skipped: true, reason: 'No symbols configured' }

    const [positions, openOrders] = await Promise.all([
      getPositions().catch(() => []),
      getOrders('open').catch(() => []),
    ])

    if (positions.length >= 3) {
      addLog('SCAN_SKIP', null, `Max positions (${positions.length}/3) reached`)
      return { skipped: true, reason: 'Max 3 positions reached' }
    }

    const occupied = new Set([
      ...positions.map(p => p.symbol),
      ...openOrders.map(o => o.symbol),
    ])

    const results = await Promise.allSettled(symbols.map(s => analyzeMomentum(s)))
    const buySignals = results
      .map((r, i) => r.status === 'fulfilled' ? r.value : { symbol: symbols[i], action: 'ERROR' })
      .filter(s => s.action === 'BUY' && (s.strength || 0) >= cfg.minStrength)
      .filter(s => !occupied.has(s.symbol))

    addLog('SCAN', null, `Scanned ${symbols.length} — ${buySignals.length} BUY signal(s)`)

    const executed = []
    for (const sig of buySignals) {
      const current = await getPositions().catch(() => [])
      if (current.length >= 3) { addLog('SKIP', sig.symbol, 'Max positions reached mid-pass'); break }

      try {
        const order = await placeBracketOrder(sig.symbol, sig.price, {
          riskPct: cfg.riskPct,
          stopPct: cfg.stopPct,
          tpPct:   cfg.tpPct,
        })

        db().prepare(`
          INSERT OR IGNORE INTO momentum_orders
            (alpaca_order_id, symbol, qty, entry_limit, stop_loss, take_profit, mode, status, gap_pct, rvol, vwap, action)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
        `).run(
          order.orderId, sig.symbol, order.qty,
          order.entryLimit, order.stopLoss, order.takeProfit,
          order.mode, order.status,
          sig.gapPct, sig.rvol, sig.vwap, 'AUTO-BUY'
        )

        addLog('ORDER_PLACED', sig.symbol,
          `qty=${order.qty} entry=${order.entryLimit} sl=${order.stopLoss} tp=${order.takeProfit}`)
        executed.push({ symbol: sig.symbol, order })
      } catch (e) {
        addLog('ORDER_FAILED', sig.symbol, e.message)
      }
    }

    return { executed, scanned: symbols.length, signals: buySignals.length }
  } finally {
    autoRunning = false
  }
}

// ── Portfolio drop alert ──────────────────────────────────────────────────────
const alertState = { sentToday: false, lastAlertDate: null }

export async function checkPortfolioDrop(recipients) {
  if (!isMarketHours()) return
  const cfg = getAutoTradeConfig()
  const allRecipients = [...new Set([
    ...(recipients || []),
    ...(cfg.alertEmail ? [cfg.alertEmail] : []),
  ])].filter(Boolean)
  if (!allRecipients.length) return

  try {
    const account  = await getAccount()
    const equity   = parseFloat(account.equity || 0)
    const today    = todayET()
    const dayKey   = `dayStart_${today}`
    const stored   = getCfg(dayKey, null)

    if (!stored) {
      setCfg(dayKey, equity.toString())
      addLog('DAY_START', null, `Equity recorded: $${equity.toFixed(2)}`)
      return
    }

    const dayStart  = parseFloat(stored)
    const threshold = cfg.dropAlertPct / 100

    if (alertState.lastAlertDate !== today) {
      alertState.sentToday    = false
      alertState.lastAlertDate = today
    }

    const dropPct = dayStart > 0 ? (dayStart - equity) / dayStart : 0
    if (dropPct >= threshold && !alertState.sentToday) {
      alertState.sentToday = true
      addLog('DROP_ALERT', null, `Portfolio down ${(dropPct * 100).toFixed(2)}% — alerting`)
      await sendDropAlert(allRecipients, { equity, dayStart, dropPct, threshold })
    }
  } catch (e) {
    console.error('[auto-trade] checkPortfolioDrop error:', e.message)
  }
}

async function sendDropAlert(recipients, { equity, dayStart, dropPct, threshold }) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY
  if (!RESEND_API_KEY) return

  const drop    = (dropPct  * 100).toFixed(2)
  const limit   = (threshold * 100).toFixed(0)
  const dollarLoss = (dayStart - equity).toFixed(2)
  const timeET  = new Date().toLocaleTimeString('en-US', { timeZone:'America/New_York', hour:'2-digit', minute:'2-digit' })

  const html = `<!DOCTYPE html>
<html><body style="background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:0">
<div style="max-width:500px;margin:0 auto;padding:0;background:#09090b;color:#e5e7eb">
  <div style="padding:16px 20px;border-bottom:2px solid #ef4444">
    <span style="font-size:18px;font-weight:900;color:#818cf8">ATI</span>
    <span style="font-size:11px;color:#555;margin-left:8px">⚠ Portfolio Drop Alert</span>
  </div>
  <div style="padding:24px 20px">
    <div style="font-size:32px;font-weight:800;color:#ef4444;margin-bottom:8px">▼ ${drop}% Today</div>
    <p style="font-size:13px;color:#9ca3af;margin:0 0 20px">Your portfolio has dropped <strong style="color:#ef4444">${drop}%</strong> from today's open, exceeding the <strong style="color:#fbbf24">${limit}%</strong> alert threshold.</p>
    <table style="width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden">
      <tr style="background:#111"><td style="padding:12px 16px;font-size:12px;color:#6b7280;border-bottom:1px solid #1c1c1e">Day-Open Equity</td><td style="padding:12px 16px;font-size:15px;font-weight:700;color:#e5e7eb;text-align:right;border-bottom:1px solid #1c1c1e">$${parseFloat(dayStart).toLocaleString('en-US',{minimumFractionDigits:2})}</td></tr>
      <tr style="background:#111"><td style="padding:12px 16px;font-size:12px;color:#6b7280;border-bottom:1px solid #1c1c1e">Current Equity</td><td style="padding:12px 16px;font-size:15px;font-weight:700;color:#ef4444;text-align:right;border-bottom:1px solid #1c1c1e">$${equity.toLocaleString('en-US',{minimumFractionDigits:2})}</td></tr>
      <tr style="background:#111"><td style="padding:12px 16px;font-size:12px;color:#6b7280">Dollar Loss</td><td style="padding:12px 16px;font-size:15px;font-weight:700;color:#ef4444;text-align:right">−$${parseFloat(dollarLoss).toLocaleString('en-US',{minimumFractionDigits:2})}</td></tr>
    </table>
    <p style="font-size:11px;color:#4b5563;margin-top:16px">Triggered at ${timeET} ET · One alert per day</p>
    <p style="font-size:10px;color:#374151;margin-top:8px">Advanced Trade Intelligence · Not investment advice</p>
  </div>
</div>
</body></html>`

  for (const email of recipients) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization:`Bearer ${RESEND_API_KEY}`, 'Content-Type':'application/json' },
        body: JSON.stringify({
          from: 'ATI Alerts <onboarding@resend.dev>',
          to:   [email],
          subject: `🚨 ATI Alert: Portfolio Down ${drop}%`,
          html,
        }),
      })
      console.log(`[auto-trade] Drop alert → ${email}`)
    } catch (e) { console.error('[auto-trade] drop alert send error:', e.message) }
  }
}

// ── EOD Summary ───────────────────────────────────────────────────────────────
export async function sendEodSummary(recipients) {
  const cfg = getAutoTradeConfig()
  const allRecipients = [...new Set([
    ...(recipients || []),
    ...(cfg.alertEmail ? [cfg.alertEmail] : []),
  ])].filter(Boolean)

  if (!allRecipients.length) {
    console.warn('[auto-trade] EOD summary skipped — no recipients')
    return
  }
  const RESEND_API_KEY = process.env.RESEND_API_KEY
  if (!RESEND_API_KEY) { console.warn('[auto-trade] EOD skipped — no RESEND_API_KEY'); return }

  try {
    const today    = todayET()
    const dayKey   = `dayStart_${today}`
    const account  = await getAccount().catch(() => null)
    const positions = await getPositions().catch(() => [])
    const todayOrders = db().prepare(
      `SELECT * FROM momentum_orders WHERE date(created_at) = ? ORDER BY created_at DESC`
    ).all(today)

    const equity   = account ? parseFloat(account.equity || 0) : 0
    const dayStart = parseFloat(getCfg(dayKey, equity.toString()))
    const dayPnl   = equity - dayStart
    const dayPnlPct = dayStart > 0 ? (dayPnl / dayStart) * 100 : 0
    const pnlColor = dayPnl >= 0 ? '#30d158' : '#ff453a'
    const sign     = dayPnl >= 0 ? '+' : ''
    const modeTag  = String(getCfg('mode', 'PAPER')).toUpperCase()

    const posRows = positions.length
      ? positions.map(p => {
          const pnl  = parseFloat(p.unrealized_pl || 0)
          const col  = pnl >= 0 ? '#30d158' : '#ff453a'
          const sgn  = pnl >= 0 ? '+' : ''
          return `<tr>
  <td style="padding:8px 12px;font-weight:700;color:#f3f4f6">${p.symbol}</td>
  <td style="padding:8px 12px;color:#9ca3af">${parseFloat(p.qty)}</td>
  <td style="padding:8px 12px;color:#9ca3af">$${parseFloat(p.avg_entry_price||0).toFixed(2)}</td>
  <td style="padding:8px 12px;color:#e5e7eb">$${parseFloat(p.current_price||0).toFixed(2)}</td>
  <td style="padding:8px 12px;font-weight:700;color:${col}">${sgn}$${Math.abs(pnl).toFixed(2)}</td>
</tr>`
        }).join('')
      : `<tr><td colspan="5" style="padding:12px;color:#6b7280;text-align:center;font-size:12px">No open positions at close</td></tr>`

    const orderRows = todayOrders.length
      ? todayOrders.map(o => `<tr>
  <td style="padding:6px 10px;font-weight:700;color:#f3f4f6">${o.symbol}</td>
  <td style="padding:6px 10px;color:#818cf8;font-size:11px">${o.action || 'BUY'}</td>
  <td style="padding:6px 10px;color:#9ca3af">$${o.entry_limit?.toFixed(2)||'—'}</td>
  <td style="padding:6px 10px;color:#ef4444">$${o.stop_loss?.toFixed(2)||'—'}</td>
  <td style="padding:6px 10px;color:#30d158">$${o.take_profit?.toFixed(2)||'—'}</td>
  <td style="padding:6px 10px;color:#6b7280;font-size:11px">${o.status}</td>
</tr>`).join('')
      : `<tr><td colspan="6" style="padding:12px;color:#6b7280;text-align:center;font-size:12px">No orders placed today</td></tr>`

    const dateStr = new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'})

    const html = `<!DOCTYPE html>
<html><body style="background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:0">
<div style="max-width:600px;margin:0 auto;background:#09090b;color:#e5e7eb">
  <div style="padding:16px 20px;border-bottom:1px solid #1c1c1e">
    <table style="width:100%;border-collapse:collapse"><tr>
      <td><span style="font-size:18px;font-weight:900;color:#818cf8">ATI</span><span style="font-size:11px;color:#555;margin-left:8px">End-of-Day Summary · ${dateStr}</span></td>
      <td style="text-align:right"><span style="font-size:10px;padding:2px 8px;background:#1c1c1e;color:#818cf8;border-radius:4px;font-weight:700">${modeTag}</span></td>
    </tr></table>
  </div>

  <div style="padding:20px;border-bottom:1px solid #1c1c1e">
    <div style="font-size:10px;color:#6b7280;font-weight:700;letter-spacing:1.5px;margin-bottom:12px">📊 TODAY'S P&L</div>
    <table style="width:100%;border-collapse:collapse">
      <tr>
        <td style="padding:12px;background:#111;border-radius:8px 0 0 8px;border-right:1px solid #1c1c1e">
          <div style="font-size:10px;color:#6b7280;margin-bottom:4px">Day-Open Equity</div>
          <div style="font-size:20px;font-weight:700;color:#e5e7eb">$${dayStart.toLocaleString('en-US',{minimumFractionDigits:2})}</div>
        </td>
        <td style="padding:12px;background:#111;border-right:1px solid #1c1c1e">
          <div style="font-size:10px;color:#6b7280;margin-bottom:4px">Closing Equity</div>
          <div style="font-size:20px;font-weight:700;color:#e5e7eb">$${equity.toLocaleString('en-US',{minimumFractionDigits:2})}</div>
        </td>
        <td style="padding:12px;background:#111;border-radius:0 8px 8px 0">
          <div style="font-size:10px;color:#6b7280;margin-bottom:4px">Day P&L</div>
          <div style="font-size:22px;font-weight:800;color:${pnlColor}">${sign}$${Math.abs(dayPnl).toLocaleString('en-US',{minimumFractionDigits:2})}</div>
          <div style="font-size:13px;font-weight:700;color:${pnlColor}">${sign}${dayPnlPct.toFixed(2)}%</div>
        </td>
      </tr>
    </table>
  </div>

  <div style="padding:20px;border-bottom:1px solid #1c1c1e">
    <div style="font-size:10px;color:#6b7280;font-weight:700;letter-spacing:1.5px;margin-bottom:12px">📂 OPEN POSITIONS (${positions.length})</div>
    <table style="width:100%;border-collapse:collapse;background:#111;border-radius:8px;overflow:hidden">
      <tr style="background:#1c1c1e">
        <th style="padding:8px 12px;text-align:left;font-size:10px;color:#6b7280">Symbol</th>
        <th style="padding:8px 12px;text-align:left;font-size:10px;color:#6b7280">Qty</th>
        <th style="padding:8px 12px;text-align:left;font-size:10px;color:#6b7280">Avg Cost</th>
        <th style="padding:8px 12px;text-align:left;font-size:10px;color:#6b7280">Last Price</th>
        <th style="padding:8px 12px;text-align:left;font-size:10px;color:#6b7280">Unrealized P&L</th>
      </tr>
      ${posRows}
    </table>
  </div>

  <div style="padding:20px;border-bottom:1px solid #1c1c1e">
    <div style="font-size:10px;color:#6b7280;font-weight:700;letter-spacing:1.5px;margin-bottom:12px">⚡ TODAY'S ORDERS (${todayOrders.length})</div>
    <table style="width:100%;border-collapse:collapse;background:#111;border-radius:8px;overflow:hidden">
      <tr style="background:#1c1c1e">
        <th style="padding:6px 10px;text-align:left;font-size:10px;color:#6b7280">Symbol</th>
        <th style="padding:6px 10px;text-align:left;font-size:10px;color:#6b7280">Type</th>
        <th style="padding:6px 10px;text-align:left;font-size:10px;color:#6b7280">Entry</th>
        <th style="padding:6px 10px;text-align:left;font-size:10px;color:#6b7280">Stop</th>
        <th style="padding:6px 10px;text-align:left;font-size:10px;color:#6b7280">Target</th>
        <th style="padding:6px 10px;text-align:left;font-size:10px;color:#6b7280">Status</th>
      </tr>
      ${orderRows}
    </table>
  </div>

  <div style="padding:14px 20px;text-align:center;font-size:10px;color:#333;border-top:1px solid #1c1c1e">
    Advanced Trade Intelligence · Not investment advice · Auto-generated EOD report
  </div>
</div>
</body></html>`

    let sent = 0
    for (const email of allRecipients) {
      try {
        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization:`Bearer ${RESEND_API_KEY}`, 'Content-Type':'application/json' },
          body: JSON.stringify({
            from:    'ATI <onboarding@resend.dev>',
            to:      [email],
            subject: `ATI EOD: ${sign}${dayPnlPct.toFixed(2)}% · ${dateStr}`,
            html,
          }),
        })
        if (r.ok) { sent++; console.log(`[auto-trade] EOD summary → ${email}`) }
        else { const d = await r.json(); console.error('[auto-trade] EOD send error:', d) }
      } catch (e) { console.error('[auto-trade] EOD send error:', e.message) }
    }
    addLog('EOD_SENT', null, `EOD summary → ${sent} recipient(s)`)
  } catch (e) {
    console.error('[auto-trade] sendEodSummary error:', e.message)
  }
}

// ── Log retrieval ─────────────────────────────────────────────────────────────
export function getAutoTradeLog(limit = 60) {
  try {
    return db().prepare('SELECT * FROM auto_trade_log ORDER BY created_at DESC LIMIT ?').all(limit)
  } catch { return [] }
}
