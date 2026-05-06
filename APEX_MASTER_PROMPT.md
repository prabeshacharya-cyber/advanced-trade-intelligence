# APEX — Master Prompt
### AI-Powered Financial Market Intelligence Platform
#### Complete project context for any new AI coding session

---

## 1. PROJECT GOAL

APEX is a private, invite-only financial market intelligence platform for active traders.
It combines real-time market data (via Yahoo Finance), AI analysis (Gemini 2.5 Pro), and a clean dark-mode UI.

**Two surfaces:**
- **Web app** — React + Vite + Express, deployed at the `.replit.app` domain
- **Mobile app** — React Native / Expo, targeting iOS (App Store) + Android (Google Play)

**The platform is NOT a broker or trading system.** It is a research and intelligence tool.
Every AI-generated output must include the disclaimer: "AI-generated · Not financial advice."

---

## 2. TECH STACK

### Web (apex-web/)
| Layer | Choice |
|---|---|
| Framework | React 18 + Vite 5 |
| Styling | Tailwind CSS v3 (JIT) |
| Fonts | Inter (400/500/600) + JetBrains Mono Variable |
| Charts | Recharts |
| HTTP | Native fetch via `geminiClient.js` |
| Build | `npm run build` → `dist/` |

### Backend (root server.js)
| Layer | Choice |
|---|---|
| Runtime | Node.js (Express) on port 3000 |
| AI | `@google/genai` — model `gemini-2.5-pro` |
| Auth | JWT (30-day), scrypt password hashing |
| Email | Resend API (approval + welcome emails) |
| Data store | `data/users.json` (flat file) |

### Mobile (apex-mobile/)
| Layer | Choice |
|---|---|
| Framework | Expo SDK + Expo Router (file-based) |
| Language | TypeScript |
| Navigation | Tab bar (5 tabs) + modal stack |
| State | React useState / useEffect (no global store) |
| HTTP | Shared `lib/queryClient.ts` wraps fetch |
| Auth | JWT in `expo-secure-store` |
| Haptics | `expo-haptics` on interactions |
| Fonts | `@expo-google-fonts/inter` (Inter_400Regular/500Medium/600SemiBold/700Bold) |
| Targets | iOS (App Store) + Android (Google Play) + Web preview |

---

## 3. FILE STRUCTURE

```
/
├── server.js                        # Express backend + all API routes
├── data/users.json                  # User accounts (persistent)
├── package.json                     # Root: express, cors, @google/genai, resend
│
├── apex-web/                        # React web app
│   ├── src/
│   │   ├── App.jsx                  # Router (React Router v6)
│   │   ├── main.jsx                 # Entry: font imports + ReactDOM.render
│   │   ├── styles.css               # Tailwind @layer base/components/utilities
│   │   ├── pages/
│   │   │   ├── Pages.jsx            # ALL page components (Dashboard, Scorer, Chat, etc.)
│   │   │   ├── LoginPage.jsx        # Login + signup request form
│   │   │   ├── BriefingPage.jsx     # Morning briefing subscription page
│   │   │   └── TraderPages.jsx      # Portfolio, Journal, Trade Planner pages
│   │   ├── components/
│   │   │   ├── Layout.jsx           # Shell: sidebar (desktop) + mobile nav
│   │   │   ├── MobileNavSheet.jsx   # "More" slide-up sheet (mobile)
│   │   │   └── Skeleton.jsx         # <Skeleton className="h-3 w-16" /> pulse block
│   │   ├── lib/
│   │   │   ├── geminiClient.js      # fetch wrappers for every /api/* endpoint
│   │   │   └── text.js              # statusText(), signalFromScore(), explainScore()
│   │   └── data/mockData.js         # Fallback mock data (indices, sectors, assets)
│   ├── tailwind.config.js           # Design tokens + font families
│   └── vite.config.js               # port 5000, host 0.0.0.0, proxy /api → :3000
│
└── apex-mobile/                     # Expo mobile app
    ├── app/
    │   ├── _layout.tsx              # Root layout (SafeArea, fonts, AuthContext)
    │   ├── auth/index.tsx           # Login + Request Access screen
    │   └── (tabs)/
    │       ├── _layout.tsx          # Tab bar config (iOS 84px / Android 60px)
    │       ├── index.tsx            # Markets tab (indices, VIX, sectors)
    │       ├── scorer.tsx           # AI Scorer tab
    │       ├── chat.tsx             # AI Chat tab (Gemini Pro)
    │       ├── tools.tsx            # Tools tab (Planner, Journal, Alerts)
    │       ├── more.tsx             # More hub (links to profile, settings)
    │       └── profile.tsx          # Profile tab (hidden from tab bar)
    ├── context/AuthContext.tsx      # JWT auth state, login/logout
    ├── hooks/useColors.ts           # Centralized color tokens
    ├── lib/queryClient.ts           # apiRequest() fetch wrapper
    └── app.json                     # Expo config (iOS + Android + Web)
```

---

## 4. DESIGN SYSTEM

### 4a. Color Tokens (Web — Tailwind)
```js
bg:      '#000000'   // page background
card:    '#1c1c1e'   // card background
card2:   '#2c2c2e'   // inner card / nested surface
border:  '#38383a'   // card borders
bull:    '#30d158'   // green / positive / gain
bear:    '#ff453a'   // red / negative / loss
neutral: '#ffd60a'   // yellow / neutral / medium
info:    '#0a84ff'   // blue / accent / info
ai:      '#bf5af2'   // purple / AI features
text:    '#ffffff'   // primary text
muted:   '#8e8e93'   // secondary text (≥ zinc-400 contrast)
```

### 4b. Color Tokens (Mobile — useColors hook)
Same semantic names. Access via `const c = useColors()` then `c.primary`, `c.bull`, etc.

### 4c. Typography (Web)

| Role | Classes |
|---|---|
| Section label | `text-[11px] font-semibold tracking-[0.08em] uppercase text-zinc-400` |
| Card title | `text-sm font-medium text-zinc-300` |
| Primary metric (big number) | `text-2xl md:text-3xl font-semibold font-mono tabular-nums text-white tracking-tight` |
| Delta (±%) | `text-sm font-medium font-mono tabular-nums` + bull/bear color |
| Secondary metric | `text-xs font-mono tabular-nums text-zinc-400` |
| Body copy | `text-sm leading-relaxed text-zinc-300` |
| Timestamp / disclaimer | `text-[11px] text-zinc-500` |

**Rule: Every number on every page must use `font-mono tabular-nums`.** No exceptions.

### 4d. Spacing System (Web Dashboard)
| Context | Mobile | md+ |
|---|---|---|
| Page padding | `px-4 py-3` | `md:px-6 md:py-5` → `lg:px-8 lg:py-6` |
| Card outer gap | `gap-3` | `md:gap-4` → `lg:gap-5` |
| Card inner padding | `p-4` | `md:p-5` |
| Section label → first row | `mt-3 mb-2` | `md:mt-4 md:mb-3` |

### 4e. Component Classes (styles.css @layer components)
```
.card        → bg-card border border-border/60 rounded-2xl p-4
.card-inner  → bg-card2 border border-border/40 rounded-xl p-3
.sub         → text-sm text-muted mt-1 leading-relaxed
.pill        → px-3 py-1 rounded-full text-sm font-medium transition-all
.pill-active → bg-bull/15 text-bull
.score-bar-track → w-full h-1 rounded-full (bg rgba white/6)
.score-bar-fill  → h-1 rounded-full transition-all duration-500
```

### 4f. Mobile Typography (React Native)
```
fontFamily: 'Inter_400Regular' | 'Inter_500Medium' | 'Inter_600SemiBold' | 'Inter_700Bold'
```
Tab bar labels: `fontSize: 10, fontFamily: 'Inter_500Medium'`
All numbers: include `fontVariant: ['tabular-nums']` in StyleSheet where supported.

---

## 5. AUTHENTICATION FLOW

### Web
1. `POST /api/auth/login` → returns `{ token, user }` → stored in localStorage
2. `POST /api/auth/signup` → creates pending user → sends approval email to admin
3. Admin clicks approval link → `GET /api/auth/approve?token=X` → user status → `approved`
4. User gets welcome email via Resend → can now log in
5. Admin account: `prabeshacharya@gmail.com` (uses `APEX_PASSWORD` env var, default `apex2024`)
6. JWT secret: `APEX_JWT_SECRET` env var (fallback: `apex-fallback-secret-change-me`)

### Mobile
- Same endpoints. JWT stored via `expo-secure-store` (never in AsyncStorage).
- `AuthContext` provides `{ token, user, login, logout, loading }`.
- `_layout.tsx` redirects to `/auth` if no token on mount.

---

## 6. API ENDPOINTS (server.js)

```
POST /api/auth/login                  Login
POST /api/auth/signup                 Request access
GET  /api/auth/approve?token=X        Admin approve user
GET  /api/auth/reject?token=X         Admin reject user
GET  /api/auth/users                  Admin list all users

GET  /api/market/overview             Indices, VIX, Fear & Greed
GET  /api/market/sectors              11 S&P sectors with % change + weight
GET  /api/market/top-assets           Top 20 scored assets
POST /api/ai/briefing                 AI market briefing (Gemini)
POST /api/ai/scorer-insight           AI per-asset insight (Gemini)
POST /api/ai/earnings                 AI earnings analysis (Gemini)
POST /api/chat                        AI conversational chat (Gemini)
POST /api/research                    AI deep research (Gemini)
```

All AI endpoints accept JSON, call Gemini 2.5 Pro, and return `{ text: string }`.

---

## 7. WEB PAGES (Pages.jsx exports)

| Export | Route | Description |
|---|---|---|
| `DashboardPage` | `/dashboard` | Indices grid, Fear & Greed, VIX, Sector heatmap, Calendar, AI briefing |
| `ScorerPage` | `/scorer` | AI-ranked top 20 assets with score bars and per-asset AI insight |
| `ChatPage` | `/chat` | Full Gemini Pro conversational chat with quick prompts |
| `EarningsPage` | `/earnings` | Pre-earnings intelligence per ticker |
| `ResearchPage` | `/research` | Deep AI research tool |
| `InsiderPage` | `/insider` | Insider transaction tracker |
| `SentimentPage` | `/sentiment` | Sentiment charts (mention volume + bullish %) |
| `AlertsPage` | `/alerts` | Price alert manager |
| `WatchlistPage` | `/watchlist` | Personal watchlist with live prices |

---

## 8. MOBILE TABS

| Tab | File | Description |
|---|---|---|
| Markets | `(tabs)/index.tsx` | Live market overview (mirrors Dashboard) |
| Scorer | `(tabs)/scorer.tsx` | AI asset scorer + detail modal |
| AI Chat | `(tabs)/chat.tsx` | Gemini Pro chat (same as web) |
| Tools | `(tabs)/tools.tsx` | Trade Planner, Journal, Alerts |
| More | `(tabs)/more.tsx` | Hub for Profile, Settings, Briefing |

Tab bar: height 84px on iOS (accounts for home indicator), 60px on Android.
`profile.tsx` exists but is hidden from tab bar (`href: null`).

---

## 9. PLATFORM-SPECIFIC PATTERNS (Mobile)

```tsx
// Tab bar height
height: Platform.OS === 'ios' ? 84 : 60,
paddingBottom: Platform.OS === 'ios' ? 26 : 8,
elevation: Platform.OS === 'android' ? 8 : 0,

// Keyboard avoidance
behavior={Platform.OS === 'ios' ? 'padding' : 'height'}

// Keyboard dismiss on scroll
keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
```

---

## 10. DASHBOARD-SPECIFIC RULES (web)

These were implemented in the last refinement pass and must be preserved:

1. **Index cards**: `grid-cols-2` on mobile, `md:grid-cols-4` on desktop. Never horizontal scroll.
2. **Sector heatmap**: Vertical bar list on mobile (`md:hidden`). Grid tiles on desktop (`hidden md:block`).
3. **Fear & Greed + VIX**: Full-width on mobile, side-by-side `md:grid-cols-2` on desktop.
4. **Economic Calendar**: "Today only" on mobile, with "View week →" toggle. Full week on desktop.
5. **Sticky mobile header**: `sticky top-0 z-20 h-12 backdrop-blur border-b border-zinc-800` showing "Dashboard" + last-refresh time.
6. **Skeleton loading**: Use `<Skeleton />` (not spinners) inside each card while data loads. Skeletons must match the height of the loaded card to prevent layout shift.
7. **Empty states**: Dim icon + "No data yet" + "Check back at market open". Never collapse card height.
8. **Flash on change**: `useFlashOnChange(value)` hook — 400ms `bg-bull/10` or `bg-bear/10` background flash when a numeric value changes. Skip if `prefers-reduced-motion`.
9. **Accessibility**: `aria-live="polite"` on the index cards container.
10. **Numbers**: Every visible number must use `font-mono tabular-nums`. No exceptions.

---

## 11. CODING CONVENTIONS

### General
- All page components live in `apex-web/src/pages/Pages.jsx` — do not split into separate files unless explicitly asked.
- Helper components used by only one page go in the same file, directly above the page export.
- Shared utilities only go in `components/` if used by two or more pages.
- No `console.log` left in production code.
- No TypeScript in the web app — plain JSX only.
- Mobile app is TypeScript throughout.

### Tailwind (web)
- Use Tailwind utility classes exclusively. No inline `style={}` except for dynamic values (e.g. calculated widths, chart colors).
- Use the design token colors (`text-bull`, `bg-card`, etc.), not raw hex in classNames.
- Arbitrary values (`text-[11px]`, `tracking-[0.08em]`) are allowed when no token matches.
- `zinc-*` Tailwind defaults are available alongside APEX tokens.
- Never use `p-6`, `p-7`, `px-5` on Dashboard cards — use the spacing system above.

### React
- Data fetching: `useState` + `useEffect` + `async function loadData()` pattern. No React Query on web.
- Always show a loading state (skeleton) and an error state (DataError component) for every data fetch.
- Use `withRetry(fn, 3, 1000)` for all market data fetches.
- AI buttons use the shared `<AIButton>` component with `loading` + `disabled` states.

### React Native
- StyleSheet.create() for all styles. No inline style objects except for dynamic values.
- `useSafeAreaInsets()` for top/bottom padding on every screen.
- Colors always from `useColors()` hook — never hardcoded hex strings.
- No `AsyncStorage` — use `expo-secure-store` for persistent data.

---

## 12. ENVIRONMENT VARIABLES

| Key | Used in | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | server.js | Gemini 2.5 Pro API access |
| `RESEND_API_KEY` | server.js | Transactional email (approvals, briefings) |
| `GMAIL_APP_PASSWORD` | server.js | Fallback email (if Resend unavailable) |
| `APEX_JWT_SECRET` | server.js | JWT signing (optional, has fallback) |
| `APEX_PASSWORD` | server.js | Admin account password (optional, default `apex2024`) |
| `EXPO_PUBLIC_API_URL` | apex-mobile | Points mobile app to web backend |

---

## 13. RUNNING THE PROJECT

```bash
# Web (both backend + frontend together):
npm run dev
# → Express on :3000, Vite on :5000

# Mobile (Expo Metro):
cd apex-mobile && npx expo start --web --port 8000
# → Web preview at :8000, scan QR for native

# Build for production (web):
cd apex-web && npm run build

# Build for app stores (mobile):
eas build --platform ios      # App Store
eas build --platform android  # Google Play
eas build --platform all      # Both
```

---

## 14. WHAT HAS BEEN BUILT (COMPLETE)

### Web
- [x] Full authentication system (login, signup request, admin approval, JWT sessions)
- [x] Dashboard: indices, Fear & Greed, VIX, sector heatmap, economic calendar, AI briefing
- [x] Scorer: top 20 AI-ranked assets with per-asset AI insight
- [x] Earnings intelligence page
- [x] AI Chat (Gemini Pro conversational)
- [x] Deep Research tool
- [x] Insider transaction tracker
- [x] Sentiment charts
- [x] Watchlist manager
- [x] Portfolio tracker (add/remove positions, live P&L)
- [x] Trade Planner, Journal, Alerts
- [x] Morning Briefing email subscription (daily 7AM ET)
- [x] Mobile nav: 4-tab bottom bar + "More" slide-up sheet
- [x] Dashboard mobile refinements: spacing system, typography, font-mono numbers, 2-col grid, sector bars, skeleton loaders, empty states, flash-on-change hook, aria-live, sticky mobile header

### Mobile
- [x] Auth screen (login + request access)
- [x] Markets tab (live overview)
- [x] AI Scorer tab + detail modal
- [x] AI Chat tab (Gemini Pro)
- [x] Tools tab (Trade Planner, Journal, Alerts)
- [x] More hub + Profile screen
- [x] iOS tab bar (84px, home indicator padding)
- [x] Android tab bar (60px, elevation shadow)
- [x] Cross-platform keyboard avoidance
- [x] Haptic feedback throughout
- [x] app.json configured for both iOS (bundleIdentifier) and Android (package)

---

## 15. KNOWN CONSTRAINTS & RULES FOR FUTURE WORK

1. **Do NOT touch the backend** (`server.js`, API routes) unless the task explicitly requires it.
2. **Do NOT refactor shared utilities** (`geminiClient.js`, `text.js`, `Layout.jsx`) without explicit approval.
3. **One route at a time.** When a prompt scopes a task to one route (e.g. "Dashboard only"), do not modify other routes, nav, or shared components.
4. **Mobile and web are separate surfaces.** A web change does not automatically apply to mobile, and vice versa.
5. **No spinners inside cards.** Use skeleton loaders (`<Skeleton />`) instead.
6. **No arbitrary padding on Dashboard cards.** Use the spacing system in section 4d.
7. **All numbers use `font-mono tabular-nums`** — this rule applies to all future pages, not just Dashboard.
8. **Verify at 390×844 first**, then 768, then 1440. Mobile-first always.
9. **Accessibility minimum**: `aria-live` on live data containers, muted text ≥ zinc-400 contrast.
10. **Respect `prefers-reduced-motion`**: skip animations and skeleton pulse when set.

---

## 16. SUGGESTED NEXT IMPROVEMENTS

The following have not been built yet and are good candidates for future tasks:

### Web
- Apply the same spacing/typography/skeleton/empty-state refinements to Scorer, Chat, Earnings, and Research pages (same rules as Dashboard)
- Add dark/light mode toggle (currently dark-only)
- Watchlist real-time price polling (currently manual refresh)
- Admin panel UI at `/admin` for managing users
- Push notification infrastructure for price alerts
- Lighthouse performance audit + Core Web Vitals pass

### Mobile
- Pull-to-refresh on Markets and Scorer tabs
- Push notifications via Expo Notifications
- Biometric login (Face ID / fingerprint) via `expo-local-authentication`
- Offline mode with cached last-known data
- Deep link support (`apex://scorer/AAPL`)
- App Store screenshots + metadata for submission
- EAS Update (OTA update channel) setup

---

*Generated from APEX codebase · Last updated: April 2026*
