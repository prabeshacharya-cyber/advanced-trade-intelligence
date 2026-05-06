import { Router } from 'express'
import { runBacktest, getBacktestHistory, getWinRateSummary } from '../services/backtestService.js'

const router = Router()

router.post('/:symbol', async (req, res) => {
  try {
    const symbol    = req.params.symbol.toUpperCase()
    const lookback  = Math.min(365, parseInt(req.body?.lookback) || 60)
    const horizon   = Math.min(60,  parseInt(req.body?.horizon)  || 20)
    const minScore  = parseInt(req.body?.minScore) || 65
    const benchmark = req.body?.benchmark || 'SPY'
    const result    = await runBacktest(symbol, { lookback, horizon, minScore, benchmark })
    res.json(result)
  } catch (e) {
    res.json({ symbol: req.params.symbol, error: e.message, trades: [], stats: null })
  }
})

router.get('/:symbol/history', (req, res) => {
  try {
    const symbol  = req.params.symbol.toUpperCase()
    const history = getBacktestHistory(symbol)
    const summary = getWinRateSummary(symbol)
    res.json({ symbol, history, summary })
  } catch (e) {
    res.json({ symbol: req.params.symbol, history: [], summary: null, error: e.message })
  }
})

export default router
