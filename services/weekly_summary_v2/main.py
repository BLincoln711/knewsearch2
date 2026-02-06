"""
Weekly Summary V2 Service

Cloud Run service that:
- Pulls weekly metrics from BigQuery (with or without visibility_scores)
- Calls Gemini API to generate executive summaries
- Writes weekly_summaries rows to BigQuery
- Returns email-ready text and JSON payload
"""

import hashlib
import json
import logging
import os
import sys
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import google.generativeai as genai
from fastapi import FastAPI, HTTPException
from google.api_core.exceptions import ResourceExhausted, ServiceUnavailable
from google.cloud import bigquery
from google.cloud import firestore as cloud_firestore
from pydantic import BaseModel, Field
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, Content

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------

SERVICE_NAME = os.getenv("SERVICE_NAME", "weekly_summary_v2")
GCP_PROJECT_ID = os.getenv("GCP_PROJECT_ID")
BQ_DATASET = os.getenv("BQ_DATASET", "knewsearch_aeo")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
MAX_RETRIES = int(os.getenv("MAX_RETRIES", "3"))
RETRY_BACKOFF_BASE = float(os.getenv("RETRY_BACKOFF_BASE", "2"))
SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY", "")
EMAIL_FROM = os.getenv("EMAIL_FROM", "reports@knewsearch.com")
EMAIL_ENABLED = os.getenv("EMAIL_ENABLED", "false").lower() == "true"

# -----------------------------------------------------------------------------
# Structured Logging
# -----------------------------------------------------------------------------


class StructuredLogFormatter(logging.Formatter):
    """JSON formatter for Cloud Logging compatibility."""

    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "severity": record.levelname,
            "message": record.getMessage(),
            "service": SERVICE_NAME,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        # Add extra fields if present
        if hasattr(record, "request_id"):
            log_entry["request_id"] = record.request_id
        if hasattr(record, "brand"):
            log_entry["brand"] = record.brand
        if hasattr(record, "summary_id"):
            log_entry["summary_id"] = record.summary_id
        if hasattr(record, "latency_ms"):
            log_entry["latency_ms"] = record.latency_ms
        if hasattr(record, "model"):
            log_entry["model"] = record.model
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_entry)


def setup_logging() -> logging.Logger:
    """Configure structured JSON logging."""
    logger = logging.getLogger(SERVICE_NAME)
    logger.setLevel(getattr(logging, LOG_LEVEL.upper(), logging.INFO))
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(StructuredLogFormatter())
    logger.handlers = [handler]
    return logger


logger = setup_logging()

# -----------------------------------------------------------------------------
# Pydantic Models
# -----------------------------------------------------------------------------


class WeeklySummaryRequest(BaseModel):
    """Request body for POST /weekly endpoint."""

    brand: str = Field(..., description="Brand to generate summary for")
    end_date: str | None = Field(None, description="End date (YYYY-MM-DD), defaults to today")
    lookback_days: int = Field(7, description="Number of days to look back", ge=1, le=30)


class WeeklySummaryResponse(BaseModel):
    """Response body for POST /weekly endpoint."""

    summary_id: str
    brand: str
    start_date: str
    end_date: str
    email_ready_text: str
    summary_json: dict[str, Any]
    created_at: str


# -----------------------------------------------------------------------------
# Clients (lazy initialization)
# -----------------------------------------------------------------------------

_bq_client: bigquery.Client | None = None


def get_bq_client() -> bigquery.Client:
    """Get or create BigQuery client."""
    global _bq_client
    if _bq_client is None:
        _bq_client = bigquery.Client(project=GCP_PROJECT_ID)
    return _bq_client


def configure_gemini() -> None:
    """Configure Gemini API client."""
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY environment variable is required")
    genai.configure(api_key=GEMINI_API_KEY)


# -----------------------------------------------------------------------------
# Summary ID Generation (Deterministic for Idempotency)
# -----------------------------------------------------------------------------


def generate_summary_id(brand: str, start_date: str, end_date: str) -> str:
    """
    Generate deterministic summary_id based on brand and date range.
    Ensures idempotent inserts - same input always produces same ID.
    """
    key = f"{brand}:{start_date}:{end_date}"
    hash_val = hashlib.sha256(key.encode()).hexdigest()[:12]
    return f"sum_{hash_val}"


# -----------------------------------------------------------------------------
# BigQuery Operations
# -----------------------------------------------------------------------------


def check_visibility_scores_exists(brand: str, start_date: str, end_date: str, request_id: str) -> bool:
    """Check if visibility_scores has data for the given brand and date range."""
    client = get_bq_client()

    query = f"""
    SELECT COUNT(*) as row_count
    FROM `{GCP_PROJECT_ID}.{BQ_DATASET}.visibility_scores`
    WHERE brand = @brand
      AND event_date BETWEEN @start_date AND @end_date
    """

    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("brand", "STRING", brand),
            bigquery.ScalarQueryParameter("start_date", "DATE", start_date),
            bigquery.ScalarQueryParameter("end_date", "DATE", end_date),
        ]
    )

    try:
        results = client.query(query, job_config=job_config).result()
        row = next(iter(results))
        has_data = row.row_count > 0

        logger.info(
            f"visibility_scores check: {row.row_count} rows found",
            extra={"request_id": request_id, "brand": brand},
        )
        return has_data

    except Exception as e:
        # If table doesn't exist or other error, assume no scores
        logger.warning(
            f"visibility_scores check failed: {e}",
            extra={"request_id": request_id, "brand": brand},
        )
        return False


def fetch_metrics_with_scores(
    brand: str, start_date: str, end_date: str, prev_start: str, prev_end: str, request_id: str
) -> dict[str, Any]:
    """Fetch weekly metrics when visibility_scores has data."""
    client = get_bq_client()

    query = f"""
    WITH current_week AS (
      SELECT
        brand,
        AVG(visibility_score) AS avg_visibility_score,
        AVG(citation_score) AS avg_citation_score,
        AVG(mention_score) AS avg_mention_score,
        AVG(sentiment_score) AS avg_sentiment_score,
        SUM(total_prompts) AS total_prompts,
        SUM(prompts_with_citation) AS prompts_with_citation,
        SUM(prompts_with_mention) AS prompts_with_mention,
        SUM(total_citations) AS total_citations,
        SUM(total_mentions) AS total_mentions,
        AVG(avg_citation_position) AS avg_citation_position
      FROM `{GCP_PROJECT_ID}.{BQ_DATASET}.visibility_scores`
      WHERE brand = @brand
        AND event_date BETWEEN @start_date AND @end_date
      GROUP BY brand
    ),
    previous_week AS (
      SELECT
        brand,
        AVG(visibility_score) AS avg_visibility_score
      FROM `{GCP_PROJECT_ID}.{BQ_DATASET}.visibility_scores`
      WHERE brand = @brand
        AND event_date BETWEEN @prev_start AND @prev_end
      GROUP BY brand
    ),
    best_prompts AS (
      SELECT prompt_id, AVG(visibility_score) AS avg_score
      FROM `{GCP_PROJECT_ID}.{BQ_DATASET}.visibility_scores`
      WHERE brand = @brand AND event_date BETWEEN @start_date AND @end_date AND prompt_id IS NOT NULL
      GROUP BY prompt_id ORDER BY avg_score DESC LIMIT 5
    ),
    worst_prompts AS (
      SELECT prompt_id, AVG(visibility_score) AS avg_score
      FROM `{GCP_PROJECT_ID}.{BQ_DATASET}.visibility_scores`
      WHERE brand = @brand AND event_date BETWEEN @start_date AND @end_date AND prompt_id IS NOT NULL
      GROUP BY prompt_id ORDER BY avg_score ASC LIMIT 5
    ),
    top_domains AS (
      SELECT domain, COUNT(*) AS citation_count, COUNTIF(is_brand_owned) AS brand_owned
      FROM `{GCP_PROJECT_ID}.{BQ_DATASET}.citations`
      WHERE brand = @brand AND event_date BETWEEN @start_date AND @end_date
      GROUP BY domain ORDER BY citation_count DESC LIMIT 10
    ),
    volatility AS (
      SELECT STDDEV(visibility_score) AS score_volatility
      FROM `{GCP_PROJECT_ID}.{BQ_DATASET}.visibility_scores`
      WHERE brand = @brand AND event_date BETWEEN @start_date AND @end_date
    )
    SELECT
      cw.avg_visibility_score,
      cw.avg_citation_score,
      cw.avg_mention_score,
      cw.total_prompts,
      cw.prompts_with_citation,
      cw.total_citations,
      cw.total_mentions,
      COALESCE(cw.avg_visibility_score - pw.avg_visibility_score, 0) AS visibility_change,
      CASE
        WHEN pw.avg_visibility_score > 0
        THEN ROUND((cw.avg_visibility_score - pw.avg_visibility_score) / pw.avg_visibility_score * 100, 2)
        ELSE NULL
      END AS visibility_change_pct,
      CASE
        WHEN cw.avg_visibility_score > pw.avg_visibility_score THEN 'up'
        WHEN cw.avg_visibility_score < pw.avg_visibility_score THEN 'down'
        ELSE 'stable'
      END AS visibility_trend,
      v.score_volatility,
      ARRAY(SELECT AS STRUCT prompt_id, avg_score FROM best_prompts) AS best_prompts,
      ARRAY(SELECT AS STRUCT prompt_id, avg_score FROM worst_prompts) AS worst_prompts,
      ARRAY(SELECT AS STRUCT domain, citation_count, brand_owned FROM top_domains) AS top_domains
    FROM current_week cw
    LEFT JOIN previous_week pw ON cw.brand = pw.brand
    CROSS JOIN volatility v
    """

    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("brand", "STRING", brand),
            bigquery.ScalarQueryParameter("start_date", "DATE", start_date),
            bigquery.ScalarQueryParameter("end_date", "DATE", end_date),
            bigquery.ScalarQueryParameter("prev_start", "DATE", prev_start),
            bigquery.ScalarQueryParameter("prev_end", "DATE", prev_end),
        ]
    )

    results = client.query(query, job_config=job_config).result()
    row = next(iter(results), None)

    if not row:
        logger.warning(
            "No metrics found with scores",
            extra={"request_id": request_id, "brand": brand},
        )
        return {"has_scores": True, "no_data": True}

    metrics = {
        "has_scores": True,
        "avg_visibility_score": row.avg_visibility_score,
        "avg_citation_score": row.avg_citation_score,
        "avg_mention_score": row.avg_mention_score,
        "total_prompts": row.total_prompts,
        "prompts_with_citation": row.prompts_with_citation,
        "total_citations": row.total_citations,
        "total_mentions": row.total_mentions,
        "visibility_change": row.visibility_change,
        "visibility_change_pct": row.visibility_change_pct,
        "visibility_trend": row.visibility_trend,
        "score_volatility": row.score_volatility,
        "best_prompts": [{"prompt_id": p.prompt_id, "score": p.avg_score} for p in row.best_prompts] if row.best_prompts else [],
        "worst_prompts": [{"prompt_id": p.prompt_id, "score": p.avg_score} for p in row.worst_prompts] if row.worst_prompts else [],
        "top_domains": [{"domain": d.domain, "count": d.citation_count, "brand_owned": d.brand_owned} for d in row.top_domains] if row.top_domains else [],
    }

    logger.info(
        "Fetched metrics with visibility scores",
        extra={"request_id": request_id, "brand": brand},
    )
    return metrics


def fetch_metrics_proxy(
    brand: str, start_date: str, end_date: str, prev_start: str, prev_end: str, request_id: str
) -> dict[str, Any]:
    """Fetch proxy metrics when visibility_scores is empty."""
    client = get_bq_client()

    query = f"""
    WITH current_answers AS (
      SELECT
        COUNT(DISTINCT answer_id) AS answer_count,
        COUNT(DISTINCT prompt_id) AS unique_prompts,
        COUNT(DISTINCT run_id) AS run_count
      FROM `{GCP_PROJECT_ID}.{BQ_DATASET}.ai_answers`
      WHERE brand = @brand AND event_date BETWEEN @start_date AND @end_date
    ),
    previous_answers AS (
      SELECT COUNT(DISTINCT answer_id) AS answer_count
      FROM `{GCP_PROJECT_ID}.{BQ_DATASET}.ai_answers`
      WHERE brand = @brand AND event_date BETWEEN @prev_start AND @prev_end
    ),
    current_entities AS (
      SELECT
        COUNT(*) AS total_mentions,
        COUNTIF(is_target_brand) AS brand_mentions,
        COUNTIF(is_competitor) AS competitor_mentions,
        COUNT(DISTINCT entity_text) AS unique_entities
      FROM `{GCP_PROJECT_ID}.{BQ_DATASET}.entities`
      WHERE brand = @brand AND event_date BETWEEN @start_date AND @end_date
    ),
    previous_entities AS (
      SELECT COUNTIF(is_target_brand) AS brand_mentions
      FROM `{GCP_PROJECT_ID}.{BQ_DATASET}.entities`
      WHERE brand = @brand AND event_date BETWEEN @prev_start AND @prev_end
    ),
    current_citations AS (
      SELECT
        COUNT(*) AS total_citations,
        COUNT(DISTINCT domain) AS unique_domains,
        COUNTIF(is_brand_owned) AS brand_owned_citations
      FROM `{GCP_PROJECT_ID}.{BQ_DATASET}.citations`
      WHERE brand = @brand AND event_date BETWEEN @start_date AND @end_date
    ),
    top_entities AS (
      SELECT entity_text, entity_type, SUM(mention_count) AS mentions
      FROM `{GCP_PROJECT_ID}.{BQ_DATASET}.entities`
      WHERE brand = @brand AND event_date BETWEEN @start_date AND @end_date
      GROUP BY entity_text, entity_type ORDER BY mentions DESC LIMIT 10
    ),
    top_prompts AS (
      SELECT prompt_id, COUNT(*) AS answer_count
      FROM `{GCP_PROJECT_ID}.{BQ_DATASET}.ai_answers`
      WHERE brand = @brand AND event_date BETWEEN @start_date AND @end_date
      GROUP BY prompt_id ORDER BY answer_count DESC LIMIT 10
    ),
    top_domains AS (
      SELECT domain, COUNT(*) AS citation_count, COUNTIF(is_brand_owned) AS brand_owned
      FROM `{GCP_PROJECT_ID}.{BQ_DATASET}.citations`
      WHERE brand = @brand AND event_date BETWEEN @start_date AND @end_date
      GROUP BY domain ORDER BY citation_count DESC LIMIT 10
    )
    SELECT
      ca.answer_count,
      ca.unique_prompts AS prompts_analyzed,
      ca.run_count,
      ce.total_mentions AS entity_mentions,
      ce.brand_mentions,
      ce.competitor_mentions,
      ce.unique_entities,
      cc.total_citations,
      cc.unique_domains,
      cc.brand_owned_citations,
      COALESCE(ca.answer_count, 0) - COALESCE(pa.answer_count, 0) AS answer_change,
      COALESCE(ce.brand_mentions, 0) - COALESCE(pe.brand_mentions, 0) AS mention_change,
      CASE
        WHEN COALESCE(ce.brand_mentions, 0) > COALESCE(pe.brand_mentions, 0) THEN 'up'
        WHEN COALESCE(ce.brand_mentions, 0) < COALESCE(pe.brand_mentions, 0) THEN 'down'
        ELSE 'stable'
      END AS visibility_trend,
      ARRAY(SELECT AS STRUCT entity_text, entity_type, mentions FROM top_entities) AS top_entities,
      ARRAY(SELECT AS STRUCT prompt_id, answer_count FROM top_prompts) AS top_prompts,
      ARRAY(SELECT AS STRUCT domain, citation_count, brand_owned FROM top_domains) AS top_domains
    FROM current_answers ca
    CROSS JOIN previous_answers pa
    CROSS JOIN current_entities ce
    CROSS JOIN previous_entities pe
    CROSS JOIN current_citations cc
    """

    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("brand", "STRING", brand),
            bigquery.ScalarQueryParameter("start_date", "DATE", start_date),
            bigquery.ScalarQueryParameter("end_date", "DATE", end_date),
            bigquery.ScalarQueryParameter("prev_start", "DATE", prev_start),
            bigquery.ScalarQueryParameter("prev_end", "DATE", prev_end),
        ]
    )

    results = client.query(query, job_config=job_config).result()
    row = next(iter(results), None)

    if not row:
        logger.warning(
            "No proxy metrics found",
            extra={"request_id": request_id, "brand": brand},
        )
        return {"has_scores": False, "no_data": True}

    metrics = {
        "has_scores": False,
        "answers_analyzed": row.answer_count or 0,
        "prompts_analyzed": row.prompts_analyzed or 0,
        "run_count": row.run_count or 0,
        "entity_mentions": row.entity_mentions or 0,
        "brand_mentions": row.brand_mentions or 0,
        "competitor_mentions": row.competitor_mentions or 0,
        "unique_entities": row.unique_entities or 0,
        "total_citations": row.total_citations or 0,
        "unique_domains": row.unique_domains or 0,
        "brand_owned_citations": row.brand_owned_citations or 0,
        "answer_change": row.answer_change or 0,
        "mention_change": row.mention_change or 0,
        "visibility_trend": row.visibility_trend,
        "top_entities": [{"entity": e.entity_text, "type": e.entity_type, "mentions": e.mentions} for e in row.top_entities] if row.top_entities else [],
        "top_prompts": [{"prompt_id": p.prompt_id, "count": p.answer_count} for p in row.top_prompts] if row.top_prompts else [],
        "top_domains": [{"domain": d.domain, "count": d.citation_count, "brand_owned": d.brand_owned} for d in row.top_domains] if row.top_domains else [],
    }

    logger.info(
        "Fetched proxy metrics (no visibility scores)",
        extra={"request_id": request_id, "brand": brand},
    )
    return metrics


def check_summary_exists(summary_id: str, request_id: str) -> bool:
    """Check if a summary with this ID already exists (for idempotency)."""
    client = get_bq_client()

    # Use a query that works with partition filter requirement
    query = f"""
    SELECT 1
    FROM `{GCP_PROJECT_ID}.{BQ_DATASET}.weekly_summaries`
    WHERE summary_id = @summary_id
      AND event_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
    LIMIT 1
    """

    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("summary_id", "STRING", summary_id),
        ]
    )

    try:
        results = client.query(query, job_config=job_config).result()
        exists = sum(1 for _ in results) > 0

        if exists:
            logger.info(
                f"Summary already exists: {summary_id}",
                extra={"request_id": request_id, "summary_id": summary_id},
            )
        return exists

    except Exception as e:
        logger.warning(
            f"Error checking for existing summary: {e}",
            extra={"request_id": request_id, "summary_id": summary_id},
        )
        return False


def write_summary_to_bigquery(
    summary_id: str,
    brand: str,
    event_date: str,
    start_date: str,
    end_date: str,
    summary_text: str,
    summary_json: dict[str, Any],
    model_version: str,
    request_id: str,
) -> None:
    """Write summary to BigQuery weekly_summaries table."""
    client = get_bq_client()
    table_id = f"{GCP_PROJECT_ID}.{BQ_DATASET}.weekly_summaries"

    # Extract structured data from summary_json
    key_findings = summary_json.get("key_findings", [])
    recommendations = summary_json.get("recommendations", [])
    top_domains = summary_json.get("top_domains", [])[:5]
    top_competitors = summary_json.get("top_competitors", [])[:5]

    row = {
        "summary_id": summary_id,
        "brand": brand,
        "event_date": event_date,
        "week_start_date": start_date,
        "week_end_date": end_date,
        "executive_summary": summary_text,
        "key_findings": key_findings if isinstance(key_findings, list) else [],
        "recommendations": recommendations if isinstance(recommendations, list) else [],
        "avg_visibility_score": summary_json.get("avg_visibility_score"),
        "visibility_trend": summary_json.get("visibility_trend"),
        "visibility_change_pct": summary_json.get("visibility_change_pct"),
        "top_cited_domains": [d.get("domain", d) if isinstance(d, dict) else str(d) for d in top_domains],
        "top_competitors": [c.get("competitor", c) if isinstance(c, dict) else str(c) for c in top_competitors],
        "prompts_analyzed": summary_json.get("prompts_analyzed", 0),
        "answers_analyzed": summary_json.get("answers_analyzed", 0),
        "model_version": model_version,
        "email_subject": f"Weekly Visibility Report: {brand} ({start_date} to {end_date})",
        "email_ready_html": generate_email_html(brand, start_date, end_date, summary_text, summary_json),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "metadata": json.dumps({"request_id": request_id, "raw_metrics": summary_json.get("raw_metrics", {})}),
    }

    errors = client.insert_rows_json(table_id, [row])
    if errors:
        # Check if it's a duplicate key error (acceptable for idempotency)
        error_str = str(errors)
        if "duplicate" in error_str.lower() or "already exists" in error_str.lower():
            logger.info(
                "Summary already exists (idempotent insert)",
                extra={"request_id": request_id, "summary_id": summary_id, "brand": brand},
            )
            return
        logger.error(
            f"BigQuery insert errors: {errors}",
            extra={"request_id": request_id, "summary_id": summary_id, "brand": brand},
        )
        raise RuntimeError(f"BigQuery insert failed: {errors}")

    logger.info(
        "BigQuery insert successful",
        extra={"request_id": request_id, "summary_id": summary_id, "brand": brand},
    )


def generate_email_html(brand: str, start_date: str, end_date: str, summary: str, data: dict[str, Any]) -> str:
    """Generate email-ready HTML from summary."""
    trend = data.get("visibility_trend", "stable")
    trend_emoji = {"up": "📈", "down": "📉", "stable": "➡️"}.get(trend, "➡️")

    key_findings = data.get("key_findings", [])
    recommendations = data.get("recommendations", [])

    findings_html = "".join(f"<li>{f}</li>" for f in key_findings) if key_findings else "<li>No key findings</li>"
    recs_html = "".join(f"<li>{r}</li>" for r in recommendations) if recommendations else "<li>No recommendations</li>"

    return f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .header {{ background: #1a73e8; color: white; padding: 20px; }}
        .content {{ padding: 20px; }}
        .metric {{ background: #f8f9fa; padding: 15px; margin: 10px 0; border-radius: 8px; }}
        .trend-up {{ color: #34a853; }}
        .trend-down {{ color: #ea4335; }}
        .trend-stable {{ color: #fbbc04; }}
        ul {{ margin: 10px 0; padding-left: 20px; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>Weekly Visibility Report: {brand}</h1>
        <p>{start_date} to {end_date}</p>
    </div>
    <div class="content">
        <div class="metric">
            <h2>Trend: {trend_emoji} {trend.upper()}</h2>
        </div>
        <h2>Executive Summary</h2>
        <p>{summary}</p>
        <h2>Key Findings</h2>
        <ul>{findings_html}</ul>
        <h2>Recommendations</h2>
        <ul>{recs_html}</ul>
    </div>
</body>
</html>
"""


# -----------------------------------------------------------------------------
# Gemini API Operations
# -----------------------------------------------------------------------------


def build_gemini_prompt(brand: str, start_date: str, end_date: str, metrics: dict[str, Any]) -> str:
    """Build the prompt for Gemini to generate executive summary."""

    if metrics.get("has_scores"):
        context = f"""
You are an AI visibility analyst. Generate a weekly executive summary for {brand}.

## Time Period
- Week: {start_date} to {end_date}

## Visibility Metrics
- Average Visibility Score: {metrics.get('avg_visibility_score', 'N/A')}
- Citation Score: {metrics.get('avg_citation_score', 'N/A')}
- Mention Score: {metrics.get('avg_mention_score', 'N/A')}
- Week-over-Week Change: {metrics.get('visibility_change_pct', 'N/A')}%
- Trend: {metrics.get('visibility_trend', 'N/A')}
- Score Volatility: {metrics.get('score_volatility', 'N/A')}

## Coverage
- Total Prompts: {metrics.get('total_prompts', 0)}
- Prompts with Citations: {metrics.get('prompts_with_citation', 0)}
- Total Citations: {metrics.get('total_citations', 0)}
- Total Mentions: {metrics.get('total_mentions', 0)}

## Best Performing Prompts
{json.dumps(metrics.get('best_prompts', []), indent=2)}

## Worst Performing Prompts
{json.dumps(metrics.get('worst_prompts', []), indent=2)}

## Top Cited Domains
{json.dumps(metrics.get('top_domains', []), indent=2)}
"""
    else:
        # Proxy metrics when no visibility scores
        context = f"""
You are an AI visibility analyst. Generate a weekly executive summary for {brand}.
Note: Visibility scores are not yet available, so this analysis uses proxy metrics.

## Time Period
- Week: {start_date} to {end_date}

## Activity Metrics
- Answers Analyzed: {metrics.get('answers_analyzed', 0)}
- Prompts Analyzed: {metrics.get('prompts_analyzed', 0)}
- Runs Completed: {metrics.get('run_count', 0)}

## Entity Mentions
- Total Entity Mentions: {metrics.get('entity_mentions', 0)}
- Brand Mentions: {metrics.get('brand_mentions', 0)}
- Competitor Mentions: {metrics.get('competitor_mentions', 0)}
- Unique Entities: {metrics.get('unique_entities', 0)}
- Week-over-Week Mention Change: {metrics.get('mention_change', 0)}
- Trend: {metrics.get('visibility_trend', 'N/A')}

## Citations
- Total Citations: {metrics.get('total_citations', 0)}
- Unique Domains: {metrics.get('unique_domains', 0)}
- Brand-Owned Citations: {metrics.get('brand_owned_citations', 0)}

## Top Entities
{json.dumps(metrics.get('top_entities', []), indent=2)}

## Top Prompts by Frequency
{json.dumps(metrics.get('top_prompts', []), indent=2)}

## Top Cited Domains
{json.dumps(metrics.get('top_domains', []), indent=2)}
"""

    prompt = f"""{context}

## Instructions
Generate a comprehensive executive summary with the following sections:

1. **Executive Summary** (2-3 paragraphs): Overall assessment of {brand}'s AI visibility for the week.

2. **What Changed**: Key changes from the previous week.

3. **Top Wins**: Positive developments and opportunities.

4. **Top Losses/Risks**: Areas of concern or decline.

5. **Volatility Assessment**: How stable was visibility this week?

6. **Recommended Actions**: 3-5 specific actions to improve AI inclusion and citations.

Format your response as JSON with this structure:
{{
    "executive_summary": "...",
    "what_changed": "...",
    "top_wins": ["win1", "win2", ...],
    "top_losses": ["loss1", "loss2", ...],
    "volatility_assessment": "...",
    "recommended_actions": ["action1", "action2", ...]
}}
"""
    return prompt


def call_gemini_with_retry(prompt: str, request_id: str, brand: str) -> tuple[str, int]:
    """
    Call Gemini API with exponential backoff for 429 and 5xx errors.

    Returns:
        tuple of (response_text, latency_ms)
    """
    model = genai.GenerativeModel(GEMINI_MODEL)
    last_exception: Exception | None = None

    for attempt in range(MAX_RETRIES):
        try:
            start_time = time.perf_counter()
            response = model.generate_content(prompt)
            latency_ms = int((time.perf_counter() - start_time) * 1000)

            answer_text = response.text if response.text else ""

            logger.info(
                "Gemini call successful",
                extra={
                    "request_id": request_id,
                    "brand": brand,
                    "latency_ms": latency_ms,
                    "model": GEMINI_MODEL,
                },
            )

            return answer_text, latency_ms

        except (ResourceExhausted, ServiceUnavailable) as e:
            last_exception = e
            wait_time = RETRY_BACKOFF_BASE ** (attempt + 1)
            logger.warning(
                f"Retryable error (attempt {attempt + 1}/{MAX_RETRIES}), waiting {wait_time}s",
                extra={"request_id": request_id, "brand": brand},
            )
            time.sleep(wait_time)

        except Exception as e:
            logger.error(
                f"Non-retryable Gemini error: {e}",
                extra={"request_id": request_id, "brand": brand},
                exc_info=True,
            )
            raise

    logger.error(
        f"All {MAX_RETRIES} retries exhausted",
        extra={"request_id": request_id, "brand": brand},
    )
    raise last_exception or RuntimeError("Gemini call failed after retries")


def parse_gemini_response(response_text: str) -> dict[str, Any]:
    """Parse Gemini's JSON response, handling markdown code blocks."""
    # Strip markdown code blocks if present
    text = response_text.strip()
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    text = text.strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # If JSON parsing fails, create structured response from text
        return {
            "executive_summary": response_text,
            "what_changed": "",
            "top_wins": [],
            "top_losses": [],
            "volatility_assessment": "",
            "recommended_actions": [],
        }


# -----------------------------------------------------------------------------
# Email Delivery
# -----------------------------------------------------------------------------

_fs_client: cloud_firestore.Client | None = None


def _get_fs_client() -> cloud_firestore.Client:
    """Get or create Firestore client."""
    global _fs_client
    if _fs_client is None:
        _fs_client = cloud_firestore.Client(project=GCP_PROJECT_ID)
    return _fs_client


def send_weekly_email(
    brand: str,
    start_date: str,
    end_date: str,
    email_html: str,
    request_id: str,
) -> None:
    """Send weekly summary email to all client contacts who own this brand."""
    if not EMAIL_ENABLED or not SENDGRID_API_KEY:
        logger.info(
            "Email delivery disabled, skipping",
            extra={"request_id": request_id, "brand": brand},
        )
        return

    fs = _get_fs_client()

    # Find client(s) that own this brand
    client_docs = fs.collection("clients").where("brands", "array_contains", brand).stream()

    recipients: list[str] = []
    for client_doc in client_docs:
        client_data = client_doc.to_dict()
        # Only send to active clients
        if client_data.get("status") != "active":
            continue
        # Get member emails
        members = fs.collection("clients").document(client_doc.id).collection("members").stream()
        for member in members:
            member_data = member.to_dict()
            email = member_data.get("email")
            if email:
                recipients.append(email)

    if not recipients:
        logger.info(
            f"No recipients found for brand={brand}",
            extra={"request_id": request_id, "brand": brand},
        )
        return

    subject = f"Weekly Visibility Report: {brand} ({start_date} to {end_date})"
    sg = SendGridAPIClient(SENDGRID_API_KEY)

    for recipient in recipients:
        try:
            message = Mail(
                from_email=Email(EMAIL_FROM, "KnewSearch"),
                to_emails=To(recipient),
                subject=subject,
                html_content=Content("text/html", email_html),
            )
            sg.send(message)
            logger.info(
                f"Sent weekly email to {recipient} for brand={brand}",
                extra={"request_id": request_id, "brand": brand},
            )
        except Exception as e:
            logger.error(
                f"Failed to send email to {recipient}: {e}",
                extra={"request_id": request_id, "brand": brand},
            )


# -----------------------------------------------------------------------------
# Main Processing Logic
# -----------------------------------------------------------------------------


def generate_weekly_summary(request: WeeklySummaryRequest) -> WeeklySummaryResponse:
    """Generate weekly summary for a brand."""
    request_id = f"req_{uuid.uuid4().hex[:8]}"
    brand = request.brand

    # Calculate date range
    if request.end_date:
        end_date = datetime.strptime(request.end_date, "%Y-%m-%d").date()
    else:
        end_date = datetime.now(timezone.utc).date()

    start_date = end_date - timedelta(days=request.lookback_days - 1)

    # Previous period for comparison
    prev_end = start_date - timedelta(days=1)
    prev_start = prev_end - timedelta(days=request.lookback_days - 1)

    start_str = start_date.strftime("%Y-%m-%d")
    end_str = end_date.strftime("%Y-%m-%d")
    prev_start_str = prev_start.strftime("%Y-%m-%d")
    prev_end_str = prev_end.strftime("%Y-%m-%d")
    event_date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    logger.info(
        f"Generating weekly summary for {brand}",
        extra={"request_id": request_id, "brand": brand},
    )

    # Generate deterministic summary_id for idempotency
    summary_id = generate_summary_id(brand, start_str, end_str)

    # Check if summary already exists
    if check_summary_exists(summary_id, request_id):
        logger.info(
            "Returning existing summary (idempotent)",
            extra={"request_id": request_id, "summary_id": summary_id, "brand": brand},
        )
        # Fetch and return existing summary
        client = get_bq_client()
        query = f"""
        SELECT executive_summary, metadata
        FROM `{GCP_PROJECT_ID}.{BQ_DATASET}.weekly_summaries`
        WHERE summary_id = @summary_id
          AND event_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        LIMIT 1
        """
        job_config = bigquery.QueryJobConfig(
            query_parameters=[bigquery.ScalarQueryParameter("summary_id", "STRING", summary_id)]
        )
        results = client.query(query, job_config=job_config).result()
        row = next(iter(results), None)
        if row:
            return WeeklySummaryResponse(
                summary_id=summary_id,
                brand=brand,
                start_date=start_str,
                end_date=end_str,
                email_ready_text=row.executive_summary,
                summary_json=json.loads(row.metadata) if row.metadata else {},
                created_at=datetime.now(timezone.utc).isoformat(),
            )

    # Check if visibility_scores has data
    has_scores = check_visibility_scores_exists(brand, start_str, end_str, request_id)

    # Fetch appropriate metrics
    if has_scores:
        metrics = fetch_metrics_with_scores(brand, start_str, end_str, prev_start_str, prev_end_str, request_id)
    else:
        metrics = fetch_metrics_proxy(brand, start_str, end_str, prev_start_str, prev_end_str, request_id)

    # Handle case where no data at all
    if metrics.get("no_data"):
        logger.warning(
            f"No data found for {brand} in date range",
            extra={"request_id": request_id, "brand": brand},
        )
        # Return a minimal summary indicating no data
        summary_json = {
            "executive_summary": f"No data available for {brand} during {start_str} to {end_str}.",
            "key_findings": ["No AI answers or visibility data found for this period"],
            "recommendations": ["Ensure prompts are configured and daily runs are executing"],
            "visibility_trend": "stable",
            "prompts_analyzed": 0,
            "answers_analyzed": 0,
        }
        write_summary_to_bigquery(
            summary_id=summary_id,
            brand=brand,
            event_date=event_date_str,
            start_date=start_str,
            end_date=end_str,
            summary_text=summary_json["executive_summary"],
            summary_json=summary_json,
            model_version=GEMINI_MODEL,
            request_id=request_id,
        )
        return WeeklySummaryResponse(
            summary_id=summary_id,
            brand=brand,
            start_date=start_str,
            end_date=end_str,
            email_ready_text=summary_json["executive_summary"],
            summary_json=summary_json,
            created_at=datetime.now(timezone.utc).isoformat(),
        )

    # Build prompt and call Gemini
    prompt = build_gemini_prompt(brand, start_str, end_str, metrics)
    response_text, latency_ms = call_gemini_with_retry(prompt, request_id, brand)

    # Parse Gemini response
    parsed_response = parse_gemini_response(response_text)

    # Build summary JSON with all data
    summary_json = {
        **parsed_response,
        "key_findings": parsed_response.get("top_wins", []) + parsed_response.get("top_losses", []),
        "recommendations": parsed_response.get("recommended_actions", []),
        "visibility_trend": metrics.get("visibility_trend"),
        "visibility_change_pct": metrics.get("visibility_change_pct"),
        "avg_visibility_score": metrics.get("avg_visibility_score"),
        "prompts_analyzed": metrics.get("prompts_analyzed") or metrics.get("total_prompts", 0),
        "answers_analyzed": metrics.get("answers_analyzed", 0),
        "top_domains": metrics.get("top_domains", []),
        "top_competitors": metrics.get("top_competitors", []) or [e for e in metrics.get("top_entities", []) if e.get("type") == "competitor"][:5],
        "raw_metrics": metrics,
        "gemini_latency_ms": latency_ms,
    }

    # Write to BigQuery
    write_summary_to_bigquery(
        summary_id=summary_id,
        brand=brand,
        event_date=event_date_str,
        start_date=start_str,
        end_date=end_str,
        summary_text=parsed_response.get("executive_summary", ""),
        summary_json=summary_json,
        model_version=GEMINI_MODEL,
        request_id=request_id,
    )

    logger.info(
        f"Weekly summary generated successfully",
        extra={"request_id": request_id, "summary_id": summary_id, "brand": brand},
    )

    # Send email to client contacts
    try:
        email_html = generate_email_html(
            brand, start_str, end_str,
            parsed_response.get("executive_summary", ""),
            summary_json,
        )
        send_weekly_email(brand, start_str, end_str, email_html, request_id)
    except Exception as e:
        logger.error(
            f"Email delivery failed (non-fatal): {e}",
            extra={"request_id": request_id, "brand": brand},
        )

    return WeeklySummaryResponse(
        summary_id=summary_id,
        brand=brand,
        start_date=start_str,
        end_date=end_str,
        email_ready_text=parsed_response.get("executive_summary", ""),
        summary_json=summary_json,
        created_at=datetime.now(timezone.utc).isoformat(),
    )


# -----------------------------------------------------------------------------
# FastAPI Application
# -----------------------------------------------------------------------------

app = FastAPI(
    title="Weekly Summary V2 Service",
    description="Generates AI-powered weekly executive summaries for brand visibility",
    version="2.0.0",
)


@app.on_event("startup")
async def startup_event() -> None:
    """Initialize clients on startup."""
    configure_gemini()
    logger.info("Weekly Summary V2 service started")


@app.get("/health")
async def health() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "healthy", "service": SERVICE_NAME}


@app.post("/weekly", response_model=WeeklySummaryResponse)
async def weekly_summary(request: WeeklySummaryRequest) -> WeeklySummaryResponse:
    """
    Generate weekly executive summary for a brand.

    - **brand**: Required. The brand to generate summary for.
    - **end_date**: Optional. End date in YYYY-MM-DD format. Defaults to today.
    - **lookback_days**: Optional. Number of days to look back. Defaults to 7.
    """
    try:
        return generate_weekly_summary(request)
    except Exception as e:
        logger.error(f"Error generating weekly summary: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8080")))
