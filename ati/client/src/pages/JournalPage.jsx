import { useState, useEffect } from 'react'
import { loadJSON, saveJSON } from '../lib/storage'
import { computeTradeValues, computeJournalMetrics } from '../lib/journalMetrics'

const card = { background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, padding:'16px 18px', marginBottom:16 }
const inp  = { background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--text)', padding:'7px 10px', borderRadius:8, fontSize:13, outline:'none', width:'100%' }
const fmt  = n => `$${Number(n||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`

const BLANK = { symbol:'', direction:'long', entry:'', exit:'', shares:'', stop:'', fees:0, setupType:'' }
const SETUP_TYPES = ['Bull Flag','Gap Up','Breakout','Pullback','Reversal','Earnings Play','Momentum','VWAP Reclaim','Short Squeeze','Other']

export default function JournalPage() {
  const [trades, setTrades_] = useState(() => loadJSON('ati_journal', []))
  const [draft, setDraft]    = useState(BLANK)
  const [error, setError]    = useState('')
  const metrics              = computeJournalMetrics(trades)

  function setTrades(v) { setTrades_(v); saveJSON('ati_journal', v) }

  const stats = [
    ['Trades',        metrics.tradeCount],
    ['Win Rate',      `${metrics.winRate}%`],
    ['Avg Win',       fmt(metrics.averageWin)],
    ['Avg Loss',      fmt(metrics.averageLoss)],
    ['Profit Factor', metrics.profitFactor],
    ['Max Drawdown',  fmt(metrics.maxDrawdown)],
  ]

  return (
    <div>
      <h2 style={{ fontSize:20, fontWeight:700, marginBottom:4 }}>Trade Journal</h2>
      <p style={{ fontSize:13, color:'var(--muted)', marginBottom:20 }}>Log trades, track performance metrics, and review your edge.</p>

      <div style={card}>
        <h3 style={{ fontWeight:700, marginBottom:14 }}>Log Trade</h3>
        <div className="mobile-grid-2" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:12 }}>
          <input placeholder="Symbol" value={draft.symbol}
            onChange={e => setDraft({ ...draft, symbol:e.target.value.toUpperCase() })}
            style={inp} />
          <select value={draft.direction} onChange={e => setDraft({ ...draft, direction:e.target.value })}
            style={{ ...inp }}>
            <option value="long">Long</option>
            <option value="short">Short</option>
          </select>
          <input placeholder="Entry price" type="number" value={draft.entry}
            onChange={e => setDraft({ ...draft, entry:e.target.value })} style={inp} />
          <input placeholder="Exit price" type="number" value={draft.exit}
            onChange={e => setDraft({ ...draft, exit:e.target.value })} style={inp} />
          <input placeholder="Shares" type="number" value={draft.shares}
            onChange={e => setDraft({ ...draft, shares:e.target.value })} style={inp} />
          <input placeholder="Stop price" type="number" value={draft.stop}
            onChange={e => setDraft({ ...draft, stop:e.target.value })} style={inp} />
          <input placeholder="Fees $" type="number" value={draft.fees}
            onChange={e => setDraft({ ...draft, fees:e.target.value })} style={inp} />
          <select value={draft.setupType} onChange={e => setDraft({ ...draft, setupType:e.target.value })}
            style={{ ...inp, color: draft.setupType ? 'var(--text)' : 'var(--muted)' }}>
            <option value="">Setup type</option>
            {SETUP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        {error && <p style={{ color:'var(--red)', fontSize:12, marginBottom:8 }}>⚠ {error}</p>}
        <button
          onClick={() => {
            if (!draft.symbol) { setError('Symbol is required.'); return }
            if (!draft.entry || Number(draft.entry) <= 0) { setError('Entry price must be greater than 0.'); return }
            if (!draft.exit  || Number(draft.exit)  <= 0) { setError('Exit price must be greater than 0.'); return }
            if (!draft.shares || Number(draft.shares) <= 0) { setError('Shares must be greater than 0.'); return }
            setError('')
            const calc = computeTradeValues(draft)
            setTrades([{ ...draft, ...calc, id:crypto.randomUUID(), dateTime:new Date().toISOString() }, ...trades])
            setDraft(BLANK)
          }}
          style={{ padding:'7px 16px', borderRadius:8, background:'rgba(34,197,94,0.12)', border:'1px solid rgba(34,197,94,0.3)', color:'var(--green)', fontWeight:700, cursor:'pointer', fontSize:13 }}>
          + Add Trade
        </button>
      </div>

      <div style={card}>
        <h3 style={{ fontWeight:700, marginBottom:14 }}>Analytics</h3>
        <div className="mobile-grid-2" style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:10 }}>
          {stats.map(([label, val]) => (
            <div key={label} style={{ border:'1px solid var(--border)', borderRadius:10, padding:'12px 14px' }}>
              <p style={{ fontSize:11, color:'var(--muted)', marginBottom:4 }}>{label}</p>
              <p style={{ fontWeight:700, fontSize:14 }}>{val}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={card}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <h3 style={{ fontWeight:700 }}>Trade Log ({trades.length})</h3>
          {trades.length > 0 && (
            <button onClick={() => setTrades([])} style={{ fontSize:12, color:'var(--red)', background:'none', border:'1px solid rgba(239,68,68,0.3)', borderRadius:7, padding:'4px 10px', cursor:'pointer' }}>
              Clear All
            </button>
          )}
        </div>
        {trades.length === 0
          ? <p style={{ color:'var(--muted)', fontSize:13 }}>No trades logged yet.</p>
          : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', fontSize:13, borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ textAlign:'left', color:'var(--muted)', borderBottom:'1px solid var(--border)' }}>
                    <th style={{ paddingBottom:8, paddingRight:14 }}>Symbol</th>
                    <th style={{ paddingBottom:8, paddingRight:14 }}>Dir</th>
                    <th style={{ paddingBottom:8, paddingRight:14 }}>Entry</th>
                    <th style={{ paddingBottom:8, paddingRight:14 }}>Exit</th>
                    <th style={{ paddingBottom:8, paddingRight:14 }}>Net P&L</th>
                    <th style={{ paddingBottom:8, paddingRight:14 }}>R</th>
                    <th style={{ paddingBottom:8, paddingRight:14 }}>Setup</th>
                    <th style={{ paddingBottom:8 }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map(t => (
                    <tr key={t.id} style={{ borderTop:'1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding:'7px 14px 7px 0', fontWeight:700 }}>{t.symbol}</td>
                      <td style={{ padding:'7px 14px 7px 0', color:'var(--muted)', textTransform:'capitalize' }}>{t.direction}</td>
                      <td style={{ padding:'7px 14px 7px 0', color:'var(--muted)' }}>{t.entry}</td>
                      <td style={{ padding:'7px 14px 7px 0', color:'var(--muted)' }}>{t.exit}</td>
                      <td style={{ padding:'7px 14px 7px 0', color: t.netPnL>=0 ? 'var(--green)' : 'var(--red)', fontWeight:600 }}>{fmt(t.netPnL)}</td>
                      <td style={{ padding:'7px 14px 7px 0', color: t.rMultiple>=0 ? 'var(--green)' : 'var(--red)' }}>{t.rMultiple}R</td>
                      <td style={{ padding:'7px 14px 7px 0', color:'var(--muted)', fontSize:12 }}>{t.setupType || '—'}</td>
                      <td style={{ padding:'7px 0', color:'var(--muted)', fontSize:11 }}>{t.dateTime ? new Date(t.dateTime).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </div>
    </div>
  )
}
