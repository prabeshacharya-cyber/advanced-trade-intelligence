export const defaultTradingRules = {
  maxTradesPerDay: 6,
  cooldownAfterLosses: 3,
  lockout: false,
  marginWarning: true,
  ruleNote: 'Trading rules are configurable. Brokerage-specific rules vary; verify with your broker.',
}

function asNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

export function calcTradePlan(input) {
  const entry  = asNumber(input.entryPrice)
  const stop   = asNumber(input.stopLossPrice)
  const target = asNumber(input.targetPrice)
  const account   = Math.max(0, asNumber(input.accountSize))
  const riskPct   = Math.max(0, asNumber(input.maxRiskPerTradePct) / 100)
  const dailyLossPct = Math.max(0, asNumber(input.maxDailyLossPct) / 100)

  const stopDistance      = Math.abs(entry - stop)
  const dollarRiskAllowed = account * riskPct
  const positionSizeShares = stopDistance > 0 ? Math.floor(dollarRiskAllowed / stopDistance) : 0
  const estimatedCost     = positionSizeShares * entry
  const totalRisk         = positionSizeShares * stopDistance
  const riskRewardRatio   = stopDistance > 0 ? Math.abs((target - entry) / stopDistance) : 0
  const breakEvenWinRate  = riskRewardRatio > 0 ? +(100 / (1 + riskRewardRatio)).toFixed(2) : 100
  const potentialProfit   = positionSizeShares * Math.abs(target - entry)
  const dailyLossLimit    = account * dailyLossPct

  const warnings = []
  if (entry <= 0)                    warnings.push('Enter a valid entry price to calculate sizing.')
  if (stop <= 0)                     warnings.push('Enter a stop loss price to calculate risk.')
  if (entry > 0 && stop >= entry)    warnings.push('Stop loss should be below entry price (long).')
  if (totalRisk > dollarRiskAllowed) warnings.push('Position exceeds max risk per trade.')
  if (totalRisk > dailyLossLimit)    warnings.push('Single trade could breach max daily loss.')
  if (entry > 0 && stopDistance / entry < 0.002) warnings.push('Stop distance appears very tight.')
  if (entry > 0 && stopDistance / entry > 0.08)  warnings.push('Stop distance appears very wide.')
  if (riskRewardRatio > 0 && riskRewardRatio < 1.5) warnings.push('Risk/reward is below preferred threshold (1.5).')

  return {
    dollarRiskAllowed:   +dollarRiskAllowed.toFixed(2),
    positionSizeShares,
    estimatedCost:       +estimatedCost.toFixed(2),
    riskRewardRatio:     +riskRewardRatio.toFixed(2),
    breakEvenWinRate,
    potentialProfit:     +potentialProfit.toFixed(2),
    potentialLoss:       +totalRisk.toFixed(2),
    warnings,
  }
}
