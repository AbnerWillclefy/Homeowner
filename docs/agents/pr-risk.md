# Pull request risk tiers

Every pull request into `main` states how risky it is to merge, and the tier decides who merges it. Merging to `main` deploys staging, never production: production still goes out only through a release pull request the maintainer merges.

The change sets the tier, not who wrote it. The engineer who opens the pull request picks the tier in its description; the changed paths set a floor it cannot go under ([ADR 0015](../adr/0015-merge-agent-pull-requests-by-risk-tier.md)).

## The tiers

| Tier | Typical changes | Who merges |
|---|---|---|
| `low` | Docs, copy and translations, tests, styling, refactors with no change in behaviour, a small fix with a test that shows it, new behaviour behind a flag that is off | `merge-by-risk.yml`, once every check is green and Claude's latest review of the head commit raised nothing |
| `medium` | Ordinary product changes: a new screen or endpoint, a changed rule a Resident sees, an additive migration, dependency updates, the API's wiring, the service worker | `merge-by-risk.yml`, under the same conditions plus the maintainer's approval of the head commit |
| `high` | CI and deploy workflows, the agents' instructions, Terraform, sign-in, operations scripts, a migration that drops, renames or rewrites data or edits an old migration, anything that could lose a Resident's data or lock them out | The maintainer, by hand |

When unsure between two tiers, pick the higher one. A pull request labelled `needs-human` or `do-not-merge`, or where the maintainer's latest review requests changes, is never merged automatically. The maintainer's own pull requests (from `/ticket`) are always merged by hand.

## Path floors

`.github/scripts/pr-risk.sh` raises the tier to at least this when a pull request changes these paths. A renamed file counts under its old and new paths. Test files (`*_test.go`, `*.test.ts(x)`, `web/e2e/`) do not raise it, except under the `high` paths, which have no exemption.

| Floor | Paths |
|---|---|
| `high` | `.github/`, `.claude/`, `CLAUDE.md`, `infra/`, `scripts/`, `backend/internal/platform/auth/`, `web/src/domains/auth/`, a migration that is edited or whose added lines drop, rename, truncate, delete rows, or change a column's type or nullability |
| `medium` | a new migration in `backend/migrations/`, `backend/cmd/`, `backend/internal/platform/`, `backend/Dockerfile`, `docker-compose.yml`, `go.mod`/`go.sum`, `package.json`/`package-lock.json`, `web/src/sw.ts`, `web/src/sw/`, `web/vite.config.ts` |

A path missing from this table can still be medium or high: the floor is a minimum, and the engineer's judgement against the table above decides the rest. A migration whose diff GitHub does not return (a very large one) counts as high. `.github/scripts/pr-risk.test.sh` covers these rules; change it with them.

## The description

The template is `.github/pull_request_template.md`. It is written for the human who merges, because the AI reviewers already read the diff and the ticket. The `pr-risk` check fails until it has:

- **Risk:** on its own line under `## Risk`, as `**Risk:** low`, `medium` or `high`, at least the path floor, with a sentence on why.
- **Why**, **What changes**, **What can go wrong**, **How it was tested** and **How to revert** filled in.

For `high`, the Risk section says why it is high and why it cannot be made smaller, and How to revert gives exact steps, including what a revert leaves behind (a migration, Terraform resources, data written meanwhile, a service worker cached on phones).

The check then labels the pull request `risk:low`, `risk:medium` or `risk:high`. The label is the higher of the stated tier and the floor, so it can be raised by editing the description, never lowered under the floor.

## How a merge happens

`merge-by-risk.yml` runs when CI, Claude's review, the review fix or the `pr-risk` check finishes (the last one also runs on the maintainer's reviews), and each run checks every open agent pull request. It runs from `main`, so a pull request cannot change the rules that merge it, and it reads the tier again from scratch. It merges with the agents' token, so the push to `main` starts **Deploy staging**, and with `--match-head-commit`, so a push after the checks stops the merge. If Slack is set up, it posts each merge.

To run it by hand: Actions, **Merge by risk**, Run workflow, optionally with a pull request number.

## Reverting

Revert the merge commit from the pull request page (Revert button) or with `git revert -m 1 <merge-sha>`, and merge the revert pull request: staging redeploys. Migrations are expand-only, so a reverted feature leaves its new tables in place; that is expected. Follow the pull request's own How to revert for anything else.
