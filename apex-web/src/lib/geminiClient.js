// ── Market data ────────────────────────────────────────────────────────────────
export async function fetchOverview() {
  const res = await fetch('/api/market/overview')
  if (!res.ok) throw new Error('Failed to load market overview')
  return res.json()
}

export async function fetchSectors() {
  const res = await fetch('/api/market/sectors')
  if (!res.ok) throw new Error('Failed to load sectors')
  return res.json()
}

export async function fetchTopAssets() {
  const res = await fetch('/api/market/top-assets')
  if (!res.ok) throw new Error('Failed to load top assets')
  return res.json()
}

export async function fetchEarningsData() {
  const res = await fetch('/api/market/earnings')
  if (!res.ok) throw new Error('Failed to load earnings data')
  return res.json()
}

// ── AI endpoints ───────────────────────────────────────────────────────────────
export async function fetchMarketBriefing(context = {}) {
  const res = await fetch('/api/market-briefing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(context),
  })
  if (!res.ok) throw new Error('Market briefing request failed')
  return res.json()
}

export async function fetchEarningsAnalysis(ticker, eps, date, price, change, score) {
  const res = await fetch('/api/earnings-analysis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticker, eps, date, price, change, score }),
  })
  if (!res.ok) throw new Error('Earnings analysis request failed')
  return res.json()
}

export async function fetchChatReply(messages) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  })
  if (!res.ok) throw new Error('Chat request failed')
  return res.json()
}

export async function fetchScorerInsight(ticker, score, dimensions, price, change) {
  const res = await fetch('/api/scorer-insight', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticker, score, dimensions, price, change }),
  })
  if (!res.ok) throw new Error('Scorer insight request failed')
  return res.json()
}

export async function fetchResearch(ticker, question) {
  const res = await fetch('/api/research', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticker, question }),
  })
  if (!res.ok) throw new Error('Research request failed')
  return res.json()
}
