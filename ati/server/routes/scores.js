import { Router } from 'express'
import { scoreStock, getLatestScoreFromDb, getTopScores } from '../services/stockScoreService.js'
import { scoreFund, getTopFundScores } from '../services/fundScoreService.js'
import { classifyAssetType } from '../services/universeService.js'
import getDb from '../db/index.js'

const router = Router()
const inProgress = new Set()

router.get('/top', (req, res) => {
  try {
    const limit  = Math.min(200, parseInt(req.query.limit) || 100)
    const scores = getTopScores(limit, 'stock')
    res.json({ scores, total: scores.length })
  } catch (e) {
    res.status(500).json({ error: e.message, scores: [] })
  }
})

router.get('/top-funds', (req, res) => {
  try {
    const limit  = Math.min(100, parseInt(req.query.limit) || 50)
    const scores = getTopFundScores(limit)
    res.json({ scores, total: scores.length })
  } catch (e) {
    res.status(500).json({ error: e.message, scores: [] })
  }
})

router.get('/:symbol/history', (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase()
    const days   = Math.min(400, parseInt(req.query.days) || 90)
    const db     = getDb()
    const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
    const rows   = db.prepare(`
      SELECT date, open, high, low, close, adjusted_close, volume
      FROM price_daily
      WHERE symbol = ? AND date >= ?
      ORDER BY date ASC
    `).all(symbol, cutoff)
    res.json({ symbol, history: rows, days })
  } catch (e) {
    res.status(500).json({ error: e.message, history: [] })
  }
})

router.get('/:symbol', (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase()
    const score  = getLatestScoreFromDb(symbol)
    if (!score) return res.json({ symbol, score: null, message: 'No score yet — POST /api/scores/:symbol/refresh to generate' })
    res.json(score)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/:symbol/refresh', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase()
    if (inProgress.has(symbol)) return res.json({ queued: false, reason: 'Already in progress' })
    inProgress.add(symbol)
    res.json({ queued: true, symbol, startedAt: new Date().toISOString() })
    try {
      const assetType = classifyAssetType(symbol)
      if (assetType === 'etf') await scoreFund(symbol)
      else await scoreStock(symbol)
    } catch (e) {
      console.error(`[scores] Refresh failed for ${symbol}:`, e.message)
    } finally {
      inProgress.delete(symbol)
    }
  } catch (e) {
    inProgress.delete(req.params.symbol?.toUpperCase())
    res.status(500).json({ error: e.message })
  }
})

export default router
