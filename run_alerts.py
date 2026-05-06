from __future__ import annotations

from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger

from alert_engine import send_morning_digest, send_significant_event_alert_if_needed
from config import settings


def main() -> None:
    scheduler = BlockingScheduler(timezone="UTC")

    scheduler.add_job(
        send_morning_digest,
        CronTrigger(hour=settings.daily_alert_hour_utc, minute=0),
        id="morning_digest",
        replace_existing=True,
    )
    scheduler.add_job(
        send_significant_event_alert_if_needed,
        "interval",
        minutes=15,
        id="significant_events",
        replace_existing=True,
    )

    print("Alert scheduler running.")
    print(f"Morning digest hour (UTC): {settings.daily_alert_hour_utc}:00")
    print(f"Significant move threshold: {settings.significant_move_pct}%")

    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        pass


if __name__ == "__main__":
    main()
