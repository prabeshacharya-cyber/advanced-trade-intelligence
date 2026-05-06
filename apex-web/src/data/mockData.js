export const indices = [
  { name: 'S&P 500', symbol: 'SPX', change: 0.42 },
  { name: 'NASDAQ', symbol: 'NDX', change: 0.68 },
  { name: 'DOW', symbol: 'DJI', change: -0.11 },
]

export const sectors = [
  ['Technology', 1.1, 31], ['Healthcare', -0.2, 12], ['Financials', 0.5, 13], ['Energy', -1.2, 4],
  ['Consumer Discretionary', 0.8, 10], ['Consumer Staples', -0.1, 6], ['Industrials', 0.3, 8],
  ['Communication Services', 0.4, 9], ['Utilities', -0.4, 3], ['Real Estate', -0.6, 2], ['Materials', 0.2, 2],
].map(([name, change, weight]) => ({ name, change, weight }))

export const topAssets = Array.from({ length: 20 }).map((_, i) => {
  const base = [
    'NVDA','MSFT','AAPL','AMD','TSLA','META','SPY','QQQ','AMZN','GOOGL',
    'AVGO','PLTR','NFLX','JPM','XLE','IWM','DIA','MU','TSM','COIN'
  ][i]
  const score = 95 - i * 2.3
  return {
    ticker: base,
    name: `${base} Corp`,
    type: i % 5 === 0 ? 'ETF' : 'Stock',
    sector: i % 2 ? 'Technology' : 'Mixed',
    price: +(100 + i * 12.7).toFixed(2),
    change: +(2.2 - i * 0.22).toFixed(2),
    volX: +(3.6 - i * 0.12).toFixed(2),
    score100: +score.toFixed(1),
    score10: +(score / 10).toFixed(1),
    dimensions: { momentum: score - 5, volume: score - 8, news: score - 10, technical: score - 9, sentiment: score - 11, fundamentals: score - 12 },
  }
})

export const optionsFlow = [
  { ticker:'NVDA', side:'Call', strike:950, expiry:'2026-05-03', premium:'$2.1M', sentiment:'Bullish' },
  { ticker:'TSLA', side:'Put', strike:165, expiry:'2026-05-10', premium:'$1.4M', sentiment:'Bearish' },
]

export const darkPool = [
  { ticker:'AAPL', size:'400,000', price:'$199.20', time:'10:12 ET' },
  { ticker:'MSFT', size:'180,000', price:'$431.55', time:'11:02 ET' },
]

export const congressTrades = [
  { name:'Senator A', party:'D', ticker:'NVDA', side:'Buy', amount:'$100K-$250K', date:'2026-03-31' },
  { name:'Representative B', party:'R', ticker:'XOM', side:'Sell', amount:'$50K-$100K', date:'2026-04-02' },
]
