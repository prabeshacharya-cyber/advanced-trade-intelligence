// Scoring utilities — no "guaranteed winner" language
// Use: probability_outperform, Strong Watch, Positive setup, Neutral, High risk, Low confidence

export const RATING_LABELS = {
  STRONG_WATCH:  { label: 'Strong Watch',   minScore: 80, color: '#22c55e', icon: '▲▲' },
  POSITIVE:      { label: 'Positive Setup', minScore: 65, color: '#86efac', icon: '▲' },
  NEUTRAL:       { label: 'Neutral',        minScore: 45, color: '#94a3b8', icon: '—' },
  CAUTIOUS:      { label: 'Cautious',       minScore: 30, color: '#fbbf24', icon: '▽' },
  HIGH_RISK:     { label: 'High Risk',      minScore: 0,  color: '#ef4444', icon: '▽▽' },
}

export function getRatingLabel(score) {
  for (const [, v] of Object.entries(RATING_LABELS)) {
    if (score >= v.minScore) return v
  }
  return RATING_LABELS.HIGH_RISK
}

// Map raw score (0–100) → probability_outperform (35%–75%)
export function scoreToProbability(score, confidence = 70) {
  const base = 50
  const maxDelta = 25
  const normalized = (score - 50) / 50  // -1 to 1
  const raw = base + normalized * maxDelta
  // Shrink toward 50% when confidence is low
  const confFactor = Math.min(1, confidence / 100)
  return Math.round(base + (raw - base) * confFactor)
}

export function normalise(value, min, max) {
  if (max === min) return 50
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))
}

export function weightedAverage(components) {
  const totalW = components.reduce((s, c) => s + c.weight, 0)
  if (!totalW) return 50
  return components.reduce((s, c) => s + (c.score * c.weight), 0) / totalW
}

export function momentumScore(history) {
  if (!history?.length || history.length < 20) return { score: 50, available: false }
  const prices = history.map(h => h.close).filter(Boolean)
  if (prices.length < 20) return { score: 50, available: false }
  const latest   = prices[prices.length - 1]
  const p20      = prices[prices.length - Math.min(20, prices.length)]
  const p60      = prices[prices.length - Math.min(60, prices.length)]
  const ret20    = (latest - p20) / p20
  const ret60    = (latest - p60) / p60
  const raw = 50 + ret20 * 200 + ret60 * 100
  return { score: Math.max(0, Math.min(100, raw)), available: true }
}

export function volatilityScore(history, days = 20) {
  if (!history?.length) return { score: 50, available: false }
  const prices = history.slice(-days - 1).map(h => h.close).filter(Boolean)
  if (prices.length < 5) return { score: 50, available: false }
  const returns = prices.slice(1).map((p, i) => Math.log(p / prices[i]))
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1)
  const annualVol = Math.sqrt(variance) * Math.sqrt(252) * 100
  return { score: Math.max(0, Math.min(100, 100 - annualVol * 1.5)), available: true }
}

export function fundamentalScore({ grossMargin, netMargin, revenue, netIncome, eps } = {}) {
  const hasData = grossMargin != null || netMargin != null || eps != null || revenue != null
  if (!hasData) return { score: 50, available: false }
  let score = 50
  if (grossMargin != null) score += (grossMargin - 0.3) * 100
  if (netMargin   != null) score += (netMargin - 0.05) * 200
  if (eps         != null && eps > 0) score += 10
  if (revenue     != null && revenue > 1e9) score += 5
  return { score: Math.max(0, Math.min(100, score)), available: true }
}

export function sentimentScore(newsItems = []) {
  if (!newsItems.length) return { score: 50, available: false }
  const weights = { bullish: 3, slightly_bullish: 1.5, neutral: 0, slightly_bearish: -1.5, bearish: -3 }
  const total = newsItems.reduce((s, n) => {
    const w = weights[n.sentiment] ?? 0
    const mag = n.magnitude === 'high' ? 2 : n.magnitude === 'medium' ? 1.5 : 1
    return s + w * mag
  }, 0)
  const maxPossible = newsItems.length * 6
  return { score: Math.max(0, Math.min(100, 50 + (total / maxPossible) * 50)), available: true }
}

export function shortSellScore(shortData) {
  if (!shortData?.short_volume_ratio) return { score: 50, available: false }
  const ratio = shortData.short_volume_ratio
  let score
  if (ratio > 60) score = 20
  else if (ratio > 50) score = 35
  else if (ratio > 40) score = 45
  else if (ratio > 30) score = 55
  else score = 65
  return { score, available: true }
}

/**
 * Calculate data confidence based on which components had real data.
 * - All 5 components with real data: 85–90%
 * - Partial real data: scales down proportionally
 * - Missing price history (key signal): significant penalty
 */
export function calculateConfidence(componentAvailability, sources) {
  const { hasMomentum, hasVolatility, hasFundamentals, hasNews, hasShort } = componentAvailability
  const priceAvailable   = hasMomentum || hasVolatility
  const scoreComponents  = [hasMomentum, hasVolatility, hasFundamentals, hasNews, hasShort]
  const availableCount   = scoreComponents.filter(Boolean).length

  if (!priceAvailable && availableCount === 0) return 20
  if (!priceAvailable)                          return 30 + availableCount * 5

  const base = 40 + availableCount * 10  // 50–90
  return Math.min(90, base)
}

export function buildDataQualityObject(sources, componentAvailability = {}) {
  const hasReal    = sources.some(s => s?.isRealData)
  const allSources = [...new Set(sources.filter(Boolean).map(s => s.source || 'Unknown'))]
  const confidence = calculateConfidence(componentAvailability, sources)
  let dataNote = null
  if (!hasReal) dataNote = 'No real data sources returned data — check API keys'
  return {
    isRealData: hasReal,
    sources: allSources,
    confidence,
    dataNote,
    componentAvailability,
  }
}
