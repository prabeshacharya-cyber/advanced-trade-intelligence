// Provider interfaces. Replace mock implementations with live vendor adapters.
// Broker/data-vendor rules differ. Validate all market/risk constraints with your broker.

export class MarketDataProvider {
  async getOverview() { throw new Error('Not implemented') }
  async getScannerUniverse() { throw new Error('Not implemented') }
  async getTicker(symbol) { throw new Error('Not implemented') }
}

export class NewsProvider {
  async getTickerNews(_symbol) { throw new Error('Not implemented') }
}

export class CalendarProvider {
  async getCalendar() { throw new Error('Not implemented') }
}

export class FundamentalsProvider {
  async getFundamentals(_symbol) { throw new Error('Not implemented') }
}

export class HaltProvider {
  async getRecentHalts() { throw new Error('Not implemented') }
}
