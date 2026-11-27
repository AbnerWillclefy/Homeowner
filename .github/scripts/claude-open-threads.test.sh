#!/usr/bin/env bash
# Tests claude-open-threads.sh with a stub gh that serves canned review threads.
# Run: .github/scripts/claude-open-threads.test.sh
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
  "api graphql"*) jq "$filter" "$FIX/threads.json" ;;
  *) echo "stub gh: unexpected call: $*" >&2; exit 1 ;;
esac
STUB
chmod +x "$tmp/bin/gh"
export PATH="$tmp/bin:$PATH" FIX="$tmp" GITHUB_REPOSITORY=o/r

# thread <resolved> <first author> <first body> [reply author...]
thread() {
  local r="$1" a="$2" b="$3"; shift 3
  jq -n --argjson r "$r" --arg a "$a" --arg b "$b" '{isResolved: $r, comments: {
    nodes: ([{author: {login: $a}, body: $b}] + [$ARGS.positional[] | {author: {login: .}, body: "x"}])}}' --args "$@"
}
serve() { jq -n '{data: {repository: {pullRequest: {reviewThreads: {pageInfo: {hasNextPage: false}, nodes: $ARGS.positional}}}}}' --jsonargs "$@" >"$tmp/threads.json"; }
check() {
  local got; got=$("$here/claude-open-threads.sh" 7)
  [[ "$got" == "$2" ]] || { echo "FAIL: $1: got $got, want $2"; exit 1; }
}

design='**[Finding] (design) /welcome/home at phone width: the choice is missing**'
other='**[Finding] (correctness) a nil map**'

serve "$(thread false claude "$other")" "$(thread true claude "$other" homeowner-agents)" "$(thread false AbnerWillclefy "$design")"
check "an unresolved Claude thread counts, a resolved rejected non-design one and a human's do not" 1

serve "$(thread true claude "$design" homeowner-agents)"
check "a design finding the engineer replied to counts even once resolved" 1

serve "$(thread true claude "$design")" "$(thread true claude "$design" claude)"
check "a design finding resolved without a reply (fixed), or answered only by Claude, does not count" 0

echo "claude-open-threads: all passed"
