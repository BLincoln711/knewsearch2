"""
Scoring Service

Cloud Run service that:
- Computes daily visibility scores per brand and per prompt
- Executes BigQuery queries to aggregate metrics
- Writes scores to visibility_scores table with idempotent merge semantics
"""

import hashlib
import json
import logging
import os
import sys
import uuid
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from google.cloud import bigquery
from pydantic import BaseModel, Field

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------

SERVICE_NAME = os.getenv("SERVICE_NAME", "scoring")
GCP_PROJECT_ID = os.getenv("GCP_PROJECT_ID")
BQ_DATASET = os.getenv("BQ_DATASET", "knewsearch_aeo")
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

# SQL file locations (relative to service or absolute)
SQL_DIR = os.getenv("SQL_DIR", str(Path(__file__).parent.parent.parent / "sql" / "scoring"))

# -----------------------------------------------------------------------------
# Structured Logging
# -----------------------------------------------------------------------------


class StructuredLogFormatter(logging.Formatter):
    """JSON formatter for Cloud Logging compatibility."""

    def format(self, record: logging.LogRecord) -> str:
        log_entry: dict[str, Any] = {
            "severity": record.levelname,
            "message": record.getMessage(),
            "service": SERVICE_NAME,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        # Add context-specific fields if present
        if hasattr(record, "request_id"):
            log_entry["request_id"] = record.request_id
        if hasattr(record, "date"):
            log_entry["date"] = record.date
        if hasattr(record, "brand"):
            log_entry["brand"] = record.brand
        if hasattr(record, "run_id"):
            log_entry["run_id"] = record.run_id
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


class ScoreRequest(BaseModel):
    """Request body for POST /score endpoint."""

    brand: str | None = Field(
        default=None,
        description="Specific brand to score. If omitted, scores all active brands."
    )
    run_id: str | None = Field(
        default=None,
        description="Specific run_id to score. If omitted, uses all runs for the date."
    )
    date: str | None = Field(
        default=None,
        description="Date to compute scores for (YYYY-MM-DD). Defaults to today."
    )


class ScoreResult(BaseModel):
    """Score computation result."""

    request_id: str
    date: str
    brand: str | None
    brands_scored: int
    prompts_scored: int
    aggregate_scores_written: int
    prompt_scores_written: int
    status: str
    duration_ms: int
    errors: list[str] = []


class HealthResponse(BaseModel):
    """Health check response."""

    status: str
    service: str


# -----------------------------------------------------------------------------
# BigQuery Client (lazy initialization)
# -----------------------------------------------------------------------------

_bq_client: bigquery.Client | None = None


def get_bq_client() -> bigquery.Client:
    """Get or create BigQuery client."""
    global _bq_client
    if _bq_client is None:
        _bq_client = bigquery.Client(project=GCP_PROJECT_ID)
    return _bq_client


# -----------------------------------------------------------------------------
# SQL Query Helpers
# -----------------------------------------------------------------------------


def load_sql_template(filename: str) -> str:
    """Load SQL template from file."""
    sql_path = Path(SQL_DIR) / filename
    if not sql_path.exists():
        raise FileNotFoundError(f"SQL template not found: {sql_path}")
    return sql_path.read_text()


def substitute_params(sql: str, project_id: str, dataset: str, target_date: str) -> str:
    """Substitute parameters in SQL template."""
    return sql.replace("@project_id", project_id).replace("@dataset", dataset).replace("@target_date", f"DATE('{target_date}')")


def execute_merge_query(sql: str, request_id: str, query_name: str) -> int:
    """Execute a MERGE query and return rows affected."""
    client = get_bq_client()

    logger.info(
        f"Executing {query_name}",
        extra={"request_id": request_id},
    )

    try:
        job = client.query(sql)
        result = job.result()

        # Get rows affected from job statistics
        rows_affected = job.num_dml_affected_rows or 0

        logger.info(
            f"Completed {query_name}: {rows_affected} rows affected",
            extra={"request_id": request_id},
        )

        return rows_affected

    except Exception as e:
        logger.error(
            f"Failed {query_name}: {e}",
            extra={"request_id": request_id},
            exc_info=True,
        )
        raise


def count_brands_for_date(target_date: str) -> int:
    """Count distinct brands that have answers for the target date."""
    client = get_bq_client()

    query = f"""
    SELECT COUNT(DISTINCT brand) as brand_count
    FROM `{GCP_PROJECT_ID}.{BQ_DATASET}.ai_answers`
    WHERE event_date = DATE('{target_date}')
      AND brand IS NOT NULL
    """

    result = client.query(query).result()
    for row in result:
        return row.brand_count
    return 0


def count_prompts_for_date(target_date: str) -> int:
    """Count distinct prompts that have answers for the target date."""
    client = get_bq_client()

    query = f"""
    SELECT COUNT(DISTINCT prompt_id) as prompt_count
    FROM `{GCP_PROJECT_ID}.{BQ_DATASET}.ai_answers`
    WHERE event_date = DATE('{target_date}')
      AND brand IS NOT NULL
    """

    result = client.query(query).result()
    for row in result:
        return row.prompt_count
    return 0


def verify_scores_exist(target_date: str) -> dict[str, int]:
    """Verify scores were written for the target date."""
    client = get_bq_client()

    query = f"""
    SELECT
      COUNTIF(prompt_id IS NULL) AS aggregate_scores,
      COUNTIF(prompt_id IS NOT NULL) AS prompt_scores
    FROM `{GCP_PROJECT_ID}.{BQ_DATASET}.visibility_scores`
    WHERE event_date = DATE('{target_date}')
    """

    result = client.query(query).result()
    for row in result:
        return {
            "aggregate_scores": row.aggregate_scores or 0,
            "prompt_scores": row.prompt_scores or 0,
        }
    return {"aggregate_scores": 0, "prompt_scores": 0}


# -----------------------------------------------------------------------------
# Core Scoring Logic
# -----------------------------------------------------------------------------


def compute_scores(
    request_id: str,
    target_date: str,
    brand: str | None = None,
    run_id: str | None = None,
) -> ScoreResult:
    """
    Compute visibility scores for the given date.

    Steps:
    1. Execute prompt_scores.sql to compute per-prompt scores
    2. Execute brand_scores.sql to compute aggregate scores
    3. Verify scores were written
    """
    start_time = datetime.now(timezone.utc)
    errors: list[str] = []

    logger.info(
        f"Starting score computation for {target_date}",
        extra={
            "request_id": request_id,
            "date": target_date,
            "brand": brand,
            "run_id": run_id,
        },
    )

    # Validate project ID
    if not GCP_PROJECT_ID:
        raise HTTPException(
            status_code=500,
            detail="GCP_PROJECT_ID environment variable not set"
        )

    # Count inputs
    brands_count = count_brands_for_date(target_date)
    prompts_count = count_prompts_for_date(target_date)

    if brands_count == 0:
        logger.warning(
            f"No brands found for date {target_date}",
            extra={"request_id": request_id, "date": target_date},
        )
        end_time = datetime.now(timezone.utc)
        duration_ms = int((end_time - start_time).total_seconds() * 1000)

        return ScoreResult(
            request_id=request_id,
            date=target_date,
            brand=brand,
            brands_scored=0,
            prompts_scored=0,
            aggregate_scores_written=0,
            prompt_scores_written=0,
            status="no_data",
            duration_ms=duration_ms,
            errors=["No brands found with answers for the specified date"],
        )

    # Load and execute SQL templates
    prompt_scores_written = 0
    aggregate_scores_written = 0

    try:
        # Step 1: Compute per-prompt scores
        prompt_sql = load_sql_template("prompt_scores.sql")
        prompt_sql = substitute_params(prompt_sql, GCP_PROJECT_ID, BQ_DATASET, target_date)
        prompt_scores_written = execute_merge_query(prompt_sql, request_id, "prompt_scores")
    except Exception as e:
        errors.append(f"prompt_scores failed: {str(e)}")
        logger.error(f"prompt_scores failed: {e}", extra={"request_id": request_id}, exc_info=True)

    try:
        # Step 2: Compute aggregate brand scores
        brand_sql = load_sql_template("brand_scores.sql")
        brand_sql = substitute_params(brand_sql, GCP_PROJECT_ID, BQ_DATASET, target_date)
        aggregate_scores_written = execute_merge_query(brand_sql, request_id, "brand_scores")
    except Exception as e:
        errors.append(f"brand_scores failed: {str(e)}")
        logger.error(f"brand_scores failed: {e}", extra={"request_id": request_id}, exc_info=True)

    # Verify results
    verification = verify_scores_exist(target_date)

    end_time = datetime.now(timezone.utc)
    duration_ms = int((end_time - start_time).total_seconds() * 1000)

    status = "success" if not errors else "partial_success" if verification["aggregate_scores"] > 0 else "failed"

    logger.info(
        f"Score computation completed: {status}",
        extra={
            "request_id": request_id,
            "date": target_date,
            "brands_scored": brands_count,
            "prompts_scored": prompts_count,
            "aggregate_scores": verification["aggregate_scores"],
            "prompt_scores": verification["prompt_scores"],
            "duration_ms": duration_ms,
        },
    )

    return ScoreResult(
        request_id=request_id,
        date=target_date,
        brand=brand,
        brands_scored=brands_count,
        prompts_scored=prompts_count,
        aggregate_scores_written=verification["aggregate_scores"],
        prompt_scores_written=verification["prompt_scores"],
        status=status,
        duration_ms=duration_ms,
        errors=errors,
    )


# -----------------------------------------------------------------------------
# FastAPI Application
# -----------------------------------------------------------------------------

app = FastAPI(
    title="Scoring Service",
    description="Computes visibility scores from parsed AI answers",
    version="1.0.0",
)


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    """Health check endpoint."""
    return HealthResponse(status="healthy", service=SERVICE_NAME)


@app.post("/score", response_model=ScoreResult)
async def score(request: ScoreRequest) -> ScoreResult:
    """
    Compute visibility scores for a date.

    - Reads from ai_answers, citations, entities tables
    - Computes per-prompt and aggregate brand scores
    - Writes to visibility_scores table using MERGE (idempotent)

    Args:
        request: ScoreRequest with optional brand, run_id, and date

    Returns:
        ScoreResult with computation summary
    """
    # Generate request ID for tracing
    request_id = f"score_{uuid.uuid4().hex[:8]}"

    # Parse date (default to today)
    if request.date:
        try:
            target_date = datetime.strptime(request.date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid date format: {request.date}. Expected YYYY-MM-DD"
            )
    else:
        target_date = date.today()

    target_date_str = target_date.isoformat()

    logger.info(
        f"Received score request",
        extra={
            "request_id": request_id,
            "date": target_date_str,
            "brand": request.brand,
            "run_id": request.run_id,
        },
    )

    try:
        result = compute_scores(
            request_id=request_id,
            target_date=target_date_str,
            brand=request.brand,
            run_id=request.run_id,
        )
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Score computation failed: {e}",
            extra={"request_id": request_id},
            exc_info=True,
        )
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/scores/{target_date}")
async def get_scores(target_date: str, brand: str | None = None) -> dict[str, Any]:
    """
    Retrieve computed scores for a date.

    Args:
        target_date: Date in YYYY-MM-DD format
        brand: Optional brand filter

    Returns:
        Dict with aggregate and per-prompt scores
    """
    # Validate date format
    try:
        datetime.strptime(target_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid date format: {target_date}. Expected YYYY-MM-DD"
        )

    client = get_bq_client()

    # Build query
    brand_filter = f"AND brand = '{brand}'" if brand else ""

    query = f"""
    SELECT
      score_id,
      brand,
      event_date,
      prompt_id,
      visibility_score,
      citation_score,
      mention_score,
      total_prompts,
      prompts_with_citation,
      prompts_with_mention,
      total_citations,
      total_mentions,
      score_change,
      score_change_pct,
      metadata
    FROM `{GCP_PROJECT_ID}.{BQ_DATASET}.visibility_scores`
    WHERE event_date = DATE('{target_date}')
      {brand_filter}
    ORDER BY brand, prompt_id NULLS FIRST
    """

    try:
        result = client.query(query).result()
        rows = [dict(row) for row in result]

        # Separate aggregate and prompt-level scores
        aggregate_scores = [r for r in rows if r.get("prompt_id") is None]
        prompt_scores = [r for r in rows if r.get("prompt_id") is not None]

        return {
            "date": target_date,
            "brand_filter": brand,
            "aggregate_scores": aggregate_scores,
            "prompt_scores": prompt_scores,
            "total_aggregate": len(aggregate_scores),
            "total_prompt": len(prompt_scores),
        }

    except Exception as e:
        logger.error(f"Failed to retrieve scores: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8080")))
