#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Smoke test for answer_generator service
# Usage: ./scripts/smoke_answer_generator.sh [BASE_URL]
#
# Prerequisites:
# - Service running locally or deployed
# - GEMINI_API_KEY set (if testing locally)
# - GCP_PROJECT_ID set (if testing locally)
# -----------------------------------------------------------------------------

set -euo pipefail

BASE_URL="${1:-http://localhost:8080}"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
RUN_ID="smoke_test_$(date +%s)"

echo "========================================"
echo "Answer Generator Smoke Test"
echo "========================================"
echo "Target: $BASE_URL"
echo "Run ID: $RUN_ID"
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
# Test 2: Direct Generate Endpoint
# -----------------------------------------------------------------------------
echo "Test 2: Direct Generate Endpoint"
echo "---------------------------------"

GENERATE_PAYLOAD=$(cat <<EOF
{
  "run_id": "$RUN_ID",
  "run_type": "manual",
  "triggered_by": "smoke_test",
  "prompts": [
    {
      "prompt_id": "smoke_prompt_001",
      "prompt_text": "What is 2 + 2? Reply with just the number.",
      "brand": "SmokeTest",
      "category": "test"
    }
  ],
  "options": {
    "model_version": "gemini-1.5-flash"
  },
  "timestamp": "$TIMESTAMP"
}
EOF
)

echo "Request payload:"
echo "$GENERATE_PAYLOAD" | head -5
echo "..."
echo ""

GENERATE_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST "$BASE_URL/generate" \
  -H "Content-Type: application/json" \
  -d "$GENERATE_PAYLOAD")

GENERATE_BODY=$(echo "$GENERATE_RESPONSE" | head -n -1)
GENERATE_CODE=$(echo "$GENERATE_RESPONSE" | tail -n 1)

if [[ "$GENERATE_CODE" == "200" ]]; then
  echo "PASS: Generate endpoint returned 200"
  echo "Response:"
  echo "$GENERATE_BODY" | python3 -m json.tool 2>/dev/null || echo "$GENERATE_BODY"
else
  echo "FAIL: Generate endpoint returned $GENERATE_CODE"
  echo "Response: $GENERATE_BODY"
  exit 1
fi

echo ""

# -----------------------------------------------------------------------------
# Test 3: Verify Response Structure
# -----------------------------------------------------------------------------
echo "Test 3: Verify Response Structure"
echo "----------------------------------"

# Check for expected fields in response
if echo "$GENERATE_BODY" | python3 -c "import sys, json; d=json.load(sys.stdin); assert d.get('status') == 'ok'" 2>/dev/null; then
  echo "PASS: Response has status=ok"
else
  echo "FAIL: Response missing status=ok"
  exit 1
fi

if echo "$GENERATE_BODY" | python3 -c "import sys, json; d=json.load(sys.stdin); assert d['result']['success'] >= 1" 2>/dev/null; then
  echo "PASS: At least one prompt succeeded"
else
  echo "FAIL: No prompts succeeded"
  exit 1
fi

echo ""

# -----------------------------------------------------------------------------
# Test 4: Simulated Pub/Sub Push (if testing locally)
# -----------------------------------------------------------------------------
echo "Test 4: Pub/Sub Push Format"
echo "---------------------------"

# Base64 encode the message data
MESSAGE_DATA=$(echo -n "$GENERATE_PAYLOAD" | base64)

PUBSUB_PAYLOAD=$(cat <<EOF
{
  "message": {
    "data": "$MESSAGE_DATA",
    "messageId": "smoke_test_msg_001",
    "publishTime": "$TIMESTAMP"
  },
  "subscription": "projects/test-project/subscriptions/prompt_run_requested-sub"
}
EOF
)

echo "Sending Pub/Sub formatted message..."

PUBSUB_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST "$BASE_URL/" \
  -H "Content-Type: application/json" \
  -d "$PUBSUB_PAYLOAD")

PUBSUB_BODY=$(echo "$PUBSUB_RESPONSE" | head -n -1)
PUBSUB_CODE=$(echo "$PUBSUB_RESPONSE" | tail -n 1)

if [[ "$PUBSUB_CODE" == "200" ]]; then
  echo "PASS: Pub/Sub push endpoint returned 200"
else
  echo "FAIL: Pub/Sub push endpoint returned $PUBSUB_CODE"
  echo "Response: $PUBSUB_BODY"
  exit 1
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
echo "1. Verify BigQuery row created in ai_answers table:"
echo "   bq query --use_legacy_sql=false \\"
echo "     'SELECT * FROM knewsearch_aeo.ai_answers WHERE run_id=\"$RUN_ID\"'"
echo ""
echo "2. Verify Pub/Sub message published to answer_generated topic"
echo ""
