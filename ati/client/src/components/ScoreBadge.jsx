export function getRatingColor(label) {
  const map = {
    'Strong Watch':   '#22c55e',
    'Positive Setup': '#86efac',
    'Neutral':        '#94a3b8',
    'Cautious':       '#fbbf24',
    'High Risk':      '#ef4444',
  }
  return map[label] || '#94a3b8'
}

export function ScoreBadge({ label, score, size = 'md' }) {
  const color = getRatingColor(label)
  const pad   = size === 'sm' ? '2px 7px' : '4px 10px'
  const fs    = size === 'sm' ? 11 : 12
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:5,
      padding:pad, borderRadius:20,
      background: color + '22', border:`1px solid ${color}55`,
      color, fontSize:fs, fontWeight:600, whiteSpace:'nowrap',
    }}>
      <span style={{ fontSize:fs - 1 }}>
        {score >= 80 ? '▲▲' : score >= 65 ? '▲' : score >= 45 ? '—' : score >= 30 ? '▽' : '▽▽'}
      </span>
      {label}
    </span>
  )
}

export function ProbabilityBar({ value, label = 'Prob. outperform', compact = false }) {
  const pct = Math.max(0, Math.min(100, value || 0))
  const color = pct >= 65 ? '#22c55e' : pct >= 50 ? '#fbbf24' : '#ef4444'
  return (
    <div style={{ minWidth: compact ? 80 : 120 }}>
      {!compact && <div style={{ fontSize:11, color:'#94a3b8', marginBottom:3 }}>{label}</div>}
      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
        <div style={{ flex:1, height:compact?4:6, background:'#1f2937', borderRadius:10, overflow:'hidden' }}>
          <div style={{ width:`${pct}%`, height:'100%', background:color, borderRadius:10, transition:'width 0.4s' }} />
        </div>
        <span style={{ fontSize:compact?10:12, fontWeight:700, color, minWidth:32 }}>{pct}%</span>
      </div>
    </div>
  )
}

export function ChangeChip({ value }) {
  if (value == null) return <span style={{ color:'#94a3b8', fontSize:12 }}>—</span>
  const color = value > 0 ? '#22c55e' : value < 0 ? '#ef4444' : '#94a3b8'
  const sign  = value > 0 ? '+' : ''
  return (
    <span style={{ color, fontWeight:600, fontSize:12 }}>
      {sign}{value.toFixed(2)}%
    </span>
  )
}

export function DataBadge() {
  return <span style={{ fontSize:10, color:'#22c55e', background:'#22c55e18', padding:'1px 6px', borderRadius:8, border:'1px solid #22c55e33' }}>LIVE</span>
}
