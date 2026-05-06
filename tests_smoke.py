from alert_engine import score_assets
from market_data import load_features


def run() -> None:
    df = load_features(["SPY"], period="1mo", interval="1d")
    assert not df.empty, "No price data returned"
    ranked = score_assets(df)
    assert "ai_score" in ranked.columns, "AI score missing"
    assert ranked.iloc[0]["signal"] in {"Strong Buy", "Buy", "Hold", "Avoid"}


if __name__ == "__main__":
    run()
    print("ok")
