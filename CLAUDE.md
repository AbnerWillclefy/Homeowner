# Homeowner

The v1 spec is issue #1; each ticket is a child issue linking back to it. Domain terms live in `CONTEXT.md`, decisions in `docs/adr/`.

## The team

Each role is a subagent in `.claude/agents/`. Every comment or issue posted on GitHub starts with the role speaking, for example `**Senior Engineer:**`, because all of them post from the same account.

| Role | Owns |
|---|---|
| `product-manager` | What gets built: user stories, acceptance criteria, tickets |
| `software-architect` | How the system is shaped: design overviews, ADRs |
| `senior-engineer` | Technical refinement of tickets and technical explanations |
| `backend-engineer` | Go, migrations, Terraform |
| `frontend-engineer` | The React PWA |
| `qa-engineer` | Testing staging after each deploy, filing bugs |

## The pipeline

Each stage is a workflow in `.github/workflows/` started by a label or an event. A human acts at three points: requesting a feature, labelling a ticket `implement`, and merging.

1. Issue labelled `feature-request`: the architect posts a design overview, the product manager creates the tickets, and the request is labelled `needs-refinement`.
2. Request labelled `needs-refinement`: the senior engineer refines each of its open tickets and labels them `ready-for-agent`.
3. Ticket labelled `implement`: the engineers build it and open a pull request (see Working a ticket).
4. Pull request opened: Claude reviews it, then the engineer applies the valid findings once and labels the pull request `review-addressed`.
5. A human merges; the deploy to staging runs.
6. Staging deploy succeeds: the QA engineer tests what changed and files `bug` + `needs-triage` issues.

## Working a ticket

- Work exactly one ticket per session. Before starting, confirm every issue in its "Blocked by" list is closed; if not, comment which one blocks it and stop.
- Read the ticket's `## Technical notes` first; they are the senior engineer's plan.
- Delegate by area: Go, migrations and Terraform to `backend-engineer`; the React PWA to `frontend-engineer`. A ticket that spans both runs backend first, so the frontend builds against a real API.
- Before opening the pull request, check every acceptance criterion yourself and point to the test or code that meets it. Fix anything not met.
- Small commits, imperative and lowercase after a conventional prefix, for example `feat(allocation): honour restrictions on demands`.
- The pull request description starts with `Closes #<issue-number>` and lists each acceptance criterion with how it is met.
- Never merge. A human merges.

## Agent skills

### Issue tracker

Issues live in GitHub Issues on `AbnerWillclefy/Homeowner`, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one root `CONTEXT.md` plus `docs/adr/`. See `docs/agents/domain.md`.
