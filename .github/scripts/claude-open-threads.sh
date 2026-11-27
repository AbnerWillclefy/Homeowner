#!/usr/bin/env bash
# Prints how many of Claude's review threads on a pull request block the merge: the unresolved ones, and every
# `(design)` finding someone other than Claude replied to. A finding counts as answered once its thread is resolved:
# fixed, or rejected with a reply saying why. A design finding (app differs from its artboard) cannot be rejected in a
# pull request: the gap is decided in the epic's refinement, so a reply hands the merge to the maintainer.
# A re-review never repeats a finding, so this, not the latest run's comments, shows what is open.
# Usage: claude-open-threads.sh <pr-number>   (needs GH_TOKEN and GITHUB_REPOSITORY)
set -euo pipefail

pr="$1"
threads=$(gh api graphql -F owner="${GITHUB_REPOSITORY%%/*}" -F name="${GITHUB_REPOSITORY#*/}" -F pr="$pr" -f query='
  query($owner: String!, $name: String!, $pr: Int!) {
    repository(owner: $owner, name: $name) {
      pullRequest(number: $pr) {
        reviewThreads(first: 100) {
          pageInfo { hasNextPage }
          nodes { isResolved comments(first: 20) { nodes { author { login } body } } }
        }
      }
    }
  }' --jq '.data.repository.pullRequest.reviewThreads')

# Past 100 threads the rest are unread, so it fails: the caller then blocks the merge
if [[ $(jq '.pageInfo.hasNextPage' <<<"$threads") == true ]]; then
  echo "more than 100 review threads; only the first 100 can be read" >&2
  exit 1
fi
jq '[.nodes[] | .comments.nodes as $c
     | select($c[0].author.login | test("^claude(\\[bot\\])?$"))
     | select((.isResolved | not)
         or ((($c[0].body // "") | startswith("**[Finding] (design)")) and any($c[1:][]; .author.login | test("^claude(\\[bot\\])?$") | not)))
    ] | length' <<<"$threads"
