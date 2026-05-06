import { Router } from 'express'
import { getMacro } from '../providers/providerManager.js'

const router = Router()

router.get('/', async (_, res) => {
  try {
    const snap = await getMacro()
    res.json(snap)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router
