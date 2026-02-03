# Answer Generator Service

Cloud Run service that generates AI answers using Gemini and stores results in BigQuery.

## Responsibilities

1. Consume `prompt_run_requested` Pub/Sub messages
2. Call Gemini API to generate answer text
3. Write `ai_answers` rows to BigQuery
4. Publish `answer_generated` messages

## Message Contracts

See [docs/architecture/contracts.md](../../docs/architecture/contracts.md) for full contract details.

### Input: prompt_run_requested

```json
{
  "run_id": "run_2025-02-03_daily_001",
  "run_type": "scheduled",
  "triggered_by": "cloud_scheduler",
  "prompts": [
    {
      "prompt_id": "prm_acme_best_crm",
      "prompt_text": "What is the best CRM software?",
      "brand": "Acme Corp",
      "category": "brand"
    }
  ],
  "options": {
    "model_version": "gemini-1.5-pro"
  },
  "timestamp": "2025-02-03T06:00:00Z"
}
```

### Output: answer_generated

```json
{
  "answer_id": "ans_2025-02-03_prm_acme_best_crm_abc123",
  "run_id": "run_2025-02-03_daily_001",
  "prompt_id": "prm_acme_best_crm",
  "brand": "Acme Corp",
  "event_date": "2025-02-03",
  "prompt_text": "What is the best CRM software?",
  "raw_answer": "For small businesses...",
  "model_version": "gemini-1.5-pro",
  "token_count": { "prompt": 45, "response": 312 },
  "latency_ms": 1847,
  "timestamp": "2025-02-03T06:00:12Z"
}
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GCP_PROJECT_ID` | Yes | - | Google Cloud project ID |
| `BQ_DATASET` | No | `knewsearch_aeo` | BigQuery dataset name |
| `PUBSUB_TOPIC_ANSWER_GENERATED` | No | `answer_generated` | Output Pub/Sub topic |
| `GEMINI_MODEL` | No | `gemini-1.5-pro` | Default Gemini model |
| `GEMINI_API_KEY` | Yes | - | Gemini API key |
| `LOG_LEVEL` | No | `INFO` | Logging level |
| `MAX_RETRIES` | No | `3` | Max retry attempts for Gemini |
| `RETRY_BACKOFF_BASE` | No | `2` | Base seconds for exponential backoff |
| `PORT` | No | `8080` | Server port |

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/` | Pub/Sub push handler |
| `POST` | `/generate` | Direct invocation (testing) |

## Local Development

### Prerequisites

- Python 3.12+
- Google Cloud credentials configured
- BigQuery dataset and `ai_answers` table created
- Pub/Sub topic `answer_generated` created

### Setup

```bash
cd services/answer_generator

# Create virtual environment
python -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Set environment variables
export GCP_PROJECT_ID="your-project-id"
export GEMINI_API_KEY="your-api-key"
export BQ_DATASET="knewsearch_aeo"

# Run locally
python main.py
```

### Test with curl

```bash
# Health check
curl http://localhost:8080/health

# Direct generate endpoint
curl -X POST http://localhost:8080/generate \
  -H "Content-Type: application/json" \
  -d '{
    "run_id": "test_run_001",
    "run_type": "manual",
    "triggered_by": "manual",
    "prompts": [
      {
        "prompt_id": "test_prompt_001",
        "prompt_text": "What is the best CRM software for small businesses?",
        "brand": "TestBrand",
        "category": "brand"
      }
    ],
    "timestamp": "2025-02-03T12:00:00Z"
  }'
```

## Docker Build

```bash
# Build
docker build -t answer-generator .

# Run
docker run -p 8080:8080 \
  -e GCP_PROJECT_ID="your-project-id" \
  -e GEMINI_API_KEY="your-api-key" \
  answer-generator
```

## Deploy to Cloud Run

```bash
# Build and push to Artifact Registry
gcloud builds submit --tag gcr.io/${GCP_PROJECT_ID}/answer-generator

# Deploy
gcloud run deploy answer-generator \
  --image gcr.io/${GCP_PROJECT_ID}/answer-generator \
  --platform managed \
  --region us-central1 \
  --set-env-vars "GCP_PROJECT_ID=${GCP_PROJECT_ID}" \
  --set-secrets "GEMINI_API_KEY=gemini-api-key:latest" \
  --allow-unauthenticated
```

## Retry Behavior

The service implements exponential backoff for retryable errors:

- **429 (Rate Limited)**: Retries with backoff
- **5xx (Server Errors)**: Retries with backoff
- **Other errors**: Fails immediately

Default: 3 retries with base backoff of 2 seconds (2s, 4s, 8s).

## Logging

All logs are structured JSON for Cloud Logging compatibility:

```json
{
  "severity": "INFO",
  "message": "Gemini call successful",
  "service": "answer_generator",
  "run_id": "run_2025-02-03_daily_001",
  "prompt_id": "prm_acme_best_crm",
  "latency_ms": 1847,
  "model": "gemini-1.5-pro",
  "timestamp": "2025-02-03T06:00:12Z"
}
```
