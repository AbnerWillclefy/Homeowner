#!/usr/bin/env bash
# Tests merge-by-risk.sh (and claude-findings.sh, which it calls) with a stub gh that serves canned JSON and applies --jq itself,
# so the scripts' jq filters are tested too.
# Run: .github/scripts/merge-by-risk.test.sh
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
fix=$(mktemp -d)
trap 'rm -rf "$fix"' EXIT
mkdir -p "$fix/bin"

cat >"$fix/bin/gh" <<'STUB'
#!/usr/bin/env bash
filter=.
args=("$@")
for ((i = 0; i < ${#args[@]}; i++)); do
  [[ "${args[i]}" == --jq ]] && filter="${args[i + 1]}"
done
serve() { jq -r "$filter" "$FIX/$1"; }
case "$*" in
  "pr merge"*) touch "$FIX/merged" ;;
  "pr view"*) serve pr.json ;;
  "pr checks"*) serve checks.json ;;
  "api "*"/files"*) serve files.json ;;
  "api "*"/runs?"*) serve runs.json ;;
  "api "*"/comments"*) serve comments.json ;;
  "api "*"/reviews"*) serve reviews.json ;;
  *) echo "stub gh: unexpected call: $*" >&2; exit 1 ;;
esac
STUB
chmod +x "$fix/bin/gh"

export PATH="$fix/bin:$PATH" FIX="$fix" GITHUB_REPOSITORY=o/r AGENT_LOGIN=homeowner-agents MAINTAINER_LOGIN=maintainer
failures=0
head=abc123

body() { # body <tier>
  printf '## Why\nx\n## What changes\nx\n## Risk\n**Risk:** %s\nbecause\n### What can go wrong\nx\n## How it was tested\nx\n## How to revert\nx\n' "$1"
}

# Defaults: a low-risk agent pull request, all green, clean review, no maintainer review
reset() {
  rm -f "$fix/merged"
  jq -n --arg b "$(body low)" --arg sha "$head" \
    '{state: "OPEN", author: {login: "homeowner-agents"}, baseRefName: "main", isDraft: false,
      labels: [{name: "review-addressed"}], headRefOid: $sha, mergeable: "MERGEABLE", title: "t", url: "u", body: $b}' >"$fix/pr.json"
  jq -n '[("backend-test", "web-typecheck", "web-e2e", "ui-screenshots", "claude-review", "claude-security-review")
          | {name: ., bucket: "pass", startedAt: "2026-01-01T10:00:00Z"}]
        + [{name: "pr-risk", bucket: "cancel", startedAt: "2026-01-01T10:00:00Z"},
           {name: "pr-risk", bucket: "pass", startedAt: "2026-01-01T10:05:00Z"}]' >"$fix/checks.json"
  echo '[{"filename":"web/src/a.tsx","status":"modified"}]' >"$fix/files.json"
  echo '{"workflow_runs":[{"conclusion":"success","created_at":"2026-01-01T10:00:00Z"}]}' >"$fix/runs.json"
  echo '[{"user":{"login":"claude[bot]"},"in_reply_to_id":null,"created_at":"2026-01-01T09:00:00Z","id":1}]' >"$fix/comments.json"
  echo '[]' >"$fix/reviews.json"
}

set_tier() { jq --arg b "$(body "$1")" '.body = $b' "$fix/pr.json" >"$fix/t" && mv "$fix/t" "$fix/pr.json"; }
review() { # review <state> <sha>...
  local r='[]'
  while (( $# )); do r=$(jq --arg s "$1" --arg c "$2" '. + [{user: {login: "maintainer"}, state: $s, commit_id: $c}]' <<<"$r"); shift 2; done
  echo "$r" >"$fix/reviews.json"
}

expect() { # expect merged|kept <name>
  local out; out=$("$here/merge-by-risk.sh" 7 2>&1) || true
  local got=kept; [[ -e "$fix/merged" ]] && got=merged
  if [[ "$got" == "$1" ]]; then echo "ok   $2${VERBOSE:+ ($(tail -n 1 <<<"$out"))}"; else echo "FAIL $2: expected $1, got $got"; echo "$out"; failures=$((failures + 1)); fi
}

reset; expect merged "low, all green, clean review merges (a superseded cancelled run does not block)"
reset; set_tier medium; expect kept "medium without an approval"
reset; set_tier medium; review APPROVED old; expect kept "medium approved on an older commit"
reset; set_tier medium; review APPROVED "$head"; expect merged "medium approved on the head commit"
reset; review APPROVED "$head" CHANGES_REQUESTED "$head"; expect kept "changes requested after an approval"
reset; set_tier medium; review APPROVED "$head" DISMISSED "$head"; expect kept "medium whose approval was dismissed"
reset; jq 'map(select(.name == "pr-risk"))' "$fix/checks.json" >"$fix/t" && mv "$fix/t" "$fix/checks.json"; expect kept "only pr-risk has run so far"
reset; echo '[{"name":"web-e2e","bucket":"fail","startedAt":"2026-01-01T10:00:00Z"}]' >"$fix/checks.json"; expect kept "one failing check"
reset; echo '[{"name":"web-e2e","bucket":"pending","startedAt":"2026-01-01T10:00:00Z"}]' >"$fix/checks.json"; expect kept "one pending check"
reset; echo '[{"name":"web-e2e","bucket":"pass","startedAt":"2026-01-01T10:00:00Z"},{"name":"web-e2e","bucket":"pending","startedAt":"0001-01-01T00:00:00Z"}]' >"$fix/checks.json"; expect kept "a queued re-run of a passing check"
reset; echo '[{"user":{"login":"claude[bot]"},"in_reply_to_id":null,"created_at":"2026-01-01T10:01:00Z","id":2}]' >"$fix/comments.json"; expect kept "a Claude finding after the review started"
reset; echo '[{"user":{"login":"claude[bot]"},"in_reply_to_id":1,"created_at":"2026-01-01T10:01:00Z","id":2},{"user":{"login":"maintainer"},"in_reply_to_id":null,"created_at":"2026-01-01T10:01:00Z","id":3}]' >"$fix/comments.json"; expect merged "replies and the maintainer's comments are not findings"
reset; echo '{"workflow_runs":[]}' >"$fix/runs.json"; expect kept "no review of the head commit"
reset; set_tier high; expect kept "high"
reset; echo '[{"filename":".github/workflows/x.yml","status":"modified"}]' >"$fix/files.json"; expect kept "pr-risk reports a problem (low on a workflow)"
reset; jq '.author.login = "maintainer"' "$fix/pr.json" >"$fix/t" && mv "$fix/t" "$fix/pr.json"; expect kept "the maintainer's own pull request"
reset; jq '.labels += [{name: "needs-human"}]' "$fix/pr.json" >"$fix/t" && mv "$fix/t" "$fix/pr.json"; expect kept "labelled needs-human"

reset; echo 'not json' >"$fix/runs.json"; expect kept "an API error skips the pull request instead of stopping"
reset; echo 'not json' >"$fix/runs.json"
if "$here/merge-by-risk.sh" 7 7 >"$fix/out" 2>&1; then
  echo "FAIL an API error should fail the run"; failures=$((failures + 1))
elif [[ $(grep -c '::warning::#7' "$fix/out") -ne 2 ]]; then
  echo "FAIL the sweep should go on after an error"; cat "$fix/out"; failures=$((failures + 1))
else echo "ok   an API error fails the run after sweeping every pull request"; fi
reset; if "$here/merge-by-risk.sh" 7 >/dev/null 2>&1; then echo "ok   a merge exits 0"; else echo "FAIL a merge should exit 0"; failures=$((failures + 1)); fi
reset; set_tier high; if "$here/merge-by-risk.sh" 7 >/dev/null 2>&1; then echo "ok   a gate not met exits 0"; else echo "FAIL a gate not met should exit 0"; failures=$((failures + 1)); fi

# The names merge-by-risk depends on must exist, or it waits forever or never wakes
workflows="$here/../workflows"
for name in $(sed -n 's/^required_checks=(\(.*\))$/\1/p' "$here/merge-by-risk.sh"); do
  if grep -qE "^  $name:\$|^    name: $name\$" "$workflows"/*.yml; then echo "ok   required check $name is a job"
  else echo "FAIL required check $name is not a job in .github/workflows"; failures=$((failures + 1)); fi
done
while read -r wf; do
  if grep -qxF "name: $wf" "$workflows"/*.yml; then echo "ok   trigger workflow \"$wf\" exists"
  else echo "FAIL merge-by-risk.yml waits on a workflow named \"$wf\" that does not exist"; failures=$((failures + 1)); fi
done < <(sed -n 's/^ *workflows: \[\(.*\)\]$/\1/p' "$workflows/merge-by-risk.yml" | tr ',' '\n' | sed 's/^ *"//; s/" *$//')

if (( failures )); then echo "$failures failed"; exit 1; fi
echo "all passed"
