# KnewSearch AEO Visibility Platform - Architecture Overview

## Service Map

| Service | Responsibility | Runtime | Status |
|---------|----------------|---------|--------|
| prompt_runner | Reads prompts from BigQuery, publishes batch messages to Pub/Sub | Cloud Run | Implemented |
| answer_generator | Consumes prompt messages, calls Gemini API, stores raw answers | Cloud Run | Implemented |
| parser | Consumes answer events, extracts citations, domains, brand mentions, named entities | Cloud Run | Implemented |
| scoring | Computes visibility scores from parsed data, writes to visibility_scores table | Cloud Run | Implemented |
| weekly_summary_v2 | Generates weekly executive summary via Gemini, handles missing scores gracefully | Cloud Run | **Implemented** |
| api_gateway | CRUD API for prompts, read endpoints for dashboard | Cloud Run | Planned |

## Job Flow

```
┌─────────────────┐
│ Cloud Scheduler │
│    (daily)      │
└────────┬────────┘
         │ trigger
         ▼
┌─────────────────┐
│  prompt_runner  │
└────────┬────────┘
         │ publish prompt batch
         ▼
┌─────────────────┐
│    Pub/Sub      │
│ (prompt-batch)  │
└────────┬────────┘
         │ consume
         ▼
┌─────────────────┐
│answer_generator │──────► Gemini API
└────────┬────────┘
         │ publish answer event
         ▼
┌─────────────────┐
│    Pub/Sub      │
│ (answer-events) │
└────────┬────────┘
         │ consume
         ▼
┌─────────────────┐
│     parser      │──────► Vertex AI (embeddings)
└────────┬────────┘
         │ write parsed data
         ▼
┌─────────────────┐
│    BigQuery     │
│  (ai_answers,   │
│   citations,    │
│   entities)     │
└────────┬────────┘
         │ read parsed data
         ▼
┌─────────────────┐
│    scoring      │──────► BigQuery (visibility_scores)
│  POST /score    │
└─────────────────┘

Scoring Service Details:
- Reads: ai_answers, citations, entities tables
- Writes: visibility_scores table (MERGE for idempotency)
- Formula: score = mention(0-50) + citation(0-50) - volatility(0-30)
- Outputs: Per-prompt scores AND aggregate brand scores
```

Weekly (separate schedule):
```
┌─────────────────┐
│ Cloud Scheduler │
│   (weekly)      │
└────────┬────────┘
         │ trigger POST /weekly
         ▼
┌─────────────────────┐
│  weekly_summary_v2  │
└──────────┬──────────┘
           │
     ┌─────┴─────────────────┐
     │ visibility_scores     │
     │ has data?             │
     └─────┬─────────────────┘
           │
     ┌─────┴─────┐
     ▼           ▼
┌─────────┐ ┌─────────────┐
│ Scores  │ │ Proxy       │
│ Metrics │ │ Metrics     │
│         │ │ (answers,   │
│         │ │  entities,  │
│         │ │  citations) │
└────┬────┘ └──────┬──────┘
     │             │
     └──────┬──────┘
            │
            ▼
┌─────────────────────┐
│     Gemini API      │──────► Generate Summary
│  (gemini-2.0-flash) │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│      BigQuery       │
│  (weekly_summaries) │
└─────────────────────┘
```

## Data Flow

```
Prompts (config seed + CRUD)
       │
       ▼
   answer_runs (run metadata)
       │
       ▼
   ai_answers (raw Gemini responses)
       │
       ├──► citations (extracted URLs, domains)
       │
       ├──► entities (brand mentions, named entities)
       │
       └──► embeddings (Vertex AI vectors)
               │
               ▼
       visibility_scores (aggregated metrics, trends)
               │
               ▼
       weekly_summaries (executive summary text)
```

## Core Tables

All tables reside in the `knewsearch_aeo` dataset.

| Table | Purpose | Partitioning | Clustering |
|-------|---------|--------------|------------|
| prompts | Stores prompt library (text, category, brand, active flag) | None | prompt_id |
| answer_runs | Tracks each scheduled run (run_id, start_time, status, prompt_count) | None | run_id |
| ai_answers | Raw Gemini responses per prompt per run | event_date | prompt_id, brand |
| citations | Extracted URLs and domains from answers | event_date | domain, prompt_id |
| entities | Brand mentions and named entities found in answers | event_date | brand, prompt_id |
| embeddings | Vertex AI vector embeddings for semantic similarity and diff detection | None | prompt_id |
| visibility_scores | Computed visibility metrics and trend deltas per brand per prompt | event_date | brand, prompt_id |
| weekly_summaries | Gemini-generated executive summary text, email-ready | event_date | brand |

## MVP Success Criteria

1. **Daily run completes** with stored answers, citations, and scores
2. **Dashboard shows** brand visibility trend and top citations
3. **Weekly summary** is generated and stored in BigQuery
4. **End-to-end smoke test** script passes from fresh project

## Schedule Summary

| Cadence | What Runs |
|---------|-----------|
| **Daily** | prompt_runner → answer_generator → parser → scoring |
| **Weekly** | weekly_summary |

## Scoring Service Details

### Visibility Score Formula

```
visibility_score = mention_score + citation_score - volatility_penalty

Components:
├── mention_score (0-50)
│   └── 50 if brand mentioned in entities, else 0
├── citation_score (0-50)
│   └── min(50, 10 × citation_count)
└── volatility_penalty (0-30)
    └── min(30, 5 × volatility_rank)
```

### Volatility Ranks

| Rank | Similarity | Label |
|------|------------|-------|
| 0 | ≥ 0.95 | Stable |
| 1 | 0.85-0.95 | Minor change |
| 2 | 0.70-0.85 | Moderate change |
| 3 | 0.50-0.70 | Significant change |
| 4 | 0.30-0.50 | Major change |
| 5 | 0.10-0.30 | Substantial rewrite |
| 6 | < 0.10 | Complete rewrite |

### Score Types

- **Aggregate Scores**: One per brand per day (`prompt_id = NULL`)
- **Prompt Scores**: One per brand per prompt per day

### SQL Templates

Located in `sql/scoring/`:

| File | Purpose |
|------|---------|
| `brand_scores.sql` | Compute aggregate brand visibility scores |
| `prompt_scores.sql` | Compute per-prompt visibility scores |
| `top_citation_domains.sql` | Top domains cited per brand |
| `volatility_metrics.sql` | Answer change analysis |

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/score` | Compute scores for a date |
| GET | `/scores/{date}` | Retrieve computed scores |

## Weekly Summary V2 Service Details

### Overview

The `weekly_summary_v2` service generates AI-powered executive summaries for brand visibility tracking. It gracefully handles the case where `visibility_scores` table is empty by using proxy metrics from `ai_answers`, `entities`, and `citations` tables.

### Data Source Selection

```
┌─────────────────────────────┐
│ Check visibility_scores     │
│ for brand + date range      │
└──────────────┬──────────────┘
               │
        has rows?
               │
       ┌───────┴───────┐
       │               │
       ▼               ▼
   ┌───────┐       ┌───────────┐
   │ YES   │       │ NO        │
   └───┬───┘       └─────┬─────┘
       │                 │
       ▼                 ▼
┌─────────────┐   ┌──────────────┐
│ Score-based │   │ Proxy-based  │
│ Metrics     │   │ Metrics      │
│             │   │              │
│ - visibility│   │ - answer cnt │
│   score avg │   │ - brand      │
│ - citation  │   │   mentions   │
│   score     │   │ - citation   │
│ - WoW delta │   │   counts     │
│ - best/worst│   │ - top        │
│   prompts   │   │   entities   │
└─────────────┘   └──────────────┘
```

### Idempotency

Summary IDs are generated deterministically:

```
summary_id = "sum_" + sha256(brand:start_date:end_date)[:12]
```

This ensures:
- Same brand + date range always produces same ID
- Duplicate API calls return consistent results
- BigQuery inserts are naturally deduplicated

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/weekly` | Generate weekly summary for a brand |

### Request/Response

**Request:**
```json
{
  "brand": "KnewSearch",
  "end_date": "2025-02-03",
  "lookback_days": 7
}
```

**Response:**
```json
{
  "summary_id": "sum_abc123def456",
  "brand": "KnewSearch",
  "start_date": "2025-01-28",
  "end_date": "2025-02-03",
  "email_ready_text": "Executive summary...",
  "summary_json": {
    "executive_summary": "...",
    "what_changed": "...",
    "top_wins": ["..."],
    "top_losses": ["..."],
    "recommended_actions": ["..."],
    "visibility_trend": "up"
  },
  "created_at": "2025-02-03T12:00:00Z"
}
```

### SQL Templates

Located in `sql/weekly_summary/`:

| File | Purpose |
|------|---------|
| `check_visibility_scores.sql` | Determine if scores exist for date range |
| `week_metrics_with_scores.sql` | Pull metrics when visibility_scores has data |
| `week_metrics_proxy.sql` | Pull proxy metrics when scores are empty |

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GCP_PROJECT_ID` | Yes | - | Google Cloud project ID |
| `GEMINI_API_KEY` | Yes | - | Gemini API key |
| `BQ_DATASET` | No | `knewsearch_aeo` | BigQuery dataset |
| `GEMINI_MODEL` | No | `gemini-2.0-flash` | Gemini model |
| `MAX_RETRIES` | No | `3` | Retry count for Gemini |

### Gemini Integration

- Uses `gemini-2.0-flash` by default (configurable)
- Implements exponential backoff for 429 and 5xx errors
- Logs model name and latency for each call
- Structured prompt includes all available metrics
