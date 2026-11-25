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
case "$*" in
  *"/pulls/7"*) echo "abc123 feat/x" ;;
  *"/check-runs"*) printf '%s\n' "$CHECK" ;;
  *"/commits/screenshots/"*) [[ "$BRANCH" == missing ]] && exit 1; echo "chore: revenue screenshots for $MSG_SHA" ;;
  *"Accept: application/vnd.github.raw"*) for a in "$@"; do [[ $a == repos/*/contents/* ]] && printf 'png:%s' "${a##*/}"; done; true ;;
  *"/contents -f"*) printf '%s\n' "$LISTING" ;;
  *) echo "stub gh: unexpected call: $*" >&2; exit 1 ;;
esac
STUB
chmod +x "$tmp/bin/gh"
export PATH="$tmp/bin:$PATH" GITHUB_REPOSITORY=o/r DESIGN_PAIRS_INTERVAL=1 DESIGN_PAIRS_DEADLINE=2

GOOD=$'auto-revenue-goals-mobile-app.png\nauto-revenue-goals-mobile-design.png\nauto-revenue-goals-mobile.png\nREADME.md\nauto-../../x-app.png'
# run <name> <check> <branch> <message sha> <expected files>
run() {
  local name=$1 want=$5 got
  mkdir -p "$tmp/w" && cd "$tmp/w" && rm -rf .design-pairs
  CHECK=$2 BRANCH=$3 MSG_SHA=$4 LISTING=$GOOD "$here/design-pairs.sh" 7 >/dev/null
  got=$(ls .design-pairs 2>/dev/null | tr '\n' ' ' || true)
  if [[ "$got" != "$want" ]]; then echo "FAIL $name: got '$got', want '$want'"; exit 1; fi
  echo "ok: $name"
}

done_ok="completed success"
run "pairs land, nothing else" "$done_ok" ok abc123 "auto-revenue-goals-mobile-app.png auto-revenue-goals-mobile-design.png "
[[ "$(cat "$tmp/w/.design-pairs/auto-revenue-goals-mobile-app.png")" == png:auto-revenue-goals-mobile-app.png ]] \
  || { echo "FAIL: stub bytes not written"; exit 1; }
run "check never appears" "" ok abc123 ""
run "check failed" "completed failure" ok abc123 ""
run "no screenshots branch" "$done_ok" missing abc123 ""
run "pairs from another commit" "$done_ok" ok def456 ""
