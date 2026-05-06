function avg(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0 }

export function computeTradeValues(t) {
  const shares = Number(t.shares || 0)
  const entry  = Number(t.entry  || 0)
  const exit   = Number(t.exit   || 0)
  const fees   = Number(t.fees   || 0)
  const dir    = t.direction === 'short' ? -1 : 1
  const gross  = (exit - entry) * shares * dir
  const net    = gross - fees
  const riskPerShare = Math.abs(entry - Number(t.stop || entry))
  const rMultiple    = riskPerShare > 0 ? net / (riskPerShare * shares) : 0
  return { grossPnL: +gross.toFixed(2), netPnL: +net.toFixed(2), rMultiple: +rMultiple.toFixed(2) }
}

export function computeJournalMetrics(trades) {
  const vals   = trades.map(t => computeTradeValues(t).netPnL)
  const wins   = vals.filter(v => v > 0)
  const losses = vals.filter(v => v < 0)
  let equity = 0, peak = 0, maxDrawdown = 0
  for (const pnl of vals) {
    equity += pnl
    peak = Math.max(peak, equity)
    maxDrawdown = Math.min(maxDrawdown, equity - peak)
  }
  return {
    tradeCount:   trades.length,
    winRate:      trades.length ? +((wins.length / trades.length) * 100).toFixed(2) : 0,
    averageWin:   +avg(wins).toFixed(2),
    averageLoss:  +avg(losses).toFixed(2),
    profitFactor: losses.length
      ? +(Math.abs(wins.reduce((a,b)=>a+b,0) / losses.reduce((a,b)=>a+b,0))).toFixed(2)
      : 0,
    maxDrawdown:  +maxDrawdown.toFixed(2),
  }
}
