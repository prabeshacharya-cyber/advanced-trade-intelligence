import { useState } from 'react'
import { loadJSON, saveJSON } from '../lib/storage'

const card = { background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, padding:'16px 18px', marginBottom:16 }
const inp  = { background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--text)', padding:'7px 10px', borderRadius:8, fontSize:13, outline:'none', width:'100%' }

export default function SettingsPage() {
  const [settings, setSettings] = useState(() => loadJSON('ati_risk_settings', {
    maxTradesPerDay: 6,
    cooldownAfterLosses: 3,
    lockout: false,
    marginWarning: true,
  }))
  const [saved, setSaved] = useState(false)

  function save() {
    saveJSON('ati_risk_settings', settings)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      <h2 style={{ fontSize:20, fontWeight:700, marginBottom:4 }}>Settings</h2>
      <p style={{ fontSize:13, color:'var(--muted)', marginBottom:20 }}>Configure your risk rules and trading discipline guardrails.</p>

      <div style={card}>
        <h3 style={{ fontWeight:700, marginBottom:16 }}>Risk & Rules</h3>
        <div style={{ maxWidth:400, display:'flex', flexDirection:'column', gap:14 }}>
          <label style={{ display:'block' }}>
            <span style={{ fontSize:13, color:'var(--muted)', display:'block', marginBottom:6 }}>Max trades per day</span>
            <input type="number" value={settings.maxTradesPerDay} onChange={e => setSettings(s => ({ ...s, maxTradesPerDay:+e.target.value }))}
              style={inp} />
          </label>
          <label style={{ display:'block' }}>
            <span style={{ fontSize:13, color:'var(--muted)', display:'block', marginBottom:6 }}>Cooldown after N consecutive losses</span>
            <input type="number" value={settings.cooldownAfterLosses} onChange={e => setSettings(s => ({ ...s, cooldownAfterLosses:+e.target.value }))}
              style={inp} />
          </label>
          <label style={{ display:'flex', alignItems:'center', gap:12, fontSize:13, cursor:'pointer' }}>
            <input type="checkbox" checked={settings.lockout} onChange={e => setSettings(s => ({ ...s, lockout:e.target.checked }))}
              style={{ width:16, height:16 }} />
            <span style={{ color:'var(--text)' }}>Do not trade lockout (manual override)</span>
          </label>
          <label style={{ display:'flex', alignItems:'center', gap:12, fontSize:13, cursor:'pointer' }}>
            <input type="checkbox" checked={settings.marginWarning} onChange={e => setSettings(s => ({ ...s, marginWarning:e.target.checked }))}
              style={{ width:16, height:16 }} />
            <span style={{ color:'var(--text)' }}>Show margin / leverage warning</span>
          </label>
          <button onClick={save} style={{ padding:'8px 20px', borderRadius:8, background:'rgba(99,102,241,0.15)', border:'1px solid rgba(129,140,248,0.4)', color:'#818cf8', fontWeight:700, cursor:'pointer', fontSize:13, alignSelf:'flex-start' }}>
            {saved ? '✓ Saved' : 'Save Settings'}
          </button>
        </div>
      </div>

      <div style={card}>
        <h3 style={{ fontWeight:700, marginBottom:12 }}>API Status</h3>
        <p style={{ fontSize:13, color:'var(--muted)', marginBottom:12 }}>ATI uses free-first data architecture. All keys are configured server-side.</p>
        {[
          { name:'SEC EDGAR', key:'Free, unlimited (rate-limited)', status:'active' },
          { name:'Alpha Vantage', key:'ALPHA_VANTAGE_API_KEY', status:'active' },
          { name:'Finnhub', key:'FINNHUB_API_KEY', status:'active' },
          { name:'FMP', key:'FMP_API_KEY', status:'active' },
          { name:'FRED (Macro)', key:'FRED_API_KEY', status:'active' },
          { name:'Gemini AI', key:'GEMINI_API_KEY', status:'quota' },
        ].map(api => (
          <div key={api.name} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
            <span style={{ fontSize:13, fontWeight:600 }}>{api.name}</span>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:12, color:'var(--muted)' }}>{api.key}</span>
              <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:20, background: api.status==='active' ? 'rgba(34,197,94,0.12)' : 'rgba(251,191,36,0.12)', color: api.status==='active' ? 'var(--green)' : 'var(--yellow)' }}>
                {api.status==='active' ? 'Active' : 'Quota'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
