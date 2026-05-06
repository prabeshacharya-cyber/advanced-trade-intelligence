# APEX React App

Professional dark-theme React UI for APEX with:
- 8-page navigation
- Tailwind styling
- Recharts visualizations
- Plain-English explanation under each metric

## Run
```bash
cd apex-web
npm install
npm run dev
```

## Claude API integration
The UI expects a backend endpoint at `POST /api/claude`.
Your server should call Anthropic Claude with web search enabled and return JSON.
Keep API keys on the server, never in browser code.
