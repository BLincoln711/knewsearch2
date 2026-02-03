# Prompt Runner Service

FastAPI service that triggers prompt runs for the KnewSearch AEO Visibility Platform.

## Responsibilities

- Read active prompts from BigQuery (`prompts` table where `is_active = TRUE`)
- Create a `run_id` and write to `answer_runs` table
- Publish one Pub/Sub message per prompt using the `prompt_run_requested` contract

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/run` | Trigger a prompt run, returns `run_id` and counts |
| GET | `/health` | Health check, returns `ok` |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GCP_PROJECT_ID` | Google Cloud project ID | (required) |
| `BQ_DATASET` | BigQuery dataset name | `knewsearch_aeo` |
| `PUBSUB_TOPIC_PROMPT_RUN` | Pub/Sub topic for prompt runs | `prompt_run_requested` |
| `SERVICE_NAME` | Service identifier for logging | `prompt_runner` |
| `LOG_LEVEL` | Logging level | `INFO` |
| `PORT` | HTTP server port | `8080` |

## Local Development

### Prerequisites

- Python 3.12+
- Google Cloud credentials configured
- BigQuery dataset and tables created
- Pub/Sub topic created

### Run Locally

```bash
cd services/prompt_runner

# Create virtual environment
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Set environment variables
export GCP_PROJECT_ID=your-project-id
export BQ_DATASET=knewsearch_aeo
export PUBSUB_TOPIC_PROMPT_RUN=prompt_run_requested

# Run the service
python main.py
```

### Test the Endpoints

```bash
# Health check
curl http://localhost:8080/health

# Trigger a run
curl -X POST http://localhost:8080/run \
  -H "Content-Type: application/json" \
  -d '{"run_type": "manual", "triggered_by": "api"}'

# Trigger a run with idempotency key
curl -X POST http://localhost:8080/run \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: my-unique-key" \
  -d '{"run_type": "manual", "triggered_by": "api"}'
```

## Deploy to Cloud Run

```bash
# Build and push container
gcloud builds submit --tag gcr.io/$GCP_PROJECT_ID/prompt-runner

# Deploy to Cloud Run
gcloud run deploy prompt-runner \
  --image gcr.io/$GCP_PROJECT_ID/prompt-runner \
  --platform managed \
  --region us-central1 \
  --set-env-vars GCP_PROJECT_ID=$GCP_PROJECT_ID,BQ_DATASET=knewsearch_aeo \
  --allow-unauthenticated
```

## API Reference

### POST /run

Trigger a prompt run.

**Request Body:**

```json
{
  "run_type": "manual",
  "triggered_by": "api",
  "options": {
    "model_version": "gemini-1.5-pro",
    "retry_failed_only": false
  },
  "idempotency_key": "optional-unique-key"
}
```

**Response:**

```json
{
  "run_id": "run_2025-02-03_a1b2c3d4",
  "status": "pending",
  "prompt_count": 15,
  "messages_published": 15,
  "idempotency_key": "optional-unique-key"
}
```

### GET /health

Health check endpoint.

**Response:**

```json
{
  "status": "ok",
  "service": "prompt_runner",
  "timestamp": "2025-02-03T12:00:00Z"
}
```

## Idempotency

The service supports idempotency to ensure reruns are safe:

- Pass an `X-Idempotency-Key` header or include `idempotency_key` in the request body
- If the same key is used again, the cached response is returned without creating a new run
- Note: In MVP, the cache is in-memory; use Redis for production
