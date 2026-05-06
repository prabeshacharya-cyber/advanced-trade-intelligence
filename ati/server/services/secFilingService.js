import getDb from '../db/index.js'
import { getFilings, getCompanyFacts, getFundamentals } from '../providers/providerManager.js'
import { classifyFilingEvent } from '../providers/secProvider.js'
import { enrichNewsItem } from './eventClassifierService.js'

export async function fetchAndStoreFilings(symbol) {
  const result = await getFilings(symbol)
  if (!result?.filings?.length) return []
  const db = getDb()
  const insert = db.prepare(`
    INSERT OR IGNORE INTO sec_filings
      (symbol, form_type, accession_number, filing_date, report_date, title, description, url, event_type, source)
    VALUES(@symbol, @form_type, @accession_number, @filing_date, @report_date, @title, @description, @url, @event_type, @source)
  `)
  const rows = result.filings.map(f => ({
    symbol,
    form_type:        f.form_type || '8-K',
    accession_number: f.accession_number || `${symbol}_${f.filing_date}_${Math.random().toString(36).slice(2)}`,
    filing_date:      f.filing_date || '',
    report_date:      f.report_date || '',
    title:            f.title || f.form_type || '',
    description:      f.description || '',
    url:              f.url || '',
    event_type:       f.event_type || classifyFilingEvent(f.form_type),
    source:           'SEC EDGAR',
  }))
  db.transaction(() => rows.forEach(r => insert.run(r)))()
  return rows
}

export function getFilingsFromDb(symbol, limit = 20) {
  return getDb().prepare(
    'SELECT * FROM sec_filings WHERE symbol=? ORDER BY filing_date DESC LIMIT ?'
  ).all(symbol, limit)
}

export function extractFundamentalsFromSec(secFacts) {
  const { facts = {} } = secFacts || {}
  return {
    revenue:           facts.revenue?.value,
    netIncome:         facts.netIncome?.value,
    eps:               facts.eps?.value,
    assets:            facts.assets?.value,
    liabilities:       facts.liabilities?.value,
    freeCashFlow:      facts.freeCashFlow?.value,
    sharesOutstanding: facts.sharesOutstanding?.value,
    operatingIncome:   facts.operatingIncome?.value,
    revenueDate:       facts.revenue?.date,
    source:            'SEC EDGAR',
  }
}

export async function getEnrichedFundamentals(symbol) {
  const { sec, fmp } = await getFundamentals(symbol)
  const secData = extractFundamentalsFromSec(sec)
  const fmpLatest = fmp?.statements?.[0] || {}
  return {
    revenue:        secData.revenue      ?? fmpLatest.revenue,
    netIncome:      secData.netIncome    ?? fmpLatest.netIncome,
    eps:            secData.eps          ?? fmpLatest.eps,
    freeCashFlow:   secData.freeCashFlow,
    operatingIncome:secData.operatingIncome ?? fmpLatest.operatingIncome,
    grossMargin:    fmpLatest.grossProfit && fmpLatest.revenue
                    ? (fmpLatest.grossProfit / fmpLatest.revenue) : null,
    netMargin:      fmpLatest.netIncome && fmpLatest.revenue
                    ? (fmpLatest.netIncome / fmpLatest.revenue) : null,
    sources: [secData.source, fmp ? 'FMP' : null].filter(Boolean),
  }
}
