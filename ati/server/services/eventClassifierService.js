// Classifies news/filing events and assigns sentiment + magnitude

const BULLISH_PATTERNS = [
  /beat[s]? (earnings|estimates?|expectations?)/i,
  /raised? (guidance|outlook|forecast)/i,
  /record (revenue|earnings|profit|sales)/i,
  /strong (demand|growth|sales|results)/i,
  /profit (surges?|jumps?|rises?|grows?)/i,
  /dividend (increase|raise|hike)/i,
  /buyback|share repurchase/i,
  /new (contract|partnership|deal|customer)/i,
  /FDA (approval|cleared|approved)/i,
  /upgraded? (to buy|to outperform|to overweight)/i,
  /price target (raised|increased|lifted)/i,
  /revenue growth|earnings growth/i,
  /positive (earnings|results|outlook)/i,
  /exceeds? (expectations?|estimates?|forecasts?)/i,
]

const BEARISH_PATTERNS = [
  /missed? (earnings|estimates?|expectations?|revenue)/i,
  /lowered? (guidance|outlook|forecast|estimates?)/i,
  /loss(es)?|write(-)?down|impairment/i,
  /layoff[s]?|job cuts?|workforce reduction/i,
  /investigation|sec probe|fraud|lawsuit/i,
  /downgraded? (to sell|to underperform|to underweight)/i,
  /price target (cut|lowered?|reduced?)/i,
  /miss(es|ed)? (expectations?|estimates?|forecasts?)/i,
  /bankruptcy|default|debt (crisis|concerns?)/i,
  /recall[s]?|product (defect|failure)/i,
  /exec(utive)? (resign|depart|leave|fired)/i,
  /revenue (decline|drop|fell|decreased)/i,
  /earnings (miss|decline|drop)/i,
]

const EVENT_PATTERNS = {
  earnings_beat:       [/beat[s]? (earnings|estimates?)/i, /exceeds? earnings/i],
  earnings_miss:       [/missed? (earnings|estimates?)/i, /below estimates/i],
  guidance_raise:      [/raised? guidance|positive outlook|raised? forecast/i],
  guidance_cut:        [/cut guidance|lowered guidance|reduced forecast/i],
  fda_approval:        [/FDA (approved?|cleared|approval)/i],
  acquisition:         [/acqui(red?|sition)|merger|takeover|buyout/i],
  spinoff:             [/spin(-)?off|divestiture|divest/i],
  insider_buy:         [/insider (purchase|buy|bought)/i],
  insider_sell:        [/insider (sell|sold|sale)/i],
  analyst_upgrade:     [/upgraded? (to buy|outperform|overweight)/i],
  analyst_downgrade:   [/downgraded? (to sell|underperform|underweight)/i],
  sec_investigation:   [/SEC (investigation|probe|charges)/i],
  material_event:      [/8-K/i],
  annual_report:       [/10-K|annual report/i],
  quarterly_report:    [/10-Q|quarterly report/i],
}

export function classifyEvent(text) {
  const str = (text || '').toLowerCase()
  let eventType = 'general_news'
  for (const [type, pats] of Object.entries(EVENT_PATTERNS)) {
    if (pats.some(p => p.test(str))) { eventType = type; break }
  }
  return eventType
}

export function classifySentiment(text) {
  const bullishScore = BULLISH_PATTERNS.filter(p => p.test(text)).length
  const bearishScore = BEARISH_PATTERNS.filter(p => p.test(text)).length
  const net = bullishScore - bearishScore
  if (net >= 2) return 'bullish'
  if (net === 1) return 'slightly_bullish'
  if (net === -1) return 'slightly_bearish'
  if (net <= -2) return 'bearish'
  return 'neutral'
}

export function classifyMagnitude(eventType) {
  const high   = ['earnings_beat','earnings_miss','fda_approval','acquisition','sec_investigation','guidance_cut','guidance_raise']
  const medium = ['analyst_upgrade','analyst_downgrade','insider_buy','insider_sell','spinoff']
  if (high.includes(eventType))   return 'high'
  if (medium.includes(eventType)) return 'medium'
  return 'low'
}

export function getConfidenceScore(text, sentiment) {
  if (sentiment === 'neutral') return 40
  const bullish = BULLISH_PATTERNS.filter(p => p.test(text)).length
  const bearish = BEARISH_PATTERNS.filter(p => p.test(text)).length
  const signals = bullish + bearish
  if (signals >= 3) return 85
  if (signals === 2) return 72
  if (signals === 1) return 60
  return 45
}

export function enrichNewsItem(item) {
  const fullText = `${item.headline || ''} ${item.summary || ''}`
  const event_type  = classifyEvent(fullText)
  const sentiment   = classifySentiment(fullText)
  const magnitude   = classifyMagnitude(event_type)
  const confidence  = getConfidenceScore(fullText, sentiment)
  return { ...item, event_type, sentiment, magnitude, confidence }
}
