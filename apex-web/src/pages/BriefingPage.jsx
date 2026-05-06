import { useState, useEffect, useCallback, useRef } from 'react'
import { Mail, Clock, Send, RefreshCw, CheckCircle, XCircle, Eye, ToggleLeft, ToggleRight, Users, Trash2, Plus, Bell, BellOff, Mic, Play, Pause, Radio } from 'lucide-react'

function authHeaders() {
  const token = localStorage.getItem('apex_token') || ''
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
}

function Card({ className = '', children }) {
  return (
    <div className={`bg-surface border border-border/50 rounded-2xl overflow-hidden ${className}`}>
      {children}
    </div>
  )
}

function SectionHeader({ icon: Icon, title, badge, badgeColor = 'text-accent bg-accent/10' }) {
  return (
    <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
      <div className="flex items-center gap-2">
        <Icon size={15} className="text-muted" />
        <span className="font-semibold text-sm">{title}</span>
      </div>
      {badge && (
        <span className={`text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full ${badgeColor}`}>
          {badge}
        </span>
      )}
    </div>
  )
}

const TIME_OPTIONS = [
  '05:00','05:30','06:00','06:30','07:00','07:15','07:30','07:45',
  '08:00','08:15','08:30','08:45','09:00','09:15','09:30',
]

export default function MorningBriefingPage({ user }) {
  const isAdmin = user?.role === 'admin'

  const [config, setConfig]           = useState(null)
  const [form, setForm]               = useState({ sendTimeET: '07:00', enabled: true })
  const [subscribers, setSubscribers] = useState([])
  const [subscribed, setSubscribed]   = useState(false)
  const [subLoading, setSubLoading]   = useState(false)
  const [subMsg, setSubMsg]           = useState(null)

  // admin-only state
  const [newEmail, setNewEmail]   = useState('')
  const [newName, setNewName]     = useState('')
  const [addMsg, setAddMsg]       = useState(null)
  const [addLoading, setAddLoading] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [saveMsg, setSaveMsg]     = useState(null)
  const [sending, setSending]     = useState(false)
  const [sendMsg, setSendMsg]     = useState(null)
  const [previewKey, setPreviewKey] = useState(0)
  const [showPreview, setShowPreview] = useState(false)

  const [podcasts, setPodcasts]           = useState([])
  const [podGenLoading, setPodGenLoading] = useState(false)
  const [podGenStep, setPodGenStep]       = useState('')
  const [podGenMsg, setPodGenMsg]         = useState(null)
  const [playingUrl, setPlayingUrl]       = useState(null)
  const audioRef   = useRef(null)
  const pollRef    = useRef(null)

  const loadAll = useCallback(async () => {
    const [cfgRes, subsRes, podRes] = await Promise.all([
      fetch('/api/briefing/config',      { headers: authHeaders() }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/briefing/subscribers', { headers: authHeaders() }).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch('/api/podcasts').then(r => r.ok ? r.json() : []).catch(() => []),
    ])
    if (cfgRes) {
      setConfig(cfgRes)
      setForm({ sendTimeET: cfgRes.sendTimeET, enabled: cfgRes.enabled })
    }
    const list = Array.isArray(subsRes) ? subsRes : []
    setSubscribers(list)
    if (user?.email) {
      setSubscribed(list.some(s => s.email.toLowerCase() === user.email.toLowerCase()))
    }
    setPodcasts(Array.isArray(podRes) ? podRes : [])
  }, [user])

  const startPolling = useCallback((jobId) => {
    if (pollRef.current) clearInterval(pollRef.current)
    localStorage.setItem('apex_podcast_job', jobId)
    pollRef.current = setInterval(async () => {
      try {
        const sr = await fetch(`/api/podcasts/status/${jobId}`, { headers: authHeaders() })
        const status = await sr.json()

        // Job lost (server restarted) — check if files already landed on disk
        if (status.error === 'Job not found' || sr.status === 404) {
          const lib = await fetch('/api/podcasts').then(r => r.json()).catch(() => [])
          const today = new Date().toISOString().slice(0, 10)
          const hasToday = lib.some(p => p.file.includes(today))
          clearInterval(pollRef.current)
          localStorage.removeItem('apex_podcast_job')
          setPodGenLoading(false)
          if (hasToday) {
            setPodGenMsg({ ok: true, text: '✓ Podcasts ready!' })
            setPodcasts(lib)
          } else {
            setPodGenMsg({ ok: false, text: 'Server restarted mid-generation. Please try again.' })
          }
          return
        }

        setPodGenStep(status.step || '')
        if (status.status === 'done') {
          clearInterval(pollRef.current)
          localStorage.removeItem('apex_podcast_job')
          setPodGenLoading(false)
          setPodGenMsg({ ok: true, text: '✓ Both podcasts ready!' })
          const updated = await fetch('/api/podcasts').then(r => r.json()).catch(() => [])
          setPodcasts(Array.isArray(updated) ? updated : [])
        } else if (status.status === 'error') {
          clearInterval(pollRef.current)
          localStorage.removeItem('apex_podcast_job')
          setPodGenLoading(false)
          setPodGenMsg({ ok: false, text: status.error || 'Generation failed.' })
        }
      } catch { /* network blip — keep polling */ }
    }, 6000)
  }, [])

  // On mount: resume polling if a job was in progress when the page was left
  useEffect(() => {
    const savedJob = localStorage.getItem('apex_podcast_job')
    if (savedJob) {
      setPodGenLoading(true)
      setPodGenStep('Resuming…')
      startPolling(savedJob)
    }
  }, [startPolling])

  async function generatePodcastsNow() {
    if (pollRef.current) clearInterval(pollRef.current)
    setPodGenLoading(true)
    setPodGenMsg(null)
    setPodGenStep('Starting…')
    try {
      const res = await fetch('/api/podcasts/generate', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ type: 'both' }) })
      const d = await res.json()
      if (!res.ok) { setPodGenMsg({ ok: false, text: d.error || 'Failed to start.' }); setPodGenLoading(false); return }
      startPolling(d.jobId)
    } catch {
      setPodGenMsg({ ok: false, text: 'Network error.' })
      setPodGenLoading(false)
    }
  }

  function togglePlay(url) {
    if (playingUrl === url) {
      audioRef.current?.pause()
      setPlayingUrl(null)
    } else {
      if (audioRef.current) {
        audioRef.current.src = url
        audioRef.current.play().catch(() => {})
      }
      setPlayingUrl(url)
    }
  }

  useEffect(() => { loadAll() }, [loadAll])

  // ── Self-subscribe toggle (regular users) ────────────────────────────────
  async function toggleSubscribe() {
    setSubLoading(true)
    setSubMsg(null)
    try {
      const method = subscribed ? 'DELETE' : 'POST'
      const res = await fetch('/api/briefing/subscribe-me', { method, headers: authHeaders() })
      const d = await res.json()
      if (res.ok && d.success) {
        setSubscribed(d.subscribed)
        setSubMsg({ ok: true, text: d.subscribed ? 'You\'re subscribed! Briefings will arrive at 7 AM ET.' : 'Unsubscribed. You won\'t receive future briefings.' })
      } else {
        setSubMsg({ ok: false, text: d.error || 'Something went wrong.' })
      }
    } catch {
      setSubMsg({ ok: false, text: 'Network error.' })
    }
    setSubLoading(false)
  }

  // ── Admin: add subscriber ─────────────────────────────────────────────────
  async function addSubscriber(e) {
    e.preventDefault()
    setAddLoading(true)
    setAddMsg(null)
    try {
      const res = await fetch('/api/briefing/subscribers', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ email: newEmail.trim(), name: newName.trim() }),
      })
      const d = await res.json()
      if (res.ok && d.success) {
        setSubscribers(d.subscribers)
        setNewEmail('')
        setNewName('')
        setAddMsg({ ok: true, text: `${newEmail} added.` })
      } else {
        setAddMsg({ ok: false, text: d.error || 'Failed to add.' })
      }
    } catch {
      setAddMsg({ ok: false, text: 'Network error.' })
    }
    setAddLoading(false)
  }

  // ── Admin: remove subscriber ──────────────────────────────────────────────
  async function removeSubscriber(email) {
    const prev = [...subscribers]
    setSubscribers(s => s.filter(x => x.email !== email))
    try {
      const res = await fetch(`/api/briefing/subscribers/${encodeURIComponent(email)}`, {
        method: 'DELETE',
        headers: authHeaders(),
      })
      if (!res.ok) setSubscribers(prev)
    } catch {
      setSubscribers(prev)
    }
  }

  async function saveConfig(e) {
    e.preventDefault()
    setSaving(true)
    setSaveMsg(null)
    try {
      const res = await fetch('/api/briefing/config', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(form),
      })
      const d = await res.json()
      if (d.success) {
        setConfig(d.config)
        setSaveMsg({ ok: true, text: 'Settings saved — schedule updated.' })
      } else {
        setSaveMsg({ ok: false, text: d.error || 'Save failed.' })
      }
    } catch {
      setSaveMsg({ ok: false, text: 'Network error.' })
    }
    setSaving(false)
  }

  async function sendNow() {
    setSending(true)
    setSendMsg(null)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 90_000)
    try {
      const res = await fetch('/api/briefing/send-now', {
        method: 'POST',
        headers: authHeaders(),
        signal: controller.signal,
      })
      clearTimeout(timer)
      const d = await res.json()
      if (res.ok && d.success) {
        setSendMsg({ ok: true, text: `Briefing sent to ${d.sent}/${d.total} subscriber${d.total !== 1 ? 's' : ''}!` })
        loadAll()
      } else {
        setSendMsg({ ok: false, text: d.error || 'Send failed.' })
      }
    } catch (e) {
      clearTimeout(timer)
      const msg = e.name === 'AbortError' ? 'Request timed out — check your inbox, the email may still have been sent.' : (e.message || 'Network error.')
      setSendMsg({ ok: false, text: msg })
    }
    setSending(false)
  }

  const etNow  = new Date().toLocaleTimeString('en-US',  { hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' })
  const etDate = new Date().toLocaleDateString('en-US',  { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/New_York' })

  return (
    <div className="max-w-2xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Morning Briefing</h1>
          <p className="text-muted text-sm mt-1">
            Gemini Pro synthesizes live market data and delivers a daily AI briefing every morning at {form.sendTimeET} ET.
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs text-muted">ET Now</div>
          <div className="text-sm font-semibold">{etNow}</div>
          <div className="text-xs text-muted">{etDate}</div>
        </div>
      </div>

      {/* ── USER VIEW: subscribe toggle ── */}
      {!isAdmin && (
        <Card>
          <SectionHeader
            icon={Mail}
            title="Daily Briefing Subscription"
            badge={subscribed ? 'Subscribed' : 'Not subscribed'}
            badgeColor={subscribed ? 'text-bull bg-bull/10' : 'text-muted bg-muted/10'}
          />
          <div className="px-5 py-5 space-y-4">
            <div className="bg-bg border border-border/30 rounded-xl p-4 space-y-2">
              <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Every Briefing Includes</div>
              {[
                ['📊', 'Live index snapshot — SPY, QQQ, DIA, IWM with % change'],
                ['📡', 'VIX reading + Fear & Greed index gauge'],
                ['📈', 'Top sector rotation leaders & laggards'],
                ['🤖', 'AI market tone, key themes & actionable trade setup (Gemini Pro)'],
                ['🏆', 'Top 5 AI Scorer picks with signals and suggested levels'],
              ].map(([emoji, text]) => (
                <div key={text} className="flex items-start gap-2.5 text-sm">
                  <span>{emoji}</span>
                  <span className="text-muted leading-snug">{text}</span>
                </div>
              ))}
            </div>

            <p className="text-sm text-muted">
              {subscribed
                ? `You're subscribed. Briefings are sent to ${user?.email} every morning at 7 AM ET.`
                : `Subscribe to receive the daily briefing at ${user?.email} every morning at 7 AM ET.`}
            </p>

            {subMsg && (
              <div className={`flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl ${subMsg.ok ? 'bg-bull/10 text-bull' : 'bg-bear/10 text-bear'}`}>
                {subMsg.ok ? <CheckCircle size={14} /> : <XCircle size={14} />}
                {subMsg.text}
              </div>
            )}

            <button
              onClick={toggleSubscribe}
              disabled={subLoading}
              className={`w-full font-semibold py-3 rounded-xl text-sm transition-all disabled:opacity-40 flex items-center justify-center gap-2 ${
                subscribed
                  ? 'bg-bear/10 hover:bg-bear/20 text-bear border border-bear/20'
                  : 'bg-accent hover:bg-accent/90 text-white'
              }`}
            >
              {subLoading ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : subscribed ? (
                <><BellOff size={14} /> Unsubscribe from Daily Briefing</>
              ) : (
                <><Bell size={14} /> Subscribe to Daily Briefing</>
              )}
            </button>
          </div>
        </Card>
      )}

      {/* ── ADMIN VIEW ── */}
      {isAdmin && (
        <>
          {/* Status card */}
          {config && (
            <Card>
              <SectionHeader
                icon={Clock}
                title="Schedule Status"
                badge={config.enabled ? 'Active' : 'Paused'}
                badgeColor={config.enabled ? 'text-bull bg-bull/10' : 'text-muted bg-muted/10'}
              />
              <div className="px-5 py-4 grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-xs text-muted mb-1">Daily Send Time</div>
                  <div className="text-lg font-bold">{config.sendTimeET} <span className="text-xs font-normal text-muted">ET</span></div>
                </div>
                <div className="text-center border-x border-border/30">
                  <div className="text-xs text-muted mb-1">Last Sent</div>
                  <div className="text-sm font-semibold">
                    {config.lastSent
                      ? new Date(config.lastSent).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' })
                      : '—'}
                  </div>
                  {config.lastSent && (
                    <div className="text-xs text-muted">
                      {new Date(config.lastSent).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' })} ET
                    </div>
                  )}
                </div>
                <div className="text-center">
                  <div className="text-xs text-muted mb-1">Status</div>
                  <div className="text-xs font-medium leading-snug">
                    {config.lastStatus
                      ? <span className={config.lastStatus.startsWith('✓') ? 'text-bull' : 'text-bear'}>{config.lastStatus}</span>
                      : <span className="text-muted">Not yet sent</span>}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Subscribers */}
          <Card>
            <SectionHeader icon={Users} title="Subscribers" badge={`${subscribers.length} total`} />
            <div className="px-5 py-5 space-y-4">

              {/* Add form — admin only */}
              <form onSubmit={addSubscriber} className="flex gap-2">
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Name (optional)"
                  className="w-28 shrink-0 bg-bg border border-border/50 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-accent/50 transition-colors"
                />
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={e => { setNewEmail(e.target.value); setAddMsg(null) }}
                  placeholder="email@example.com"
                  className="flex-1 bg-bg border border-border/50 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-accent/50 transition-colors"
                />
                <button
                  type="submit"
                  disabled={addLoading || !newEmail}
                  className="bg-accent hover:bg-accent/80 text-white px-3 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-40 flex items-center gap-1.5 shrink-0"
                >
                  {addLoading ? <RefreshCw size={13} className="animate-spin" /> : <Plus size={13} />}
                  Add
                </button>
              </form>

              {addMsg && (
                <div className={`text-xs px-3 py-2 rounded-xl flex items-center gap-2 ${addMsg.ok ? 'bg-bull/10 text-bull' : 'bg-bear/10 text-bear'}`}>
                  {addMsg.ok ? <CheckCircle size={12} /> : <XCircle size={12} />}
                  {addMsg.text}
                </div>
              )}

              {/* Subscriber list */}
              <div className="space-y-2">
                {subscribers.length === 0 ? (
                  <p className="text-muted text-sm text-center py-4">No subscribers yet — add the first one above.</p>
                ) : subscribers.map(sub => (
                  <div key={sub.email} className="flex items-center justify-between bg-bg border border-border/30 rounded-xl px-4 py-3">
                    <div>
                      <div className="text-sm font-medium">{sub.name || sub.email.split('@')[0]}</div>
                      <div className="text-xs text-muted">{sub.email}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-xs text-muted hidden sm:block">
                        Added {new Date(sub.addedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                      <button
                        onClick={() => removeSubscriber(sub.email)}
                        className="text-muted/50 hover:text-bear transition-colors p-1"
                        title={`Remove ${sub.email}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Schedule config */}
          <Card>
            <SectionHeader icon={Clock} title="Schedule Settings" />
            <form onSubmit={saveConfig} className="px-5 py-5 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Enable Daily Briefing</div>
                  <div className="text-xs text-muted mt-0.5">Auto-send every day at the configured time</div>
                </div>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, enabled: !f.enabled }))}
                  className="flex items-center gap-2 text-sm"
                >
                  {form.enabled
                    ? <ToggleRight size={28} className="text-bull" />
                    : <ToggleLeft  size={28} className="text-muted" />}
                  <span className={form.enabled ? 'text-bull font-medium' : 'text-muted'}>
                    {form.enabled ? 'On' : 'Off'}
                  </span>
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">
                  Daily Send Time (US Eastern)
                </label>
                <select
                  value={form.sendTimeET}
                  onChange={e => setForm(f => ({ ...f, sendTimeET: e.target.value }))}
                  className="w-full bg-bg border border-border/50 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-accent/50 transition-colors"
                >
                  {TIME_OPTIONS.map(t => (
                    <option key={t} value={t}>
                      {t} ET
                      {t === '07:00' ? ' — Default (1 hour before open)' : ''}
                      {t === '09:15' ? ' — Pre-market' : ''}
                      {t === '09:30' ? ' — Market open' : ''}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted mt-1.5">
                  7:00 AM ET is ideal — you'll have the full AI briefing before pre-market opens at 9 AM.
                </p>
              </div>

              {saveMsg && (
                <div className={`flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl ${saveMsg.ok ? 'bg-bull/10 text-bull' : 'bg-bear/10 text-bear'}`}>
                  {saveMsg.ok ? <CheckCircle size={14} /> : <XCircle size={14} />}
                  {saveMsg.text}
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-white/10 hover:bg-white/15 text-white font-semibold py-2.5 rounded-xl text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving && <RefreshCw size={13} className="animate-spin" />}
                {saving ? 'Saving…' : 'Save Settings'}
              </button>
            </form>
          </Card>

          {/* Send now */}
          <Card>
            <SectionHeader icon={Send} title="Send Immediately" />
            <div className="px-5 py-5 space-y-4">
              <div className="bg-bg border border-border/30 rounded-xl p-4 space-y-2">
                <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Every Briefing Includes</div>
                {[
                  ['📊', 'Live index snapshot — SPY, QQQ, DIA, IWM with % change'],
                  ['📡', 'VIX reading + Fear & Greed index gauge'],
                  ['📈', 'Top sector rotation leaders & laggards'],
                  ['🤖', 'AI market tone, key themes & actionable trade setup (Gemini Pro)'],
                  ['🏆', 'Top 5 AI Scorer picks with signals and suggested levels'],
                  ['🔗', 'Quick-action links back into ATI'],
                ].map(([emoji, text]) => (
                  <div key={text} className="flex items-start gap-2.5 text-sm">
                    <span>{emoji}</span>
                    <span className="text-muted leading-snug">{text}</span>
                  </div>
                ))}
              </div>

              {subscribers.length === 0 && (
                <div className="text-xs text-neutral bg-neutral/10 border border-neutral/20 px-4 py-2.5 rounded-xl">
                  Add at least one subscriber above before sending.
                </div>
              )}

              {sendMsg && (
                <div className={`flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl ${sendMsg.ok ? 'bg-bull/10 text-bull' : 'bg-bear/10 text-bear'}`}>
                  {sendMsg.ok ? <CheckCircle size={14} /> : <XCircle size={14} />}
                  {sendMsg.text}
                </div>
              )}

              <button
                onClick={sendNow}
                disabled={sending || subscribers.length === 0}
                className="w-full bg-accent hover:bg-accent/90 text-white font-semibold py-3 rounded-xl text-sm transition-all disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {sending ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    Generating AI briefing + sending to {subscribers.length} subscriber{subscribers.length !== 1 ? 's' : ''}…
                  </>
                ) : (
                  <>
                    <Send size={14} />
                    Send to All {subscribers.length} Subscriber{subscribers.length !== 1 ? 's' : ''} Now
                  </>
                )}
              </button>

              {sending && (
                <p className="text-xs text-muted text-center animate-pulse">
                  Fetching live market data · Generating Gemini Pro briefing · Sending email…
                </p>
              )}
            </div>
          </Card>

          {/* Podcasts */}
          <Card>
            <SectionHeader icon={Mic} title="ATI Podcasts" badge="Andrew & Ava · AI Voices" badgeColor="text-ai bg-ai/10" />
            <div className="px-5 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-card2 rounded-xl px-3 py-2.5 text-center">
                  <div className="text-xs text-muted mb-0.5">🌍 World News</div>
                  <div className="text-sm font-semibold text-white">10 min</div>
                  <div className="text-xs text-muted mt-0.5">World, US, tech, more</div>
                </div>
                <div className="bg-card2 rounded-xl px-3 py-2.5 text-center">
                  <div className="text-xs text-muted mb-0.5">📈 Morning Edge</div>
                  <div className="text-sm font-semibold text-white">5 min</div>
                  <div className="text-xs text-muted mt-0.5">Briefing + top picks</div>
                </div>
              </div>
              <p className="text-xs text-muted">
                Generated at 7 AM ET alongside the morning briefing, or on demand below.
              </p>

              {podGenMsg && (
                <div className={`flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl ${podGenMsg.ok ? 'bg-bull/10 text-bull' : 'bg-bear/10 text-bear'}`}>
                  {podGenMsg.ok ? <CheckCircle size={14} /> : <XCircle size={14} />}
                  {podGenMsg.text}
                </div>
              )}

              <button
                onClick={generatePodcastsNow}
                disabled={podGenLoading}
                className="w-full bg-ai hover:bg-ai/90 text-white font-semibold py-3 rounded-xl text-sm transition-all disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {podGenLoading ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span className="truncate">{podGenStep || 'Starting…'}</span>
                  </>
                ) : (
                  <>
                    <Mic size={14} />
                    Generate Both Podcasts Now
                  </>
                )}
              </button>
              {podGenLoading && (
                <p className="text-xs text-muted text-center animate-pulse">
                  Running in background — takes 5–8 minutes. You can navigate away and come back.
                </p>
              )}

              {podcasts.length === 0 ? (
                <p className="text-xs text-muted text-center py-4">No podcasts generated yet. Click above to create today's episodes.</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted font-medium uppercase tracking-wider">Library</p>
                  {podcasts.slice(0, 10).map(pod => {
                    const isNews  = pod.type === 'world-news'
                    const isPlay  = playingUrl === pod.url
                    return (
                      <div key={pod.file} className="bg-card2 rounded-xl px-4 py-3 flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isNews ? 'bg-info/15' : 'bg-ai/15'}`}>
                          <Radio size={14} className={isNews ? 'text-info' : 'text-ai'} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold truncate">{isNews ? '🌍 World News' : '📈 Morning Edge'}</div>
                          <div className="text-xs text-muted">{pod.date} · Andrew &amp; Ava · {isNews ? '10 min' : '5 min'}</div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => togglePlay(pod.url)}
                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isPlay ? 'bg-bear/20 text-bear' : 'bg-white/10 hover:bg-white/20 text-white'}`}
                          >
                            {isPlay ? <Pause size={13} /> : <Play size={13} />}
                          </button>
                          <a
                            href={pod.url}
                            download
                            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-muted hover:text-white transition-all text-xs font-bold"
                            title="Download MP3"
                          >↓</a>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </Card>

          {/* Hidden audio element */}
          <audio ref={audioRef} onEnded={() => setPlayingUrl(null)} className="hidden" />

          {/* Preview */}
          <Card>
            <SectionHeader icon={Eye} title="Email Preview" badge="Layout Only" />
            <div className="px-5 py-5">
              <p className="text-sm text-muted mb-4">
                Preview the email layout with live market data. The AI narrative is a placeholder — send a real briefing to see the full Gemini Pro content.
              </p>
              <button
                onClick={() => { setPreviewKey(k => k + 1); setShowPreview(true) }}
                className="flex items-center gap-2 text-sm font-medium bg-white/10 hover:bg-white/15 px-4 py-2.5 rounded-xl transition-all mb-4"
              >
                <Eye size={14} />
                {showPreview ? 'Refresh Preview' : 'Show Email Preview'}
              </button>
              {showPreview && (
                <div className="rounded-xl overflow-hidden border border-border/40 bg-black" style={{ height: 600 }}>
                  <iframe
                    key={previewKey}
                    src={`/api/briefing/preview?token=${localStorage.getItem('apex_token') || ''}`}
                    title="Email Preview"
                    className="w-full h-full"
                    style={{ border: 'none' }}
                  />
                </div>
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
