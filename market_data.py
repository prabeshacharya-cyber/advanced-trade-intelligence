from __future__ import annotations

from datetime import datetime, timezone
from functools import lru_cache

import feedparser
import pandas as pd
import yfinance as yf


def _to_frame(data: pd.DataFrame, ticker: str, multi: bool) -> pd.DataFrame:
    if multi:
        return data[ticker].copy()
    return data.copy()


@lru_cache(maxsize=32)
def _download_cached(tickers_key: str, period: str, interval: str) -> pd.DataFrame:
    tickers = tickers_key.split(",")
    return yf.download(
        tickers=tickers,
        period=period,
        interval=interval,
        auto_adjust=True,
        group_by="ticker",
        progress=False,
        threads=True,
    )


def _rsi(series: pd.Series, n: int = 14) -> float:
    delta = series.diff()
    gain = delta.clip(lower=0).rolling(n).mean()
    loss = (-delta.clip(upper=0)).rolling(n).mean()
    rs = gain / loss.replace(0, pd.NA)
    val = 100 - (100 / (1 + rs))
    return float(val.dropna().iloc[-1]) if not val.dropna().empty else 50.0


def load_features(tickers: list[str], period: str = "6mo", interval: str = "1d") -> pd.DataFrame:
    tickers = [t.upper() for t in tickers]
    if not tickers:
        return pd.DataFrame()

    data = _download_cached(",".join(tickers), period, interval)
    if data.empty:
        return pd.DataFrame()

    multi = len(tickers) > 1
    rows = []
    for ticker in tickers:
        frame = _to_frame(data, ticker, multi)
        close = frame.get("Close", pd.Series(dtype=float)).dropna()
        vol = frame.get("Volume", pd.Series(dtype=float)).dropna()
        if close.empty:
            continue

        price = float(close.iloc[-1])
        prev = float(close.iloc[-2]) if len(close) > 1 else price
        change_pct = ((price - prev) / prev) * 100 if prev else 0.0

        sma20 = float(close.tail(20).mean()) if len(close) >= 20 else price
        sma50 = float(close.tail(50).mean()) if len(close) >= 50 else sma20
        momentum_20d = ((price / close.iloc[-20]) - 1) * 100 if len(close) >= 20 else change_pct
        vol_ratio = float(vol.iloc[-1] / vol.tail(30).mean()) if len(vol) >= 30 and vol.tail(30).mean() else 1.0
        rsi14 = _rsi(close)
        vol_20d = float(close.pct_change().tail(20).std() * 100)

        rows.append(
            {
                "ticker": ticker,
                "price": round(price, 2),
                "change_pct": round(change_pct, 2),
                "momentum_20d": round(momentum_20d, 2),
                "vol_ratio": round(vol_ratio, 2),
                "rsi14": round(rsi14, 2),
                "sma20": round(sma20, 2),
                "sma50": round(sma50, 2),
                "volatility_20d_pct": round(vol_20d, 2),
                "updated_utc": datetime.now(timezone.utc).isoformat(),
            }
        )

    return pd.DataFrame(rows)


def latest_news(ticker: str, limit: int = 5) -> list[dict]:
    url = f"https://feeds.finance.yahoo.com/rss/2.0/headline?s={ticker}&region=US&lang=en-US"
    feed = feedparser.parse(url)
    return [
        {
            "title": entry.get("title", ""),
            "link": entry.get("link", ""),
            "published": entry.get("published", ""),
        }
        for entry in feed.entries[:limit]
    ]
