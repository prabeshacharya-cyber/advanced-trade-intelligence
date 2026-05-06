import getDb from '../db/index.js'
import {
  weightedAverage, momentumScore, volatilityScore, fundamentalScore,
  sentimentScore, shortSellScore, getRatingLabel, scoreToProbability,
  buildDataQualityObject,
} from './scoreUtils.js'
import { getPriceHistory, getQuote, getShortVolume } from '../providers/providerManager.js'
import { getEnrichedFundamentals } from './secFilingService.js'
import { getBullishEvents, getBearishEvents } from './newsService.js'
import { getDefaultBenchmark } from './universeService.js'

export async function scoreStock(symbol, opts = {}) {
  const horizon   = opts.horizon   || '20d'
  const benchmark = opts.benchmark || getDefaultBenchmark(symbol)
  const sources   = []

  const [histResult, quoteResult, shortResult, fundResult] = await Promise.allSettled([
    getPriceHistory(symbol),
    getQuote(symbol),
    getShortVolume(symbol),
    getEnrichedFundamentals(symbol),
  ])

  const hist   = histResult.status   === 'fulfilled' ? histResult.value   : null
  const quote  = quoteResult.status  === 'fulfilled' ? quoteResult.value  : null
  const shortD = shortResult.status  === 'fulfilled' ? shortResult.value  : null
  const fund   = fundResult.status   === 'fulfilled' ? fundResult.value   : {}

  if (hist)   sources.push(hist)
  if (quote)  sources.push(quote)
  if (shortD) sources.push(shortD)

  const bullish = getBullishEvents(symbol)
  const bearish = getBearishEvents(symbol)
  const newsAll = [...bullish, ...bearish]

  // Each scorer now returns { score, available } so we know which components have real data
  const mom  = momentumScore(hist?.history)
  const vol  = volatilityScore(hist?.history)
  const fund_s = fundamentalScore(fund)
  const sent = sentimentScore(newsAll)
  const short_s = shortSellScore(shortD)

  const components = [
    { name: 'momentum',      score: mom.score,    weight: 25, available: mom.available },
    { name: 'volatility',    score: vol.score,    weight: 15, available: vol.available },
    { name: 'fundamentals',  score: fund_s.score, weight: 25, available: fund_s.available },
    { name: 'news_sentiment',score: sent.score,   weight: 20, available: sent.available },
    { name: 'short_pressure',score: short_s.score,weight: 15, available: short_s.available },
  ]

  const componentAvailability = {
    hasMomentum:     mom.available,
    hasVolatility:   vol.available,
    hasFundamentals: fund_s.available,
    hasNews:         sent.available,
    hasShort:        short_s.available,
  }

  const apexScore = Math.round(weightedAverage(components))
  const dq        = buildDataQualityObject(sources, componentAvailability)
  const confidence= dq.confidence
  const probability = scoreToProbability(apexScore, confidence)
  const rating    = getRatingLabel(apexScore)

  const bullishDrivers = []
  const bearishRisks   = []

  if (mom.available && mom.score > 60) bullishDrivers.push('Price momentum above baseline')
  if (mom.available && mom.score < 40) bearishRisks.push('Negative price momentum')
  if (!mom.available) bearishRisks.push('No price history available — check Alpha Vantage and Yahoo connectivity')
  if (fund_s.available && fund_s.score > 65) bullishDrivers.push('Positive fundamentals signal')
  if (fund_s.available && fund_s.score < 35) bearishRisks.push('Weak fundamental metrics')
  if (!fund_s.available) bearishRisks.push('No fundamental data — SEC EDGAR or FMP key required')
  if (sent.available && sent.score > 65) bullishDrivers.push('Favorable news sentiment')
  if (sent.available && sent.score < 35) bearishRisks.push('Negative news flow')
  if (short_s.available && short_s.score < 40) bearishRisks.push('Elevated short-sale pressure')

  const run = {
    symbol, asset_type: 'stock',
    score_date: new Date().toISOString().slice(0, 10),
    horizon, benchmark,
    apex_score: apexScore,
    probability_outperform: probability,
    risk_score: Math.max(0, 100 - apexScore),
    confidence_score: confidence,
    rating_label: rating.label,
    bullish_drivers_json: JSON.stringify(bullishDrivers),
    bearish_risks_json:   JSON.stringify(bearishRisks),
    data_quality_json:    JSON.stringify(dq),
  }

  const db = getDb()
  const { lastInsertRowid } = db.prepare(`
    INSERT INTO score_runs
      (symbol, asset_type, score_date, horizon, benchmark,
       apex_score, probability_outperform, risk_score, confidence_score,
       rating_label, bullish_drivers_json, bearish_risks_json, data_quality_json)
    VALUES(@symbol,@asset_type,@score_date,@horizon,@benchmark,
           @apex_score,@probability_outperform,@risk_score,@confidence_score,
           @rating_label,@bullish_drivers_json,@bearish_risks_json,@data_quality_json)
  `).run(run)

  const compStmt = db.prepare(`
    INSERT INTO score_components(score_run_id, component_name, component_score, component_weight, explanation)
    VALUES(?,?,?,?,?)
  `)
  db.transaction(() => {
    components.forEach(c => compStmt.run(lastInsertRowid, c.name, Math.round(c.score), c.weight, c.available ? 'real data' : 'unavailable — using neutral 50'))
  })()

  return {
    id: lastInsertRowid,
    symbol, apexScore, probability_outperform: probability,
    risk_score: run.risk_score, confidence,
    rating: rating.label, ratingColor: rating.color,
    benchmark, horizon,
    bullishDrivers, bearishRisks,
    components: components.map(c => ({ name: c.name, score: Math.round(c.score), weight: c.weight, available: c.available })),
    dataQuality: dq,
    quote: quote ? { price: quote.price, change_percent: quote.change_percent } : null,
  }
}

export function getLatestScoreFromDb(symbol) {
  const run = getDb().prepare(`
    SELECT sr.*, s.name, s.sector, s.industry
    FROM score_runs sr
    LEFT JOIN symbols s ON s.symbol = sr.symbol
    WHERE sr.symbol=? ORDER BY sr.created_at DESC LIMIT 1
  `).get(symbol)
  if (!run) return null
  return {
    ...run,
    bullishDrivers: JSON.parse(run.bullish_drivers_json || '[]'),
    bearishRisks:   JSON.parse(run.bearish_risks_json   || '[]'),
    dataQuality:    JSON.parse(run.data_quality_json     || '{}'),
  }
}

export function getTopScores(limit = 50, assetType = 'stock') {
  return getDb().prepare(`
    SELECT sr.*, s.name, s.sector FROM score_runs sr
    JOIN symbols s ON s.symbol = sr.symbol
    WHERE sr.asset_type=?
    AND sr.id = (SELECT MAX(sr2.id) FROM score_runs sr2 WHERE sr2.symbol = sr.symbol)
    ORDER BY sr.apex_score DESC LIMIT ?
  `).all(assetType, limit)
}
