#!/usr/bin/env bash
# Prints how many findings Claude's review posted on a pull request since a time: top-level
# inline comments by claude[bot]. A review is clean when this is 0 from its run's start.
# Usage: claude-findings.sh <pr-number> <since, ISO 8601>   (needs GH_TOKEN and GITHUB_REPOSITORY)
#
# agent-review-fix.yml (human-only) has its own copy of this definition to decide whether to
# fix or label a pull request review-addressed. Keep the two the same; that workflow can call
# this script once a human changes it.
set -euo pipefail

pr="$1"
since="$2"
gh api "repos/${GITHUB_REPOSITORY:?}/pulls/$pr/comments" --paginate \
  | jq --arg since "$since" '.[] | select(.user.login == "claude[bot]" and .in_reply_to_id == null and .created_at >= $since) | .id' \
  | wc -l | tr -d ' '
