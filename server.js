import express from 'express'
import cors from 'cors'
import { GoogleGenAI } from '@google/genai'
import YahooFinance from 'yahoo-finance2'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs'
import { promises as fsp } from 'fs'
import { exec } from 'child_process'
import { promisify } from 'util'
import { tmpdir } from 'os'
import { Resend } from 'resend'
import nodemailer from 'nodemailer'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { EdgeTTS } from 'node-edge-tts'

const execAsync = promisify(exec)

const __dirname = dirname(fileURLToPath(import.meta.url))
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] })

const app = express()
app.use(cors())
app.use(express.json())

// ── Simple in-memory cache (5 minute TTL) ─────────────────────────────────────
const cache = new Map()
function cached(key, ttlMs, fn) {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.ts < ttlMs) return Promise.resolve(hit.data)
  return fn().then(data => { cache.set(key, { ts: Date.now(), data }); return data })
}

// ── Auth constants ────────────────────────────────────────────────────────────
const JWT_SECRET = process.env.APEX_JWT_SECRET || 'apex-fallback-secret-change-me'
const APEX_PASSWORD = process.env.APEX_PASSWORD || 'apex2024'

function requireAuth(req, res, next) {
  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : (req.query.token || null)
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  try {
    req.user = jwt.verify(token, JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}

// ── Subscriber file storage ───────────────────────────────────────────────────
const DATA_DIR = join(__dirname, 'data')
const SUBS_FILE = join(DATA_DIR, 'subscribers.json')

function loadSubscribers() {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
    if (!existsSync(SUBS_FILE)) {
      writeFileSync(SUBS_FILE, JSON.stringify({ subscribers: [{ email: 'prabeshacharya@gmail.com', name: 'Admin', addedAt: new Date().toISOString() }] }))
    }
    return (JSON.parse(readFileSync(SUBS_FILE, 'utf8')).subscribers || []).filter(s => s && s.email)
  } catch { return [] }
}

function saveSubscribers(subscribers) {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
    writeFileSync(SUBS_FILE, JSON.stringify({ subscribers }, null, 2))
  } catch (e) { console.error('[subscribers] save error:', e.message) }
}

// ── User accounts file storage ────────────────────────────────────────────────
const USERS_FILE = join(DATA_DIR, 'users.json')
const ADMIN_EMAIL = 'prabeshacharya@gmail.com'

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return { hash, salt }
}
function verifyPassword(password, hash, salt) {
  try {
    return crypto.timingSafeEqual(
      Buffer.from(crypto.scryptSync(password, salt, 64).toString('hex')),
      Buffer.from(hash)
    )
  } catch { return false }
}

function loadUsers() {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
    if (!existsSync(USERS_FILE)) writeFileSync(USERS_FILE, JSON.stringify({ users: [] }, null, 2))
    return JSON.parse(readFileSync(USERS_FILE, 'utf8')).users || []
  } catch { return [] }
}
function saveUsers(users) {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
    writeFileSync(USERS_FILE, JSON.stringify({ users }, null, 2))
  } catch (e) { console.error('[users] save error:', e.message) }
}

function appBaseUrl() {
  // REPLIT_DOMAINS is set in deployed (production) environments — use first entry
  if (process.env.REPLIT_DOMAINS) {
    const first = process.env.REPLIT_DOMAINS.split(',')[0].trim()
    return `https://${first}`
  }
  // REPLIT_DEV_DOMAIN is set in the dev workspace
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`
  }
  return `http://localhost:${process.env.PORT || 3000}`
}

// ── Email sender (Gmail SMTP primary, Resend fallback) ─────────────────────────
const GMAIL_USER = 'prabeshacharya@gmail.com'

function getGmailTransport() {
  const pass = process.env.GMAIL_APP_PASSWORD
  if (!pass) return null
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass },
  })
}

async function getResendClient() {
  if (process.env.RESEND_API_KEY) {
    return { client: new Resend(process.env.RESEND_API_KEY), fromEmail: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev' }
  }
  try {
    const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME
    const xReplitToken = process.env.REPL_IDENTITY ? 'repl ' + process.env.REPL_IDENTITY
      : process.env.WEB_REPL_RENEWAL ? 'depl ' + process.env.WEB_REPL_RENEWAL : null
    if (xReplitToken && hostname) {
      const data = await fetch(
        `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=resend`,
        { headers: { Accept: 'application/json', 'X-Replit-Token': xReplitToken } }
      ).then(r => r.json())
      const settings = data.items?.[0]?.settings
      if (settings?.api_key) return { client: new Resend(settings.api_key), fromEmail: settings.from_email }
    }
  } catch (e) { console.warn('[resend] Connector fetch failed:', e.message) }
  throw new Error('No Resend API key configured')
}

// Unified send: tries Gmail SMTP first, falls back to Resend
async function sendEmail({ to, subject, html, fromLabel = 'ATI Intelligence' }) {
  // --- Gmail SMTP ---
  const gmailTransport = getGmailTransport()
  if (gmailTransport) {
    try {
      const info = await gmailTransport.sendMail({
        from: `"${fromLabel}" <${GMAIL_USER}>`,
        to,
        subject,
        html,
      })
      console.log(`[email] ✓ Gmail SMTP → ${to} (${info.messageId})`)
      return
    } catch (e) {
      console.error('[email] Gmail SMTP failed:', e.message)
    }
  }
  // --- Resend fallback ---
  try {
    const { client: resend, fromEmail } = await getResendClient()
    const senderEmail = (fromEmail && !fromEmail.match(/@(gmail|yahoo|hotmail|outlook|icloud)\./i))
      ? fromEmail : 'onboarding@resend.dev'
    const result = await resend.emails.send({ from: `${fromLabel} <${senderEmail}>`, to, subject, html })
    if (result?.error) throw new Error(`Resend: ${result.error.message}`)
    console.log(`[email] ✓ Resend → ${to} (${result?.data?.id})`)
  } catch (e) {
    console.error('[email] Resend fallback failed:', e.message)
    throw e
  }
}

// ── RSS World News fetcher (no API key required) ───────────────────────────────
const RSS_SOURCES = [
  { name: 'Yahoo Finance',  url: 'https://finance.yahoo.com/rss/topstories' },
  { name: 'CNBC',           url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html' },
  { name: 'MarketWatch',    url: 'https://feeds.marketwatch.com/marketwatch/topstories/' },
  { name: 'BBC Business',   url: 'https://feeds.bbci.co.uk/news/business/rss.xml' },
  { name: 'Reuters',        url: 'https://feeds.reuters.com/reuters/businessNews' },
  { name: 'AP Business',    url: 'https://apnews.com/rss/apf-business' },
  { name: 'Google Finance', url: 'https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=en-US&gl=US&ceid=US:en' },
]
function _rssDecodeEntities(s) {
  return s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&apos;/g,"'").replace(/&nbsp;/g,' ').replace(/&#x([0-9a-fA-F]+);/g,(_,h)=>String.fromCodePoint(parseInt(h,16))).replace(/&#([0-9]+);/g,(_,d)=>String.fromCodePoint(parseInt(d,10))).replace(/<[^>]+>/g,'').trim()
}
function _rssGetTagText(xml, tag) {
  const start = xml.indexOf(`<${tag}`); if (start===-1) return ''
  const end = xml.indexOf('>',start); if (end===-1) return ''
  const closeStart = xml.indexOf(`</${tag}>`,end); if (closeStart===-1) return ''
  let inner = xml.slice(end+1,closeStart).trim()
  if (inner.startsWith('<![CDATA[')&&inner.endsWith(']]>')) inner=inner.slice(9,-3).trim()
  return _rssDecodeEntities(inner)
}
function _rssGetLink(block) {
  const h=block.match(/<link[^>]+href=["']([^"']+)["']/i); if(h) return h[1]
  const t=block.match(/<link[^>]*>([^<]+)<\/link>/i); if(t) return t[1].trim()
  const g=block.match(/<guid[^>]*>(https?:\/\/[^<]+)<\/guid>/i); if(g) return g[1].trim()
  return ''
}
function _rssSplitItems(xml) {
  const blocks=[]; let search=xml
  while(true) {
    const iS=search.indexOf('<item>'), eS=search.indexOf('<entry>')
    const useI=iS!==-1&&(eS===-1||iS<eS)
    const tag=useI?'item':'entry'; const start=useI?iS:eS
    if(start===-1) break
    const end=search.indexOf(`</${tag}>`,start); if(end===-1) break
    blocks.push(search.slice(start+tag.length+2,end))
    search=search.slice(end+tag.length+3)
  }
  return blocks
}
function _rssParseXml(xml, sourceName) {
  const items=[]
  for(const block of _rssSplitItems(xml)) {
    const title=_rssGetTagText(block,'title').slice(0,180)
    const link=_rssGetLink(block)
    const pub=_rssGetTagText(block,'pubDate')||_rssGetTagText(block,'published')||_rssGetTagText(block,'updated')||''
    if(title&&link) {
      items.push({ title, url: link.trim(), source: sourceName, published_at: pub ? (() => { try{return new Date(pub).toISOString()}catch{return new Date().toISOString()} })() : new Date().toISOString() })
    }
    if(items.length>=8) break
  }
  return items
}
let _newsCache = { ts: 0, items: [] }
async function fetchWorldNewsRss(limit=20) {
  if(Date.now()-_newsCache.ts < 15*60*1000 && _newsCache.items.length>0) return _newsCache.items.slice(0,limit)
  const results = await Promise.allSettled(RSS_SOURCES.map(async ({name,url}) => {
    const ctrl=new AbortController(); const timer=setTimeout(()=>ctrl.abort(),7000)
    try {
      const r=await fetch(url,{signal:ctrl.signal,headers:{'User-Agent':'ATI-NewsBot/1.0 (Advanced Trade Intelligence)'}})
      clearTimeout(timer); if(!r.ok) return []
      return _rssParseXml(await r.text(), name)
    } catch { clearTimeout(timer); return [] }
  }))
  const all=[]; for(const r of results) if(r.status==='fulfilled') all.push(...r.value)
  const seen=new Set(); const unique=[]
  for(const item of all) { const k=item.title.toLowerCase().slice(0,80); if(!seen.has(k)){seen.add(k);unique.push(item)} }
  unique.sort((a,b)=>new Date(b.published_at)-new Date(a.published_at))
  _newsCache={ts:Date.now(),items:unique}
  console.log(`[worldNews] Fetched ${unique.length} headlines from ${RSS_SOURCES.length} sources`)
  return unique.slice(0,limit)
}

// ── Morning briefing state ────────────────────────────────────────────────────
const briefingConfig = {
  sendTimeET: '07:00',   // HH:MM US/Eastern — fires every day at 7 AM ET
  enabled: true,
  lastSent: null,
  lastStatus: null,
  lastCount: 0,
}

// ── Email HTML template ────────────────────────────────────────────────────────
function buildEmailHTML({ date, marketData, aiText, topPicks, podcasts, worldNews = [] }) {
  const { indices = [], vix = 0, fearGreed = 50, sectors = [] } = marketData || {}
  const topSectors = [...sectors].sort((a, b) => b.change - a.change).slice(0, 3)
  const botSectors = [...sectors].sort((a, b) => a.change - b.change).slice(0, 2)
  const fgColor = fearGreed > 70 ? '#ff453a' : fearGreed > 55 ? '#ffd60a' : fearGreed > 40 ? '#30d158' : '#0a84ff'
  const fgLabel = fearGreed > 70 ? 'Greed' : fearGreed > 55 ? 'Mild Greed' : fearGreed > 40 ? 'Neutral' : 'Fear'

  // Compact index row
  const idxRow = (idx) => {
    const pct = idx.changePct ?? idx.change ?? 0
    const pctStr = isNaN(pct) ? '—' : `${pct >= 0 ? '+' : ''}${Number(pct).toFixed(2)}%`
    const pctColor = pct >= 0 ? '#30d158' : '#ff453a'
    return `<tr>
    <td style="padding:7px 12px;border-bottom:1px solid #2c2c2e;color:#ffffff;font-weight:700;font-size:13px">${idx.symbol}</td>
    <td style="padding:7px 12px;border-bottom:1px solid #2c2c2e;color:#8e8e93;font-size:12px">${idx.name}</td>
    <td style="padding:7px 12px;border-bottom:1px solid #2c2c2e;text-align:right;color:#ffffff;font-size:13px">$${(idx.price||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
    <td style="padding:7px 12px;border-bottom:1px solid #2c2c2e;text-align:right;font-weight:700;font-size:13px;color:${pctColor}">${pctStr}</td>
  </tr>`
  }

  // Compact pick row
  const pickRow = (p, rank) => {
    const sig = p.score100 >= 75 ? '⬆ Strong Buy' : p.score100 >= 60 ? '↗ Buy' : p.score100 >= 40 ? '→ Hold' : '↘ Caution'
    const sigColor = p.score100 >= 75 ? '#30d158' : p.score100 >= 60 ? '#0a84ff' : p.score100 >= 40 ? '#ffd60a' : '#ff453a'
    return `<tr>
      <td style="padding:10px 12px;border-bottom:1px solid #2c2c2e;color:#8e8e93;font-size:12px;text-align:center">#${rank}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #2c2c2e">
        <div style="color:#ffffff;font-weight:700;font-size:14px">${p.ticker}</div>
        <div style="color:#8e8e93;font-size:11px">${p.name}</div>
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #2c2c2e;text-align:right">
        <div style="color:#ffffff;font-size:13px">$${p.price}</div>
        <div style="color:${p.change >= 0 ? '#30d158' : '#ff453a'};font-size:12px">${p.change >= 0 ? '+' : ''}${p.change}%</div>
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #2c2c2e;text-align:center">
        <div style="color:#bf5af2;font-weight:700;font-size:16px">${p.score10}/10</div>
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #2c2c2e">
        <div style="color:${sigColor};font-weight:600;font-size:12px">${sig}</div>
        <div style="color:#8e8e93;font-size:11px">Stop $${(p.price*0.965).toFixed(2)} · T $${(p.price*1.085).toFixed(2)}</div>
      </td>
    </tr>`
  }

  // Render AI text — handles ###/##/#, **, bullets, numbered lists
  const aiLines = (aiText || '').split('\n').map(line => {
    line = line.trim(); if (!line) return '<div style="height:5px"></div>'
    const bold = s => s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*\*/g, '')
    if (/^###\s+/.test(line)) return `<p style="color:#ffffff;font-weight:700;font-size:13px;margin:14px 0 2px;border-left:2px solid #bf5af2;padding-left:8px">${bold(line.replace(/^###\s+/, ''))}</p>`
    if (/^##\s+/.test(line))  return `<p style="color:#ffffff;font-weight:800;font-size:14px;margin:16px 0 2px">${bold(line.replace(/^##\s+/, ''))}</p>`
    if (/^#\s+/.test(line))   return `<p style="color:#ffffff;font-weight:900;font-size:15px;margin:18px 0 4px">${bold(line.replace(/^#\s+/, ''))}</p>`
    if (line.startsWith('**') && line.endsWith('**')) return `<p style="color:#ffffff;font-weight:700;font-size:13px;margin:14px 0 2px;border-left:2px solid #bf5af2;padding-left:8px">${bold(line)}</p>`
    if (/^[-•]\s+/.test(line)) return `<p style="color:#d1d1d6;font-size:12px;line-height:1.6;margin:2px 0 4px;padding-left:12px">· ${bold(line.replace(/^[-•]\s+/, ''))}</p>`
    if (/^\d+\.\s+/.test(line)) return `<p style="color:#d1d1d6;font-size:12px;line-height:1.6;margin:2px 0 4px;padding-left:12px">${bold(line)}</p>`
    return `<p style="color:#d1d1d6;font-size:13px;line-height:1.6;margin:2px 0 6px">${bold(line)}</p>`
  }).join('')

  // Podcast listen buttons — always show section; show links if ready, otherwise "coming soon"
  const podcastSection = `
    <div style="background:#1a1a2e;border:1px solid #bf5af2;border-radius:14px;padding:16px;margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <span style="color:#ffffff;font-weight:700;font-size:15px">🎙️ Today's Podcasts</span>
        <span style="color:#bf5af2;font-size:11px;font-weight:700">ANDREW &amp; AVA · AI VOICES</span>
      </div>
      <table style="width:100%;border-collapse:collapse">
        <tr>
          <td style="padding:0 6px 0 0;width:50%">
            <div style="background:#2c2c2e;border-radius:10px;padding:12px">
              <div style="color:#ffffff;font-weight:700;font-size:13px">🌍 World News</div>
              <div style="color:#8e8e93;font-size:11px;margin:3px 0 10px">10 min · Global &amp; US news</div>
              ${podcasts?.worldNews
                ? `<a href="${appBaseUrl()}/podcasts/${podcasts.worldNews.file}" style="display:block;background:#0a84ff;color:#ffffff;text-decoration:none;padding:8px;border-radius:8px;font-weight:700;font-size:13px;text-align:center">▶ Listen Now</a>`
                : `<a href="${appBaseUrl()}/?page=briefing" style="display:block;background:#38383a;color:#8e8e93;text-decoration:none;padding:8px;border-radius:8px;font-size:12px;text-align:center">Generate on ATI →</a>`}
            </div>
          </td>
          <td style="padding:0 0 0 6px;width:50%">
            <div style="background:#2c2c2e;border-radius:10px;padding:12px">
              <div style="color:#ffffff;font-weight:700;font-size:13px">📈 Morning Edge</div>
              <div style="color:#8e8e93;font-size:11px;margin:3px 0 10px">5 min · Briefing + top picks</div>
              ${podcasts?.dailyBriefing
                ? `<a href="${appBaseUrl()}/podcasts/${podcasts.dailyBriefing.file}" style="display:block;background:#bf5af2;color:#ffffff;text-decoration:none;padding:8px;border-radius:8px;font-weight:700;font-size:13px;text-align:center">▶ Listen Now</a>`
                : `<a href="${appBaseUrl()}/?page=briefing" style="display:block;background:#38383a;color:#8e8e93;text-decoration:none;padding:8px;border-radius:8px;font-size:12px;text-align:center">Generate on ATI →</a>`}
            </div>
          </td>
        </tr>
      </table>
    </div>`

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#000000;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;">
<div style="max-width:640px;margin:0 auto;padding:20px 14px;">

  <!-- Header -->
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;padding:12px 16px;background:#1c1c1e;border:1px solid #38383a;border-radius:12px">
    <div>
      <span style="color:#818cf8;font-size:22px;font-weight:900;letter-spacing:-0.5px">ATI</span>
      <span style="color:#8e8e93;font-size:12px;margin-left:10px">${date}</span>
    </div>
    <a href="${appBaseUrl()}" style="background:#0a84ff;color:#ffffff;text-decoration:none;padding:7px 16px;border-radius:8px;font-weight:600;font-size:12px">Open App →</a>
  </div>

  <!-- PODCASTS — always at top -->
  ${podcastSection}

  <!-- Market Snapshot -->
  <div style="background:#1c1c1e;border:1px solid #38383a;border-radius:12px;overflow:hidden;margin-bottom:14px">
    <div style="padding:10px 14px;border-bottom:1px solid #38383a;display:flex;justify-content:space-between;align-items:center">
      <span style="color:#ffffff;font-weight:700;font-size:13px">📊 Market Snapshot</span>
      <span style="color:#30d158;font-size:11px;font-weight:700">● LIVE</span>
    </div>
    <table style="width:100%;border-collapse:collapse">
      <tbody>${indices.map(idxRow).join('')}</tbody>
    </table>
    <div style="display:flex;gap:8px;padding:10px 12px;border-top:1px solid #38383a">
      <div style="flex:1;background:#2c2c2e;border-radius:8px;padding:9px;text-align:center">
        <div style="color:#8e8e93;font-size:10px;font-weight:600">VIX</div>
        <div style="color:#ffffff;font-size:18px;font-weight:700">${vix}</div>
        <div style="color:#8e8e93;font-size:10px">${vix < 15 ? 'Low' : vix < 25 ? 'Mod' : 'High'}</div>
      </div>
      <div style="flex:2;background:#2c2c2e;border-radius:8px;padding:9px">
        <div style="color:#8e8e93;font-size:10px;font-weight:600;margin-bottom:5px">FEAR &amp; GREED</div>
        <div style="background:#38383a;border-radius:3px;height:6px;overflow:hidden;margin-bottom:4px">
          <div style="width:${fearGreed}%;background:${fgColor};height:100%;border-radius:3px"></div>
        </div>
        <span style="color:${fgColor};font-weight:700;font-size:14px">${fearGreed}/100 </span>
        <span style="color:${fgColor};font-size:11px">${fgLabel}</span>
      </div>
      <div style="flex:1;background:#2c2c2e;border-radius:8px;padding:9px">
        <div style="color:#8e8e93;font-size:10px;font-weight:600;margin-bottom:4px">SECTORS</div>
        ${topSectors.map(s => `<div style="color:#30d158;font-size:10px">▲ ${s.ticker ?? s.symbol ?? '?'} ${s.change != null ? (s.change >= 0 ? '+' : '') + Number(s.change).toFixed(2) + '%' : ''}</div>`).join('')}
        ${botSectors.map(s => `<div style="color:#ff453a;font-size:10px">▼ ${s.ticker ?? s.symbol ?? '?'} ${s.change != null ? Number(s.change).toFixed(2) + '%' : ''}</div>`).join('')}
      </div>
    </div>
  </div>

  <!-- AI Briefing (includes news + analysis) -->
  <div style="background:#1c1c1e;border:1px solid #38383a;border-radius:12px;margin-bottom:14px;overflow:hidden">
    <div style="padding:10px 14px;border-bottom:1px solid #38383a;display:flex;justify-content:space-between;align-items:center">
      <span style="color:#ffffff;font-weight:700;font-size:13px">🤖 AI Briefing</span>
      <span style="color:#bf5af2;font-size:10px;font-weight:700">GEMINI PRO</span>
    </div>
    <div style="padding:14px 16px">${aiLines}</div>
  </div>

  <!-- Top Picks -->
  <div style="background:#1c1c1e;border:1px solid #38383a;border-radius:12px;margin-bottom:14px;overflow:hidden">
    <div style="padding:10px 14px;border-bottom:1px solid #38383a;display:flex;justify-content:space-between;align-items:center">
      <span style="color:#ffffff;font-weight:700;font-size:13px">🏆 Top AI Picks</span>
      <a href="${appBaseUrl()}/?page=scorer" style="color:#30d158;font-size:11px;text-decoration:none;font-weight:600">View all →</a>
    </div>
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="background:#2c2c2e">
          <td style="padding:6px 12px;color:#8e8e93;font-size:10px;font-weight:700">#</td>
          <td style="padding:6px 12px;color:#8e8e93;font-size:10px;font-weight:700">TICKER</td>
          <td style="padding:6px 12px;color:#8e8e93;font-size:10px;font-weight:700;text-align:right">PRICE</td>
          <td style="padding:6px 12px;color:#8e8e93;font-size:10px;font-weight:700;text-align:center">SCORE</td>
          <td style="padding:6px 12px;color:#8e8e93;font-size:10px;font-weight:700">SIGNAL</td>
        </tr>
      </thead>
      <tbody>${topPicks.slice(0, 5).map((p, i) => pickRow(p, i + 1)).join('')}</tbody>
    </table>
  </div>

  <!-- World News Headlines -->
  ${worldNews.length ? `
  <div style="background:#1c1c1e;border:1px solid #38383a;border-radius:12px;margin-bottom:14px;overflow:hidden">
    <div style="padding:10px 14px;border-bottom:1px solid #38383a;display:flex;justify-content:space-between;align-items:center">
      <span style="color:#ffffff;font-weight:700;font-size:13px">🌍 Top World &amp; Market News</span>
      <span style="color:#6b7280;font-size:10px;font-weight:700">LIVE HEADLINES</span>
    </div>
    <table style="width:100%;border-collapse:collapse">
      ${worldNews.slice(0,20).map((n,i) => `<tr>
        <td style="padding:5px 10px;color:#555;font-size:11px;vertical-align:top;width:22px;border-bottom:1px solid #2c2c2e">${i+1}.</td>
        <td style="padding:5px 10px;border-bottom:1px solid #2c2c2e">
          <a href="${n.url||'#'}" style="color:#c7d2fe;font-size:12px;line-height:1.5;text-decoration:none;display:block">${n.title}</a>
          <span style="color:#555;font-size:10px;margin-top:2px;display:block">${n.source||'ATI'}</span>
        </td>
      </tr>`).join('')}
    </table>
  </div>` : ''}

  <!-- Footer -->
  <div style="text-align:center;padding:14px;color:#48484a;font-size:11px">
    <p style="margin:0 0 4px">ATI · Advanced Trade Intelligence · ${date}</p>
    <p style="margin:0">For educational purposes only · Not financial advice</p>
  </div>

</div>
</body>
</html>`
}

// ── Core briefing generator — sends to a list of recipients ───────────────────
async function generateAndSendBriefing(recipients) {
  const recipientList = Array.isArray(recipients) ? recipients : [recipients]
  const date = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/New_York' })
  const port = process.env.PORT || 3000
  console.log(`[briefing] Generating briefing for ${date} → ${recipientList.length} recipient(s)`)

  const [overviewRaw, sectorsRaw, topAssetsRaw] = await Promise.allSettled([
    fetch(`http://127.0.0.1:${port}/api/market/overview`).then(r => r.json()),
    fetch(`http://127.0.0.1:${port}/api/market/sectors`).then(r => r.json()),
    fetch(`http://127.0.0.1:${port}/api/market/top-assets`).then(r => r.json()),
  ])
  const overview  = overviewRaw.status  === 'fulfilled' ? overviewRaw.value  : {}
  const sectors   = sectorsRaw.status   === 'fulfilled' ? sectorsRaw.value   : []
  const topAssets = topAssetsRaw.status === 'fulfilled' ? topAssetsRaw.value : []

  const marketData = {
    indices: overview.indices || [],
    vix: overview.vix || 0,
    fearGreed: overview.fearGreed || 50,
    sectors,
  }
  const topPicks = [...topAssets].sort((a, b) => b.score100 - a.score100).slice(0, 5)

  const system = `You are ATI (Advanced Trade Intelligence), a senior market analyst writing a pre-market briefing for an active trader. Every word must earn its place. No fluff, no hedging, no generic statements. Be direct, specific, and actionable.`
  const user = `Morning briefing — ${date}

DATA:
Indices: ${marketData.indices.map(i => { const c = i.changePct ?? i.change ?? 0; return `${i.symbol} ${c >= 0 ? '+' : ''}${Number(c).toFixed(2)}%` }).join(' | ')}
VIX: ${marketData.vix} | Fear/Greed: ${marketData.fearGreed}/100
Sectors: ${sectors.slice(0, 5).map(s => { const c = s.change ?? 0; return `${s.ticker ?? s.symbol ?? s.name} ${c >= 0 ? '+' : ''}${Number(c).toFixed(2)}%` }).join(' | ')}
Top picks: ${topPicks.map(p => `${p.ticker} ${p.score100}/100`).join(', ')}

Write 6 punchy sections — 2-3 sentences each, max 300 words total:

**News** — The 3 most important news events RIGHT NOW that will move stock prices today. Name specific companies, data releases, or geopolitical events and their direct market impact.
**Tape** — One sentence on today's market character. What is the tape actually saying?
**Themes** — Three specific catalysts driving markets today. Named, with brief impact.
**Rotation** — What sectors/assets institutions are moving into or out of, and why.
**Best Setup** — Highest-conviction trade right now. Specific ticker, entry, stop, target.
**Verdict** — One sentence. The single most important thing before the open.`

  const aiText = await callGemini(system, user)

  // Fetch live world news headlines from RSS (runs in parallel with AI)
  const worldNews = await fetchWorldNewsRss(20).catch(() => [])

  // Generate today's podcasts if not already on disk
  const stamp     = new Date().toISOString().slice(0, 10)
  const newsFile  = `world-news-${stamp}.mp3`
  const briefFile = `daily-briefing-${stamp}.mp3`
  let podcasts = null
  const newsReady  = existsSync(join(PODCAST_DIR, newsFile))
  const briefReady = existsSync(join(PODCAST_DIR, briefFile))
  if (newsReady && briefReady) {
    console.log('[briefing] Using pre-generated podcasts for today')
    podcasts = {
      worldNews:     { file: newsFile,  title: `ATI World News · ${date}` },
      dailyBriefing: { file: briefFile, title: `ATI Morning Edge · ${date}` },
    }
  } else {
    console.log('[briefing] Podcasts not pre-built — sending email now, generating podcasts in background...')
    mkdirSync(PODCAST_DIR, { recursive: true })
    // Fire-and-forget: don't block the email send on TTS generation
    generatePodcasts({ marketData, aiText, topPicks, date }).then(results => {
      console.log('[briefing] Background podcast generation complete:', Object.keys(results).join(', '))
    }).catch(e => {
      console.warn('[briefing] Background podcast generation failed:', e.message)
    })
  }

  const html = buildEmailHTML({ date, marketData, aiText, topPicks, podcasts, worldNews })
  console.log(`[briefing] Sending to ${recipientList.join(', ')}`)

  const sendResults = await Promise.allSettled(
    recipientList.map(email =>
      sendEmail({ to: email, subject: `📊 ATI Morning Briefing · ${date}`, html, fromLabel: 'ATI Intelligence' })
    )
  )
  const sent = sendResults.filter(r => r.status === 'fulfilled').length
  const failed = sendResults.filter(r => r.status === 'rejected').length
  if (failed > 0) {
    sendResults.forEach((r, i) => {
      if (r.status === 'rejected') console.error(`[briefing] ✗ ${recipientList[i]}: ${r.reason?.message}`)
    })
  }

  // Clean up podcasts older than 2 days
  cleanOldPodcasts()

  console.log(`[briefing] Done: ${sent} sent, ${failed} failed`)
  return { success: true, date, sent, failed, total: recipientList.length }
}

// ── Scheduler: fires daily at configured time US/Eastern ──────────────────────
let schedulerTimer = null
function scheduleNextBriefing() {
  if (schedulerTimer) clearTimeout(schedulerTimer)
  if (!briefingConfig.enabled) return
  const [hh, mm] = briefingConfig.sendTimeET.split(':').map(Number)
  const etNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const target = new Date(etNow)
  target.setHours(hh, mm, 0, 0)
  if (etNow >= target) target.setDate(target.getDate() + 1)
  const msUntil = target - etNow
  console.log(`[briefing] Next send in ${Math.round(msUntil / 60000)} min (${briefingConfig.sendTimeET} ET daily)`)
  schedulerTimer = setTimeout(async () => {
    try {
      const subs = loadSubscribers()
      const emails = subs.map(s => s.email)
      if (!emails.length) { briefingConfig.lastStatus = '✗ No subscribers'; scheduleNextBriefing(); return }
      const result = await generateAndSendBriefing(emails)
      briefingConfig.lastSent = new Date().toISOString()
      briefingConfig.lastCount = result.sent
      briefingConfig.lastStatus = `✓ Sent to ${result.sent}/${result.total} at ${briefingConfig.sendTimeET} ET`
      console.log('[briefing] Scheduled send success:', result)
    } catch (e) {
      briefingConfig.lastStatus = `✗ Failed: ${e.message}`
      console.error('[briefing] Scheduled send error:', e.message)
    }
    scheduleNextBriefing()
  }, msUntil)
}

// Start scheduler on boot
scheduleNextBriefing()

// ── Podcast pre-generation scheduler: fires at 6:45 AM ET (15 min before briefing) ──
let podcastSchedulerTimer = null
function scheduleNextPodcastGeneration() {
  if (podcastSchedulerTimer) clearTimeout(podcastSchedulerTimer)
  const etNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const target = new Date(etNow)
  target.setHours(6, 45, 0, 0)
  if (etNow >= target) target.setDate(target.getDate() + 1)
  const msUntil = target - etNow
  console.log(`[podcast-sched] Next auto-generation in ${Math.round(msUntil / 60000)} min (06:45 ET daily)`)
  podcastSchedulerTimer = setTimeout(async () => {
    const date  = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/New_York' })
    const stamp = new Date().toISOString().slice(0, 10)
    const newsFile  = `world-news-${stamp}.mp3`
    const briefFile = `daily-briefing-${stamp}.mp3`

    // Skip if today's podcasts are already on disk
    if (existsSync(join(PODCAST_DIR, newsFile)) && existsSync(join(PODCAST_DIR, briefFile))) {
      console.log('[podcast-sched] Podcasts already generated for today — skipping')
      scheduleNextPodcastGeneration()
      return
    }

    console.log('[podcast-sched] Starting scheduled podcast generation for', date)
    try {
      const port = process.env.PORT || 3000
      const [overviewRaw, sectorsRaw, topAssetsRaw] = await Promise.allSettled([
        fetch(`http://127.0.0.1:${port}/api/market/overview`).then(r => r.json()),
        fetch(`http://127.0.0.1:${port}/api/market/sectors`).then(r => r.json()),
        fetch(`http://127.0.0.1:${port}/api/market/top-assets`).then(r => r.json()),
      ])
      const overview  = overviewRaw.status  === 'fulfilled' ? overviewRaw.value  : {}
      const sectors   = sectorsRaw.status   === 'fulfilled' ? sectorsRaw.value   : []
      const topAssets = topAssetsRaw.status === 'fulfilled' ? topAssetsRaw.value : []
      const marketData = { indices: overview.indices || [], vix: overview.vix || 0, fearGreed: overview.fearGreed || 50, sectors }
      const topPicks   = [...topAssets].sort((a, b) => (b.score100 || 0) - (a.score100 || 0)).slice(0, 5)

      // Get briefing text so the daily-briefing podcast can summarise it
      let aiText = null
      try {
        const bRes = await fetch(`http://127.0.0.1:${port}/api/market-briefing`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ marketData })
        })
        const bData = await bRes.json()
        aiText = bData.briefing || bData.text || null
      } catch (_) {}

      const result = await generatePodcasts({ marketData, aiText, topPicks, date })
      console.log('[podcast-sched] ✓ Scheduled generation complete:', Object.keys(result))
    } catch (e) {
      console.error('[podcast-sched] Scheduled generation failed:', e?.message || String(e))
    }
    scheduleNextPodcastGeneration()
  }, msUntil)
}
scheduleNextPodcastGeneration()

// ── Gemini AI ─────────────────────────────────────────────────────────────────
// Prefer Replit-managed integration key (managed quota + billing).
// The integration uses gemini-2.5-pro via its own base URL.
// If integration is absent, fall back to user's own API key with gemini-2.0-flash.
const INTEGRATION_KEY = process.env.AI_INTEGRATIONS_GEMINI_API_KEY
const INTEGRATION_URL = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL
const useIntegration   = !!(INTEGRATION_KEY && INTEGRATION_URL)
const MODEL = useIntegration ? 'gemini-2.5-pro' : 'gemini-2.0-flash'

function getAI() {
  if (useIntegration) {
    return new GoogleGenAI({
      apiKey: INTEGRATION_KEY,
      httpOptions: { apiVersion: '', baseUrl: INTEGRATION_URL },
    })
  }
  const userKey = process.env.GEMINI_API_KEY
  if (userKey) return new GoogleGenAI({ apiKey: userKey })
  throw new Error('No Gemini API key configured')
}

async function callGemini(systemPrompt, userPrompt, { retries = 4 } = {}) {
  let lastErr
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await getAI().models.generateContent({
        model: MODEL,
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        config: { systemInstruction: systemPrompt, maxOutputTokens: 8192 },
      })
      return response.text ?? ''
    } catch (e) {
      lastErr = e
      const msg = e?.message || String(e) || 'unknown error'
      const is429 = e?.status === 429 || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')
      if (is429 && attempt < retries) {
        const retryMsg = msg.match(/retryDelay.*?(\d+)s/)
        const waitSecs = retryMsg ? parseInt(retryMsg[1]) + 2 : (2 ** attempt) * 10
        console.warn(`[gemini] Rate limited, retrying in ${waitSecs}s (attempt ${attempt + 1}/${retries})`)
        await new Promise(r => setTimeout(r, waitSecs * 1000))
      } else {
        const errOut = e instanceof Error ? e.message : JSON.stringify(e)
        console.error(`[gemini] Call failed (attempt ${attempt + 1}):`, errOut)
        throw e instanceof Error ? e : new Error(errOut)
      }
    }
  }
  throw lastErr
}


const AI_DISCLAIMER = 'AI-generated · Not financial advice.'

function withAIDisclaimer(text = '') {
  const normalized = String(text || '').trim()
  if (!normalized) return AI_DISCLAIMER
  if (normalized.includes(AI_DISCLAIMER)) return normalized
  return `${normalized}

${AI_DISCLAIMER}`
}
async function callGeminiWithHistory(systemInstruction, messages) {
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))
  const response = await getAI().models.generateContent({
    model: MODEL,
    contents,
    config: { systemInstruction, maxOutputTokens: 8192 },
  })
  return response.text ?? ''
}

// ── Podcast generation ─────────────────────────────────────────────────────────
const PODCAST_DIR = join(__dirname, 'data', 'podcasts')
const ALEX_VOICE  = 'en-US-AndrewMultilingualNeural'
const SARAH_VOICE = 'en-US-AvaMultilingualNeural'

// ── Podcast cleanup: delete MP3 files older than 2 days ───────────────────────
function cleanOldPodcasts() {
  try {
    if (!existsSync(PODCAST_DIR)) return
    const cutoff = Date.now() - 2 * 24 * 60 * 60 * 1000
    const files = readdirSync(PODCAST_DIR).filter(f => f.endsWith('.mp3'))
    let removed = 0
    for (const f of files) {
      try {
        const fullPath = join(PODCAST_DIR, f)
        const { mtimeMs } = statSync(fullPath)
        if (mtimeMs < cutoff) { unlinkSync(fullPath); removed++ }
      } catch {}
    }
    if (removed > 0) console.log(`[podcast-cleanup] Removed ${removed} old podcast file(s)`)
  } catch (e) {
    console.warn('[podcast-cleanup] Error:', e.message)
  }
}

function parsePodcastScript(script) {
  const segments = []
  for (const raw of script.split('\n')) {
    const line = raw.trim()
    const m = line.match(/^(ANDREW|AVA|ALEX|SARAH):\s*(.+)/i)
    if (m && m[2].trim()) {
      const spk = m[1].toUpperCase()
      const gender = (spk === 'ANDREW' || spk === 'ALEX') ? 'MALE' : 'FEMALE'
      segments.push({ speaker: gender, text: m[2].trim() })
    }
  }
  return segments
}

async function segmentToMp3(text, voice, filePath, retries = 3) {
  let lastErr
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const tts = new EdgeTTS({ voice, lang: 'en-US', outputFormat: 'audio-24khz-96kbitrate-mono-mp3' })
      await tts.ttsPromise(text, filePath)
      return
    } catch (e) {
      lastErr = e
      if (attempt < retries - 1) await new Promise(r => setTimeout(r, 800 * (attempt + 1)))
    }
  }
  const msg = lastErr?.message || lastErr?.code || String(lastErr) || 'TTS failed'
  throw new Error(`TTS failed after ${retries} attempts: ${msg}`)
}

async function assemblePodcast(segments, outputPath, onProgress) {
  const tmp  = tmpdir()
  const uid  = `${process.pid}_${Date.now()}`
  const segFiles = segments.map((_, i) => join(tmp, `apex_seg_${uid}_${i}.mp3`))

  // Parallel batches of 8 — reduces 56-seg run from ~170s to ~25s
  const BATCH = 8
  let done = 0
  for (let b = 0; b < segments.length; b += BATCH) {
    const slice = segments.slice(b, b + BATCH)
    await Promise.all(slice.map(async (seg, j) => {
      const idx   = b + j
      const voice = seg.speaker === 'MALE' ? ALEX_VOICE : SARAH_VOICE
      await segmentToMp3(seg.text, voice, segFiles[idx])
      done++
      if (onProgress) onProgress(done, segments.length)
    }))
  }

  const listFile = join(tmp, `apex_concat_${uid}.txt`)
  writeFileSync(listFile, segFiles.map(f => `file '${f}'`).join('\n'))
  await execAsync(`ffmpeg -y -f concat -safe 0 -i "${listFile}" -c copy "${outputPath}"`)
  await Promise.allSettled([...segFiles.map(f => fsp.unlink(f)), fsp.unlink(listFile)])
}

async function generatePodcastScript(type, { marketData, aiText, topPicks, date }) {
  const { indices = [], vix = 0, fearGreed = 50, sectors = [] } = marketData || {}
  const idxStr = indices.map(i => { const c = i.changePct ?? i.change ?? 0; return `${i.symbol} ${c >= 0 ? '+' : ''}${Number(c).toFixed(2)}%` }).join(', ')

  const FORMAT_INST = `Format ONLY as clean alternating dialogue — no stage directions, no scene headings, no asterisks, no markdown, no sound effects:
ANDREW: [spoken text]
AVA: [spoken text]
Each line is one or two natural spoken sentences. Speak the way real people talk — contractions, rhythm, energy.`

  if (type === 'world-news') {
    const sys = `You are scripting ATI Daily Briefing, a polished morning news show. ANDREW is a seasoned male news anchor — confident, clear, well-informed on everything from geopolitics to tech to health. AVA is a sharp female correspondent — insightful, adds context, asks the questions listeners are thinking. They have a warm, natural chemistry and move briskly through topics. This is a broad world and US news show, NOT just a finance show. Plain spoken English only — no financial jargon. ${FORMAT_INST}
Aim for ~1600 words total (≈10 minutes at 160 wpm).`
    const usr = `Write today's ATI World News podcast for ${date}.

Market context (mention briefly only if newsworthy): Indices: ${idxStr} | VIX: ${vix} | Fear & Greed: ${fearGreed}/100

Cover these topics naturally across the 10 minutes — dedicate roughly equal time to each major story:
1. Opener — a crisp 30-second headline round-up of the biggest stories of the day
2. Top US domestic news story — politics, policy, major domestic event
3. Top international / geopolitical story — wars, diplomacy, global tensions
4. Technology & AI — the most significant tech news or breakthrough today
5. Economy & business — notable company news, earnings, economic data, jobs
6. Science, health, or environment — a story that matters to people's lives
7. Markets & finance (brief) — what's moving and why, in plain English
8. Closing — one story to keep watching, and a forward look at the day

Sound like a trusted morning radio show that smart, busy people rely on to start their day.`
    return callGemini(sys, usr)
  }

  if (type === 'daily-briefing') {
    const topStr = Array.isArray(topPicks) && topPicks.length
      ? topPicks.slice(0, 5).map((p, i) => `${i + 1}. ${p.symbol} (${p.name}) — Score ${p.score100}/100 — Signal: ${p.signal}`).join('\n')
      : 'Top picks not available.'
    const sys = `You are scripting ATI Morning Edge, a punchy 5-minute briefing podcast. ANDREW is a male host — direct, focused, gives traders exactly what they need to act. AVA is a female co-host — adds sharp context, asks the key question on every pick. They move fast, no wasted words. This is a distillation of the morning newsletter into spoken form. Plain spoken English only. ${FORMAT_INST}
Aim for ~750 words total (≈5 minutes at 150 wpm). Be tight and actionable.`
    const usr = `Write today's ATI Morning Edge briefing podcast for ${date}.

Live market context: ${idxStr} | VIX: ${vix} | Fear & Greed: ${fearGreed}/100

TODAY'S MORNING BRIEFING (summarise the key points):
${aiText ? aiText.slice(0, 2000) : 'Cover key market conditions for the day.'}

TODAY'S TOP PICKS TO FOCUS ON:
${topStr}

Structure (5 minutes, move fast):
1. Opening — 2 sentences: the single most important thing happening in markets today
2. Briefing highlights — the 3 key takeaways from today's morning newsletter
3. Top picks deep-dive — walk through each of the top picks: what the score means, why the signal is there, what to watch
4. One risk to keep front of mind today
5. Closing — one sentence send-off that fires up the listener

Sound like the smartest friend a trader has — the one who read everything so they don't have to.`
    return callGemini(sys, usr)
  }

  throw new Error(`Unknown podcast type: ${type}`)
}

async function generatePodcasts({ marketData, aiText, topPicks, date }) {
  mkdirSync(PODCAST_DIR, { recursive: true })
  const stamp = new Date().toISOString().slice(0, 10)
  const results = {}

  console.log('[podcast] Generating World News script...')
  const newsScript  = await generatePodcastScript('world-news', { marketData, aiText, topPicks, date })
  const newsFile    = `world-news-${stamp}.mp3`
  const newsPath    = join(PODCAST_DIR, newsFile)
  await assemblePodcast(parsePodcastScript(newsScript), newsPath)
  results.worldNews = { file: newsFile, title: `ATI World News · ${date}` }
  console.log('[podcast] ✓ World News ready:', newsFile)

  console.log('[podcast] Generating Daily Briefing script...')
  const briefScript = await generatePodcastScript('daily-briefing', { marketData, aiText, topPicks, date })
  const briefFile   = `daily-briefing-${stamp}.mp3`
  const briefPath   = join(PODCAST_DIR, briefFile)
  await assemblePodcast(parsePodcastScript(briefScript), briefPath)
  results.dailyBriefing = { file: briefFile, title: `ATI Morning Edge · ${date}` }
  console.log('[podcast] ✓ Daily Briefing ready:', briefFile)

  // Cleanup handled by cleanOldPodcasts (2-day retention)

  return results
}

// ── Scoring helpers ────────────────────────────────────────────────────────────
function normalize(val, min, max) {
  return Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100))
}

function scoreFromQuote(q) {
  const changeP = q.regularMarketChangePercent ?? 0
  const vol     = q.regularMarketVolume ?? 0
  const avgVol  = q.averageDailyVolume3Month || q.averageDailyVolume10Day || vol || 1
  const price   = q.regularMarketPrice ?? 0
  const ma50    = q.fiftyDayAverage ?? price
  const ma200   = q.twoHundredDayAverage ?? price
  const target  = q.targetMeanPrice ?? price
  const pe      = q.trailingPE ?? 25
  const week52H = q.fiftyTwoWeekHigh ?? price
  const week52L = q.fiftyTwoWeekLow ?? 0

  const momentum    = normalize(changeP, -5, 5)                        // daily change -5% → +5%
  const volumeScore = normalize((vol / avgVol) * 50, 0, 100)           // vol ratio
  const technical   = normalize(((price - ma50) / (ma50 || 1)) * 100 + 50, 0, 100)  // above/below MA50
  const sentiment   = normalize(((target - price) / (price || 1)) * 100 + 50, 0, 100) // upside to target
  const fundamentals = normalize(100 - pe, -50, 80)                   // lower PE better
  const newsScore   = normalize((week52H - week52L) > 0
    ? ((price - week52L) / (week52H - week52L)) * 100 : 50, 0, 100)  // 52-week position

  const weights = { momentum: 0.25, volume: 0.15, technical: 0.20, sentiment: 0.20, fundamentals: 0.10, news: 0.10 }
  const scores  = { momentum, volume: volumeScore, technical, sentiment, fundamentals, news: newsScore }
  const total   = Object.entries(weights).reduce((s, [k, w]) => s + scores[k] * w, 0)

  return { score100: +total.toFixed(1), dimensions: Object.fromEntries(Object.entries(scores).map(([k,v]) => [k, +v.toFixed(1)])) }
}

// ── Market data endpoints ──────────────────────────────────────────────────────

const INDEX_TICKERS = ['^GSPC', '^IXIC', '^DJI']
const INDEX_NAMES   = { '^GSPC': 'S&P 500', '^IXIC': 'NASDAQ', '^DJI': 'DOW' }
const INDEX_SYMBOLS = { '^GSPC': 'SPX', '^IXIC': 'NDX', '^DJI': 'DJI' }

const SECTOR_TICKERS = ['XLK','XLV','XLF','XLE','XLY','XLP','XLI','XLC','XLU','XLRE','XLB']
const SECTOR_NAMES   = { XLK:'Technology',XLV:'Healthcare',XLF:'Financials',XLE:'Energy',
  XLY:'Consumer Discretionary',XLP:'Consumer Staples',XLI:'Industrials',
  XLC:'Communication Services',XLU:'Utilities',XLRE:'Real Estate',XLB:'Materials' }
const SECTOR_WEIGHTS = { XLK:31,XLV:12,XLF:13,XLE:4,XLY:10,XLP:6,XLI:8,XLC:9,XLU:3,XLRE:2,XLB:2 }

const TOP_TICKERS = ['NVDA','MSFT','AAPL','AMD','TSLA','META','SPY','QQQ','AMZN','GOOGL','AVGO','PLTR','NFLX','JPM','XLE','IWM','DIA','MU','TSM','COIN']
const TICKER_TYPES = { SPY:'ETF',QQQ:'ETF',XLE:'ETF',IWM:'ETF',DIA:'ETF' }
const TICKER_SECTOR = {
  NVDA:'Technology',MSFT:'Technology',AAPL:'Technology',AMD:'Technology',META:'Technology',
  AVGO:'Technology',MU:'Technology',TSM:'Technology',PLTR:'Technology',
  TSLA:'Consumer Discretionary',AMZN:'Consumer Discretionary',
  GOOGL:'Communication Services',NFLX:'Communication Services',
  JPM:'Financials',COIN:'Financials',
  SPY:'ETF',QQQ:'ETF',XLE:'ETF',IWM:'ETF',DIA:'ETF',
}

async function fetchQuotes(tickers) {
  const results = await Promise.allSettled(
    tickers.map(t => yahooFinance.quote(t))
  )
  return results.map((r, i) => r.status === 'fulfilled' ? r.value : { symbol: tickers[i] })
}

// GET /api/market/overview
app.get('/api/market/overview', async (_req, res) => {
  try {
    const data = await cached('overview', 5 * 60 * 1000, async () => {
      const [indexQuotes, vixQuote] = await Promise.all([
        fetchQuotes(INDEX_TICKERS),
        yahooFinance.quote('^VIX').catch(() => null),
      ])

      const indices = indexQuotes.map(q => ({
        name: INDEX_NAMES[q.symbol] ?? q.symbol,
        symbol: INDEX_SYMBOLS[q.symbol] ?? q.symbol,
        price: +(q.regularMarketPrice ?? 0).toFixed(2),
        change: +(q.regularMarketChangePercent ?? 0).toFixed(2),
      }))

      const vix = +(vixQuote?.regularMarketPrice ?? 20).toFixed(2)

      // Fear & Greed: approximate from VIX (inverse relationship)
      // VIX < 12 → extreme greed (90+), VIX > 40 → extreme fear (<10)
      const fearGreed = Math.max(2, Math.min(98, Math.round(normalize(vix, 10, 45) * -1 + 100)))

      const session = indexQuotes[0]?.marketState ?? 'REGULAR'
      const sessionLabel = session === 'PRE' ? 'Pre-Market'
        : session === 'POST' || session === 'POSTPOST' ? 'After Hours'
        : session === 'CLOSED' ? 'Market Closed'
        : 'Market Open'

      return { indices, vix, fearGreed, session: sessionLabel, updatedAt: new Date().toISOString() }
    })
    res.json(data)
  } catch (e) {
    console.error('overview error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

// GET /api/market/sectors
app.get('/api/market/sectors', async (_req, res) => {
  try {
    const data = await cached('sectors', 5 * 60 * 1000, async () => {
      const quotes = await fetchQuotes(SECTOR_TICKERS)
      return quotes.map(q => ({
        name: SECTOR_NAMES[q.symbol] ?? q.symbol,
        ticker: q.symbol,
        change: +(q.regularMarketChangePercent ?? 0).toFixed(2),
        price: +(q.regularMarketPrice ?? 0).toFixed(2),
        weight: SECTOR_WEIGHTS[q.symbol] ?? 0,
      })).sort((a, b) => b.change - a.change)
    })
    res.json(data)
  } catch (e) {
    console.error('sectors error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

// GET /api/market/top-assets
app.get('/api/market/top-assets', async (_req, res) => {
  try {
    const data = await cached('top-assets', 5 * 60 * 1000, async () => {
      const quotes = await fetchQuotes(TOP_TICKERS)
      const assets = quotes
        .filter(q => q.regularMarketPrice)
        .map(q => {
          const { score100, dimensions } = scoreFromQuote(q)
          const type = TICKER_TYPES[q.symbol] ?? 'Stock'
          const volRatio = q.averageDailyVolume3Month
            ? +((q.regularMarketVolume ?? 0) / q.averageDailyVolume3Month).toFixed(2)
            : 1
          return {
            ticker: q.symbol,
            name: (q.shortName ?? q.longName ?? q.symbol).replace(/ Inc\.?$/, '').replace(/ Corp\.?$/, ''),
            type,
            sector: TICKER_SECTOR[q.symbol] ?? 'Mixed',
            price: +(q.regularMarketPrice ?? 0).toFixed(2),
            change: +(q.regularMarketChangePercent ?? 0).toFixed(2),
            volX: Math.max(0.1, volRatio),
            score100,
            score10: +(score100 / 10).toFixed(1),
            dimensions,
          }
        })
        .sort((a, b) => b.score100 - a.score100)
      return assets
    })
    res.json(data)
  } catch (e) {
    console.error('top-assets error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

// GET /api/market/earnings
app.get('/api/market/earnings', async (_req, res) => {
  try {
    const data = await cached('earnings', 30 * 60 * 1000, async () => {
      const tickers = ['NVDA','AMD','MSFT','AMZN','AAPL','META','GOOGL','TSLA']
      const quotes = await fetchQuotes(tickers)
      return quotes.filter(q => q.regularMarketPrice).map(q => {
        const { score100 } = scoreFromQuote(q)
        return {
          ticker: q.symbol,
          name: (q.shortName ?? q.symbol),
          price: +(q.regularMarketPrice ?? 0).toFixed(2),
          change: +(q.regularMarketChangePercent ?? 0).toFixed(2),
          score: +(score100 / 10).toFixed(1),
          when: 'TBD',
          eps: 'TBD',
          date: 'upcoming',
        }
      })
    })
    res.json(data)
  } catch (e) {
    console.error('earnings error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

// ── AI endpoints ───────────────────────────────────────────────────────────────
app.post('/api/market-briefing', async (req, res) => {
  try {
    const { indices, sectors, vix, fearGreed } = req.body ?? {}
    const context = indices
      ? `\nLive market data:\n- Indices: ${JSON.stringify(indices)}\n- VIX: ${vix}\n- Fear & Greed Index: ${fearGreed}/100\n- Top sectors by performance: ${JSON.stringify(sectors?.slice(0, 5))}`
      : ''
    const system = `You are ATI (Advanced Trade Intelligence), a senior financial market analyst and trading strategist with deep expertise in equities, macro, and technical analysis. You provide institutional-quality market intelligence to professional traders. Your briefings are fact-driven, precise, and immediately actionable. You identify non-obvious patterns, sector rotation signals, and risk/reward asymmetries. You do not give generic advice — every insight is specific and tied to current conditions.`
    const user = `Generate a comprehensive AI market briefing for ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.${context}

Structure your briefing as follows:
1. **Market Tone** — Describe the overall character of today's tape (trending, choppy, rotational, risk-on/off) and why.
2. **Key Themes** — 3 specific market themes or narratives driving price action right now.
3. **Sector Rotation** — Which sectors are leading/lagging and what it signals about institutional positioning.
4. **Setups to Watch** — 2 specific trade setups (with general entry logic, key levels, and catalyst) worth monitoring.
5. **Key Risks** — 2-3 specific risks that could derail the current trend (macro, geopolitical, technical).
6. **One Contrarian View** — A non-consensus perspective worth considering.

Be direct, specific, and data-driven. Max 400 words. No generic disclaimers.`
    const text = withAIDisclaimer(await callGemini(system, user))
    res.json({ text, disclaimer: AI_DISCLAIMER })
  } catch (e) {
    console.error('market-briefing error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/earnings-analysis', async (req, res) => {
  try {
    const { ticker, eps, date, price, change, score } = req.body
    const system = `You are ATI, an expert earnings analyst and options strategist. You provide deep pre-earnings intelligence combining fundamental analysis, historical patterns, options market signals, and trade structure recommendations. Your analysis helps traders position intelligently around earnings events.`
    const user = `Deep pre-earnings analysis for ${ticker || 'NVDA'}.
Current data: Price $${price || 'unknown'} (${change || 0}% today), Earnings: ${date || 'upcoming'}, EPS consensus: ${eps || 'TBD'}, ATI score: ${score || '7'}/10.

Provide:
1. **Historical Beat/Miss Pattern** — How has this stock historically performed vs. EPS estimates? What % of the time does it beat?
2. **Implied Move** — Estimate the options-implied expected move for earnings (typical range based on history).
3. **Bull Case** — What would need to happen for a strong post-earnings rally? Key metrics to beat.
4. **Bear Case** — What could cause a selloff even on an EPS beat? (guidance cut, margin pressure, valuation, etc.)
5. **Options Strategy** — One specific options structure suited to the current setup (straddle, iron condor, etc.) with rationale.
6. **Trade Plan** — Recommended approach: pre-earnings position, size relative to normal, key levels to watch.

Be specific and actionable. Max 300 words.`
    const text = withAIDisclaimer(await callGemini(system, user))
    res.json({ text, disclaimer: AI_DISCLAIMER })
  } catch (e) {
    console.error('earnings-analysis error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body
    const systemInstruction = `You are ATI — a world-class financial trading assistant powered by Gemini Pro. You combine the expertise of a hedge fund analyst, technical strategist, and risk manager. You help traders with:

- Deep market analysis and stock research
- Technical analysis (support/resistance, patterns, momentum, volume analysis)
- Fundamental analysis (valuations, earnings quality, sector dynamics)
- Trade setup construction (entry, stop, target, position sizing)
- Risk management and portfolio thinking
- Macro and sector rotation analysis
- Options strategies and flow interpretation
- Real-time market commentary

Your style: Direct, specific, data-driven. You give concrete levels, not vague guidance. You acknowledge uncertainty honestly. You think in terms of risk/reward and probability.

Today's date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.

Important: Your analysis is for educational purposes. Always encourage proper risk management. Do not recommend specific position sizes in dollars — express risk as % of account.`
    const reply = withAIDisclaimer(await callGeminiWithHistory(systemInstruction, messages || []))
    res.json({ reply, disclaimer: AI_DISCLAIMER })
  } catch (e) {
    console.error('chat error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/scorer-insight', async (req, res) => {
  try {
    const { ticker, score, dimensions, price, change } = req.body
    const system = `You are ATI, a senior quantitative equity analyst. You interpret multi-dimensional AI scores for stocks and translate them into actionable trading intelligence. You are direct, precise, and identify the most important signal in the data.`
    const user = `Analyze ${ticker}: Price $${price} (${change > 0 ? '+' : ''}${change}% today), ATI Score: ${score}/100.

Dimension breakdown: ${Object.entries(dimensions || {}).map(([k, v]) => `${k}: ${Math.round(v)}/100`).join(', ')}.

Provide:
1. **Key Signal** — What is the single most important insight from these scores? What is the market telling us about this stock right now?
2. **Strongest Dimension** — Which dimension stands out and what does it imply for the trade?
3. **Watch Level** — One specific price level or condition to watch as confirmation or invalidation.
4. **Risk Factor** — The biggest risk given the current score profile.

Keep it under 120 words. Be specific — name levels, patterns, or conditions. No generic statements.`
    const text = withAIDisclaimer(await callGemini(system, user))
    res.json({ text, disclaimer: AI_DISCLAIMER })
  } catch (e) {
    console.error('scorer-insight error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

// ── Deep Research endpoint (new — uses full Gemini Pro capacity) ───────────────
app.post('/api/research', async (req, res) => {
  try {
    const { ticker, question } = req.body
    const system = `You are ATI Research — a senior equity research analyst with expertise across fundamental analysis, technical analysis, competitive landscape, and macro factors. You write institutional-quality research notes. You are thorough, balanced, and cite specific data points and reasoning. You cover bull and bear cases honestly.`
    const user = ticker
      ? `Write a comprehensive research analysis for ${ticker}.

Include:
1. **Business Overview** — What does this company do? Key revenue drivers and business model.
2. **Competitive Position** — Market share, moat, key competitors, and differentiation.
3. **Financial Health** — Revenue growth trend, margins, balance sheet strength, cash flow.
4. **Technical Picture** — Current trend, key support/resistance levels, momentum.
5. **Bull Case** — Top 3 reasons to be long with specific catalysts and price targets.
6. **Bear Case** — Top 3 risks with specific triggers that would invalidate the bull thesis.
7. **Valuation** — Is the stock cheap, fair, or expensive vs. peers and history?
8. **Verdict** — Your overall assessment and suggested approach for a trader.

Be thorough, data-driven, and specific. Aim for ~500 words.`
      : `Answer this market research question with institutional-quality depth:\n\n${question || 'Provide a general market outlook.'}\n\nBe thorough, cite specific examples, and provide actionable conclusions.`
    const text = withAIDisclaimer(await callGemini(system, user))
    res.json({ text, disclaimer: AI_DISCLAIMER })
  } catch (e) {
    console.error('research error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

// ── Auth endpoints (public) ────────────────────────────────────────────────────
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {}
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' })

  // Admin shortcut: admin email + APEX_PASSWORD env var
  if (email.toLowerCase() === ADMIN_EMAIL.toLowerCase() && password === APEX_PASSWORD) {
    const token = jwt.sign({ email: ADMIN_EMAIL, name: 'Admin', role: 'admin' }, JWT_SECRET, { expiresIn: '30d' })
    return res.json({ token, name: 'Admin' })
  }

  // Regular user: look up in users file
  const users = loadUsers()
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase())
  if (!user) return res.status(401).json({ error: 'No account found with this email. Please request access first.' })
  if (user.status === 'pending') return res.status(403).json({ error: 'Your account is pending approval. You\'ll receive an email once approved.' })
  if (user.status !== 'approved') return res.status(403).json({ error: 'Account not approved.' })
  if (!verifyPassword(password, user.passwordHash, user.salt)) {
    return res.status(401).json({ error: 'Incorrect password.' })
  }
  const token = jwt.sign({ email: user.email, name: user.name, role: 'user' }, JWT_SECRET, { expiresIn: '30d' })
  res.json({ token, name: user.name })
})

app.post('/api/auth/signup', async (req, res) => {
  const { name, email, password } = req.body || {}
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password required' })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Invalid email address' })
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' })

  // Admin cannot sign up (they use the env password)
  if (email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
    return res.status(409).json({ error: 'This email is reserved for admin access.' })
  }

  const users = loadUsers()
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    const existing = users.find(u => u.email.toLowerCase() === email.toLowerCase())
    if (existing.status === 'pending') return res.status(409).json({ error: 'A request from this email is already pending approval.' })
    if (existing.status === 'approved') return res.status(409).json({ error: 'An account with this email already exists. Please sign in.' })
  }

  const { hash, salt } = hashPassword(password)
  const approvalToken = crypto.randomBytes(32).toString('hex')
  const newUser = {
    id: crypto.randomUUID(),
    name: name.trim(),
    email: email.toLowerCase().trim(),
    passwordHash: hash,
    salt,
    status: 'pending',
    approvalToken,
    createdAt: new Date().toISOString(),
    approvedAt: null,
  }
  users.push(newUser)
  saveUsers(users)

  // Send approval request email to admin
  try {
    const approveUrl = `${appBaseUrl()}/api/auth/approve?token=${approvalToken}`
    const rejectUrl  = `${appBaseUrl()}/api/auth/reject?token=${approvalToken}`
    await sendEmail({
      to: ADMIN_EMAIL,
      subject: `🔐 ATI Access Request — ${name}`,
      html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#000;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
    <div style="text-align:center;margin-bottom:28px">
      <div style="display:inline-block;background:linear-gradient(135deg,#0a84ff,#bf5af2);border-radius:16px;width:52px;height:52px;line-height:52px;text-align:center;font-size:22px;font-weight:700;color:#fff;margin-bottom:12px">A</div>
      <h1 style="color:#ffffff;font-size:22px;font-weight:700;margin:0">New Access Request</h1>
      <p style="color:#8e8e93;font-size:14px;margin:4px 0 0">Someone wants to join ATI</p>
    </div>
    <div style="background:#1c1c1e;border:1px solid #38383a;border-radius:16px;padding:24px;margin-bottom:20px">
      <table style="width:100%">
        <tr><td style="color:#8e8e93;font-size:13px;padding:6px 0">Name</td><td style="color:#ffffff;font-size:13px;font-weight:600;text-align:right">${name}</td></tr>
        <tr><td style="color:#8e8e93;font-size:13px;padding:6px 0">Email</td><td style="color:#ffffff;font-size:13px;font-weight:600;text-align:right">${email}</td></tr>
        <tr><td style="color:#8e8e93;font-size:13px;padding:6px 0">Requested</td><td style="color:#ffffff;font-size:13px;text-align:right">${new Date().toLocaleString('en-US',{timeZone:'America/New_York'})} ET</td></tr>
      </table>
    </div>
    <div style="display:flex;gap:12px;margin-bottom:20px">
      <a href="${approveUrl}" style="flex:2;display:block;background:#30d158;color:#000000;text-decoration:none;padding:14px 0;border-radius:12px;font-weight:700;font-size:15px;text-align:center">✓ Approve Access</a>
      <a href="${rejectUrl}"  style="flex:1;display:block;background:#2c2c2e;color:#ff453a;text-decoration:none;padding:14px 0;border-radius:12px;font-weight:600;font-size:15px;text-align:center;border:1px solid #38383a">✕ Reject</a>
    </div>
    <p style="color:#48484a;font-size:12px;text-align:center">ATI · Advanced Trade Intelligence</p>
  </div>
</body></html>`,
    })
    console.log(`[auth] Approval email sent to ${ADMIN_EMAIL} for ${email}`)
  } catch (e) {
    console.error('[auth] Failed to send approval email:', e.message)
  }

  res.json({ success: true, message: 'Request submitted. You\'ll receive an email once your access is approved.' })
})

app.get('/api/auth/approve', async (req, res) => {
  const { token } = req.query
  const users = loadUsers()
  const user = users.find(u => u.approvalToken === token)

  const page = (ok, title, body, color) => `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · ATI</title></head>
<body style="margin:0;padding:0;background:#000;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;">
  <div style="max-width:400px;width:100%;padding:32px 24px;text-align:center">
    <div style="display:inline-block;background:linear-gradient(135deg,#0a84ff,#bf5af2);border-radius:16px;width:56px;height:56px;line-height:56px;font-size:24px;font-weight:700;color:#fff;margin-bottom:16px">A</div>
    <div style="font-size:40px;margin-bottom:12px">${ok ? '✅' : '❌'}</div>
    <h1 style="color:#ffffff;font-size:22px;font-weight:700;margin:0 0 8px">${title}</h1>
    <p style="color:#8e8e93;font-size:15px;line-height:1.6;margin:0 0 24px">${body}</p>
    <a href="${appBaseUrl()}" style="display:inline-block;background:${color};color:${ok?'#000':'#fff'};text-decoration:none;padding:12px 28px;border-radius:12px;font-weight:600;font-size:14px">Open ATI</a>
  </div>
</body></html>`

  if (!user) {
    return res.set('Content-Type', 'text/html').send(page(false, 'Invalid Link', 'This approval link is invalid or has already been used.', '#2c2c2e'))
  }
  if (user.status === 'approved') {
    return res.set('Content-Type', 'text/html').send(page(true, 'Already Approved', `${user.name} (${user.email}) is already approved and can access ATI.`, '#30d158'))
  }

  // Approve the user
  user.status = 'approved'
  user.approvedAt = new Date().toISOString()
  user.approvalToken = null
  saveUsers(users)
  console.log(`[auth] Approved user: ${user.email}`)

  // Send welcome email to the approved user
  try {
    await sendEmail({
      to: user.email,
      subject: `🎉 Welcome to ATI — Your Access is Approved`,
      html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#000;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:40px 24px;text-align:center">
    <div style="display:inline-block;background:linear-gradient(135deg,#0a84ff,#bf5af2);border-radius:16px;width:56px;height:56px;line-height:56px;font-size:24px;font-weight:700;color:#fff;margin-bottom:16px">A</div>
    <h1 style="color:#ffffff;font-size:26px;font-weight:700;margin:0 0 8px">You're in, ${user.name}!</h1>
    <p style="color:#8e8e93;font-size:15px;line-height:1.7;margin:0 0 28px">Your access to <strong style="color:#fff">ATI Market Intelligence</strong> has been approved. Sign in with the email and password you used during signup.</p>
    <a href="${appBaseUrl()}" style="display:inline-block;background:linear-gradient(135deg,#0a84ff,#0070e0);color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:12px;font-weight:700;font-size:15px;margin-bottom:32px">Open ATI →</a>
    <div style="background:#1c1c1e;border:1px solid #38383a;border-radius:14px;padding:20px;text-align:left;margin-top:8px">
      <p style="color:#8e8e93;font-size:12px;margin:0 0 10px;font-weight:600;text-transform:uppercase;letter-spacing:1px">What you get access to</p>
      ${['📊 Live market dashboard & sector heat map','🤖 Gemini Pro AI Chat & Deep Research','🏆 AI Scorer — ranked picks with signals','📧 Daily 7 AM morning briefing (email)','⚡ Trade Planner, Alerts & Trade Journal'].map(f=>`<p style="color:#ebebf5;font-size:13px;margin:6px 0">${f}</p>`).join('')}
    </div>
    <p style="color:#48484a;font-size:12px;margin-top:24px">ATI · Advanced Trade Intelligence · Not financial advice</p>
  </div>
</body></html>`,
    })
  } catch (e) {
    console.error('[auth] Failed to send welcome email:', e.message)
  }

  res.set('Content-Type', 'text/html').send(page(true, `${user.name} is Approved!`, `Access granted for ${user.email}. They'll receive a welcome email with login instructions.`, '#30d158'))
})

app.get('/api/auth/reject', (req, res) => {
  const { token } = req.query
  const users = loadUsers()
  const idx = users.findIndex(u => u.approvalToken === token)
  if (idx === -1) return res.set('Content-Type','text/html').send(`<html><body style="background:#000;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;"><div style="text-align:center"><h2>Invalid or expired link</h2></div></body></html>`)
  const user = users[idx]
  users.splice(idx, 1)
  saveUsers(users)
  console.log(`[auth] Rejected and removed user: ${user.email}`)
  res.set('Content-Type','text/html').send(`<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#000;font-family:-apple-system,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;"><div style="text-align:center;padding:40px"><div style="font-size:40px;margin-bottom:12px">🚫</div><h1 style="color:#fff;font-size:22px;margin:0 0 8px">Request Rejected</h1><p style="color:#8e8e93">The request from ${user.name} (${user.email}) has been removed.</p></div></body></html>`)
})

app.get('/api/auth/verify', requireAuth, (req, res) => {
  res.json({ ok: true, name: req.user?.name, email: req.user?.email, role: req.user?.role || 'user' })
})

// ── Admin: list all users (admin only) ───────────────────────────────────────
app.get('/api/auth/users', requireAuth, (req, res) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' })
  const users = loadUsers().map(u => ({ id: u.id, name: u.name, email: u.email, status: u.status, createdAt: u.createdAt, approvedAt: u.approvedAt }))
  res.json(users)
})

// ── Morning Briefing config (protected) ───────────────────────────────────────
app.get('/api/briefing/config', requireAuth, (_req, res) => {
  const subs = loadSubscribers()
  res.json({ ...briefingConfig, subscriberCount: subs.length })
})

app.post('/api/briefing/config', requireAuth, (req, res) => {
  const { sendTimeET, enabled } = req.body
  if (sendTimeET) briefingConfig.sendTimeET = sendTimeET
  if (typeof enabled === 'boolean') briefingConfig.enabled = enabled
  scheduleNextBriefing()
  res.json({ success: true, config: { ...briefingConfig } })
})

// ── Subscribers CRUD (protected) ──────────────────────────────────────────────
app.get('/api/briefing/subscribers', requireAuth, (_req, res) => {
  res.json(loadSubscribers())
})

app.post('/api/briefing/subscribers', requireAuth, (req, res) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' })
  const { email, name } = req.body || {}
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Valid email required' })
  }
  const subs = loadSubscribers()
  if (subs.find(s => s.email.toLowerCase() === email.toLowerCase())) {
    return res.status(409).json({ error: 'Already subscribed' })
  }
  subs.push({ email: email.toLowerCase(), name: name?.trim() || email.split('@')[0], addedAt: new Date().toISOString() })
  saveSubscribers(subs)
  res.json({ success: true, subscribers: subs })
})

app.delete('/api/briefing/subscribers/:email', requireAuth, (req, res) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' })
  const target = decodeURIComponent(req.params.email).toLowerCase()
  const subs = loadSubscribers().filter(s => s.email.toLowerCase() !== target)
  saveSubscribers(subs)
  res.json({ success: true, subscribers: subs })
})

// ── Self-subscribe / unsubscribe (any authenticated user, own email only) ────
app.post('/api/briefing/subscribe-me', requireAuth, (req, res) => {
  const email = req.user?.email
  const name  = req.user?.name
  if (!email) return res.status(400).json({ error: 'User email not found in session. Please log out and back in.' })
  const subs = loadSubscribers()
  if (subs.find(s => s.email.toLowerCase() === email.toLowerCase())) {
    return res.json({ success: true, subscribed: true, subscribers: subs })
  }
  subs.push({ email: email.toLowerCase(), name: name || email.split('@')[0], addedAt: new Date().toISOString() })
  saveSubscribers(subs)
  res.json({ success: true, subscribed: true, subscribers: subs })
})

app.delete('/api/briefing/subscribe-me', requireAuth, (req, res) => {
  const email = req.user?.email
  if (!email) return res.status(400).json({ error: 'User email not found in session. Please log out and back in.' })
  const subs = loadSubscribers().filter(s => s.email.toLowerCase() !== email.toLowerCase())
  saveSubscribers(subs)
  res.json({ success: true, subscribed: false, subscribers: subs })
})

// ── Send briefing now (protected) ─────────────────────────────────────────────
app.post('/api/briefing/send-now', requireAuth, async (req, res) => {
  try {
    const subs = loadSubscribers()
    const emails = subs.map(s => s.email)
    if (!emails.length) return res.status(400).json({ error: 'No subscribers to send to' })
    const result = await generateAndSendBriefing(emails)
    briefingConfig.lastSent = new Date().toISOString()
    briefingConfig.lastCount = result.sent
    briefingConfig.lastStatus = `✓ Sent to ${result.sent}/${result.total} at ${new Date().toLocaleTimeString('en-US', { timeZone: 'America/New_York' })} ET`
    res.json(result)
  } catch (e) {
    console.error('briefing send error:', e.message)
    briefingConfig.lastStatus = `✗ Failed: ${e.message}`
    res.status(500).json({ error: e.message })
  }
})

// ── Email preview (requires auth) ─────────────────────────────────────────────
app.get('/api/briefing/preview', requireAuth, async (req, res) => {
  try {
    const port = process.env.PORT || 3000
    const date = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/New_York' })
    const [overviewRaw, sectorsRaw, topAssetsRaw] = await Promise.allSettled([
      fetch(`http://127.0.0.1:${port}/api/market/overview`).then(r => r.json()),
      fetch(`http://127.0.0.1:${port}/api/market/sectors`).then(r => r.json()),
      fetch(`http://127.0.0.1:${port}/api/market/top-assets`).then(r => r.json()),
    ])
    const overview  = overviewRaw.status  === 'fulfilled' ? overviewRaw.value  : {}
    const sectors   = sectorsRaw.status   === 'fulfilled' ? sectorsRaw.value   : []
    const topAssets = topAssetsRaw.status === 'fulfilled' ? topAssetsRaw.value : []
    const marketData = { indices: overview.indices || [], vix: overview.vix || 0, fearGreed: overview.fearGreed || 50, sectors }
    const topPicks = [...topAssets].sort((a, b) => b.score100 - a.score100).slice(0, 5)
    const stamp     = new Date().toISOString().slice(0, 10)
    const newsFile  = `world-news-${stamp}.mp3`
    const briefFile = `daily-briefing-${stamp}.mp3`
    const previewPodcasts = (existsSync(join(PODCAST_DIR, newsFile)) && existsSync(join(PODCAST_DIR, briefFile)))
      ? { worldNews: { file: newsFile, title: `ATI World News · ${date}` }, dailyBriefing: { file: briefFile, title: `ATI Morning Edge · ${date}` } }
      : null
    const previewNews = await fetchWorldNewsRss(20).catch(() => [])
    const html = buildEmailHTML({ date, marketData, aiText: '[AI briefing preview — send a real briefing to see full Gemini content]', topPicks, podcasts: previewPodcasts, worldNews: previewNews })
    res.set('Content-Type', 'text/html').send(html)
  } catch (e) {
    res.status(500).send(`<pre>Error: ${e.message}</pre>`)
  }
})

// ── Serve React build in production ───────────────────────────────────────────
// ── Podcast static files ───────────────────────────────────────────────────────
mkdirSync(PODCAST_DIR, { recursive: true })
app.use('/podcasts', express.static(PODCAST_DIR))

// GET /api/podcasts — list available podcast files
app.get('/api/podcasts', (_req, res) => {
  try {
    const files = existsSync(PODCAST_DIR)
      ? readdirSync(PODCAST_DIR).filter(f => f.endsWith('.mp3'))
      : []
    const podcasts = files.map(f => {
      const isNews    = f.startsWith('world-news-')
      const isBrief   = f.startsWith('daily-briefing-')
      const isOldNews = f.startsWith('global-news-')
      const isOldInt  = f.startsWith('market-intel-')
      const date      = f.replace(/^(world-news|daily-briefing|global-news|market-intel)-/, '').replace('.mp3', '')
      let type = 'other', title = f
      if (isNews)    { type = 'world-news';       title = `World News · ${date}` }
      if (isBrief)   { type = 'daily-briefing';   title = `Morning Edge · ${date}` }
      if (isOldNews) { type = 'world-news';        title = `Global News · ${date}` }
      if (isOldInt)  { type = 'daily-briefing';    title = `Market Intel · ${date}` }
      return { file: f, url: `${appBaseUrl()}/podcasts/${f}`, type, title, date }
    }).sort((a, b) => b.date.localeCompare(a.date))
    res.json(podcasts)
  } catch (e) {
    res.json([])
  }
})

// In-memory job store for podcast generation (survives only the current process)
const podcastJobs = new Map()

// POST /api/podcasts/generate — starts background job, returns immediately
app.post('/api/podcasts/generate', requireAuth, (req, res) => {
  const jobId = crypto.randomUUID()
  const job = { id: jobId, status: 'running', step: 'Starting…', startedAt: Date.now(), results: null, error: null }
  podcastJobs.set(jobId, job)

  // Fire and forget — runs fully in background
  ;(async () => {
    try {
      const port = process.env.PORT || 3000
      const date = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/New_York' })

      job.step = 'Fetching live market data…'
      const [overviewRaw, sectorsRaw, topAssetsRaw] = await Promise.allSettled([
        fetch(`http://127.0.0.1:${port}/api/market/overview`).then(r => r.json()),
        fetch(`http://127.0.0.1:${port}/api/market/sectors`).then(r => r.json()),
        fetch(`http://127.0.0.1:${port}/api/market/top-assets`).then(r => r.json()),
      ])
      const overview   = overviewRaw.status   === 'fulfilled' ? overviewRaw.value   : {}
      const sectors    = sectorsRaw.status    === 'fulfilled' ? sectorsRaw.value    : []
      const topAssets  = topAssetsRaw.status  === 'fulfilled' ? topAssetsRaw.value  : []
      const marketData = { indices: overview.indices || [], vix: overview.vix || 0, fearGreed: overview.fearGreed || 50, sectors }
      const topPicks   = [...topAssets].sort((a, b) => (b.score100 || 0) - (a.score100 || 0)).slice(0, 5)
      const stamp      = new Date().toISOString().slice(0, 10)
      mkdirSync(PODCAST_DIR, { recursive: true })

      job.step = 'Generating morning briefing text…'
      console.log(`[podcast][${jobId}] Generating briefing text for daily-briefing podcast…`)
      let aiText = null
      try {
        const bRes = await fetch(`http://127.0.0.1:${port}/api/market-briefing`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ marketData })
        })
        const bData = await bRes.json()
        aiText = bData.briefing || bData.text || null
      } catch (_) { /* proceed without briefing text */ }

      const results = {}

      job.step = 'Writing World News script with Gemini…'
      console.log(`[podcast][${jobId}] Writing World News script…`)
      const newsScript = await generatePodcastScript('world-news', { marketData, aiText, topPicks, date })
      const newsSegs   = parsePodcastScript(newsScript)
      if (!newsSegs.length) throw new Error('Gemini did not produce ANDREW:/AVA: dialogue for World News')

      job.step = `🎙️ World News voices — 0 / ${newsSegs.length} segments…`
      console.log(`[podcast][${jobId}] TTS for ${newsSegs.length} segments (parallel)…`)
      const newsFile = `world-news-${stamp}.mp3`
      await assemblePodcast(newsSegs, join(PODCAST_DIR, newsFile), (done, total) => {
        job.step = `🎙️ World News voices — ${done} / ${total} segments…`
      })
      results.worldNews = { file: newsFile, title: `ATI World News · ${date}` }
      console.log(`[podcast][${jobId}] ✓ World News ready`)

      job.step = 'Writing Morning Edge script with Gemini…'
      console.log(`[podcast][${jobId}] Writing Morning Edge script…`)
      const briefScript = await generatePodcastScript('daily-briefing', { marketData, aiText, topPicks, date })
      const briefSegs   = parsePodcastScript(briefScript)
      if (!briefSegs.length) throw new Error('Gemini did not produce ANDREW:/AVA: dialogue for Morning Edge')

      job.step = `🎙️ Morning Edge voices — 0 / ${briefSegs.length} segments…`
      console.log(`[podcast][${jobId}] TTS for ${briefSegs.length} segments (parallel)…`)
      const briefFile = `daily-briefing-${stamp}.mp3`
      await assemblePodcast(briefSegs, join(PODCAST_DIR, briefFile), (done, total) => {
        job.step = `🎙️ Morning Edge voices — ${done} / ${total} segments…`
      })
      results.dailyBriefing = { file: briefFile, title: `ATI Morning Edge · ${date}` }
      console.log(`[podcast][${jobId}] ✓ Morning Edge ready`)

      job.status  = 'done'
      job.step    = 'Complete'
      job.results = results
    } catch (e) {
      const errMsg = e?.message || e?.code || String(e) || 'Unknown error'
      console.error(`[podcast][${jobId}] Failed:`, errMsg, e?.stack?.split('\n')[1] || '')
      const isQuota = errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota')
      job.status = 'error'
      job.error  = isQuota
        ? 'Gemini API quota exhausted — resets daily. Try again tomorrow.'
        : errMsg
    }
  })()

  res.json({ jobId, status: 'started' })
})

// GET /api/podcasts/status/:jobId — poll for job status
app.get('/api/podcasts/status/:jobId', requireAuth, (req, res) => {
  const job = podcastJobs.get(req.params.jobId)
  if (!job) return res.status(404).json({ error: 'Job not found' })
  res.json({
    id:        job.id,
    status:    job.status,
    step:      job.step,
    results:   job.results,
    error:     job.error,
    elapsedMs: Date.now() - job.startedAt,
  })
})

const distPath = join(__dirname, 'apex-web', 'dist')
if (existsSync(distPath)) {
  app.use(express.static(distPath))
  app.get(/.*/, (_req, res) => res.sendFile(join(distPath, 'index.html')))
}

const PORT = process.env.PORT || process.env.SERVER_PORT || 3000
app.listen(PORT, '0.0.0.0', () => {
  console.log(`ATI backend running on http://localhost:${PORT}`)
})
