import { Router } from 'express'
import getDb from '../db/index.js'
import { generatePodcastScript, generateMarketCommentary } from '../services/aiResearchService.js'
import { getTopScores } from '../services/stockScoreService.js'
import { getRecentNews } from '../services/newsService.js'
import { fetchWorldNews } from '../services/worldNewsService.js'
import { getMacro } from '../providers/providerManager.js'
import { getQuote as yahooQuote } from '../providers/yahooFallbackProvider.js'

const router = Router()

/* ── Table Init ──────────────────────────────────────────────────── */
function initTables() {
  const db = getDb()
  db.exec(`
    CREATE TABLE IF NOT EXISTS briefing_subscribers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS briefing_config (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    CREATE TABLE IF NOT EXISTS podcast_scripts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      script_date TEXT UNIQUE NOT NULL,
      script TEXT NOT NULL,
      model TEXT,
      ai_available INTEGER DEFAULT 0,
      generated_at TEXT DEFAULT (datetime('now'))
    );
  `)
}
initTables()

/* ── Config helpers ──────────────────────────────────────────────── */
function getCfg(key, def) {
  try {
    const row = getDb().prepare('SELECT value FROM briefing_config WHERE key=?').get(key)
    return row ? row.value : def
  } catch { return def }
}
function setCfg(key, value) {
  getDb().prepare('INSERT OR REPLACE INTO briefing_config(key,value) VALUES(?,?)').run(key, value)
}

/* Returns all recipients: admin email (always) + subscribers */
function getRecipients() {
  const db = getDb()
  const subscribers = db.prepare('SELECT email FROM briefing_subscribers').all().map(r => r.email)
  const adminEmail = getCfg('adminEmail', process.env.ADMIN_EMAIL || '')
  const all = new Set(subscribers)
  if (adminEmail && adminEmail.includes('@')) all.add(adminEmail.toLowerCase().trim())
  return [...all]
}

/* ── Podcast helpers ─────────────────────────────────────────────── */
export async function generateAndStorePodcast(force = false) {
  const today = new Date().toISOString().slice(0, 10)
  const db    = getDb()

  if (!force) {
    const existing = db.prepare('SELECT script FROM podcast_scripts WHERE script_date=?').get(today)
    if (existing) return existing.script
  }

  const topStocks = getTopScores(10)
  const news      = getRecentNews(null, 10)
  const result    = await generatePodcastScript(topStocks, news)

  db.prepare(`
    INSERT OR REPLACE INTO podcast_scripts (script_date, script, model, ai_available, generated_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `).run(today, result.text, result.model || 'fallback', result.aiAvailable ? 1 : 0)

  console.log(`[briefing] Podcast script generated (${result.model}): ${result.text.slice(0, 60)}…`)
  return result.text
}

/* ── Markdown → email-safe HTML ──────────────────────────────────── */
function mdToHtml(md) {
  if (!md) return ''
  const lines = md.split('\n')
  const out = []
  for (const raw of lines) {
    let line = raw
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code style="background:#1c1c1e;padding:1px 4px;border-radius:3px;font-size:11px">$1</code>')

    if (/^###\s+/.test(line)) {
      out.push(`<p style="font-size:13px;font-weight:800;color:#f3f4f6;margin:10px 0 4px">${line.replace(/^###\s+/, '')}</p>`)
    } else if (/^##\s+/.test(line)) {
      out.push(`<p style="font-size:14px;font-weight:800;color:#fff;margin:12px 0 4px">${line.replace(/^##\s+/, '')}</p>`)
    } else if (/^#\s+/.test(line)) {
      out.push(`<p style="font-size:15px;font-weight:900;color:#fff;margin:14px 0 6px">${line.replace(/^#\s+/, '')}</p>`)
    } else if (/^\|\s+/.test(line) || /^\| /.test(line)) {
      const txt = line.replace(/^\|\s*/, '').trim()
      out.push(`<div style="border-left:3px solid #818cf8;padding:4px 0 4px 10px;margin:6px 0;color:#c7d2fe;font-size:12px;font-weight:700">${txt}</div>`)
    } else if (/^[-•]\s+/.test(line)) {
      out.push(`<div style="padding:2px 0 2px 12px;font-size:12px;color:#d1d5db;line-height:1.6">· ${line.replace(/^[-•]\s+/, '')}</div>`)
    } else if (/^\d+\.\s+/.test(line)) {
      out.push(`<div style="padding:2px 0 2px 12px;font-size:12px;color:#d1d5db;line-height:1.6">${line}</div>`)
    } else if (line.trim() === '') {
      out.push('<div style="height:6px"></div>')
    } else {
      out.push(`<p style="font-size:12px;color:#d1d5db;line-height:1.7;margin:4px 0">${line}</p>`)
    }
  }
  return out.join('')
}

/* ── Format a change_percent value safely ────────────────────────── */
function fmtChg(val) {
  const n = parseFloat(val)
  if (isNaN(n)) return { txt: '—', col: '#6b7280' }
  const sign = n >= 0 ? '+' : ''
  const col  = n >= 0 ? '#30d158' : '#ff453a'
  return { txt: `${sign}${n.toFixed(2)}%`, col }
}

/* ── Email builder ───────────────────────────────────────────────── */
async function buildBriefingHtml(date, regeneratePodcast = false) {
  const db = getDb()

  /* Fetch all data in parallel */
  const [
    macroSnap,
    spyQ, qqqQ, diaQ,
    xlkQ, xlvQ, xleQ, xlfQ, xlcQ,
    worldNews,
    podcastScript,
  ] = await Promise.allSettled([
    getMacro(),
    yahooQuote('SPY'),
    yahooQuote('QQQ'),
    yahooQuote('DIA'),
    yahooQuote('XLK'),
    yahooQuote('XLV'),
    yahooQuote('XLE'),
    yahooQuote('XLF'),
    yahooQuote('XLC'),
    fetchWorldNews(20),
    generateAndStorePodcast(regeneratePodcast),
  ]).then(r => r.map(x => x.status === 'fulfilled' ? x.value : null))

  /* DB scores */
  const scores = db.prepare(`
    SELECT sr.symbol, sr.apex_score, sr.rating_label, sr.probability_outperform,
           s.name, s.sector
    FROM score_runs sr
    LEFT JOIN symbols s ON s.symbol = sr.symbol
    WHERE sr.asset_type='stock'
      AND sr.id = (SELECT MAX(sr2.id) FROM score_runs sr2 WHERE sr2.symbol = sr.symbol)
    ORDER BY sr.apex_score DESC LIMIT 15
  `).all()

  /* Fall back to DB news if world news fetch fails */
  let news = Array.isArray(worldNews) && worldNews.length ? worldNews : []
  if (!news.length) {
    news = db.prepare(`
      SELECT headline AS title, source, url, published_at
      FROM news_events WHERE headline IS NOT NULL AND headline != ''
      ORDER BY published_at DESC LIMIT 20
    `).all()
  }

  /* AI market commentary (cached daily — renders as HTML) */
  const topStocks = getTopScores(5)
  const commentary = await generateMarketCommentary(macroSnap, topStocks).catch(() => null)
  const commentaryHtml = mdToHtml(commentary?.text || '')

  /* Market snapshot rows */
  const indices = [
    { label: 'S&P 500', sub: 'SPY ETF', q: spyQ },
    { label: 'Nasdaq',  sub: 'QQQ ETF', q: qqqQ },
    { label: 'Dow',     sub: 'DIA ETF', q: diaQ },
  ]
  const indexRows = indices.map(({ label, sub, q }) => {
    const price = q?.price ? `$${Number(q.price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'
    const { txt: chgTxt, col: chgCol } = fmtChg(q?.change_percent)
    return `
<tr>
  <td style="padding:6px 10px">
    <span style="font-weight:700;font-size:13px;color:#f3f4f6">${label}</span>
    <span style="font-size:10px;color:#555;margin-left:4px">${sub}</span>
  </td>
  <td style="padding:6px 10px;text-align:right;font-size:13px;color:#e5e7eb">${price}</td>
  <td style="padding:6px 10px;text-align:right;font-size:13px;font-weight:700;color:${chgCol}">${chgTxt}</td>
</tr>`
  }).join('')

  /* Sector rows */
  const sectors = [
    { label: 'Technology',   sub: 'XLK', q: xlkQ },
    { label: 'Healthcare',   sub: 'XLV', q: xlvQ },
    { label: 'Energy',       sub: 'XLE', q: xleQ },
    { label: 'Financials',   sub: 'XLF', q: xlfQ },
    { label: 'Comm Svcs',    sub: 'XLC', q: xlcQ },
  ]
  const sectorRows = sectors.map(({ label, sub, q }) => {
    const { txt: chgTxt, col: chgCol } = fmtChg(q?.change_percent)
    const arrow = q?.change_percent >= 0 ? '▲' : q?.change_percent < 0 ? '▼' : '—'
    return `<tr>
  <td style="padding:4px 10px;font-size:11px;color:#9ca3af">${label} <span style="color:#555">${sub}</span></td>
  <td style="padding:4px 10px;text-align:right;font-size:11px;color:${chgCol};font-weight:700">${arrow} ${chgTxt}</td>
</tr>`
  }).join('')

  /* Macro strip */
  const vix  = macroSnap?.data?.vix?.value ?? null
  const ff   = macroSnap?.data?.fedFunds?.value ?? null
  const t10  = macroSnap?.data?.tenYearYield?.value ?? null
  const regime = (macroSnap?.regime || 'neutral').toUpperCase()
  const regimeCol = regime === 'RISK-ON' ? '#30d158' : regime === 'RISK-OFF' ? '#ff453a' : '#fbbf24'

  /* Score rows */
  const scoreRows = scores.length
    ? scores.map((s, i) => {
        const scoreColor = s.apex_score >= 60 ? '#30d158' : s.apex_score >= 45 ? '#fbbf24' : '#ff453a'
        const name   = (s.name || '').slice(0, 22)
        const sector = s.sector || ''
        const label  = s.rating_label || '—'
        const prob   = s.probability_outperform != null ? `${s.probability_outperform}%` : '—'
        return `
<tr>
  <td style="padding:5px 8px;color:#555;font-size:11px;width:18px">${i + 1}</td>
  <td style="padding:5px 8px;font-weight:700;font-size:13px;color:#f3f4f6;white-space:nowrap">${s.symbol}</td>
  <td style="padding:5px 8px;color:#6b7280;font-size:11px">${name}${sector ? ` · ${sector}` : ''}</td>
  <td style="padding:5px 8px;color:#9ca3af;font-size:11px;white-space:nowrap">${label}</td>
  <td style="padding:5px 8px;text-align:right;font-weight:800;font-size:14px;color:${scoreColor}">${s.apex_score ?? '—'}</td>
  <td style="padding:5px 8px;text-align:right;color:#6b7280;font-size:11px">${prob}</td>
</tr>`
      }).join('')
    : `<tr><td colspan="6" style="padding:12px;color:#6b7280;text-align:center;font-size:12px">No scores — run a refresh to generate.</td></tr>`

  /* News items */
  const newsItems = news.slice(0, 20).map((n, i) => `
<tr>
  <td style="padding:5px 6px;color:#555;font-size:11px;vertical-align:top;width:22px">${i + 1}.</td>
  <td style="padding:5px 6px;border-bottom:1px solid #1c1c1e">
    <a href="${n.url || '#'}" style="color:#c7d2fe;font-size:12px;line-height:1.5;text-decoration:none;display:block">${n.title}</a>
    <span style="color:#555;font-size:10px;margin-top:2px;display:block">${n.source || 'ATI'}</span>
  </td>
</tr>`).join('')

  const noNewsRow = `<tr><td colspan="2" style="padding:12px;color:#6b7280;font-size:12px;text-align:center">Headlines unavailable — check RSS sources.</td></tr>`

  const podcast = podcastScript || ''

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>ATI Morning Briefing</title>
</head>
<body style="background:#09090b;margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
<div style="max-width:600px;margin:0 auto;background:#09090b;color:#e5e7eb">

  <!-- Header -->
  <div style="padding:14px 20px;border-bottom:1px solid #1c1c1e">
    <table style="width:100%;border-collapse:collapse"><tr>
      <td>
        <span style="font-size:18px;font-weight:900;color:#818cf8;letter-spacing:-0.5px">ATI</span>
        <span style="font-size:11px;color:#555;margin-left:8px">${date} · Pre-Market Intelligence</span>
      </td>
      <td style="text-align:right">
        <span style="font-size:11px;color:#30d158;font-weight:700">● LIVE</span>
      </td>
    </tr></table>
  </div>

  <!-- Market Snapshot -->
  <div style="padding:14px 20px;border-bottom:1px solid #1c1c1e">
    <div style="font-size:10px;color:#6b7280;font-weight:700;letter-spacing:1.5px;margin-bottom:10px">📊 MARKET SNAPSHOT</div>
    <table style="width:100%;border-collapse:collapse">
      ${indexRows}
    </table>
    <table style="width:100%;border-collapse:collapse;margin-top:10px;border-top:1px solid #1c1c1e;padding-top:6px">
      <tr>
        <td style="padding:6px 10px;font-size:11px;color:#9ca3af">VIX</td>
        <td style="padding:6px 10px;font-size:13px;color:#fbbf24;font-weight:700">${vix != null ? vix.toFixed(2) : '—'}</td>
        <td style="padding:6px 10px;font-size:11px;color:#9ca3af">Fed Funds</td>
        <td style="padding:6px 10px;font-size:13px;color:#e5e7eb">${ff != null ? ff.toFixed(2) + '%' : '—'}</td>
        <td style="padding:6px 10px;font-size:11px;color:#9ca3af">10Y</td>
        <td style="padding:6px 10px;font-size:13px;color:#e5e7eb">${t10 != null ? t10.toFixed(2) + '%' : '—'}</td>
        <td style="padding:6px 10px;text-align:right">
          <span style="font-size:10px;font-weight:700;color:${regimeCol};background:${regimeCol}20;padding:2px 6px;border-radius:4px">${regime}</span>
        </td>
      </tr>
    </table>
  </div>

  <!-- Sector Performance -->
  <div style="padding:14px 20px;border-bottom:1px solid #1c1c1e">
    <div style="font-size:10px;color:#6b7280;font-weight:700;letter-spacing:1.5px;margin-bottom:8px">SECTOR PERFORMANCE</div>
    <table style="width:100%;border-collapse:collapse">
      ${sectorRows}
    </table>
  </div>

  <!-- AI Market Briefing -->
  ${commentaryHtml ? `
  <div style="padding:14px 20px;border-bottom:1px solid #1c1c1e;background:#0a0a10">
    <div style="font-size:10px;color:#818cf8;font-weight:700;letter-spacing:1.5px;margin-bottom:10px">🤖 AI MARKET BRIEFING</div>
    <div style="font-size:12px;color:#d1d5db;line-height:1.7">${commentaryHtml}</div>
  </div>` : ''}

  <!-- Market Podcast -->
  <div style="padding:14px 20px;border-bottom:1px solid #1c1c1e;background:#0d0d10">
    <div style="font-size:10px;color:#818cf8;font-weight:700;letter-spacing:1.5px;margin-bottom:8px">🎙 MORNING MARKET PODCAST</div>
    <p style="font-size:12px;color:#d1d5db;line-height:1.8;margin:0;font-style:italic">${podcast.replace(/\n/g, '<br>')}</p>
  </div>

  <!-- Top ATI Scores -->
  <div style="padding:14px 20px;border-bottom:1px solid #1c1c1e">
    <div style="font-size:10px;color:#6b7280;font-weight:700;letter-spacing:1.5px;margin-bottom:8px">TOP ATI SCORES</div>
    <table style="width:100%;border-collapse:collapse">
      ${scoreRows}
    </table>
  </div>

  <!-- Top 20 World News Headlines -->
  <div style="padding:14px 20px;border-bottom:1px solid #1c1c1e">
    <div style="font-size:10px;color:#6b7280;font-weight:700;letter-spacing:1.5px;margin-bottom:10px">🌍 TOP WORLD &amp; MARKET NEWS</div>
    <table style="width:100%;border-collapse:collapse">
      ${news.length ? newsItems : noNewsRow}
    </table>
  </div>

  <!-- Footer -->
  <div style="padding:12px 20px;text-align:center;font-size:10px;color:#333;border-top:1px solid #1c1c1e">
    Advanced Trade Intelligence &nbsp;·&nbsp; For informational purposes only &nbsp;·&nbsp; Not investment advice
  </div>

</div>
</body>
</html>`
}

export async function buildBriefingEmail(date, regeneratePodcast = false) {
  return buildBriefingHtml(date, regeneratePodcast)
}

export function getAdminRecipients() {
  return getRecipients()
}

/* ── Routes ──────────────────────────────────────────────────────── */

router.get('/config', (req, res) => {
  try {
    const sendTimeET = getCfg('sendTimeET', '07:00')
    const lastSent   = getCfg('lastSent', null)
    const lastStatus = getCfg('lastStatus', null)
    const adminEmail = getCfg('adminEmail', process.env.ADMIN_EMAIL || '')
    const subCount   = getDb().prepare('SELECT COUNT(*) as n FROM briefing_subscribers').get().n
    res.json({ sendTimeET, lastSent, lastStatus, subscriberCount: subCount, adminEmail })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/config', (req, res) => {
  try {
    const { sendTimeET, adminEmail } = req.body
    if (sendTimeET) setCfg('sendTimeET', sendTimeET)
    if (adminEmail !== undefined) setCfg('adminEmail', adminEmail.trim().toLowerCase())
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/subscribe', (req, res) => {
  try {
    const { email } = req.body
    if (!email || !email.includes('@')) return res.status(400).json({ message: 'Valid email required' })
    try {
      getDb().prepare('INSERT INTO briefing_subscribers(email) VALUES(?)').run(email.trim().toLowerCase())
      res.json({ ok: true, message: 'Subscribed! You will receive the daily ATI briefing.' })
    } catch (e) {
      if (e.message.includes('UNIQUE')) {
        res.json({ ok: true, message: 'Already subscribed — you are on the list.' })
      } else throw e
    }
  } catch (e) {
    res.status(500).json({ message: 'Subscription failed: ' + e.message })
  }
})

router.delete('/unsubscribe', (req, res) => {
  try {
    const { email } = req.body
    if (!email) return res.status(400).json({ message: 'Email required' })
    getDb().prepare('DELETE FROM briefing_subscribers WHERE email=?').run(email.trim().toLowerCase())
    res.json({ ok: true, message: 'Unsubscribed.' })
  } catch (e) {
    res.status(500).json({ message: e.message })
  }
})

router.get('/subscribers', (req, res) => {
  try {
    const rows = getDb().prepare('SELECT email, created_at FROM briefing_subscribers ORDER BY created_at DESC').all()
    res.json({ subscribers: rows, count: rows.length })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

/* World news endpoint — live RSS fetch */
router.get('/world-news', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 40)
    const items = await fetchWorldNews(limit)
    res.json({ items, count: items.length, fetchedAt: new Date().toISOString() })
  } catch (e) {
    res.status(500).json({ error: e.message, items: [] })
  }
})

/* Podcast endpoint — get today's or force regenerate */
router.get('/podcast', async (req, res) => {
  try {
    const force  = req.query.regen === '1'
    const script = await generateAndStorePodcast(force)
    const today  = new Date().toISOString().slice(0, 10)
    const row    = getDb().prepare('SELECT * FROM podcast_scripts WHERE script_date=?').get(today)
    res.json({ script, date: today, model: row?.model || 'unknown', ai_available: row?.ai_available === 1, generated_at: row?.generated_at })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/preview', async (req, res) => {
  try {
    const date = new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })
    const html = await buildBriefingHtml(date, false)
    res.setHeader('Content-Type', 'text/html')
    res.send(html)
  } catch (e) {
    res.status(500).send('<p style="color:red">Preview error: ' + e.message + '</p>')
  }
})

router.post('/send-now', async (req, res) => {
  try {
    const RESEND_API_KEY = process.env.RESEND_API_KEY
    if (!RESEND_API_KEY) return res.status(500).json({ message: 'RESEND_API_KEY not configured' })

    const recipients = getRecipients()
    if (!recipients.length) return res.status(400).json({ message: 'No recipients — set an admin email or add subscribers.' })

    const date    = new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })
    const html    = await buildBriefingHtml(date, true)
    const subject = `ATI Briefing — ${new Date().toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' })}`

    let sent = 0, failed = 0
    for (const email of recipients) {
      try {
        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: 'ATI <onboarding@resend.dev>', to: [email], subject, html }),
        })
        if (r.ok) sent++
        else { const d = await r.json(); console.error('[briefing] Resend error:', d); failed++ }
      } catch (e) { console.error('[briefing] Send error:', e.message); failed++ }
    }

    setCfg('lastSent', new Date().toISOString())
    setCfg('lastStatus', `${sent} sent, ${failed} failed`)

    res.json({ ok: true, message: `Briefing sent to ${sent} recipient${sent !== 1 ? 's' : ''}${failed ? ` (${failed} failed)` : ''}.` })
  } catch (e) {
    res.status(500).json({ message: 'Send failed: ' + e.message })
  }
})

export default router
