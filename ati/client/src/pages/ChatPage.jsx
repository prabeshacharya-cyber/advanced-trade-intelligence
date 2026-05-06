import { useState, useRef, useCallback } from 'react'

const QUICK_PROMPTS = [
  'What should I watch at open today?',
  'Which sectors are showing strength?',
  'Explain a good risk management framework',
  'Best risk/reward setups this week?',
  'How do I read options flow?',
  'Explain VWAP and how to trade it',
]

export default function ChatPage() {
  const [messages, setMessages] = useState([
    { role:'assistant', content:"Hi! I'm ATI AI, your financial intelligence assistant. Ask me anything about markets, stocks, trading setups, options, or risk management — I'll give you institutional-quality analysis." }
  ])
  const [input, setInput]   = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const scrollToBottom = useCallback(() => bottomRef.current?.scrollIntoView({ behavior:'smooth' }), [])

  async function sendMessage(text) {
    const userMsg = text || input.trim()
    if (!userMsg || loading) return
    setInput('')
    const next = [...messages, { role:'user', content:userMsg }]
    setMessages(next)
    setLoading(true)
    setTimeout(scrollToBottom, 50)
    try {
      const r = await fetch('/api/chat', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ messages: next }),
      })
      const d = await r.json()
      setMessages(prev => [...prev, { role:'assistant', content: d.reply }])
    } catch {
      setMessages(prev => [...prev, { role:'assistant', content:"Sorry, couldn't connect to the AI backend. Please try again." }])
    } finally {
      setLoading(false)
      setTimeout(scrollToBottom, 50)
    }
  }

  return (
    <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, padding:'16px 18px', display:'flex', flexDirection:'column', height:'calc(100vh - 140px)', minHeight:500 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
        <h2 style={{ fontSize:18, fontWeight:700, margin:0 }}>ATI AI Chat</h2>
        <span style={{ fontSize:11, color:'#818cf8', border:'1px solid rgba(129,140,248,0.35)', borderRadius:20, padding:'2px 10px' }}>Gemini Pro</span>
      </div>

      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
        {QUICK_PROMPTS.map(p => (
          <button key={p} onClick={() => sendMessage(p)} disabled={loading} style={{ fontSize:12, padding:'4px 10px', borderRadius:8, border:'1px solid rgba(129,140,248,0.35)', color:'#818cf8', background:'transparent', cursor:'pointer', opacity: loading ? 0.5 : 1 }}>
            {p}
          </button>
        ))}
      </div>

      <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:10, marginBottom:12, paddingRight:4 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display:'flex', justifyContent: m.role==='user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth:'85%', borderRadius:12, padding:'10px 14px', fontSize:13, lineHeight:1.65, whiteSpace:'pre-wrap',
              background: m.role==='user' ? 'rgba(129,140,248,0.18)' : 'var(--bg3)',
              border: `1px solid ${m.role==='user' ? 'rgba(129,140,248,0.3)' : 'var(--border)'}`,
              color:'var(--text)',
            }}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display:'flex', justifyContent:'flex-start' }}>
            <div style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:12, padding:'10px 14px', fontSize:13, color:'var(--muted)', display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ width:12, height:12, borderRadius:'50%', border:'2px solid rgba(129,140,248,0.3)', borderTopColor:'#818cf8', display:'inline-block', animation:'spin 0.8s linear infinite' }} />
              Gemini is analysing…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <style>{`@keyframes spin { to { transform:rotate(360deg) } }`}</style>

      <div style={{ display:'flex', gap:8 }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
          placeholder="Ask anything about markets, stocks, setups, options… (Enter to send)"
          rows={2}
          style={{ flex:1, background:'var(--bg)', border:'1px solid var(--border)', color:'var(--text)', padding:'8px 12px', borderRadius:10, fontSize:13, outline:'none', resize:'none', fontFamily:'inherit' }}
        />
        <button
          onClick={() => sendMessage()}
          disabled={loading || !input.trim()}
          style={{ padding:'8px 16px', borderRadius:10, background:'rgba(129,140,248,0.18)', border:'1px solid rgba(129,140,248,0.4)', color:'#818cf8', fontWeight:700, cursor:'pointer', opacity: (loading || !input.trim()) ? 0.4 : 1 }}
        >
          Send
        </button>
      </div>
    </div>
  )
}
