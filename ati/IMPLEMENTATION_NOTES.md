# ATI — Implementation Notes

Technical documentation for developers extending or deploying ATI.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  React Client (Vite, port 5001)                      │
│  Pages: Market Leaders, Funds, Asset Detail,          │
│         Backtest Lab, Alerts, Data Quality            │
└─────────────────┬───────────────────────────────────┘
                  │ /api/* proxy
┌─────────────────▼───────────────────────────────────┐
│  Express Server (Node.js ESM, port 3001)             │
│  Routes: /universe /scores /news /filings            │
│          /alerts /backtest /research /jobs           │
└─────────────────┬───────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────┐
│  Services Layer                                       │
│  - scoreService (stock + fund)                        │
│  - newsService + eventClassifier                      │
│  - secFilingService                                   │
│  - backtestService                                    │
│  - aiResearchService (Gemini)                         │
│  - alertService                                       │
│  - schedulerService (node-cron)                       │
│  - cacheService (SQLite cache table)                  │
│  - apiBudgetService (daily call tracking)            │
└─────────────────┬───────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────┐
│  Provider Manager                                     │
│  SEC EDGAR → Alpha Vantage → Finnhub → FMP           │
│  FRED → FINRA → Nasdaq RSS → RSS → Yahoo → Demo      │
└─────────────────┬───────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────┐
│  SQLite Database (ati.db)                             │
│  20 tables — auto-migrated on startup                │
└──────────────────────────────────────────────────────┘
```

---

## Scoring Algorithm

### Stock Score (5 components)

```
APEX Score = Σ(component_score × weight) / Σ(weights)

Component         Weight    Source
momentum          25%       Price history (20d + 60d return)
fundamentals      25%       SEC EDGAR XBRL + FMP income
news_sentiment    20%       Weighted headline + event scores
short_pressure    15%       FINRA short-sale ratio
volatility        15%       Annualized 20-day realized vol
```

### Probability Mapping

```javascript
// Raw score (0-100) → probability_outperform (35%-75%)
base = 50
maxDelta = 25
normalized = (score - 50) / 50   // -1 to +1
raw = base + normalized * maxDelta
// Shrink toward 50% when data confidence is low:
result = base + (raw - base) * (confidence / 100)
```

This ensures:
- Score of 100 = ~75% probability
- Score of 50 = 50% probability
- Score of 0 = ~35% probability
- Low confidence data → probability stays close to 50%

### ETF/Fund Score (3 components)
```
momentum         40%
volatility       30%
news_sentiment   30%
```
Funds are excluded from short-pressure and fundamentals scoring.

---

## Event Classification

`eventClassifierService.js` uses regex pattern matching to classify news:

| Event Type | Example Pattern |
|---|---|
| `earnings_beat` | "beat[s] estimates", "exceeds expectations" |
| `earnings_miss` | "missed estimates", "below consensus" |
| `guidance_raise` | "raised guidance", "positive outlook" |
| `fda_approval` | "FDA approved", "FDA cleared" |
| `analyst_upgrade` | "upgraded to buy", "outperform rating" |
| `sec_investigation` | "SEC investigation", "SEC probe" |

Sentiment is derived from pattern overlap:
- `bullish_score - bearish_score >= 2` → `bullish`
- `= 1` → `slightly_bullish`
- `= 0` → `neutral`
- `= -1` → `slightly_bearish`
- `<= -2` → `bearish`

---

## Caching Strategy

```
Provider         TTL        Rationale
quotes           5 min      Near real-time for price data
news             60 min     News updates hourly
sec_filings      6 hours    Filings are slow-changing
fundamentals     24 hours   Quarterly data
macro            24 hours   FRED data released slowly
short_sale       24 hours   FINRA daily files
fund_holdings    7 days     Holdings change infrequently
```

Cache stored in `provider_cache` SQLite table. Cache invalidation is TTL-based.

---

## API Budget System

Daily call counts tracked per provider in `provider_usage` table.

The `canCall(provider, reserve)` function returns `false` if:
```
current_usage + reserve >= daily_limit
```

When a provider is budget-exhausted, the next provider in priority order is used automatically.

Default conservative budgets:
- Alpha Vantage: 20/day (free tier has 25)
- FMP: 200/day (free tier has 250)
- Finnhub: 500/day
- FRED: 100/day

---

## Scheduler

Two automated cron jobs:
- **Pre-market** (6:30 AM EST weekdays): Full universe refresh, batch size 3
- **Post-market** (4:30 PM EST weekdays): Full universe refresh, batch size 5
- **News only** (every 2 hours): Market news RSS refresh

Manual trigger available via `POST /api/jobs/refresh`.

---

## Database Schema Summary

| Table | Purpose |
|---|---|
| `symbols` | Master universe (150+ symbols) |
| `price_daily` | OHLCV history |
| `quote_snapshots` | Point-in-time quotes |
| `fundamentals_quarterly` | Quarterly financials |
| `sec_filings` | SEC filing index |
| `news_events` | Classified news with sentiment |
| `macro_series` | FRED time series |
| `short_sale_data` | FINRA short volume |
| `trade_halts` | Nasdaq halt events |
| `fund_profiles` | ETF metadata |
| `fund_holdings` | ETF top holdings |
| `score_runs` | APEX Score history |
| `score_components` | Per-component scores |
| `predictions` | Backtest trade log |
| `alerts` | Generated alerts |
| `provider_cache` | API response cache |
| `provider_usage` | Daily call counts |
| `provider_errors` | Error log |
| `watchlists` | User watchlists |
| `app_settings` | App configuration |

---

## Language Guidelines

ATI strictly avoids misleading financial language:

| Prohibited | Use Instead |
|---|---|
| "guaranteed winner" | "Strong Watch" |
| "sure profit" | "probability of benchmark outperformance" |
| "will outperform" | "higher probability setup" |
| "risk-free" | "lower volatility, higher confidence" |
| "buy signal" | "Positive Setup, score above threshold" |

---

## Adding a New Data Provider

1. Create `server/providers/myProvider.js`:
```javascript
import { cacheGet, cacheSet } from '../services/cacheService.js'
import { canCall, trackCall, trackError } from '../services/apiBudgetService.js'

const meta = (extras = {}) => ({
  source: 'MyProvider', isRealData: true, isDemo: false, isStale: false,
  asOf: new Date().toISOString(), providerStatus: 'ok',
  missingFields: [], notes: [], ...extras,
})

export async function getQuote(symbol) {
  if (!process.env.MY_API_KEY) return null
  const cached = cacheGet('my_provider', `q_${symbol}`)
  if (cached) return cached
  try {
    if (!canCall('my_provider')) return null
    trackCall('my_provider')
    // ... fetch and return
    const result = { symbol, price: ..., ...meta() }
    cacheSet('my_provider', `q_${symbol}`, result, 5)
    return result
  } catch (e) {
    trackError('my_provider', 'getQuote', e.message)
    return null
  }
}
```

2. Register in `providerManager.js` at the appropriate fallback position.
3. Add budget default in `apiBudgetService.js`.
4. Add env var to `.env.example`.

---

## Deployment Notes

For Replit deployment:
- Set all env vars as Secrets in the Replit UI
- `PORT=3001` is the default server port
- Vite client on port `5001` proxies `/api/*` to `localhost:3001`
- For production builds: `npm run build` in `/client`, then server serves `/client/dist`
- SQLite `ati.db` will persist to disk between deployments on Replit
