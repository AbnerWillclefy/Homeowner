# Merge agent pull requests by risk tier

Every agent pull request waited for the maintainer to merge it, however small, and its description listed acceptance criteria for the AI reviewer rather than what a human needs to decide. The maintainer read diffs the reviewers had already read, and still had to work out why a change was made, what could break and how to undo it. This follows how the Claude Code team reviews its own code ([Solving code review at Anthropic](https://claude.dev/blog/solving-code-review-at-anthropic/)): match human review to risk, and require Testing, Risk and How to revert in every pull request.

## Decision

- **Three tiers, set by the change.** `low`, `medium` and `high`, defined in [docs/agents/pr-risk.md](../agents/pr-risk.md). The engineer states the tier in the description; `pr-risk.sh` sets a floor from the changed paths, and the effective tier is the higher of the two.
- **The tier decides who merges into `main`.** Low merges itself once CI is green and Claude's latest review of the head commit is clean. Medium also needs the maintainer's approval of that exact commit. High is merged by the maintainer.
- **A workflow merges, not an agent.** `merge-by-risk.yml` runs from `main` on `workflow_run`, so a pull request cannot rewrite its own rules, and agents keep `gh pr merge` disallowed.
- **The description is for the human.** The template asks why, what changes, the risk and what can go wrong, how it was tested, and how to revert; the `pr-risk` check fails until those are filled in.
- **Production stays manual.** Only `main` (staging) is merged automatically; the release pull request into `production` is unchanged.

## Considered Options

- **Keep merging every pull request by hand.** Safe, but the maintainer's time goes to changes where a person adds little.
- **Let an AI classifier pick the tier.** Closer to the article, but one more model call per push, and a stated tier with a deterministic floor is easier to audit. It can come later.
- **GitHub auto-merge.** It waits only for required status checks under branch protection, and cannot read a tier or require an approval of the exact head commit.
- **A merge queue.** It tests each pull request against the latest `main`; not available to a repository owned by a personal account, and staging is cheap to fix forward. Two pull requests that pass apart can still break `main` together.

## Consequences

- The `pr-risk` check fails on every pull request into `main` whose description does not follow the template, the maintainer's included.
- An agent can state too low a tier for a path the floor does not know. The maintainer sees the tier on the label and in Slack, and can raise it by editing the description.
- Approving a medium pull request merges it; requesting changes, or labelling it `needs-human` or `do-not-merge`, stops it. A push after an approval needs a new approval.
- Measure it like the article does: if reverts of auto-merged pull requests rise, tighten the floors or move kinds of change up a tier.
