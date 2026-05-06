import getDb from '../db/index.js'
import { getPriceHistory } from '../providers/providerManager.js'
import { momentumScore, volatilityScore } from './scoreUtils.js'

export async function runBacktest(symbol, opts = {}) {
  const lookback  = Math.min(365, opts.lookback  || 60)
  const horizon   = Math.min(60,  opts.horizon   || 20)
  const minScore  = opts.minScore  || 65
  const benchmark = opts.benchmark || 'SPY'

  const [assetData, benchData] = await Promise.all([
    getPriceHistory(symbol,    lookback + horizon + 10),
    getPriceHistory(benchmark, lookback + horizon + 10),
  ])

  if (!assetData?.history?.length) {
    return {
      symbol, trades: [], stats: null,
      error: `No price history available for ${symbol}. Alpha Vantage or Yahoo must return data to run a backtest.`,
    }
  }

  const assetHistory = assetData.history
  const benchHistory = benchData?.history || []
  const trades = []
  const minIdx = 20

  for (let i = minIdx; i < assetHistory.length - horizon; i++) {
    const window   = assetHistory.slice(0, i + 1)
    const mom      = momentumScore(window)
    const vol      = volatilityScore(window)
    const simScore = Math.round(mom.score * 0.5 + vol.score * 0.3 + 50 * 0.2)
    if (simScore < minScore) continue

    const entryPrice  = assetHistory[i].close
    const exitIdx     = Math.min(i + horizon, assetHistory.length - 1)
    const exitPrice   = assetHistory[exitIdx].close
    const assetReturn = (exitPrice - entryPrice) / entryPrice

    let benchReturn = 0
    if (benchHistory.length) {
      const bEntry = benchHistory[Math.min(i, benchHistory.length - 1)]?.close
      const bExit  = benchHistory[Math.min(exitIdx, benchHistory.length - 1)]?.close
      benchReturn  = bEntry && bExit ? (bExit - bEntry) / bEntry : 0
    }

    trades.push({
      entry_date:    assetHistory[i].date,
      exit_date:     assetHistory[exitIdx].date,
      entry_price:   +entryPrice.toFixed(2),
      exit_price:    +exitPrice.toFixed(2),
      asset_return:  +(assetReturn * 100).toFixed(2),
      bench_return:  +(benchReturn * 100).toFixed(2),
      excess_return: +((assetReturn - benchReturn) * 100).toFixed(2),
      signal_score:  simScore,
      hit:           assetReturn > benchReturn ? 1 : 0,
    })
  }

  if (!trades.length) {
    return {
      symbol, trades: [], stats: null,
      note: `No signals met the ${minScore} score threshold over this period. Try lowering minScore.`,
    }
  }

  const hits       = trades.filter(t => t.hit).length
  const winRate    = +(hits / trades.length * 100).toFixed(1)
  const avgExcess  = +(trades.reduce((s, t) => s + t.excess_return, 0) / trades.length).toFixed(2)
  const avgReturn  = +(trades.reduce((s, t) => s + t.asset_return,  0) / trades.length).toFixed(2)

  const stats = {
    total_signals:     trades.length,
    win_rate:          winRate,
    avg_excess_return: avgExcess,
    avg_asset_return:  avgReturn,
    best_trade:        +Math.max(...trades.map(t => t.excess_return)).toFixed(2),
    worst_trade:       +Math.min(...trades.map(t => t.excess_return)).toFixed(2),
    benchmark,
    horizon_days:      horizon,
    min_score:         minScore,
    price_source:      assetData.source || 'unknown',
    note:              'Simulated backtest using real price history. Past performance does not predict future returns. For research use only.',
  }

  const db = getDb()
  const insertPred = db.prepare(`
    INSERT INTO predictions
      (symbol, prediction_date, horizon_days, benchmark,
       price_at_prediction, asset_return, benchmark_return, excess_return, hit, completed)
    VALUES(@symbol,@prediction_date,@horizon_days,@benchmark,
           @price_at_prediction,@asset_return,@benchmark_return,@excess_return,@hit,1)
  `)
  db.transaction(() => {
    trades.slice(-20).forEach(t => insertPred.run({
      symbol, prediction_date: t.entry_date, horizon_days: horizon, benchmark,
      price_at_prediction: t.entry_price,
      asset_return:    t.asset_return,
      benchmark_return: t.bench_return,
      excess_return:   t.excess_return,
      hit:             t.hit,
    }))
  })()

  return { symbol, trades: trades.slice(-30), stats }
}

export function getBacktestHistory(symbol, limit = 50) {
  return getDb().prepare(
    'SELECT * FROM predictions WHERE symbol=? AND completed=1 ORDER BY prediction_date DESC LIMIT ?'
  ).all(symbol, limit)
}

export function getWinRateSummary(symbol) {
  const row = getDb().prepare(
    'SELECT AVG(hit) as win_rate, AVG(excess_return) as avg_excess, COUNT(*) as total FROM predictions WHERE symbol=? AND completed=1'
  ).get(symbol)
  return row?.total > 0
    ? { win_rate: +(row.win_rate * 100).toFixed(1), avg_excess: +row.avg_excess?.toFixed(2), total: row.total }
    : null
}
