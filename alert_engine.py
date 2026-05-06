from __future__ import annotations

import json
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
from typing import Iterable

import pandas as pd

from config import settings
from market_data import latest_news, load_features

STATE_PATH = Path(".alert_state.json")


def score_assets(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return df

    def clip100(x: float) -> float:
        return float(max(0, min(100, x)))

    out = df.copy()
    out["momentum_score"] = out["momentum_20d"].apply(lambda x: clip100(50 + x * 2))
    out["volume_score"] = out["vol_ratio"].apply(lambda x: clip100(x * 35))
    out["technical_score"] = (out["price"] > out[["sma20", "sma50"]].max(axis=1)).astype(int) * 100
    out["risk_score"] = out["volatility_20d_pct"].apply(lambda x: clip100(100 - x * 8))
    out["ai_score"] = (
        0.38 * out["momentum_score"]
        + 0.24 * out["volume_score"]
        + 0.22 * out["technical_score"]
        + 0.16 * out["risk_score"]
    ).round(1)
    out["signal"] = out["ai_score"].apply(
        lambda s: "Strong Buy" if s >= 80 else "Buy" if s >= 67 else "Hold" if s >= 50 else "Avoid"
    )
    return out.sort_values("ai_score", ascending=False)


def _send_email(subject: str, html_body: str) -> None:
    if not all(
        [
            settings.smtp_host,
            settings.smtp_user,
            settings.smtp_password,
            settings.sender_email,
            settings.recipient_email,
        ]
    ):
        raise RuntimeError("Missing SMTP configuration. Fill .env before sending alerts.")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.sender_email
    msg["To"] = settings.recipient_email
    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=30) as server:
        if settings.smtp_use_tls:
            server.starttls()
        server.login(settings.smtp_user, settings.smtp_password)
        server.sendmail(settings.sender_email, [settings.recipient_email], msg.as_string())


def _load_state() -> dict:
    if not STATE_PATH.exists():
        return {}
    try:
        return json.loads(STATE_PATH.read_text())
    except json.JSONDecodeError:
        return {}


def _save_state(state: dict) -> None:
    STATE_PATH.write_text(json.dumps(state, indent=2))


def build_morning_digest(tickers: Iterable[str]) -> tuple[str, str]:
    df = score_assets(load_features(list(tickers)))
    if df.empty:
        return "Morning Market Digest", "<p>No market data available.</p>"

    top = df.head(5)
    rows = "".join(
        f"<tr><td>{r.ticker}</td><td>{r.price}</td><td>{r.change_pct}%</td><td>{r.ai_score}</td><td>{r.signal}</td></tr>"
        for r in top.itertuples()
    )
    subject = f"Morning AI Digest: top pick {top.iloc[0]['ticker']} ({top.iloc[0]['ai_score']})"
    body = (
        "<h2>Morning AI Ranking</h2>"
        "<table border='1' cellpadding='6' cellspacing='0'>"
        "<tr><th>Ticker</th><th>Price</th><th>1D %</th><th>AI Score</th><th>Signal</th></tr>"
        f"{rows}</table>"
        "<p>Signals are model-driven and should be risk-managed.</p>"
    )
    return subject, body


def build_significant_event_alert(
    tickers: Iterable[str], threshold_pct: float, persist_state: bool = True
) -> tuple[str, str] | None:
    ranked = score_assets(load_features(list(tickers), period="3mo", interval="1d"))
    if ranked.empty:
        return None

    movers = ranked[ranked["change_pct"].abs() >= threshold_pct]
    if movers.empty:
        return None

    state = _load_state()
    key = ",".join(f"{r.ticker}:{r.change_pct}" for r in movers.itertuples())
    if state.get("last_event_key") == key:
        return None

    blocks = []
    for row in movers.itertuples():
        headline = latest_news(row.ticker, limit=1)
        news = headline[0]["title"] if headline else "No fresh headline"
        blocks.append(f"<li><b>{row.ticker}</b> {row.change_pct}% | score {row.ai_score} | {news}</li>")

    if persist_state:
        _save_state({"last_event_key": key})
    subject = f"Significant Event Alert ({len(movers)} symbols)"
    body = "<h2>Large Move + AI Signal</h2><ul>" + "".join(blocks) + "</ul>"
    return subject, body


def send_morning_digest() -> None:
    subject, body = build_morning_digest(settings.watchlist)
    _send_email(subject, body)


def send_significant_event_alert_if_needed() -> bool:
    alert = build_significant_event_alert(settings.watchlist, settings.significant_move_pct)
    if not alert:
        return False
    _send_email(*alert)
    return True
