import { Router } from 'express'
import { getRecentAlerts, getAlertsForSymbol, markAlertRead, getUnreadCount } from '../services/alertService.js'

const router = Router()

router.get('/', (req, res) => {
  try {
    const limit  = Math.min(200, parseInt(req.query.limit) || 100)
    const alerts = getRecentAlerts(limit)
    const unread = getUnreadCount()
    res.json({ alerts, unread })
  } catch (e) {
    res.json({ alerts: [], unread: 0, error: e.message })
  }
})

router.get('/unread-count', (_, res) => {
  try {
    res.json({ unread: getUnreadCount() })
  } catch (e) {
    res.json({ unread: 0, error: e.message })
  }
})

router.get('/:symbol', (req, res) => {
  try {
    const alerts = getAlertsForSymbol(req.params.symbol.toUpperCase())
    res.json({ alerts })
  } catch (e) {
    res.json({ alerts: [], error: e.message })
  }
})

router.patch('/:id/read', (req, res) => {
  try {
    markAlertRead(parseInt(req.params.id))
    res.json({ success: true })
  } catch (e) {
    res.json({ success: false, error: e.message })
  }
})

export default router
