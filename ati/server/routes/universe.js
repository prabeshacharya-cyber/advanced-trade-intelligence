import { Router } from 'express'
import { getActiveUniverse, getUniverseStats, seedStarterUniverse } from '../services/universeService.js'
import getDb from '../db/index.js'

const router = Router()

router.get('/', (req, res) => {
  try {
    const { assetType, sector } = req.query
    const symbols = getActiveUniverse({ assetType, sector })
    res.json({ symbols, total: symbols.length })
  } catch (e) {
    res.status(500).json({ error: e.message, symbols: [] })
  }
})

router.get('/stats', (_, res) => {
  try {
    res.json(getUniverseStats())
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/sectors', (_, res) => {
  try {
    const db   = getDb()
    const rows = db.prepare('SELECT DISTINCT sector FROM symbols WHERE is_active=1 AND sector IS NOT NULL ORDER BY sector').all()
    res.json({ sectors: rows.map(r => r.sector) })
  } catch (e) {
    res.json({ sectors: [], error: e.message })
  }
})

router.post('/seed', (_, res) => {
  try {
    const count = seedStarterUniverse()
    res.json({ seeded: count })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/:symbol', (req, res) => {
  try {
    const db  = getDb()
    const sym = db.prepare('SELECT * FROM symbols WHERE symbol=?').get(req.params.symbol.toUpperCase())
    if (!sym) return res.status(404).json({ error: 'Symbol not found' })
    res.json(sym)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router
