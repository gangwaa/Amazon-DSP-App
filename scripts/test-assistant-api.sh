#!/bin/bash
# Test script for assistant tool endpoints.
# Run with server up: npm run dev (in another terminal)
# Usage: ./scripts/test-assistant-api.sh [BASE_URL]
# With session: SESSION_COOKIE="connect.sid=..." ./scripts/test-assistant-api.sh

set -e
BASE="${1:-http://localhost:3000}"
COOKIE="${SESSION_COOKIE:-}"

echo "Testing assistant API at $BASE"
echo "---"

# Helper: call endpoint and check response
test_endpoint() {
  local name="$1"
  local url="$2"
  local expected_status="${3:-200}"
  local curl_opts=(-s -w "\n%{http_code}" "$url")
  if [ -n "$COOKIE" ]; then
    curl_opts+=(-H "Cookie: $COOKIE")
  fi

  echo -n "GET $name ... "
  read -r body code <<< "$(curl "${curl_opts[@]}")"
  if [ "$code" = "$expected_status" ]; then
    echo "OK ($code)"
    echo "$body" | head -c 200
    echo ""
  else
    echo "FAIL (got $code, expected $expected_status)"
    echo "$body"
    return 1
  fi
}

# 1. Unauthenticated: expect 401
echo ""
echo "1. Unauthenticated (expect 401)"
test_endpoint "/api/assistant/tools/health" "$BASE/api/assistant/tools/health" 401

# 2. Missing param: expect 400 (only works when authenticated - skip if no cookie)
if [ -n "$COOKIE" ]; then
  echo ""
  echo "2. Missing advertiser_id (expect 400)"
  test_endpoint "/api/assistant/tools/hierarchy" "$BASE/api/assistant/tools/hierarchy" 400

  echo ""
  echo "3. Health (authenticated)"
  test_endpoint "/api/assistant/tools/health" "$BASE/api/assistant/tools/health" 200

  echo ""
  echo "4. Entities"
  test_endpoint "/api/assistant/tools/entities" "$BASE/api/assistant/tools/entities" 200

  echo ""
  echo "5. Advertisers"
  test_endpoint "/api/assistant/tools/advertisers" "$BASE/api/assistant/tools/advertisers" 200
else
  echo ""
  echo "No SESSION_COOKIE set. To test authenticated endpoints:"
  echo "  1. Open $BASE/dashboard and link account"
  echo "  2. Copy the connect.sid cookie from browser dev tools"
  echo "  3. SESSION_COOKIE='connect.sid=YOUR_VALUE' $0 $BASE"
fi

echo ""
echo "--- Done"
