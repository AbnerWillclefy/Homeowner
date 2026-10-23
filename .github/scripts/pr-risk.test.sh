#!/usr/bin/env bash
# Tests pr-risk.sh against fixture files instead of the GitHub API.
# Run: .github/scripts/pr-risk.test.sh
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
failures=0

complete_body() { # complete_body <tier>
  cat <<MD
Closes #1

## Why
Residents asked for it.

## What changes
A new screen.

## Risk

**Risk:** $1 <!-- low, medium or high -->

Only copy changes.

### What can go wrong
A label is wrong.

## How it was tested
npm test

## How to revert
Revert the merge commit.
MD
}

# run_case <name> <files-json> <body> <expected line>...
run_case() {
  local name="$1" files="$2" body="$3"; shift 3
  printf '%s' "$files" >"$tmp/files.json"
  printf '%s' "$body" >"$tmp/body.md"
  local out before=$failures
  out=$(PR_RISK_FILES="$tmp/files.json" PR_RISK_BODY="$tmp/body.md" "$here/pr-risk.sh")
  for want in "$@"; do
    if [[ "$want" == !* ]]; then
      if grep -qF -- "${want#!}" <<<"$out"; then echo "FAIL $name: did not expect '${want#!}'"; echo "$out"; failures=$((failures + 1)); fi
    elif ! grep -qF -- "$want" <<<"$out"; then
      echo "FAIL $name: expected '$want'"; echo "$out"; failures=$((failures + 1))
    fi
  done
  (( failures > before )) || echo "ok   $name"
}

file() { jq -n --arg f "$1" --arg s "$2" --arg p "${3:-}" '{filename: $f, status: $s} + (if $p == "" then {} else {patch: $p} end)'; }
files() { jq -s . <<<"$*"; }

run_case "web change declared low stays low" \
  "$(files "$(file web/src/domains/today/ui/Today.tsx modified)")" "$(complete_body low)" \
  "floor=low" "effective=low" "!problem="

run_case "test-only change sets no floor" \
  "$(files "$(file backend/internal/platform/db/db_test.go modified)" "$(file web/e2e/today.spec.ts added)" "$(file web/src/sw/payload.test.ts modified)")" "$(complete_body low)" \
  "floor=low" "!problem="

run_case "a test file under a protected path is still high" \
  "$(files "$(file .github/x.test.ts added)")" "$(complete_body high)" \
  "floor=high"

run_case "a sign-in test is still high" \
  "$(files "$(file backend/internal/platform/auth/auth_test.go modified)")" "$(complete_body high)" \
  "floor=high"

run_case "additive migration is medium" \
  "$(files "$(file backend/migrations/0016_x.sql added $'+CREATE TABLE x (id int);')")" "$(complete_body medium)" \
  "floor=medium" "effective=medium" "!problem="

run_case "migration that drops a column is high" \
  "$(files "$(file backend/migrations/0016_x.sql added $'+ALTER TABLE x DROP COLUMN y;')")" "$(complete_body high)" \
  "floor=high" "!problem="

run_case "a drop in an SQL comment does not count" \
  "$(files "$(file backend/migrations/0016_x.sql added $'+-- nothing is dropped here\n+CREATE TABLE x (id int);')")" "$(complete_body medium)" \
  "floor=medium"

run_case "edited migration is high" \
  "$(files "$(file backend/migrations/0003_users.sql modified $'+-- typo')")" "$(complete_body high)" \
  "floor=high"

run_case "added migration without a patch is high" \
  "$(files "$(file backend/migrations/0016_x.sql added)")" "$(complete_body high)" \
  "floor=high"

run_case "workflow change declared low is a problem" \
  "$(files "$(file .github/workflows/x.yml modified)")" "$(complete_body low)" \
  "floor=high" "effective=high" "problem=the changed paths make this at least high risk, but the description says low"

run_case "moving a workflow out of .github is high" \
  "$(files "$(jq -n '{filename: "docs/x.yml", previous_filename: ".github/workflows/x.yml", status: "renamed"}')")" "$(complete_body high)" \
  "floor=high"

run_case "renaming sign-in code to a test name is still high" \
  "$(files "$(jq -n '{filename: "backend/internal/platform/auth/auth_test.go", previous_filename: "backend/internal/platform/auth/auth.go", status: "renamed"}')")" "$(complete_body high)" \
  "floor=high"

run_case "a file name with quotes is read safely" \
  "$(files "$(file 'docs/a "b".md' added)")" "$(complete_body low)" \
  "floor=low" "!problem="

run_case "a missing tier is a problem and counts as the floor" \
  "$(files "$(file backend/go.mod modified)")" "$(complete_body '')" \
  "declared=none" "effective=medium" "problem=state the tier"

for section in "Why" "What changes" "What can go wrong" "How it was tested" "How to revert"; do
  body=$(complete_body low | awk -v h="$section" '/^#/ { skip = ($0 ~ "^###? *" h " *$") } !skip || /^#/')
  run_case "an empty \"$section\" is a problem" "$(files "$(file docs/a.md added)")" "$body" \
    "problem=fill in the \"$section\" section"
done

run_case "a tier without a reason is a problem" \
  "$(files "$(file docs/a.md added)")" "$(complete_body low | grep -v '^Only copy changes.$')" \
  "problem=explain under ## Risk"

if (( failures )); then echo "$failures failed"; exit 1; fi
echo "all passed"
