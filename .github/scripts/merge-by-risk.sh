#!/usr/bin/env bash
# Merges the agents' pull requests that their risk tier lets merge without the maintainer's hands.
# Usage: merge-by-risk.sh [pr-number...]   (no numbers: every open agent pull request into main)
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

# The gates below share these, set for each pull request in the loop
pr='' pr_json='' sha='' tier=''

get() { jq -r "$1" <<<"$pr_json"; }

# Prints why the pull request is not merged and fails the gate. Gates run in an `&&` chain,
# where set -e is off, so every command that can fail ends in `|| blocked ...`.
blocked() { echo "#$pr: not merged, $1"; return 1; }

# Like blocked, for something that should not happen (an API or script error, a refused merge):
# the sweep goes on, then fails at the end so the run shows red instead of a quiet log line.
errors=0
failed() { echo "::warning::#$pr: not merged, $1"; errors=$((errors + 1)); return 1; }

check_basics() {
  [ "$(get .state)" = OPEN ] || blocked "it is not open" || return
  [ "$(get .author.login)" = "$AGENT_LOGIN" ] || blocked "the maintainer's own pull requests are merged by hand" || return
  [ "$(get .baseRefName)" = main ] || blocked "it does not target main" || return
  [ "$(get .isDraft)" = false ] || blocked "it is a draft" || return
  # No grep -q here: an early exit would break the pipe and, under pipefail, flip the result
  ! get '.labels[].name' | grep -xE 'needs-human|do-not-merge' >/dev/null || blocked "it is labelled needs-human or do-not-merge" || return
  [ "$(get .mergeable)" = MERGEABLE ] || blocked "GitHub says it is $(get .mergeable)"
}

# The tier is read again with main's script, so a pull request cannot loosen its own rules
check_tier() {
  local risk
  risk=$("$here/pr-risk.sh" "$pr") || failed "pr-risk.sh failed" || return
  ! grep -q '^problem=' <<<"$risk" || blocked "its description fails the pr-risk check" || return
  tier=$(sed -n 's/^effective=//p' <<<"$risk")
  [ "$tier" != high ] || blocked "it is high risk, so the maintainer merges it" || return
  [[ "$tier" == low || "$tier" == medium ]] || failed "its tier could not be read"
}

# Checks that run on every pull request into main, so they must be present and green: GitHub
# lists a check only once its run exists. Path-filtered ones (infra-check) count only when they run.
required_checks=(pr-risk backend-test web-typecheck web-e2e ui-screenshots claude-review claude-security-review)

# Any pending run blocks (a queued run has no real start time). Otherwise only the latest run of
# each check counts, since a superseded run shows as cancelled. gh exits non-zero while any check
# is pending or failed, so its exit code is ignored and the results decide.
check_ci_green() {
  local latest name
  latest=$(gh pr checks "$pr" -R "$repo" --json name,bucket,startedAt \
    --jq 'if any(.[]; .bucket == "pending") then "-\tpending" else group_by(.name) | map(max_by(.startedAt)) | .[] | "\(.name)\t\(.bucket)" end') || true
  [ -n "$latest" ] && ! cut -f2 <<<"$latest" | grep -vxE 'pass|skipping' >/dev/null || blocked "not every check is green yet" || return
  for name in "${required_checks[@]}"; do
    grep -qxF "$name"$'\t'pass <<<"$latest" || blocked "$name has not passed on this commit yet" || return
  done
}

# Claude's latest review ran on this exact commit and raised nothing, and every earlier finding
# was answered (its thread resolved)
check_claude_review_clean() {
  local review conclusion started findings open
  review=$(gh api "repos/$repo/actions/workflows/claude-code-review.yml/runs?head_sha=$sha&per_page=20" \
    --jq '.workflow_runs | sort_by(.created_at) | last | "\(.conclusion) \(.created_at)"') \
    || failed "Claude's review runs could not be read" || return
  read -r conclusion started <<<"$review"
  [ "$conclusion" = success ] || blocked "Claude has not finished reviewing $sha" || return
  findings=$("$here/claude-findings.sh" "$pr" "$started") || failed "Claude's findings could not be read" || return
  [ "$findings" = 0 ] || blocked "Claude's latest review has $findings findings" || return
  # Earlier findings stay open until their thread is resolved, even when this run raised nothing
  open=$("$here/claude-open-threads.sh" "$pr") || failed "Claude's review threads could not be read" || return
  [ "$open" = 0 ] || blocked "$open of Claude's review threads are unresolved"
}

# The maintainer's latest verdict: changes requested blocks any tier; medium needs an approval
# of this exact commit. --jq runs once per page, so it prints every verdict and tail keeps the last.
check_maintainer_verdict() {
  local verdict state commit
  verdict=$(gh api "repos/$repo/pulls/$pr/reviews" --paginate \
    --jq ".[] | select(.user.login == \"$MAINTAINER_LOGIN\" and (.state == \"APPROVED\" or .state == \"CHANGES_REQUESTED\" or .state == \"DISMISSED\")) | \"\(.state) \(.commit_id)\"" \
    | tail -n 1) || failed "the maintainer's reviews could not be read" || return
  read -r state commit <<<"$verdict"
  [ "$state" != CHANGES_REQUESTED ] || blocked "the maintainer requested changes" || return
  [ "$tier" != medium ] || { [ "$state" = APPROVED ] && [ "$commit" = "$sha" ]; } \
    || blocked "it is medium risk and the maintainer has not approved $sha"
}

merge() {
  # --match-head-commit refuses the merge if anything was pushed since these checks
  gh pr merge "$pr" -R "$repo" --merge --match-head-commit "$sha" || failed "the merge was refused" || return
  echo "#$pr: merged ($tier risk)"
  [ -n "${SLACK_WEBHOOK_URL:-}" ] || return 0
  printf ':rocket: *PR #%s merged itself to staging* (risk: %s)\n<%s|%s>\nIts description says how to revert it.' \
    "$pr" "$tier" "$(get .url)" "$(get .title)" \
    | jq -Rs '{text: .}' \
    | curl -sS --fail -X POST -H 'Content-Type: application/json' --data @- "$SLACK_WEBHOOK_URL" || true
}

for arg in "$@"; do
  [[ "$arg" =~ ^[0-9]+$ ]] || { echo "::error::not a pull request number: $arg"; exit 1; }
done
if (( $# )); then prs=("$@"); else
  mapfile -t prs < <(gh pr list -R "$repo" --base main --state open --author "$AGENT_LOGIN" --json number --jq '.[].number')
fi

# One pull request that fails a gate, or whose lookups fail, never stops the sweep
for pr in "${prs[@]}"; do
  tier=''
  pr_json=$(gh pr view "$pr" -R "$repo" --json state,author,baseRefName,isDraft,labels,headRefOid,mergeable,title,url) \
    || { failed "it could not be read" || true; continue; }
  sha=$(get .headRefOid)
  check_basics && check_tier && check_ci_green && check_claude_review_clean && check_maintainer_verdict && merge || true
done

(( errors == 0 )) || { echo "::error::$errors pull request(s) hit an error; see the warnings above"; exit 1; }
