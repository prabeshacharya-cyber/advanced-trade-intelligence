from __future__ import annotations

import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    smtp_host: str = os.getenv("SMTP_HOST", "")
    smtp_port: int = int(os.getenv("SMTP_PORT", "587"))
    smtp_user: str = os.getenv("SMTP_USER", "")
    smtp_password: str = os.getenv("SMTP_PASSWORD", "")
    smtp_use_tls: bool = os.getenv("SMTP_USE_TLS", "true").lower() == "true"
    sender_email: str = os.getenv("SENDER_EMAIL", "")
    recipient_email: str = os.getenv("RECIPIENT_EMAIL", "")
    watchlist: tuple[str, ...] = tuple(
        s.strip().upper()
        for s in os.getenv("WATCHLIST", "SPY,QQQ,NVDA,TSLA,AAPL,AMD,MSFT,META").split(",")
        if s.strip()
    )
    daily_alert_hour_utc: int = int(os.getenv("DAILY_ALERT_HOUR_UTC", "12"))
    significant_move_pct: float = float(os.getenv("SIGNIFICANT_MOVE_PCT", "3.0"))


settings = Settings()
