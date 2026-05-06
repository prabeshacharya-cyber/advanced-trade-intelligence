import getDb from '../db/index.js'
import {
  weightedAverage, momentumScore, volatilityScore, sentimentScore,
  getRatingLabel, scoreToProbability, buildDataQualityObject,
} from './scoreUtils.js'
import { getPriceHistory, getQuote } from '../providers/providerManager.js'
import { getBullishEvents, getBearishEvents } from './newsService.js'

export async function scoreFund(symbol, opts = {}) {
  const horizon   = opts.horizon   || '20d'
  const benchmark = opts.benchmark || 'SPY'
  const sources   = []

  const [histResult, quoteResult] = await Promise.allSettled([
    getPriceHistory(symbol),
    getQuote(symbol),
  ])

  const hist  = histResult.status  === 'fulfilled' ? histResult.value  : null
  const quote = quoteResult.status === 'fulfilled' ? quoteResult.value : null

  if (hist)  sources.push(hist)
  if (quote) sources.push(quote)

  const newsAll = [
    ...getBullishEvents(symbol),
    ...getBearishEvents(symbol),
  ]

  const mom  = momentumScore(hist?.history)
  const vol  = volatilityScore(hist?.history)
  const sent = sentimentScore(newsAll)

  const components = [
    { name: 'momentum',      score: mom.score,  weight: 40, available: mom.available },
    { name: 'volatility',    score: vol.score,  weight: 30, available: vol.available },
    { name: 'news_sentiment',score: sent.score, weight: 30, available: sent.available },
  ]

  const componentAvailability = {
    hasMomentum:   mom.available,
    hasVolatility: vol.available,
    hasNews:       sent.available,
  }

  const apexScore  = Math.round(weightedAverage(components))
  const dq         = buildDataQualityObject(sources, componentAvailability)
  const probability = scoreToProbability(apexScore, dq.confidence)
  const rating     = getRatingLabel(apexScore)

  const bullishDrivers = []
  const bearishRisks   = []
  if (mom.available && mom.score > 60) bullishDrivers.push('ETF/Fund showing strong relative momentum')
  if (mom.available && mom.score < 40) bearishRisks.push('Fund underperforming momentum baseline')
  if (!mom.available) bearishRisks.push('No price history available — check Alpha Vantage and Yahoo connectivity')
  if (vol.available && vol.score < 35) bearishRisks.push('Elevated volatility for fund type')
  if (sent.available && sent.score > 65) bullishDrivers.push('Positive sector/fund sentiment')

  const run = {
    symbol, asset_type: 'etf',
    score_date: new Date().toISOString().slice(0, 10),
    horizon, benchmark,
    apex_score: apexScore,
    probability_outperform: probability,
    risk_score: Math.max(0, 100 - apexScore),
    confidence_score: dq.confidence,
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

  return {
    id: lastInsertRowid,
    symbol, apexScore, probability_outperform: probability,
    risk_score: run.risk_score, confidence: dq.confidence,
    rating: rating.label, ratingColor: rating.color,
    benchmark, horizon,
    bullishDrivers, bearishRisks,
    components: components.map(c => ({ name: c.name, score: Math.round(c.score), weight: c.weight, available: c.available })),
    dataQuality: dq,
    quote: quote ? { price: quote.price, change_percent: quote.change_percent } : null,
  }
}

export function getTopFundScores(limit = 30) {
  return getDb().prepare(`
    SELECT sr.*, s.name, s.sector FROM score_runs sr
    JOIN symbols s ON s.symbol = sr.symbol
    WHERE sr.asset_type='etf'
    AND sr.id = (SELECT MAX(sr2.id) FROM score_runs sr2 WHERE sr2.symbol = sr.symbol)
    ORDER BY sr.apex_score DESC LIMIT ?
  `).all(limit)
}
