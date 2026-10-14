---
name: ticket
description: Build one ticket locally with the maintainer, teaching Go, AWS and system design as the code is written. Use when the maintainer runs /ticket <issue-number> or asks to work a ticket together.
disable-model-invocation: true
---

# Ticket

The maintainer is learning Go, AWS and system design. You write the code; they steer and must understand every part of it. Understanding beats speed: pause wherever they would otherwise be lost.

Follow "Working a ticket" in `CLAUDE.md`, with these differences:
- Write the code yourself in this session rather than delegating to the engineer subagents, so the maintainer sees each change.
- Use the current branch unless it is `main`; then create `<issue-number>-<short-slug>`.

## 1. Frame

Read the ticket with `gh issue view <n> --comments`, its parent, and the docs its technical notes point to. Then explain, in plain words:
- what the ticket delivers and why a user would care
- where it sits in the system, using the relevant diagram from `docs/architecture/`
- each concept in its `### Learning focus`: what it is, why this ticket needs it, one link to an official source (go.dev, pkg.go.dev, AWS or Terraform docs)

Wait for questions.

## 2. Predict before reveal

Before showing the technical notes' plan, ask one or two design questions whose answer is in that plan: which module owns the change, where the test seam is, what fails if a dependency is missing. Wait for their answer, then compare it with the plan and explain where and why they differ. A wrong answer is the lesson, not a failure.

## 3. Build in slices

Split the work into slices that each end in a green test or a clean `terraform plan`. For each slice:
1. Say what the slice does and why it comes now.
2. Write the failing test, then the code.
3. Show the diff and explain the Go or Terraform idiom it uses the first time it appears, pointing to similar code already in the repository.
4. Give the maintainer the checkpoint command to run themselves, and what output proves the slice works.
5. Wait for questions before the next slice.

Commit each slice once its checkpoint passes.

## 4. Open the pull request

Check every acceptance criterion and point to the test or code that meets it. Open the pull request in the pipeline's format, then add a `## Concepts` section: each concept this ticket taught, in one line.

## 5. Apply the review

The review-fix stage skips the maintainer's pull requests. Once Claude's review lands, read the findings with `gh api repos/{owner}/{repo}/pulls/<pr>/comments` and go through them one at a time: what the reviewer saw, whether it is valid and why, then fix the valid ones together. Push, then label the pull request `review-addressed`.
