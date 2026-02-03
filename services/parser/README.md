# Parser Service

Cloud Run Pub/Sub push consumer that extracts citations and named entities from AI-generated answers.

## Responsibilities

- Consume `answer_generated` Pub/Sub messages from the answer_generator service
- Extract URLs and domains from answer text
- Extract brand mentions based on the tracked brand
- Extract named entities (organizations, products, brands)
- Write citations and entities rows to BigQuery
- Compute diff metadata vs previous answer for the same prompt
- Update `ai_answers` table with diff metadata
- Publish `answer_parsed` messages for downstream scoring

## Message Contracts

### Input: `answer_generated`

```json
{
  "answer_id": "ans_2025-02-03_prm_acme_001",
  "run_id": "run_2025-02-03_daily_001",
  "prompt_id": "prm_acme_best_crm",
  "brand": "Acme Corp",
  "event_date": "2025-02-03",
  "prompt_text": "What is the best CRM?",
  "raw_answer": "The best CRM options include...",
  "model_version": "gemini-1.5-pro",
  "timestamp": "2025-02-03T06:00:12Z"
}
```

### Output: `answer_parsed`

```json
{
  "answer_id": "ans_2025-02-03_prm_acme_001",
  "run_id": "run_2025-02-03_daily_001",
  "prompt_id": "prm_acme_best_crm",
  "brand": "Acme Corp",
  "event_date": "2025-02-03",
  "citations": [...],
  "entities": [...],
  "summary": {
    "total_citations": 4,
    "brand_citations": 1,
    "competitor_citations": 3,
    "total_entities": 5,
    "brand_mentions": 2,
    "competitor_mentions": 4
  },
  "timestamp": "2025-02-03T06:00:15Z"
}
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GCP_PROJECT_ID` | Yes | - | Google Cloud project ID |
| `BQ_DATASET` | No | `knewsearch_aeo` | BigQuery dataset name |
| `PUBSUB_TOPIC_ANSWER_PARSED` | No | `answer_parsed` | Output Pub/Sub topic |
| `LOG_LEVEL` | No | `INFO` | Logging level |
| `PORT` | No | `8080` | HTTP server port |

## Local Development

### Prerequisites

- Python 3.12+
- Google Cloud SDK authenticated (`gcloud auth application-default login`)
- BigQuery tables created (see `sql/ddl/`)
- Pub/Sub topic `answer_parsed` created

### Setup

```bash
cd services/parser

# Create virtual environment
python -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Set environment variables
export GCP_PROJECT_ID="your-project-id"
export BQ_DATASET="knewsearch_aeo"
```

### Run Locally

```bash
python main.py
```

### Smoke Test

```bash
./scripts/smoke_parser.sh
```

## Endpoints

### `GET /health`

Health check endpoint.

**Response:**
```json
{"status": "healthy", "service": "parser"}
```

### `POST /`

Pub/Sub push endpoint. Expects base64-encoded message data.

**Request:**
```json
{
  "message": {
    "data": "<base64-encoded-answer_generated-message>"
  }
}
```

### `POST /parse`

Direct testing endpoint. Accepts raw `answer_generated` payload.

## Extraction Logic

### URL Extraction

Detects URLs in multiple formats:
- Markdown links: `[text](https://example.com)`
- Plain URLs: `https://example.com/path`
- Source references: `[Source: example.com/path]`
- Domain mentions: `example.com`

### Entity Extraction

Uses pattern matching to identify:
- Brand mentions (tracked brand with variations)
- Named entities (capitalized proper nouns)
- Product names (with indicators like CRM, Platform, etc.)

### Diff Detection

Computes change metadata against the most recent previous answer:
- `is_first_answer`: Boolean flag for first occurrence
- `has_changes`: Whether content differs
- `similarity_score`: Jaccard similarity (0.0-1.0)
- `words_added`/`words_removed`: Word-level diff counts
- `length_change`: Character count difference

## Deduplication

- Citation IDs are deterministic: `sha256(answer_id:url)[:12]`
- Entity IDs are deterministic: `sha256(answer_id:entity_text:entity_type)[:12]`
- Re-processing the same answer produces identical IDs

## Deployment

```bash
# Build container
docker build -t parser .

# Deploy to Cloud Run
gcloud run deploy parser \
  --image gcr.io/$GCP_PROJECT_ID/parser \
  --region us-central1 \
  --set-env-vars GCP_PROJECT_ID=$GCP_PROJECT_ID,BQ_DATASET=knewsearch_aeo

# Create Pub/Sub subscription with push
gcloud pubsub subscriptions create answer_generated-parser-push \
  --topic answer_generated \
  --push-endpoint https://parser-xxxxx.run.app/
```
