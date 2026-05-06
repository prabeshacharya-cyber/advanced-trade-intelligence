# APEX Financial

APEX now ships with a **Trader Command Center** workflow for active traders (dashboard, scanner, watchlist, planner, alerts, journal, calendar, backtest-lite placeholders) while preserving existing backend market + AI services.

## Run locally

### 1) Backend API (Express)
```bash
npm install
npm run start
```

### 2) Frontend (Vite React)
```bash
cd apex-web
npm install
npm run dev
```

### 3) Frontend tests
```bash
cd apex-web
npm run test
```

## Environment variables

Create a `.env` (or set env vars in your host):

- `AI_INTEGRATIONS_GEMINI_API_KEY` (optional, required for AI endpoints)
- `AI_INTEGRATIONS_GEMINI_BASE_URL` (optional provider override)
- `PORT` or `SERVER_PORT` (optional backend port, defaults to `3000`)

If AI env vars are missing, core command-center pages still run with mock/provider fallback behavior.

## What is mocked vs live

### Live-backed now
- `/api/market/overview`
- `/api/market/top-assets`

### Mock/TODO adapters now
- advanced scanner filters (halt feed, float-quality normalization)
- calendar vendor integration
- ticker-specific catalyst enrichment
- halt feed wiring (Nasdaq/NYSE/Cboe/FINRA)
- historical intraday strategy tester execution

Provider interfaces live under `apex-web/src/providers/interfaces.js` and are designed for drop-in replacement.

## Safety disclaimer

This app is for education, research, journaling, and risk management. It does **not** provide investment advice or guarantee outcomes.
