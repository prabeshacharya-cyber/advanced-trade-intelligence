# ATI — Advanced Trade Intelligence

> AI-powered stock, ETF & fund intelligence platform built on a **free-first data architecture**.
> No paid subscriptions required to run. Add free API keys for higher-quality signals.

---

## Features

| Feature | Description |
|---|---|
| Market Leaders | APEX Score ranking for 150+ stocks with probability of benchmark outperformance |
| Fund Leaders | ETF/fund scoring on momentum, volatility, and sentiment |
| Asset Detail | Per-symbol deep-dive: score components, news, SEC filings, AI research |
| Backtest Lab | Simulate APEX Score signals on historical data |
| Alerts | Automated score-change, rating-upgrade, and data-quality alerts |
| Data Quality | Live provider status, API budget tracking, free-key setup guide |

---

## Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/prabeshacharya-cyber/advanced-trade-intelligence.git
cd advanced-trade-intelligence
npm install
cd client && npm install && cd ..
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — at minimum, set JWT_SECRET and APEX_ADMIN_PASSWORD
# Optionally add free API keys (see Data Quality page for links)
```

### 3. Run

```bash
# Terminal 1 — backend (port 3001)
npm run server

# Terminal 2 — frontend (port 5001)
npm run client
```

Open **http://localhost:5001** in your browser.

---

## On first run

- SQLite database is created automatically (`ati.db`)
- 150+ symbols are seeded into the universe
- Click **"↻ Refresh Scores"** on the Market Leaders page to kick off the first data fetch

---

## Data Sources (all free)

| Source | Data | Key Required |
|---|---|---|
| SEC EDGAR | 10-K, 10-Q, 8-K filings, XBRL fundamentals | No (User-Agent only) |
| Alpha Vantage | Quotes, OHLCV history, news sentiment | Free key at alphavantage.co |
| Finnhub | Real-time quotes, company news, profiles | Free key at finnhub.io |
| FMP | Income statements, quotes, news | Free key at financialmodelingprep.com |
| FRED | Fed funds rate, CPI, unemployment, yields | Free key at fred.stlouisfed.org |
| FINRA | Daily short-sale volume | No key |
| Nasdaq RSS | Trade halt/resume feed | No key |
| Yahoo Finance | Quotes + history (unofficial fallback) | No key |
| Google Gemini | AI research & commentary | Free tier at ai.google.dev |

---

## Rating Labels

| Label | Score Range | Meaning |
|---|---|---|
| Strong Watch | 80–100 | Highest probability of benchmark outperformance |
| Positive Setup | 65–79 | Favorable signal alignment |
| Neutral | 45–64 | No clear directional edge |
| Cautious | 30–44 | Below-average signal quality |
| High Risk | 0–29 | Multiple negative signals |

> **Important:** ATI scores represent probability of benchmark outperformance — not guaranteed returns.
> Past backtest performance does not predict future results. This is research intelligence, not investment advice.

---

## Scoring Components

| Component | Weight (Stock) | Weight (ETF) | Description |
|---|---|---|---|
| Momentum | 25% | 40% | Price momentum over 20/60-day windows |
| Volatility | 15% | 30% | Annualized volatility (lower = better for risk-adj.) |
| Fundamentals | 25% | — | Revenue, margins, EPS from SEC/FMP |
| News Sentiment | 20% | 30% | Weighted sentiment from recent news |
| Short Pressure | 15% | — | FINRA short-sale volume ratio |

---

## Environment Variables

See `.env.example` for the full list. Critical variables:

```env
JWT_SECRET=<64-char random string>      # Required
GEMINI_API_KEY=<your key>               # For AI research
ALPHA_VANTAGE_API_KEY=<your key>        # Best free data source
FRED_API_KEY=<your key>                 # Macro regime data
```

---

## Project Structure

```
ati/
├── server/
│   ├── index.js                    # Express entry point
│   ├── db/
│   │   ├── index.js                # SQLite connection + auto-migrate
│   │   └── schema.sql              # 20 tables
│   ├── providers/
│   │   ├── providerManager.js      # Routes requests to best source
│   │   ├── secProvider.js          # SEC EDGAR (free, no key)
│   │   ├── alphaVantageProvider.js # Alpha Vantage (free key)
│   │   ├── finnhubProvider.js      # Finnhub (free key)
│   │   ├── fmpProvider.js          # FMP (free key)
│   │   ├── fredProvider.js         # FRED macro data (free key)
│   │   ├── finraProvider.js        # FINRA short volume (no key)
│   │   ├── nasdaqRssProvider.js    # Nasdaq halt RSS (no key)
│   │   ├── rssNewsProvider.js      # RSS news feeds (no key)
│   │   ├── yahooFallbackProvider.js # Yahoo fallback (no key)
│   │   └── demoProvider.js         # Demo data (always available)
│   ├── services/
│   │   ├── cacheService.js         # Provider response caching
│   │   ├── apiBudgetService.js     # Daily API call budgeting
│   │   ├── universeService.js      # 150+ symbol universe
│   │   ├── newsService.js          # Fetch + store news
│   │   ├── eventClassifierService.js # Classify events + sentiment
│   │   ├── secFilingService.js     # Fetch + store SEC filings
│   │   ├── stockScoreService.js    # Stock APEX Score engine
│   │   ├── fundScoreService.js     # ETF/fund score engine
│   │   ├── scoreUtils.js           # Scoring math utilities
│   │   ├── alertService.js         # Alert generation
│   │   ├── backtestService.js      # Historical signal simulation
│   │   ├── aiResearchService.js    # Gemini AI research
│   │   └── schedulerService.js     # Cron jobs
│   └── routes/                     # Express API routes
├── client/
│   └── src/
│       ├── pages/                  # React pages
│       └── components/             # Shared components
└── .env.example
```

---

## API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/health` | GET | Server health check |
| `/api/universe` | GET | Full symbol universe |
| `/api/scores/top` | GET | Top stock scores |
| `/api/scores/top-funds` | GET | Top ETF scores |
| `/api/scores/:symbol` | GET | Latest score for symbol |
| `/api/scores/:symbol/refresh` | POST | Trigger score refresh |
| `/api/news/:symbol` | GET | Symbol news |
| `/api/news/market` | GET | Market-wide news |
| `/api/filings/:symbol` | GET | SEC filings |
| `/api/filings/:symbol/fundamentals` | GET | Enriched fundamentals |
| `/api/alerts` | GET | All alerts |
| `/api/backtest/:symbol` | POST | Run backtest |
| `/api/research/:symbol` | GET | AI research summary |
| `/api/research/market-commentary` | GET | Daily AI commentary |
| `/api/jobs/status` | GET | Scheduler + budget status |
| `/api/jobs/refresh` | POST | Trigger full universe refresh |
| `/api/jobs/data-quality` | GET | Provider health dashboard |

---

## Disclaimer

ATI is a research and educational tool. All scores, probabilities, and AI-generated content are for informational purposes only and do not constitute investment advice. The probability of benchmark outperformance is a statistical estimate based on historical signals — not a guarantee of future returns. Always do your own research.

---

*Built with Node.js, Express, SQLite, React, Vite, and free public data APIs.*
