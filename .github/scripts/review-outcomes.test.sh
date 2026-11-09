#!/usr/bin/env bash
# Tests review-outcomes.sh with a stub gh that serves canned JSON and applies --jq itself.
# Run: .github/scripts/review-outcomes.test.sh
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
  "pr list"*) jq -r "$filter" "$FIX/prs.json" ;;
  "api graphql"*"pr=7"*) jq -r "$filter" "$FIX/threads-7.json" ;;
  *) echo "stub gh: unexpected call: $*" >&2; exit 1 ;;
esac
STUB
chmod +x "$tmp/bin/gh"
export PATH="$tmp/bin:$PATH" FIX="$tmp" GITHUB_REPOSITORY=o/r
failures=0

# comment <author> <body> <createdAt> <commit>
comment() { jq -n --arg a "$1" --arg b "$2" --arg t "$3" --arg c "$4" \
  '{author: {login: $a}, body: $b, createdAt: $t, originalCommit: {oid: $c}}'; }
# thread <path> <comment-json>...
thread() { local path="$1"; shift; jq -n --arg p "$path" '{path: $p, comments: {nodes: $ARGS.positional}}' --jsonargs "$@"; }

jq -n '[{number: 7, mergedAt: "2026-11-05T10:00:00Z"}]' >"$tmp/prs.json"
jq -n '{data: {repository: {pullRequest: {reviewThreads: {pageInfo: {hasNextPage: false}, nodes: $ARGS.positional}}}}}' --jsonargs \
  "$(thread backend/a.go "$(comment claude '**[Finding] (correctness) Nil map write**' 2026-11-02T10:00:00Z c1)")" \
  "$(thread web/src/b.tsx "$(comment claude '**[Suggestion] (tests) No test for the empty list**' 2026-11-02T10:01:00Z c1)" \
     "$(comment homeowner-agents 'Rejected: the empty list is covered by b.test.tsx.' 2026-11-02T11:00:00Z c1)")" \
  "$(thread backend/c.go "$(comment claude '**[Finding] (security) Token logged**' 2026-11-03T10:00:00Z c2)")" \
  "$(thread docs/x.md "$(comment claude 'Old thermo-nuclear comment without a kind' 2026-11-02T10:02:00Z c1)")" \
  "$(thread web/d.ts "$(comment maintainer 'A human thread' 2026-11-02T10:03:00Z c1)")" \
  >"$tmp/threads-7.json"

out=$("$here/review-outcomes.sh" threads 2026-10-08)

check() { # check <name> <jq expression that must be true>
  if jq -e "$2" <<<"$out" >/dev/null; then echo "ok   $1"; else echo "FAIL $1"; echo "$out"; failures=$((failures + 1)); fi
}
check "keeps only pr-review comments by Claude" 'length == 3'
check "a comment with no reply is accepted" '.[0] | .outcome == "accepted" and .kind == "Finding" and .category == "correctness"'
check "a reply from anyone but Claude is a rejection, with its reason" '.[1] | .outcome == "rejected" and (.reply | startswith("Rejected:"))'
check "the area is the top folder" '[.[].area] == ["backend", "web", "backend"]'
check "only the first review commit is the first round" '[.[].first_round] == [true, true, false]'
check "the week is the ISO week of the comment" '.[0].week == "2026-W45"'

summary=$("$here/review-outcomes.sh" summary <<<"$out")
if jq -e '. == [{week: "2026-W45", category: "correctness", accepted: 1, rejected: 0},
               {week: "2026-W45", category: "tests", accepted: 0, rejected: 1}]' <<<"$summary" >/dev/null; then
  echo "ok   the summary counts first-round outcomes per week and category"
else
  echo "FAIL the summary counts first-round outcomes per week and category"; echo "$summary"; failures=$((failures + 1))
fi

[[ $failures -eq 0 ]] && echo "all passed" || { echo "$failures failed"; exit 1; }
