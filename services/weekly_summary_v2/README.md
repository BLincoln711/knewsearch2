# Weekly Summary V2 Service

Cloud Run service that generates AI-powered weekly executive summaries for brand visibility tracking using Gemini.

## Features

- **Adaptive Data Sources**: Uses visibility_scores when available, falls back to proxy metrics (ai_answers, entities, citations) when scores are empty
- **Gemini Integration**: Generates executive summaries with retry logic for 429/5xx errors
- **Idempotent Inserts**: Deterministic summary_id ensures no duplicate summaries
- **Email-Ready Output**: Returns formatted text and HTML suitable for email distribution
- **Structured JSON Logging**: Cloud Logging compatible JSON output

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/weekly` | Generate weekly summary |

### POST /weekly

Request body:
```json
{
  "brand": "KnewSearch",        // Required: Brand to generate summary for
  "end_date": "2025-02-03",     // Optional: End date (YYYY-MM-DD), defaults to today
  "lookback_days": 7            // Optional: Days to look back, defaults to 7
}
```

Response:
```json
{
  "summary_id": "sum_abc123def456",
  "brand": "KnewSearch",
  "start_date": "2025-01-28",
  "end_date": "2025-02-03",
  "email_ready_text": "Executive summary text...",
  "summary_json": {
    "executive_summary": "...",
    "what_changed": "...",
    "top_wins": ["..."],
    "top_losses": ["..."],
    "recommended_actions": ["..."],
    "visibility_trend": "up",
    "raw_metrics": {...}
  },
  "created_at": "2025-02-03T12:00:00Z"
}
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GCP_PROJECT_ID` | Yes | - | Google Cloud project ID |
| `GEMINI_API_KEY` | Yes | - | Gemini API key (via Secret Manager) |
| `BQ_DATASET` | No | `knewsearch_aeo` | BigQuery dataset name |
| `GEMINI_MODEL` | No | `gemini-2.0-flash` | Gemini model to use |
| `SERVICE_NAME` | No | `weekly_summary_v2` | Service name for logging |
| `LOG_LEVEL` | No | `INFO` | Logging level |
| `MAX_RETRIES` | No | `3` | Max retries for Gemini API |
| `RETRY_BACKOFF_BASE` | No | `2` | Exponential backoff base (seconds) |
| `PORT` | No | `8080` | Server port |

## Local Development

### Prerequisites

1. Python 3.12+
2. Google Cloud SDK with BigQuery access
3. Gemini API key

### Setup

```bash
cd services/weekly_summary_v2

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# or: venv\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements.txt
```

### Run Locally

```bash
# Set required environment variables
export GCP_PROJECT_ID="knewsearch-prod"
export GEMINI_API_KEY="your-api-key"
export BQ_DATASET="knewsearch_aeo"

# Run the service
python main.py
```

Service will be available at `http://localhost:8080`.

### Test Locally

```bash
# Health check
curl http://localhost:8080/health

# Generate weekly summary
curl -X POST http://localhost:8080/weekly \
  -H "Content-Type: application/json" \
  -d '{"brand": "KnewSearch"}'

# With custom date range
curl -X POST http://localhost:8080/weekly \
  -H "Content-Type: application/json" \
  -d '{"brand": "KnewSearch", "end_date": "2025-02-03", "lookback_days": 14}'
```

### Run Smoke Tests

```bash
# From project root
./scripts/smoke_weekly_summary_v2.sh http://localhost:8080
```

## Manual Deploy to Cloud Run

### Build and Push Container

```bash
# Set variables
export PROJECT_ID="knewsearch-prod"
export REGION="us-central1"
export SERVICE_NAME="weekly-summary-v2"

# Build container
cd services/weekly_summary_v2
gcloud builds submit --tag gcr.io/${PROJECT_ID}/${SERVICE_NAME}
```

### Deploy to Cloud Run

```bash
gcloud run deploy ${SERVICE_NAME} \
  --image gcr.io/${PROJECT_ID}/${SERVICE_NAME} \
  --platform managed \
  --region ${REGION} \
  --allow-unauthenticated \
  --set-env-vars "GCP_PROJECT_ID=${PROJECT_ID},BQ_DATASET=knewsearch_aeo,GEMINI_MODEL=gemini-2.0-flash" \
  --set-secrets "GEMINI_API_KEY=gemini-api-key:latest" \
  --memory 512Mi \
  --timeout 300 \
  --max-instances 3
```

### Verify Deployment

```bash
# Get service URL
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --region ${REGION} --format 'value(status.url)')

# Test health
curl ${SERVICE_URL}/health

# Generate summary
curl -X POST ${SERVICE_URL}/weekly \
  -H "Content-Type: application/json" \
  -d '{"brand": "KnewSearch"}'
```

## BigQuery Output

Writes to `knewsearch_aeo.weekly_summaries` table:

| Column | Type | Description |
|--------|------|-------------|
| `summary_id` | STRING | Deterministic unique ID |
| `brand` | STRING | Brand name |
| `event_date` | DATE | Generation date (partition key) |
| `week_start_date` | DATE | Start of analyzed period |
| `week_end_date` | DATE | End of analyzed period |
| `executive_summary` | STRING | AI-generated summary text |
| `key_findings` | ARRAY<STRING> | Bullet points of findings |
| `recommendations` | ARRAY<STRING> | Action items |
| `visibility_trend` | STRING | up/down/stable |
| `visibility_change_pct` | FLOAT64 | Week-over-week change % |
| `model_version` | STRING | Gemini model used |
| `email_ready_html` | STRING | HTML for email |
| `created_at` | TIMESTAMP | Creation timestamp |
| `metadata` | JSON | Raw metrics and request context |

## Architecture

```
┌─────────────────────┐
│   POST /weekly      │
│   (HTTP Request)    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Check visibility_   │
│ scores has data?    │
└──────────┬──────────┘
           │
     ┌─────┴─────┐
     │           │
     ▼           ▼
┌─────────┐ ┌─────────┐
│ Fetch   │ │ Fetch   │
│ Scores  │ │ Proxy   │
│ Metrics │ │ Metrics │
└────┬────┘ └────┬────┘
     │           │
     └─────┬─────┘
           │
           ▼
┌─────────────────────┐
│   Gemini API        │
│   (with retry)      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   BigQuery          │
│   weekly_summaries  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   Response          │
│   (email + JSON)    │
└─────────────────────┘
```

## Graceful Degradation

When `visibility_scores` is empty:

1. Service checks for rows in visibility_scores for the brand/date range
2. If empty, fetches proxy metrics from:
   - `ai_answers`: Answer counts, prompt coverage
   - `entities`: Brand mentions, competitor mentions
   - `citations`: Citation counts, domain distribution
3. Gemini generates summary using available proxy data
4. Summary clearly indicates scores are not yet available

## Idempotency

- `summary_id` is generated deterministically: `sha256(brand:start_date:end_date)[:12]`
- Same brand + date range always produces same summary_id
- Duplicate inserts are safely ignored
- Calling endpoint multiple times returns consistent results
