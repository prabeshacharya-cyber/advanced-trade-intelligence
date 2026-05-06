# ATI — Advanced Trade Intelligence: Implementation Report

## Summary

ATI is a free-first fintech intelligence platform spun from the APEX codebase. It provides
composite scoring, news intelligence, SEC filing analysis, short-sale pressure monitoring,
backtesting, and AI research summaries — all running on publicly available, free-tier APIs.

**No paid API is required to run ATI.**

---

## Architecture

| Layer | Stack |
|---|---|
| Server | Node.js 20, Express ESM (`"type":"module"`), better-sqlite3 |
| Client | React 18 + Vite, CSS variables for theming |
| Database | SQLite (file: `ati.db`) — ignores any PostgreSQL `DATABASE_URL` |
| Scheduling | node-cron — pre-market (6:30 AM EST) + post-market (4:30 PM EST) |
| AI | Google Gemini 2.0 Flash (optional) with structured fallback |

---

## Checklist Verification

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | App starts without runtime errors | ✅ PASS | Server boots, 150 symbols seeded, scheduler registered |
| 2 | No paid API required | ✅ PASS | `paidApiRequired: false` on every `/api/health` response |
| 3 | Works on seed + SEC/RSS data | ✅ PASS | Score, news, filings all work with zero API keys |
| 4 | Optional keys don't break anything when absent | ✅ PASS | All providers return `null` safely; `tryProvider()` wrapper prevents crashes |
| 5 | Optional keys improve quality when present | ✅ PASS | AV/Finnhub/FMP provide real price/fundamentals data |
| 6 | Score generates with no keys | ✅ PASS | Score 57/100, confidence 45%, rating Neutral, isDemo: true |
| 7 | Provider metadata in every score | ✅ PASS | `dataQuality.sources` lists contributing providers |
| 8 | Response caching with TTL | ✅ PASS | In-memory cache; TTL per provider (60–360 min) |
| 9 | API budget tracker per-provider per-day | ✅ PASS | SQLite `api_usage` table; `/api/jobs/data-quality` reports usage |
| 10 | Data Quality page shows sources, missing keys, rate-limit warnings | ✅ PASS | Full provider status, budget, missing keys, rate-limit alerts |
| 11 | Market Leaders covers 150 symbols (stocks + ETFs) | ✅ PASS | 114 stocks + 35 ETFs + ARM = 150 total |
| 12 | Confidence score is lower when price/fundamentals missing | ✅ PASS | Demo-only data → 45% confidence; full real data → up to 90% |
| 13 | AI research never invents data | ✅ PASS | Strict prompt; fallback text when AI unavailable; no hallucination path |
| 14 | IMPLEMENTATION_REPORT.md created; README + FREE_DATA_SOURCES updated | ✅ PASS | This file |

---

## Free Data Sources

| Provider | Auth | Coverage | Priority |
|---|---|---|---|
| SEC EDGAR | None (User-Agent header) | 10-K, 10-Q, 8-K, XBRL company facts | 1st for fundamentals |
| FINRA Short Sale | None | Daily short volume by symbol | 1st for short pressure |
| Nasdaq RSS | None | Trade halt/resume feed | 1st for halt events |
| Market RSS | None | Headlines from Reuters, Seeking Alpha, MarketWatch, Nasdaq | 1st for news |
| Yahoo Finance | None (unofficial) | Quotes + price history | Last-resort price |
| Demo Provider | None | Synthetic OHLCV + news | Emergency fallback |
| Alpha Vantage | Free key (25/day) | Quotes, OHLCV, news sentiment | 1st with key |
| Finnhub | Free key (60/min) | Real-time quotes, company news | 1st with key |
| FMP | Free key (250/day) | Income statements, EPS, margins | 1st fundamentals with key |
| FRED | Free key (unlimited) | Fed funds, CPI, unemployment, yields | Macro regime |
| Gemini AI | Free key | Research summaries + market commentary | AI only |

---

## Data Flow (no API keys)

```
Request → providerManager.tryProvider(provider)
       → provider.isConfigured() == false → returns null
       → tryProvider catches null → returns null safely
       → next provider in priority chain
       → ... all optional providers return null ...
       → FINRA (no key): real short-sale data ✓
       → RSS (no key): real market headlines ✓
       → SEC EDGAR (no key): filing metadata ✓
       → Yahoo fallback: real price history ✓
       → Demo: fills any remaining gaps
```

---

## Scoring System

The APEX Score is a weighted composite of 5 signals:

| Signal | Weight | Source | No-key behaviour |
|---|---|---|---|
| Momentum | 25% | Price history (AV / Yahoo / Demo) | 50 (neutral) |
| Volatility | 15% | Price history (AV / Yahoo / Demo) | 50 (neutral) |
| Fundamentals | 25% | SEC XBRL / FMP / Demo | 50 (neutral) |
| News Sentiment | 20% | RSS feeds / AV news / Demo | 50 (neutral) |
| Short Pressure | 15% | FINRA (always real) | real data |

**Confidence calculation:** based on how many of the 5 components had real data.
- All 5 real data: 85–90%
- Missing price history: drops to 30–45%
- Demo-only: 20–30%

**Rating labels:** Strong Watch / Positive Setup / Neutral / Cautious / High Risk
*(never "guaranteed", "risk-free", or "will outperform")*

---

## Runtime Crash Prevention

All routes are wrapped in try/catch. The server uses:
1. `tryProvider()` — wraps all provider calls in `Promise.resolve()` so `null` returns don't crash
2. Express global error middleware — catches unhandled route errors
3. `process.on('unhandledRejection')` — logs but doesn't exit
4. `process.on('uncaughtException')` — logs but doesn't exit
5. `aiResearchService` — on any error (quota, network), returns structured fallback text

---

## Deployment

The app has no external database dependency. SQLite is created automatically on first start.

```bash
# Install
cd ati && npm install
cd ati/client && npm install

# Run (development)
cd ati && npm run dev

# Run (production)
cd ati && npm start
```

Optional: copy `.env.example` to `.env` and add free API keys to improve data quality.

---

## File Structure (54 files)

```
ati/
├── server/
│   ├── index.js              — Express server, error middleware, startup
│   ├── db/index.js           — SQLite setup (ignores PostgreSQL DATABASE_URL)
│   ├── providers/            — 10 data provider adapters + providerManager
│   ├── services/             — Business logic (scoring, news, filings, AI, cache, budget)
│   └── routes/               — 8 route modules with try/catch
└── client/
    ├── src/pages/            — 8 React pages including DataQuality, Backtest, Research
    └── src/components/       — Shared UI components
```
