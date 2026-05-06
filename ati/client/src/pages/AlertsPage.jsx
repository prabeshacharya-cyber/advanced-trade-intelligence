import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const SEVERITY_COLOR = { high:'var(--red)', medium:'var(--yellow)', low:'var(--muted)' }
const SEVERITY_BG    = { high:'#ef444415', medium:'#fbbf2415', low:'#1f2937' }

export default function AlertsPage() {
  const navigate = useNavigate()
  const [alerts, setAlerts] = useState([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    fetch('/api/alerts?limit=100')
      .then(r => r.json())
      .then(d => { setAlerts(d.alerts || []); setUnread(d.unread || 0); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function markRead(id) {
    await fetch(`/api/alerts/${id}/read`, { method:'PATCH' })
    setAlerts(a => a.map(x => x.id === id ? { ...x, is_read:1 } : x))
    setUnread(u => Math.max(0, u - 1))
  }

  const filtered = alerts.filter(a =>
    filter === 'all' || (filter === 'unread' && !a.is_read) || a.severity === filter
  )

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700 }}>Alerts</h1>
          <p style={{ color:'var(--muted)', fontSize:13, marginTop:3 }}>Score changes, rating upgrades/downgrades, data quality warnings</p>
        </div>
        {unread > 0 && (
          <span style={{ background:'var(--red)', color:'#fff', borderRadius:20, padding:'3px 10px', fontSize:12, fontWeight:700 }}>
            {unread} unread
          </span>
        )}
      </div>

      {/* Filter */}
      <div style={{ display:'flex', gap:6, marginBottom:16 }}>
        {['all','unread','high','medium','low'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding:'5px 12px', borderRadius:20, fontSize:12, cursor:'pointer',
            background: filter === f ? 'var(--accent)' : 'var(--bg3)',
            color: filter === f ? '#fff' : 'var(--muted)',
            border:`1px solid ${filter === f ? 'var(--accent)' : 'var(--border)'}`,
            textTransform:'capitalize',
          }}>{f}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:60, color:'var(--muted)' }}>Loading alerts…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:60, color:'var(--muted)', fontSize:14 }}>
          No alerts yet. Run a score refresh to generate alerts.
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {filtered.map(a => (
            <div key={a.id} onClick={() => { if (!a.is_read) markRead(a.id) }}
              style={{ padding:16, background: a.is_read ? 'var(--bg2)' : SEVERITY_BG[a.severity], border:`1px solid ${a.is_read ? 'var(--border)' : SEVERITY_COLOR[a.severity] + '40'}`, borderRadius:8, cursor:'pointer', opacity: a.is_read ? 0.7 : 1, transition:'opacity 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.opacity = '1'}
              onMouseLeave={e => e.currentTarget.style.opacity = a.is_read ? '0.7' : '1'}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                    <span style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', color:SEVERITY_COLOR[a.severity], background:SEVERITY_COLOR[a.severity]+'22', padding:'1px 6px', borderRadius:10 }}>{a.severity}</span>
                    {!a.is_read && <span style={{ fontSize:10, color:'var(--accent)', background:'var(--accent)22', padding:'1px 6px', borderRadius:10, fontWeight:600 }}>NEW</span>}
                    {a.symbol && (
                      <span onClick={e => { e.stopPropagation(); navigate(`/asset/${a.symbol}`) }}
                        style={{ fontSize:11, color:'var(--accent)', fontWeight:700, cursor:'pointer', textDecoration:'underline' }}>
                        {a.symbol}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize:14, fontWeight:600, marginBottom:4 }}>{a.title}</div>
                  <div style={{ fontSize:13, color:'var(--muted)', lineHeight:1.4 }}>{a.message}</div>
                </div>
                <div style={{ fontSize:11, color:'var(--muted)', whiteSpace:'nowrap', flexShrink:0 }}>
                  {a.created_at ? new Date(a.created_at).toLocaleDateString() : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
