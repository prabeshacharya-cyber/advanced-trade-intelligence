from __future__ import annotations

import pandas as pd
import plotly.express as px
import streamlit as st

from alert_engine import (
    build_morning_digest,
    build_significant_event_alert,
    score_assets,
    send_morning_digest,
    send_significant_event_alert_if_needed,
)
from config import settings
from market_data import latest_news, load_features

st.set_page_config(page_title="APEX Pro Trading", layout="wide")
st.title("APEX Pro — AI Trading Radar")

watchlist_text = st.sidebar.text_input("Watchlist", ",".join(settings.watchlist))
threshold = st.sidebar.slider("Event threshold %", 1.0, 10.0, float(settings.significant_move_pct), 0.5)
tickers = [t.strip().upper() for t in watchlist_text.split(",") if t.strip()]

raw = load_features(tickers)
ranked = score_assets(raw)

c1, c2 = st.columns([2, 1])
with c1:
    st.subheader("AI Opportunity Ranking")
    if ranked.empty:
        st.warning("No data available.")
    else:
        st.dataframe(
            ranked[["ticker", "price", "change_pct", "momentum_20d", "vol_ratio", "rsi14", "ai_score", "signal"]],
            use_container_width=True,
        )
        st.plotly_chart(px.bar(ranked, x="ticker", y="ai_score", color="signal", title="AI Scores"), use_container_width=True)

with c2:
    st.subheader("Actions")
    if st.button("Send Morning Email"):
        try:
            send_morning_digest()
            st.success("Sent")
        except Exception as e:
            st.error(str(e))

    if st.button("Run Event Alert Check"):
        try:
            st.info("Alert sent" if send_significant_event_alert_if_needed() else "No new event")
        except Exception as e:
            st.error(str(e))

    if st.button("Preview Digest"):
        subject, body = build_morning_digest(tickers)
        st.write(subject)
        st.components.v1.html(body, height=260, scrolling=True)

st.subheader("News")
if tickers:
    t = st.selectbox("Ticker", tickers)
    for n in latest_news(t, limit=6):
        st.markdown(f"- [{n['title']}]({n['link']})")

st.subheader("Event Preview")
preview = build_significant_event_alert(tickers, threshold, persist_state=False)
if preview:
    st.write(preview[0])
    st.components.v1.html(preview[1], height=240, scrolling=True)
else:
    st.caption("No new event above threshold.")
from market_data import latest_news, load_prices

st.set_page_config(page_title="APEX Trading Assistant", layout="wide")
st.title("📈 APEX Interactive Trading Assistant")
st.caption("Morning dashboard + automated email alerts for your watchlist")

st.sidebar.header("Settings")
watchlist_text = st.sidebar.text_input("Watchlist (comma separated)", ",".join(settings.watchlist))
threshold = st.sidebar.slider("Significant move threshold (%)", 1.0, 10.0, float(settings.significant_move_pct), 0.5)
selected = [x.strip().upper() for x in watchlist_text.split(",") if x.strip()]

col1, col2 = st.columns([2, 1])

with col1:
    st.subheader("Live Watchlist Snapshot")
    df = load_prices(selected)
    if df.empty:
        st.warning("No data returned. Try fewer symbols or check network connectivity.")
    else:
        df = df.sort_values("change_pct", ascending=False)
        st.dataframe(df, use_container_width=True)
        fig = px.bar(df, x="ticker", y="change_pct", color="change_pct", title="1-Day % Change", text="change_pct")
        st.plotly_chart(fig, use_container_width=True)

with col2:
    st.subheader("Alert Controls")
    if st.button("Send Morning Digest Now"):
        try:
            send_morning_digest()
            st.success("Morning digest sent.")
        except Exception as exc:
            st.error(f"Failed to send digest: {exc}")

    if st.button("Check Significant Event & Send"):
        try:
            sent = send_significant_event_alert_if_needed()
            if sent:
                st.success("Significant event alert sent.")
            else:
                st.info("No significant events crossed your threshold.")
        except Exception as exc:
            st.error(f"Alert check failed: {exc}")

    if st.button("Preview Digest HTML"):
        subject, body = build_morning_digest(selected)
        st.markdown(f"**Subject:** {subject}")
        st.components.v1.html(body, height=300, scrolling=True)

st.subheader("News Radar")
if selected:
    ticker_for_news = st.selectbox("Ticker", selected, index=0)
    items = latest_news(ticker_for_news, limit=8)
    if not items:
        st.info("No recent headlines found.")
    for item in items:
        st.markdown(f"- [{item['title']}]({item['link']})  ")

st.subheader("Significant Event Preview")
preview = build_significant_event_alert(selected, threshold)
if preview:
    st.markdown(f"**Subject:** {preview[0]}")
    st.components.v1.html(preview[1], height=360, scrolling=True)
else:
    st.write("No movers above threshold in the latest snapshot.")

st.markdown("---")
st.caption("To run background automatic alerts: `python run_alerts.py`")
