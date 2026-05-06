import { useEffect } from 'react'
import {
  BarChart3, Bell, BookOpen, Briefcase, CalendarDays, CandlestickChart,
  Calculator, FlaskConical, LogOut, MessageSquare, Radar, ScanSearch,
  Settings, Shield, Wallet, Sunrise, X
} from 'lucide-react'

const groups = [
  {
    section: 'Market',
    items: [
      ['dashboard',  'Dashboard',          BarChart3],
      ['scorer',     'Top 20 Scorer',      Radar],
      ['flow',       'Options & Dark Pool', CandlestickChart],
      ['earnings',   'Earnings',           CalendarDays],
      ['insider',    'Insider Tracker',    Shield],
      ['sentiment',  'Social Sentiment',   MessageSquare],
    ],
  },
  {
    section: 'AI Intelligence',
    items: [
      ['chat',      'AI Chat',          Briefcase],
      ['research',  'Deep Research',    FlaskConical],
      ['briefing',  'Morning Briefing', Sunrise],
    ],
  },
  {
    section: 'Trader Tools',
    items: [
      ['scanner',   'Scanner & Watchlist', ScanSearch],
      ['planner',   'Trade Planner',       Calculator],
      ['alerts',    'Alerts',              Bell],
      ['journal',   'Trade Journal',       BookOpen],
      ['portfolio', 'Portfolio',           Wallet],
    ],
  },
  {
    section: 'Account',
    items: [
      ['settings', 'Settings', Settings],
    ],
  },
]

export default function MobileNavSheet({ open, onClose, page, setPage, onLogout, user }) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  function navigate(id) {
    setPage(id)
    onClose()
  }

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
          background: 'rgba(12,12,14,0.97)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          transform: open ? 'translateY(0)' : 'translateY(110%)',
          transition: 'transform 200ms ease-out',
          maxHeight: '88dvh',
          overflowY: 'auto',
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        {/* Handle + header */}
        <div className="sticky top-0 z-10 px-5 pt-3 pb-2" style={{ background: 'rgba(12,12,14,0.97)', backdropFilter: 'blur(24px)' }}>
          <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-3" />
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-semibold text-white">Navigation</span>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/8 text-muted hover:text-white transition-colors"
              aria-label="Close menu"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Nav groups */}
        <div className="px-4 pb-4 space-y-1">
          {groups.map(({ section, items }) => (
            <div key={section}>
              <p className="text-[10px] font-semibold text-muted/50 uppercase tracking-widest px-3 pt-4 pb-2">
                {section}
              </p>
              {items.map(([id, label, Icon]) => (
                <button
                  key={id}
                  onClick={() => navigate(id)}
                  style={{ minHeight: '44px' }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    page === id
                      ? 'bg-white/10 text-white'
                      : 'text-muted hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon size={17} strokeWidth={page === id ? 2 : 1.5} />
                  {label}
                </button>
              ))}
            </div>
          ))}

          {/* Footer user + logout */}
          <div className="mt-4 pt-4 border-t border-border/40 space-y-2">
            {user?.name && (
              <div className="px-3 py-2 bg-white/[0.03] rounded-xl">
                <p className="text-xs font-medium text-white truncate">{user.name}</p>
                {user.email && <p className="text-[10px] text-muted/60 truncate mt-0.5">{user.email}</p>}
              </div>
            )}
            <p className="text-[10px] text-muted/40 leading-relaxed px-3 pb-1">
              AI research tool · Not financial advice
            </p>
            {onLogout && (
              <button
                onClick={() => { onLogout(); onClose() }}
                style={{ minHeight: '44px' }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-muted hover:text-bear hover:bg-bear/10 transition-all"
              >
                <LogOut size={15} />
                Sign Out
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
