import { Routes, Route, Navigate } from 'react-router-dom'
import Layout        from './components/Layout'
import Dashboard     from './pages/Dashboard'
import MarketLeaders from './pages/MarketLeaders'
import FundLeaders   from './pages/FundLeaders'
import AssetDetail   from './pages/AssetDetail'
import BacktestLab   from './pages/BacktestLab'
import AlertsPage    from './pages/AlertsPage'
import DataQuality   from './pages/DataQuality'
import Portfolio     from './pages/Portfolio'
import FlowPage      from './pages/FlowPage'
import EarningsPage  from './pages/EarningsPage'
import InsiderPage   from './pages/InsiderPage'
import SentimentPage from './pages/SentimentPage'
import ChatPage      from './pages/ChatPage'
import ResearchPage  from './pages/ResearchPage'
import ScannerPage   from './pages/ScannerPage'
import PlannerPage   from './pages/PlannerPage'
import JournalPage   from './pages/JournalPage'
import SettingsPage  from './pages/SettingsPage'
import BriefingPage  from './pages/BriefingPage'
import MomentumPage  from './pages/MomentumPage'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/"          element={<MarketLeaders />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/funds"     element={<FundLeaders />} />
        <Route path="/portfolio" element={<Portfolio />} />
        <Route path="/scanner"   element={<ScannerPage />} />
        <Route path="/planner"   element={<PlannerPage />} />
        <Route path="/journal"   element={<JournalPage />} />
        <Route path="/earnings"  element={<EarningsPage />} />
        <Route path="/insider"   element={<InsiderPage />} />
        <Route path="/sentiment" element={<SentimentPage />} />
        <Route path="/flow"      element={<FlowPage />} />
        <Route path="/chat"      element={<ChatPage />} />
        <Route path="/research"  element={<ResearchPage />} />
        <Route path="/briefing"  element={<BriefingPage />} />
        <Route path="/momentum"  element={<MomentumPage />} />
        <Route path="/backtest"  element={<BacktestLab />} />
        <Route path="/alerts"    element={<AlertsPage />} />
        <Route path="/data"      element={<DataQuality />} />
        <Route path="/settings"  element={<SettingsPage />} />
        <Route path="/asset/:symbol" element={<AssetDetail />} />
        <Route path="*"          element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
