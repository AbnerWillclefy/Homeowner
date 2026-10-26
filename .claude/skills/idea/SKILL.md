---
name: idea
description: Scope an idea or change request with the maintainer, then file it as a GitHub issue the pipeline picks up. Use when the maintainer runs /idea or wants to bring a new feature or change into the system.
disable-model-invocation: true
---

# Idea

The issue is the handoff: once it is filed, the pipeline owns the idea and this session ends. Keep the session about scoping, not building.

## 1. Grill

Run the `grilling` skill on the idea. Ground the questions in `GLOSSARY.md`, `docs/adr/` and `docs/architecture/`, and use the domain terms. Stop when the maintainer can state what changes for a Resident, what is out of scope, and which open issue (if any) it waits on.

## 2. Pick the path

- **Feature**: new screens, data, modules or anything the architect should shape. Filed with the label `feature-request`; the architect and product manager split it into tickets.
- **Change**: a tweak to something shipped that fits one pull request. Filed with the label `needs-refinement`; refinement treats an issue with no sub-issues as one ticket, so it skips the architect.

Say which path you chose and why, and let the maintainer overrule it.

## 3. File it

Show the draft, wait for approval, then `gh issue create` with the label. Write only what was decided; the product manager writes the user stories and the senior engineer the technical plan, so do not draft them.

A feature follows the existing epics (see #212):
- `Blocked by #<n> (<title>): <why>`, when it waits on one
- `## What we want`: the outcome, as bullets
- `## Design`: the mock or `DESIGN.md` section, when UI changes
- `## Out of scope`

A change is a single ticket, so it also needs `## Acceptance criteria`: each one checkable by a test.

## 4. Close the session

Give the issue link and tell the maintainer to `/clear`: everything decided now lives in the issue.
