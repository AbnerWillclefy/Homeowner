# 0025: Responsibility binds Allocation, not Residents

A Home wants to say "this Chore is Ana's". [ADR 0004](0004-ai-allocates-behind-a-deterministic-referee.md) makes the referee (`Check`) the single place hard rules live and keeps Preferences soft. A responsible Resident could be either: ranked like a Preference, or a rule.

## Context

If it were soft, Allocation would still hand Ana's Chore to someone else whenever that Resident ranked better, and the arrangement would mean little. If it also bound Residents, nobody could Take, Complete or Swap a Task that waits for an absent Ana, and Check would refuse what the Home needs done.

## Decision

A Chore's responsible Resident is a hard rule for Allocation:

- `Plan` gives a one-person Task only to them, and a two-person Task to them plus the best other Resident by the usual ranking.
- `Check` reports `not_responsible` for a one-person Task given to anyone else and for a two-person Task whose pair does not include them. `Eligible`, and so the LLM allocator's pre-filter, use the same helper.
- When they do not fit (not enough Energy, Drained, a one-day Restriction, or absent from the plan), the Task waits in the pool as `waiting_for_responsible` instead of going to someone else. Its current Effort keeps growing as usual. The weekday rule still comes first.
- It does not bind Residents: Take, Complete from the pool and Swap ignore `not_responsible`, as they already ignore Energy. Check-in and "right away" re-plans stay strict, so a responsible Resident who checks in picks up what waits for them.
- A lasting Restriction always wins: setting it clears the responsibility it would break.

## Alternatives rejected

- **A soft rule ranked like a Preference:** a better-ranked Resident would still get the Task, so the Home's arrangement would hold only by luck.
- **Binding Residents too:** Take, Complete and Swap would fail for a Task waiting on an unavailable Resident, with no way out.

## Consequences

- Plans honour the Home's arrangement exactly, at the cost of Tasks that can wait while the responsible Resident is unavailable. Residents resolve that by hand.
- `Check` enforces what Take and Swap deliberately bypass, so `dayplan`'s `mayDoIn` ignores `not_responsible`. Without that case, a Take of a responsible Task would answer `500`.
- Making it soft later is a change to `Plan` and `Check` only, with no data change.
