"""
prompt_runner service - Triggers prompt runs for the KnewSearch AEO Visibility Platform.

Responsibilities:
- Read active prompts from BigQuery
- Create run_id and write to answer_runs table
- Publish one Pub/Sub message per prompt using the prompt_run_requested contract
"""

import json
import logging
import os
import sys
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException, Header
from google.cloud import bigquery, pubsub_v1
from pydantic import BaseModel, Field

# Configure structured JSON logging
class StructuredLogFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "severity": record.levelname,
            "message": record.getMessage(),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "service": os.getenv("SERVICE_NAME", "prompt_runner"),
        }
        if hasattr(record, "run_id"):
            log_entry["run_id"] = record.run_id
        if hasattr(record, "prompt_count"):
            log_entry["prompt_count"] = record.prompt_count
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_entry)


handler = logging.StreamHandler(sys.stdout)
handler.setFormatter(StructuredLogFormatter())
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"), handlers=[handler])
logger = logging.getLogger(__name__)

# Environment configuration
GCP_PROJECT_ID = os.getenv("GCP_PROJECT_ID", "")
BQ_DATASET = os.getenv("BQ_DATASET", "knewsearch_aeo")
PUBSUB_TOPIC_PROMPT_RUN = os.getenv("PUBSUB_TOPIC_PROMPT_RUN", "prompt_run_requested")

app = FastAPI(
    title="Prompt Runner Service",
    description="Triggers prompt runs for the KnewSearch AEO Visibility Platform",
    version="1.0.0",
)


# Pydantic Models
class RunOptions(BaseModel):
    model_version: Optional[str] = Field(default=None, description="Gemini model to use")
    retry_failed_only: bool = Field(default=False, description="Only retry previously failed prompts")


class RunRequest(BaseModel):
    run_type: str = Field(default="manual", description="One of: scheduled, manual, backfill")
    triggered_by: str = Field(default="api", description="Source: cloud_scheduler, api, manual")
    options: Optional[RunOptions] = Field(default=None, description="Optional run configuration")
    idempotency_key: Optional[str] = Field(default=None, description="Idempotency key for safe reruns")


class PromptInfo(BaseModel):
    prompt_id: str
    prompt_text: str
    brand: Optional[str] = None
    category: Optional[str] = None


class RunResponse(BaseModel):
    run_id: str
    status: str
    prompt_count: int
    messages_published: int
    idempotency_key: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    service: str
    timestamp: str


# In-memory idempotency cache (for MVP; use Redis in production)
_idempotency_cache: dict[str, RunResponse] = {}


def generate_run_id() -> str:
    """Generate a unique run identifier."""
    date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    short_uuid = uuid.uuid4().hex[:8]
    return f"run_{date_str}_{short_uuid}"


def get_bigquery_client() -> bigquery.Client:
    """Create BigQuery client."""
    return bigquery.Client(project=GCP_PROJECT_ID)


def get_pubsub_publisher() -> pubsub_v1.PublisherClient:
    """Create Pub/Sub publisher client."""
    return pubsub_v1.PublisherClient()


def fetch_active_prompts(client: bigquery.Client) -> list[PromptInfo]:
    """Fetch all active prompts from BigQuery."""
    query = f"""
        SELECT prompt_id, prompt_text, brand, category
        FROM `{GCP_PROJECT_ID}.{BQ_DATASET}.prompts`
        WHERE is_active = TRUE
        ORDER BY prompt_id
    """
    results = client.query(query).result()
    return [
        PromptInfo(
            prompt_id=row.prompt_id,
            prompt_text=row.prompt_text,
            brand=row.brand,
            category=row.category,
        )
        for row in results
    ]


def write_answer_run(
    client: bigquery.Client,
    run_id: str,
    run_type: str,
    triggered_by: str,
    total_prompts: int,
) -> None:
    """Write a new answer_runs record to BigQuery."""
    table_id = f"{GCP_PROJECT_ID}.{BQ_DATASET}.answer_runs"
    rows_to_insert = [
        {
            "run_id": run_id,
            "run_type": run_type,
            "status": "pending",
            "started_at": datetime.now(timezone.utc).isoformat(),
            "total_prompts": total_prompts,
            "successful_prompts": 0,
            "failed_prompts": 0,
            "triggered_by": triggered_by,
        }
    ]
    errors = client.insert_rows_json(table_id, rows_to_insert)
    if errors:
        raise RuntimeError(f"BigQuery insert errors: {errors}")


def publish_prompt_message(
    publisher: pubsub_v1.PublisherClient,
    topic_path: str,
    run_id: str,
    run_type: str,
    triggered_by: str,
    prompt: PromptInfo,
    options: Optional[RunOptions],
) -> None:
    """Publish a single prompt_run_requested message to Pub/Sub."""
    message_data = {
        "run_id": run_id,
        "run_type": run_type,
        "triggered_by": triggered_by,
        "prompts": [
            {
                "prompt_id": prompt.prompt_id,
                "prompt_text": prompt.prompt_text,
                "brand": prompt.brand,
                "category": prompt.category,
            }
        ],
        "options": {
            "model_version": options.model_version if options else None,
            "retry_failed_only": options.retry_failed_only if options else False,
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    data = json.dumps(message_data).encode("utf-8")
    publisher.publish(topic_path, data=data, run_id=run_id, prompt_id=prompt.prompt_id)


@app.post("/run", response_model=RunResponse)
async def trigger_run(
    request: RunRequest,
    x_idempotency_key: Optional[str] = Header(default=None, alias="X-Idempotency-Key"),
) -> RunResponse:
    """
    Trigger a prompt run.

    Reads active prompts from BigQuery, creates a run record, and publishes
    one Pub/Sub message per prompt.
    """
    # Support idempotency key from header or body
    idempotency_key = x_idempotency_key or request.idempotency_key

    # Check idempotency cache
    if idempotency_key and idempotency_key in _idempotency_cache:
        logger.info(
            "Returning cached response for idempotency key",
            extra={"run_id": _idempotency_cache[idempotency_key].run_id},
        )
        return _idempotency_cache[idempotency_key]

    run_id = generate_run_id()
    log_extra = {"run_id": run_id}

    logger.info("Starting prompt run", extra=log_extra)

    try:
        # Initialize clients
        bq_client = get_bigquery_client()
        publisher = get_pubsub_publisher()
        topic_path = publisher.topic_path(GCP_PROJECT_ID, PUBSUB_TOPIC_PROMPT_RUN)

        # Fetch active prompts
        prompts = fetch_active_prompts(bq_client)
        prompt_count = len(prompts)
        log_extra["prompt_count"] = prompt_count

        if prompt_count == 0:
            logger.warning("No active prompts found", extra=log_extra)
            response = RunResponse(
                run_id=run_id,
                status="completed",
                prompt_count=0,
                messages_published=0,
                idempotency_key=idempotency_key,
            )
            if idempotency_key:
                _idempotency_cache[idempotency_key] = response
            return response

        logger.info(f"Found {prompt_count} active prompts", extra=log_extra)

        # Write answer_run record
        write_answer_run(
            client=bq_client,
            run_id=run_id,
            run_type=request.run_type,
            triggered_by=request.triggered_by,
            total_prompts=prompt_count,
        )
        logger.info("Created answer_run record", extra=log_extra)

        # Publish one message per prompt
        messages_published = 0
        for prompt in prompts:
            publish_prompt_message(
                publisher=publisher,
                topic_path=topic_path,
                run_id=run_id,
                run_type=request.run_type,
                triggered_by=request.triggered_by,
                prompt=prompt,
                options=request.options,
            )
            messages_published += 1

        logger.info(
            f"Published {messages_published} messages to Pub/Sub",
            extra=log_extra,
        )

        response = RunResponse(
            run_id=run_id,
            status="pending",
            prompt_count=prompt_count,
            messages_published=messages_published,
            idempotency_key=idempotency_key,
        )

        # Cache response for idempotency
        if idempotency_key:
            _idempotency_cache[idempotency_key] = response

        return response

    except Exception as e:
        logger.error(f"Run failed: {e}", extra=log_extra, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Run failed: {str(e)}")


@app.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Health check endpoint."""
    return HealthResponse(
        status="ok",
        service="prompt_runner",
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8080"))
    uvicorn.run(app, host="0.0.0.0", port=port)
