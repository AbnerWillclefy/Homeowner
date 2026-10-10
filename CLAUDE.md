# Homeowner

The v1 spec is issue #1; each ticket is a child issue linking back to it. Domain terms live in `CONTEXT.md`, decisions in `docs/adr/`.

## Working a ticket

- Work exactly one ticket per session. Before starting, confirm every issue in its "Blocked by" list is closed; if not, stop and say which one blocks it.
- Delegate by area: Go, migrations and Terraform to `backend-engineer`; the React PWA to `frontend-engineer`. A ticket that spans both runs backend first, so the frontend builds against a real API.
- Before opening the pull request, run `qa-engineer` against the ticket and fix what it reports as not met.
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
