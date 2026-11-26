#!/usr/bin/env bash
# Tests design-pairs.sh with a stub gh that serves a canned check run, commit message and listing.
# Run: .github/scripts/design-pairs.test.sh
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
  *"/pulls/7"*) jq -r "$filter" <<<'{"head":{"sha":"abc123","ref":"feat/x"}}' ;;
  *"/check-runs"*) jq -r "$filter" <<<"$CHECK" ;;
  *"/commits/screenshots/"*) [[ "$BRANCH" == missing ]] && exit 1
    jq -n --arg m "chore: revenue screenshots for $MSG_SHA" '{commit:{message:$m}}' | jq -r "$filter" ;;
  *"Accept: application/vnd.github.raw"*) for a in "$@"; do [[ $a == repos/*/contents/* ]] && printf 'png:%s' "${a##*/}"; done; true ;;
  *"/contents -f"*) jq -Rn '[inputs | {name: .}]' <<<"$LISTING" | jq -r "$filter" ;;
  *) echo "stub gh: unexpected call: $*" >&2; exit 1 ;;
esac
STUB
chmod +x "$tmp/bin/gh"
export PATH="$tmp/bin:$PATH" GITHUB_REPOSITORY=o/r DESIGN_PAIRS_INTERVAL=1 DESIGN_PAIRS_DEADLINE=2

GOOD=$'auto-web-check-in-mobile-app.png\nauto-web-check-in-mobile-design.png\nauto-revenue-goals-mobile-app.png\nauto-revenue-goals-mobile-design.png\nauto-revenue-goals-mobile-measure.json\nauto-revenue-goals-mobile.png\nREADME.md\nauto-../../x-app.png\nauto-../x-measure.json\nauto-x-measure.json.exe'
# run <name> <check> <branch> <message sha> <expected files>
run() {
  local name=$1 want=$5 got
  mkdir -p "$tmp/w" && cd "$tmp/w" && rm -rf .design-pairs
  CHECK=$2 BRANCH=$3 MSG_SHA=$4 LISTING=$GOOD "$here/design-pairs.sh" 7 >/dev/null
  got=$(ls .design-pairs 2>/dev/null | tr '\n' ' ' || true)
  if [[ "$got" != "$want" ]]; then echo "FAIL $name: got '$got', want '$want'"; exit 1; fi
  echo "ok: $name"
}

# runs <status conclusion>...: a check_runs payload whose started_at rises with each argument
runs() {
  local i=0 out=()
  for r in "$@"; do
    i=$((i + 1))
    out+=("$(jq -n --arg s "${r%% *}" --arg c "${r#* }" --arg t "2026-01-01T00:00:0${i}Z" '{status:$s,conclusion:$c,started_at:$t}')")
  done
  ((${#out[@]})) && printf '%s\n' "${out[@]}" | jq -s '{check_runs:.}' || echo '{"check_runs":[]}'
}
done_ok=$(runs "completed success")
run "pairs land, nothing else" "$done_ok" ok abc123 "auto-revenue-goals-mobile-app.png auto-revenue-goals-mobile-design.png auto-revenue-goals-mobile-measure.json auto-web-check-in-mobile-app.png auto-web-check-in-mobile-design.png "
[[ "$(cat "$tmp/w/.design-pairs/auto-revenue-goals-mobile-app.png")" == png:auto-revenue-goals-mobile-app.png ]] \
  || { echo "FAIL: stub bytes not written"; exit 1; }
run "check never appears" "$(runs)" ok abc123 ""
run "check failed" "$(runs "completed failure")" ok abc123 ""
run "no screenshots branch" "$done_ok" missing abc123 ""
run "pairs from another commit" "$done_ok" ok def456 ""
# Listed out of order on purpose: only sort_by(.started_at) makes the newer failure win
run "newest check run decides" "$(runs "completed failure" "completed success" | jq -c '.check_runs |= reverse')" ok abc123 "auto-revenue-goals-mobile-app.png auto-revenue-goals-mobile-design.png auto-revenue-goals-mobile-measure.json auto-web-check-in-mobile-app.png auto-web-check-in-mobile-design.png "
run "newest run failed, older passed" "$(runs "completed success" "completed failure" | jq -c '.check_runs |= reverse')" ok abc123 ""
