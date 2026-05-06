import { Router } from 'express'
import { fetchAndStoreFilings, getFilingsFromDb, getEnrichedFundamentals } from '../services/secFilingService.js'

const router = Router()

router.get('/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase()
    const stored = getFilingsFromDb(symbol)
    if (stored.length) return res.json({ symbol, filings: stored, source: 'cache' })
    const fresh = await fetchAndStoreFilings(symbol)
    res.json({ symbol, filings: fresh, source: 'fresh' })
  } catch (e) {
    res.json({ symbol: req.params.symbol, filings: [], error: e.message })
  }
})

router.get('/:symbol/fundamentals', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase()
    const data   = await getEnrichedFundamentals(symbol)
    res.json({ symbol, ...data })
  } catch (e) {
    res.json({ symbol: req.params.symbol, error: e.message })
  }
})

router.post('/:symbol/refresh', async (req, res) => {
  try {
    const symbol  = req.params.symbol.toUpperCase()
    const filings = await fetchAndStoreFilings(symbol)
    res.json({ symbol, refreshed: filings.length })
  } catch (e) {
    res.json({ symbol: req.params.symbol, refreshed: 0, error: e.message })
  }
})

export default router
