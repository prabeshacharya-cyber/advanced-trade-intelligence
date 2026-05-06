import test from 'node:test'
import assert from 'node:assert/strict'
import { calcTradePlan } from '../src/features/risk/riskEngine.js'

test('calcTradePlan returns shares and rr', () => {
  const out = calcTradePlan({ accountSize: 10000, maxRiskPerTradePct: 1, maxDailyLossPct: 3, entryPrice: 50, stopLossPrice: 49, targetPrice: 53 })
  assert.equal(out.positionSizeShares, 100)
  assert.equal(out.riskRewardRatio, 3)
})

test('calcTradePlan handles invalid numeric input safely', () => {
  const out = calcTradePlan({ accountSize: 'x', maxRiskPerTradePct: 'z', maxDailyLossPct: '', entryPrice: 'bad', stopLossPrice: null, targetPrice: undefined })
  assert.equal(out.positionSizeShares, 0)
  assert.equal(out.estimatedCost, 0)
})
