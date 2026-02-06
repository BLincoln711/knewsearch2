# KnewSearch Dashboard

Minimal executive dashboard for the KnewSearch AEO Visibility Platform. Reads from the live Read API.

## Pages

| Page | Path | Description |
|------|------|-------------|
| Overview | `/` | Brand selector, KPI tiles, score trend chart |
| Prompt Scores | `/prompt-scores` | Scores table with date picker |
| Weekly Summary | `/weekly-summary` | Rendered executive summary text |
| Data Health | `/data-health` | API health, last score date, last summary date |

## Environment Setup

Copy the example env file:

```bash
cp .env.example .env
```

Edit `.env` and set the two variables:

```
NEXT_PUBLIC_READ_API_BASE_URL=https://read-api-imbz77zl2a-uc.a.run.app
NEXT_PUBLIC_READ_API_KEY=
```

`NEXT_PUBLIC_READ_API_KEY` is optional. If set, it is sent as an `x-api-key` header on every request.

## Local Development

```bash
npm install
npm run dev
```

The app starts on `http://localhost:3000` (or the next available port).

## Tech Stack

- Next.js 14 (App Router)
- React 18
- Tailwind CSS
- Recharts
- TypeScript
