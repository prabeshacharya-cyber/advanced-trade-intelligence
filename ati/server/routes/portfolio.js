import { Router } from 'express'
import getDb from '../db/index.js'
import { getQuote } from '../providers/providerManager.js'

const router = Router()

router.get('/', (_, res) => {
  try {
    const db  = getDb()
    const pos = db.prepare('SELECT * FROM portfolio_positions ORDER BY added_at DESC').all()
    res.json({ positions: pos })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/summary', async (_, res) => {
  try {
    const db  = getDb()
    const pos = db.prepare('SELECT * FROM portfolio_positions').all()
    if (!pos.length) return res.json({ positions: [], totalCost: 0, totalValue: 0, totalPnl: 0, totalPnlPct: 0 })

    const withQuotes = await Promise.all(pos.map(async p => {
      const q = await getQuote(p.symbol)
      const price = q?.price ?? p.avg_cost
      const cost  = p.shares * p.avg_cost
      const value = p.shares * price
      return {
        ...p,
        currentPrice:   price,
        changePercent:  q?.change_percent ?? 0,
        cost,
        value,
        pnl:    value - cost,
        pnlPct: ((value - cost) / cost) * 100,
      }
    }))

    const totalCost  = withQuotes.reduce((s, p) => s + p.cost, 0)
    const totalValue = withQuotes.reduce((s, p) => s + p.value, 0)

    res.json({
      positions:   withQuotes,
      totalCost,
      totalValue,
      totalPnl:    totalValue - totalCost,
      totalPnlPct: totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/', (req, res) => {
  try {
    const { symbol, shares, avg_cost, notes } = req.body
    if (!symbol || !shares || !avg_cost) return res.status(400).json({ error: 'symbol, shares, avg_cost required' })
    const db = getDb()
    db.prepare(`
      INSERT INTO portfolio_positions (symbol, shares, avg_cost, notes)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(symbol) DO UPDATE SET
        shares   = shares + excluded.shares,
        avg_cost = ((avg_cost * shares) + (excluded.avg_cost * excluded.shares)) / (shares + excluded.shares),
        notes    = COALESCE(excluded.notes, notes),
        updated_at = datetime('now')
    `).run(symbol.toUpperCase(), +shares, +avg_cost, notes || null)
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.put('/:symbol', (req, res) => {
  try {
    const { shares, avg_cost, notes } = req.body
    const db = getDb()
    db.prepare(`
      UPDATE portfolio_positions SET shares=?, avg_cost=?, notes=?, updated_at=datetime('now')
      WHERE symbol=?
    `).run(+shares, +avg_cost, notes || null, req.params.symbol.toUpperCase())
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.delete('/:symbol', (req, res) => {
  try {
    getDb().prepare('DELETE FROM portfolio_positions WHERE symbol=?').run(req.params.symbol.toUpperCase())
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router
