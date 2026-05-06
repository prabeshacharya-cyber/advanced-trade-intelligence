import { Router } from 'express'
import { triggerManualRefresh, getJobStatus } from '../services/schedulerService.js'
import { budgetSummary } from '../services/apiBudgetService.js'
import { cacheStats } from '../services/cacheService.js'
import { getProviderStatus, getMissingOptionalKeys } from '../providers/providerManager.js'

const router = Router()

router.get('/status', (_, res) => {
  try {
    res.json({
      jobs:      getJobStatus(),
      budget:    budgetSummary(),
      cache:     cacheStats(),
      providers: getProviderStatus(),
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/refresh', (req, res) => {
  try {
    const batchSize = Math.min(10, parseInt(req.body?.batchSize) || 5)
    const result    = triggerManualRefresh(batchSize)
    res.json(result)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/data-quality', (_, res) => {
  try {
    const budget    = budgetSummary()
    const cache     = cacheStats()
    const providers = getProviderStatus()
    const missing   = getMissingOptionalKeys()

    const rateLimitWarnings = budget
      .filter(b => b.pctUsed > 80)
      .map(b => ({
        provider: b.provider,
        used:     b.used,
        limit:    b.limit,
        pctUsed:  b.pctUsed,
        warning:  `${b.provider} has used ${b.pctUsed}% of daily budget (${b.used}/${b.limit} calls)`,
      }))

    res.json({
      budget,
      cache,
      providers,
      missingOptionalKeys:   missing,
      rateLimitWarnings,
      paidApiRequired:       false,
      alwaysFreeProviders:   ['sec', 'finra', 'nasdaq_rss', 'rss', 'yahoo'],
      optionalFreeProviders: ['alpha_vantage', 'finnhub', 'fmp', 'fred', 'gemini'],
      note: 'ATI requires no paid APIs. All optional keys have free tiers. Yahoo Finance provides quote and price history fallback.',
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router
