#!/usr/bin/env bash
# Tests resolve-answered-threads.sh with a stub gh that serves canned threads and logs resolves.
# Run: .github/scripts/resolve-answered-threads.test.sh
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
  *resolveReviewThread*) printf '%s\n' "$*" | grep -o 'id=T[0-9]*' >>"$FIX/resolved" ;;
  "api graphql"*) jq -r "$filter" "$FIX/threads.json" ;;
  *) echo "stub gh: unexpected call: $*" >&2; exit 1 ;;
esac
STUB
chmod +x "$tmp/bin/gh"
export PATH="$tmp/bin:$PATH" FIX="$tmp" GITHUB_REPOSITORY=o/r
: >"$tmp/resolved"

# thread <id> <resolved> <first author> <last author>
thread() { jq -n --arg id "$1" --argjson r "$2" --arg f "$3" --arg l "$4" \
  '{id: $id, isResolved: $r, first: {nodes: [{author: {login: $f}}]}, last: {nodes: [{author: {login: $l}}]}}'; }
jq -n '{data: {repository: {pullRequest: {reviewThreads: {nodes: $ARGS.positional}}}}}' --jsonargs \
  "$(thread T1 false claude homeowner-agents)" \
  "$(thread T2 false claude claude)" \
  "$(thread T3 true claude homeowner-agents)" \
  "$(thread T4 false claude AbnerWillclefy)" \
  "$(thread T5 false AbnerWillclefy homeowner-agents)" \
  >"$tmp/threads.json"

"$here/resolve-answered-threads.sh" 7 >/dev/null
expected="id=T1"
if [[ "$(cat "$tmp/resolved")" != "$expected" ]]; then
  echo "FAIL: resolved $(cat "$tmp/resolved" | tr '\n' ' '), want only T1 (open Claude thread the agents answered last)"
  exit 1
fi
echo "ok: resolves only open Claude threads the agents answered last"
