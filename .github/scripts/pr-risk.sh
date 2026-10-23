#!/usr/bin/env bash
# Reads a pull request's declared risk tier and checks its description.
# Usage: pr-risk.sh <pr-number>   (needs GH_TOKEN and GITHUB_REPOSITORY)
# Tests set PR_RISK_FILES (the pulls/<n>/files JSON) and PR_RISK_BODY (the description)
# to files instead, so no API is called: see pr-risk.test.sh.
#
# Prints key=value lines:
#   declared=low|medium|high|none   the tier the description states
#   floor=low|medium|high           the lowest tier the changed paths allow
#   effective=low|medium|high       the higher of the two
#   reason=<text>                   why the floor is what it is (one line each)
#   problem=<text>                  what the description is missing (one line each)
# The tiers and path floors are explained in docs/agents/pr-risk.md; keep both in step.
set -euo pipefail

pr="${1:-}"
repo="${GITHUB_REPOSITORY:-}"

rank() { case "$1" in low) echo 1 ;; medium) echo 2 ;; high) echo 3 ;; *) echo 0 ;; esac; }
max_tier() { if (( $(rank "$1") >= $(rank "$2") )); then echo "$1"; else echo "$2"; fi; }

# --- Floor: the changed paths set the lowest allowed tier -------------------

floor=low
reasons=()
raise() { # raise <tier> <reason>
  if (( $(rank "$1") > $(rank "$floor") )); then floor="$1"; fi
  reasons+=("$1: $2")
}

# Matched against all added lines joined into one, so a statement split over lines still counts
destructive_sql='\b(drop|rename|truncate)\b|\bdelete[[:space:]]+from\b|\bupdate\b[^;]*\bset\b|\balter[[:space:]]+(column[[:space:]]+)?[a-z_"]+[[:space:]]+(set[[:space:]]+(data[[:space:]]+)?)?type\b|\bset[[:space:]]+not[[:space:]]+null\b'

if [[ -n "${PR_RISK_FILES:-}" ]]; then files=$(cat "$PR_RISK_FILES"); else
  files=$(gh api "repos/$repo/pulls/$pr/files" --paginate --jq '.[]' | jq -s .)
fi

# One record per file, base64 so a name or patch with any character stays one field
while read -r record; do
  field() { base64 -d <<<"$record" | jq -r "$1"; }
  status=$(field .status)

  # A rename is judged by both names, so moving a protected file out of its folder still counts
  for file in "$(field .filename)" "$(field '.previous_filename // ""')"; do
    [[ -z "$file" ]] && continue

    case "$file" in
      .github/*)          raise high "$file changes CI, deploys or the pipeline" ;;
      .claude/*|CLAUDE.md) raise high "$file changes how the agents work" ;;
      infra/*)            raise high "$file changes AWS infrastructure" ;;
      scripts/*)          raise high "$file changes an operations script" ;;
      backend/internal/platform/auth/*|web/src/domains/auth/*)
                          raise high "$file changes sign-in" ;;
      # Tests change no behaviour a Resident sees; below the protected paths, which have no exemption
      *_test.go|*.test.ts|*.test.tsx|web/e2e/*) ;;
      backend/migrations/*.sql)
        patch=$(field '.patch // ""')
        if [[ "$status" != added ]]; then
          raise high "$file edits a migration that may already have run"
        elif [[ -z "$patch" ]]; then
          # GitHub leaves out the patch of a large diff: fail closed
          raise high "$file is a migration whose diff GitHub did not return, so it cannot be checked"
          # Added lines of the Up migration (goose's Down undoes it, so it always drops),
        # without SQL comments, joined into one line
        elif sed -n 's/^+//p' <<<"$patch" | sed '/^--[[:space:]]*+goose[[:space:]]\{1,\}Down/,$d' | sed 's/--.*//' \
            | tr '\n' ' ' | grep -iE "$destructive_sql" >/dev/null; then
          raise high "$file drops, renames or rewrites existing data"
        else
          raise medium "$file adds a migration"
        fi ;;
      backend/cmd/*|backend/internal/platform/*|backend/Dockerfile|docker-compose.yml)
                          raise medium "$file changes how the API starts or is wired" ;;
      */go.mod|*/go.sum|*/package.json|*/package-lock.json)
                          raise medium "$file changes dependencies" ;;
      web/src/sw.ts|web/src/sw/*|web/vite.config.ts)
                          raise medium "$file changes the service worker or build, which stay cached on phones" ;;
    esac
  done
done < <(jq -r '.[] | @base64' <<<"$files")

# --- Declared tier and description -----------------------------------------

# HTML comments are the template's hints, not content
if [[ -n "${PR_RISK_BODY:-}" ]]; then body=$(cat "$PR_RISK_BODY"); else
  body=$(gh pr view "$pr" -R "$repo" --json body --jq .body)
fi
body=$(tr -d '\r' <<<"$body" | perl -0pe 's/<!--.*?-->//gs')

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
