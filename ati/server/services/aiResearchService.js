import { cacheGet, cacheSet } from './cacheService.js'

let genAI = null

async function getClient() {
  if (!process.env.GEMINI_API_KEY) return null
  if (!genAI) {
    try {
      const { GoogleGenAI } = await import('@google/genai')
      genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
    } catch { return null }
  }
  return genAI
}

async function generate(prompt, maxTokens = 1500) {
  const client = await getClient()
  if (!client) throw new Error('GEMINI_API_KEY not configured')
  const result = await client.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: maxTokens, temperature: 0.4 },
  })
  return result.response.text()
}

function noAIFallback(symbol, scoreData) {
  const score    = scoreData?.apexScore ?? scoreData?.apex_score ?? 'N/A'
  const rating   = scoreData?.rating_label ?? scoreData?.rating ?? 'N/A'
  const prob     = scoreData?.probability_outperform ?? 'N/A'
  const bullish  = (scoreData?.bullishDrivers || []).slice(0, 3)
  const bearish  = (scoreData?.bearishRisks || []).slice(0, 3)
  const dq       = scoreData?.dataQuality || scoreData?.data_quality_json
  const conf     = (typeof dq === 'string' ? JSON.parse(dq) : dq)?.confidence ?? 'N/A'

  return [
    `**${symbol} — Score Summary (AI Unavailable)**`,
    '',
    `ATI Score: **${score}/100** | Rating: **${rating}** | Probability of benchmark outperformance: **${prob}%** | Data Confidence: **${conf}%**`,
    '',
    bullish.length ? '**Bullish Signals:**\n' + bullish.map(b => `- ${b}`).join('\n') : '',
    bearish.length ? '\n**Risk Factors:**\n' + bearish.map(b => `- ${b}`).join('\n') : '',
    '',
    '**Note:** AI research is unavailable. Set GEMINI_API_KEY for full AI-powered analysis.',
    '',
    '*This is a system-generated summary based on available data — not investment advice.*',
  ].filter(l => l !== undefined).join('\n')
}

export async function generateStockResearch(symbol, scoreData, newsItems = [], filings = []) {
  const cacheKey = `research_${symbol}_${new Date().toISOString().slice(0, 10)}`
  const cached   = cacheGet('ai', cacheKey)
  if (cached) return cached

  if (!process.env.GEMINI_API_KEY) {
    return {
      symbol,
      text: noAIFallback(symbol, scoreData),
      generated_at: new Date().toISOString(),
      model: 'fallback',
      aiAvailable: false,
    }
  }

  const score    = scoreData?.apexScore    ?? scoreData?.apex_score ?? 'N/A'
  const rating   = scoreData?.rating_label ?? scoreData?.rating     ?? 'N/A'
  const prob     = scoreData?.probability_outperform ?? 'N/A'
  const conf     = scoreData?.confidence   ?? scoreData?.confidence_score ?? 'N/A'
  const bullish  = (scoreData?.bullishDrivers || JSON.parse(scoreData?.bullish_drivers_json || '[]')).slice(0, 3)
  const bearish  = (scoreData?.bearishRisks   || JSON.parse(scoreData?.bearish_risks_json   || '[]')).slice(0, 3)

  const prompt = `You are a professional financial research analyst. Provide a rigorous, balanced research summary for ${symbol}.

QUANTITATIVE DATA (only include information you have — do not invent):
- ATI Score: ${score}/100 (composite of momentum, fundamentals, news, short pressure)
- Rating: ${rating}
- Probability of Benchmark Outperformance: ${prob}%
- Data Confidence: ${conf}%
- Bullish signals: ${bullish.join('; ') || 'None detected'}
- Risk factors: ${bearish.join('; ') || 'None detected'}

RECENT NEWS (top 5, may be empty if none available):
${newsItems.slice(0, 5).map(n => `- [${n.sentiment}] ${n.headline}`).join('\n') || 'No recent news available'}

RECENT SEC FILINGS (top 3):
${filings.slice(0, 3).map(f => `- ${f.form_type} (${f.filing_date}): ${f.title || f.event_type}`).join('\n') || 'No recent filings indexed'}

Write a concise research summary (280-360 words) covering:
1. Business Overview & Competitive Position (2-3 sentences — only factual, well-known information)
2. Key Strengths (2-3 bullets — based only on available data)
3. Key Risks (2-3 bullets — based only on available data)
4. Score Rationale (2-3 sentences explaining the score)
5. What to Watch (1-2 sentences)

STRICT RULES:
- NEVER use "guaranteed", "risk-free", "sure profit", "will definitely" or similar language
- NEVER invent data not provided to you — state "data unavailable" if a metric is missing
- Always use "probability of benchmark outperformance" not "will outperform"
- End with exactly this disclaimer on its own line: "This is AI-generated research for informational purposes only. Not investment advice."
`

  try {
    const text   = await generate(prompt)
    const result = { symbol, text, generated_at: new Date().toISOString(), model: 'gemini-2.0-flash', aiAvailable: true }
    cacheSet('ai', cacheKey, result, 1440)
    return result
  } catch (e) {
    // On any AI error (quota, network, etc.) return the fallback — don't throw
    console.warn(`[ai] Research generation failed for ${symbol}: ${e.message}`)
    const result = {
      symbol,
      text: noAIFallback(symbol, scoreData),
      generated_at: new Date().toISOString(),
      model: 'fallback',
      aiAvailable: false,
      error: e.message.includes('quota') ? 'API quota exceeded' : e.message.slice(0, 100),
    }
    cacheSet('ai', cacheKey, result, 480)
    return result
  }
}

/* ── Podcast Script ─────────────────────────────────────────────── */

function podcastFallback(topStocks = []) {
  const top = topStocks.slice(0, 3).map(s => s.symbol).join(', ') || 'the market leaders list'
  return `Markets are setting up for today's session. The highest-scoring setups heading into the open are ${top}. Stay disciplined — look for entries with confirmation, not anticipation. Keep an eye on macro developments and watch breadth before committing to new positions. This briefing is for informational purposes only.`
}

export async function generatePodcastScript(topStocks = [], newsHeadlines = []) {
  const cacheKey = `podcast_${new Date().toISOString().slice(0, 10)}`
  const cached   = cacheGet('ai', cacheKey)
  if (cached) return cached

  if (!process.env.GEMINI_API_KEY) {
    return { text: podcastFallback(topStocks), model: 'fallback', aiAvailable: false, generated_at: new Date().toISOString() }
  }

  const topList   = topStocks.slice(0, 5).map(s => `${s.symbol} (${s.apex_score}/100 ${s.rating_label})`).join(', ')
  const headlines = newsHeadlines.slice(0, 6).map(n => n.title).join(' | ')

  const prompt = `You are a sharp, no-nonsense financial podcast host delivering a morning market briefing. Write exactly 3 short paragraphs. Total under 130 words.

INPUTS:
Top ATI Scores: ${topList || 'scores not yet generated'}
Headlines: ${headlines || 'no headlines'}

STRUCTURE:
Paragraph 1 (1-2 sentences): What kind of market are we in right now? Macro regime, risk tone.
Paragraph 2 (1-2 sentences): Key stocks or sectors to focus on today based on ATI scores.
Paragraph 3 (1 sentence): The single most important risk or watch item today.

RULES: Spoken-word, conversational, direct. Address listeners as "you". No disclaimers. No filler. No "I". Confident.`

  try {
    const text   = await generate(prompt, 280)
    const result = { text: text.trim(), model: 'gemini-2.0-flash', aiAvailable: true, generated_at: new Date().toISOString() }
    cacheSet('ai', cacheKey, result, 1440)
    return result
  } catch (e) {
    console.warn('[ai] Podcast generation failed:', e.message)
    const result = { text: podcastFallback(topStocks), model: 'fallback', aiAvailable: false, error: e.message, generated_at: new Date().toISOString() }
    cacheSet('ai', cacheKey, result, 480)
    return result
  }
}

export async function generateMarketCommentary(macroData, topStocks = []) {
  const cacheKey = `market_commentary_${new Date().toISOString().slice(0, 10)}`
  const cached   = cacheGet('ai', cacheKey)
  if (cached) return cached

  if (!process.env.GEMINI_API_KEY) {
    const topList = topStocks.slice(0, 5).map(s => `${s.symbol} (Score: ${s.apex_score})`).join(', ')
    return {
      text: `**Daily Market Intelligence (AI Unavailable)**\n\nTop scoring names today: ${topList || 'Run a refresh to generate scores'}.\n\nMacro: Fed Funds ${macroData?.data?.fedFunds?.value ?? 'N/A'}% | CPI ${macroData?.data?.cpi?.value ?? 'N/A'}% | 10Y ${macroData?.data?.tenYearYield?.value ?? 'N/A'}%.\n\nSet GEMINI_API_KEY for full AI market commentary.\n\n*For informational purposes only. Not investment advice.*`,
      generated_at: new Date().toISOString(),
      model: 'fallback',
      aiAvailable: false,
    }
  }

  const regime  = macroData?.regime || 'unknown'
  const topList = topStocks.slice(0, 5).map(s => `${s.symbol} (Score: ${s.apex_score})`).join(', ')

  const prompt = `You are a senior market strategist. Write a concise daily market intelligence brief (180-220 words).

MACRO DATA (use only what's provided — state N/A if missing):
- Macro regime: ${regime}
- Fed Funds Rate: ${macroData?.data?.fedFunds?.value ?? 'N/A'}%
- 10Y Treasury: ${macroData?.data?.tenYearYield?.value ?? 'N/A'}%
- 2Y Treasury: ${macroData?.data?.twoYearYield?.value ?? 'N/A'}%
- CPI: ${macroData?.data?.cpi?.value ?? 'N/A'}%
- Unemployment: ${macroData?.data?.unemployment?.value ?? 'N/A'}%
- Top-scoring names: ${topList || 'N/A'}

Cover:
1. Macro Backdrop (2 sentences)
2. Key Themes (2-3 bullets)
3. Sector Focus (1-2 sentences)

Do NOT invent data not provided. End with: "For informational purposes only. Not investment advice."
`
  try {
    const text   = await generate(prompt, 600)
    const result = { text, generated_at: new Date().toISOString(), model: 'gemini-2.0-flash', aiAvailable: true }
    cacheSet('ai', cacheKey, result, 1440)
    return result
  } catch (e) {
    console.warn(`[ai] Market commentary failed: ${e.message}`)
    return {
      text: `Market commentary unavailable (${e.message.includes('quota') ? 'API quota exceeded' : 'AI unavailable'}). Set or check GEMINI_API_KEY.\n\nFor informational purposes only. Not investment advice.`,
      generated_at: new Date().toISOString(),
      model: 'fallback',
      aiAvailable: false,
      error: e.message.slice(0, 80),
    }
  }
}
