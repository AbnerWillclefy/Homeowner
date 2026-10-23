# A day with any Completion keeps the Streak

[ADR 0003](0003-only-broken-commitments-break-a-streak.md) said a Streak breaks when a Resident leaves a Committed Task undone. In production a Resident on a 3-day Streak Committed to 4 Tasks, completed 2 and lost the Streak. Finishing half of what you took on should not read as a broken day. This ADR amends 0003's day rule.

## Decision

`Judge` decides a day in this order:

1. At least one Completion: the day **grows** the Streak, whatever else was Committed and left undone, and even on a Drained day.
2. Otherwise, at least one Committed Task undone and no Drained Check-in: the day **breaks** it.
3. Otherwise the day **pauses** it.

Today counts (`todayGrew`) as soon as the Resident has one Completion. Today is still never judged a break, and a Completion on a later day still does not repair an earlier day.

ADR 0003's principles stand: refusing or ignoring a proposed Task creates no Commitment and never breaks the Streak, a Drained day never breaks it, and growth needs a Completion.

## Considered Options

- **Keep 0003's rule:** one undone Commitment breaks the day. Simple, but it punishes the Resident who did more than nothing.
- **A threshold or percentage of Committed Tasks:** fairer in theory, but adds a number to explain and tune. Out of scope; one Completion is enough.
- **Count only Completions of Tasks the Resident Committed to or completed themselves:** narrower, but it needs who-completed data that `completion_residents` does not record.

## Consequences

- The Streak is computed on read, so past days are judged again: a Streak broken only by partially finished days comes back. No Streak goes down, since every day that grew before still grows and every day that breaks now also broke before.
- The rule is lenient: one Completion masks any number of broken Commitments.
- A partner's Completion counts for every Resident the two-person Task was given to, even one who never accepted it. This is accepted, matching "a Completion by two people counts for both". A Resident can therefore leave all their own Commitments undone and still grow. Narrowing it would be a separate ticket with a data change.
- "Today counts" no longer switches off when another Task is accepted after a Completion.
