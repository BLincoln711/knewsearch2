#!/usr/bin/env bash
# Smoke test for weekly_summary_v2 service
# Usage: ./scripts/smoke_weekly_summary_v2.sh [base_url]
#
# Prerequisites:
#   - Service must be running locally or deployed
#   - For local testing: export GEMINI_API_KEY and GCP_PROJECT_ID
#   - BigQuery tables must exist in the target project

set -euo pipefail

BASE_URL="${1:-http://localhost:8080}"
BRAND="${2:-KnewSearch}"
PASSED=0
FAILED=0

echo "=========================================="
echo "Smoke Test: weekly_summary_v2 service"
echo "Base URL: $BASE_URL"
echo "Brand: $BRAND"
echo "=========================================="
echo ""

# Test 1: Health check
echo "Test 1: GET /health"
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/health")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    STATUS=$(echo "$BODY" | python3 -c "import sys, json; print(json.load(sys.stdin).get('status', ''))" 2>/dev/null || echo "")
    if [ "$STATUS" = "healthy" ]; then
        echo "  ✓ PASS: Health check returned status=healthy"
        ((PASSED++))
    else
        echo "  ✗ FAIL: Health check status is not 'healthy'"
        echo "  Response: $BODY"
        ((FAILED++))
    fi
else
    echo "  ✗ FAIL: Expected HTTP 200, got $HTTP_CODE"
    echo "  Response: $BODY"
    ((FAILED++))
fi
echo ""

# Test 2: Generate weekly summary
echo "Test 2: POST /weekly (generate summary for $BRAND)"
END_DATE=$(date +%Y-%m-%d)
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/weekly" \
    -H "Content-Type: application/json" \
    -d "{\"brand\": \"$BRAND\", \"end_date\": \"$END_DATE\", \"lookback_days\": 7}")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    SUMMARY_ID=$(echo "$BODY" | python3 -c "import sys, json; print(json.load(sys.stdin).get('summary_id', ''))" 2>/dev/null || echo "")
    if [ -n "$SUMMARY_ID" ]; then
        echo "  ✓ PASS: Weekly summary generated successfully"
        echo "  summary_id: $SUMMARY_ID"
        ((PASSED++))

        # Print email-ready text
        echo ""
        echo "  Email-Ready Text:"
        echo "  ----------------------------------------"
        EMAIL_TEXT=$(echo "$BODY" | python3 -c "import sys, json; print(json.load(sys.stdin).get('email_ready_text', '')[:500])" 2>/dev/null || echo "")
        echo "  $EMAIL_TEXT..."
        echo "  ----------------------------------------"
    else
        echo "  ✗ FAIL: Response missing summary_id"
        echo "  Response: $BODY"
        ((FAILED++))
    fi
else
    echo "  ✗ FAIL: Expected HTTP 200, got $HTTP_CODE"
    echo "  Response: $BODY"
    ((FAILED++))
fi
echo ""

# Test 3: Idempotency check (same request should return same summary_id)
echo "Test 3: POST /weekly (idempotency check)"
RESPONSE2=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/weekly" \
    -H "Content-Type: application/json" \
    -d "{\"brand\": \"$BRAND\", \"end_date\": \"$END_DATE\", \"lookback_days\": 7}")
HTTP_CODE2=$(echo "$RESPONSE2" | tail -n1)
BODY2=$(echo "$RESPONSE2" | sed '$d')

if [ "$HTTP_CODE2" = "200" ]; then
    SUMMARY_ID2=$(echo "$BODY2" | python3 -c "import sys, json; print(json.load(sys.stdin).get('summary_id', ''))" 2>/dev/null || echo "")
    if [ "$SUMMARY_ID" = "$SUMMARY_ID2" ]; then
        echo "  ✓ PASS: Idempotency working - same summary_id returned"
        ((PASSED++))
    else
        echo "  ✗ FAIL: Idempotency not working - different summary_id returned"
        echo "  First:  $SUMMARY_ID"
        echo "  Second: $SUMMARY_ID2"
        ((FAILED++))
    fi
else
    echo "  ✗ FAIL: Expected HTTP 200, got $HTTP_CODE2"
    echo "  Response: $BODY2"
    ((FAILED++))
fi
echo ""

# Test 4: Verify response structure
echo "Test 4: Validate response structure"
if [ "$HTTP_CODE" = "200" ]; then
    # Check required fields
    BRAND_RESP=$(echo "$BODY" | python3 -c "import sys, json; print(json.load(sys.stdin).get('brand', ''))" 2>/dev/null || echo "")
    START_DATE=$(echo "$BODY" | python3 -c "import sys, json; print(json.load(sys.stdin).get('start_date', ''))" 2>/dev/null || echo "")
    END_DATE_RESP=$(echo "$BODY" | python3 -c "import sys, json; print(json.load(sys.stdin).get('end_date', ''))" 2>/dev/null || echo "")

    if [ "$BRAND_RESP" = "$BRAND" ] && [ -n "$START_DATE" ] && [ -n "$END_DATE_RESP" ]; then
        echo "  ✓ PASS: Response has valid structure"
        echo "  brand: $BRAND_RESP"
        echo "  start_date: $START_DATE"
        echo "  end_date: $END_DATE_RESP"
        ((PASSED++))
    else
        echo "  ✗ FAIL: Response missing required fields"
        ((FAILED++))
    fi
else
    echo "  ✗ SKIP: Cannot validate structure (previous test failed)"
    ((FAILED++))
fi
echo ""

# Test 5: OpenAPI docs available
echo "Test 5: GET /docs (OpenAPI UI)"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/docs")
if [ "$HTTP_CODE" = "200" ]; then
    echo "  ✓ PASS: OpenAPI docs available"
    ((PASSED++))
else
    echo "  ✗ FAIL: OpenAPI docs not available (HTTP $HTTP_CODE)"
    ((FAILED++))
fi
echo ""

# Test 6: Verify BigQuery insertion (if gcloud is available)
echo "Test 6: Verify BigQuery insertion"
if command -v bq &> /dev/null && [ -n "${GCP_PROJECT_ID:-}" ]; then
    BQ_COUNT=$(bq query --format=json --use_legacy_sql=false \
        "SELECT COUNT(*) as cnt FROM \`${GCP_PROJECT_ID}.knewsearch_aeo.weekly_summaries\` WHERE summary_id = '$SUMMARY_ID' AND event_date = CURRENT_DATE()" 2>/dev/null | python3 -c "import sys, json; print(json.load(sys.stdin)[0].get('cnt', 0))" 2>/dev/null || echo "0")

    if [ "$BQ_COUNT" -ge "1" ]; then
        echo "  ✓ PASS: Row found in BigQuery weekly_summaries table"
        ((PASSED++))
    else
        echo "  ✗ FAIL: Row not found in BigQuery (count: $BQ_COUNT)"
        echo "  Note: The partition filter may prevent finding today's row if event_date differs"
        ((FAILED++))
    fi
else
    echo "  ⚠ SKIP: bq CLI not available or GCP_PROJECT_ID not set"
    echo "  To verify manually, run:"
    echo "  bq query 'SELECT * FROM \`PROJECT.knewsearch_aeo.weekly_summaries\` WHERE summary_id = \"$SUMMARY_ID\"'"
fi
echo ""

# Summary
echo "=========================================="
echo "Results: $PASSED passed, $FAILED failed"
echo "=========================================="
echo ""

# BigQuery verification queries for manual testing
echo "Manual Verification Queries:"
echo "----------------------------------------"
echo "# Check if row was inserted:"
echo "SELECT summary_id, brand, week_start_date, week_end_date, created_at"
echo "FROM \`${GCP_PROJECT_ID:-PROJECT}.knewsearch_aeo.weekly_summaries\`"
echo "WHERE event_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)"
echo "  AND brand = '$BRAND'"
echo "ORDER BY created_at DESC LIMIT 5;"
echo ""
echo "# View full summary:"
echo "SELECT *"
echo "FROM \`${GCP_PROJECT_ID:-PROJECT}.knewsearch_aeo.weekly_summaries\`"
echo "WHERE summary_id = '$SUMMARY_ID'"
echo "  AND event_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY);"
echo "----------------------------------------"

if [ "$FAILED" -gt 0 ]; then
    exit 1
fi
exit 0
