Closes #<!-- issue number -->

<!--
Written for the human who reviews and merges this, not for the AI reviewer: the reviewer already reads the diff and the ticket.
Say what a person needs to decide to merge it, in plain words. Every section is checked by the pr-risk workflow.
Tiers and merge rules: docs/agents/pr-risk.md.
-->

## Why

<!-- The problem this solves and for whom, in two or three sentences, for someone who has not read the ticket. -->

## What changes

<!-- Behaviour before and after, as a Resident or the system sees it. Then the two to four files a reviewer should read first, and why. -->

## Risk

**Risk:** <!-- low, medium or high -->

<!-- Why this tier: what the change touches, who notices if it breaks (Residents, data, staging only) and how fast.
High: also say why it is high and why it cannot be made smaller or safer. -->

### What can go wrong

<!-- The one to three most likely ways this breaks, and how each would show up (an error, a wrong number on screen, a failed deploy). "Nothing" is not an answer. -->

## How it was tested

<!-- Commands run and what they showed, tests added, screens checked. Then what the checks would NOT catch. -->

## How to revert

<!-- Exact steps. Usually "revert the merge commit and let staging redeploy". Also say what a revert leaves behind:
a migration (expand-only, so it stays), Terraform resources, data written in the meantime, a service worker cached on phones, push subscriptions. -->

## Acceptance criteria

<!-- One line per criterion from the ticket, with the test or code that meets it. -->
- [ ] 

<!--
UI changes only: a screenshot under each heading, pt-BR first (the ui-screenshots check needs both).

### pt-BR

### English
-->
