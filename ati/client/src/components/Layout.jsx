import { useState, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  BarChart3, Radar, CandlestickChart, CalendarDays, Shield, MessageSquare,
  Briefcase, FlaskConical, Sunrise, ScanSearch, Calculator, Bell,
  BookOpen, Wallet, Settings, MoreHorizontal, Search, TrendingUp, FlaskRound,
  Database, Trophy, Sparkles, Wrench, Zap
} from 'lucide-react'
import MobileNavSheet from './MobileNavSheet'

const NAV = [
  { section: 'Markets' },
  { to: '/dashboard',  label: 'Dashboard',       Icon: BarChart3 },
  { to: '/',           label: 'Market Leaders',   Icon: Radar,         end: true },
  { to: '/funds',      label: 'Fund Leaders',     Icon: TrendingUp },
  { to: '/sentiment',  label: 'Sentiment',        Icon: MessageSquare },
  { to: '/flow',       label: 'Options Flow',     Icon: CandlestickChart },
  { section: 'Research' },
  { to: '/earnings',   label: 'Earnings',         Icon: CalendarDays },
  { to: '/insider',    label: 'Insider Tracker',  Icon: Shield },
  { to: '/research',   label: 'Deep Research',    Icon: FlaskConical },
  { to: '/chat',       label: 'AI Chat',          Icon: Briefcase },
  { section: 'Trading' },
  { to: '/momentum',   label: 'Day Trading',       Icon: Zap },
  { to: '/scanner',    label: 'Scanner',          Icon: ScanSearch },
  { to: '/planner',    label: 'Trade Planner',    Icon: Calculator },
  { to: '/portfolio',  label: 'Portfolio',        Icon: Wallet },
  { to: '/journal',    label: 'Trade Journal',    Icon: BookOpen },
  { to: '/backtest',   label: 'Backtest Lab',     Icon: FlaskRound },
  { section: 'System' },
  { to: '/alerts',     label: 'Alerts',           Icon: Bell, badge: true },
  { to: '/briefing',   label: 'Morning Briefing', Icon: Sunrise },
  { to: '/data',       label: 'Data Quality',     Icon: Database },
  { to: '/settings',   label: 'Settings',         Icon: Settings },
]

const PRIMARY_TABS = [
  { to: '/',        label: 'Markets',  Icon: BarChart3,  end: true },
  { to: '/scanner', label: 'Scores',   Icon: Trophy },
  { to: '/chat',    label: 'AI Chat',  Icon: Sparkles },
  { to: '/planner', label: 'Tools',    Icon: Wrench },
]

export default function Layout({ children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [search, setSearch]     = useState('')
  const [unread, setUnread]     = useState(0)
  const [sheetOpen, setSheetOpen] = useState(false)

  useEffect(() => {
    fetch('/api/alerts/unread-count')
      .then(r => r.json())
      .then(d => setUnread(d.unread || 0))
      .catch(() => {})
  }, [])

  function handleSearch(e) {
    e.preventDefault()
    if (search.trim()) {
      navigate(`/asset/${search.trim().toUpperCase()}`)
      setSearch('')
    }
  }

  const isMoreActive = !PRIMARY_TABS.some(t =>
    t.end ? location.pathname === t.to : location.pathname.startsWith(t.to)
  )

  return (
    <div className="min-h-screen bg-bg text-text font-sans">
      <div className="md:grid md:grid-cols-[220px_1fr]">

        {/* ── Desktop Sidebar ── */}
        <aside className="hidden md:flex flex-col border-r border-border/50 sticky top-0 h-screen overflow-y-auto">
          <div className="px-5 pt-5 pb-4 mb-1">
            <h1 className="text-xl font-semibold tracking-tighter text-white">ATI</h1>
            <p className="text-[11px] text-muted mt-0.5 tracking-tight">Advanced Trade Intelligence</p>
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="px-4 mb-3">
            <div className="flex items-center gap-2 bg-white/[0.06] border border-border/40 rounded-xl px-3 py-2">
              <Search size={13} className="text-muted shrink-0" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search symbol…"
                className="bg-transparent text-sm text-white placeholder-muted outline-none w-full"
              />
            </div>
          </form>

          <nav className="flex-1 px-2 space-y-0.5">
            {NAV.map((item, i) => {
              if (item.section) {
                return (
                  <p key={item.section + i} className="text-[10px] font-semibold text-muted/50 uppercase tracking-widest px-3 pt-4 pb-1.5">
                    {item.section}
                  </p>
                )
              }
              const { to, label, Icon, end, badge } = item
              return (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-white/10 text-white'
                        : 'text-muted hover:text-white hover:bg-white/5'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon size={15} strokeWidth={isActive ? 2 : 1.5} />
                      <span className="flex-1">{label}</span>
                      {badge && unread > 0 && (
                        <span className="bg-bear text-white rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none">
                          {unread}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              )
            })}
          </nav>

          <div className="mt-auto px-5 pt-4 pb-5 border-t border-border/40">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-bull" />
              <span className="text-[10px] text-muted/60 font-medium">LIVE</span>
            </div>
            <p className="text-[10px] text-muted/40 leading-relaxed">
              Free-first · SEC · AV · FH · FMP · FRED
            </p>
          </div>
        </aside>

        {/* ── Main Content ── */}
        <div className="flex flex-col min-h-screen">
          {/* Topbar — desktop only */}
          <header className="hidden md:flex items-center gap-4 px-7 h-14 border-b border-border/40 shrink-0">
            <div className="flex-1" />
            <div className="flex items-center gap-3">
              <span className="text-[11px] bg-bull/10 text-bull px-2.5 py-1 rounded-full border border-bull/20 font-medium">
                ● LIVE
              </span>
              <span className="text-xs text-muted">
                {new Date().toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' })}
              </span>
            </div>
          </header>

          {/* Mobile header */}
          <header className="md:hidden flex items-center gap-3 px-4 h-14 border-b border-border/40 shrink-0">
            <span className="text-base font-semibold tracking-tighter text-white">ATI</span>
            <form onSubmit={handleSearch} className="flex-1">
              <div className="flex items-center gap-2 bg-white/[0.06] border border-border/40 rounded-xl px-3 py-1.5">
                <Search size={13} className="text-muted shrink-0" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search symbol…"
                  className="bg-transparent text-sm text-white placeholder-muted outline-none w-full"
                />
              </div>
            </form>
            <span className="text-[11px] bg-bull/10 text-bull px-2 py-1 rounded-full border border-bull/20 font-medium shrink-0">
              ● LIVE
            </span>
          </header>

          <main className="flex-1 p-4 md:p-7 pb-24 md:pb-8 min-w-0">
            {children}
          </main>
        </div>
      </div>

      {/* ── Mobile Bottom Tab Bar ── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 border-t border-border/50 grid grid-cols-5 gap-0 z-30"
        style={{
          background: 'rgba(4,4,4,0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          paddingBottom: 'env(safe-area-inset-bottom, 8px)',
        }}
      >
        {PRIMARY_TABS.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-all min-h-[52px] ${
                isActive ? 'text-bull' : 'text-muted'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={20} strokeWidth={isActive ? 2.2 : 1.5} />
                {label}
              </>
            )}
          </NavLink>
        ))}

        <button
          onClick={() => setSheetOpen(true)}
          className={`flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-all min-h-[52px] ${
            isMoreActive || sheetOpen ? 'text-bull' : 'text-muted'
          }`}
        >
          <MoreHorizontal size={20} strokeWidth={1.5} />
          More
        </button>
      </nav>

      {/* ── Mobile Navigation Sheet ── */}
      <MobileNavSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
      />
    </div>
  )
}
