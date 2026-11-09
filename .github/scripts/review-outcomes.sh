#!/usr/bin/env bash
# What became of Claude's review comments on recently merged pull requests, for the weekly
# review-lessons job. Only pr-review comments count: their title starts with a kind and a category,
# "**[Finding] (correctness) ...". A comment someone other than Claude replied to was rejected (the
# fix stage replies only to say why it rejects); one with no reply was accepted.
#
# Usage:
#   review-outcomes.sh threads <since YYYY-MM-DD>   JSON array, one entry per comment
#   review-outcomes.sh summary < threads.json       first-round accepted and rejected per week and category
# (threads needs GH_TOKEN and GITHUB_REPOSITORY)
set -euo pipefail

threads() {
  local since="$1" pr merged
  gh pr list -R "$GITHUB_REPOSITORY" --state merged --search "merged:>=$since" --limit 200 \
    --json number,mergedAt --jq '.[] | "\(.number) \(.mergedAt)"' |
  while read -r pr merged; do
    # shortcut: reads the first 100 threads and 20 comments each, enough for one review's comments
    gh api graphql -F owner="${GITHUB_REPOSITORY%%/*}" -F name="${GITHUB_REPOSITORY#*/}" -F pr="$pr" -f query='
      query($owner: String!, $name: String!, $pr: Int!) {
        repository(owner: $owner, name: $name) {
          pullRequest(number: $pr) {
            reviewThreads(first: 100) {
              nodes { path comments(first: 20) { nodes { author { login } body createdAt originalCommit { oid } } } }
            }
          }
        }
      }' --jq '.data.repository.pullRequest.reviewThreads.nodes' |
    jq --argjson pr "$pr" --arg merged "$merged" '
      def claude: test("^claude(\\[bot\\])?$");
      [.[] | .comments.nodes as $c
       | select($c[0].author.login | claude)
       | ($c[0].body | capture("^\\*\\*\\[(?<kind>Finding|Suggestion|Question)\\] \\((?<category>[a-z-]+)\\) (?<title>[^*]+)\\*\\*")) as $t
       | {pr: $pr, merged: $merged, path, created: $c[0].createdAt, commit: $c[0].originalCommit.oid,
          kind: $t.kind, category: $t.category, title: $t.title,
          reply: ([$c[1:][] | select(.author.login | claude | not) | .body] | first)}]
      | sort_by(.created)
      | (.[0].commit) as $first
      | map(. + {
          outcome: (if .reply then "rejected" else "accepted" end),
          first_round: (.commit == $first),
          area: (.path | split("/")[0] | if IN("backend", "web", "admin", "infra") then . else "other" end),
          week: (.created | fromdateiso8601 | strftime("%G-W%V"))})
      | .[]'
  done | jq -s .
}

summary() {
  jq '[.[] | select(.first_round)] | group_by([.week, .category])
      | map({week: .[0].week, category: .[0].category,
             accepted: map(select(.outcome == "accepted")) | length,
             rejected: map(select(.outcome == "rejected")) | length})'
}

case "${1:-}" in
  threads) threads "$2" ;;
  summary) summary ;;
  *) sed -n '8,10p' "$0" >&2; exit 2 ;;
esac
