#!/usr/bin/env bash
# Downloads the screenshot pairs (PNGs and the -measure.json of each pair's element boxes) the ui-screenshots check took for a pull request's head commit into
# ./.design-pairs/, for the reviewer to read (REVIEW.md, Interface). Exits 0 with no files when there are
# none, when the check never finishes, or when it failed.
# Usage: design-pairs.sh <pr-number>   (needs GH_TOKEN and GITHUB_REPOSITORY; run from the workspace root)
set -euo pipefail

pr="$1"
interval=${DESIGN_PAIRS_INTERVAL:-15}
deadline=${DESIGN_PAIRS_DEADLINE:-600}
api="repos/$GITHUB_REPOSITORY"

read -r sha ref < <(gh api "$api/pulls/$pr" --jq '"\(.head.sha) \(.head.ref)"')

# Several runs can exist for one SHA ("edited" re-runs it): the newest decides
end=$((SECONDS + deadline))
while :; do
  run=$(gh api -X GET "$api/commits/$sha/check-runs" -f check_name=ui-screenshots \
    --jq '[.check_runs[]] | sort_by(.started_at) | last // empty | "\(.status) \(.conclusion)"')
  [[ "$run" == completed* ]] && break
  if ((SECONDS >= end)); then echo "ui-screenshots did not finish in ${deadline}s; no pairs"; exit 0; fi
  sleep "$interval"
done
if [[ "$run" != "completed success" ]]; then echo "ui-screenshots ended as ${run#completed }; no pairs"; exit 0; fi

# The check skips shooting when a human added images, so the branch may hold an older commit's pairs
if ! msg=$(gh api "$api/commits/screenshots/$ref" --jq .commit.message 2>/dev/null); then
  echo "no screenshots branch; no pairs"; exit 0
fi
if [[ "$msg" != *"$sha"* ]]; then echo "screenshots are not from $sha; no pairs"; exit 0; fi

names=$(gh api -X GET "$api/contents" -f "ref=screenshots/$ref" --jq '.[].name')
# Names come from a branch: this pattern is the trust boundary and blocks path traversal
names=$(grep -E '^auto-[a-z0-9-]+-((app|design)\.png|measure\.json)$' <<<"$names" || true)
[[ -n "$names" ]] || { echo "no pairs on the screenshots branch"; exit 0; }

mkdir -p .design-pairs
while read -r name; do
  # The raw media type also serves files over 1 MB
  gh api -H "Accept: application/vnd.github.raw" -X GET "$api/contents/$name" -f "ref=screenshots/$ref" >".design-pairs/$name"
done <<<"$names"
