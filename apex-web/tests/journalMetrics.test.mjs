import test from 'node:test'
import assert from 'node:assert/strict'
import { computeJournalMetrics, computeTradeValues } from '../src/features/journal/metrics.js'

test('computeTradeValues long trade', () => {
  const v = computeTradeValues({ direction:'long', entry:10, exit:12, shares:100, stop:9, fees:5 })
  assert.equal(v.netPnL, 195)
  assert.equal(v.rMultiple, 1.95)
})

test('computeJournalMetrics basics', () => {
  const m = computeJournalMetrics([{ entry:10, exit:12, shares:100, stop:9, fees:0 }, { entry:10, exit:9, shares:50, stop:9, fees:0 }])
  assert.equal(m.tradeCount, 2)
  assert.equal(m.winRate, 50)
})
