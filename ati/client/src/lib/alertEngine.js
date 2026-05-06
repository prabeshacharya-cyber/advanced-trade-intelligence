export function evaluateAlert(alert, row) {
  const p = row.price
  if (alert.type === 'price_above') return p >= Number(alert.value)
  if (alert.type === 'price_below') return p <= Number(alert.value)
  if (alert.type === 'pct_move')    return Math.abs(row.changePct) >= Number(alert.value)
  if (alert.type === 'volume_spike') return row.volume >= Number(alert.value)
  if (alert.type === 'rv_spike')    return row.relativeVolume >= Number(alert.value)
  if (alert.type === 'hod_break')   return !!row.highOfDayBreak
  if (alert.type === 'lod_break')   return !!row.lowOfDayBreak
  if (alert.type === 'vwap_reclaim') return row.distanceFromVWAP > 0
  return false
}

export function runAlertPass(alerts, marketRows, nowIso = new Date().toISOString()) {
  const triggered = []
  for (const alert of alerts) {
    const row = marketRows.find(r => r.symbol?.toUpperCase() === alert.symbol?.toUpperCase())
    if (!row) continue
    if (evaluateAlert(alert, row)) triggered.push({ ...alert, triggeredAt: nowIso, lastPrice: row.price })
  }
  return triggered
}
