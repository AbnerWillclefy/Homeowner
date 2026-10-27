# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

People who look after their own Home with no cleaner or outside help, sharing the housework between Residents whose Energy differs day to day. The first Home is the maintainer's: a couple where one person usually has more Energy than the other. Design must also hold up for other small Homes (couples, flatmates) later, so nothing may assume the maintainer's own Home or need explaining in person.

The job: each morning, say how you feel, see what is yours to do today, and commit to what you will actually do, without anyone having to decide who does what.

## Product Purpose

Homeowner is an advisor for housework. Each day it proposes a Day Plan that gives every Resident Tasks fitting their Energy, never breaking a Restriction, putting the most urgent work first and rolling the rest over. There is always more work than Energy, so the product exists to choose what gets done today, by whom, in a way every Resident can sustain.

Success: the work gets shared fairly over time, nobody is pushed past their limit, and the person with less Energy stops feeling overwhelmed or guilty while the one with more stops quietly carrying the load.

## Positioning

Chore apps track what needs doing. Homeowner decides who does what today, from each Resident's Energy, Preferences and Restrictions, and explains why in plain language. It advises and never commands: only a Task a Resident explicitly Commits to counts as a promise, and an honest bad day never costs anything (a Drained day pauses the Streak; only a day of broken commitments with nothing done breaks it).

## Operating Context

- Used on a phone, installed to the Home Screen as a PWA (iPhone and Android). One centred column, mobile-first; no desktop layout in v1.
- Daily ritual: a morning Check-in (Drained, Low, Normal, Energized, plus optional one-day Restrictions), then the Day Plan at the Home's Allocation time, then accepting, refusing, swapping or taking Tasks and marking them done.
- Residents often open it on low-Energy days. Push reminders are a best-effort nudge only; the app asks for the Check-in whenever it opens.
- Four bottom tabs: Today, Chores, Home, Me. Auth and onboarding are full-screen outside the tabs.
- Shown in US English or Brazilian Portuguese, chosen from the device language or in Settings. Most Residents use Brazilian Portuguese, so it is the primary locale for design and review.

## Capabilities and Constraints

- Domain vocabulary is fixed in `GLOSSARY.md` (Home, Resident, Chore, Task, Effort, Energy, Baseline, Check-in, Day Plan, Committed, Streak, and their avoided synonyms). Portuguese wording is in `docs/glossary-pt-BR.md`. Copy uses these terms.
- Stack: React PWA with Tailwind v4 semantic tokens and Radix Primitives only where native HTML cannot be made accessible (ADR 0007, 0009). Raw palette classes in components are a review failure.
- Light and dark themes, following the system by default with an in-app choice.
- Offline capable: fonts and both language catalogs are precached.
- Every visible string goes through the typed i18n module in both locales (ADR 0006).
- The Day Plan must keep working when the AI allocator is unavailable or wrong (ADR 0004).

## Brand Commitments

- Name: Homeowner, the same in both languages.
- Voice: calm, plain advisor. Neutral and matter-of-fact, kind but not cute. It explains; it does not cheer. Never guilt, never urgency, never commands.
- Existing look commitments already recorded in ADR 0007 and ADR 0009 (calm and native-feeling, Nunito, one teal accent for primary actions, a pastel per Category with the Category name always shown as text). These live in the ADRs and code; this file does not restate them as a visual system.
- Icons: `web/public/icon-*.png`, `apple-touch-icon.png`.

## Evidence on Hand

- Spec: GitHub issue #1 (88 user stories). Decisions: `docs/adr/`. As-built architecture: `docs/architecture/`.
- No testimonials, user counts, outside users, pricing or press exist. Do not invent any.

## Product Principles

1. Advise, never command. The system proposes; only the Resident commits.
2. Rest is never punished. Being honest about a bad day must cost nothing, in rules and in wording.
3. Never past the limit. No plan, screen or nudge pushes a Resident beyond their Energy or a Restriction.
4. Explain every decision in plain language, so Residents trust the plan instead of feeling bossed around.
5. Push is a nudge, not a dependency. The app works the same when notifications never arrive.

## Accessibility & Inclusion

WCAG 2.2 AA across the app (ADR 0007): touch targets at least 44px, all sizes in `rem` with layouts that hold at the largest iOS Dynamic Type and Android font size, meaning never carried by colour alone, visible focus, motion only behind `motion-safe:`. Each screen pull request reports a manual pass with VoiceOver, TalkBack, keyboard only, largest text size, both themes and DevTools contrast.
