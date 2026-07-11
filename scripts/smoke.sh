#!/usr/bin/env bash
# CMMS API smoke test.
#
# Exercises the full segment lifecycle against a running backend using the
# dev-login endpoint (no Google account needed): seeding, tags, segments,
# color auto-assignment, associations + full-cluster color propagation,
# search with facets, and graceful failure of Drive endpoints.
#
# Prereqs: backend running with ALLOW_DEV_LOGIN=true; jq installed.
# Usage:   ./scripts/smoke.sh [base_url]   (default http://localhost:3001)

set -euo pipefail

BASE="${1:-http://localhost:3001}/api/v1"
RUN_ID="$RANDOM$RANDOM"
PASS=0
FAIL=0

check() { # check <description> <actual> <expected>
  if [[ "$2" == "$3" ]]; then
    PASS=$((PASS + 1)); echo "  ✓ $1"
  else
    FAIL=$((FAIL + 1)); echo "  ✗ $1 — expected [$3], got [$2]"
  fi
}

check_ne() { # check_ne <description> <a> <b>  (asserts a != b)
  if [[ "$2" != "$3" ]]; then
    PASS=$((PASS + 1)); echo "  ✓ $1"
  else
    FAIL=$((FAIL + 1)); echo "  ✗ $1 — expected values to differ, both were [$2]"
  fi
}

api() { # api <method> <path> [json_body]
  local method="$1" path="$2" body="${3:-}"
  if [[ -n "$body" ]]; then
    curl -s -X "$method" "$BASE$path" -H "Authorization: Bearer $TOKEN" \
      -H 'Content-Type: application/json' -d "$body"
  else
    curl -s -X "$method" "$BASE$path" -H "Authorization: Bearer $TOKEN"
  fi
}

api_code() { # api_code <method> <path> [json_body] — prints HTTP status only
  local method="$1" path="$2" body="${3:-}"
  if [[ -n "$body" ]]; then
    curl -s -o /dev/null -w '%{http_code}' -X "$method" "$BASE$path" \
      -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "$body"
  else
    curl -s -o /dev/null -w '%{http_code}' -X "$method" "$BASE$path" \
      -H "Authorization: Bearer $TOKEN"
  fi
}

echo "== Auth =="
LOGIN=$(curl -s -X POST "$BASE/auth/dev-login")
TOKEN=$(echo "$LOGIN" | jq -r '.token')
check "dev-login returns a token" "$(echo "$LOGIN" | jq -r '.token | length > 20')" "true"

ME=$(api GET /auth/me)
check "GET /auth/me returns dev user" "$(echo "$ME" | jq -r '.data.user.email')" "dev@cmms.local"

echo "== Seeding =="
CATS=$(api GET /categories)
check "9 default categories seeded" "$(echo "$CATS" | jq '.data | length >= 9')" "true"
CAT_ONELINER=$(echo "$CATS" | jq -r '.data[] | select(.name == "One-Liner") | .id')
CAT_BIT=$(echo "$CATS" | jq -r '.data[] | select(.name == "Bit") | .id')

DOCS=$(api GET /documents)
check "stub document seeded" "$(echo "$DOCS" | jq -r '.data[] | select(.google_file_id == "dev-file-1") | .title')" "Dev Notebook"
DOC_ID=$(echo "$DOCS" | jq -r '.data[] | select(.google_file_id == "dev-file-1") | .id')

echo "== Tags =="
TAG1=$(api POST /tags "{\"name\":\"observational-$RUN_ID\",\"tag_type\":\"technique\"}")
TAG2=$(api POST /tags "{\"name\":\"gasstations-$RUN_ID\",\"tag_type\":\"subject\"}")
TAG1_ID=$(echo "$TAG1" | jq -r '.data.id')
TAG2_ID=$(echo "$TAG2" | jq -r '.data.id')
check "tag created with type" "$(echo "$TAG1" | jq -r '.data.tag_type')" "technique"

BULK=$(api POST /tags/bulk "{\"names\":[\"observational-$RUN_ID\",\"crowdwork-$RUN_ID\"]}")
check "bulk create skips existing, returns both" "$(echo "$BULK" | jq '.data | length')" "2"

echo "== Segments & colors =="
SEG1=$(api POST /segments "{\"document_id\":\"$DOC_ID\",\"category_id\":\"$CAT_ONELINER\",\"start_offset\":0,\"end_offset\":60,\"text_content\":\"Why do gas station bathrooms always have that one wet spot $RUN_ID\",\"title\":\"Gas Station Hands $RUN_ID\",\"tag_ids\":[\"$TAG1_ID\"]}")
SEG1_ID=$(echo "$SEG1" | jq -r '.data.id')
SEG1_COLOR=$(echo "$SEG1" | jq -r '.data.color')
check "segment created with auto-assigned color" "$(echo "$SEG1" | jq -r '.data.color | test("^#[0-9A-Fa-f]{6}$")')" "true"
check "segment word_count computed by DB trigger" "$(echo "$SEG1" | jq -r '.data.word_count > 0')" "true"
check "segment carries its tag" "$(echo "$SEG1" | jq -r '.data.tags[0].id')" "$TAG1_ID"

SUGGEST=$(api GET "/colors/suggest?document_id=$DOC_ID")
check_ne "colors/suggest avoids colors used in doc" "$(echo "$SUGGEST" | jq -r '.data.color')" "$SEG1_COLOR"

echo "== Associations & propagation =="
ASSOC1=$(api POST "/segments/$SEG1_ID/associate" "{\"target_document_id\":\"$DOC_ID\",\"start_offset\":100,\"end_offset\":140,\"text_content\":\"wet spot callback $RUN_ID\",\"association_type\":\"callback\"}")
SEG2_ID=$(echo "$ASSOC1" | jq -r '.data.id')
check "associated segment inherits color" "$(echo "$ASSOC1" | jq -r '.data.color')" "$SEG1_COLOR"
check "associated segment is not primary" "$(echo "$ASSOC1" | jq -r '.data.is_primary')" "false"

# Build a 3-deep chain: SEG1 -> SEG2 -> SEG3
ASSOC2=$(api POST "/segments/$SEG2_ID/associate" "{\"target_document_id\":\"$DOC_ID\",\"start_offset\":200,\"end_offset\":230,\"text_content\":\"nixon puddle $RUN_ID\",\"association_type\":\"derivative\"}")
SEG3_ID=$(echo "$ASSOC2" | jq -r '.data.id')

NEW_COLOR="#BA68C8"
[[ "$SEG1_COLOR" == "$NEW_COLOR" ]] && NEW_COLOR="#4DB6AC"
RECOLOR=$(api PUT "/segments/$SEG1_ID/color" "{\"color\":\"$NEW_COLOR\"}")
check "recolor reports cluster size (3 segments)" "$(echo "$RECOLOR" | jq -r '.data.updated_count')" "3"
check "color propagated to depth 2" "$(api GET "/segments/$SEG3_ID" | jq -r '.data.color')" "$NEW_COLOR"

ASSOCS=$(api GET "/segments/$SEG2_ID/associations")
check "middle segment sees both associations" "$(echo "$ASSOCS" | jq '.data | length')" "2"

echo "== Segment tag routes (regression: used to always 400) =="
check "POST /segments/:id/tags returns 200" "$(api_code POST "/segments/$SEG1_ID/tags" "{\"tag_ids\":[\"$TAG2_ID\"]}")" "200"
check "tag visible on segment" "$(api GET "/segments/$SEG1_ID" | jq --arg t "$TAG2_ID" '[.data.tags[].id] | contains([$t])')" "true"
check "DELETE /segments/:id/tags/:tag_id returns 204" "$(api_code DELETE "/segments/$SEG1_ID/tags/$TAG2_ID")" "204"

echo "== Search =="
SEARCH=$(api POST /search "{\"query\":\"gas station wet spot\",\"filters\":{}}")
check "search finds the segment" "$(echo "$SEARCH" | jq '.data.total >= 1')" "true"
check "search returns highlight markup" "$(echo "$SEARCH" | jq -r '.data.results[0].highlight | test("<b>")')" "true"
check "search returns category facets" "$(echo "$SEARCH" | jq '.data.facets.categories | length >= 1')" "true"

FILTERED=$(api POST /search "{\"query\":\"\",\"filters\":{\"category_ids\":[\"$CAT_BIT\"]}}")
check "browse-mode search (empty query + filter) works" "$(echo "$FILTERED" | jq -r '.status')" "success"

echo "== Segment listing =="
LIST=$(api GET "/segments?category_id=$CAT_ONELINER&limit=5")
check "list segments by category" "$(echo "$LIST" | jq '.data | length >= 1')" "true"
check "pagination metadata present" "$(echo "$LIST" | jq '.pagination.total >= 1')" "true"

echo "== Drive endpoints fail gracefully for dev user =="
REG_CODE=$(api_code POST /documents '{"google_file_id":"1FakeDriveFileIdForSmokeTest"}')
check "register real doc → 401 (Google not connected)" "$REG_CODE" "401"
REG_MSG=$(api POST /documents '{"google_file_id":"1FakeDriveFileIdForSmokeTest"}' | jq -r '.message')
check "register real doc → clean error message" "$(echo "$REG_MSG" | grep -c 'Google account not connected')" "1"
check "full sync without folder → 400" "$(api_code POST /sync/full)" "400"
check "server still healthy after failures" "$(curl -s -o /dev/null -w '%{http_code}' "${BASE%/api/v1}/health")" "200"

echo "== Cleanup =="
check "delete segment chain (with copies)" "$(api_code DELETE "/segments/$SEG1_ID?delete_associations=true")" "204"
api DELETE "/tags/$TAG1_ID" > /dev/null
api DELETE "/tags/$TAG2_ID" > /dev/null

echo
echo "Results: $PASS passed, $FAIL failed"
[[ "$FAIL" == "0" ]] || exit 1
