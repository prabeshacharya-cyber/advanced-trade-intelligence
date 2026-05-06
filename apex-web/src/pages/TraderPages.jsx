import { useEffect, useMemo, useState } from 'react'
import { loadJSON, saveJSON } from '../core/storage'
import { calcTradePlan, defaultTradingRules } from '../features/risk/riskEngine'
import { runAlertPass } from '../features/alerts/alertEngine'
import { computeJournalMetrics, computeTradeValues } from '../features/journal/metrics'

const TAGS = ['momentum','earnings','breakout','short squeeze','low float','swing','avoid']

function Card({ title, children, right }) {
  return (
    <div className='card'>
      <div className='flex justify-between items-center mb-3'>
        <h3 className='font-semibold text-white'>{title}</h3>
        {right}
      </div>
      {children}
    </div>
  )
}

function Num({ label, value, onChange }) {
  return (
    <label className='text-xs text-muted flex flex-col gap-1'>
      {label}
      <input
        className='bg-card2 border border-border rounded-lg px-2 py-1.5 text-text text-sm focus:outline-none focus:border-info'
        type='number'
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </label>
  )
}

function fmtMoney(n) { return `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }
function fmtVolume(volume) {
  if (!Number.isFinite(Number(volume))) return '-'
  return `${(Number(volume) / 1e6).toFixed(1)}M`
}

function WatchlistPanel({ rows, watchlist, setWatchlist }) {
  const [newSymbol, setNewSymbol] = useState('')
  const add = () => {
    const symbol = newSymbol.trim().toUpperCase()
    if (!symbol) return
    if (watchlist.some(w => w.symbol === symbol)) return
    setWatchlist([...watchlist, { symbol, tags: [], note: '', alert: false }])
    setNewSymbol('')
  }
  return (
    <div>
      <div className='flex gap-2 mb-3'>
        <input
          value={newSymbol}
          onChange={e => setNewSymbol(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder='Add symbol (e.g. TSLA)'
          className='flex-1 bg-card2 border border-border rounded-lg px-3 py-1.5 text-sm text-text focus:outline-none focus:border-info'
        />
        <button onClick={add} className='border border-border rounded-lg px-3 py-1.5 text-sm hover:bg-white/5 transition-colors'>Add</button>
      </div>
      <div className='space-y-2 max-h-72 overflow-auto'>
        {watchlist.length === 0 && <p className='text-muted text-sm'>No symbols yet. Add one above.</p>}
        {watchlist.map(item => {
          const row = rows.find(r => r.symbol === item.symbol)
          return (
            <div key={item.symbol} className='border border-border rounded-xl p-3 text-xs space-y-1.5'>
              <div className='flex justify-between items-center'>
                <span className='font-semibold text-white text-sm'>{item.symbol}</span>
                <button onClick={() => setWatchlist(watchlist.filter(w => w.symbol !== item.symbol))} className='text-muted hover:text-bear transition-colors'>✕</button>
              </div>
              <p className='text-muted'>
                Price <span className='text-white'>{row?.price ?? '—'}</span> ·
                Change <span className={row?.changePct >= 0 ? 'text-bull' : 'text-bear'}>{row?.changePct ?? '—'}%</span> ·
                Vol <span className='text-white'>{fmtVolume(row?.volume)}</span> ·
                RV <span className='text-white'>{row?.relativeVolume ?? '—'}x</span> ·
                News <span className='text-white'>{row?.newsCount ?? 0}</span>
              </p>
              <button
                className={`border rounded-lg px-2 py-0.5 transition-colors ${item.alert ? 'border-bull text-bull' : 'border-border text-muted'}`}
                onClick={() => setWatchlist(watchlist.map(w => w.symbol === item.symbol ? { ...w, alert: !w.alert } : w))}
              >
                {item.alert ? '🔔 Alert on' : '🔕 Alert off'}
              </button>
              <input
                value={item.note}
                placeholder='Quick note...'
                onChange={e => setWatchlist(watchlist.map(w => w.symbol === item.symbol ? { ...w, note: e.target.value } : w))}
                className='bg-card2 border border-border rounded-lg px-2 py-1 w-full focus:outline-none focus:border-info'
              />
              <div className='flex flex-wrap gap-1'>
                {TAGS.map(t => (
                  <button
                    key={t}
                    onClick={() => setWatchlist(watchlist.map(w => w.symbol === item.symbol ? { ...w, tags: w.tags.includes(t) ? w.tags.filter(x => x !== t) : [...w.tags, t] } : w))}
                    className={`px-1.5 py-0.5 rounded-md border text-[10px] transition-colors ${item.tags.includes(t) ? 'border-bull text-bull' : 'border-border text-muted hover:border-white/30'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function ScannerPage({ data, watchlist, setWatchlist, scannerFilters, setScannerFilters }) {
  const rows = data?.rows || []
  const scannerRows = useMemo(() => rows.filter(r => {
    if (r.price < scannerFilters.minPrice || r.price > scannerFilters.maxPrice) return false
    if (r.changePct < scannerFilters.minChange || r.changePct > scannerFilters.maxChange) return false
    if (r.premarketGapPct < scannerFilters.minGap) return false
    if (r.relativeVolume < scannerFilters.minRV) return false
    if (r.volume < scannerFilters.minVolume) return false
    if (scannerFilters.newsOnly && r.newsCount < 1) return false
    return true
  }), [rows, scannerFilters])

  const topGainers = [...rows].sort((a, b) => b.changePct - a.changePct).slice(0, 5)
  const topLosers  = [...rows].sort((a, b) => a.changePct - b.changePct).slice(0, 5)

  return (
    <div className='space-y-5'>
      <div className='grid lg:grid-cols-2 gap-5'>
        <Card title='Setup Scanner' right={<span className='text-xs text-muted'>{scannerRows.length} matches</span>}>
          <div className='grid grid-cols-3 gap-3 mb-4'>
            <Num label='Min Price $' value={scannerFilters.minPrice} onChange={v => setScannerFilters(s => ({ ...s, minPrice: +v }))} />
            <Num label='Max Price $' value={scannerFilters.maxPrice} onChange={v => setScannerFilters(s => ({ ...s, maxPrice: +v }))} />
            <Num label='Min Change %' value={scannerFilters.minChange} onChange={v => setScannerFilters(s => ({ ...s, minChange: +v }))} />
            <Num label='Max Change %' value={scannerFilters.maxChange} onChange={v => setScannerFilters(s => ({ ...s, maxChange: +v }))} />
            <Num label='Min Gap %' value={scannerFilters.minGap} onChange={v => setScannerFilters(s => ({ ...s, minGap: +v }))} />
            <Num label='Min Rel. Vol' value={scannerFilters.minRV} onChange={v => setScannerFilters(s => ({ ...s, minRV: +v }))} />
          </div>
          <div className='flex flex-wrap gap-2'>
            {scannerRows.length === 0
              ? <p className='text-muted text-sm'>No matches with current filters.</p>
              : scannerRows.map(r => (
                  <div key={r.symbol} className='border border-border rounded-xl px-3 py-2 text-xs'>
                    <span className='font-semibold text-white'>{r.symbol}</span>
                    <span className={`ml-1.5 ${r.changePct >= 0 ? 'text-bull' : 'text-bear'}`}>{r.changePct}%</span>
                    <span className='text-muted ml-1.5'>RV {r.relativeVolume}x</span>
                  </div>
                ))
            }
          </div>
        </Card>

        <Card title='Personal Watchlist'>
          <WatchlistPanel rows={rows} watchlist={watchlist} setWatchlist={setWatchlist} />
        </Card>
      </div>

      <Card title='Market Overview'>
        <div className='overflow-auto'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='text-left text-muted border-b border-border'>
                <th className='pb-2 pr-4'>Symbol</th>
                <th className='pb-2 pr-4'>Change %</th>
                <th className='pb-2 pr-4'>Rel. Vol</th>
                <th className='pb-2 pr-4'>Volume</th>
                <th className='pb-2 pr-4'>Gap %</th>
                <th className='pb-2 pr-4'>Mkt Cap</th>
                <th className='pb-2'>Float</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 15).map(r => (
                <tr key={r.symbol} className='border-t border-border/50'>
                  <td className='py-1.5 pr-4 font-semibold text-white'>{r.symbol}</td>
                  <td className={`py-1.5 pr-4 ${r.changePct >= 0 ? 'text-bull' : 'text-bear'}`}>{r.changePct}%</td>
                  <td className='py-1.5 pr-4 text-muted'>{r.relativeVolume}x</td>
                  <td className='py-1.5 pr-4 text-muted'>{(r.volume / 1e6).toFixed(1)}M</td>
                  <td className='py-1.5 pr-4 text-muted'>{r.premarketGapPct}%</td>
                  <td className='py-1.5 pr-4 text-muted'>{(r.marketCap / 1e9).toFixed(1)}B</td>
                  <td className='py-1.5 text-muted'>{(r.floatShares / 1e6).toFixed(0)}M</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length > 0 && (
          <div className='mt-3 flex gap-4 text-xs'>
            <p className='text-bull'>Top gainers: {topGainers.map(x => x.symbol).join(', ')}</p>
            <p className='text-bear'>Top losers: {topLosers.map(x => x.symbol).join(', ')}</p>
          </div>
        )}
      </Card>
    </div>
  )
}

export function PlannerPage({ planInput, setPlanInput }) {
  const out = calcTradePlan(planInput)
  return (
    <div className='space-y-5'>
      <Card title='Trade Planner'>
        <div className='grid md:grid-cols-3 gap-3'>
          {[
            ['Account Size $', 'accountSize'],
            ['Max Risk Per Trade %', 'maxRiskPerTradePct'],
            ['Max Daily Loss %', 'maxDailyLossPct'],
            ['Entry Price', 'entryPrice'],
            ['Stop Loss Price', 'stopLossPrice'],
            ['Target Price', 'targetPrice'],
          ].map(([label, key]) => (
            <Num key={key} label={label} value={planInput[key]} onChange={v => setPlanInput(p => ({ ...p, [key]: v }))} />
          ))}
        </div>
      </Card>

      <Card title='Position Sizing Output'>
        <div className='grid md:grid-cols-3 gap-4 text-sm'>
          {[
            ['Dollar Risk Allowed', fmtMoney(out.dollarRiskAllowed)],
            ['Position Size (Shares)', out.positionSizeShares],
            ['Estimated Cost', fmtMoney(out.estimatedCost)],
            ['Risk/Reward Ratio', `${out.riskRewardRatio}:1`],
            ['Break-even Win Rate', `${out.breakEvenWinRate}%`],
            ['Potential Profit', fmtMoney(out.potentialProfit)],
            ['Potential Loss', fmtMoney(out.potentialLoss)],
          ].map(([label, val]) => (
            <div key={label} className='border border-border rounded-xl p-3'>
              <p className='text-muted text-xs mb-1'>{label}</p>
              <p className='text-white font-semibold'>{val}</p>
            </div>
          ))}
        </div>
        {!!out.warnings?.length && (
          <div className='mt-3 space-y-1'>
            {out.warnings.map(w => <p key={w} className='text-bear text-sm'>⚠ {w}</p>)}
          </div>
        )}
        <p className='text-xs text-muted/60 mt-3'>{defaultTradingRules.ruleNote}</p>
      </Card>
    </div>
  )
}

export function AlertsPage({ alerts, setAlerts, triggered, setTriggered, marketRows }) {
  const [draft, setDraft] = useState({ symbol: 'AAPL', type: 'price_above', value: 100 })

  useEffect(() => {
    if (!marketRows?.length) return
    const id = setInterval(() => {
      const hits = runAlertPass(alerts, marketRows)
      if (!hits.length) return
      setTriggered(prev => {
        const key = x => `${x.id || ''}:${x.symbol}:${x.type}:${x.value}:${x.lastPrice}`
        const seen = new Set(prev.map(key))
        const next = hits.filter(h => !seen.has(key(h)))
        return [...next, ...prev].slice(0, 100)
      })
    }, 15000)
    return () => clearInterval(id)
  }, [alerts, marketRows, setTriggered])

  return (
    <div className='space-y-5'>
      <Card title='Create Alert'>
        <div className='flex flex-wrap gap-2'>
          <input
            value={draft.symbol}
            onChange={e => setDraft({ ...draft, symbol: e.target.value.toUpperCase() })}
            placeholder='Symbol'
            className='bg-card2 border border-border rounded-lg px-3 py-1.5 text-sm text-text w-24 focus:outline-none focus:border-info'
          />
          <select
            value={draft.type}
            onChange={e => setDraft({ ...draft, type: e.target.value })}
            className='bg-card2 border border-border rounded-lg px-3 py-1.5 text-sm text-text focus:outline-none focus:border-info'
          >
            <option value='price_above'>Price above</option>
            <option value='price_below'>Price below</option>
            <option value='pct_move'>% move ≥</option>
            <option value='volume_spike'>Volume spike ≥</option>
            <option value='rv_spike'>Rel. Volume ≥</option>
            <option value='hod_break'>HOD break</option>
            <option value='lod_break'>LOD break</option>
            <option value='vwap_reclaim'>VWAP reclaim</option>
          </select>
          <input
            type='number'
            value={draft.value}
            onChange={e => setDraft({ ...draft, value: e.target.value })}
            className='bg-card2 border border-border rounded-lg px-3 py-1.5 text-sm text-text w-24 focus:outline-none focus:border-info'
          />
          <button
            onClick={() => setAlerts([...alerts, { ...draft, id: crypto.randomUUID() }])}
            className='bg-info/10 border border-info/30 text-info rounded-lg px-3 py-1.5 text-sm hover:bg-info/20 transition-colors'
          >
            + Save Alert
          </button>
        </div>
      </Card>

      <div className='grid md:grid-cols-2 gap-5'>
        <Card title={`Active Alerts (${alerts.length})`}>
          {alerts.length === 0
            ? <p className='text-muted text-sm'>No alerts set.</p>
            : <div className='space-y-2'>
                {alerts.map(a => (
                  <div key={a.id} className='flex justify-between items-center border border-border rounded-xl px-3 py-2 text-sm'>
                    <span><span className='font-semibold text-white'>{a.symbol}</span> <span className='text-muted'>{a.type}</span> <span className='text-info'>{a.value}</span></span>
                    <button onClick={() => setAlerts(alerts.filter(x => x.id !== a.id))} className='text-muted hover:text-bear transition-colors text-xs'>Remove</button>
                  </div>
                ))}
              </div>
          }
        </Card>

        <Card title={`Triggered (${triggered.length})`}>
          {triggered.length === 0
            ? <p className='text-muted text-sm'>No alerts triggered yet. Checks every 15 seconds.</p>
            : <div className='space-y-1 max-h-64 overflow-auto'>
                {triggered.map((a, i) => (
                  <div key={i} className='text-xs border-b border-border/50 py-1'>
                    <span className='font-semibold text-bull'>{a.symbol}</span> hit <span className='text-white'>{a.type}</span> @ <span className='text-white'>{a.lastPrice}</span>
                    <span className='text-muted ml-2'>{new Date(a.triggeredAt).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
          }
        </Card>
      </div>
    </div>
  )
}

export function JournalPage({ trades, setTrades }) {
  const [draft, setDraft] = useState({ symbol: '', direction: 'long', entry: '', exit: '', shares: '', stop: '', fees: 0, setupType: '' })
  const metrics = computeJournalMetrics(trades)

  const fields = [
    { key: 'symbol', placeholder: 'Symbol' },
    { key: 'entry', placeholder: 'Entry price' },
    { key: 'exit', placeholder: 'Exit price' },
    { key: 'shares', placeholder: 'Shares' },
    { key: 'stop', placeholder: 'Stop price' },
    { key: 'fees', placeholder: 'Fees $' },
    { key: 'setupType', placeholder: 'Setup type' },
  ]

  return (
    <div className='space-y-5'>
      <Card title='Log Trade'>
        <div className='grid md:grid-cols-4 gap-3 mb-3'>
          {fields.map(f => (
            <input
              key={f.key}
              placeholder={f.placeholder}
              value={draft[f.key]}
              onChange={e => setDraft({ ...draft, [f.key]: e.target.value })}
              className='bg-card2 border border-border rounded-lg px-3 py-1.5 text-sm text-text focus:outline-none focus:border-info'
            />
          ))}
          <label className='flex items-center gap-2 text-sm text-muted'>
            <select
              value={draft.direction}
              onChange={e => setDraft({ ...draft, direction: e.target.value })}
              className='bg-card2 border border-border rounded-lg px-3 py-1.5 text-sm text-text focus:outline-none focus:border-info'
            >
              <option value='long'>Long</option>
              <option value='short'>Short</option>
            </select>
          </label>
        </div>
        <button
          className='bg-bull/10 border border-bull/30 text-bull rounded-lg px-4 py-1.5 text-sm hover:bg-bull/20 transition-colors'
          onClick={() => {
            if (!draft.symbol) return
            const calc = computeTradeValues(draft)
            setTrades([{ ...draft, ...calc, id: crypto.randomUUID(), dateTime: new Date().toISOString() }, ...trades])
            setDraft({ symbol: '', direction: 'long', entry: '', exit: '', shares: '', stop: '', fees: 0, setupType: '' })
          }}
        >
          + Add Trade
        </button>
      </Card>

      <Card title='Analytics'>
        <div className='grid grid-cols-3 md:grid-cols-6 gap-3 text-sm'>
          {[
            ['Trades', metrics.tradeCount],
            ['Win Rate', `${metrics.winRate}%`],
            ['Avg Win', fmtMoney(metrics.averageWin)],
            ['Avg Loss', fmtMoney(metrics.averageLoss)],
            ['Profit Factor', metrics.profitFactor],
            ['Max Drawdown', fmtMoney(metrics.maxDrawdown)],
          ].map(([label, val]) => (
            <div key={label} className='border border-border rounded-xl p-3'>
              <p className='text-muted text-xs mb-1'>{label}</p>
              <p className='text-white font-semibold'>{val}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card title={`Trade Log (${trades.length})`}>
        {trades.length === 0
          ? <p className='text-muted text-sm'>No trades logged yet.</p>
          : (
            <div className='overflow-auto'>
              <table className='w-full text-sm'>
                <thead>
                  <tr className='text-left text-muted border-b border-border'>
                    <th className='pb-2 pr-4'>Symbol</th>
                    <th className='pb-2 pr-4'>Dir</th>
                    <th className='pb-2 pr-4'>Entry</th>
                    <th className='pb-2 pr-4'>Exit</th>
                    <th className='pb-2 pr-4'>Net P&L</th>
                    <th className='pb-2 pr-4'>R</th>
                    <th className='pb-2'>Setup</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map(t => (
                    <tr key={t.id} className='border-t border-border/50'>
                      <td className='py-1.5 pr-4 font-semibold text-white'>{t.symbol}</td>
                      <td className='py-1.5 pr-4 text-muted capitalize'>{t.direction}</td>
                      <td className='py-1.5 pr-4 text-muted'>{t.entry}</td>
                      <td className='py-1.5 pr-4 text-muted'>{t.exit}</td>
                      <td className={`py-1.5 pr-4 ${t.netPnL >= 0 ? 'text-bull' : 'text-bear'}`}>{fmtMoney(t.netPnL)}</td>
                      <td className={`py-1.5 pr-4 ${t.rMultiple >= 0 ? 'text-bull' : 'text-bear'}`}>{t.rMultiple}R</td>
                      <td className='py-1.5 text-muted text-xs'>{t.setupType || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </Card>
    </div>
  )
}

export function SettingsPage({ riskSettings, setRiskSettings }) {
  return (
    <div className='space-y-5'>
      <Card title='Risk & Rules'>
        <div className='space-y-4 max-w-sm'>
          <label className='block'>
            <span className='text-sm text-muted block mb-1'>Max trades per day</span>
            <input
              type='number'
              className='bg-card2 border border-border rounded-lg px-3 py-2 text-sm text-text w-full focus:outline-none focus:border-info'
              value={riskSettings.maxTradesPerDay}
              onChange={e => setRiskSettings(s => ({ ...s, maxTradesPerDay: +e.target.value }))}
            />
          </label>
          <label className='block'>
            <span className='text-sm text-muted block mb-1'>Cooldown after N consecutive losses</span>
            <input
              type='number'
              className='bg-card2 border border-border rounded-lg px-3 py-2 text-sm text-text w-full focus:outline-none focus:border-info'
              value={riskSettings.cooldownAfterLosses}
              onChange={e => setRiskSettings(s => ({ ...s, cooldownAfterLosses: +e.target.value }))}
            />
          </label>
          <label className='flex items-center gap-3 text-sm'>
            <input
              type='checkbox'
              className='w-4 h-4 accent-info'
              checked={riskSettings.lockout}
              onChange={e => setRiskSettings(s => ({ ...s, lockout: e.target.checked }))}
            />
            <span className='text-text'>Do not trade lockout (manual override)</span>
          </label>
          <label className='flex items-center gap-3 text-sm'>
            <input
              type='checkbox'
              className='w-4 h-4 accent-info'
              checked={riskSettings.marginWarning}
              onChange={e => setRiskSettings(s => ({ ...s, marginWarning: e.target.checked }))}
            />
            <span className='text-text'>Show margin / leverage warning</span>
          </label>
        </div>
      </Card>
    </div>
  )
}

export function usePersistedState(key, initial) {
  const [state, setState] = useState(() => loadJSON(key, initial))
  useEffect(() => saveJSON(key, state), [key, state])
  return [state, setState]
}
