# Pipeline Contracts

This document defines the Pub/Sub message contracts and shared environment variables for the KnewSearch AEO Visibility Platform.

## Pub/Sub Topics

| Topic | Publisher | Subscriber | Purpose |
|-------|-----------|------------|---------|
| `prompt_run_requested` | prompt_runner | answer_generator | Triggers answer generation for a batch of prompts |
| `answer_generated` | answer_generator | parser | Notifies that a raw answer is ready for parsing |
| `answer_parsed` | parser | scoring | Notifies that citations/entities are extracted and ready for scoring |

---

## Message Contracts

### prompt_run_requested

Published by `prompt_runner` service when a scheduled or manual run is initiated.

**Topic:** `projects/${GCP_PROJECT_ID}/topics/prompt_run_requested`

**Payload Schema:**

```json
{
  "run_id": "string (required) - Unique identifier for this run",
  "run_type": "string (required) - One of: scheduled, manual, backfill",
  "triggered_by": "string (required) - Source: cloud_scheduler, api, manual",
  "prompts": [
    {
      "prompt_id": "string (required) - Unique prompt identifier",
      "prompt_text": "string (required) - The prompt to send to Gemini",
      "brand": "string (optional) - Brand being tracked",
      "category": "string (optional) - Prompt category"
    }
  ],
  "options": {
    "model_version": "string (optional) - Gemini model to use",
    "retry_failed_only": "boolean (optional) - Only retry previously failed prompts"
  },
  "timestamp": "string (required) - ISO 8601 timestamp"
}
```

**Full Example:**

```json
{
  "run_id": "run_2025-02-03_daily_001",
  "run_type": "scheduled",
  "triggered_by": "cloud_scheduler",
  "prompts": [
    {
      "prompt_id": "prm_acme_best_crm",
      "prompt_text": "What is the best CRM software for small businesses?",
      "brand": "Acme Corp",
      "category": "brand"
    },
    {
      "prompt_id": "prm_acme_crm_compare",
      "prompt_text": "Compare Acme CRM vs Salesforce vs HubSpot",
      "brand": "Acme Corp",
      "category": "competitor"
    },
    {
      "prompt_id": "prm_industry_crm_trends",
      "prompt_text": "What are the top CRM trends in 2025?",
      "brand": "Acme Corp",
      "category": "industry"
    }
  ],
  "options": {
    "model_version": "gemini-1.5-pro",
    "retry_failed_only": false
  },
  "timestamp": "2025-02-03T06:00:00Z"
}
```

---

### answer_generated

Published by `answer_generator` service after successfully receiving a response from Gemini.

**Topic:** `projects/${GCP_PROJECT_ID}/topics/answer_generated`

**Payload Schema:**

```json
{
  "answer_id": "string (required) - Unique identifier for this answer",
  "run_id": "string (required) - Reference to the parent run",
  "prompt_id": "string (required) - Reference to the prompt",
  "brand": "string (optional) - Brand being tracked",
  "event_date": "string (required) - Date in YYYY-MM-DD format",
  "prompt_text": "string (required) - The prompt that was sent",
  "raw_answer": "string (required) - Raw response from Gemini",
  "model_version": "string (required) - Model used",
  "token_count": {
    "prompt": "integer (optional) - Tokens in prompt",
    "response": "integer (optional) - Tokens in response"
  },
  "latency_ms": "integer (optional) - Response time in milliseconds",
  "timestamp": "string (required) - ISO 8601 timestamp"
}
```

**Full Example:**

```json
{
  "answer_id": "ans_2025-02-03_prm_acme_best_crm_001",
  "run_id": "run_2025-02-03_daily_001",
  "prompt_id": "prm_acme_best_crm",
  "brand": "Acme Corp",
  "event_date": "2025-02-03",
  "prompt_text": "What is the best CRM software for small businesses?",
  "raw_answer": "For small businesses, several CRM options stand out:\n\n1. **HubSpot CRM** - Offers a robust free tier with contact management, email tracking, and pipeline management. Great for startups. [Source: hubspot.com/crm]\n\n2. **Acme CRM** - Known for its intuitive interface and strong customer support. Pricing starts at $29/month. [Source: acmecrm.com]\n\n3. **Salesforce Essentials** - Enterprise-grade features scaled for small teams at $25/user/month. [Source: salesforce.com/small-business]\n\n4. **Zoho CRM** - Affordable option with good automation features. [Source: zoho.com/crm]\n\nThe best choice depends on your specific needs, budget, and team size. HubSpot is often recommended for those just starting out, while Acme CRM offers excellent value for growing businesses.",
  "model_version": "gemini-1.5-pro",
  "token_count": {
    "prompt": 45,
    "response": 312
  },
  "latency_ms": 1847,
  "timestamp": "2025-02-03T06:00:12Z"
}
```

---

### answer_parsed

Published by `parser` service after extracting citations, entities, and brand mentions from an answer.

**Topic:** `projects/${GCP_PROJECT_ID}/topics/answer_parsed`

**Payload Schema:**

```json
{
  "answer_id": "string (required) - Reference to the parsed answer",
  "run_id": "string (required) - Reference to the parent run",
  "prompt_id": "string (required) - Reference to the prompt",
  "brand": "string (optional) - Brand being tracked",
  "event_date": "string (required) - Date in YYYY-MM-DD format",
  "citations": [
    {
      "citation_id": "string (required) - Unique citation identifier",
      "url": "string (required) - The cited URL",
      "domain": "string (required) - Extracted domain",
      "position": "integer (required) - Position in answer (1-indexed)",
      "anchor_text": "string (optional) - Associated text",
      "is_brand_owned": "boolean (required) - Belongs to tracked brand",
      "is_competitor": "boolean (required) - Belongs to competitor"
    }
  ],
  "entities": [
    {
      "entity_id": "string (required) - Unique entity identifier",
      "entity_text": "string (required) - The entity text",
      "entity_type": "string (required) - Type: brand, product, person, organization",
      "mention_count": "integer (required) - Times mentioned",
      "is_target_brand": "boolean (required) - Is the tracked brand",
      "is_competitor": "boolean (required) - Is a competitor",
      "sentiment": "string (optional) - positive, neutral, negative",
      "confidence_score": "number (optional) - 0.0 to 1.0"
    }
  ],
  "summary": {
    "total_citations": "integer (required)",
    "brand_citations": "integer (required)",
    "competitor_citations": "integer (required)",
    "total_entities": "integer (required)",
    "brand_mentions": "integer (required)",
    "competitor_mentions": "integer (required)"
  },
  "timestamp": "string (required) - ISO 8601 timestamp"
}
```

**Full Example:**

```json
{
  "answer_id": "ans_2025-02-03_prm_acme_best_crm_001",
  "run_id": "run_2025-02-03_daily_001",
  "prompt_id": "prm_acme_best_crm",
  "brand": "Acme Corp",
  "event_date": "2025-02-03",
  "citations": [
    {
      "citation_id": "cit_001_hubspot",
      "url": "https://hubspot.com/crm",
      "domain": "hubspot.com",
      "position": 1,
      "anchor_text": "hubspot.com/crm",
      "is_brand_owned": false,
      "is_competitor": true
    },
    {
      "citation_id": "cit_002_acme",
      "url": "https://acmecrm.com",
      "domain": "acmecrm.com",
      "position": 2,
      "anchor_text": "acmecrm.com",
      "is_brand_owned": true,
      "is_competitor": false
    },
    {
      "citation_id": "cit_003_salesforce",
      "url": "https://salesforce.com/small-business",
      "domain": "salesforce.com",
      "position": 3,
      "anchor_text": "salesforce.com/small-business",
      "is_brand_owned": false,
      "is_competitor": true
    },
    {
      "citation_id": "cit_004_zoho",
      "url": "https://zoho.com/crm",
      "domain": "zoho.com",
      "position": 4,
      "anchor_text": "zoho.com/crm",
      "is_brand_owned": false,
      "is_competitor": true
    }
  ],
  "entities": [
    {
      "entity_id": "ent_001_hubspot",
      "entity_text": "HubSpot CRM",
      "entity_type": "brand",
      "mention_count": 2,
      "is_target_brand": false,
      "is_competitor": true,
      "sentiment": "positive",
      "confidence_score": 0.95
    },
    {
      "entity_id": "ent_002_acme",
      "entity_text": "Acme CRM",
      "entity_type": "brand",
      "mention_count": 2,
      "is_target_brand": true,
      "is_competitor": false,
      "sentiment": "positive",
      "confidence_score": 0.98
    },
    {
      "entity_id": "ent_003_salesforce",
      "entity_text": "Salesforce Essentials",
      "entity_type": "brand",
      "mention_count": 1,
      "is_target_brand": false,
      "is_competitor": true,
      "sentiment": "neutral",
      "confidence_score": 0.92
    },
    {
      "entity_id": "ent_004_zoho",
      "entity_text": "Zoho CRM",
      "entity_type": "brand",
      "mention_count": 1,
      "is_target_brand": false,
      "is_competitor": true,
      "sentiment": "neutral",
      "confidence_score": 0.90
    }
  ],
  "summary": {
    "total_citations": 4,
    "brand_citations": 1,
    "competitor_citations": 3,
    "total_entities": 4,
    "brand_mentions": 2,
    "competitor_mentions": 4
  },
  "timestamp": "2025-02-03T06:00:15Z"
}
```

---

## Shared Environment Variables

All services should use these standardized environment variable names for configuration:

### Google Cloud Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `GCP_PROJECT_ID` | Google Cloud project ID | `knewsearch-prod` |
| `GCP_REGION` | Default GCP region | `us-central1` |
| `GCP_LOCATION` | Vertex AI location | `us-central1` |

### BigQuery Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `BQ_DATASET` | BigQuery dataset name | `knewsearch_aeo` |
| `BQ_LOCATION` | BigQuery dataset location | `US` |

### Pub/Sub Topics

| Variable | Description | Example |
|----------|-------------|---------|
| `PUBSUB_TOPIC_PROMPT_RUN` | Prompt run requested topic | `prompt_run_requested` |
| `PUBSUB_TOPIC_ANSWER_GENERATED` | Answer generated topic | `answer_generated` |
| `PUBSUB_TOPIC_ANSWER_PARSED` | Answer parsed topic | `answer_parsed` |

### AI/ML Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `GEMINI_MODEL` | Gemini model version | `gemini-1.5-pro` |
| `GEMINI_API_KEY` | Gemini API key (use Secret Manager) | `sm://gemini-api-key` |
| `EMBEDDING_MODEL` | Vertex AI embedding model | `text-embedding-004` |
| `EMBEDDING_DIMENSION` | Embedding vector dimension | `768` |

### Service Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `SERVICE_NAME` | Name of the current service | `answer_generator` |
| `LOG_LEVEL` | Logging level | `INFO` |
| `REQUEST_TIMEOUT_SECONDS` | Default request timeout | `30` |
| `MAX_RETRIES` | Maximum retry attempts | `3` |
| `RETRY_BACKOFF_BASE` | Base seconds for exponential backoff | `2` |

### API Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `API_KEY` | API authentication key (use Secret Manager) | `sm://api-key` |
| `API_RATE_LIMIT_PER_MINUTE` | Rate limit for API calls | `60` |
| `CORS_ORIGINS` | Allowed CORS origins | `https://knewsearch.com` |

### Scheduler Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `DAILY_RUN_SCHEDULE` | Cron expression for daily runs | `0 6 * * *` |
| `WEEKLY_SUMMARY_SCHEDULE` | Cron expression for weekly summaries | `0 8 * * 1` |
| `TIMEZONE` | Timezone for schedules | `America/Chicago` |
