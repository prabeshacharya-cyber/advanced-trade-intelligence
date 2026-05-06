import test from 'node:test'
import assert from 'node:assert/strict'

import { computeTradeValues, computeJournalMetrics } from '../src/features/journal/metrics.js'
import { calcTradePlan } from '../src/features/risk/riskEngine.js'

test('computeTradeValues returns rounded pnl and r-multiple', () => {
  const result = computeTradeValues({
    shares: 100,
    entry: 10,
    exit: 11,
    stop: 9.5,
    fees: 5,
    direction: 'long',
  })

  assert.deepEqual(result, {
    grossPnL: 100,
    netPnL: 95,
    rMultiple: 1.9,
  })
})

test('computeJournalMetrics calculates summary metrics', () => {
  const metrics = computeJournalMetrics([
    { shares: 10, entry: 100, exit: 102, stop: 99, fees: 0, direction: 'long' },
    { shares: 10, entry: 100, exit: 99, stop: 101, fees: 0, direction: 'long' },
  ])

  assert.equal(metrics.tradeCount, 2)
  assert.equal(metrics.winRate, 50)
  assert.equal(metrics.averageWin, 20)
  assert.equal(metrics.averageLoss, -10)
  assert.equal(metrics.profitFactor, 2)
  assert.equal(metrics.maxDrawdown, -10)
})

test('calcTradePlan emits sizing warnings for low risk-reward setups', () => {
  const plan = calcTradePlan({
    accountSize: 10000,
    maxRiskPerTradePct: 1,
    maxDailyLossPct: 3,
    entryPrice: 100,
    stopLossPrice: 98,
    targetPrice: 101,
  })

  assert.equal(plan.dollarRiskAllowed, 100)
  assert.equal(plan.positionSizeShares, 50)
  assert.equal(plan.riskRewardRatio, 0.5)
  assert.ok(plan.warnings.includes('Risk/reward is below preferred threshold (1.5).'))
})
