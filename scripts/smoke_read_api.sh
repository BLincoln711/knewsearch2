#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Smoke test for read_api service
# Usage: ./scripts/smoke_read_api.sh [BASE_URL]
#
# Prerequisites:
# - Service running locally or deployed
# - GCP_PROJECT_ID set
# - BigQuery tables exist with data
# -----------------------------------------------------------------------------

set -euo pipefail

BASE_URL="${1:-http://localhost:8080}"
BRAND="${2:-KnewSearch}"
EVENT_DATE=$(date -u +"%Y-%m-%d")
PASS=0
FAIL=0

echo "========================================"
echo "Read API Smoke Test"
echo "========================================"
echo "Target: $BASE_URL"
echo "Brand:  $BRAND"
echo "Date:   $EVENT_DATE"
echo ""

# Helper: run a test and track pass/fail
run_test() {
  local name="$1"
  local url="$2"
  local expected_code="${3:-200}"

  echo "--- $name ---"
  echo "GET $url"

  RESPONSE=$(curl -s -w "\n%{http_code}" "$url")
  BODY=$(echo "$RESPONSE" | sed '$d')
  CODE=$(echo "$RESPONSE" | tail -n 1)

  if [[ "$CODE" == "$expected_code" ]]; then
    echo "PASS ($CODE)"
    echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
    PASS=$((PASS + 1))
  else
    echo "FAIL (got $CODE, expected $expected_code)"
    echo "$BODY"
    FAIL=$((FAIL + 1))
  fi
  echo ""
}

# ---------------------------------------------------------------------------
# Test 1: Health Check
# ---------------------------------------------------------------------------
run_test "Health Check" "$BASE_URL/health"

# ---------------------------------------------------------------------------
# Test 2: List Brands
# ---------------------------------------------------------------------------
run_test "List Brands" "$BASE_URL/brands?limit=10"

# ---------------------------------------------------------------------------
# Test 3: Brand Overview
# ---------------------------------------------------------------------------
run_test "Brand Overview ($BRAND)" "$BASE_URL/overview?brand=$BRAND"

# ---------------------------------------------------------------------------
# Test 4: Prompt Scores
# ---------------------------------------------------------------------------
run_test "Prompt Scores ($BRAND, $EVENT_DATE)" \
  "$BASE_URL/prompt-scores?brand=$BRAND&date=$EVENT_DATE&limit=10"

# ---------------------------------------------------------------------------
# Test 5: Weekly Summary
# ---------------------------------------------------------------------------
echo "--- Weekly Summary ($BRAND) ---"
echo "GET $BASE_URL/weekly-summary?brand=$BRAND"

RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/weekly-summary?brand=$BRAND")
BODY=$(echo "$RESPONSE" | sed '$d')
CODE=$(echo "$RESPONSE" | tail -n 1)

# 200 = data exists, 404 = no summary yet (acceptable for smoke test)
if [[ "$CODE" == "200" ]] || [[ "$CODE" == "404" ]]; then
  echo "PASS ($CODE)"
  echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
  PASS=$((PASS + 1))
else
  echo "FAIL (got $CODE, expected 200 or 404)"
  echo "$BODY"
  FAIL=$((FAIL + 1))
fi
echo ""

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo "========================================"
echo "Results: $PASS passed, $FAIL failed"
echo "========================================"

if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi

exit 0
