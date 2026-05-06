import test from 'node:test'
import assert from 'node:assert/strict'
import { runAlertPass } from '../src/features/alerts/alertEngine.js'

test('runAlertPass triggers crossing alert', () => {
  const hits = runAlertPass([{ id:'1', symbol:'AAPL', type:'price_above', value:100 }], [{ symbol:'AAPL', price:101, changePct:1 }], '2026-04-28T00:00:00Z')
  assert.equal(hits.length, 1)
})

test('runAlertPass matches symbol case-insensitively', () => {
  const hits = runAlertPass([{ id:'1', symbol:'aapl', type:'price_above', value:100 }], [{ symbol:'AAPL', price:101, changePct:1 }], '2026-04-28T00:00:00Z')
  assert.equal(hits.length, 1)
})
