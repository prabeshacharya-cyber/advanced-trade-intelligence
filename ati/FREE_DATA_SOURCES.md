# ATI Free Data Sources

ATI is designed to run with **zero paid APIs**. All optional keys have free tiers.

## Always-Free (No Key Required)

| Source | Type | URL | What ATI uses it for |
|---|---|---|---|
| **SEC EDGAR** | Filings, XBRL | https://efts.sec.gov | 10-K, 10-Q, 8-K filings; XBRL company facts (revenue, EPS, margins) |
| **FINRA Short Sale** | Market data | https://www.finra.org/investors/learn-to-invest/advanced-investing/short-selling/short-sale-volume-data | Daily short-sale volume by symbol — used for short pressure scoring |
| **Nasdaq Trade Halts RSS** | RSS feed | https://www.nasdaqtrader.com/rss.aspx?feed=tradehalts | Real-time trade halt events |
| **Market News RSS** | RSS feeds | Various | Headlines from Seeking Alpha, Reuters, MarketWatch, Nasdaq news |
| **Yahoo Finance** | Unofficial | https://finance.yahoo.com | Quote + OHLCV history fallback — requires `ENABLE_YAHOO_FALLBACK=true` |
| **Demo Provider** | Synthetic | Internal | Deterministic synthetic data when all real sources are unavailable |

## Optional Free Keys (Improve Signal Quality)

### Alpha Vantage
- **Sign up:** https://www.alphavantage.co/support/#api-key
- **Free tier:** 25 requests/day, 5 requests/minute
- **Add to .env:** `ALPHA_VANTAGE_API_KEY=your_key`
- **ATI uses:** Daily adjusted OHLCV prices, real-time quotes, company news with sentiment

### Finnhub
- **Sign up:** https://finnhub.io
- **Free tier:** 60 requests/minute
- **Add to .env:** `FINNHUB_API_KEY=your_key`
- **ATI uses:** Real-time quotes, company news

### Financial Modeling Prep (FMP)
- **Sign up:** https://financialmodelingprep.com
- **Free tier:** 250 requests/day
- **Add to .env:** `FMP_API_KEY=your_key`
- **ATI uses:** Income statements, gross margin, net margin, EPS

### FRED (Federal Reserve Economic Data)
- **Sign up:** https://fred.stlouisfed.org/docs/api/api_key.html
- **Free tier:** Unlimited
- **Add to .env:** `FRED_API_KEY=your_key`
- **ATI uses:** Fed funds rate, CPI, unemployment, 10Y/2Y treasury yields, macro regime classification

### Google Gemini AI
- **Sign up:** https://ai.google.dev
- **Free tier:** Available (rate-limited)
- **Add to .env:** `GEMINI_API_KEY=your_key`
- **ATI uses:** AI research summaries (280-360 words per symbol), daily market commentary

## Data Priority Chain

When ATI fetches data, it tries providers in this order:

```
Price/Quote:     Finnhub → FMP → Alpha Vantage → Yahoo Fallback → Demo
Price History:   Alpha Vantage → Yahoo Fallback → Demo
News:            Alpha Vantage → Finnhub → FMP → Market RSS → Demo
Fundamentals:    SEC EDGAR → FMP → Demo
Macro:           FRED → Demo
Short Volume:    FINRA (always real — no key needed)
Market News:     RSS feeds (always real — no key needed)
```

## Data Quality and Confidence

Each score includes a `dataQuality` object:

```json
{
  "isRealData": true,
  "hasDemo": false,
  "sources": ["FINRA", "Yahoo", "RSS"],
  "confidence": 65,
  "dataNote": null,
  "componentAvailability": {
    "hasMomentum": true,
    "hasVolatility": true,
    "hasFundamentals": false,
    "hasNews": true,
    "hasShort": true
  }
}
```

Confidence ranges:
- **80-90%** — All 5 signal components have real data
- **55-75%** — Price history + some real data, partial fundamentals/news
- **35-50%** — Price history available but missing fundamentals or news
- **20-35%** — Demo/fallback data only

## Rate Limits and Budget Tracking

ATI tracks daily API usage per provider in SQLite:

```
GET /api/jobs/data-quality
```

Returns budget usage, rate-limit warnings (>80% daily budget used), and which providers are active vs. missing keys.

## Setting Up Free Keys (Example .env)

```bash
cp ati/.env.example ati/.env

ALPHA_VANTAGE_API_KEY=your_key_here
FINNHUB_API_KEY=your_key_here
FMP_API_KEY=your_key_here
FRED_API_KEY=your_key_here
GEMINI_API_KEY=your_key_here

ENABLE_DEMO_DATA=true
ENABLE_YAHOO_FALLBACK=true
```

ATI always runs without any of the above. Keys improve signal quality and reduce reliance on demo data.
