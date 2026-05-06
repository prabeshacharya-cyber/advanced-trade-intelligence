import getDb from '../db/index.js'
import { getLatestScoreFromDb } from './stockScoreService.js'

const ALERT_RULES = [
  {
    name: 'apex_score_surge',
    check: (sym, prev, curr) => curr.apex_score - (prev?.apex_score || 50) >= 15,
    title: (sym) => `${sym} — Score Surge`,
    message: (sym, prev, curr) => `ATI Score jumped from ${prev?.apex_score || 'N/A'} → ${curr.apex_score}. Momentum shift detected.`,
    severity: 'high',
    type: 'score_change',
  },
  {
    name: 'apex_score_drop',
    check: (sym, prev, curr) => (prev?.apex_score || 50) - curr.apex_score >= 15,
    title: (sym) => `${sym} — Score Drop`,
    message: (sym, prev, curr) => `ATI Score fell from ${prev?.apex_score || 'N/A'} → ${curr.apex_score}. Review risk factors.`,
    severity: 'high',
    type: 'score_change',
  },
  {
    name: 'strong_watch_entry',
    check: (sym, prev, curr) => curr.rating_label === 'Strong Watch' && prev?.rating_label !== 'Strong Watch',
    title: (sym) => `${sym} — Entered Strong Watch`,
    message: (sym, _, curr) => `${sym} reached Strong Watch (Score: ${curr.apex_score}). Probability of benchmark outperformance: ${curr.probability_outperform}%.`,
    severity: 'medium',
    type: 'rating_change',
  },
  {
    name: 'high_risk_entry',
    check: (sym, prev, curr) => curr.rating_label === 'High Risk' && prev?.rating_label !== 'High Risk',
    title: (sym) => `${sym} — High Risk Alert`,
    message: (sym, _, curr) => `${sym} downgraded to High Risk (Score: ${curr.apex_score}). Increased uncertainty.`,
    severity: 'high',
    type: 'rating_change',
  },
  {
    name: 'low_confidence',
    check: (sym, prev, curr) => curr.confidence_score < 40,
    title: (sym) => `${sym} — Low Data Confidence`,
    message: (sym, _, curr) => `Low data confidence (${curr.confidence_score}%). Add API keys for higher-quality signals.`,
    severity: 'low',
    type: 'data_quality',
  },
]

export async function checkAndCreateAlerts(symbol, prevScore) {
  const curr = getLatestScoreFromDb(symbol)
  if (!curr) return []
  const db = getDb()
  const created = []
  const insertStmt = db.prepare(`
    INSERT INTO alerts(symbol, alert_type, title, message, severity, score_at_alert, metadata_json)
    VALUES(@symbol, @alert_type, @title, @message, @severity, @score_at_alert, @metadata_json)
  `)
  for (const rule of ALERT_RULES) {
    if (rule.check(symbol, prevScore, curr)) {
      const alert = {
        symbol,
        alert_type:    rule.type,
        title:         rule.title(symbol),
        message:       rule.message(symbol, prevScore, curr),
        severity:      rule.severity,
        score_at_alert:curr.apex_score,
        metadata_json: JSON.stringify({ rule: rule.name, prev: prevScore?.apex_score, curr: curr.apex_score }),
      }
      insertStmt.run(alert)
      created.push(alert)
    }
  }
  return created
}

export function getRecentAlerts(limit = 50) {
  return getDb().prepare(
    "SELECT * FROM alerts ORDER BY created_at DESC LIMIT ?"
  ).all(limit)
}

export function getAlertsForSymbol(symbol, limit = 20) {
  return getDb().prepare(
    "SELECT * FROM alerts WHERE symbol=? ORDER BY created_at DESC LIMIT ?"
  ).all(symbol, limit)
}

export function markAlertRead(id) {
  return getDb().prepare("UPDATE alerts SET is_read=1 WHERE id=?").run(id)
}

export function getUnreadCount() {
  return getDb().prepare("SELECT COUNT(*) as c FROM alerts WHERE is_read=0").get().c
}
