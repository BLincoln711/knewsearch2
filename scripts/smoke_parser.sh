#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Smoke test for parser service
# Usage: ./scripts/smoke_parser.sh [BASE_URL]
#
# Prerequisites:
# - Service running locally or deployed
# - GCP_PROJECT_ID set (if testing locally)
# -----------------------------------------------------------------------------

set -euo pipefail

BASE_URL="${1:-http://localhost:8080}"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
EVENT_DATE=$(date -u +"%Y-%m-%d")
RUN_ID="smoke_parser_$(date +%s)"
ANSWER_ID="ans_smoke_${RUN_ID}"

# Helper: split curl response into body and HTTP code (macOS compatible)
split_response() {
  local response="$1"
  RESP_CODE=$(echo "$response" | tail -n 1)
  RESP_BODY=$(echo "$response" | sed '$d')
}

echo "========================================"
echo "Parser Service Smoke Test"
echo "========================================"
echo "Target: $BASE_URL"
echo "Run ID: $RUN_ID"
echo "Answer ID: $ANSWER_ID"
echo ""

# -----------------------------------------------------------------------------
# Test 1: Health Check
# -----------------------------------------------------------------------------
echo "Test 1: Health Check"
echo "--------------------"

HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/health")
split_response "$HEALTH_RESPONSE"

if [[ "$RESP_CODE" == "200" ]]; then
  echo "PASS: Health check returned 200"
  echo "Response: $RESP_BODY"
else
  echo "FAIL: Health check returned $RESP_CODE"
  echo "Response: $RESP_BODY"
  exit 1
fi

echo ""

# -----------------------------------------------------------------------------
# Test 2: Direct Parse Endpoint
# -----------------------------------------------------------------------------
echo "Test 2: Direct Parse Endpoint"
echo "-----------------------------"

# Sample answer with various URL formats and brand mentions
RAW_ANSWER="For small businesses, several CRM options stand out:

1. **HubSpot CRM** - Offers a robust free tier with contact management. [Source: hubspot.com/crm]

2. **Acme CRM** - Known for its intuitive interface and strong customer support. Pricing starts at \$29/month. Learn more at https://acmecrm.com/pricing

3. **Salesforce Essentials** - Enterprise-grade features for small teams. [Visit salesforce.com/small-business]

4. **Zoho CRM** - Affordable with good automation. See [their site](https://zoho.com/crm) for details.

Acme Corp offers excellent value for growing businesses, with Acme CRM being particularly strong in the SMB market."

PARSE_PAYLOAD=$(cat <<EOF
{
  "answer_id": "$ANSWER_ID",
  "run_id": "$RUN_ID",
  "prompt_id": "prm_smoke_test",
  "brand": "Acme Corp",
  "event_date": "$EVENT_DATE",
  "prompt_text": "What is the best CRM software for small businesses?",
  "raw_answer": $(echo "$RAW_ANSWER" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))'),
  "model_version": "gemini-1.5-flash",
  "token_count": {"prompt": 45, "response": 312},
  "latency_ms": 1200,
  "timestamp": "$TIMESTAMP"
}
EOF
)

echo "Request payload (truncated):"
echo "$PARSE_PAYLOAD" | head -8
echo "..."
echo ""

PARSE_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST "$BASE_URL/parse" \
  -H "Content-Type: application/json" \
  -d "$PARSE_PAYLOAD")

split_response "$PARSE_RESPONSE"
PARSE_BODY="$RESP_BODY"
PARSE_CODE="$RESP_CODE"

if [[ "$PARSE_CODE" == "200" ]]; then
  echo "PASS: Parse endpoint returned 200"
  echo "Response:"
  echo "$PARSE_BODY" | python3 -m json.tool 2>/dev/null || echo "$PARSE_BODY"
else
  echo "FAIL: Parse endpoint returned $PARSE_CODE"
  echo "Response: $PARSE_BODY"
  exit 1
fi

echo ""

# -----------------------------------------------------------------------------
# Test 3: Verify Response Structure
# -----------------------------------------------------------------------------
echo "Test 3: Verify Response Structure"
echo "----------------------------------"

if echo "$PARSE_BODY" | python3 -c "import sys, json; d=json.load(sys.stdin); assert d.get('status') == 'ok'" 2>/dev/null; then
  echo "PASS: Response has status=ok"
else
  echo "FAIL: Response missing status=ok"
  exit 1
fi

if echo "$PARSE_BODY" | python3 -c "import sys, json; d=json.load(sys.stdin); r=d['result']; assert len(r['citations']) >= 3" 2>/dev/null; then
  echo "PASS: Extracted at least 3 citations"
else
  echo "WARN: Less than 3 citations extracted (may be expected based on input)"
fi

if echo "$PARSE_BODY" | python3 -c "import sys, json; d=json.load(sys.stdin); r=d['result']; assert len(r['entities']) >= 1" 2>/dev/null; then
  echo "PASS: Extracted at least 1 entity"
else
  echo "WARN: No entities extracted"
fi

if echo "$PARSE_BODY" | python3 -c "import sys, json; d=json.load(sys.stdin); r=d['result']; assert 'summary' in r" 2>/dev/null; then
  echo "PASS: Response includes summary"
else
  echo "FAIL: Response missing summary"
  exit 1
fi

echo ""

# -----------------------------------------------------------------------------
# Test 4: Verify Citation Details
# -----------------------------------------------------------------------------
echo "Test 4: Verify Citation Details"
echo "--------------------------------"

# Check that brand-owned domain is detected
BRAND_OWNED=$(echo "$PARSE_BODY" | python3 -c "
import sys, json
d = json.load(sys.stdin)
citations = d['result']['citations']
brand_owned = [c for c in citations if c.get('is_brand_owned')]
print(len(brand_owned))
" 2>/dev/null || echo "0")

if [[ "$BRAND_OWNED" -ge "1" ]]; then
  echo "PASS: Detected $BRAND_OWNED brand-owned citation(s)"
else
  echo "INFO: No brand-owned citations detected (check domain matching)"
fi

echo ""

# -----------------------------------------------------------------------------
# Test 5: Pub/Sub Push Format
# -----------------------------------------------------------------------------
echo "Test 5: Pub/Sub Push Format"
echo "---------------------------"

# Base64 encode the message data
MESSAGE_DATA=$(echo -n "$PARSE_PAYLOAD" | base64)

PUBSUB_PAYLOAD=$(cat <<EOF
{
  "message": {
    "data": "$MESSAGE_DATA",
    "messageId": "smoke_test_msg_parser_001",
    "publishTime": "$TIMESTAMP"
  },
  "subscription": "projects/test-project/subscriptions/answer_generated-sub"
}
EOF
)

echo "Sending Pub/Sub formatted message..."

PUBSUB_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST "$BASE_URL/" \
  -H "Content-Type: application/json" \
  -d "$PUBSUB_PAYLOAD")

split_response "$PUBSUB_RESPONSE"

if [[ "$RESP_CODE" == "200" ]]; then
  echo "PASS: Pub/Sub push endpoint returned 200"
  echo "Response: $RESP_BODY"
else
  echo "FAIL: Pub/Sub push endpoint returned $RESP_CODE"
  echo "Response: $RESP_BODY"
  exit 1
fi

echo ""

# -----------------------------------------------------------------------------
# Test 6: Deterministic IDs (Idempotency)
# -----------------------------------------------------------------------------
echo "Test 6: Deterministic IDs (Idempotency)"
echo "----------------------------------------"

# Send the same request again
PARSE_RESPONSE_2=$(curl -s -w "\n%{http_code}" \
  -X POST "$BASE_URL/parse" \
  -H "Content-Type: application/json" \
  -d "$PARSE_PAYLOAD")

split_response "$PARSE_RESPONSE_2"
PARSE_BODY_2="$RESP_BODY"

# Extract citation IDs from both responses
CITATIONS_1=$(echo "$PARSE_BODY" | python3 -c "
import sys, json
d = json.load(sys.stdin)
ids = sorted([c['citation_id'] for c in d['result']['citations']])
print(','.join(ids))
" 2>/dev/null)

CITATIONS_2=$(echo "$PARSE_BODY_2" | python3 -c "
import sys, json
d = json.load(sys.stdin)
ids = sorted([c['citation_id'] for c in d['result']['citations']])
print(','.join(ids))
" 2>/dev/null)

if [[ "$CITATIONS_1" == "$CITATIONS_2" ]]; then
  echo "PASS: Citation IDs are deterministic"
else
  echo "FAIL: Citation IDs differ between identical requests"
  echo "First:  $CITATIONS_1"
  echo "Second: $CITATIONS_2"
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
echo ""
echo "1. Verify citations in BigQuery:"
echo "   bq query --use_legacy_sql=false \\"
echo "     'SELECT * FROM knewsearch_aeo.citations WHERE answer_id=\"$ANSWER_ID\" AND event_date=\"$EVENT_DATE\"'"
echo ""
echo "2. Verify entities in BigQuery:"
echo "   bq query --use_legacy_sql=false \\"
echo "     'SELECT * FROM knewsearch_aeo.entities WHERE answer_id=\"$ANSWER_ID\" AND event_date=\"$EVENT_DATE\"'"
echo ""
echo "3. Verify ai_answers metadata updated:"
echo "   bq query --use_legacy_sql=false \\"
echo "     'SELECT answer_id, metadata FROM knewsearch_aeo.ai_answers WHERE answer_id=\"$ANSWER_ID\"'"
echo ""
echo "4. Verify Pub/Sub message published to answer_parsed topic"
echo ""
