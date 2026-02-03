# KnewSearch AEO Visibility Platform - Architecture Overview

## Service Map

| Service | Responsibility | Runtime |
|---------|----------------|---------|
| prompt_runner | Reads prompts from BigQuery, publishes batch messages to Pub/Sub | Cloud Run |
| answer_generator | Consumes prompt messages, calls Gemini API, stores raw answers | Cloud Run |
| parser | Consumes answer events, extracts citations, domains, brand mentions, named entities | Cloud Run |
| scoring | Runs aggregation queries, computes visibility scores, detects trends | Cloud Run |
| weekly_summary | Generates executive summary text via Gemini, writes to BigQuery | Cloud Run |
| api_gateway | CRUD API for prompts, read endpoints for dashboard | Cloud Run |

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
└────────┬────────┘
         │ aggregation queries
         ▼
┌─────────────────┐
│    scoring      │
└────────┬────────┘
         │ write scores
         ▼
┌─────────────────┐
│    BigQuery     │
│(visibility_scores)
└─────────────────┘
```

Weekly (separate schedule):
```
┌─────────────────┐
│ Cloud Scheduler │
│   (weekly)      │
└────────┬────────┘
         │ trigger
         ▼
┌─────────────────┐
│ weekly_summary  │──────► Gemini API
└────────┬────────┘
         │ write summary
         ▼
┌─────────────────┐
│    BigQuery     │
│(weekly_summaries)
└─────────────────┘
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
