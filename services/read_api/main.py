"""
Read API Service

Read-only Cloud Run service providing AI Search Visibility data
for dashboards, demos, and executive reporting.
"""

import json
import logging
import os
import sys
import uuid
from datetime import datetime, timezone
from typing import Any

import uvicorn
from fastapi import FastAPI, HTTPException, Query, Request
from google.cloud import bigquery
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SERVICE_NAME = os.getenv("SERVICE_NAME", "read_api")
GCP_PROJECT_ID = os.getenv("GCP_PROJECT_ID")
BQ_DATASET = os.getenv("BQ_DATASET", "knewsearch_aeo")
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

# ---------------------------------------------------------------------------
# Structured Logging
# ---------------------------------------------------------------------------


class StructuredLogFormatter(logging.Formatter):
    """JSON formatter for Cloud Logging compatibility."""

    def format(self, record: logging.LogRecord) -> str:
        log_entry: dict[str, Any] = {
            "severity": record.levelname,
            "message": record.getMessage(),
            "service": SERVICE_NAME,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        if hasattr(record, "request_id"):
            log_entry["request_id"] = record.request_id
        if hasattr(record, "brand"):
            log_entry["brand"] = record.brand
        if hasattr(record, "endpoint"):
            log_entry["endpoint"] = record.endpoint
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

# ---------------------------------------------------------------------------
# Pydantic Models
# ---------------------------------------------------------------------------


class HealthResponse(BaseModel):
    """Health check response."""

    status: str
    service: str


class BrandsResponse(BaseModel):
    """Paginated list of distinct brands."""

    brands: list[str]
    total: int
    limit: int
    offset: int


class OverviewRow(BaseModel):
    """Single day of brand visibility trend."""

    event_date: str = Field(description="Date in YYYY-MM-DD format")
    total_score: float = Field(description="Sum of per-prompt visibility scores")
    average_score: float = Field(description="Average per-prompt visibility score")
    prompt_count: int = Field(description="Number of prompts scored")


class OverviewResponse(BaseModel):
    """Last 30 days of brand visibility trend."""

    brand: str
    days: int
    data: list[OverviewRow]


class PromptScoreRow(BaseModel):
    """Per-prompt score for a single date."""

    prompt_id: str
    score: float = Field(description="Visibility score 0-100")
    brand_mentioned: bool = Field(description="Whether brand was mentioned")
    citation_count: int = Field(description="Number of citations")
    volatility_rank: int = Field(description="Rank by score volatility (1 = most volatile)")


class PromptScoresResponse(BaseModel):
    """Paginated prompt-level scores for a brand and date."""

    brand: str
    date: str
    data: list[PromptScoreRow]
    total: int
    limit: int
    offset: int


class WeeklySummaryResponse(BaseModel):
    """Most recent weekly summary for a brand."""

    brand: str
    week_start_date: str
    week_end_date: str
    email_ready_text: str = Field(description="Executive summary text")
    created_at: str


# ---------------------------------------------------------------------------
# BigQuery Client (lazy initialization)
# ---------------------------------------------------------------------------

_bq_client: bigquery.Client | None = None


def get_bq_client() -> bigquery.Client:
    """Get or create BigQuery client."""
    global _bq_client
    if _bq_client is None:
        _bq_client = bigquery.Client(project=GCP_PROJECT_ID)
    return _bq_client


def run_query(
    sql: str,
    params: list[bigquery.ScalarQueryParameter] | None = None,
    request_id: str = "",
) -> list[dict[str, Any]]:
    """Execute a read-only BigQuery query and return rows as dicts."""
    client = get_bq_client()
    job_config = bigquery.QueryJobConfig()
    if params:
        job_config.query_parameters = params

    logger.info(
        "Executing query",
        extra={"request_id": request_id},
    )

    result = client.query(sql, job_config=job_config).result()
    return [dict(row) for row in result]


def _require_project_id() -> None:
    """Raise 500 if GCP_PROJECT_ID is not configured."""
    if not GCP_PROJECT_ID:
        raise HTTPException(
            status_code=500,
            detail="GCP_PROJECT_ID environment variable not set",
        )


# ---------------------------------------------------------------------------
# FastAPI Application
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Read API",
    description="Read-only API for AI Search Visibility dashboards and reporting",
    version="1.0.0",
)


@app.middleware("http")
async def add_request_id(request: Request, call_next):
    """Attach a unique request_id for tracing."""
    request_id = f"read_{uuid.uuid4().hex[:8]}"
    request.state.request_id = request_id

    logger.info(
        f"{request.method} {request.url.path}",
        extra={"request_id": request_id, "endpoint": request.url.path},
    )

    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    """Health check endpoint."""
    return HealthResponse(status="healthy", service=SERVICE_NAME)


@app.get("/brands", response_model=BrandsResponse)
async def get_brands(
    request: Request,
    limit: int = Query(default=100, ge=1, le=1000, description="Max brands to return"),
    offset: int = Query(default=0, ge=0, description="Number of brands to skip"),
) -> BrandsResponse:
    """Return distinct active brands from prompts table."""
    _require_project_id()
    request_id = request.state.request_id

    count_sql = f"""
    SELECT COUNT(DISTINCT brand) AS total
    FROM `{GCP_PROJECT_ID}.{BQ_DATASET}.prompts`
    WHERE brand IS NOT NULL AND is_active = TRUE
    """
    count_rows = run_query(count_sql, request_id=request_id)
    total = count_rows[0]["total"] if count_rows else 0

    sql = f"""
    SELECT DISTINCT brand
    FROM `{GCP_PROJECT_ID}.{BQ_DATASET}.prompts`
    WHERE brand IS NOT NULL AND is_active = TRUE
    ORDER BY brand
    LIMIT @limit OFFSET @offset
    """
    params = [
        bigquery.ScalarQueryParameter("limit", "INT64", limit),
        bigquery.ScalarQueryParameter("offset", "INT64", offset),
    ]
    rows = run_query(sql, params=params, request_id=request_id)
    brands = [r["brand"] for r in rows]

    logger.info(
        f"Returning {len(brands)} brands (total={total})",
        extra={"request_id": request_id},
    )

    return BrandsResponse(brands=brands, total=total, limit=limit, offset=offset)


@app.get("/overview", response_model=OverviewResponse)
async def get_overview(
    request: Request,
    brand: str = Query(..., description="Brand to get overview for"),
) -> OverviewResponse:
    """Return last 30 days of brand visibility trend."""
    _require_project_id()
    request_id = request.state.request_id

    sql = f"""
    SELECT
      event_date,
      SUM(visibility_score) AS total_score,
      AVG(visibility_score) AS average_score,
      COUNT(*) AS prompt_count
    FROM `{GCP_PROJECT_ID}.{BQ_DATASET}.visibility_scores`
    WHERE brand = @brand
      AND prompt_id IS NOT NULL
      AND event_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
    GROUP BY event_date
    ORDER BY event_date DESC
    """
    params = [
        bigquery.ScalarQueryParameter("brand", "STRING", brand),
    ]
    rows = run_query(sql, params=params, request_id=request_id)

    data = [
        OverviewRow(
            event_date=str(r["event_date"]),
            total_score=round(r["total_score"], 2),
            average_score=round(r["average_score"], 2),
            prompt_count=r["prompt_count"],
        )
        for r in rows
    ]

    logger.info(
        f"Returning {len(data)} days of overview for brand={brand}",
        extra={"request_id": request_id, "brand": brand},
    )

    return OverviewResponse(brand=brand, days=len(data), data=data)


@app.get("/prompt-scores", response_model=PromptScoresResponse)
async def get_prompt_scores(
    request: Request,
    brand: str = Query(..., description="Brand to filter by"),
    date: str = Query(..., description="Date in YYYY-MM-DD format"),
    limit: int = Query(default=50, ge=1, le=500, description="Max results to return"),
    offset: int = Query(default=0, ge=0, description="Number of results to skip"),
) -> PromptScoresResponse:
    """Return top prompt-level scores for a brand and date."""
    _require_project_id()
    request_id = request.state.request_id

    try:
        datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid date format: {date}. Expected YYYY-MM-DD",
        )

    count_sql = f"""
    SELECT COUNT(*) AS total
    FROM `{GCP_PROJECT_ID}.{BQ_DATASET}.visibility_scores`
    WHERE brand = @brand
      AND event_date = @event_date
      AND prompt_id IS NOT NULL
    """
    count_params = [
        bigquery.ScalarQueryParameter("brand", "STRING", brand),
        bigquery.ScalarQueryParameter("event_date", "DATE", date),
    ]
    count_rows = run_query(count_sql, params=count_params, request_id=request_id)
    total = count_rows[0]["total"] if count_rows else 0

    sql = f"""
    SELECT * FROM (
      SELECT
        prompt_id,
        visibility_score AS score,
        CASE WHEN IFNULL(total_mentions, 0) > 0 THEN TRUE ELSE FALSE END AS brand_mentioned,
        IFNULL(total_citations, 0) AS citation_count,
        RANK() OVER (ORDER BY ABS(IFNULL(score_change, 0)) DESC) AS volatility_rank
      FROM `{GCP_PROJECT_ID}.{BQ_DATASET}.visibility_scores`
      WHERE brand = @brand
        AND event_date = @event_date
        AND prompt_id IS NOT NULL
    )
    ORDER BY score DESC
    LIMIT @limit OFFSET @offset
    """
    params = [
        bigquery.ScalarQueryParameter("brand", "STRING", brand),
        bigquery.ScalarQueryParameter("event_date", "DATE", date),
        bigquery.ScalarQueryParameter("limit", "INT64", limit),
        bigquery.ScalarQueryParameter("offset", "INT64", offset),
    ]
    rows = run_query(sql, params=params, request_id=request_id)

    data = [
        PromptScoreRow(
            prompt_id=r["prompt_id"],
            score=round(r["score"], 2),
            brand_mentioned=r["brand_mentioned"],
            citation_count=r["citation_count"],
            volatility_rank=r["volatility_rank"],
        )
        for r in rows
    ]

    logger.info(
        f"Returning {len(data)} prompt scores for brand={brand} date={date}",
        extra={"request_id": request_id, "brand": brand},
    )

    return PromptScoresResponse(
        brand=brand, date=date, data=data, total=total, limit=limit, offset=offset
    )


@app.get("/weekly-summary", response_model=WeeklySummaryResponse)
async def get_weekly_summary(
    request: Request,
    brand: str = Query(..., description="Brand to get weekly summary for"),
) -> WeeklySummaryResponse:
    """Return the most recent weekly summary for a brand."""
    _require_project_id()
    request_id = request.state.request_id

    sql = f"""
    SELECT
      week_start_date,
      week_end_date,
      executive_summary,
      created_at
    FROM `{GCP_PROJECT_ID}.{BQ_DATASET}.weekly_summaries`
    WHERE brand = @brand
      AND event_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
    ORDER BY week_end_date DESC
    LIMIT 1
    """
    params = [
        bigquery.ScalarQueryParameter("brand", "STRING", brand),
    ]
    rows = run_query(sql, params=params, request_id=request_id)

    if not rows:
        raise HTTPException(
            status_code=404,
            detail=f"No weekly summary found for brand: {brand}",
        )

    row = rows[0]

    logger.info(
        f"Returning weekly summary for brand={brand}",
        extra={"request_id": request_id, "brand": brand},
    )

    return WeeklySummaryResponse(
        brand=brand,
        week_start_date=str(row["week_start_date"]),
        week_end_date=str(row["week_end_date"]),
        email_ready_text=row["executive_summary"] or "",
        created_at=row["created_at"].isoformat() if row["created_at"] else "",
    )


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8080")))
