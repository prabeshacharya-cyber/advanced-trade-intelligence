import { Router } from 'express'

const router = Router()

async function getGenAI() {
  if (!process.env.GEMINI_API_KEY) return null
  try {
    const { GoogleGenAI } = await import('@google/genai')
    return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  } catch { return null }
}

const SYSTEM = `You are ATI AI, an advanced financial intelligence assistant. You provide concise, institutional-quality analysis on stocks, markets, trading setups, options, risk management, and macro trends. Always flag relevant risks. Never give specific investment advice as a fiduciary. Keep responses clear and structured.`

router.post('/', async (req, res) => {
  const { messages = [] } = req.body
  try {
    const genAI = await getGenAI()
    if (!genAI) return res.json({ reply: 'AI chat requires GEMINI_API_KEY to be set.' })

    const contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

    const result = await genAI.models.generateContent({
      model: 'gemini-2.0-flash',
      contents,
      config: { systemInstruction: SYSTEM, maxOutputTokens: 1200, temperature: 0.5 },
    })
    res.json({ reply: result.response.text() })
  } catch (e) {
    res.json({ reply: 'AI chat unavailable: ' + e.message })
  }
})

router.post('/earnings-analysis', async (req, res) => {
  const { ticker, eps, date, price, change, score } = req.body
  try {
    const genAI = await getGenAI()
    if (!genAI) return res.json({ text: 'AI unavailable — set GEMINI_API_KEY.' })

    const prompt = `You are a professional earnings analyst. Provide a concise pre-earnings briefing for ${ticker}.
Known data:
- Expected EPS: ${eps ?? 'N/A'}
- Earnings date: ${date ?? 'N/A'}
- Current price: $${price ?? 'N/A'}
- Recent change: ${change ?? 'N/A'}%
- ATI score: ${score ?? 'N/A'}/100

Cover: key things to watch, historical beat/miss patterns if notable, options implied move context, and a brief risk/reward framing. 3-4 paragraphs, no disclaimers.`

    const result = await genAI.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 800, temperature: 0.4 },
    })
    res.json({ text: result.response.text() })
  } catch (e) {
    res.json({ text: 'Earnings analysis unavailable: ' + e.message })
  }
})

router.get('/earnings-calendar', async (req, res) => {
  try {
    const today = new Date()
    const from = today.toISOString().slice(0, 10)
    const to = new Date(today.getTime() + 14 * 86400000).toISOString().slice(0, 10)
    const url = `https://financialmodelingprep.com/api/v3/earning_calendar?from=${from}&to=${to}&apikey=${process.env.FMP_API_KEY}`
    const resp = await fetch(url)
    if (!resp.ok) throw new Error('FMP earnings calendar failed')
    const raw = await resp.json()
    const out = (raw || []).slice(0, 20).map(e => ({
      ticker: e.symbol,
      name: e.symbol,
      eps: e.epsEstimated,
      when: e.date,
      price: null,
      change: null,
      score: null,
    }))
    res.json(out)
  } catch (e) {
    res.json([
      { ticker:'AAPL', name:'Apple Inc.',       eps:1.61, when:'May 1, 2026',   price:195, change:0.8,  score:72 },
      { ticker:'MSFT', name:'Microsoft Corp.',   eps:3.22, when:'May 1, 2026',   price:430, change:1.1,  score:68 },
      { ticker:'META', name:'Meta Platforms',    eps:4.71, when:'Apr 30, 2026',  price:520, change:-0.4, score:65 },
      { ticker:'AMZN', name:'Amazon.com Inc.',   eps:1.04, when:'May 2, 2026',   price:187, change:0.6,  score:61 },
      { ticker:'GOOGL', name:'Alphabet Inc.',    eps:1.89, when:'Apr 29, 2026',  price:175, change:2.1,  score:63 },
    ])
  }
})

router.post('/research', async (req, res) => {
  const { ticker, question } = req.body
  try {
    const genAI = await getGenAI()
    if (!genAI) return res.json({ text: 'Deep research requires GEMINI_API_KEY.' })

    const prompt = ticker
      ? `You are a professional financial research analyst. Write a comprehensive research report for ${ticker}. Cover: business model, recent performance, competitive position, macro tailwinds/headwinds, technical setup, key risks, and a balanced outlook. 4-6 paragraphs.`
      : `You are a senior macro strategist. Answer this market research question in depth: "${question}" Be factual, cite historical precedents where relevant, and offer a balanced perspective. 4-6 paragraphs.`

    const result = await genAI.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 1500, temperature: 0.4 },
    })
    res.json({ text: result.response.text() })
  } catch (e) {
    res.json({ text: 'Research unavailable: ' + e.message })
  }
})

export default router
