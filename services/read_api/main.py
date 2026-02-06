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

import csv
import io

import firebase_admin
from firebase_admin import auth as firebase_auth, credentials
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
import stripe
import uvicorn
from fastapi import Body, Depends, FastAPI, Header, HTTPException, Query, Request
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from google.cloud import bigquery
from google.cloud import firestore as cloud_firestore
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SERVICE_NAME = os.getenv("SERVICE_NAME", "read_api")
GCP_PROJECT_ID = os.getenv("GCP_PROJECT_ID")
BQ_DATASET = os.getenv("BQ_DATASET", "knewsearch_aeo")
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
AUTH_ENABLED = os.getenv("AUTH_ENABLED", "true").lower() == "true"

# Stripe
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
STRIPE_PRICE_ID = os.getenv("STRIPE_PRICE_ID", "")
STRIPE_PORTAL_RETURN_URL = os.getenv("STRIPE_PORTAL_RETURN_URL", "https://app.knewsearch.com/billing")
STRIPE_CHECKOUT_SUCCESS_URL = os.getenv("STRIPE_CHECKOUT_SUCCESS_URL", "https://app.knewsearch.com/?checkout=success")
STRIPE_CHECKOUT_CANCEL_URL = os.getenv("STRIPE_CHECKOUT_CANCEL_URL", "https://app.knewsearch.com/billing")

if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY

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
# Firebase Auth
# ---------------------------------------------------------------------------

if AUTH_ENABLED:
    if not firebase_admin._apps:
        # Uses Application Default Credentials on Cloud Run
        firebase_admin.initialize_app()


security = HTTPBearer(auto_error=False)


class AuthUser(BaseModel):
    """Authenticated user extracted from Firebase token."""
    uid: str
    email: str | None = None
    client_id: str | None = None
    role: str | None = None


async def verify_firebase_token(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> AuthUser | None:
    """Verify Firebase ID token and extract user claims.

    Returns None when auth is disabled (dev mode).
    Raises 401 if auth is enabled and token is invalid or missing.
    """
    if not AUTH_ENABLED:
        return None

    if not credentials:
        raise HTTPException(status_code=401, detail="Missing authorization header")

    try:
        decoded = firebase_auth.verify_id_token(credentials.credentials)
    except Exception as e:
        logger.warning(
            f"Token verification failed: {e}",
            extra={"request_id": getattr(request.state, "request_id", "")},
        )
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    auth_user = AuthUser(
        uid=decoded["uid"],
        email=decoded.get("email"),
        client_id=decoded.get("client_id"),
        role=decoded.get("role"),
    )

    # Check subscription status for non-superadmin users
    if auth_user.role != "superadmin" and auth_user.client_id:
        try:
            fs = get_fs_client()
            client_doc = fs.collection("clients").document(auth_user.client_id).get()
            if client_doc.exists:
                sub_status = client_doc.to_dict().get("subscription_status")
                if sub_status and sub_status not in ("active", "trialing"):
                    raise HTTPException(
                        status_code=402,
                        detail="Subscription required. Please update your billing to continue.",
                    )
        except HTTPException:
            raise
        except Exception as e:
            logger.warning(f"Subscription check failed: {e}")

    return auth_user


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
# Admin Pydantic Models
# ---------------------------------------------------------------------------


class CreateClientRequest(BaseModel):
    """Request to create a new client."""
    name: str = Field(description="Client organization name")
    brands: list[str] = Field(description="Brands to assign to this client")
    admin_email: str | None = Field(default=None, description="Email of admin user to invite")


class ClientResponse(BaseModel):
    """Client details."""
    client_id: str
    name: str
    status: str
    brands: list[str]
    subscription_status: str | None = None
    created_at: str


class ClientListResponse(BaseModel):
    """List of clients."""
    clients: list[ClientResponse]
    total: int


class AddBrandsRequest(BaseModel):
    """Request to add brands to a client."""
    brands: list[str] = Field(description="Brand names to add")


class AddPromptsRequest(BaseModel):
    """Request to add prompts for a client's brand."""
    brand: str = Field(description="Brand this prompt tracks")
    prompts: list[dict[str, str]] = Field(
        description="List of {prompt_id, prompt_text, category} dicts"
    )


class InviteUserRequest(BaseModel):
    """Request to invite a user to a client."""
    email: str
    role: str = Field(default="client_member", description="Role: client_admin or client_member")


class AdminMessageResponse(BaseModel):
    """Simple success/failure response."""
    message: str
    client_id: str | None = None


# ---------------------------------------------------------------------------
# Billing Pydantic Models
# ---------------------------------------------------------------------------


class CreateSubscriptionRequest(BaseModel):
    """Request to create a Stripe subscription for a client."""
    trial_days: int | None = Field(default=14, description="Trial period days, or None for no trial")


class BillingInfoResponse(BaseModel):
    """Billing info for a client."""
    client_id: str
    stripe_customer_id: str | None = None
    stripe_subscription_id: str | None = None
    subscription_status: str | None = None
    current_period_end: str | None = None
    cancel_at_period_end: bool = False
    plan_name: str | None = None


class PortalSessionResponse(BaseModel):
    """Stripe Customer Portal session URL."""
    url: str


class CheckoutSessionResponse(BaseModel):
    """Stripe Checkout session URL."""
    url: str
    session_id: str


def _require_superadmin(auth_user: AuthUser | None) -> None:
    """Raise 403 if user is not a superadmin."""
    if not _is_superadmin(auth_user):
        raise HTTPException(status_code=403, detail="Superadmin access required")


def _require_stripe() -> None:
    """Raise 500 if Stripe is not configured."""
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Stripe is not configured")


# ---------------------------------------------------------------------------
# BigQuery Client (lazy initialization)
# ---------------------------------------------------------------------------

_bq_client: bigquery.Client | None = None
_fs_client: cloud_firestore.Client | None = None


def get_bq_client() -> bigquery.Client:
    """Get or create BigQuery client."""
    global _bq_client
    if _bq_client is None:
        _bq_client = bigquery.Client(project=GCP_PROJECT_ID)
    return _bq_client


def get_fs_client() -> cloud_firestore.Client:
    """Get or create Firestore client."""
    global _fs_client
    if _fs_client is None:
        _fs_client = cloud_firestore.Client(project=GCP_PROJECT_ID)
    return _fs_client


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


def _is_superadmin(auth_user: AuthUser | None) -> bool:
    """Check if the authenticated user is a superadmin."""
    return auth_user is not None and auth_user.role == "superadmin"


def _get_client_id(auth_user: AuthUser | None) -> str | None:
    """Extract client_id from auth user, or None if auth disabled or superadmin."""
    if auth_user is None:
        return None
    if _is_superadmin(auth_user):
        return None
    return auth_user.client_id


def verify_brand_access(
    brand: str,
    auth_user: AuthUser | None,
    request_id: str = "",
) -> None:
    """Verify the authenticated user has access to the requested brand.

    Superadmins and unauthenticated users (auth disabled) bypass this check.
    """
    client_id = _get_client_id(auth_user)
    if client_id is None:
        return

    sql = f"""
    SELECT 1 FROM `{GCP_PROJECT_ID}.{BQ_DATASET}.client_brands`
    WHERE client_id = @client_id AND brand = @brand AND is_active = TRUE
    LIMIT 1
    """
    params = [
        bigquery.ScalarQueryParameter("client_id", "STRING", client_id),
        bigquery.ScalarQueryParameter("brand", "STRING", brand),
    ]
    rows = run_query(sql, params=params, request_id=request_id)
    if not rows:
        logger.warning(
            f"Brand access denied: client_id={client_id} brand={brand}",
            extra={"request_id": request_id, "brand": brand},
        )
        raise HTTPException(status_code=403, detail="Access denied for this brand")


# ---------------------------------------------------------------------------
# Rate Limiting
# ---------------------------------------------------------------------------

def _rate_limit_key(request: Request) -> str:
    """Extract rate-limit key: prefer client_id from auth, fall back to IP."""
    auth_header = request.headers.get("authorization", "")
    if auth_header.startswith("Bearer ") and AUTH_ENABLED:
        try:
            token = auth_header.split(" ", 1)[1]
            decoded = firebase_auth.verify_id_token(token)
            return decoded.get("client_id") or decoded.get("uid") or get_remote_address(request)
        except Exception:
            pass
    return get_remote_address(request)


limiter = Limiter(key_func=_rate_limit_key)


# ---------------------------------------------------------------------------
# FastAPI Application
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Read API",
    description="Read-only API for AI Search Visibility dashboards and reporting",
    version="1.0.0",
)
app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": "Rate limit exceeded. Please try again later."},
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
@limiter.limit("100/minute")
async def get_brands(
    request: Request,
    auth_user: AuthUser | None = Depends(verify_firebase_token),
    limit: int = Query(default=100, ge=1, le=1000, description="Max brands to return"),
    offset: int = Query(default=0, ge=0, description="Number of brands to skip"),
) -> BrandsResponse:
    """Return distinct active brands from prompts table, scoped to client."""
    _require_project_id()
    request_id = request.state.request_id
    client_id = _get_client_id(auth_user)

    if client_id:
        # Client-scoped: only return brands mapped to this client
        count_sql = f"""
        SELECT COUNT(DISTINCT p.brand) AS total
        FROM `{GCP_PROJECT_ID}.{BQ_DATASET}.prompts` p
        INNER JOIN `{GCP_PROJECT_ID}.{BQ_DATASET}.client_brands` cb
          ON p.brand = cb.brand
        WHERE p.brand IS NOT NULL AND p.is_active = TRUE
          AND cb.client_id = @client_id AND cb.is_active = TRUE
        """
        count_params = [
            bigquery.ScalarQueryParameter("client_id", "STRING", client_id),
        ]
        count_rows = run_query(count_sql, params=count_params, request_id=request_id)
        total = count_rows[0]["total"] if count_rows else 0

        sql = f"""
        SELECT DISTINCT p.brand
        FROM `{GCP_PROJECT_ID}.{BQ_DATASET}.prompts` p
        INNER JOIN `{GCP_PROJECT_ID}.{BQ_DATASET}.client_brands` cb
          ON p.brand = cb.brand
        WHERE p.brand IS NOT NULL AND p.is_active = TRUE
          AND cb.client_id = @client_id AND cb.is_active = TRUE
        ORDER BY p.brand
        LIMIT @limit OFFSET @offset
        """
        params = [
            bigquery.ScalarQueryParameter("client_id", "STRING", client_id),
            bigquery.ScalarQueryParameter("limit", "INT64", limit),
            bigquery.ScalarQueryParameter("offset", "INT64", offset),
        ]
    else:
        # Superadmin or auth disabled: return all brands
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


@app.get("/overview")
@limiter.limit("100/minute")
async def get_overview(
    request: Request,
    auth_user: AuthUser | None = Depends(verify_firebase_token),
    brand: str = Query(..., description="Brand to get overview for"),
    format: str = Query(default="json", description="Response format: json or csv"),
):
    """Return last 30 days of brand visibility trend."""
    _require_project_id()
    request_id = request.state.request_id
    verify_brand_access(brand, auth_user, request_id)

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

    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["event_date", "total_score", "average_score", "prompt_count"])
        for row in data:
            writer.writerow([row.event_date, row.total_score, row.average_score, row.prompt_count])
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={brand}_overview.csv"},
        )

    return OverviewResponse(brand=brand, days=len(data), data=data)


@app.get("/prompt-scores")
@limiter.limit("100/minute")
async def get_prompt_scores(
    request: Request,
    auth_user: AuthUser | None = Depends(verify_firebase_token),
    brand: str = Query(..., description="Brand to filter by"),
    date: str = Query(..., description="Date in YYYY-MM-DD format"),
    format: str = Query(default="json", description="Response format: json or csv"),
    limit: int = Query(default=50, ge=1, le=500, description="Max results to return"),
    offset: int = Query(default=0, ge=0, description="Number of results to skip"),
):
    """Return top prompt-level scores for a brand and date."""
    _require_project_id()
    request_id = request.state.request_id
    verify_brand_access(brand, auth_user, request_id)

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

    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["prompt_id", "score", "brand_mentioned", "citation_count", "volatility_rank"])
        for row in data:
            writer.writerow([row.prompt_id, row.score, row.brand_mentioned, row.citation_count, row.volatility_rank])
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={brand}_prompt_scores_{date}.csv"},
        )

    return PromptScoresResponse(
        brand=brand, date=date, data=data, total=total, limit=limit, offset=offset
    )


@app.get("/weekly-summary", response_model=WeeklySummaryResponse)
@limiter.limit("100/minute")
async def get_weekly_summary(
    request: Request,
    auth_user: AuthUser | None = Depends(verify_firebase_token),
    brand: str = Query(..., description="Brand to get weekly summary for"),
) -> WeeklySummaryResponse:
    """Return the most recent weekly summary for a brand."""
    _require_project_id()
    request_id = request.state.request_id
    verify_brand_access(brand, auth_user, request_id)

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
# Admin Endpoints (superadmin only)
# ---------------------------------------------------------------------------


@app.post("/admin/clients", response_model=AdminMessageResponse)
async def create_client(
    request: Request,
    body: CreateClientRequest,
    auth_user: AuthUser | None = Depends(verify_firebase_token),
) -> AdminMessageResponse:
    """Create a new client with brands in Firestore and BigQuery."""
    _require_superadmin(auth_user)
    _require_project_id()
    request_id = request.state.request_id
    now = datetime.now(timezone.utc)

    fs = get_fs_client()

    # Create Firestore client doc
    client_ref = fs.collection("clients").document()
    client_id = client_ref.id
    client_ref.set({
        "name": body.name,
        "status": "active",
        "stripe_customer_id": None,
        "stripe_subscription_id": None,
        "subscription_status": None,
        "brands": body.brands,
        "created_at": now,
    })

    # Insert brand mappings into BigQuery
    bq = get_bq_client()
    rows_to_insert = [
        {"client_id": client_id, "brand": brand, "is_active": True, "added_at": now.isoformat()}
        for brand in body.brands
    ]
    if rows_to_insert:
        table_ref = f"{GCP_PROJECT_ID}.{BQ_DATASET}.client_brands"
        errors = bq.insert_rows_json(table_ref, rows_to_insert)
        if errors:
            logger.error(f"BigQuery insert errors: {errors}", extra={"request_id": request_id})

    # Insert seed prompts for each brand if they don't exist
    for brand in body.brands:
        check_sql = f"""
        SELECT COUNT(*) as cnt FROM `{GCP_PROJECT_ID}.{BQ_DATASET}.prompts`
        WHERE brand = @brand AND is_active = TRUE
        """
        check_params = [bigquery.ScalarQueryParameter("brand", "STRING", brand)]
        rows = run_query(check_sql, params=check_params, request_id=request_id)
        if rows and rows[0]["cnt"] == 0:
            # Insert default prompts for new brand
            default_prompts = [
                {
                    "prompt_id": f"prm_{brand.lower().replace(' ', '_').replace('.', '')}_visibility",
                    "prompt_text": f"What companies provide services similar to {brand}?",
                    "category": "brand",
                    "brand": brand,
                    "is_active": True,
                    "created_at": now.isoformat(),
                    "updated_at": now.isoformat(),
                },
                {
                    "prompt_id": f"prm_{brand.lower().replace(' ', '_').replace('.', '')}_competitors",
                    "prompt_text": f"Who are the main competitors of {brand}?",
                    "category": "competitor",
                    "brand": brand,
                    "is_active": True,
                    "created_at": now.isoformat(),
                    "updated_at": now.isoformat(),
                },
            ]
            prompts_table = f"{GCP_PROJECT_ID}.{BQ_DATASET}.prompts"
            errors = bq.insert_rows_json(prompts_table, default_prompts)
            if errors:
                logger.error(f"Prompt insert errors: {errors}", extra={"request_id": request_id})

    # Invite admin user if email provided
    if body.admin_email:
        try:
            user = firebase_auth.get_user_by_email(body.admin_email)
            uid = user.uid
        except firebase_auth.UserNotFoundError:
            # Create the Firebase user
            user = firebase_auth.create_user(email=body.admin_email)
            uid = user.uid

        firebase_auth.set_custom_user_claims(uid, {
            "client_id": client_id,
            "role": "client_admin",
        })

        # Create Firestore user doc and membership
        fs.collection("users").document(uid).set({
            "email": body.admin_email,
            "display_name": user.display_name or "",
            "client_id": client_id,
            "role": "client_admin",
            "created_at": now,
        })
        client_ref.collection("members").document(uid).set({
            "email": body.admin_email,
            "role": "admin",
            "added_at": now,
        })

    logger.info(
        f"Created client {body.name} (id={client_id}) with {len(body.brands)} brands",
        extra={"request_id": request_id},
    )

    return AdminMessageResponse(message=f"Client '{body.name}' created", client_id=client_id)


@app.get("/admin/clients", response_model=ClientListResponse)
async def list_clients(
    request: Request,
    auth_user: AuthUser | None = Depends(verify_firebase_token),
) -> ClientListResponse:
    """List all clients (superadmin only)."""
    _require_superadmin(auth_user)
    request_id = request.state.request_id

    fs = get_fs_client()
    docs = fs.collection("clients").order_by("created_at").stream()

    clients = []
    for doc in docs:
        data = doc.to_dict()
        created_at = data.get("created_at")
        clients.append(ClientResponse(
            client_id=doc.id,
            name=data.get("name", ""),
            status=data.get("status", "unknown"),
            brands=data.get("brands", []),
            subscription_status=data.get("subscription_status"),
            created_at=created_at.isoformat() if created_at else "",
        ))

    logger.info(f"Returning {len(clients)} clients", extra={"request_id": request_id})
    return ClientListResponse(clients=clients, total=len(clients))


@app.get("/admin/clients/{client_id}", response_model=ClientResponse)
async def get_client(
    client_id: str,
    request: Request,
    auth_user: AuthUser | None = Depends(verify_firebase_token),
) -> ClientResponse:
    """Get a single client's details."""
    _require_superadmin(auth_user)

    fs = get_fs_client()
    doc = fs.collection("clients").document(client_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Client not found")

    data = doc.to_dict()
    created_at = data.get("created_at")
    return ClientResponse(
        client_id=doc.id,
        name=data.get("name", ""),
        status=data.get("status", "unknown"),
        brands=data.get("brands", []),
        subscription_status=data.get("subscription_status"),
        created_at=created_at.isoformat() if created_at else "",
    )


@app.put("/admin/clients/{client_id}", response_model=AdminMessageResponse)
async def update_client(
    client_id: str,
    request: Request,
    body: dict = Body(...),
    auth_user: AuthUser | None = Depends(verify_firebase_token),
) -> AdminMessageResponse:
    """Update a client's details (name, status)."""
    _require_superadmin(auth_user)

    fs = get_fs_client()
    doc_ref = fs.collection("clients").document(client_id)
    if not doc_ref.get().exists:
        raise HTTPException(status_code=404, detail="Client not found")

    allowed_fields = {"name", "status"}
    update_data = {k: v for k, v in body.items() if k in allowed_fields}
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")

    doc_ref.update(update_data)
    return AdminMessageResponse(message="Client updated", client_id=client_id)


@app.post("/admin/clients/{client_id}/brands", response_model=AdminMessageResponse)
async def add_brands_to_client(
    client_id: str,
    request: Request,
    body: AddBrandsRequest,
    auth_user: AuthUser | None = Depends(verify_firebase_token),
) -> AdminMessageResponse:
    """Add brands to a client."""
    _require_superadmin(auth_user)
    _require_project_id()
    request_id = request.state.request_id
    now = datetime.now(timezone.utc)

    fs = get_fs_client()
    doc_ref = fs.collection("clients").document(client_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Client not found")

    # Update Firestore brands array
    existing_brands = doc.to_dict().get("brands", [])
    new_brands = [b for b in body.brands if b not in existing_brands]
    if new_brands:
        doc_ref.update({"brands": existing_brands + new_brands})

    # Insert into BigQuery client_brands
    bq = get_bq_client()
    rows_to_insert = [
        {"client_id": client_id, "brand": brand, "is_active": True, "added_at": now.isoformat()}
        for brand in new_brands
    ]
    if rows_to_insert:
        table_ref = f"{GCP_PROJECT_ID}.{BQ_DATASET}.client_brands"
        errors = bq.insert_rows_json(table_ref, rows_to_insert)
        if errors:
            logger.error(f"BigQuery insert errors: {errors}", extra={"request_id": request_id})

    return AdminMessageResponse(
        message=f"Added {len(new_brands)} brands", client_id=client_id
    )


@app.post("/admin/clients/{client_id}/prompts", response_model=AdminMessageResponse)
async def add_prompts_for_client(
    client_id: str,
    request: Request,
    body: AddPromptsRequest,
    auth_user: AuthUser | None = Depends(verify_firebase_token),
) -> AdminMessageResponse:
    """Add prompts for a client's brand."""
    _require_superadmin(auth_user)
    _require_project_id()
    request_id = request.state.request_id
    now = datetime.now(timezone.utc)

    # Verify the brand belongs to this client
    fs = get_fs_client()
    doc = fs.collection("clients").document(client_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Client not found")

    client_brands = doc.to_dict().get("brands", [])
    if body.brand not in client_brands:
        raise HTTPException(status_code=400, detail=f"Brand '{body.brand}' not assigned to this client")

    bq = get_bq_client()
    rows_to_insert = [
        {
            "prompt_id": p.get("prompt_id", f"prm_{uuid.uuid4().hex[:8]}"),
            "prompt_text": p["prompt_text"],
            "category": p.get("category", "brand"),
            "brand": body.brand,
            "is_active": True,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
        }
        for p in body.prompts
    ]

    if rows_to_insert:
        table_ref = f"{GCP_PROJECT_ID}.{BQ_DATASET}.prompts"
        errors = bq.insert_rows_json(table_ref, rows_to_insert)
        if errors:
            logger.error(f"Prompt insert errors: {errors}", extra={"request_id": request_id})
            raise HTTPException(status_code=500, detail="Failed to insert prompts")

    return AdminMessageResponse(
        message=f"Added {len(rows_to_insert)} prompts for brand '{body.brand}'",
        client_id=client_id,
    )


@app.post("/admin/clients/{client_id}/invite", response_model=AdminMessageResponse)
async def invite_user_to_client(
    client_id: str,
    request: Request,
    body: InviteUserRequest,
    auth_user: AuthUser | None = Depends(verify_firebase_token),
) -> AdminMessageResponse:
    """Invite a user to a client organization."""
    _require_superadmin(auth_user)
    request_id = request.state.request_id
    now = datetime.now(timezone.utc)

    fs = get_fs_client()
    doc = fs.collection("clients").document(client_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Client not found")

    # Get or create Firebase user
    try:
        user = firebase_auth.get_user_by_email(body.email)
        uid = user.uid
    except firebase_auth.UserNotFoundError:
        user = firebase_auth.create_user(email=body.email)
        uid = user.uid

    # Set custom claims
    firebase_auth.set_custom_user_claims(uid, {
        "client_id": client_id,
        "role": body.role,
    })

    # Create Firestore docs
    fs.collection("users").document(uid).set({
        "email": body.email,
        "display_name": user.display_name or "",
        "client_id": client_id,
        "role": body.role,
        "created_at": now,
    })
    fs.collection("clients").document(client_id).collection("members").document(uid).set({
        "email": body.email,
        "role": "admin" if body.role == "client_admin" else "member",
        "added_at": now,
    })

    logger.info(
        f"Invited {body.email} to client {client_id} as {body.role}",
        extra={"request_id": request_id},
    )

    return AdminMessageResponse(
        message=f"Invited {body.email} as {body.role}", client_id=client_id
    )


# ---------------------------------------------------------------------------
# Billing Endpoints
# ---------------------------------------------------------------------------


@app.post("/admin/clients/{client_id}/subscription", response_model=BillingInfoResponse)
async def create_subscription(
    client_id: str,
    request: Request,
    body: CreateSubscriptionRequest = Body(default=CreateSubscriptionRequest()),
    auth_user: AuthUser | None = Depends(verify_firebase_token),
) -> BillingInfoResponse:
    """Create a Stripe customer and subscription for a client (superadmin only)."""
    _require_superadmin(auth_user)
    _require_stripe()
    request_id = request.state.request_id

    fs = get_fs_client()
    doc_ref = fs.collection("clients").document(client_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Client not found")

    client_data = doc.to_dict()

    # Create or retrieve Stripe customer
    stripe_customer_id = client_data.get("stripe_customer_id")
    if not stripe_customer_id:
        customer = stripe.Customer.create(
            name=client_data.get("name", ""),
            metadata={"client_id": client_id},
        )
        stripe_customer_id = customer.id
        doc_ref.update({"stripe_customer_id": stripe_customer_id})
        logger.info(f"Created Stripe customer {stripe_customer_id} for client {client_id}",
                     extra={"request_id": request_id})

    # Check for existing active subscription
    existing_sub_id = client_data.get("stripe_subscription_id")
    if existing_sub_id:
        try:
            existing_sub = stripe.Subscription.retrieve(existing_sub_id)
            if existing_sub.status in ("active", "trialing"):
                return BillingInfoResponse(
                    client_id=client_id,
                    stripe_customer_id=stripe_customer_id,
                    stripe_subscription_id=existing_sub_id,
                    subscription_status=existing_sub.status,
                    current_period_end=datetime.fromtimestamp(
                        existing_sub.current_period_end, tz=timezone.utc
                    ).isoformat(),
                    cancel_at_period_end=existing_sub.cancel_at_period_end,
                    plan_name="KnewSearch Visibility Dashboard",
                )
        except stripe.StripeError:
            pass

    # Create subscription
    sub_params: dict[str, Any] = {
        "customer": stripe_customer_id,
        "items": [{"price": STRIPE_PRICE_ID}],
        "metadata": {"client_id": client_id},
    }
    if body.trial_days and body.trial_days > 0:
        sub_params["trial_period_days"] = body.trial_days

    subscription = stripe.Subscription.create(**sub_params)

    # Update Firestore
    doc_ref.update({
        "stripe_subscription_id": subscription.id,
        "subscription_status": subscription.status,
    })

    logger.info(
        f"Created subscription {subscription.id} for client {client_id}",
        extra={"request_id": request_id},
    )

    return BillingInfoResponse(
        client_id=client_id,
        stripe_customer_id=stripe_customer_id,
        stripe_subscription_id=subscription.id,
        subscription_status=subscription.status,
        current_period_end=datetime.fromtimestamp(
            subscription.current_period_end, tz=timezone.utc
        ).isoformat() if subscription.current_period_end else None,
        cancel_at_period_end=subscription.cancel_at_period_end,
        plan_name="KnewSearch Visibility Dashboard",
    )


@app.get("/admin/clients/{client_id}/billing", response_model=BillingInfoResponse)
async def get_billing_info(
    client_id: str,
    request: Request,
    auth_user: AuthUser | None = Depends(verify_firebase_token),
) -> BillingInfoResponse:
    """Get billing info for a client (superadmin only)."""
    _require_superadmin(auth_user)

    fs = get_fs_client()
    doc = fs.collection("clients").document(client_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Client not found")

    data = doc.to_dict()
    stripe_sub_id = data.get("stripe_subscription_id")

    current_period_end = None
    cancel_at_period_end = False

    if stripe_sub_id and STRIPE_SECRET_KEY:
        try:
            sub = stripe.Subscription.retrieve(stripe_sub_id)
            current_period_end = datetime.fromtimestamp(
                sub.current_period_end, tz=timezone.utc
            ).isoformat() if sub.current_period_end else None
            cancel_at_period_end = sub.cancel_at_period_end
        except stripe.StripeError:
            pass

    return BillingInfoResponse(
        client_id=client_id,
        stripe_customer_id=data.get("stripe_customer_id"),
        stripe_subscription_id=stripe_sub_id,
        subscription_status=data.get("subscription_status"),
        current_period_end=current_period_end,
        cancel_at_period_end=cancel_at_period_end,
        plan_name="KnewSearch Visibility Dashboard" if stripe_sub_id else None,
    )


@app.get("/billing/info", response_model=BillingInfoResponse)
async def get_my_billing_info(
    request: Request,
    auth_user: AuthUser | None = Depends(verify_firebase_token),
) -> BillingInfoResponse:
    """Get billing info for the currently authenticated client user."""
    if not auth_user or not auth_user.client_id:
        raise HTTPException(status_code=403, detail="Client membership required")

    fs = get_fs_client()
    doc = fs.collection("clients").document(auth_user.client_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Client not found")

    data = doc.to_dict()
    stripe_sub_id = data.get("stripe_subscription_id")

    current_period_end = None
    cancel_at_period_end = False

    if stripe_sub_id and STRIPE_SECRET_KEY:
        try:
            sub = stripe.Subscription.retrieve(stripe_sub_id)
            current_period_end = datetime.fromtimestamp(
                sub.current_period_end, tz=timezone.utc
            ).isoformat() if sub.current_period_end else None
            cancel_at_period_end = sub.cancel_at_period_end
        except stripe.StripeError:
            pass

    return BillingInfoResponse(
        client_id=auth_user.client_id,
        stripe_customer_id=data.get("stripe_customer_id"),
        stripe_subscription_id=stripe_sub_id,
        subscription_status=data.get("subscription_status"),
        current_period_end=current_period_end,
        cancel_at_period_end=cancel_at_period_end,
        plan_name="KnewSearch Visibility Dashboard" if stripe_sub_id else None,
    )


@app.post("/billing/portal-session", response_model=PortalSessionResponse)
async def create_portal_session(
    request: Request,
    auth_user: AuthUser | None = Depends(verify_firebase_token),
) -> PortalSessionResponse:
    """Create a Stripe Customer Portal session for authenticated client users."""
    _require_stripe()

    if not auth_user or not auth_user.client_id:
        raise HTTPException(status_code=403, detail="Client membership required")

    fs = get_fs_client()
    doc = fs.collection("clients").document(auth_user.client_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Client not found")

    stripe_customer_id = doc.to_dict().get("stripe_customer_id")
    if not stripe_customer_id:
        raise HTTPException(status_code=400, detail="No billing account. Contact support.")

    session = stripe.billing_portal.Session.create(
        customer=stripe_customer_id,
        return_url=STRIPE_PORTAL_RETURN_URL,
    )

    return PortalSessionResponse(url=session.url)


@app.post("/billing/checkout-session", response_model=CheckoutSessionResponse)
async def create_checkout_session(
    request: Request,
    auth_user: AuthUser | None = Depends(verify_firebase_token),
) -> CheckoutSessionResponse:
    """Create a Stripe Checkout session for new subscribers."""
    _require_stripe()

    if not auth_user or not auth_user.client_id:
        raise HTTPException(status_code=403, detail="Client membership required")

    fs = get_fs_client()
    doc = fs.collection("clients").document(auth_user.client_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Client not found")

    client_data = doc.to_dict()

    # Get or create Stripe customer
    stripe_customer_id = client_data.get("stripe_customer_id")
    if not stripe_customer_id:
        customer = stripe.Customer.create(
            name=client_data.get("name", ""),
            email=auth_user.email,
            metadata={"client_id": auth_user.client_id},
        )
        stripe_customer_id = customer.id
        fs.collection("clients").document(auth_user.client_id).update({
            "stripe_customer_id": stripe_customer_id,
        })

    session = stripe.checkout.Session.create(
        customer=stripe_customer_id,
        mode="subscription",
        line_items=[{"price": STRIPE_PRICE_ID, "quantity": 1}],
        success_url=STRIPE_CHECKOUT_SUCCESS_URL,
        cancel_url=STRIPE_CHECKOUT_CANCEL_URL,
        metadata={"client_id": auth_user.client_id},
        subscription_data={"metadata": {"client_id": auth_user.client_id}},
    )

    return CheckoutSessionResponse(url=session.url, session_id=session.id)


# ---------------------------------------------------------------------------
# Stripe Webhook
# ---------------------------------------------------------------------------


@app.post("/webhooks/stripe")
async def stripe_webhook(request: Request) -> JSONResponse:
    """Handle Stripe webhook events. No auth required — verified by signature."""
    if not STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=500, detail="Webhook secret not configured")

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    request_id = request.state.request_id
    event_type = event["type"]
    data_object = event["data"]["object"]

    logger.info(f"Stripe webhook: {event_type}", extra={"request_id": request_id})

    fs = get_fs_client()

    if event_type in (
        "customer.subscription.created",
        "customer.subscription.updated",
        "customer.subscription.deleted",
    ):
        subscription = data_object
        client_id = subscription.get("metadata", {}).get("client_id")
        if not client_id:
            # Try to find client by stripe_customer_id
            customer_id = subscription.get("customer")
            if customer_id:
                docs = fs.collection("clients").where(
                    "stripe_customer_id", "==", customer_id
                ).limit(1).stream()
                for doc in docs:
                    client_id = doc.id
                    break

        if client_id:
            update_data = {
                "stripe_subscription_id": subscription.get("id"),
                "subscription_status": subscription.get("status"),
            }
            fs.collection("clients").document(client_id).update(update_data)
            logger.info(
                f"Updated subscription status for client {client_id}: {subscription.get('status')}",
                extra={"request_id": request_id},
            )

    elif event_type == "invoice.payment_failed":
        invoice = data_object
        customer_id = invoice.get("customer")
        if customer_id:
            docs = fs.collection("clients").where(
                "stripe_customer_id", "==", customer_id
            ).limit(1).stream()
            for doc in docs:
                fs.collection("clients").document(doc.id).update({
                    "subscription_status": "past_due",
                })
                logger.warning(
                    f"Payment failed for client {doc.id}",
                    extra={"request_id": request_id},
                )
                break

    return JSONResponse(content={"received": True})


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8080")))
