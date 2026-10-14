# Homeowner

The v1 spec is issue #1; each ticket is a child issue linking back to it. Domain terms live in `CONTEXT.md`, decisions in `docs/adr/`.

## The team

Each role is a subagent in `.claude/agents/`. Every comment or issue posted on GitHub starts with the role speaking, for example `**Senior Engineer:**`, because all of them post from the same account. In GitHub Actions runs, run subagents in the foreground and wait for them: the run ends when the main session stops.

| Role | Owns |
|---|---|
| `product-manager` | What gets built: user stories, acceptance criteria, tickets |
| `software-architect` | How the system is shaped: design overviews, ADRs |
| `senior-engineer` | Technical refinement of tickets and technical explanations |
| `backend-engineer` | Go, migrations, Terraform |
| `frontend-engineer` | The React PWA |

## The pipeline

Each stage is a workflow in `.github/workflows/` started by a label or an event. A human acts at three points: requesting a feature, labelling a ticket `implement`, and merging.

1. Issue labelled `feature-request`: the architect posts a design overview, the product manager creates the tickets as its sub-issues, and the request becomes an `epic` labelled `needs-refinement`. Epics are not worked directly and stay off the board's columns.
2. Request labelled `needs-refinement`: the senior engineer refines each of its open tickets and labels them `ready-for-agent`.
3. Ticket labelled `implement`: the engineers build it and open a pull request (see Working a ticket).
4. Pull request opened: Claude reviews it, then the engineer applies the valid findings once and labels the pull request `review-addressed`.
5. A human merges; the deploy to staging runs.

## Building a ticket

Every ticket is refined for the agents. The maintainer is learning Go, AWS and system design, and builds a ticket one of two ways: labelling it `implement` for the pipeline, or locally with `/ticket <n>`, where Claude writes the code and teaches as it goes (see `.claude/skills/ticket/SKILL.md`). The review-fix stage skips pull requests not authored by `homeowner-agents`, so a `/ticket` pull request gets its review applied locally with the maintainer. Each ticket's `### Learning focus` names the concepts it exercises. `ready-for-human` is reserved for tickets that need a step no agent can take, such as a purchase, console access or a secret; the implement stage refuses them. When the maintainer asks a question on a ticket or pull request, teach: answer it, explain the concept, and point to the relevant code or docs.

## Architecture documentation

`docs/architecture/` describes the system as built, owned by `software-architect`. A documentation ticket is delegated to `software-architect`. Any pull request that changes the system's shape (a new module, entry point, AWS resource, data table, or external service) updates `docs/architecture/` in the same pull request. Diagrams are Mermaid, so GitHub renders them.

## Working a ticket

- Work exactly one ticket per session. Before starting, confirm every issue in its "Blocked by" list is closed; if not, comment which one blocks it and stop.
- Read the ticket's `## Technical notes` first; they are the senior engineer's plan.
- Delegate by area: Go, migrations and Terraform to `backend-engineer`; the React PWA to `frontend-engineer`. A ticket that spans both runs backend first, so the frontend builds against a real API.
- Before opening the pull request, check every acceptance criterion yourself and point to the test or code that meets it. Fix anything not met.
- Small commits, imperative and lowercase after a conventional prefix, for example `feat(allocation): honour restrictions on demands`.
- The pull request description starts with `Closes #<issue-number>` and lists each acceptance criterion with how it is met.
- Never merge. A human merges.
- You may add new workflows under `.github/workflows/`, but never modify `agent-*.yml`, `claude.yml` or `claude-code-review.yml`. Changes to the pipeline itself are made by a human.

## Agent skills

### Issue tracker

Issues live in GitHub Issues on `AbnerWillclefy/Homeowner`, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one root `CONTEXT.md` plus `docs/adr/`. See `docs/agents/domain.md`.
