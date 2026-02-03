# KnewSearch AEO Visibility Platform

## Domain
KnewSearch.com

## Mission
Measure and improve brand visibility in AI generated search answers by monitoring prompts, generating answers via Gemini, extracting citations and brand mentions, storing results in BigQuery, scoring visibility, detecting change over time, and producing dashboards and weekly summaries.

## MVP Scope
- Prompt library seeded from config plus CRUD API
- Daily scheduled runs using Cloud Scheduler plus Pub Sub
- Gemini answer generation with retries and rate limiting
- Parsing for urls, domains, brand mentions, named entities
- Diff detection against prior run
- Embeddings using Vertex AI and vector storage in BigQuery
- Visibility scoring and trend tracking
- Minimal Next.js dashboard with read only views
- Weekly summary generation using Gemini written to BigQuery and email ready text

## Tech Stack
- Cloud Run
- Cloud Scheduler
- Pub Sub
- BigQuery
- Vertex AI
- Gemini API
- Secret Manager

## Repo Structure
```
services/       # Python FastAPI microservices
frontend/       # Next.js dashboard
infra/          # Terraform IaC
sql/            # DDL and scoring queries
docs/           # Architecture and contracts
scripts/        # Build, deploy, and test scripts
```
