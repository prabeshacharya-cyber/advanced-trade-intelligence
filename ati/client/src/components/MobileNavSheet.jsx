import { useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import {
  BarChart3, Radar, CandlestickChart, CalendarDays, Shield, MessageSquare,
  Briefcase, FlaskConical, Sunrise, ScanSearch, Calculator, Bell,
  BookOpen, Wallet, Settings, TrendingUp, FlaskRound, X,
  Database, BarChart2
} from 'lucide-react'

const GROUPS = [
  {
    section: 'Markets',
    items: [
      { to: '/dashboard',  label: 'Dashboard',       Icon: BarChart3 },
      { to: '/',           label: 'Market Leaders',   Icon: Radar,         end: true },
      { to: '/funds',      label: 'Fund Leaders',     Icon: TrendingUp },
      { to: '/sentiment',  label: 'Sentiment',        Icon: MessageSquare },
      { to: '/flow',       label: 'Options Flow',     Icon: CandlestickChart },
    ],
  },
  {
    section: 'Research',
    items: [
      { to: '/earnings',   label: 'Earnings',         Icon: CalendarDays },
      { to: '/insider',    label: 'Insider Tracker',  Icon: Shield },
      { to: '/research',   label: 'Deep Research',    Icon: FlaskConical },
      { to: '/chat',       label: 'AI Chat',          Icon: Briefcase },
    ],
  },
  {
    section: 'Trading',
    items: [
      { to: '/scanner',    label: 'Scanner',          Icon: ScanSearch },
      { to: '/planner',    label: 'Trade Planner',    Icon: Calculator },
      { to: '/portfolio',  label: 'Portfolio',        Icon: Wallet },
      { to: '/journal',    label: 'Trade Journal',    Icon: BookOpen },
      { to: '/backtest',   label: 'Backtest Lab',     Icon: FlaskRound },
    ],
  },
  {
    section: 'System',
    items: [
      { to: '/alerts',     label: 'Alerts',           Icon: Bell },
      { to: '/briefing',   label: 'Morning Briefing', Icon: Sunrise },
      { to: '/data',       label: 'Data Quality',     Icon: Database },
      { to: '/settings',   label: 'Settings',         Icon: Settings },
    ],
  },
]

export default function MobileNavSheet({ open, onClose }) {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="md:hidden fixed inset-0 z-40 bg-black/60 transition-opacity duration-200"
        style={{ opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none' }}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl border-t border-border/60"
        style={{
          background: 'rgba(10,10,12,0.97)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          transform: open ? 'translateY(0)' : 'translateY(110%)',
          transition: 'transform 220ms cubic-bezier(0.32, 0.72, 0, 1)',
          maxHeight: '88dvh',
          overflowY: 'auto',
          paddingBottom: 'env(safe-area-inset-bottom, 16px)',
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        {/* Handle + header */}
        <div
          className="sticky top-0 z-10 px-5 pt-3 pb-2"
          style={{ background: 'rgba(10,10,12,0.97)', backdropFilter: 'blur(24px)' }}
        >
          <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-3" />
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-semibold text-white">Navigation</span>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/8 text-muted hover:text-white transition-colors"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Nav groups */}
        <div className="px-4 pb-4 space-y-1">
          {GROUPS.map(({ section, items }) => (
            <div key={section}>
              <p className="text-[10px] font-semibold text-muted/50 uppercase tracking-widest px-3 pt-4 pb-2">
                {section}
              </p>
              {items.map(({ to, label, Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all min-h-[44px] ${
                      isActive
                        ? 'bg-white/10 text-white'
                        : 'text-muted hover:text-white hover:bg-white/5'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon size={17} strokeWidth={isActive ? 2 : 1.5} />
                      {label}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          ))}

          <div className="pt-4 border-t border-border/40">
            <p className="text-[10px] text-muted/40 leading-relaxed px-3 py-2">
              Advanced Trade Intelligence · Free-first architecture<br />
              SEC · AV · FH · FMP · FRED · Not financial advice
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
