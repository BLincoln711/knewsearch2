# Read API Service

Read-only Cloud Run service providing AI Search Visibility data for dashboards, demos, and executive reporting. Queries BigQuery tables in the `knewsearch_aeo` dataset and returns JSON responses.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/brands` | Distinct active brands |
| GET | `/overview?brand=` | Last 30 days visibility trend |
| GET | `/prompt-scores?brand=&date=` | Per-prompt scores for a brand and date |
| GET | `/weekly-summary?brand=` | Most recent weekly executive summary |

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GCP_PROJECT_ID` | Yes | - | Google Cloud project ID |
| `BQ_DATASET` | No | `knewsearch_aeo` | BigQuery dataset name |
| `LOG_LEVEL` | No | `INFO` | Logging level |
| `PORT` | No | `8080` | Server port |

## Local Development

### Prerequisites

- Python 3.12+
- Google Cloud SDK authenticated (`gcloud auth application-default login`)
- BigQuery tables populated in the target project

### Setup

```bash
cd services/read_api
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Run

```bash
export GCP_PROJECT_ID=knewsearch-prod
python main.py
```

The service starts on `http://localhost:8080`.

### Run with Docker

```bash
docker build -t read-api ./services/read_api/
docker run -p 8080:8080 \
  -e GCP_PROJECT_ID=knewsearch-prod \
  -v ~/.config/gcloud:/home/appuser/.config/gcloud:ro \
  read-api
```

## Manual Cloud Run Deploy

```bash
# Build and push
gcloud builds submit ./services/read_api/ \
  --tag gcr.io/knewsearch-prod/read-api:latest

# Deploy
gcloud run deploy read-api \
  --image gcr.io/knewsearch-prod/read-api:latest \
  --region us-central1 \
  --platform managed \
  --set-env-vars GCP_PROJECT_ID=knewsearch-prod,BQ_DATASET=knewsearch_aeo \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --max-instances 3
```

## Example Requests

### Health Check

```bash
curl http://localhost:8080/health
```

```json
{"status": "healthy", "service": "read_api"}
```

### List Brands

```bash
curl "http://localhost:8080/brands?limit=10&offset=0"
```

```json
{
  "brands": ["KnewSearch", "SolarWinds"],
  "total": 2,
  "limit": 10,
  "offset": 0
}
```

### Brand Overview (30-day trend)

```bash
curl "http://localhost:8080/overview?brand=KnewSearch"
```

```json
{
  "brand": "KnewSearch",
  "days": 7,
  "data": [
    {
      "event_date": "2025-05-10",
      "total_score": 245.50,
      "average_score": 49.10,
      "prompt_count": 5
    }
  ]
}
```

### Prompt-Level Scores

```bash
curl "http://localhost:8080/prompt-scores?brand=KnewSearch&date=2025-05-10&limit=10"
```

```json
{
  "brand": "KnewSearch",
  "date": "2025-05-10",
  "data": [
    {
      "prompt_id": "prompt_abc123",
      "score": 72.50,
      "brand_mentioned": true,
      "citation_count": 3,
      "volatility_rank": 2
    }
  ],
  "total": 5,
  "limit": 10,
  "offset": 0
}
```

### Weekly Summary

```bash
curl "http://localhost:8080/weekly-summary?brand=KnewSearch"
```

```json
{
  "brand": "KnewSearch",
  "week_start_date": "2025-05-05",
  "week_end_date": "2025-05-11",
  "email_ready_text": "KnewSearch visibility remained stable this week...",
  "created_at": "2025-05-12T02:00:00+00:00"
}
```

## Troubleshooting

- **500 "GCP_PROJECT_ID environment variable not set"** - Export `GCP_PROJECT_ID` before starting the service.
- **403 from BigQuery** - Run `gcloud auth application-default login` or ensure the Cloud Run service account has `roles/bigquery.dataViewer`.
- **Empty results** - Verify data exists in the target BigQuery tables for the queried brand and date range.
