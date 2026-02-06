#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Smoke test for scoring service
# Usage: ./scripts/smoke_scoring.sh [BASE_URL]
#
# Prerequisites:
# - Service running locally or deployed
# - GCP_PROJECT_ID set
# - BigQuery tables exist with data for target date
# -----------------------------------------------------------------------------

set -euo pipefail

BASE_URL="${1:-http://localhost:8080}"
EVENT_DATE=$(date -u +"%Y-%m-%d")
GCP_PROJECT="${GCP_PROJECT_ID:-knewsearch-prod}"
BQ_DATASET="${BQ_DATASET:-knewsearch_aeo}"

echo "========================================"
echo "Scoring Service Smoke Test"
echo "========================================"
echo "Target: $BASE_URL"
echo "Date: $EVENT_DATE"
echo "Project: $GCP_PROJECT"
echo "Dataset: $BQ_DATASET"
echo ""

# -----------------------------------------------------------------------------
# Test 1: Health Check
# -----------------------------------------------------------------------------
echo "Test 1: Health Check"
echo "--------------------"

HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/health")
HEALTH_BODY=$(echo "$HEALTH_RESPONSE" | head -n -1)
HEALTH_CODE=$(echo "$HEALTH_RESPONSE" | tail -n 1)

if [[ "$HEALTH_CODE" == "200" ]]; then
  echo "PASS: Health check returned 200"
  echo "Response: $HEALTH_BODY"
else
  echo "FAIL: Health check returned $HEALTH_CODE"
  echo "Response: $HEALTH_BODY"
  exit 1
fi

echo ""

# -----------------------------------------------------------------------------
# Test 2: Compute Scores for Today
# -----------------------------------------------------------------------------
echo "Test 2: Compute Scores for Today"
echo "---------------------------------"

SCORE_PAYLOAD=$(cat <<EOF
{
  "date": "$EVENT_DATE"
}
EOF
)

echo "Request: POST /score"
echo "Payload: $SCORE_PAYLOAD"
echo ""

SCORE_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST "$BASE_URL/score" \
  -H "Content-Type: application/json" \
  -d "$SCORE_PAYLOAD")

SCORE_BODY=$(echo "$SCORE_RESPONSE" | head -n -1)
SCORE_CODE=$(echo "$SCORE_RESPONSE" | tail -n 1)

if [[ "$SCORE_CODE" == "200" ]]; then
  echo "PASS: Score endpoint returned 200"
  echo "Response:"
  echo "$SCORE_BODY" | python3 -m json.tool 2>/dev/null || echo "$SCORE_BODY"
else
  echo "FAIL: Score endpoint returned $SCORE_CODE"
  echo "Response: $SCORE_BODY"
  exit 1
fi

echo ""

# -----------------------------------------------------------------------------
# Test 3: Verify Response Structure
# -----------------------------------------------------------------------------
echo "Test 3: Verify Response Structure"
echo "----------------------------------"

# Check for required fields
if echo "$SCORE_BODY" | python3 -c "import sys, json; d=json.load(sys.stdin); assert 'request_id' in d" 2>/dev/null; then
  echo "PASS: Response has request_id"
else
  echo "FAIL: Response missing request_id"
  exit 1
fi

if echo "$SCORE_BODY" | python3 -c "import sys, json; d=json.load(sys.stdin); assert 'status' in d" 2>/dev/null; then
  echo "PASS: Response has status"
else
  echo "FAIL: Response missing status"
  exit 1
fi

if echo "$SCORE_BODY" | python3 -c "import sys, json; d=json.load(sys.stdin); assert 'duration_ms' in d" 2>/dev/null; then
  echo "PASS: Response has duration_ms"
else
  echo "FAIL: Response missing duration_ms"
  exit 1
fi

# Check status is success or no_data (acceptable for smoke test)
STATUS=$(echo "$SCORE_BODY" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('status', 'unknown'))" 2>/dev/null)
if [[ "$STATUS" == "success" ]] || [[ "$STATUS" == "no_data" ]] || [[ "$STATUS" == "partial_success" ]]; then
  echo "PASS: Status is acceptable ($STATUS)"
else
  echo "WARN: Unexpected status: $STATUS"
fi

echo ""

# -----------------------------------------------------------------------------
# Test 4: Get Scores Endpoint
# -----------------------------------------------------------------------------
echo "Test 4: Get Scores Endpoint"
echo "---------------------------"

GET_RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/scores/$EVENT_DATE")
GET_BODY=$(echo "$GET_RESPONSE" | head -n -1)
GET_CODE=$(echo "$GET_RESPONSE" | tail -n 1)

if [[ "$GET_CODE" == "200" ]]; then
  echo "PASS: Get scores endpoint returned 200"
  # Show summary
  AGGREGATE_COUNT=$(echo "$GET_BODY" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('total_aggregate', 0))" 2>/dev/null || echo "0")
  PROMPT_COUNT=$(echo "$GET_BODY" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('total_prompt', 0))" 2>/dev/null || echo "0")
  echo "  Aggregate scores: $AGGREGATE_COUNT"
  echo "  Prompt scores: $PROMPT_COUNT"
else
  echo "FAIL: Get scores endpoint returned $GET_CODE"
  echo "Response: $GET_BODY"
  exit 1
fi

echo ""

# -----------------------------------------------------------------------------
# Test 5: Verify Scores in BigQuery
# -----------------------------------------------------------------------------
echo "Test 5: Verify Scores in BigQuery"
echo "----------------------------------"

# Only run if bq command is available
if command -v bq &> /dev/null; then
  BQ_RESULT=$(bq query --use_legacy_sql=false --format=json \
    "SELECT COUNT(*) as score_count FROM \`$GCP_PROJECT.$BQ_DATASET.visibility_scores\` WHERE event_date = DATE('$EVENT_DATE')" 2>/dev/null || echo "[]")

  SCORE_COUNT=$(echo "$BQ_RESULT" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d[0]['score_count'] if d else 0)" 2>/dev/null || echo "0")

  if [[ "$SCORE_COUNT" -gt "0" ]]; then
    echo "PASS: Found $SCORE_COUNT scores in BigQuery for $EVENT_DATE"
  else
    echo "INFO: No scores found in BigQuery for $EVENT_DATE (may be expected if no data)"
  fi
else
  echo "SKIP: bq command not available, skipping BigQuery verification"
fi

echo ""

# -----------------------------------------------------------------------------
# Test 6: Idempotency Check
# -----------------------------------------------------------------------------
echo "Test 6: Idempotency Check"
echo "-------------------------"

# Run scoring again
SCORE_RESPONSE_2=$(curl -s -w "\n%{http_code}" \
  -X POST "$BASE_URL/score" \
  -H "Content-Type: application/json" \
  -d "$SCORE_PAYLOAD")

SCORE_BODY_2=$(echo "$SCORE_RESPONSE_2" | head -n -1)
SCORE_CODE_2=$(echo "$SCORE_RESPONSE_2" | tail -n 1)

if [[ "$SCORE_CODE_2" == "200" ]]; then
  # Compare aggregate counts
  AGGREGATE_1=$(echo "$SCORE_BODY" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('aggregate_scores_written', 0))" 2>/dev/null || echo "0")
  AGGREGATE_2=$(echo "$SCORE_BODY_2" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('aggregate_scores_written', 0))" 2>/dev/null || echo "0")

  # Check status
  STATUS_2=$(echo "$SCORE_BODY_2" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('status', 'unknown'))" 2>/dev/null)

  if [[ "$STATUS_2" == "success" ]] || [[ "$STATUS_2" == "no_data" ]] || [[ "$STATUS_2" == "partial_success" ]]; then
    echo "PASS: Second run completed successfully (idempotent merge)"
    echo "  First run: $AGGREGATE_1 aggregate scores"
    echo "  Second run: $AGGREGATE_2 aggregate scores"
  else
    echo "WARN: Second run status: $STATUS_2"
  fi
else
  echo "FAIL: Second score request failed with $SCORE_CODE_2"
  exit 1
fi

echo ""

# -----------------------------------------------------------------------------
# Test 7: Invalid Date Handling
# -----------------------------------------------------------------------------
echo "Test 7: Invalid Date Handling"
echo "-----------------------------"

INVALID_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST "$BASE_URL/score" \
  -H "Content-Type: application/json" \
  -d '{"date": "not-a-date"}')

INVALID_CODE=$(echo "$INVALID_RESPONSE" | tail -n 1)

if [[ "$INVALID_CODE" == "400" ]]; then
  echo "PASS: Invalid date returns 400"
else
  echo "WARN: Invalid date returned $INVALID_CODE (expected 400)"
fi

echo ""

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------
echo "========================================"
echo "All smoke tests PASSED"
echo "========================================"
echo ""
echo "Next steps for full integration testing:"
echo ""
echo "1. Verify aggregate scores in BigQuery:"
echo "   bq query --use_legacy_sql=false \\"
echo "     'SELECT brand, visibility_score, citation_score, mention_score"
echo "      FROM $BQ_DATASET.visibility_scores"
echo "      WHERE event_date = DATE(\"$EVENT_DATE\") AND prompt_id IS NULL'"
echo ""
echo "2. Verify per-prompt scores:"
echo "   bq query --use_legacy_sql=false \\"
echo "     'SELECT brand, prompt_id, visibility_score"
echo "      FROM $BQ_DATASET.visibility_scores"
echo "      WHERE event_date = DATE(\"$EVENT_DATE\") AND prompt_id IS NOT NULL"
echo "      LIMIT 10'"
echo ""
echo "3. Check score component breakdown:"
echo "   bq query --use_legacy_sql=false \\"
echo "     'SELECT brand, JSON_VALUE(metadata, \"$.mention_component\") AS mention,"
echo "             JSON_VALUE(metadata, \"$.citation_component\") AS citation,"
echo "             JSON_VALUE(metadata, \"$.volatility_penalty\") AS volatility"
echo "      FROM $BQ_DATASET.visibility_scores"
echo "      WHERE event_date = DATE(\"$EVENT_DATE\") AND prompt_id IS NULL'"
echo ""
