import { cacheGet, cacheSet, TTL } from '../services/cacheService.js'
import { trackCall, trackError } from '../services/apiBudgetService.js'

const BASE = 'https://data.sec.gov'
const SEARCH = 'https://efts.sec.gov/LATEST/search-index'
const UA = `${process.env.SEC_USER_AGENT_NAME || 'ATI Research'} ${process.env.SEC_USER_AGENT_EMAIL || 'research@ati.dev'}`

async function secFetch(url) {
  trackCall('sec')
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'application/json' } })
  if (!r.ok) throw new Error(`SEC ${r.status} — ${url}`)
  return r.json()
}

const meta = (extras = {}) => ({
  source: 'SEC EDGAR', isRealData: true, isDemo: false, isStale: false,
  asOf: new Date().toISOString(), providerStatus: 'ok',
  missingFields: [], notes: [], ...extras,
})

const CIK_CACHE = {}

export async function getCompanyCik(symbol) {
  if (CIK_CACHE[symbol]) return CIK_CACHE[symbol]
  const cached = cacheGet('sec', `cik_${symbol}`)
  if (cached) { CIK_CACHE[symbol] = cached; return cached }
  try {
    const data = await secFetch(`${BASE}/submissions/CIK_SEARCH.json`)
    // Use EDGAR company search
    const r2 = await fetch(
      `https://efts.sec.gov/LATEST/search-index?q=%22${symbol}%22&dateRange=custom&startdt=2020-01-01&forms=10-K`,
      { headers: { 'User-Agent': UA } }
    )
    if (!r2.ok) return null
    const j = await r2.json()
    const hit = j?.hits?.hits?.[0]?._source
    if (!hit?.entity_id) return null
    const cik = String(hit.entity_id).padStart(10, '0')
    CIK_CACHE[symbol] = cik
    cacheSet('sec', `cik_${symbol}`, cik, TTL.secFundamentals)
    return cik
  } catch (e) {
    trackError('sec', 'getCompanyCik', e.message)
    return null
  }
}

export async function getRecentFilings(symbol, limit = 10) {
  const key = `filings_${symbol}`
  const cached = cacheGet('sec', key)
  if (cached) return { ...cached, isStale: false }
  try {
    // Use EDGAR full-text search for filings
    const r = await fetch(
      `https://efts.sec.gov/LATEST/search-index?q=%22${symbol}%22&forms=10-K,10-Q,8-K,4,S-1&dateRange=custom&startdt=2023-01-01&_source=period_of_report,file_date,form_type,entity_name,accession_no,file_num&hits.hits.total.value=1&hits.hits._source.period_of_report=1`,
      { headers: { 'User-Agent': UA } }
    )
    trackCall('sec')
    if (!r.ok) throw new Error(`SEC search ${r.status}`)
    const j = await r.json()
    const filings = (j?.hits?.hits || []).slice(0, limit).map(h => ({
      form_type: h._source?.form_type,
      filing_date: h._source?.file_date,
      report_date: h._source?.period_of_report,
      accession_number: h._source?.accession_no,
      entity_name: h._source?.entity_name,
      url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&type=${h._source?.form_type}&dateb=&owner=include&count=10`,
      event_type: classifyFilingEvent(h._source?.form_type),
    }))
    const result = { symbol, filings, ...meta() }
    cacheSet('sec', key, result, TTL.secFilings)
    return result
  } catch (e) {
    trackError('sec', 'getRecentFilings', e.message)
    return { symbol, filings: [], ...meta({ providerStatus: 'error', notes: [e.message] }) }
  }
}

export async function getCompanyFacts(symbol) {
  const key = `facts_${symbol}`
  const cached = cacheGet('sec', key)
  if (cached) return { ...cached, isStale: false }
  try {
    // Try to get CIK via submissions search
    const r = await fetch(
      `https://efts.sec.gov/LATEST/search-index?q=%22${encodeURIComponent(symbol)}%22&forms=10-K&dateRange=custom&startdt=2022-01-01`,
      { headers: { 'User-Agent': UA } }
    )
    trackCall('sec')
    if (!r.ok) throw new Error(`SEC ${r.status}`)
    const j = await r.json()
    const cik = j?.hits?.hits?.[0]?._source?.entity_id
    if (!cik) return { symbol, facts: {}, ...meta({ providerStatus: 'missing_key', notes: ['CIK not found for ' + symbol] }) }

    const cikPad = String(cik).padStart(10, '0')
    const factsR = await fetch(`${BASE}/api/xbrl/companyfacts/CIK${cikPad}.json`, { headers: { 'User-Agent': UA } })
    trackCall('sec')
    if (!factsR.ok) throw new Error(`XBRL facts ${factsR.status}`)
    const factsJ = await factsR.json()
    const facts = extractKeyFacts(factsJ)
    const result = { symbol, cik: cikPad, facts, ...meta() }
    cacheSet('sec', key, result, TTL.secFundamentals)
    return result
  } catch (e) {
    trackError('sec', 'getCompanyFacts', e.message)
    return { symbol, facts: {}, ...meta({ providerStatus: 'error', notes: [e.message] }) }
  }
}

function extractKeyFacts(factsJson) {
  const us = factsJson?.facts?.['us-gaap'] || {}
  const pick = (keys) => {
    for (const k of keys) {
      const vals = us[k]?.units?.USD || us[k]?.units?.shares
      if (!vals?.length) continue
      const sorted = [...vals].sort((a, b) => new Date(b.end||b.filed) - new Date(a.end||a.filed))
      return { value: sorted[0].val, date: sorted[0].end || sorted[0].filed, unit: Object.keys(us[k].units)[0] }
    }
    return null
  }
  return {
    revenue:            pick(['Revenues','RevenueFromContractWithCustomerExcludingAssessedTax','SalesRevenueNet']),
    netIncome:          pick(['NetIncomeLoss']),
    eps:                pick(['EarningsPerShareBasic','EarningsPerShareDiluted']),
    assets:             pick(['Assets']),
    liabilities:        pick(['Liabilities']),
    freeCashFlow:       pick(['NetCashProvidedByUsedInOperatingActivities']),
    sharesOutstanding:  pick(['CommonStockSharesOutstanding']),
    operatingIncome:    pick(['OperatingIncomeLoss']),
  }
}

export function classifyFilingEvent(formType) {
  const map = {
    '10-K': 'annual_report', '10-Q': 'quarterly_report',
    '8-K': 'material_event', 'S-1': 'ipo_or_registration',
    '4': 'insider_transaction', '13F-HR': 'institutional_holdings',
    'DEF 14A': 'proxy_statement',
  }
  return map[formType] || 'sec_filing'
}
