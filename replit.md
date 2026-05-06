# ATI — Advanced Trade Intelligence

## Overview
ATI is a fintech platform spun from the APEX codebase. It provides comprehensive market intelligence for active traders using a free-first data architecture — no paid API required. Optional API keys (Alpha Vantage, Finnhub, FMP, FRED) improve signal quality.

GitHub: `prabeshacharya-cyber/advanced-trade-intelligence`

## Architecture
- **Frontend**: React 18 + Vite on port 5000 (`ati/client/`)
- **Backend**: Express ESM API server on port 3001 (`ati/server/`)
- **Database**: SQLite via better-sqlite3 (`ati/ati.db`)
- **AI**: Google Gemini 2.5 Pro via `GEMINI_API_KEY` (graceful fallback if quota exhausted)
- **Email**: Resend via `RESEND_API_KEY` for Morning Briefing delivery
- **Workflow**: `cd ati && npm run dev` (Vite proxies `/api` → port 3001)

## Data Sources (Free-First Architecture)
- **SEC EDGAR** — filings, Form 4 insider trades (free, rate-limited)
- **Alpha Vantage** — price history, fundamentals (`ALPHA_VANTAGE_API_KEY`)
- **Finnhub** — news, sentiment, company info (`FINNHUB_API_KEY`)
- **FMP** — financial statements, ratios (`FMP_API_KEY`)
- **FRED** — macro indicators: Fed Funds, CPI, Unemployment (`FRED_API_KEY`)
- **FINRA** — short interest data (free)
- **RSS/Yahoo** — fallback news feeds

## Project Structure
```
ati/
├── client/src/
│   ├── App.jsx                  # 20 routes
│   ├── components/Layout.jsx    # Desktop sidebar + APEX-style mobile bottom tab bar
│   ├── pages/                   # 20 page components
│   │   ├── DashboardPage.jsx
│   │   ├── MarketLeadersPage.jsx
│   │   ├── FundLeadersPage.jsx
│   │   ├── SentimentPage.jsx    # uses /api/scores/top
│   │   ├── FlowPage.jsx
│   │   ├── EarningsPage.jsx
│   │   ├── InsiderPage.jsx
│   │   ├── ResearchPage.jsx
│   │   ├── ChatPage.jsx
│   │   ├── ScannerPage.jsx      # uses /api/scores/top
│   │   ├── TradePlannerPage.jsx
│   │   ├── PortfolioPage.jsx
│   │   ├── JournalPage.jsx
│   │   ├── BacktestPage.jsx
│   │   ├── AlertsPage.jsx
│   │   ├── DataQualityPage.jsx
│   │   ├── PlannerPage.jsx
│   │   ├── SettingsPage.jsx
│   │   └── BriefingPage.jsx
│   └── lib/
│       ├── storage.js           # localStorage persistence
│       ├── riskEngine.js        # trade plan calculator
│       ├── journalMetrics.js    # journal analytics
│       └── alertEngine.js       # alert management
├── server/
│   ├── index.js                 # Express app, all routes registered
│   ├── db/index.js              # SQLite connection (better-sqlite3)
│   ├── routes/
│   │   ├── universe.js          # /api/universe
│   │   ├── scores.js            # /api/scores (top, top-funds, :symbol, :symbol/history)
│   │   ├── news.js              # /api/news
│   │   ├── filings.js           # /api/filings
│   │   ├── alerts.js            # /api/alerts
│   │   ├── backtest.js          # /api/backtest
│   │   ├── research.js          # /api/research
│   │   ├── jobs.js              # /api/jobs
│   │   ├── portfolio.js         # /api/portfolio
│   │   ├── macro.js             # /api/macro
│   │   ├── chat.js              # /api/chat (AI chat, earnings analysis, research)
│   │   └── briefing.js          # /api/briefing (config, subscribe, preview, send-now)
│   └── services/
│       ├── stockScoreService.js
│       ├── fundScoreService.js
│       ├── universeService.js
│       ├── newsService.js
│       ├── schedulerService.js
│       └── alertService.js
└── ati.db                       # SQLite database
```

## Day Trading (Alpaca)
- `ALPACA_MODE=paper` (default) or `live` — toggle via UI or `POST /api/momentum/mode`
- Paper keys: `ALPACA_PAPER_API_KEY` / `ALPACA_PAPER_SECRET_KEY`
- Live keys: `ALPACA_LIVE_API_KEY` / `ALPACA_LIVE_SECRET_KEY`
- Service: `ati/server/services/alpacaService.js` — data, analysis, order execution
- Route: `ati/server/routes/momentum.js` — `/api/momentum/*`
- Page: `ati/client/src/pages/MomentumPage.jsx` — `/momentum` (tabs: Scanner, Positions, Orders, History, Auto-Bot)
- Orders logged to `momentum_orders` SQLite table
- Safety guards: market hours only, max 3 open positions, bracket orders (1% SL / 2% TP)

## Automation (autoTradingService.js)
- **Auto-bot**: scans configured symbols every 5 min during market hours; auto-places bracket orders when BUY strength ≥ threshold
- **Portfolio drop alert**: monitors equity every 5 min; emails if portfolio falls > N% from day-open (default 5%); once per day
- **EOD summary email**: sent at 4:35 PM ET — day P&L, open positions, all orders placed today
- Config stored in `auto_trade_config` SQLite table; activity in `auto_trade_log`
- Routes: `GET/POST /api/momentum/auto-trade`, `GET /api/momentum/auto-log`, `POST /api/momentum/auto-run`
- Email recipients = briefing subscribers + admin email + optional `alertEmail` in bot config
- Day-start equity key: `dayStart_YYYY-MM-DD` in `auto_trade_config`

## API Routes Reference
| Route | Description |
|-------|-------------|
| `GET /api/scores/top?limit=N` | Top scored stocks (used by Scanner, Sentiment) |
| `GET /api/scores/top-funds?limit=N` | Top scored ETFs/funds |
| `GET /api/scores/:symbol` | Score for a specific symbol |
| `GET /api/news/market` | Recent market news |
| `GET /api/macro` | FRED macro indicators |
| `GET /api/briefing/config` | Briefing config + subscriber count |
| `POST /api/briefing/subscribe` | Subscribe email to daily briefing |
| `POST /api/briefing/send-now` | Send briefing via Resend to all subscribers |
| `GET /api/briefing/preview` | HTML preview of today's briefing |
| `POST /api/chat` | AI chat via Gemini |
| `GET /api/chat/earnings-calendar` | Upcoming earnings calendar |

## Environment Secrets
- `GEMINI_API_KEY` — Google Gemini AI (daily quota, graceful fallback)
- `ALPHA_VANTAGE_API_KEY` — Price history & fundamentals
- `FINNHUB_API_KEY` — News & sentiment
- `FMP_API_KEY` — Financial statements
- `FRED_API_KEY` — Macro indicators
- `RESEND_API_KEY` — Email delivery for Morning Briefing

## Mobile Design (APEX-matching)
- Bottom tab bar on mobile: **Markets** (BarChart3) · **Scores** (Trophy) · **AI Chat** (Sparkles) · **Tools** (Wrench) · **More** (sheet)
- Sector filter pills use `filter-scroll` CSS class → horizontal scroll, no wrapping on mobile
- MarketLeaders shows compact ranked rows on mobile (`.mobile-only`) vs table/card on desktop (`.desktop-only`)
- AI Commentary hidden on mobile; breadth row kept compact
- All multi-column grids get `mobile-grid-1` or `mobile-grid-2` class → stack on `< 768px`
- Responsive utilities in `styles.css`: `.mobile-grid-1`, `.mobile-grid-2`, `.filter-scroll`, `.table-scroll`, `.desktop-only`, `.mobile-only`

## Key Design Decisions
- All API calls go through the Express backend (never expose keys to client)
- SQLite is used for all persistence (scores, news, portfolio, alerts, subscribers)
- Scores are computed using a multi-factor model: momentum, volatility, fundamentals, news, short interest
- The ATI scoring engine gracefully degrades when data sources are unavailable
- Vite dev server proxies `/api/*` to `localhost:3001` (configured in vite.config.js)
