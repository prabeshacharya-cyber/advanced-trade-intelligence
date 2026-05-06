import cron from 'node-cron'
import getDb from '../db/index.js'
import { getActiveUniverse } from './universeService.js'
import { fetchAndStoreNews, fetchMarketNews } from './newsService.js'
import { fetchAndStoreFilings } from './secFilingService.js'
import { scoreStock } from './stockScoreService.js'
import { scoreFund } from './fundScoreService.js'
import { checkAndCreateAlerts } from './alertService.js'
import { getLatestScoreFromDb } from './stockScoreService.js'
import { budgetSummary } from './apiBudgetService.js'
import {
  runAutoTradePass,
  checkPortfolioDrop,
  sendEodSummary,
  isMarketHours,
  getAutoTradeConfig,
} from './autoTradingService.js'

async function regeneratePodcast() {
  try {
    const { generateAndStorePodcast } = await import('../routes/briefing.js')
    await generateAndStorePodcast(true)
    console.log('[scheduler] Podcast script regenerated for today.')
  } catch (e) {
    console.warn('[scheduler] Podcast regen failed:', e.message)
  }
}

async function sendMorningBriefing() {
  const RESEND_API_KEY = process.env.RESEND_API_KEY
  if (!RESEND_API_KEY) {
    console.warn('[scheduler] Briefing send skipped — RESEND_API_KEY not configured.')
    return
  }
  try {
    const { buildBriefingEmail, getAdminRecipients } = await import('../routes/briefing.js')
    const recipients = getAdminRecipients()
    if (!recipients.length) {
      console.warn('[scheduler] Briefing send skipped — no recipients (set admin email or add subscribers).')
      return
    }

    const date    = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    const html    = await buildBriefingEmail(date)
    const subject = `ATI Morning Briefing — ${new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`

    let sent = 0, failed = 0
    for (const email of recipients) {
      try {
        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: 'ATI <onboarding@resend.dev>', to: [email], subject, html }),
        })
        if (r.ok) { sent++; console.log(`[scheduler] Briefing sent to ${email}`) }
        else { const d = await r.json(); console.error('[scheduler] Resend error:', d); failed++ }
      } catch (e) { console.error('[scheduler] Send error:', e.message); failed++ }
    }

    const db = getDb()
    db.prepare('INSERT OR REPLACE INTO briefing_config(key,value) VALUES(?,?)').run('lastSent', new Date().toISOString())
    db.prepare('INSERT OR REPLACE INTO briefing_config(key,value) VALUES(?,?)').run('lastStatus', `${sent} sent, ${failed} failed`)
    console.log(`[scheduler] Morning briefing: ${sent} sent, ${failed} failed.`)
  } catch (e) {
    console.error('[scheduler] Briefing send failed:', e.message)
  }
}

let isRunning = false
const jobStatus = { lastRun: null, errors: [], completedSymbols: 0, totalSymbols: 0 }

async function refreshUniverse(batchSize = 5) {
  if (isRunning) return
  isRunning = true
  try {
    const symbols = getActiveUniverse()
    jobStatus.totalSymbols = symbols.length
    jobStatus.completedSymbols = 0
    jobStatus.lastRun = new Date().toISOString()

    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize)
      await Promise.allSettled(
        batch.map(async (sym) => {
          try {
            const prev = getLatestScoreFromDb(sym.symbol)
            await fetchAndStoreNews(sym.symbol)
            if (sym.asset_type === 'etf') {
              await scoreFund(sym.symbol)
            } else {
              await scoreStock(sym.symbol)
            }
            await checkAndCreateAlerts(sym.symbol, prev)
            jobStatus.completedSymbols++
          } catch (e) {
            jobStatus.errors.push({ symbol: sym.symbol, error: e.message, at: new Date().toISOString() })
          }
        })
      )
      // Small delay between batches to respect rate limits
      await new Promise(r => setTimeout(r, 500))
    }

    await fetchMarketNews()
    console.log(`[scheduler] Refresh complete. ${jobStatus.completedSymbols}/${jobStatus.totalSymbols} symbols processed.`)
    console.log(`[scheduler] Budget summary:`, budgetSummary())
  } catch (e) {
    console.error('[scheduler] Fatal error:', e.message)
    jobStatus.errors.push({ error: e.message, at: new Date().toISOString() })
  } finally {
    isRunning = false
  }
}

export function startScheduler() {
  // Every weekday at 6:30 AM EST (11:30 UTC) — pre-market prep
  cron.schedule('30 11 * * 1-5', () => {
    console.log('[scheduler] Pre-market refresh starting...')
    refreshUniverse(3)
  })

  // Every weekday at 4:30 PM EST (21:30 UTC) — post-market refresh
  cron.schedule('30 21 * * 1-5', () => {
    console.log('[scheduler] Post-market refresh starting...')
    refreshUniverse(5)
  })

  // News-only refresh every 2 hours during weekdays
  cron.schedule('0 */2 * * 1-5', () => {
    console.log('[scheduler] News refresh starting...')
    fetchMarketNews().catch(console.error)
  })

  // Daily podcast script regeneration at 7:00 AM EST (12:00 UTC) every weekday
  cron.schedule('0 12 * * 1-5', () => {
    console.log('[scheduler] Regenerating daily podcast script...')
    regeneratePodcast()
  })

  // Daily morning briefing email at 7:10 AM EST (12:10 UTC) every weekday
  cron.schedule('10 12 * * 1-5', () => {
    console.log('[scheduler] Sending morning briefing...')
    sendMorningBriefing()
  })

  // Auto-trade + portfolio drop check: every 5 minutes on weekdays
  cron.schedule('*/5 * * * 1-5', async () => {
    if (!isMarketHours()) return
    const cfg = getAutoTradeConfig()
    // Auto-trade pass (only when enabled)
    if (cfg.enabled) {
      runAutoTradePass().catch(e => console.error('[scheduler] auto-trade error:', e.message))
    }
    // Portfolio drop alert (always runs during market hours if recipients configured)
    try {
      const { getAdminRecipients } = await import('../routes/briefing.js')
      checkPortfolioDrop(getAdminRecipients()).catch(e =>
        console.error('[scheduler] drop-check error:', e.message)
      )
    } catch (e) { console.error('[scheduler] drop-check import error:', e.message) }
  })

  // EOD summary email: 4:35 PM EST (21:35 UTC) every weekday
  cron.schedule('35 21 * * 1-5', async () => {
    console.log('[scheduler] Sending EOD summary...')
    try {
      const { getAdminRecipients } = await import('../routes/briefing.js')
      sendEodSummary(getAdminRecipients()).catch(e =>
        console.error('[scheduler] EOD summary error:', e.message)
      )
    } catch (e) { console.error('[scheduler] EOD import error:', e.message) }
  })

  console.log('[scheduler] Cron jobs registered. Pre-market: 6:30 AM EST · Podcast: 7:00 AM EST · Briefing Email: 7:10 AM EST · Post-market: 4:30 PM EST · Auto-trade: every 5 min · EOD Summary: 4:35 PM EST.')
}

export function triggerManualRefresh(batchSize = 5) {
  if (isRunning) return { queued: false, reason: 'Refresh already in progress' }
  refreshUniverse(batchSize).catch(console.error)
  return { queued: true, startedAt: new Date().toISOString() }
}

export function getJobStatus() {
  return { ...jobStatus, isRunning, recentErrors: jobStatus.errors.slice(-10) }
}
