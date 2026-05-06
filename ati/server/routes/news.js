import { Router } from 'express'
import { fetchAndStoreNews, getRecentNews, getMarketNewsFromDb, fetchMarketNews } from '../services/newsService.js'

const router = Router()

router.get('/market', async (req, res) => {
  try {
    const limit  = Math.min(100, parseInt(req.query.limit) || 40)
    const stored = getMarketNewsFromDb(limit)
    if (stored.length) return res.json({ items: stored, source: 'cache', total: stored.length })
    const fresh = await fetchMarketNews()
    res.json({ items: fresh, source: 'fresh', total: fresh.length })
  } catch (e) {
    console.error('[news] market error:', e.message)
    res.json({ items: [], source: 'error', error: e.message })
  }
})

router.get('/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase()
    const limit  = Math.min(50, parseInt(req.query.limit) || 20)
    const stored = getRecentNews(symbol, limit)
    if (stored.length) return res.json({ symbol, items: stored, source: 'cache', total: stored.length })
    const fresh = await fetchAndStoreNews(symbol)
    res.json({ symbol, items: fresh, source: 'fresh', total: fresh.length })
  } catch (e) {
    console.error('[news] symbol error:', e.message)
    res.json({ symbol: req.params.symbol, items: [], error: e.message })
  }
})

router.post('/:symbol/refresh', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase()
    const items  = await fetchAndStoreNews(symbol)
    res.json({ symbol, refreshed: items.length })
  } catch (e) {
    res.json({ error: e.message })
  }
})

export default router
