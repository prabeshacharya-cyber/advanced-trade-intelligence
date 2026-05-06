export const explainScore = (s) =>
  s >= 80 ? 'Excellent: many signals align, but still use stop losses.' :
  s >= 67 ? 'Good: setup looks favorable, but watch confirmation at entry.' :
  s >= 50 ? 'Mixed: some positives, some negatives, so size smaller.' :
  'Weak: risk is high compared with expected reward.'

export const signalFromScore = (s) =>
  s >= 80 ? 'Strong Buy' : s >= 67 ? 'Buy' : s >= 50 ? 'Hold' : 'Avoid'

export const statusText = (vix) =>
  vix > 25
    ? `VIX ${vix} — volatility is elevated, so price swings can be large. Use smaller position sizes.`
    : `VIX ${vix} — volatility is moderate, so moves are calmer than panic conditions.`
