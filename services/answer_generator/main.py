"""
Answer Generator Service

Cloud Run service that:
- Consumes prompt_run_requested Pub/Sub messages
- Calls Gemini API to generate answers
- Writes ai_answers rows to BigQuery
- Publishes answer_generated messages
"""

import base64
import json
import logging
import os
import sys
import time
import uuid
from datetime import datetime, timezone
from typing import Any

import google.generativeai as genai
from fastapi import FastAPI, HTTPException, Request
from google.api_core.exceptions import ResourceExhausted, ServiceUnavailable
from google.cloud import bigquery, pubsub_v1
from pydantic import BaseModel, Field

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------

SERVICE_NAME = os.getenv("SERVICE_NAME", "answer_generator")
GCP_PROJECT_ID = os.getenv("GCP_PROJECT_ID")
BQ_DATASET = os.getenv("BQ_DATASET", "knewsearch_aeo")
PUBSUB_TOPIC_ANSWER_GENERATED = os.getenv("PUBSUB_TOPIC_ANSWER_GENERATED", "answer_generated")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-pro")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
MAX_RETRIES = int(os.getenv("MAX_RETRIES", "3"))
RETRY_BACKOFF_BASE = float(os.getenv("RETRY_BACKOFF_BASE", "2"))

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
        if hasattr(record, "run_id"):
            log_entry["run_id"] = record.run_id
        if hasattr(record, "prompt_id"):
            log_entry["prompt_id"] = record.prompt_id
        if hasattr(record, "answer_id"):
            log_entry["answer_id"] = record.answer_id
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
# Pydantic Models (matching contracts.md)
# -----------------------------------------------------------------------------


class PromptItem(BaseModel):
    """Single prompt from prompt_run_requested message."""

    prompt_id: str
    prompt_text: str
    brand: str | None = None
    category: str | None = None


class RunOptions(BaseModel):
    """Options from prompt_run_requested message."""

    model_version: str | None = None
    retry_failed_only: bool = False


class PromptRunRequestedMessage(BaseModel):
    """Inbound Pub/Sub message contract."""

    run_id: str
    run_type: str
    triggered_by: str
    prompts: list[PromptItem]
    options: RunOptions | None = None
    timestamp: str


class TokenCount(BaseModel):
    """Token usage for answer_generated message."""

    prompt: int | None = None
    response: int | None = None


class AnswerGeneratedMessage(BaseModel):
    """Outbound Pub/Sub message contract."""

    answer_id: str
    run_id: str
    prompt_id: str
    brand: str | None = None
    event_date: str
    prompt_text: str
    raw_answer: str
    model_version: str
    token_count: TokenCount | None = None
    latency_ms: int | None = None
    timestamp: str


class PubSubEnvelope(BaseModel):
    """Pub/Sub push message envelope."""

    message: dict = Field(...)
    subscription: str | None = None


# -----------------------------------------------------------------------------
# Clients (lazy initialization)
# -----------------------------------------------------------------------------

_bq_client: bigquery.Client | None = None
_publisher: pubsub_v1.PublisherClient | None = None


def get_bq_client() -> bigquery.Client:
    """Get or create BigQuery client."""
    global _bq_client
    if _bq_client is None:
        _bq_client = bigquery.Client(project=GCP_PROJECT_ID)
    return _bq_client


def get_publisher() -> pubsub_v1.PublisherClient:
    """Get or create Pub/Sub publisher client."""
    global _publisher
    if _publisher is None:
        _publisher = pubsub_v1.PublisherClient()
    return _publisher


def configure_gemini() -> None:
    """Configure Gemini API client."""
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY environment variable is required")
    genai.configure(api_key=GEMINI_API_KEY)


# -----------------------------------------------------------------------------
# Core Logic
# -----------------------------------------------------------------------------


def call_gemini_with_retry(
    prompt_text: str, model_name: str, run_id: str, prompt_id: str
) -> tuple[str, int | None, int | None, int]:
    """
    Call Gemini API with exponential backoff for 429 and 5xx errors.

    Returns:
        tuple of (answer_text, prompt_tokens, response_tokens, latency_ms)
    """
    model = genai.GenerativeModel(model_name)
    last_exception: Exception | None = None

    for attempt in range(MAX_RETRIES):
        try:
            start_time = time.perf_counter()
            response = model.generate_content(prompt_text)
            latency_ms = int((time.perf_counter() - start_time) * 1000)

            # Extract token counts if available
            prompt_tokens = None
            response_tokens = None
            if hasattr(response, "usage_metadata") and response.usage_metadata:
                prompt_tokens = getattr(response.usage_metadata, "prompt_token_count", None)
                response_tokens = getattr(response.usage_metadata, "candidates_token_count", None)

            answer_text = response.text if response.text else ""

            logger.info(
                "Gemini call successful",
                extra={
                    "run_id": run_id,
                    "prompt_id": prompt_id,
                    "latency_ms": latency_ms,
                    "model": model_name,
                },
            )

            return answer_text, prompt_tokens, response_tokens, latency_ms

        except (ResourceExhausted, ServiceUnavailable) as e:
            last_exception = e
            wait_time = RETRY_BACKOFF_BASE ** (attempt + 1)
            logger.warning(
                f"Retryable error (attempt {attempt + 1}/{MAX_RETRIES}), waiting {wait_time}s",
                extra={"run_id": run_id, "prompt_id": prompt_id},
            )
            time.sleep(wait_time)

        except Exception as e:
            # Non-retryable error
            logger.error(
                f"Non-retryable Gemini error: {e}",
                extra={"run_id": run_id, "prompt_id": prompt_id},
                exc_info=True,
            )
            raise

    # All retries exhausted
    logger.error(
        f"All {MAX_RETRIES} retries exhausted",
        extra={"run_id": run_id, "prompt_id": prompt_id},
    )
    raise last_exception or RuntimeError("Gemini call failed after retries")


def write_to_bigquery(answer: AnswerGeneratedMessage) -> None:
    """Insert answer row into BigQuery ai_answers table."""
    client = get_bq_client()
    table_id = f"{GCP_PROJECT_ID}.{BQ_DATASET}.ai_answers"

    row = {
        "answer_id": answer.answer_id,
        "run_id": answer.run_id,
        "prompt_id": answer.prompt_id,
        "brand": answer.brand,
        "event_date": answer.event_date,
        "prompt_text": answer.prompt_text,
        "raw_answer": answer.raw_answer,
        "model_version": answer.model_version,
        "token_count_prompt": answer.token_count.prompt if answer.token_count else None,
        "token_count_response": answer.token_count.response if answer.token_count else None,
        "latency_ms": answer.latency_ms,
        "metadata": None,
    }

    errors = client.insert_rows_json(table_id, [row])
    if errors:
        logger.error(
            f"BigQuery insert errors: {errors}",
            extra={"run_id": answer.run_id, "prompt_id": answer.prompt_id, "answer_id": answer.answer_id},
        )
        raise RuntimeError(f"BigQuery insert failed: {errors}")

    logger.info(
        "BigQuery insert successful",
        extra={"run_id": answer.run_id, "prompt_id": answer.prompt_id, "answer_id": answer.answer_id},
    )


def publish_answer_generated(answer: AnswerGeneratedMessage) -> None:
    """Publish answer_generated message to Pub/Sub."""
    publisher = get_publisher()
    topic_path = publisher.topic_path(GCP_PROJECT_ID, PUBSUB_TOPIC_ANSWER_GENERATED)

    message_data = answer.model_dump_json().encode("utf-8")
    future = publisher.publish(topic_path, message_data)
    message_id = future.result()

    logger.info(
        f"Published answer_generated message: {message_id}",
        extra={"run_id": answer.run_id, "prompt_id": answer.prompt_id, "answer_id": answer.answer_id},
    )


def process_prompt(prompt: PromptItem, run_id: str, model_version: str) -> AnswerGeneratedMessage:
    """Process a single prompt: call Gemini, create answer message."""
    event_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    answer_id = f"ans_{event_date}_{prompt.prompt_id}_{uuid.uuid4().hex[:8]}"

    logger.info(
        f"Processing prompt: {prompt.prompt_id}",
        extra={"run_id": run_id, "prompt_id": prompt.prompt_id},
    )

    # Call Gemini
    raw_answer, prompt_tokens, response_tokens, latency_ms = call_gemini_with_retry(
        prompt_text=prompt.prompt_text,
        model_name=model_version,
        run_id=run_id,
        prompt_id=prompt.prompt_id,
    )

    # Build answer message
    answer = AnswerGeneratedMessage(
        answer_id=answer_id,
        run_id=run_id,
        prompt_id=prompt.prompt_id,
        brand=prompt.brand,
        event_date=event_date,
        prompt_text=prompt.prompt_text,
        raw_answer=raw_answer,
        model_version=model_version,
        token_count=TokenCount(prompt=prompt_tokens, response=response_tokens),
        latency_ms=latency_ms,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )

    return answer


def handle_prompt_run_requested(message: PromptRunRequestedMessage) -> dict[str, Any]:
    """
    Process a prompt_run_requested message.

    For each prompt:
    1. Call Gemini API
    2. Write to BigQuery
    3. Publish answer_generated message
    """
    run_id = message.run_id
    model_version = (
        message.options.model_version if message.options and message.options.model_version else GEMINI_MODEL
    )

    logger.info(
        f"Processing run with {len(message.prompts)} prompts",
        extra={"run_id": run_id, "model": model_version},
    )

    results = {"run_id": run_id, "total": len(message.prompts), "success": 0, "failed": 0, "answers": []}

    for prompt in message.prompts:
        try:
            answer = process_prompt(prompt, run_id, model_version)
            write_to_bigquery(answer)
            publish_answer_generated(answer)
            results["success"] += 1
            results["answers"].append({"prompt_id": prompt.prompt_id, "answer_id": answer.answer_id, "status": "success"})

        except Exception as e:
            logger.error(
                f"Failed to process prompt {prompt.prompt_id}: {e}",
                extra={"run_id": run_id, "prompt_id": prompt.prompt_id},
                exc_info=True,
            )
            results["failed"] += 1
            results["answers"].append({"prompt_id": prompt.prompt_id, "status": "failed", "error": str(e)})

    logger.info(
        f"Run complete: {results['success']}/{results['total']} successful",
        extra={"run_id": run_id},
    )

    return results


# -----------------------------------------------------------------------------
# FastAPI Application
# -----------------------------------------------------------------------------

app = FastAPI(
    title="Answer Generator Service",
    description="Generates AI answers using Gemini and stores results in BigQuery",
    version="1.0.0",
)


@app.on_event("startup")
async def startup_event() -> None:
    """Initialize clients on startup."""
    configure_gemini()
    logger.info("Answer Generator service started")


@app.get("/health")
async def health() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "healthy", "service": SERVICE_NAME}


@app.post("/")
async def handle_pubsub_push(request: Request) -> dict[str, Any]:
    """
    Handle Pub/Sub push messages.

    Expects a POST with JSON body containing base64-encoded message data.
    """
    try:
        body = await request.json()
        envelope = PubSubEnvelope(**body)

        # Decode the Pub/Sub message
        if "data" not in envelope.message:
            raise HTTPException(status_code=400, detail="Missing message data")

        message_data = base64.b64decode(envelope.message["data"]).decode("utf-8")
        message_json = json.loads(message_data)
        message = PromptRunRequestedMessage(**message_json)

        # Process the message
        result = handle_prompt_run_requested(message)

        # Return success to ack the message
        return {"status": "ok", "result": result}

    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in message: {e}")
        raise HTTPException(status_code=400, detail="Invalid JSON")

    except Exception as e:
        logger.error(f"Error processing message: {e}", exc_info=True)
        # Return 500 to trigger Pub/Sub retry
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/generate")
async def generate_direct(message: PromptRunRequestedMessage) -> dict[str, Any]:
    """
    Direct endpoint for testing without Pub/Sub.

    Accepts the same payload as prompt_run_requested messages.
    """
    result = handle_prompt_run_requested(message)
    return {"status": "ok", "result": result}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8080")))
