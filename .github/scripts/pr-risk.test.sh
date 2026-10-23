#!/usr/bin/env bash
# Tests pr-risk.sh with a stub gh that serves fixture JSON and applies --jq itself.
# Run: .github/scripts/pr-risk.test.sh
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/bin"
cat >"$tmp/bin/gh" <<'STUB'
#!/usr/bin/env bash
filter=.
args=("$@")
for ((i = 0; i < ${#args[@]}; i++)); do [[ "${args[i]}" == --jq ]] && filter="${args[i + 1]}"; done
case "$*" in
  "pr view"*) jq -r "$filter" "$FIX/pr.json" ;;
  "api "*"/files"*) jq -r "$filter" "$FIX/files.json" ;;
  *) echo "stub gh: unexpected call: $*" >&2; exit 1 ;;
esac
STUB
chmod +x "$tmp/bin/gh"
export PATH="$tmp/bin:$PATH" FIX="$tmp" GITHUB_REPOSITORY=o/r
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
  jq -n --arg b "$body" '{body: $b}' >"$tmp/pr.json"
  local out before=$failures
  out=$("$here/pr-risk.sh" 7)
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

for sql in $'+ALTER TABLE x\n+  ALTER COLUMN y\n+  TYPE text;' $'+ALTER TABLE x ALTER y TYPE int;' $'+ALTER TABLE x ALTER COLUMN y SET DATA TYPE int;' \
           $'+ALTER TABLE x ALTER COLUMN y\n+  SET NOT NULL;' $'+UPDATE chores SET name = lower(name);' $'+UPDATE ONLY public.chores AS c\n+  SET name = lower(c.name);' $'+DELETE FROM x;'; do
  run_case "rewriting data is high: ${sql//$'\n'/ }" \
    "$(files "$(file backend/migrations/0016_x.sql added "$sql")")" "$(complete_body high)" "floor=high"
done

run_case "adding a nullable column is medium" \
  "$(files "$(file backend/migrations/0016_x.sql added $'+ALTER TABLE x ADD COLUMN y text;\n+CREATE INDEX x_y ON x (y);')")" "$(complete_body medium)" \
  "floor=medium"

run_case "the Down section's drop does not count" \
  "$(files "$(file backend/migrations/0016_x.sql added $'+-- +goose Up\n+CREATE TABLE x (id int);\n+-- +goose Down\n+DROP TABLE x;')")" "$(complete_body medium)" \
  "floor=medium"

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

# The case arms in floor_for are ordered: protected paths, then the test exemption, then medium.
# These pin that order, so a reorder fails here.
run_case "a test under identity stays high (above the exemption)" \
  "$(files "$(file backend/internal/identity/identity_test.go modified)")" "$(complete_body high)" "floor=high"
run_case "a test under the allocator is exempt (below the exemption)" \
  "$(files "$(file backend/internal/allocation/plan_test.go modified)")" "$(complete_body low)" "floor=low"

run_case "the allocator is medium" \
  "$(files "$(file backend/internal/allocation/check.go modified)" "$(file backend/internal/llmalloc/llmalloc.go modified)")" "$(complete_body medium)" \
  "floor=medium" "!problem="

for f in backend/internal/identity/identity.go backend/internal/users/store.go backend/internal/invites/invites.go web/src/app/components/AuthProvider.tsx web/src/app/components/SessionProvider.tsx web/src/shared/api/http.ts; do
  run_case "$f is sign-in, so high" "$(files "$(file "$f" modified)")" "$(complete_body high)" "floor=high"
done

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
