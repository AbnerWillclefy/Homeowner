#!/usr/bin/env bash
# Prints which apps a change touches, as key=true|false lines ready for $GITHUB_OUTPUT:
# backend, web, admin, infra, bedrock, revenue. Run it inside a clone with full history.
# Usage: changed-apps.sh [base-commit]   (diffs base against HEAD)
# Fails safe: with no base, a base that is not an ancestor of HEAD, or a failed diff, every key is true.
# The only place that maps paths to apps. See docs/agents/pr-risk.md.
set -uo pipefail

areas=(backend web admin infra bedrock revenue)
declare -A hit=()

mark() { local a; for a in "$@"; do hit[$a]=true; done; }

# One row per path pattern: the apps it sets to true
map_path() {
  case "$1" in
    .github/workflows/* | .github/scripts/*) mark "${areas[@]}" ;;
    backend/*) mark backend ;;
    web/*) mark web ;;
    admin/*) mark admin ;;
    infra/*) mark infra ;;
    bedrock/* | package.json | package-lock.json) mark bedrock revenue web ;;
    revenue/*) mark revenue ;;
  esac
}

base="${1:-}"
# --no-renames lists a moved file under its old and new path, so moving a file out of backend/ still counts
if [ -z "$base" ] \
  || ! git rev-parse --verify --quiet "$base^{commit}" >/dev/null \
  || ! git merge-base --is-ancestor "$base" HEAD \
  || ! files=$(git diff --name-only --no-renames "$base" HEAD); then
  mark "${areas[@]}"
else
  while IFS= read -r f; do [ -z "$f" ] || map_path "$f"; done <<<"$files"
fi

for a in "${areas[@]}"; do echo "$a=${hit[$a]:-false}"; done
