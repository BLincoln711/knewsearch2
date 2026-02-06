# Scoring Service

Cloud Run service that computes daily visibility scores per brand and per prompt by aggregating metrics from parsed AI answers.

## Overview

The scoring service reads from `ai_answers`, `citations`, and `entities` tables, computes visibility scores using a defined formula, and writes results to the `visibility_scores` table.

### Score Formula

```
visibility_score = mention_score + citation_score - volatility_penalty

Where:
- mention_score = 50 if brand mentioned in entities, else 0
- citation_score = min(50, 10 × citation_count)
- volatility_penalty = min(30, 5 × volatility_rank)
```

Volatility ranks (0-6) are derived from answer text similarity:
- 0: Stable (similarity ≥ 0.95)
- 1: Minor change (0.85-0.95)
- 2: Moderate change (0.70-0.85)
- 3: Significant change (0.50-0.70)
- 4: Major change (0.30-0.50)
- 5: Substantial rewrite (0.10-0.30)
- 6: Complete rewrite (< 0.10)

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GCP_PROJECT_ID` | Yes | - | Google Cloud project ID |
| `BQ_DATASET` | No | `knewsearch_aeo` | BigQuery dataset name |
| `SQL_DIR` | No | `../../sql/scoring` | Path to SQL template files |
| `LOG_LEVEL` | No | `INFO` | Logging level |
| `PORT` | No | `8080` | HTTP port |
| `SERVICE_NAME` | No | `scoring` | Service name for logging |

## Endpoints

### Health Check

```bash
GET /health
```

Returns:
```json
{
  "status": "healthy",
  "service": "scoring"
}
```

### Compute Scores

```bash
POST /score
Content-Type: application/json

{
  "brand": "optional-brand-filter",
  "run_id": "optional-run-id",
  "date": "2025-02-03"  // Optional, defaults to today
}
```

Returns:
```json
{
  "request_id": "score_abc12345",
  "date": "2025-02-03",
  "brand": null,
  "brands_scored": 5,
  "prompts_scored": 150,
  "aggregate_scores_written": 5,
  "prompt_scores_written": 150,
  "status": "success",
  "duration_ms": 3200,
  "errors": []
}
```

### Get Scores

```bash
GET /scores/{date}?brand=optional-brand
```

Returns computed scores for the specified date.

## Local Development

### Prerequisites

- Python 3.12+
- Google Cloud SDK (authenticated)
- Access to BigQuery dataset

### Setup

```bash
cd services/scoring

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Run Locally

```bash
# Set required environment variables
export GCP_PROJECT_ID="knewsearch-prod"
export BQ_DATASET="knewsearch_aeo"
export SQL_DIR="../../sql/scoring"

# Run the service
python main.py
```

Service will be available at `http://localhost:8080`

### Test Locally

```bash
# Health check
curl http://localhost:8080/health

# Compute scores for today
curl -X POST http://localhost:8080/score \
  -H "Content-Type: application/json" \
  -d '{"date": "2025-02-03"}'

# Get scores for a date
curl "http://localhost:8080/scores/2025-02-03"
```

## Docker Build

The service requires SQL template files at runtime. Build from the repository root to include them:

```bash
# From repository root
cd /path/to/knewsearch2

# Build image with SQL files
docker build -f services/scoring/Dockerfile.prod -t scoring-service .

# Or build locally and mount SQL at runtime
docker build -t scoring-service services/scoring/

# Run container (mount SQL files)
docker run -p 8080:8080 \
  -e GCP_PROJECT_ID=knewsearch-prod \
  -e BQ_DATASET=knewsearch_aeo \
  -e SQL_DIR=/app/sql/scoring \
  -e GOOGLE_APPLICATION_CREDENTIALS=/creds/credentials.json \
  -v $(pwd)/sql/scoring:/app/sql/scoring:ro \
  -v /path/to/credentials.json:/creds/credentials.json:ro \
  scoring-service
```

## Manual Deployment to Cloud Run

### Build and Push Image

Build from the repository root to include SQL template files:

```bash
# Set variables
PROJECT_ID="knewsearch-prod"
REGION="us-central1"
SERVICE_NAME="scoring"

# Navigate to repository root
cd /path/to/knewsearch2

# Build with Cloud Build (from repo root)
gcloud builds submit \
  --tag gcr.io/$PROJECT_ID/$SERVICE_NAME \
  --file services/scoring/Dockerfile.prod \
  .

# Or build locally and push
docker build -f services/scoring/Dockerfile.prod -t gcr.io/$PROJECT_ID/$SERVICE_NAME .
docker push gcr.io/$PROJECT_ID/$SERVICE_NAME
```

### Deploy to Cloud Run

```bash
gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
  --region $REGION \
  --platform managed \
  --memory 512Mi \
  --timeout 300 \
  --set-env-vars "GCP_PROJECT_ID=$PROJECT_ID,BQ_DATASET=knewsearch_aeo" \
  --service-account scoring-sa@$PROJECT_ID.iam.gserviceaccount.com \
  --no-allow-unauthenticated
```

### Required IAM Permissions

The service account needs:
- `roles/bigquery.dataEditor` - Read/write to BigQuery tables
- `roles/bigquery.jobUser` - Run BigQuery jobs

## Example Curl Calls

### Compute scores for today
```bash
curl -X POST https://scoring-xxxxx-uc.a.run.app/score \
  -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Compute scores for specific date
```bash
curl -X POST https://scoring-xxxxx-uc.a.run.app/score \
  -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
  -H "Content-Type: application/json" \
  -d '{"date": "2025-02-01"}'
```

### Compute scores for specific brand
```bash
curl -X POST https://scoring-xxxxx-uc.a.run.app/score \
  -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
  -H "Content-Type: application/json" \
  -d '{"brand": "Acme Corp", "date": "2025-02-01"}'
```

### Get computed scores
```bash
curl "https://scoring-xxxxx-uc.a.run.app/scores/2025-02-01?brand=Acme%20Corp" \
  -H "Authorization: Bearer $(gcloud auth print-identity-token)"
```

## SQL Templates

The service uses SQL templates from `sql/scoring/`:

| File | Purpose |
|------|---------|
| `brand_scores.sql` | Aggregate visibility scores per brand (prompt_id = NULL) |
| `prompt_scores.sql` | Per-prompt visibility scores |
| `top_citation_domains.sql` | Top domains cited per brand per day |
| `volatility_metrics.sql` | Answer change analysis |

All SQL templates use MERGE statements for idempotent writes.

## Monitoring

### Logs

View logs in Cloud Logging:
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=scoring" \
  --project=$PROJECT_ID \
  --limit=50 \
  --format=json
```

### Metrics

Key metrics to monitor:
- Request latency (aim for < 5s)
- Error rate
- `brands_scored` count per run
- `duration_ms` in response

## Troubleshooting

### No data found for date
- Verify pipeline ran for that date
- Check `ai_answers` table has records with `event_date`
- Ensure brands are not NULL in answers

### SQL template not found
- Verify `SQL_DIR` environment variable
- Check file permissions
- Ensure SQL files are copied in Docker build

### BigQuery permission denied
- Verify service account has `bigquery.dataEditor` role
- Check dataset-level permissions
