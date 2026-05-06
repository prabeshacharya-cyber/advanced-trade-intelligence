import { useState } from 'react'
import { BarChart3, Bell, BookOpen, Briefcase, CalendarDays, CandlestickChart, Calculator, FlaskConical, LogOut, MessageSquare, Radar, ScanSearch, Settings, Shield, Wallet, Sunrise, MoreHorizontal } from 'lucide-react'
import MobileNavSheet from './MobileNavSheet'

const nav = [
  { section: 'Market' },
  ['dashboard', 'Dashboard',            BarChart3],
  ['scorer',    'Top 20 Scorer',         Radar],
  ['flow',      'Options & Dark Pool',   CandlestickChart],
  ['earnings',  'Earnings',              CalendarDays],
  ['insider',   'Insider Tracker',       Shield],
  ['sentiment', 'Social Sentiment',      MessageSquare],
  { section: 'AI Intelligence' },
  ['chat',      'AI Chat',               Briefcase],
  ['research',  'Deep Research',         FlaskConical],
  ['briefing',  'Morning Briefing',      Sunrise],
  { section: 'Trader Tools' },
  ['scanner',   'Scanner & Watchlist',   ScanSearch],
  ['planner',   'Trade Planner',         Calculator],
  ['alerts',    'Alerts',                Bell],
  ['journal',   'Trade Journal',         BookOpen],
  ['portfolio', 'Portfolio',             Wallet],
  { section: 'Account' },
  ['settings',  'Settings',              Settings],
]

const primaryTabs = [
  ['dashboard', 'Dashboard', BarChart3],
  ['scanner',   'Scanner',   ScanSearch],
  ['planner',   'Planner',   Calculator],
  ['journal',   'Journal',   BookOpen],
]

export default function Layout({ page, setPage, children, onLogout, user }) {
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <div className="min-h-screen">
      <div className="md:grid md:grid-cols-[220px_1fr]">

        {/* Desktop Sidebar */}
        <aside className="hidden md:flex flex-col border-r border-border/50 p-5 sticky top-0 h-screen overflow-y-auto">
          <div className="mb-6">
            <h1 className="text-xl font-semibold tracking-tighter text-white">ATI</h1>
            <p className="text-xs text-muted mt-0.5 tracking-tight">Market Intelligence</p>
          </div>

          <nav className="flex-1 space-y-0.5">
            {nav.map((item, i) => {
              if (item.section) {
                return (
                  <p key={i} className="text-[10px] font-semibold text-muted/50 uppercase tracking-widest px-3 pt-4 pb-1.5">
                    {item.section}
                  </p>
                )
              }
              const [id, label, Icon] = item
              return (
                <button
                  key={id}
                  onClick={() => setPage(id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                    page === id
                      ? 'bg-white/10 text-white'
                      : 'text-muted hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon size={15} strokeWidth={page === id ? 2 : 1.5} />
                  {label}
                </button>
              )
            })}
          </nav>

          <div className="mt-auto pt-4 border-t border-border/40 space-y-2">
            {user?.name && (
              <div className="px-3 py-2 bg-white/[0.03] rounded-xl">
                <p className="text-xs font-medium text-white truncate">{user.name}</p>
                {user.email && <p className="text-[10px] text-muted/60 truncate mt-0.5">{user.email}</p>}
              </div>
            )}
            <p className="text-[10px] text-muted/40 leading-relaxed px-1">
              AI research tool · Not financial advice
            </p>
            {onLogout && (
              <button
                onClick={onLogout}
                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs text-muted hover:text-bear hover:bg-bear/10 transition-all"
              >
                <LogOut size={12} />
                Sign Out
              </button>
            )}
          </div>
        </aside>

        {/* Main content */}
        <main className="p-4 md:p-7 pb-24 md:pb-8 min-w-0">{children}</main>
      </div>

      {/* Mobile bottom tab bar: 4 primary + More */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 border-t border-border/50 grid grid-cols-5 gap-0"
        style={{ background: 'rgba(4,4,4,0.92)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', paddingBottom: 'env(safe-area-inset-bottom, 8px)' }}
      >
        {primaryTabs.map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setPage(id)}
            style={{ minHeight: '52px' }}
            className={`flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-all ${
              page === id ? 'text-bull' : 'text-muted'
            }`}
          >
            <Icon size={20} strokeWidth={page === id ? 2.2 : 1.5} />
            {label}
          </button>
        ))}

        {/* More tab */}
        <button
          onClick={() => setSheetOpen(true)}
          style={{ minHeight: '52px' }}
          className={`flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-all ${
            sheetOpen || !primaryTabs.some(([id]) => id === page) ? 'text-bull' : 'text-muted'
          }`}
        >
          <MoreHorizontal size={20} strokeWidth={1.5} />
          More
        </button>
      </nav>

      {/* More sheet */}
      <MobileNavSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        page={page}
        setPage={setPage}
        onLogout={onLogout}
        user={user}
      />
    </div>
  )
}
