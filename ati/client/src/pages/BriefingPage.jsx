import { useState, useEffect } from 'react'

const card = { background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, padding:'16px 18px', marginBottom:16 }

export default function BriefingPage() {
  const [config, setConfig]           = useState(null)
  const [email, setEmail]             = useState('')
  const [subMsg, setSubMsg]           = useState(null)
  const [subLoading, setSubLoading]   = useState(false)
  const [sending, setSending]         = useState(false)
  const [sendMsg, setSendMsg]         = useState(null)
  const [preview, setPreview]         = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [sendTime, setSendTime]       = useState('07:00')
  const [adminEmail, setAdminEmail]   = useState('')
  const [adminMsg, setAdminMsg]       = useState(null)
  const [adminSaving, setAdminSaving] = useState(false)
  const [podcast, setPodcast]         = useState(null)
  const [podcastLoading, setPodcastLoading] = useState(false)
  const [worldNews, setWorldNews]     = useState([])
  const [newsLoading, setNewsLoading] = useState(false)
  const [newsError, setNewsError]     = useState(null)

  const TIME_OPTIONS = ['05:00','05:30','06:00','06:30','07:00','07:15','07:30','07:45','08:00','08:15','08:30','08:45','09:00','09:15','09:30']

  useEffect(() => {
    fetch('/api/briefing/config').then(r => r.ok ? r.json() : null).then(d => {
      if (d) { setConfig(d); setSendTime(d.sendTimeET || '07:00'); setAdminEmail(d.adminEmail || '') }
    }).catch(() => {})
    loadPodcast(false)
    loadWorldNews()
  }, [])

  async function loadPodcast(regen) {
    setPodcastLoading(true)
    try {
      const r = await fetch(`/api/briefing/podcast${regen ? '?regen=1' : ''}`)
      const d = await r.json()
      setPodcast(d)
    } catch { setPodcast(null) }
    finally { setPodcastLoading(false) }
  }

  async function loadWorldNews() {
    setNewsLoading(true); setNewsError(null)
    try {
      const r = await fetch('/api/briefing/world-news?limit=20')
      const d = await r.json()
      if (d.items && d.items.length) setWorldNews(d.items)
      else setNewsError('No headlines available right now — try again shortly.')
    } catch { setNewsError('Could not load world news.') }
    finally { setNewsLoading(false) }
  }

  async function subscribe() {
    if (!email.trim()) return
    setSubLoading(true); setSubMsg(null)
    try {
      const r = await fetch('/api/briefing/subscribe', {
        method:'POST', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const d = await r.json()
      setSubMsg({ ok: r.ok, text: d.message || (r.ok ? 'Subscribed!' : 'Failed') })
      if (r.ok) setEmail('')
    } catch { setSubMsg({ ok:false, text:'Network error' }) }
    finally { setSubLoading(false) }
  }

  async function saveAdminEmail() {
    setAdminSaving(true); setAdminMsg(null)
    try {
      const r = await fetch('/api/briefing/config', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminEmail }),
      })
      const d = await r.json()
      setAdminMsg({ ok: r.ok, text: r.ok ? 'Admin email saved.' : (d.error || 'Failed') })
      if (r.ok) setConfig(prev => prev ? { ...prev, adminEmail } : prev)
    } catch { setAdminMsg({ ok: false, text: 'Network error' }) }
    finally { setAdminSaving(false) }
  }

  async function sendNow() {
    setSending(true); setSendMsg(null)
    try {
      const r = await fetch('/api/briefing/send-now', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:'{}' })
      const d = await r.json()
      setSendMsg({ ok: r.ok, text: d.message || (r.ok ? 'Briefing sent!' : 'Send failed') })
      if (r.ok) loadPodcast(false)
    } catch { setSendMsg({ ok:false, text:'Network error' }) }
    finally { setSending(false) }
  }

  async function loadPreview() {
    setPreviewLoading(true); setPreview(null)
    try {
      const r = await fetch('/api/briefing/preview')
      if (!r.ok) throw new Error('Preview failed')
      const html = await r.text()
      setPreview(html)
    } catch (e) { setPreview('<p style="color:red">Preview unavailable: ' + e.message + '</p>') }
    finally { setPreviewLoading(false) }
  }

  function timeAgo(iso) {
    if (!iso) return ''
    const diff = (Date.now() - new Date(iso)) / 60000
    if (diff < 60)  return `${Math.round(diff)}m ago`
    if (diff < 1440) return `${Math.round(diff / 60)}h ago`
    return `${Math.round(diff / 1440)}d ago`
  }

  const btn = (primary, disabled) => ({
    padding:'7px 16px', borderRadius:8, border:'1px solid', cursor: disabled ? 'not-allowed' : 'pointer', fontSize:13, fontWeight:600,
    background: primary ? 'rgba(99,102,241,0.15)' : 'transparent',
    color:       primary ? '#818cf8' : 'var(--muted)',
    borderColor: primary ? '#818cf840' : 'var(--border)',
    opacity:     disabled ? 0.5 : 1,
  })

  const smallBtn = (disabled) => ({
    padding:'4px 10px', borderRadius:6, border:'1px solid var(--border)', cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize:11, fontWeight:600, background:'transparent', color:'var(--muted)', opacity: disabled ? 0.5 : 1,
  })

  return (
    <div>
      <h2 style={{ fontSize:20, fontWeight:700, marginBottom:4 }}>Morning Briefing</h2>
      <p style={{ fontSize:13, color:'var(--muted)', marginBottom:20 }}>Daily pre-market intelligence — AI podcast, top ATI scores, and live world headlines sent to subscribers.</p>

      {/* Podcast Panel */}
      <div style={card}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <h3 style={{ fontWeight:700, margin:0 }}>🎙 Today's Market Podcast</h3>
          <button onClick={() => loadPodcast(true)} disabled={podcastLoading}
            style={smallBtn(podcastLoading)}>
            {podcastLoading ? 'Generating…' : '↺ Regenerate'}
          </button>
        </div>
        {podcastLoading ? (
          <p style={{ fontSize:13, color:'var(--muted)' }}>Generating podcast script…</p>
        ) : podcast?.script ? (
          <>
            <p style={{ fontSize:13, color:'var(--text)', lineHeight:1.75, margin:0, fontStyle:'italic', whiteSpace:'pre-line' }}>
              {podcast.script}
            </p>
            <div style={{ marginTop:10, fontSize:11, color:'var(--muted)' }}>
              {podcast.ai_available ? '✦ AI-generated' : '○ Fallback (Gemini quota exceeded)'} · {podcast.date} · {podcast.generated_at?.slice(11, 16)} UTC
            </div>
          </>
        ) : (
          <p style={{ fontSize:13, color:'var(--muted)' }}>No podcast yet for today. Click Regenerate.</p>
        )}
      </div>

      {/* Live World News */}
      <div style={card}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <div>
            <h3 style={{ fontWeight:700, margin:'0 0 2px' }}>🌍 Live World & Market News</h3>
            <p style={{ fontSize:12, color:'var(--muted)', margin:0 }}>Top headlines from Reuters, BBC, CNBC, AP, Yahoo Finance and more</p>
          </div>
          <button onClick={loadWorldNews} disabled={newsLoading} style={smallBtn(newsLoading)}>
            {newsLoading ? 'Loading…' : '↺ Refresh'}
          </button>
        </div>

        {newsLoading ? (
          <p style={{ fontSize:13, color:'var(--muted)' }}>Fetching headlines…</p>
        ) : newsError ? (
          <p style={{ fontSize:13, color:'var(--red)' }}>{newsError}</p>
        ) : worldNews.length === 0 ? (
          <p style={{ fontSize:13, color:'var(--muted)' }}>No headlines loaded yet.</p>
        ) : (
          <ol style={{ margin:0, padding:'0 0 0 20px' }}>
            {worldNews.map((n, i) => (
              <li key={i} style={{ marginBottom:10, paddingBottom:10, borderBottom: i < worldNews.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <a href={n.url} target="_blank" rel="noopener noreferrer"
                  style={{ color:'var(--text)', textDecoration:'none', fontSize:13, lineHeight:1.5, fontWeight:500,
                    display:'block', ':hover':{ color:'var(--accent)' } }}>
                  {n.title}
                </a>
                <span style={{ fontSize:11, color:'var(--muted)', display:'block', marginTop:3 }}>
                  {n.source} · {timeAgo(n.published_at)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* Subscribe */}
      <div style={card}>
        <h3 style={{ fontWeight:700, marginBottom:10 }}>Subscribe to Daily Briefing</h3>
        <p style={{ fontSize:13, color:'var(--muted)', marginBottom:12 }}>Receive the pre-market email daily: podcast script, top ATI scores, and 20 live world news headlines.</p>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" type="email"
            onKeyDown={e => e.key==='Enter' && subscribe()}
            style={{ flex:1, minWidth:200, background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--text)', padding:'7px 12px', borderRadius:8, fontSize:13, outline:'none' }} />
          <button onClick={subscribe} disabled={subLoading || !email.trim()} style={btn(true, subLoading || !email.trim())}>
            {subLoading ? 'Subscribing…' : 'Subscribe'}
          </button>
        </div>
        {subMsg && <p style={{ marginTop:10, fontSize:13, color: subMsg.ok ? 'var(--green)' : 'var(--red)' }}>{subMsg.text}</p>}
      </div>

      {/* Config + Send */}
      <div style={card}>
        <h3 style={{ fontWeight:700, marginBottom:12 }}>Send & Configuration</h3>

        {/* Admin Email */}
        <div style={{ marginBottom:16 }}>
          <p style={{ fontSize:13, color:'var(--muted)', marginBottom:8 }}>
            Admin email — always receives every briefing, regardless of the subscriber list.
          </p>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <input value={adminEmail} onChange={e => setAdminEmail(e.target.value)}
              placeholder="admin@yourdomain.com" type="email"
              onKeyDown={e => e.key === 'Enter' && saveAdminEmail()}
              style={{ flex:1, minWidth:200, background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--text)', padding:'7px 12px', borderRadius:8, fontSize:13, outline:'none' }} />
            <button onClick={saveAdminEmail} disabled={adminSaving} style={btn(true, adminSaving)}>
              {adminSaving ? 'Saving…' : 'Save Admin Email'}
            </button>
          </div>
          {adminMsg && <p style={{ marginTop:8, fontSize:13, color: adminMsg.ok ? 'var(--green)' : 'var(--red)' }}>{adminMsg.text}</p>}
        </div>

        <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap', marginBottom:14, paddingTop:12, borderTop:'1px solid var(--border)' }}>
          <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'var(--muted)' }}>
            Auto-send time (ET):
            <select value={sendTime} onChange={e => setSendTime(e.target.value)}
              style={{ background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--text)', padding:'5px 8px', borderRadius:8, fontSize:13 }}>
              {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          {config && (
            <span style={{ fontSize:12, color:'var(--muted)' }}>
              {config.subscriberCount} subscriber{config.subscriberCount !== 1 ? 's' : ''}
              {config.lastSent && ` · Last sent ${new Date(config.lastSent).toLocaleDateString()}`}
            </span>
          )}
        </div>

        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button onClick={sendNow} disabled={sending} style={btn(true, sending)}>
            {sending ? 'Sending…' : '✉ Send Now'}
          </button>
          <button onClick={loadPreview} disabled={previewLoading} style={btn(false, previewLoading)}>
            {previewLoading ? 'Loading…' : '👁 Preview Email'}
          </button>
        </div>

        {sendMsg && <p style={{ marginTop:10, fontSize:13, color: sendMsg.ok ? 'var(--green)' : 'var(--red)' }}>{sendMsg.text}</p>}
      </div>

      {/* Email Preview */}
      {preview && (
        <div style={card}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <h3 style={{ fontWeight:700, margin:0 }}>Email Preview</h3>
            <button onClick={() => setPreview(null)} style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:18 }}>✕</button>
          </div>
          <div style={{ border:'1px solid var(--border)', borderRadius:10, overflow:'hidden', maxHeight:600, overflowY:'auto' }}
            dangerouslySetInnerHTML={{ __html: preview }} />
        </div>
      )}

      {/* What's included */}
      <div style={card}>
        <h3 style={{ fontWeight:700, marginBottom:12 }}>What's in Each Briefing</h3>
        <div className="mobile-grid-1" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
          {[
            ['🎙 Market Podcast', 'AI-generated 3-paragraph market briefing regenerated every morning at 7 AM ET. Falls back gracefully when AI quota is exceeded.'],
            ['📊 ATI Scores', 'Top 15 highest-scored stocks with signal label and probability of outperformance, sourced from the live ATI scoring engine.'],
            ['🌍 World News', 'Top 20 live headlines scraped from Reuters, BBC, CNBC, AP News, Yahoo Finance, MarketWatch and more — each with a direct web link.'],
          ].map(([title, desc]) => (
            <div key={title} style={{ border:'1px solid var(--border)', borderRadius:10, padding:'12px 14px' }}>
              <p style={{ fontWeight:700, marginBottom:6, margin:'0 0 6px' }}>{title}</p>
              <p style={{ fontSize:12, color:'var(--muted)', lineHeight:1.5, margin:0 }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
