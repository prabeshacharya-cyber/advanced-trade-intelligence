import { useState } from 'react'
import { calcTradePlan, defaultTradingRules } from '../lib/riskEngine'

const card = { background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, padding:'16px 18px', marginBottom:16 }
const inp  = { background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--text)', padding:'7px 10px', borderRadius:8, fontSize:13, outline:'none', width:'100%' }

function fmt(n) { return `$${Number(n||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}` }

export default function PlannerPage() {
  const [planInput, setPlanInput] = useState({
    accountSize: 25000,
    maxRiskPerTradePct: 1,
    maxDailyLossPct: 3,
    entryPrice: 0,
    stopLossPrice: 0,
    targetPrice: 0,
  })

  const out = calcTradePlan(planInput)

  const fields = [
    ['Account Size $',       'accountSize'],
    ['Max Risk Per Trade %', 'maxRiskPerTradePct'],
    ['Max Daily Loss %',     'maxDailyLossPct'],
    ['Entry Price',          'entryPrice'],
    ['Stop Loss Price',      'stopLossPrice'],
    ['Target Price',         'targetPrice'],
  ]

  const outputs = [
    ['Dollar Risk Allowed',   fmt(out.dollarRiskAllowed)],
    ['Position Size (Shares)',out.positionSizeShares],
    ['Estimated Cost',        fmt(out.estimatedCost)],
    ['Risk/Reward Ratio',     `${out.riskRewardRatio}:1`],
    ['Break-even Win Rate',   `${out.breakEvenWinRate}%`],
    ['Potential Profit',      fmt(out.potentialProfit)],
    ['Potential Loss',        fmt(out.potentialLoss)],
  ]

  return (
    <div>
      <h2 style={{ fontSize:20, fontWeight:700, marginBottom:4 }}>Trade Planner</h2>
      <p style={{ fontSize:13, color:'var(--muted)', marginBottom:20 }}>Position sizing, risk/reward calculation, and trade planning tools.</p>

      <div style={card}>
        <h3 style={{ fontWeight:700, marginBottom:14 }}>Trade Inputs</h3>
        <div className="mobile-grid-2" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
          {fields.map(([label, key]) => (
            <label key={key} style={{ display:'flex', flexDirection:'column', gap:4, fontSize:12, color:'var(--muted)' }}>
              {label}
              <input type="number" value={planInput[key]} onChange={e => setPlanInput(p => ({ ...p, [key]:e.target.value }))}
                style={inp} />
            </label>
          ))}
        </div>
      </div>

      <div style={card}>
        <h3 style={{ fontWeight:700, marginBottom:14 }}>Position Sizing Output</h3>
        <div className="mobile-grid-2" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
          {outputs.map(([label, val]) => (
            <div key={label} style={{ border:'1px solid var(--border)', borderRadius:10, padding:'12px 14px' }}>
              <p style={{ fontSize:11, color:'var(--muted)', marginBottom:4 }}>{label}</p>
              <p style={{ fontWeight:700, fontSize:15 }}>{val}</p>
            </div>
          ))}
        </div>
        {out.warnings?.length > 0 && (
          <div style={{ marginTop:14 }}>
            {out.warnings.map(w => <p key={w} style={{ color:'var(--yellow)', fontSize:13, marginBottom:4 }}>⚠ {w}</p>)}
          </div>
        )}
        <p style={{ fontSize:11, color:'var(--muted)', opacity:0.6, marginTop:12 }}>{defaultTradingRules.ruleNote}</p>
      </div>
    </div>
  )
}
