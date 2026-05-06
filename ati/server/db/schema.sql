-- Advanced Trade Intelligence — Database Schema

CREATE TABLE IF NOT EXISTS symbols (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT UNIQUE NOT NULL,
  name TEXT,
  asset_type TEXT DEFAULT 'stock',
  exchange TEXT,
  sector TEXT,
  industry TEXT,
  country TEXT DEFAULT 'US',
  market_cap REAL,
  is_active INTEGER DEFAULT 1,
  source TEXT DEFAULT 'seed',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS price_daily (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  date TEXT NOT NULL,
  open REAL, high REAL, low REAL, close REAL,
  adjusted_close REAL, volume INTEGER,
  source TEXT, is_demo INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(symbol, date)
);

CREATE TABLE IF NOT EXISTS quote_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  price REAL, change_percent REAL, volume INTEGER,
  avg_volume INTEGER, market_cap REAL,
  pe_ratio REAL, fifty_two_week_high REAL, fifty_two_week_low REAL,
  timestamp TEXT, source TEXT, is_demo INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS fundamentals_quarterly (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  fiscal_date TEXT,
  revenue REAL, revenue_growth REAL,
  eps REAL, eps_growth REAL,
  gross_margin REAL, operating_margin REAL, net_margin REAL,
  free_cash_flow REAL, debt_to_equity REAL,
  roe REAL, roic REAL, shares_outstanding INTEGER,
  source TEXT, is_demo INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(symbol, fiscal_date)
);

CREATE TABLE IF NOT EXISTS sec_filings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT, cik TEXT,
  form_type TEXT, accession_number TEXT UNIQUE,
  filing_date TEXT, report_date TEXT,
  title TEXT, description TEXT, url TEXT,
  event_type TEXT, sentiment TEXT, magnitude TEXT,
  source TEXT DEFAULT 'SEC EDGAR',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS news_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT,
  headline TEXT NOT NULL, summary TEXT, url TEXT,
  source TEXT, published_at TEXT,
  event_type TEXT DEFAULT 'general_news',
  sentiment TEXT DEFAULT 'neutral',
  magnitude TEXT DEFAULT 'low',
  confidence INTEGER DEFAULT 50,
  is_demo INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS macro_series (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  series_id TEXT NOT NULL, date TEXT NOT NULL,
  value REAL, name TEXT, source TEXT,
  is_demo INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(series_id, date)
);

CREATE TABLE IF NOT EXISTS short_sale_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL, date TEXT NOT NULL,
  short_volume INTEGER, total_volume INTEGER,
  short_volume_ratio REAL,
  source TEXT, is_demo INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(symbol, date)
);

CREATE TABLE IF NOT EXISTS trade_halts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT, issue_name TEXT, market TEXT,
  halt_date TEXT, halt_time TEXT, reason_code TEXT,
  resumption_date TEXT, resumption_time TEXT,
  source TEXT DEFAULT 'Nasdaq RSS',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS fund_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT UNIQUE NOT NULL,
  fund_name TEXT, fund_type TEXT,
  expense_ratio REAL, aum REAL,
  issuer TEXT, benchmark TEXT, category TEXT,
  inception_date TEXT,
  source TEXT, is_demo INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS fund_holdings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fund_symbol TEXT NOT NULL, holding_symbol TEXT,
  holding_name TEXT, weight REAL, shares REAL, market_value REAL,
  source TEXT, is_demo INTEGER DEFAULT 0,
  as_of_date TEXT,
  UNIQUE(fund_symbol, holding_symbol, as_of_date)
);

CREATE TABLE IF NOT EXISTS score_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL, asset_type TEXT,
  score_date TEXT, horizon TEXT DEFAULT '20d',
  benchmark TEXT,
  apex_score REAL, probability_outperform REAL,
  risk_score REAL, confidence_score REAL,
  rating_label TEXT,
  bullish_drivers_json TEXT, bearish_risks_json TEXT,
  data_quality_json TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS score_components (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  score_run_id INTEGER REFERENCES score_runs(id),
  component_name TEXT, component_score REAL,
  component_weight REAL, explanation TEXT
);

CREATE TABLE IF NOT EXISTS predictions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT, score_run_id INTEGER,
  prediction_date TEXT, horizon_days INTEGER,
  benchmark TEXT,
  price_at_prediction REAL, benchmark_price_at_prediction REAL,
  future_price REAL, future_benchmark_price REAL,
  asset_return REAL, benchmark_return REAL,
  excess_return REAL, hit INTEGER,
  completed INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT, alert_type TEXT,
  title TEXT, message TEXT,
  severity TEXT DEFAULT 'medium',
  score_at_alert REAL,
  metadata_json TEXT,
  is_read INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS provider_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL, cache_key TEXT NOT NULL,
  response_json TEXT, expires_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(provider, cache_key)
);

CREATE TABLE IF NOT EXISTS provider_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL, date TEXT NOT NULL,
  request_count INTEGER DEFAULT 0,
  daily_limit INTEGER DEFAULT 0,
  last_request_at TEXT,
  UNIQUE(provider, date)
);

CREATE TABLE IF NOT EXISTS provider_errors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT, endpoint_name TEXT,
  error_message TEXT, status_code INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS watchlists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT, symbol TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, symbol)
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT, updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS portfolio_positions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  shares REAL NOT NULL,
  avg_cost REAL NOT NULL,
  notes TEXT,
  added_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(symbol)
);

CREATE INDEX IF NOT EXISTS idx_price_symbol_date ON price_daily(symbol, date);
CREATE INDEX IF NOT EXISTS idx_score_runs_symbol ON score_runs(symbol, score_date);
CREATE INDEX IF NOT EXISTS idx_news_symbol ON news_events(symbol, published_at);
CREATE INDEX IF NOT EXISTS idx_filings_symbol ON sec_filings(symbol, filing_date);
CREATE INDEX IF NOT EXISTS idx_alerts_created ON alerts(created_at);
