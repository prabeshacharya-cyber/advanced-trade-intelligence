import { MarketDataProvider, NewsProvider, CalendarProvider, FundamentalsProvider, HaltProvider } from './interfaces'

const SYMBOLS = ['AAPL','MSFT','NVDA','TSLA','AMD','PLTR','META','AMZN','QQQ','SPY','IWM','DIA','COIN']

function mockRow(symbol, idx = 0) {
  const base = 20 + idx * 9
  const change = +((Math.sin(idx + 1) * 4) + 0.6).toFixed(2)
  const volume = 1000000 + idx * 250000
  const avgVolume = Math.max(1, volume * (0.65 + (idx % 3) * 0.2))
  const price = +(base + 40).toFixed(2)
  return {
    symbol,
    price,
    changePct: change,
    premarketGapPct: +(change * 0.6).toFixed(2),
    volume,
    avgVolume,
    relativeVolume: +(volume / avgVolume).toFixed(2),
    marketCap: 5_000_000_000 + idx * 22_000_000_000,
    floatShares: 250_000_000 + idx * 50_000_000,
    dollarVolume: volume * price,
    distanceFromVWAP: +((Math.cos(idx + 1) * 2.2)).toFixed(2),
    distanceFromPrevClose: +((change / 100) * price).toFixed(2),
    highOfDayBreak: idx % 4 === 0,
    lowOfDayBreak: idx % 7 === 0,
    aboveEMA9: idx % 2 === 0,
    aboveEMA20: idx % 3 !== 0,
    aboveSMA50: idx % 4 !== 0,
    aboveSMA200: idx % 5 !== 0,
    earningsRecent: idx % 4 === 1,
    newsCount: idx % 5,
    halted: idx === 12,
  }
}

export class MockMarketDataProvider extends MarketDataProvider {
  async getOverview() {
    return {
      indexes: [
        { symbol: 'SPY', price: 523.11, changePct: 0.32 },
        { symbol: 'QQQ', price: 447.02, changePct: 0.58 },
        { symbol: 'DIA', price: 395.4, changePct: -0.1 },
        { symbol: 'IWM', price: 204.85, changePct: 0.14 },
      ],
      status: 'Market Open',
      rows: SYMBOLS.map(mockRow),
    }
  }

  async getScannerUniverse() {
    return SYMBOLS.map(mockRow)
  }

  async getTicker(symbol) {
    const row = mockRow(symbol.toUpperCase(), Math.abs(symbol.length * 3) % SYMBOLS.length)
    return { ...row, previousClose: +(row.price - row.distanceFromPrevClose).toFixed(2) }
  }
}

export class LiveBackedMarketProvider extends MarketDataProvider {
  constructor(mock) {
    super()
    this.mock = mock
  }

  async getOverview() {
    try {
      const [overview, topAssets] = await Promise.all([
        fetch('/api/market/overview').then(r => r.json()),
        fetch('/api/market/top-assets').then(r => r.json()),
      ])
      const rows = topAssets.map((a, idx) => ({
        ...mockRow(a.ticker, idx),
        symbol: a.ticker,
        price: a.price,
        changePct: a.change,
        relativeVolume: a.volX,
      }))
      return {
        indexes: [
          ...(overview.indices || []).map(x => ({ symbol: x.symbol, price: x.price, changePct: x.change })),
        ],
        status: overview.session,
        rows,
      }
    } catch {
      return this.mock.getOverview()
    }
  }

  async getScannerUniverse() {
    const out = await this.getOverview()
    return out.rows
  }

  async getTicker(symbol) {
    const universe = await this.getScannerUniverse()
    return universe.find(x => x.symbol === symbol.toUpperCase()) || this.mock.getTicker(symbol)
  }
}

export class MockNewsProvider extends NewsProvider {
  async getTickerNews(symbol) {
    return [
      { headline: `${symbol} opens strong on unusual volume`, source: 'MockWire', url: '#' },
      { headline: `${symbol} sees options activity increase`, source: 'TapeFeed', url: '#' },
    ]
  }
}

export class MockCalendarProvider extends CalendarProvider {
  async getCalendar() {
    return {
      earnings: [{ date: '2026-04-30', item: 'AAPL earnings' }],
      economic: [{ date: '2026-05-01', item: 'Payrolls (NFP)' }],
      fed: [{ date: '2026-05-06', item: 'FOMC decision' }],
      holidays: [{ date: '2026-05-27', item: 'Memorial Day (closed)' }],
      corporate: [{ date: '2026-05-02', item: 'Sample IPO window' }],
    }
  }
}

export class MockFundamentalsProvider extends FundamentalsProvider {
  async getFundamentals(symbol) {
    return { symbol, marketCap: 'Large', float: 'Medium' }
  }
}

export class MockHaltProvider extends HaltProvider {
  async getRecentHalts() {
    return [{ symbol: 'COIN', reason: 'Volatility Pause', resumedAt: '11:15 ET' }]
  }
}
