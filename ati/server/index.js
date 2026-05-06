import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync } from 'fs'

import { seedStarterUniverse } from './services/universeService.js'
import { startScheduler } from './services/schedulerService.js'
import getDb from './db/index.js'

import universeRoutes  from './routes/universe.js'
import scoresRoutes    from './routes/scores.js'
import newsRoutes      from './routes/news.js'
import filingsRoutes   from './routes/filings.js'
import alertsRoutes    from './routes/alerts.js'
import backtestRoutes  from './routes/backtest.js'
import researchRoutes  from './routes/research.js'
import jobsRoutes      from './routes/jobs.js'
import portfolioRoutes from './routes/portfolio.js'
import macroRoutes     from './routes/macro.js'
import chatRoutes      from './routes/chat.js'
import briefingRoutes  from './routes/briefing.js'
import momentumRoutes  from './routes/momentum.js'

const __dir = dirname(fileURLToPath(import.meta.url))
const app   = express()
const PORT  = parseInt(process.env.PORT) || 3001

// ── Middleware ───────────────────────────────────────────────────────────────
app.set('trust proxy', 1)
app.use(cors({ origin: '*' }))
app.use(express.json())
app.use(rateLimit({ windowMs: 60_000, max: 300, standardHeaders: true, legacyHeaders: false }))

// ── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/universe',  universeRoutes)
app.use('/api/scores',    scoresRoutes)
app.use('/api/news',      newsRoutes)
app.use('/api/filings',   filingsRoutes)
app.use('/api/alerts',    alertsRoutes)
app.use('/api/backtest',  backtestRoutes)
app.use('/api/research',  researchRoutes)
app.use('/api/jobs',      jobsRoutes)
app.use('/api/portfolio', portfolioRoutes)
app.use('/api/macro',     macroRoutes)
app.use('/api/chat',      chatRoutes)
app.use('/api/briefing',  briefingRoutes)
app.use('/api/momentum',  momentumRoutes)

// ── Health ───────────────────────────────────────────────────────────────────
app.get('/api/health', (_, res) => {
  res.json({
    status: 'ok',
    uptime: Math.round(process.uptime()),
    time: new Date().toISOString(),
    version: '1.0.0',
    paidApiRequired: false,
    note: 'ATI runs on free data sources only. Optional API keys improve signal quality.',
  })
})

// ── Global JSON error handler (catches unhandled errors in routes) ─────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  console.error('[error]', req.method, req.path, err.message)
  res.status(500).json({
    error:   'Internal server error',
    message: err.message,
    path:    req.path,
  })
})

// ── Static Client (production) ───────────────────────────────────────────────
const clientDist = join(__dir, '..', 'client', 'dist')
if (existsSync(clientDist)) {
  app.use(express.static(clientDist))
  app.get('*', (_, res) => res.sendFile(join(clientDist, 'index.html')))
}

// ── Unhandled promise rejections — log but don't crash ────────────────────
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason)
})
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err.message)
  // Don't exit — keep server alive
})

// ── Startup ──────────────────────────────────────────────────────────────────
async function start() {
  try {
    getDb()
    console.log('[db] SQLite database ready')

    const db    = getDb()
    const count = db.prepare('SELECT COUNT(*) as c FROM symbols WHERE is_active=1').get().c
    if (count === 0) {
      console.log('[universe] Seeding starter universe...')
      seedStarterUniverse()
    } else {
      console.log(`[universe] ${count} symbols in universe`)
    }

    startScheduler()

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n  ATI Server running on port ${PORT}`)
      console.log(`  Health:  http://localhost:${PORT}/api/health`)
      console.log(`  Status:  http://localhost:${PORT}/api/jobs/status`)
      console.log(`  Note: No paid API required. Add free keys to .env for better signals.\n`)
    })
  } catch (e) {
    console.error('Startup failed:', e)
    process.exit(1)
  }
}

start()
