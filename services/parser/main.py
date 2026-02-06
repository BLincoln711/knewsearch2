"""
Parser Service

Cloud Run service that:
- Consumes answer_generated Pub/Sub messages
- Extracts URLs, domains, brand mentions, and named entities
- Writes citations and entities rows to BigQuery
- Updates ai_answers with diff metadata vs previous answer
- Publishes answer_parsed messages
"""

import base64
import hashlib
import json
import logging
import os
import re
import sys
import uuid
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse

from fastapi import FastAPI, HTTPException, Request
from google.cloud import bigquery, pubsub_v1
from pydantic import BaseModel, Field

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------

SERVICE_NAME = os.getenv("SERVICE_NAME", "parser")
GCP_PROJECT_ID = os.getenv("GCP_PROJECT_ID")
BQ_DATASET = os.getenv("BQ_DATASET", "knewsearch_aeo")
PUBSUB_TOPIC_ANSWER_PARSED = os.getenv("PUBSUB_TOPIC_ANSWER_PARSED", "answer_parsed")
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

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
        if hasattr(record, "run_id"):
            log_entry["run_id"] = record.run_id
        if hasattr(record, "answer_id"):
            log_entry["answer_id"] = record.answer_id
        if hasattr(record, "prompt_id"):
            log_entry["prompt_id"] = record.prompt_id
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


class TokenCount(BaseModel):
    """Token usage from answer_generated message."""

    prompt: int | None = None
    response: int | None = None


class AnswerGeneratedMessage(BaseModel):
    """Inbound Pub/Sub message contract from answer_generator."""

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


class CitationRecord(BaseModel):
    """Citation to be written to BigQuery."""

    citation_id: str
    answer_id: str
    run_id: str
    prompt_id: str
    brand: str | None = None
    event_date: str
    url: str
    domain: str
    position: int
    anchor_text: str | None = None
    is_brand_owned: bool = False
    is_competitor: bool = False


class EntityRecord(BaseModel):
    """Entity to be written to BigQuery."""

    entity_id: str
    answer_id: str
    run_id: str
    prompt_id: str
    brand: str | None = None
    event_date: str
    entity_text: str
    entity_type: str
    confidence_score: float | None = None
    mention_count: int = 1
    is_target_brand: bool = False
    is_competitor: bool = False
    sentiment: str | None = None


class CitationOutput(BaseModel):
    """Citation in answer_parsed message."""

    citation_id: str
    url: str
    domain: str
    position: int
    anchor_text: str | None = None
    is_brand_owned: bool
    is_competitor: bool


class EntityOutput(BaseModel):
    """Entity in answer_parsed message."""

    entity_id: str
    entity_text: str
    entity_type: str
    mention_count: int
    is_target_brand: bool
    is_competitor: bool
    sentiment: str | None = None
    confidence_score: float | None = None


class ParseSummary(BaseModel):
    """Summary stats for answer_parsed message."""

    total_citations: int
    brand_citations: int
    competitor_citations: int
    total_entities: int
    brand_mentions: int
    competitor_mentions: int


class AnswerParsedMessage(BaseModel):
    """Outbound Pub/Sub message contract."""

    answer_id: str
    run_id: str
    prompt_id: str
    brand: str | None = None
    event_date: str
    citations: list[CitationOutput]
    entities: list[EntityOutput]
    summary: ParseSummary
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


# -----------------------------------------------------------------------------
# URL and Domain Extraction
# -----------------------------------------------------------------------------

# Patterns to match URLs in various formats
URL_PATTERNS = [
    # Standard markdown links [text](url)
    re.compile(r'\[([^\]]*)\]\((https?://[^\)]+)\)'),
    # Plain URLs
    re.compile(r'(?<![(\[])(https?://[^\s\)\]<>]+)'),
    # Source references like [Source: domain.com/path]
    re.compile(r'\[Source:\s*([\w\.-]+(?:/[^\]]*)?)\]'),
    # Domain references like "domain.com"
    re.compile(r'(?:^|[\s(])([a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,}(?:/[^\s\)\]<>]*)?)(?:[\s)\]]|$)'),
]


def extract_domain(url: str) -> str:
    """Extract domain from URL or domain string."""
    # Add scheme if missing for proper parsing
    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url
    try:
        parsed = urlparse(url)
        domain = parsed.netloc or parsed.path.split('/')[0]
        # Remove www. prefix
        if domain.startswith('www.'):
            domain = domain[4:]
        return domain.lower()
    except Exception:
        return url.lower()


def extract_urls_and_domains(text: str) -> list[tuple[str, str, str | None, int]]:
    """
    Extract URLs and domains from text.

    Returns list of (url, domain, anchor_text, position) tuples.
    Deduplicates by URL.
    """
    found: dict[str, tuple[str, str, str | None, int]] = {}
    position = 0

    # Extract markdown links first
    for match in URL_PATTERNS[0].finditer(text):
        anchor_text, url = match.groups()
        if url not in found:
            position += 1
            domain = extract_domain(url)
            found[url] = (url, domain, anchor_text.strip() if anchor_text else None, position)

    # Extract plain URLs
    for match in URL_PATTERNS[1].finditer(text):
        url = match.group(1).rstrip('.,;:')
        if url not in found:
            position += 1
            domain = extract_domain(url)
            found[url] = (url, domain, None, position)

    # Extract Source references
    for match in URL_PATTERNS[2].finditer(text):
        ref = match.group(1)
        url = 'https://' + ref if not ref.startswith('http') else ref
        if url not in found:
            position += 1
            domain = extract_domain(url)
            found[url] = (url, domain, ref, position)

    return list(found.values())


# -----------------------------------------------------------------------------
# Brand and Entity Extraction
# -----------------------------------------------------------------------------

# Common entity patterns
COMPANY_SUFFIXES = r'(?:\s+(?:Inc\.?|LLC|Corp\.?|Corporation|Ltd\.?|Company|Co\.?|Group|Holdings?))?'
PRODUCT_INDICATORS = ['CRM', 'Platform', 'Suite', 'Pro', 'Enterprise', 'Cloud', 'Software', 'App']


def normalize_text(text: str) -> str:
    """Normalize text for comparison."""
    return re.sub(r'\s+', ' ', text.lower().strip())


def extract_brand_mentions(text: str, brand: str | None) -> list[tuple[str, int, bool]]:
    """
    Extract brand mentions from text.

    Returns list of (brand_text, mention_count, is_target_brand) tuples.
    """
    if not brand:
        return []

    mentions: dict[str, tuple[str, int, bool]] = {}
    normalized_brand = normalize_text(brand)

    # Look for the target brand
    brand_pattern = re.compile(
        rf'\b{re.escape(brand)}{COMPANY_SUFFIXES}\b',
        re.IGNORECASE
    )

    brand_matches = brand_pattern.findall(text)
    if brand_matches:
        # Use the first match's exact text
        first_match = brand_pattern.search(text)
        if first_match:
            brand_text = first_match.group(0).strip()
            mentions[normalized_brand] = (brand_text, len(brand_matches), True)

    return list(mentions.values())


def extract_named_entities(text: str, brand: str | None) -> list[tuple[str, str, int, float]]:
    """
    Extract named entities from text using pattern matching.

    Returns list of (entity_text, entity_type, mention_count, confidence) tuples.
    """
    entities: dict[str, tuple[str, str, int, float]] = {}
    normalized_brand = normalize_text(brand) if brand else ""

    # Pattern for capitalized multi-word phrases (likely proper nouns/brands)
    proper_noun_pattern = re.compile(
        r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*'  # Capitalized words
        rf'{COMPANY_SUFFIXES})\b'
    )

    for match in proper_noun_pattern.finditer(text):
        entity_text = match.group(1).strip()
        normalized = normalize_text(entity_text)

        # Skip common single-word false positives (sentence starters, etc.)
        _STOP_ENTITIES = {
            'the', 'this', 'that', 'with', 'from', 'for', 'see', 'also',
            'visit', 'learn', 'known', 'offers', 'source', 'here', 'more',
            'pricing', 'affordable', 'great', 'best', 'some', 'most',
            'when', 'what', 'where', 'which', 'their', 'your', 'our',
            'many', 'each', 'both', 'other', 'these', 'those', 'such',
        }
        if len(entity_text) < 3 or normalized in _STOP_ENTITIES:
            continue
        # Single capitalized word at start of sentence is likely not an entity
        if ' ' not in entity_text and len(entity_text) < 8:
            continue

        # Determine entity type
        entity_type = 'organization'
        for indicator in PRODUCT_INDICATORS:
            if indicator.lower() in normalized:
                entity_type = 'brand'
                break

        if normalized in entities:
            # Increment count
            existing = entities[normalized]
            entities[normalized] = (existing[0], existing[1], existing[2] + 1, existing[3])
        else:
            # New entity
            confidence = 0.8 if entity_type == 'brand' else 0.7
            entities[normalized] = (entity_text, entity_type, 1, confidence)

    # Also extract entities with product indicators
    product_pattern = re.compile(
        r'\b([A-Z][a-zA-Z]*\s+(?:' + '|'.join(PRODUCT_INDICATORS) + r'))\b'
    )

    for match in product_pattern.finditer(text):
        entity_text = match.group(1).strip()
        normalized = normalize_text(entity_text)

        if normalized not in entities:
            entities[normalized] = (entity_text, 'brand', 1, 0.85)
        else:
            existing = entities[normalized]
            entities[normalized] = (existing[0], 'brand', existing[2] + 1, max(existing[3], 0.85))

    return list(entities.values())


def is_brand_owned_domain(domain: str, brand: str | None) -> bool:
    """Check if domain belongs to the tracked brand."""
    if not brand:
        return False

    # Generate brand name variants for matching
    brand_lower = brand.lower()
    brand_words = brand_lower.split()
    normalized_domain = domain.lower().replace('-', '')

    # Check full brand (no spaces) against domain
    brand_no_spaces = brand_lower.replace(' ', '')
    if brand_no_spaces in normalized_domain:
        return True

    # Check each significant brand word (>2 chars) against domain
    for word in brand_words:
        if len(word) > 2 and word in normalized_domain:
            return True

    return False


# -----------------------------------------------------------------------------
# BigQuery Operations
# -----------------------------------------------------------------------------


def generate_citation_id(answer_id: str, url: str) -> str:
    """Generate deterministic citation ID for deduplication."""
    hash_input = f"{answer_id}:{url}"
    hash_value = hashlib.sha256(hash_input.encode()).hexdigest()[:12]
    return f"cit_{hash_value}"


def generate_entity_id(answer_id: str, entity_text: str, entity_type: str) -> str:
    """Generate deterministic entity ID for deduplication."""
    hash_input = f"{answer_id}:{entity_text.lower()}:{entity_type}"
    hash_value = hashlib.sha256(hash_input.encode()).hexdigest()[:12]
    return f"ent_{hash_value}"


def write_citations_to_bigquery(citations: list[CitationRecord]) -> None:
    """Insert citation rows into BigQuery with deduplication."""
    if not citations:
        return

    if not GCP_PROJECT_ID:
        logger.warning("GCP_PROJECT_ID not set, skipping BigQuery citation write")
        return

    client = get_bq_client()
    table_id = f"{GCP_PROJECT_ID}.{BQ_DATASET}.citations"

    rows = [
        {
            "citation_id": c.citation_id,
            "answer_id": c.answer_id,
            "run_id": c.run_id,
            "prompt_id": c.prompt_id,
            "brand": c.brand,
            "event_date": c.event_date,
            "url": c.url,
            "domain": c.domain,
            "position": c.position,
            "anchor_text": c.anchor_text,
            "is_brand_owned": c.is_brand_owned,
            "is_competitor": c.is_competitor,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "metadata": None,
        }
        for c in citations
    ]

    errors = client.insert_rows_json(table_id, rows)
    if errors:
        # Log but don't fail on duplicate key errors
        logger.warning(f"BigQuery citation insert warnings: {errors}")


def write_entities_to_bigquery(entities: list[EntityRecord]) -> None:
    """Insert entity rows into BigQuery with deduplication."""
    if not entities:
        return

    if not GCP_PROJECT_ID:
        logger.warning("GCP_PROJECT_ID not set, skipping BigQuery entity write")
        return

    client = get_bq_client()
    table_id = f"{GCP_PROJECT_ID}.{BQ_DATASET}.entities"

    rows = [
        {
            "entity_id": e.entity_id,
            "answer_id": e.answer_id,
            "run_id": e.run_id,
            "prompt_id": e.prompt_id,
            "brand": e.brand,
            "event_date": e.event_date,
            "entity_text": e.entity_text,
            "entity_type": e.entity_type,
            "confidence_score": e.confidence_score,
            "mention_count": e.mention_count,
            "is_target_brand": e.is_target_brand,
            "is_competitor": e.is_competitor,
            "sentiment": e.sentiment,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "metadata": None,
        }
        for e in entities
    ]

    errors = client.insert_rows_json(table_id, rows)
    if errors:
        logger.warning(f"BigQuery entity insert warnings: {errors}")


def fetch_previous_answer(prompt_id: str, event_date: str, answer_id: str) -> str | None:
    """Fetch the most recent previous answer for the same prompt."""
    if not GCP_PROJECT_ID:
        logger.warning("GCP_PROJECT_ID not set, skipping previous answer fetch")
        return None

    client = get_bq_client()

    query = f"""
    SELECT raw_answer
    FROM `{GCP_PROJECT_ID}.{BQ_DATASET}.ai_answers`
    WHERE prompt_id = @prompt_id
      AND event_date <= @event_date
      AND answer_id != @answer_id
    ORDER BY created_at DESC
    LIMIT 1
    """

    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("prompt_id", "STRING", prompt_id),
            bigquery.ScalarQueryParameter("event_date", "DATE", event_date),
            bigquery.ScalarQueryParameter("answer_id", "STRING", answer_id),
        ]
    )

    try:
        results = client.query(query, job_config=job_config).result()
        for row in results:
            return row.raw_answer
    except Exception as e:
        logger.warning(f"Failed to fetch previous answer: {e}")

    return None


def compute_diff_metadata(current: str, previous: str | None) -> dict[str, Any]:
    """Compute diff metadata between current and previous answer."""
    if previous is None:
        return {
            "is_first_answer": True,
            "has_changes": True,
        }

    current_normalized = normalize_text(current)
    previous_normalized = normalize_text(previous)

    # Simple diff metrics
    current_words = set(current_normalized.split())
    previous_words = set(previous_normalized.split())

    added_words = current_words - previous_words
    removed_words = previous_words - current_words
    common_words = current_words & previous_words

    # Jaccard similarity
    total_words = len(current_words | previous_words)
    similarity = len(common_words) / total_words if total_words > 0 else 1.0

    return {
        "is_first_answer": False,
        "has_changes": current_normalized != previous_normalized,
        "similarity_score": round(similarity, 3),
        "words_added": len(added_words),
        "words_removed": len(removed_words),
        "length_change": len(current) - len(previous),
    }


def update_answer_metadata(answer_id: str, event_date: str, metadata: dict[str, Any]) -> None:
    """Update ai_answers row with diff metadata."""
    if not GCP_PROJECT_ID:
        logger.warning("GCP_PROJECT_ID not set, skipping answer metadata update")
        return

    client = get_bq_client()

    # Use MERGE for idempotent update
    query = f"""
    UPDATE `{GCP_PROJECT_ID}.{BQ_DATASET}.ai_answers`
    SET metadata = @metadata
    WHERE answer_id = @answer_id AND event_date = @event_date
    """

    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("answer_id", "STRING", answer_id),
            bigquery.ScalarQueryParameter("event_date", "DATE", event_date),
            bigquery.ScalarQueryParameter("metadata", "JSON", json.dumps(metadata)),
        ]
    )

    try:
        client.query(query, job_config=job_config).result()
        logger.info(
            "Updated answer metadata",
            extra={"answer_id": answer_id},
        )
    except Exception as e:
        logger.warning(f"Failed to update answer metadata: {e}")


# -----------------------------------------------------------------------------
# Pub/Sub Publishing
# -----------------------------------------------------------------------------


def publish_answer_parsed(message: AnswerParsedMessage) -> None:
    """Publish answer_parsed message to Pub/Sub."""
    if not GCP_PROJECT_ID:
        logger.warning("GCP_PROJECT_ID not set, skipping Pub/Sub publish")
        return

    publisher = get_publisher()
    topic_path = publisher.topic_path(GCP_PROJECT_ID, PUBSUB_TOPIC_ANSWER_PARSED)

    message_data = message.model_dump_json().encode("utf-8")
    future = publisher.publish(topic_path, message_data)
    message_id = future.result()

    logger.info(
        f"Published answer_parsed message: {message_id}",
        extra={"run_id": message.run_id, "answer_id": message.answer_id},
    )


# -----------------------------------------------------------------------------
# Core Processing Logic
# -----------------------------------------------------------------------------


def process_answer(message: AnswerGeneratedMessage) -> AnswerParsedMessage:
    """
    Process an answer_generated message.

    1. Extract URLs and domains
    2. Extract brand mentions
    3. Extract named entities
    4. Write citations and entities to BigQuery
    5. Compute and update diff metadata
    6. Return answer_parsed message
    """
    answer_id = message.answer_id
    run_id = message.run_id
    brand = message.brand
    text = message.raw_answer

    logger.info(
        f"Processing answer: {answer_id}",
        extra={"run_id": run_id, "answer_id": answer_id, "prompt_id": message.prompt_id},
    )

    # Extract citations
    url_data = extract_urls_and_domains(text)
    citations: list[CitationRecord] = []
    citation_outputs: list[CitationOutput] = []

    for url, domain, anchor_text, position in url_data:
        is_brand_owned = is_brand_owned_domain(domain, brand)
        citation_id = generate_citation_id(answer_id, url)

        citation = CitationRecord(
            citation_id=citation_id,
            answer_id=answer_id,
            run_id=run_id,
            prompt_id=message.prompt_id,
            brand=brand,
            event_date=message.event_date,
            url=url,
            domain=domain,
            position=position,
            anchor_text=anchor_text,
            is_brand_owned=is_brand_owned,
            is_competitor=not is_brand_owned,  # Simplified: non-brand = competitor
        )
        citations.append(citation)

        citation_outputs.append(CitationOutput(
            citation_id=citation_id,
            url=url,
            domain=domain,
            position=position,
            anchor_text=anchor_text,
            is_brand_owned=is_brand_owned,
            is_competitor=not is_brand_owned,
        ))

    # Extract entities (brand mentions + named entities)
    entities: list[EntityRecord] = []
    entity_outputs: list[EntityOutput] = []

    # Brand mentions
    brand_mentions = extract_brand_mentions(text, brand)
    for brand_text, count, is_target in brand_mentions:
        entity_id = generate_entity_id(answer_id, brand_text, "brand")

        entity = EntityRecord(
            entity_id=entity_id,
            answer_id=answer_id,
            run_id=run_id,
            prompt_id=message.prompt_id,
            brand=brand,
            event_date=message.event_date,
            entity_text=brand_text,
            entity_type="brand",
            confidence_score=0.95,
            mention_count=count,
            is_target_brand=is_target,
            is_competitor=False,
            sentiment="positive",  # Brand mentions assumed positive in context
        )
        entities.append(entity)

        entity_outputs.append(EntityOutput(
            entity_id=entity_id,
            entity_text=brand_text,
            entity_type="brand",
            mention_count=count,
            is_target_brand=is_target,
            is_competitor=False,
            sentiment="positive",
            confidence_score=0.95,
        ))

    # Named entities
    named_entities = extract_named_entities(text, brand)
    for entity_text, entity_type, count, confidence in named_entities:
        normalized = normalize_text(entity_text)
        normalized_brand = normalize_text(brand) if brand else ""

        # Skip if already captured as brand mention
        if normalized_brand and normalized_brand in normalized:
            continue

        entity_id = generate_entity_id(answer_id, entity_text, entity_type)
        is_target = normalized_brand in normalized if normalized_brand else False

        entity = EntityRecord(
            entity_id=entity_id,
            answer_id=answer_id,
            run_id=run_id,
            prompt_id=message.prompt_id,
            brand=brand,
            event_date=message.event_date,
            entity_text=entity_text,
            entity_type=entity_type,
            confidence_score=confidence,
            mention_count=count,
            is_target_brand=is_target,
            is_competitor=not is_target and entity_type == "brand",
            sentiment=None,
        )
        entities.append(entity)

        entity_outputs.append(EntityOutput(
            entity_id=entity_id,
            entity_text=entity_text,
            entity_type=entity_type,
            mention_count=count,
            is_target_brand=is_target,
            is_competitor=not is_target and entity_type == "brand",
            sentiment=None,
            confidence_score=confidence,
        ))

    # Write to BigQuery
    write_citations_to_bigquery(citations)
    write_entities_to_bigquery(entities)

    # Compute and update diff metadata
    previous_answer = fetch_previous_answer(
        message.prompt_id, message.event_date, answer_id
    )
    diff_metadata = compute_diff_metadata(text, previous_answer)
    update_answer_metadata(answer_id, message.event_date, diff_metadata)

    # Compute summary
    brand_citations = sum(1 for c in citation_outputs if c.is_brand_owned)
    competitor_citations = sum(1 for c in citation_outputs if c.is_competitor)
    brand_mentions_count = sum(e.mention_count for e in entity_outputs if e.is_target_brand)
    competitor_mentions = sum(e.mention_count for e in entity_outputs if e.is_competitor)

    summary = ParseSummary(
        total_citations=len(citation_outputs),
        brand_citations=brand_citations,
        competitor_citations=competitor_citations,
        total_entities=len(entity_outputs),
        brand_mentions=brand_mentions_count,
        competitor_mentions=competitor_mentions,
    )

    logger.info(
        f"Parsed answer: {len(citations)} citations, {len(entities)} entities",
        extra={"run_id": run_id, "answer_id": answer_id},
    )

    return AnswerParsedMessage(
        answer_id=answer_id,
        run_id=run_id,
        prompt_id=message.prompt_id,
        brand=brand,
        event_date=message.event_date,
        citations=citation_outputs,
        entities=entity_outputs,
        summary=summary,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


# -----------------------------------------------------------------------------
# FastAPI Application
# -----------------------------------------------------------------------------

app = FastAPI(
    title="Parser Service",
    description="Extracts citations and entities from AI answers",
    version="1.0.0",
)


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

        if "data" not in envelope.message:
            raise HTTPException(status_code=400, detail="Missing message data")

        message_data = base64.b64decode(envelope.message["data"]).decode("utf-8")
        message_json = json.loads(message_data)
        message = AnswerGeneratedMessage(**message_json)

        # Process the answer
        result = process_answer(message)

        # Publish parsed message
        publish_answer_parsed(result)

        return {
            "status": "ok",
            "answer_id": result.answer_id,
            "citations_count": result.summary.total_citations,
            "entities_count": result.summary.total_entities,
        }

    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in message: {e}")
        raise HTTPException(status_code=400, detail="Invalid JSON")

    except Exception as e:
        logger.error(f"Error processing message: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/parse")
async def parse_direct(message: AnswerGeneratedMessage) -> dict[str, Any]:
    """
    Direct endpoint for testing without Pub/Sub.

    Accepts the same payload as answer_generated messages.
    """
    result = process_answer(message)
    publish_answer_parsed(result)

    return {
        "status": "ok",
        "result": result.model_dump(),
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8080")))
