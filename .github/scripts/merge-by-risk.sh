#!/usr/bin/env bash
# Merges the agents' pull requests that their risk tier lets merge without the maintainer's hands.
# Usage: merge-by-risk.sh [pr-number...]   (no numbers: every open pull request into main)
# Needs GH_TOKEN (the agents' token, so the merge starts the staging deploy), GITHUB_REPOSITORY,
# AGENT_LOGIN and MAINTAINER_LOGIN; SLACK_WEBHOOK_URL is optional.
#
#   low     merges when every check is green and Claude's latest review of the head commit is clean
#   medium  the same, plus the maintainer's approval of that exact commit
#   high    never: the maintainer merges it
# See docs/agents/pr-risk.md.
set -euo pipefail

repo="${GITHUB_REPOSITORY:?}"
here="$(cd "$(dirname "$0")" && pwd)"

if (( $# )); then prs=("$@"); else
  mapfile -t prs < <(gh pr list -R "$repo" --base main --state open --author "$AGENT_LOGIN" --json number --jq '.[].number')
fi

skip() { echo "#$pr: not merged, $1"; }
# Each lookup below fails soft with `|| { skip ...; continue; }`, so one API error skips
# that pull request instead of stopping the sweep

for pr in "${prs[@]}"; do
  pr_json=$(gh pr view "$pr" -R "$repo" --json state,author,baseRefName,isDraft,labels,headRefOid,mergeable,title,url) \
    || { skip "it could not be read"; continue; }
  get() { jq -r "$1" <<<"$pr_json"; }
  sha=$(get .headRefOid)

  [ "$(get .state)" = OPEN ] || { skip "it is not open"; continue; }
  [ "$(get .author.login)" = "$AGENT_LOGIN" ] || { skip "the maintainer's own pull requests are merged by hand"; continue; }
  [ "$(get .baseRefName)" = main ] || { skip "it does not target main"; continue; }
  [ "$(get .isDraft)" = false ] || { skip "it is a draft"; continue; }
  if get '.labels[].name' | grep -qxE 'needs-human|do-not-merge'; then skip "it is labelled needs-human or do-not-merge"; continue; fi
  [ "$(get .mergeable)" = MERGEABLE ] || { skip "GitHub says it is $(get .mergeable)"; continue; }

  # The tier is read again with main's script, so a pull request cannot loosen its own rules
  result=$("$here/pr-risk.sh" "$pr") || { skip "pr-risk.sh failed"; continue; }
  tier=$(sed -n 's/^effective=//p' <<<"$result")
  if grep -q '^problem=' <<<"$result"; then skip "its description fails the pr-risk check"; continue; fi
  [ "$tier" != high ] || { skip "it is high risk, so the maintainer merges it"; continue; }
  [[ "$tier" == low || "$tier" == medium ]] || { skip "its tier could not be read"; continue; }

  # Every check on the head commit finished green. Any pending run blocks (a queued run has no
  # real start time); otherwise only the latest run of each check counts, since a superseded run
  # shows as cancelled. gh exits non-zero while any is pending or failed, hence || true.
  buckets=$(gh pr checks "$pr" -R "$repo" --json name,bucket,startedAt \
    --jq 'if any(.[]; .bucket == "pending") then "pending" else group_by(.name) | map(max_by(.startedAt)) | .[].bucket end' || true)
  if [ -z "$buckets" ] || grep -qvxE 'pass|skipping' <<<"$buckets"; then skip "not every check is green yet"; continue; fi

  # Claude's latest review ran on this exact commit and raised nothing. The findings filter is
  # a copy of agent-review-fix.yml's, and merge-by-risk.test.sh fails if the two drift apart
  review=$(gh api "repos/$repo/actions/workflows/claude-code-review.yml/runs?head_sha=$sha&per_page=20" \
    --jq '.workflow_runs | sort_by(.created_at) | last | "\(.conclusion) \(.created_at)"') \
    || { skip "Claude's review runs could not be read"; continue; }
  read -r review_conclusion review_started <<<"$review"
  [ "$review_conclusion" = success ] || { skip "Claude has not finished reviewing $sha"; continue; }
  findings=$(gh api "repos/$repo/pulls/$pr/comments" --paginate \
    --jq ".[] | select(.user.login == \"claude[bot]\" and .in_reply_to_id == null and .created_at >= \"$review_started\") | .id" | wc -l) \
    || { skip "Claude's findings could not be read"; continue; }
  (( findings == 0 )) || { skip "Claude's latest review has $findings findings"; continue; }

  # The maintainer's latest verdict: changes requested blocks any tier; medium needs an approval of this commit
  verdict=$(gh api "repos/$repo/pulls/$pr/reviews" --paginate \
    --jq ".[] | select(.user.login == \"$MAINTAINER_LOGIN\" and (.state == \"APPROVED\" or .state == \"CHANGES_REQUESTED\" or .state == \"DISMISSED\")) | \"\(.state) \(.commit_id)\"" \
    | tail -n 1) || { skip "the maintainer's reviews could not be read"; continue; }
  # (--jq runs per page, so the filter prints every verdict and tail keeps the last)
  read -r verdict_state verdict_sha <<<"$verdict"
  [ "$verdict_state" != CHANGES_REQUESTED ] || { skip "the maintainer requested changes"; continue; }
  if [ "$tier" = medium ] && ! { [ "$verdict_state" = APPROVED ] && [ "$verdict_sha" = "$sha" ]; }; then
    skip "it is medium risk and the maintainer has not approved $sha"; continue
  fi

  # --match-head-commit refuses the merge if anything was pushed since these checks
  if ! gh pr merge "$pr" -R "$repo" --merge --match-head-commit "$sha"; then skip "the merge was refused"; continue; fi
  echo "#$pr: merged ($tier risk)"

  if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
    text=$(printf ':rocket: *PR #%s merged itself to staging* (risk: %s)\n<%s|%s>\nIts description says how to revert it.' \
      "$pr" "$tier" "$(get .url)" "$(get .title)")
    jq -n --arg text "$text" '{text: $text}' \
      | curl -sS --fail -X POST -H 'Content-Type: application/json' --data @- "$SLACK_WEBHOOK_URL" || true
  fi
done
