import { useEffect, useState, useCallback } from 'react'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import { ChatPage, DashboardPage, EarningsPage, FlowPage, InsiderPage, PortfolioPage, ResearchPage, ScorerPage, SentimentPage } from './pages/Pages'
import { AlertsPage, JournalPage, PlannerPage, ScannerPage, SettingsPage, usePersistedState } from './pages/TraderPages'
import MorningBriefingPage from './pages/BriefingPage'
import { defaultTradingRules } from './features/risk/riskEngine'

const DEFAULT_SCANNER_FILTERS = {
  minPrice: 1, maxPrice: 500,
  minChange: -100, maxChange: 100,
  minGap: -100, minRV: 0,
  minVolume: 0, newsOnly: false,
}

const DEFAULT_PLAN_INPUT = {
  accountSize: 25000,
  maxRiskPerTradePct: 1,
  maxDailyLossPct: 3,
  entryPrice: '',
  stopLossPrice: '',
  targetPrice: '',
}

function useAuth() {
  const [token, setToken]     = useState(() => localStorage.getItem('apex_token'))
  const [user, setUser]       = useState(null)
  const [verified, setVerified] = useState(false)
  const [checking, setChecking] = useState(true)

  const verify = useCallback(async (t) => {
    if (!t) { setChecking(false); return }
    try {
      const res = await fetch('/api/auth/verify', {
        headers: { Authorization: `Bearer ${t}` }
      })
      if (res.ok) {
        const data = await res.json()
        setToken(t)
        setUser({ name: data.name, email: data.email, role: data.role || 'user' })
        setVerified(true)
      } else {
        localStorage.removeItem('apex_token')
        setToken(null)
        setUser(null)
        setVerified(false)
      }
    } catch {
      setVerified(false)
    }
    setChecking(false)
  }, [])

  useEffect(() => { verify(token) }, [])

  function login(newToken) {
    localStorage.setItem('apex_token', newToken)
    setToken(newToken)
    setVerified(true)
    verify(newToken)
  }

  function logout() {
    localStorage.removeItem('apex_token')
    setToken(null)
    setUser(null)
    setVerified(false)
  }

  return { token, user, verified, checking, login, logout }
}

export default function App() {
  const { token, user, verified, checking, login, logout } = useAuth()
  const [page, setPage] = useState(() => {
    const p = new URLSearchParams(window.location.search).get('page')
    const valid = ['dashboard','scorer','flow','earnings','insider','sentiment','portfolio','chat','research','briefing','scanner','planner','alerts','journal','settings']
    return valid.includes(p) ? p : 'dashboard'
  })

  const [watchlist, setWatchlist]           = usePersistedState('apex_watchlist', [])
  const [scannerFilters, setScannerFilters] = usePersistedState('apex_scanner_filters', DEFAULT_SCANNER_FILTERS)
  const [planInput, setPlanInput]           = usePersistedState('apex_plan_input', DEFAULT_PLAN_INPUT)
  const [alerts, setAlerts]                 = usePersistedState('apex_alerts', [])
  const [triggered, setTriggered]           = usePersistedState('apex_triggered', [])
  const [trades, setTrades]                 = usePersistedState('apex_trades', [])
  const [riskSettings, setRiskSettings]     = usePersistedState('apex_risk_settings', defaultTradingRules)

  const [scannerData, setScannerData] = useState(null)
  useEffect(() => {
    fetch('/api/market/top-assets')
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setScannerData(d))
      .catch(() => {})
  }, [])

  if (checking) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-muted text-sm animate-pulse">Loading ATI…</div>
      </div>
    )
  }

  if (!verified) {
    return <LoginPage onLogin={login} />
  }

  const sharedProps = { data: scannerData, watchlist, setWatchlist, scannerFilters, setScannerFilters }
  const marketRows = scannerData?.rows || []

  const pages = {
    dashboard: () => <DashboardPage />,
    scorer:    () => <ScorerPage />,
    flow:      () => <FlowPage />,
    earnings:  () => <EarningsPage />,
    insider:   () => <InsiderPage />,
    sentiment: () => <SentimentPage />,
    portfolio: () => <PortfolioPage />,
    chat:      () => <ChatPage />,
    research:  () => <ResearchPage />,
    briefing:  () => <MorningBriefingPage user={user} />,
    scanner:   () => <ScannerPage {...sharedProps} />,
    planner:   () => <PlannerPage planInput={planInput} setPlanInput={setPlanInput} />,
    alerts:    () => <AlertsPage alerts={alerts} setAlerts={setAlerts} triggered={triggered} setTriggered={setTriggered} marketRows={marketRows} />,
    journal:   () => <JournalPage trades={trades} setTrades={setTrades} />,
    settings:  () => <SettingsPage riskSettings={riskSettings} setRiskSettings={setRiskSettings} onLogout={logout} />,
  }

  const PageComponent = pages[page] ?? pages.dashboard

  return (
    <Layout page={page} setPage={setPage} onLogout={logout} user={user}>
      <PageComponent />
    </Layout>
  )
}
