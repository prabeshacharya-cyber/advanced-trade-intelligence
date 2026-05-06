import { Router } from 'express'
import { generateStockResearch, generateMarketCommentary } from '../services/aiResearchService.js'
import { getLatestScoreFromDb } from '../services/stockScoreService.js'
import { getRecentNews } from '../services/newsService.js'
import { getFilingsFromDb } from '../services/secFilingService.js'
import { getMacro } from '../providers/providerManager.js'
import { getTopScores } from '../services/stockScoreService.js'

const router = Router()

router.get('/market-commentary', async (req, res) => {
  try {
    const macro      = await getMacro()
    const topStocks  = getTopScores(5)
    const commentary = await generateMarketCommentary(macro, topStocks)
    res.json(commentary)
  } catch (e) {
    res.json({
      text: 'Market commentary unavailable. ' + e.message,
      aiAvailable: false,
      error: e.message,
    })
  }
})

router.get('/:symbol', async (req, res) => {
  try {
    const symbol  = req.params.symbol.toUpperCase()
    const score   = getLatestScoreFromDb(symbol)
    const news    = getRecentNews(symbol, 10)
    const filings = getFilingsFromDb(symbol, 5)
    const result  = await generateStockResearch(symbol, score, news, filings)
    res.json(result)
  } catch (e) {
    res.json({
      symbol: req.params.symbol,
      text: `Research unavailable: ${e.message}`,
      aiAvailable: false,
      error: e.message,
    })
  }
})

export default router
