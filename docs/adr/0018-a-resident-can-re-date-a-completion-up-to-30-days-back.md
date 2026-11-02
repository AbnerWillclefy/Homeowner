# A Resident can re-date a Completion up to 30 days back

A Resident who did a Task yesterday but marked it today gets the wrong day: the Completion counts for today, and yesterday can read as a broken day. [ADR 0014](0014-a-day-with-any-completion-keeps-the-streak.md) said "a Completion on a later day does not repair an earlier day", and the Completion could not be changed. That is right while the clock is the only witness. It is wrong when the Resident knows better. This ADR lets them correct the time and amends 0014's line.

## Decision

`PATCH /home/completions/{id}` with `{"completedAt": "<RFC 3339 instant>"}` re-dates a Completion.

- The client sends an instant. The server decides which Home-local day it counts for.
- A Resident named on the Completion may move it (either partner of a two-person Completion). The check is in SQL, against `completion_residents`.
- The instant may not be after now, may not fall before `today-29` (Home-local), and may not fall before the Task's window start.
- One transaction sets the Completion's time and Home-local date and the Task's closed date to that date, so a recurring Chore restarts from the real day ([ADR 0001](0001-chores-come-due-in-flexible-windows.md)).
- The Streak query becomes date-aware: a Commitment is undone only when its Task has no Completion dated on or before the Committed day. A Task Committed today, completed, then moved to yesterday does not make today undone.

ADR 0014 is amended: a Completion dated earlier than a Commitment's day keeps that Commitment; a Completion on a later day still does not repair an earlier day, but a Resident can now move it back to that day.

## Considered Options

- **Keep Completions immutable.** Simplest, and the audit stays whole, but the Resident pays for a clock they could not have set, and the Streak punishes honest use.
- **Let the client send a date.** The client's zone and the Home's zone can differ, and a day-boundary bug would sit in the PWA. Sending an instant keeps the one place a zone becomes a date on the server.
- **No limit back.** Lets a Streak be rebuilt from nothing. 30 days is enough for a forgotten week and short enough to keep history honest.
- **Undo and re-complete.** Needs a delete path and loses the Completion id and partners; out of scope.

## Consequences

- A Streak can come back: a Completion moved onto a broken day makes it grow. This is trust, not enforcement; the app cannot know when the Task was done.
- Both partners of a two-person Completion are affected: moving it moves it for both, and both Streaks follow.
- Moving a Completion later can break a day. A Task Committed on Monday and done on Monday, then moved to Wednesday, leaves Monday undone.
- There is no audit of the original time. The old value is overwritten.
- Admin reports read the corrected date.
- Moving the Completion of the Chore's latest Task earlier can open its next Task sooner; moving an older Task's Completion changes history only.
