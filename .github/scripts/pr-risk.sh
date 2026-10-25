#!/usr/bin/env bash
# Reads a pull request's declared risk tier and checks its description.
# Usage: pr-risk.sh <pr-number>   (needs GH_TOKEN and GITHUB_REPOSITORY; tested in pr-risk.test.sh)
#
# Prints key=value lines:
#   declared=low|medium|high|none   the tier the description states
#   floor=low|medium|high           the lowest tier the changed paths allow
#   effective=low|medium|high       the higher of the two
#   reason=<text>                   why the floor is what it is (one line each)
#   problem=<text>                  what the description is missing (one line each)
# The tiers are explained in docs/agents/pr-risk.md; floor_for below is the only list of path floors.
set -euo pipefail

pr="$1"
repo="${GITHUB_REPOSITORY:?}"

rank() { case "$1" in low) echo 1 ;; medium) echo 2 ;; high) echo 3 ;; *) echo 0 ;; esac; }
max_tier() { if (( $(rank "$1") >= $(rank "$2") )); then echo "$1"; else echo "$2"; fi; }

# --- Floor: the changed paths set the lowest allowed tier -------------------

# Matched against all added lines joined into one, so a statement split over lines still counts
destructive_sql='\b(drop|rename|truncate)\b|\bdelete[[:space:]]+from\b|\bupdate\b[^;]*\bset\b|\balter[[:space:]]+(column[[:space:]]+)?[a-z_"]+[[:space:]]+(set[[:space:]]+(data[[:space:]]+)?)?type\b|\bset[[:space:]]+not[[:space:]]+null\b'

# Whether a migration's patch adds SQL that drops, renames or rewrites data. Reads only the Up
# migration (goose's Down undoes it, so it always drops) and ignores SQL comments.
adds_destructive_sql() {
  sed -n 's/^+//p' <<<"$1" | sed '/^--[[:space:]]*+goose[[:space:]]\{1,\}Down/,$d' | sed 's/--.*//' \
    | tr '\n' ' ' | grep -iE "$destructive_sql" >/dev/null  # no grep -q: an early exit breaks the pipe
}

# floor_for <status> <path> <patch>: prints "<tier><TAB><reason>" when the path sets a floor
floor_for() {
  local status="$1" file="$2" patch="$3"
  case "$file" in
    .github/*)           printf 'high\t%s changes CI, deploys or the pipeline\n' "$file" ;;
    .claude/*|CLAUDE.md) printf 'high\t%s changes how the agents work\n' "$file" ;;
    infra/*)             printf 'high\t%s changes AWS infrastructure\n' "$file" ;;
    scripts/*)           printf 'high\t%s changes an operations script\n' "$file" ;;
    backend/internal/platform/auth/*|backend/internal/identity/*|backend/internal/users/*|backend/internal/invites/*|\
    backend/internal/server/auth.go|backend/internal/server/cors.go|web/src/domains/auth/*|\
    web/src/app/components/AuthProvider.tsx|web/src/app/components/SessionProvider.tsx|web/src/shared/api/http.ts)
                         printf 'high\t%s changes sign-in, accounts, invites or who may do what\n' "$file" ;;
    # Tests change no behaviour a Resident sees; below the protected paths, which have no exemption
    *_test.go|*.test.ts|*.test.tsx|web/e2e/*) ;;
    backend/migrations/*.sql)
      if [[ "$status" != added ]]; then
        printf 'high\t%s edits a migration that may already have run\n' "$file"
      elif [[ -z "$patch" ]]; then
        # GitHub leaves out the patch of a large diff: fail closed
        printf 'high\t%s is a migration whose diff GitHub did not return, so it cannot be checked\n' "$file"
      elif adds_destructive_sql "$patch"; then
        printf 'high\t%s drops, renames or rewrites existing data\n' "$file"
      else
        printf 'medium\t%s adds a migration\n' "$file"
      fi ;;
    backend/migrations/*) printf 'high\t%s changes which migrations run or how\n' "$file" ;;
    backend/internal/allocation/*|backend/internal/llmalloc/*)
                         printf 'medium\t%s changes the allocator or its referee (ADR 0004)\n' "$file" ;;
    backend/cmd/*|backend/internal/platform/*|backend/internal/server/*|backend/Dockerfile|docker-compose.yml)
                         printf 'medium\t%s changes how the API starts or is wired\n' "$file" ;;
    */go.mod|*/go.sum|*/package.json|*/package-lock.json)
                         printf 'medium\t%s changes dependencies\n' "$file" ;;
    web/src/sw.ts|web/src/sw/*|web/vite.config.ts)
                         printf 'medium\t%s changes the service worker or build, which stay cached on phones\n' "$file" ;;
  esac
}

floor=low
reasons=()
files=$(gh api "repos/$repo/pulls/$pr/files" --paginate --jq '.[]' | jq -s .)

# A rename is judged by both names, so moving a protected file out of its folder still counts
while IFS=$'\t' read -r status file; do
  patch=''
  [[ "$file" == backend/migrations/* ]] && patch=$(jq -r --arg f "$file" '.[] | select(.filename == $f) | .patch // ""' <<<"$files")
  while IFS=$'\t' read -r tier reason; do
    floor=$(max_tier "$floor" "$tier")
    reasons+=("$tier: $reason")
  done < <(floor_for "$status" "$file" "$patch")
done < <(jq -r '.[] | [.status, .filename], (select(.previous_filename) | [.status, .previous_filename]) | @tsv' <<<"$files")

# --- Declared tier and description -----------------------------------------

# HTML comments are the template's hints, not content
body=$(gh pr view "$pr" -R "$repo" --json body --jq .body | tr -d '\r' | perl -0pe 's/<!--.*?-->//gs')

declared=$(grep -m1 -oiE '^\*\*Risk:\*\*[[:space:]]*(low|medium|high)\b' <<<"$body" \
  | grep -oiE '(low|medium|high)$' | tr '[:upper:]' '[:lower:]' || true)
declared="${declared:-none}"

# Prints the text under "## <name>" or "### <name>", up to the next heading
section() { awk -v h="$1" '/^#/ { inside = ($0 ~ "^###? *" h " *$"); next } inside' <<<"$body"; }
filled() { grep -q '[^[:space:]]' <<<"$1"; }

problems=()
[[ "$declared" == none ]] && problems+=("state the tier on its own line under ## Risk, as **Risk:** low, medium or high")
for name in "Why" "What changes" "What can go wrong" "How it was tested" "How to revert"; do
  filled "$(section "$name")" || problems+=("fill in the \"$name\" section")
done
filled "$(section "Risk" | grep -viE '^\*\*Risk:\*\*')" \
  || problems+=("explain under ## Risk why the change is this tier")

effective=$(max_tier "${declared/none/low}" "$floor")
if [[ "$declared" != none ]] && (( $(rank "$declared") < $(rank "$floor") )); then
  problems+=("the changed paths make this at least $floor risk, but the description says $declared")
fi

echo "declared=$declared"
echo "floor=$floor"
echo "effective=$effective"
for r in "${reasons[@]+"${reasons[@]}"}"; do echo "reason=$r"; done
for p in "${problems[@]+"${problems[@]}"}"; do echo "problem=$p"; done
