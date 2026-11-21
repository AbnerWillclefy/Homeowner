#!/usr/bin/env bash
# Resolves Claude's review threads on a pull request that the agents answered last but left open.
# The review-fix agent sometimes replies ("Fixed: ...") and stops, and an open Claude thread blocks
# merge-by-risk. Threads a human answered last stay open for the human.
# Usage: resolve-answered-threads.sh <pr-number>   (needs GH_TOKEN and GITHUB_REPOSITORY)
set -euo pipefail

pr="$1"
ids=$(gh api graphql -F owner="${GITHUB_REPOSITORY%%/*}" -F name="${GITHUB_REPOSITORY#*/}" -F pr="$pr" -f query='
  query($owner: String!, $name: String!, $pr: Int!) {
    repository(owner: $owner, name: $name) {
      pullRequest(number: $pr) {
        reviewThreads(first: 100) {
          nodes { id isResolved first: comments(first: 1) { nodes { author { login } } } last: comments(last: 1) { nodes { author { login } } } }
        }
      }
    }
  }' --jq '.data.repository.pullRequest.reviewThreads.nodes[]
    | select((.isResolved | not)
      and (.first.nodes[0].author.login | test("^claude(\\[bot\\])?$"))
      and .last.nodes[0].author.login == "homeowner-agents")
    | .id')

for id in $ids; do
  gh api graphql -f id="$id" -f query='mutation($id: ID!) { resolveReviewThread(input: {threadId: $id}) { thread { isResolved } } }' >/dev/null
  echo "Resolved $id"
done
