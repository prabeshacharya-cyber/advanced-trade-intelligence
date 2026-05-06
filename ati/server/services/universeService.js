import getDb from '../db/index.js'

// 150+ seeded symbols across sectors
const SEED_UNIVERSE = [
  // ── Mega-cap Tech ──────────────────────────────────────────────────────
  { symbol:'AAPL', name:'Apple Inc.',            sector:'Technology',     asset_type:'stock' },
  { symbol:'MSFT', name:'Microsoft Corp.',       sector:'Technology',     asset_type:'stock' },
  { symbol:'NVDA', name:'NVIDIA Corp.',          sector:'Technology',     asset_type:'stock' },
  { symbol:'GOOGL',name:'Alphabet Inc.',         sector:'Technology',     asset_type:'stock' },
  { symbol:'AMZN', name:'Amazon.com Inc.',       sector:'Technology',     asset_type:'stock' },
  { symbol:'META', name:'Meta Platforms',        sector:'Technology',     asset_type:'stock' },
  { symbol:'TSLA', name:'Tesla Inc.',            sector:'Consumer Disc.', asset_type:'stock' },
  { symbol:'ORCL', name:'Oracle Corp.',          sector:'Technology',     asset_type:'stock' },
  { symbol:'IBM',  name:'IBM Corp.',             sector:'Technology',     asset_type:'stock' },
  { symbol:'INTC', name:'Intel Corp.',           sector:'Technology',     asset_type:'stock' },
  // ── AI / Semiconductors ──────────────────────────────────────────────
  { symbol:'AMD',  name:'Advanced Micro Devices',sector:'Technology',     asset_type:'stock' },
  { symbol:'AVGO', name:'Broadcom Inc.',         sector:'Technology',     asset_type:'stock' },
  { symbol:'QCOM', name:'Qualcomm Inc.',         sector:'Technology',     asset_type:'stock' },
  { symbol:'MU',   name:'Micron Technology',     sector:'Technology',     asset_type:'stock' },
  { symbol:'ASML', name:'ASML Holding',          sector:'Technology',     asset_type:'stock' },
  { symbol:'AMAT', name:'Applied Materials',     sector:'Technology',     asset_type:'stock' },
  { symbol:'LRCX', name:'Lam Research',          sector:'Technology',     asset_type:'stock' },
  { symbol:'KLAC', name:'KLA Corp.',             sector:'Technology',     asset_type:'stock' },
  { symbol:'ARM',  name:'Arm Holdings',          sector:'Technology',     asset_type:'stock' },
  // ── Software / Cloud ─────────────────────────────────────────────────
  { symbol:'PLTR', name:'Palantir Technologies', sector:'Technology',     asset_type:'stock' },
  { symbol:'CRM',  name:'Salesforce Inc.',       sector:'Technology',     asset_type:'stock' },
  { symbol:'NOW',  name:'ServiceNow Inc.',       sector:'Technology',     asset_type:'stock' },
  { symbol:'SNOW', name:'Snowflake Inc.',        sector:'Technology',     asset_type:'stock' },
  { symbol:'DDOG', name:'Datadog Inc.',          sector:'Technology',     asset_type:'stock' },
  { symbol:'MDB',  name:'MongoDB Inc.',          sector:'Technology',     asset_type:'stock' },
  { symbol:'ZS',   name:'Zscaler Inc.',          sector:'Technology',     asset_type:'stock' },
  { symbol:'NET',  name:'Cloudflare Inc.',       sector:'Technology',     asset_type:'stock' },
  { symbol:'HUBS', name:'HubSpot Inc.',          sector:'Technology',     asset_type:'stock' },
  { symbol:'TTD',  name:'The Trade Desk',        sector:'Technology',     asset_type:'stock' },
  // ── Cybersecurity ────────────────────────────────────────────────────
  { symbol:'CRWD', name:'CrowdStrike Holdings',  sector:'Technology',     asset_type:'stock' },
  { symbol:'PANW', name:'Palo Alto Networks',    sector:'Technology',     asset_type:'stock' },
  { symbol:'S',    name:'SentinelOne Inc.',      sector:'Technology',     asset_type:'stock' },
  { symbol:'FTNT', name:'Fortinet Inc.',         sector:'Technology',     asset_type:'stock' },
  // ── E-commerce / Consumer ────────────────────────────────────────────
  { symbol:'SHOP', name:'Shopify Inc.',          sector:'Technology',     asset_type:'stock' },
  { symbol:'UBER', name:'Uber Technologies',     sector:'Consumer Disc.', asset_type:'stock' },
  { symbol:'ABNB', name:'Airbnb Inc.',           sector:'Consumer Disc.', asset_type:'stock' },
  { symbol:'LYFT', name:'Lyft Inc.',             sector:'Consumer Disc.', asset_type:'stock' },
  // ── Fintech / Crypto ─────────────────────────────────────────────────
  { symbol:'COIN', name:'Coinbase Global',       sector:'Financials',     asset_type:'stock' },
  { symbol:'HOOD', name:'Robinhood Markets',     sector:'Financials',     asset_type:'stock' },
  { symbol:'SQ',   name:'Block Inc.',            sector:'Financials',     asset_type:'stock' },
  { symbol:'AFRM', name:'Affirm Holdings',       sector:'Financials',     asset_type:'stock' },
  // ── Financials ───────────────────────────────────────────────────────
  { symbol:'JPM',  name:'JPMorgan Chase',        sector:'Financials',     asset_type:'stock' },
  { symbol:'BAC',  name:'Bank of America',       sector:'Financials',     asset_type:'stock' },
  { symbol:'GS',   name:'Goldman Sachs',         sector:'Financials',     asset_type:'stock' },
  { symbol:'MS',   name:'Morgan Stanley',        sector:'Financials',     asset_type:'stock' },
  { symbol:'WFC',  name:'Wells Fargo',           sector:'Financials',     asset_type:'stock' },
  { symbol:'V',    name:'Visa Inc.',             sector:'Financials',     asset_type:'stock' },
  { symbol:'MA',   name:'Mastercard Inc.',       sector:'Financials',     asset_type:'stock' },
  { symbol:'PYPL', name:'PayPal Holdings',       sector:'Financials',     asset_type:'stock' },
  { symbol:'BLK',  name:'BlackRock Inc.',        sector:'Financials',     asset_type:'stock' },
  { symbol:'SCHW', name:'Charles Schwab',        sector:'Financials',     asset_type:'stock' },
  // ── Energy ──────────────────────────────────────────────────────────
  { symbol:'XOM',  name:'ExxonMobil Corp.',      sector:'Energy',         asset_type:'stock' },
  { symbol:'CVX',  name:'Chevron Corp.',         sector:'Energy',         asset_type:'stock' },
  { symbol:'COP',  name:'ConocoPhillips',        sector:'Energy',         asset_type:'stock' },
  { symbol:'SLB',  name:'Schlumberger Ltd.',     sector:'Energy',         asset_type:'stock' },
  { symbol:'OXY',  name:'Occidental Petroleum',  sector:'Energy',         asset_type:'stock' },
  { symbol:'EOG',  name:'EOG Resources',         sector:'Energy',         asset_type:'stock' },
  // ── Healthcare ──────────────────────────────────────────────────────
  { symbol:'UNH',  name:'UnitedHealth Group',    sector:'Healthcare',     asset_type:'stock' },
  { symbol:'LLY',  name:'Eli Lilly',             sector:'Healthcare',     asset_type:'stock' },
  { symbol:'NVO',  name:'Novo Nordisk',          sector:'Healthcare',     asset_type:'stock' },
  { symbol:'JNJ',  name:'Johnson & Johnson',     sector:'Healthcare',     asset_type:'stock' },
  { symbol:'MRK',  name:'Merck & Co.',           sector:'Healthcare',     asset_type:'stock' },
  { symbol:'ABBV', name:'AbbVie Inc.',           sector:'Healthcare',     asset_type:'stock' },
  { symbol:'PFE',  name:'Pfizer Inc.',           sector:'Healthcare',     asset_type:'stock' },
  { symbol:'AMGN', name:'Amgen Inc.',            sector:'Healthcare',     asset_type:'stock' },
  { symbol:'GILD', name:'Gilead Sciences',       sector:'Healthcare',     asset_type:'stock' },
  { symbol:'ISRG', name:'Intuitive Surgical',    sector:'Healthcare',     asset_type:'stock' },
  // ── Consumer ────────────────────────────────────────────────────────
  { symbol:'COST', name:'Costco Wholesale',      sector:'Consumer Stapl.',asset_type:'stock' },
  { symbol:'WMT',  name:'Walmart Inc.',          sector:'Consumer Stapl.',asset_type:'stock' },
  { symbol:'HD',   name:'Home Depot',            sector:'Consumer Disc.', asset_type:'stock' },
  { symbol:'LOW',  name:'Lowe\'s Companies',     sector:'Consumer Disc.', asset_type:'stock' },
  { symbol:'MCD',  name:'McDonald\'s Corp.',     sector:'Consumer Disc.', asset_type:'stock' },
  { symbol:'SBUX', name:'Starbucks Corp.',       sector:'Consumer Disc.', asset_type:'stock' },
  { symbol:'NKE',  name:'Nike Inc.',             sector:'Consumer Disc.', asset_type:'stock' },
  { symbol:'TGT',  name:'Target Corp.',          sector:'Consumer Stapl.',asset_type:'stock' },
  { symbol:'AMZL', name:'Amazon Logistics',      sector:'Consumer Disc.', asset_type:'stock' },
  // ── Industrials ─────────────────────────────────────────────────────
  { symbol:'CAT',  name:'Caterpillar Inc.',      sector:'Industrials',    asset_type:'stock' },
  { symbol:'DE',   name:'Deere & Company',       sector:'Industrials',    asset_type:'stock' },
  { symbol:'GE',   name:'GE Aerospace',          sector:'Industrials',    asset_type:'stock' },
  { symbol:'BA',   name:'Boeing Co.',            sector:'Industrials',    asset_type:'stock' },
  { symbol:'LMT',  name:'Lockheed Martin',       sector:'Industrials',    asset_type:'stock' },
  { symbol:'RTX',  name:'RTX Corp.',             sector:'Industrials',    asset_type:'stock' },
  { symbol:'NOC',  name:'Northrop Grumman',      sector:'Industrials',    asset_type:'stock' },
  { symbol:'HON',  name:'Honeywell Intl.',       sector:'Industrials',    asset_type:'stock' },
  { symbol:'UPS',  name:'United Parcel Service', sector:'Industrials',    asset_type:'stock' },
  { symbol:'FDX',  name:'FedEx Corp.',           sector:'Industrials',    asset_type:'stock' },
  // ── Media / Telecom ──────────────────────────────────────────────────
  { symbol:'NFLX', name:'Netflix Inc.',          sector:'Comm. Services', asset_type:'stock' },
  { symbol:'DIS',  name:'Walt Disney Co.',       sector:'Comm. Services', asset_type:'stock' },
  { symbol:'T',    name:'AT&T Inc.',             sector:'Comm. Services', asset_type:'stock' },
  { symbol:'VZ',   name:'Verizon Communications',sector:'Comm. Services', asset_type:'stock' },
  { symbol:'CMCSA',name:'Comcast Corp.',         sector:'Comm. Services', asset_type:'stock' },
  { symbol:'SPOT', name:'Spotify Technology',    sector:'Comm. Services', asset_type:'stock' },
  // ── Real Estate ──────────────────────────────────────────────────────
  { symbol:'PLD',  name:'Prologis Inc.',         sector:'Real Estate',    asset_type:'stock' },
  { symbol:'AMT',  name:'American Tower',        sector:'Real Estate',    asset_type:'stock' },
  { symbol:'EQIX', name:'Equinix Inc.',          sector:'Real Estate',    asset_type:'stock' },
  // ── Utilities ────────────────────────────────────────────────────────
  { symbol:'NEE',  name:'NextEra Energy',        sector:'Utilities',      asset_type:'stock' },
  { symbol:'DUK',  name:'Duke Energy',           sector:'Utilities',      asset_type:'stock' },
  // ── ETFs — Broad Market ──────────────────────────────────────────────
  { symbol:'SPY',  name:'SPDR S&P 500 ETF',      sector:'Broad Market',   asset_type:'etf' },
  { symbol:'QQQ',  name:'Invesco QQQ Trust',     sector:'Technology',     asset_type:'etf' },
  { symbol:'DIA',  name:'SPDR Dow Jones ETF',    sector:'Broad Market',   asset_type:'etf' },
  { symbol:'IWM',  name:'iShares Russell 2000',  sector:'Small Cap',      asset_type:'etf' },
  { symbol:'VTI',  name:'Vanguard Total Market', sector:'Broad Market',   asset_type:'etf' },
  { symbol:'VOO',  name:'Vanguard S&P 500',      sector:'Broad Market',   asset_type:'etf' },
  // ── ETFs — Sector ────────────────────────────────────────────────────
  { symbol:'XLK',  name:'Tech Select Sector',    sector:'Technology',     asset_type:'etf' },
  { symbol:'XLF',  name:'Financial Select Sector',sector:'Financials',    asset_type:'etf' },
  { symbol:'XLE',  name:'Energy Select Sector',  sector:'Energy',         asset_type:'etf' },
  { symbol:'XLY',  name:'Consumer Disc. Select', sector:'Consumer Disc.', asset_type:'etf' },
  { symbol:'XLV',  name:'Health Care Select',    sector:'Healthcare',     asset_type:'etf' },
  { symbol:'XLI',  name:'Industrial Select',     sector:'Industrials',    asset_type:'etf' },
  { symbol:'XLP',  name:'Consumer Staples Select',sector:'Consumer Stapl.',asset_type:'etf' },
  { symbol:'XLU',  name:'Utilities Select',      sector:'Utilities',      asset_type:'etf' },
  { symbol:'XLC',  name:'Comm. Services Select', sector:'Comm. Services', asset_type:'etf' },
  { symbol:'XLB',  name:'Materials Select',      sector:'Materials',      asset_type:'etf' },
  // ── ETFs — Thematic ─────────────────────────────────────────────────
  { symbol:'SMH',  name:'VanEck Semiconductor',  sector:'Technology',     asset_type:'etf' },
  { symbol:'SOXX', name:'iShares Semiconductor', sector:'Technology',     asset_type:'etf' },
  { symbol:'ARKK', name:'ARK Innovation ETF',    sector:'Technology',     asset_type:'etf' },
  { symbol:'IGV',  name:'iShares Software ETF',  sector:'Technology',     asset_type:'etf' },
  { symbol:'BOTZ', name:'Global X Robotics & AI',sector:'Technology',     asset_type:'etf' },
  { symbol:'ROBO', name:'ROBO Global Robotics',  sector:'Technology',     asset_type:'etf' },
  { symbol:'WCLD', name:'WisdomTree Cloud Comp.',sector:'Technology',     asset_type:'etf' },
  { symbol:'HACK', name:'ETFMG Prime Cyber Sec.',sector:'Technology',     asset_type:'etf' },
  // ── ETFs — Dividend / Factor ─────────────────────────────────────────
  { symbol:'SCHD', name:'Schwab US Dividend ETF',sector:'Dividend',       asset_type:'etf' },
  { symbol:'VUG',  name:'Vanguard Growth ETF',   sector:'Growth',         asset_type:'etf' },
  { symbol:'VTV',  name:'Vanguard Value ETF',    sector:'Value',          asset_type:'etf' },
  { symbol:'VIG',  name:'Vanguard Div. Appreciat',sector:'Dividend',      asset_type:'etf' },
  // ── ETFs — Fixed Income / Alternatives ──────────────────────────────
  { symbol:'AGG',  name:'iShares Core US Agg Bond',sector:'Fixed Income', asset_type:'etf' },
  { symbol:'TLT',  name:'iShares 20+ Yr Treasury',sector:'Fixed Income',  asset_type:'etf' },
  { symbol:'HYG',  name:'iShares HY Corp Bond',  sector:'Fixed Income',   asset_type:'etf' },
  { symbol:'GLD',  name:'SPDR Gold Shares',      sector:'Commodities',    asset_type:'etf' },
  { symbol:'SLV',  name:'iShares Silver Trust',  sector:'Commodities',    asset_type:'etf' },
  { symbol:'USO',  name:'United States Oil Fund', sector:'Commodities',   asset_type:'etf' },
  { symbol:'PDBC', name:'Invesco DB Commodity',  sector:'Commodities',    asset_type:'etf' },
  // ── Additional Growth ────────────────────────────────────────────────
  { symbol:'RBLX', name:'Roblox Corp.',          sector:'Technology',     asset_type:'stock' },
  { symbol:'SNAP', name:'Snap Inc.',             sector:'Comm. Services', asset_type:'stock' },
  { symbol:'PINS', name:'Pinterest Inc.',        sector:'Comm. Services', asset_type:'stock' },
  { symbol:'RDDT', name:'Reddit Inc.',           sector:'Technology',     asset_type:'stock' },
  { symbol:'SOUN', name:'SoundHound AI',         sector:'Technology',     asset_type:'stock' },
  { symbol:'SMCI', name:'Super Micro Computer',  sector:'Technology',     asset_type:'stock' },
  { symbol:'VST',  name:'Vistra Corp.',          sector:'Utilities',      asset_type:'stock' },
  { symbol:'CEG',  name:'Constellation Energy',  sector:'Utilities',      asset_type:'stock' },
  { symbol:'NRG',  name:'NRG Energy',            sector:'Utilities',      asset_type:'stock' },
  { symbol:'MSTR', name:'MicroStrategy',         sector:'Technology',     asset_type:'stock' },
  { symbol:'IONQ', name:'IonQ Inc.',             sector:'Technology',     asset_type:'stock' },
  { symbol:'RGTI', name:'Rigetti Computing',     sector:'Technology',     asset_type:'stock' },
  { symbol:'QUBT', name:'Quantum Computing Inc.',sector:'Technology',     asset_type:'stock' },
  { symbol:'TSM',  name:'Taiwan Semiconductor',  sector:'Technology',     asset_type:'stock' },
  { symbol:'BABA', name:'Alibaba Group',         sector:'Technology',     asset_type:'stock' },
  { symbol:'JD',   name:'JD.com Inc.',           sector:'Consumer Disc.', asset_type:'stock' },
  { symbol:'PDD',  name:'PDD Holdings',          sector:'Consumer Disc.', asset_type:'stock' },
  { symbol:'OKTA', name:'Okta Inc.',               sector:'Technology',     asset_type:'stock' },
]

export function seedStarterUniverse() {
  const db = getDb()
  const insert = db.prepare(`
    INSERT OR IGNORE INTO symbols(symbol, name, asset_type, sector, source)
    VALUES(@symbol, @name, @asset_type, @sector, 'seed')
  `)
  const insertMany = db.transaction((rows) => rows.forEach(r => insert.run(r)))
  insertMany(SEED_UNIVERSE)
  console.log(`[universe] Seeded ${SEED_UNIVERSE.length} symbols`)
  return SEED_UNIVERSE.length
}

export function getActiveUniverse(filters = {}) {
  const db = getDb()
  let sql = 'SELECT * FROM symbols WHERE is_active=1'
  const params = []
  if (filters.assetType) { sql += ' AND asset_type=?'; params.push(filters.assetType) }
  if (filters.sector)    { sql += ' AND sector=?';     params.push(filters.sector) }
  return db.prepare(sql + ' ORDER BY symbol').all(...params)
}

export function classifyAssetType(symbol) {
  const etfs = new Set(SEED_UNIVERSE.filter(s => s.asset_type === 'etf').map(s => s.symbol))
  return etfs.has(symbol) ? 'etf' : 'stock'
}

export function getDefaultBenchmark(symbol) {
  const asset = SEED_UNIVERSE.find(s => s.symbol === symbol)
  if (!asset) return 'SPY'
  if (asset.asset_type === 'etf') return 'SPY'
  const techSectors = new Set(['Technology', 'Comm. Services'])
  if (techSectors.has(asset.sector)) return 'QQQ'
  return 'SPY'
}

export function getUniverseStats() {
  const db = getDb()
  const total = db.prepare('SELECT COUNT(*) as c FROM symbols WHERE is_active=1').get().c
  const byType = db.prepare('SELECT asset_type, COUNT(*) as c FROM symbols GROUP BY asset_type').all()
  const bySector = db.prepare('SELECT sector, COUNT(*) as c FROM symbols GROUP BY sector ORDER BY c DESC').all()
  return { total, byType, bySector }
}
