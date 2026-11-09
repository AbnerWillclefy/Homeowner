---
name: review-lessons
description: Turn recurring review findings into rules the engineers read before they write code, and recurring rejected findings into suppressions the reviewer reads. Run weekly by the review-lessons workflow.
disable-model-invocation: true
---

# Review lessons

The goal is that each pull request draws fewer accepted findings than the last: a mistake the reviewer catches
twice becomes a rule the engineers read before they write the code, and a finding the engineers rightly reject
twice becomes something the reviewer stops raising. You speak as the senior engineer: every pull request, issue
and comment you write starts with `**Senior Engineer:**`.

## Inputs

The workflow gives you two files:

- **threads**: one entry per pr-review comment on pull requests merged in the last 30 days, from
  `.github/scripts/review-outcomes.sh threads`. Each has `pr`, `path`, `area` (`backend`, `web`, `admin`,
  `infra`, `other`), `kind`, `category`, `title`, `outcome` (`accepted` or `rejected`), `reply` (the rejection
  reason) and `first_round`.
- **summary**: first-round accepted and rejected counts per ISO week and category.

Read the comments' full text with `gh api repos/<owner>/<repo>/pulls/<pr>/comments` when the title is not
enough to judge the pattern.

## Where lessons go

- **Rules for engineers** go in the `CLAUDE.md` of the area the code lives in: `backend/CLAUDE.md`,
  `web/CLAUDE.md`, `admin/CLAUDE.md` or `infra/CLAUDE.md`. Claude Code loads that file whenever an agent works
  in the folder, and pr-review reads it too, so the same rule guides the writer and the reviewer. Create the file
  if it is missing, starting with `# <Area> rules` and one line saying these rules come from recurring review
  findings. An `other` lesson goes in the root `AGENTS.md` only if it applies to every area; otherwise skip it.
- **Suppressions for the reviewer** go under `## Out of scope` in `REVIEW.md`.

## What becomes a lesson

1. **Group** the accepted findings into patterns: the same mistake, whatever file or wording. A pattern is a
   rule candidate when it appears in at least two different pull requests, or once when it is a high-severity
   correctness or security mistake that would recur anywhere in the area (for example, a path that skips the
   allocator's referee in ADR 0004).
2. **Skip** a candidate an existing rule in that `CLAUDE.md`, `AGENTS.md`, `REVIEW.md` or `DESIGN.md` already
   covers. If the rule exists and the mistake still recurs, sharpen the rule's wording instead of adding one.
3. **Mechanical first.** If a linter rule, a type, or a test can stop the mistake for good, do not write prose:
   open an issue labelled `needs-refinement` titled `Enforce: <the rule>`, with the evidence (the pull requests)
   and the enforcement you propose. Search open issues first (`gh issue list --search "Enforce:"`) and comment
   on an existing one rather than opening a duplicate.
4. **Rejections teach the reviewer.** Group the rejected findings by their reason. When the same kind of
   finding is rejected for the same valid reason in at least two different pull requests, add a suppression:
   `- Do not flag <what>. Why: <reason> (#<pr>, #<pr>).` If a rejection reason looks wrong (the finding was
   right), do nothing with it.

## How a rule is written

One line, imperative, specific to this codebase, then a short why and its sources:

`- Wrap every pgx error with the query name. Why: unwrapped errors hid the failing query (#312, #340).`

At most 30 rules per file. When a file is full, merge overlapping rules or propose enforcing one mechanically
(step 3) before adding another. Never remove a rule because its finding stopped appearing: that is the rule
working. Remove one only when its why no longer holds (the code it guards is gone), and say so.

## What you publish

Change only the files named above. Then:

- **If you changed a file**, commit on a new branch `review-lessons-<YYYY-MM-DD>` (`docs(lessons): ...`), push,
  and open a pull request with `gh pr create --body-file`, following `.github/pull_request_template.md`. Its risk
  is `high` (agents' instructions). Under **What changes**, list each rule and suppression with its source pull
  requests, and each `Enforce:` issue you opened or commented on. Under **Why**, put the trend table below.
- **If you changed nothing** but some pull request was reviewed, open an issue titled
  `Review lessons <YYYY-MM-DD>: no new rules` with the trend table and the `Enforce:` issues, if any.
- **If no pull request was reviewed**, publish nothing.

The trend table has one row per category with first-round comments in the window: the last week's accepted and
rejected counts, and the average per week over the earlier weeks. A falling accepted count with a steady rejected
count means the lessons work; a falling accepted count with a rising rejected count means the reviewer is drifting,
so say that plainly.
