#!/usr/bin/env bash
# Smoke test for prompt_runner service
# Usage: ./scripts/smoke_prompt_runner.sh [base_url]

set -euo pipefail

BASE_URL="${1:-http://localhost:8080}"
PASSED=0
FAILED=0

echo "=========================================="
echo "Smoke Test: prompt_runner service"
echo "Base URL: $BASE_URL"
echo "=========================================="
echo ""

# Test 1: Health check
echo "Test 1: GET /health"
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/health")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    STATUS=$(echo "$BODY" | python3 -c "import sys, json; print(json.load(sys.stdin).get('status', ''))" 2>/dev/null || echo "")
    if [ "$STATUS" = "ok" ]; then
        echo "  PASS: Health check returned status=ok"
        ((PASSED++))
    else
        echo "  FAIL: Health check status is not 'ok'"
        echo "  Response: $BODY"
        ((FAILED++))
    fi
else
    echo "  FAIL: Expected HTTP 200, got $HTTP_CODE"
    echo "  Response: $BODY"
    ((FAILED++))
fi
echo ""

# Test 2: Trigger a run
echo "Test 2: POST /run"
IDEMPOTENCY_KEY="smoke-test-$(date +%s)"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/run" \
    -H "Content-Type: application/json" \
    -H "X-Idempotency-Key: $IDEMPOTENCY_KEY" \
    -d '{"run_type": "manual", "triggered_by": "smoke_test"}')
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    RUN_ID=$(echo "$BODY" | python3 -c "import sys, json; print(json.load(sys.stdin).get('run_id', ''))" 2>/dev/null || echo "")
    if [ -n "$RUN_ID" ]; then
        echo "  PASS: Run triggered successfully"
        echo "  run_id: $RUN_ID"
        ((PASSED++))
    else
        echo "  FAIL: Response missing run_id"
        echo "  Response: $BODY"
        ((FAILED++))
    fi
else
    echo "  FAIL: Expected HTTP 200, got $HTTP_CODE"
    echo "  Response: $BODY"
    ((FAILED++))
fi
echo ""

# Test 3: Idempotency check
echo "Test 3: POST /run (idempotency check)"
RESPONSE2=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/run" \
    -H "Content-Type: application/json" \
    -H "X-Idempotency-Key: $IDEMPOTENCY_KEY" \
    -d '{"run_type": "manual", "triggered_by": "smoke_test"}')
HTTP_CODE2=$(echo "$RESPONSE2" | tail -n1)
BODY2=$(echo "$RESPONSE2" | sed '$d')

if [ "$HTTP_CODE2" = "200" ]; then
    RUN_ID2=$(echo "$BODY2" | python3 -c "import sys, json; print(json.load(sys.stdin).get('run_id', ''))" 2>/dev/null || echo "")
    if [ "$RUN_ID" = "$RUN_ID2" ]; then
        echo "  PASS: Idempotency working - same run_id returned"
        ((PASSED++))
    else
        echo "  FAIL: Idempotency not working - different run_id returned"
        echo "  First:  $RUN_ID"
        echo "  Second: $RUN_ID2"
        ((FAILED++))
    fi
else
    echo "  FAIL: Expected HTTP 200, got $HTTP_CODE2"
    echo "  Response: $BODY2"
    ((FAILED++))
fi
echo ""

# Test 4: OpenAPI docs available
echo "Test 4: GET /docs (OpenAPI UI)"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/docs")
if [ "$HTTP_CODE" = "200" ]; then
    echo "  PASS: OpenAPI docs available"
    ((PASSED++))
else
    echo "  FAIL: OpenAPI docs not available (HTTP $HTTP_CODE)"
    ((FAILED++))
fi
echo ""

# Summary
echo "=========================================="
echo "Results: $PASSED passed, $FAILED failed"
echo "=========================================="

if [ "$FAILED" -gt 0 ]; then
    exit 1
fi
exit 0
