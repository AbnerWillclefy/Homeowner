# Web rules

These rules come from findings the reviewer raised in more than one pull request (`.claude/skills/review-lessons/`).

- Work out "today" from the Home's timezone (`useShell().home`) each time you use it. Never fix it at mount and never take it from the device clock. Why: a resumed PWA, or a phone in another timezone, compared against the wrong day (#497, #520).
- When a screen's context changes (the month, a new panel session), clear its notices and errors, and drop any response that arrives for the old context. Why: notices and late results showed up in the next month or listening session (#468, #519, #521).
- A failed read hides only the block that needs it. The other blocks keep showing, and the failed one shows its own alert with Retry. Test the failure path. Why: one failed read hid unrelated content, or had no test (#475, #497, #507).
- Every new call in a domain's `api/api.ts`, and its response parser, gets a case in `api.test.ts` that covers the request and a malformed body. Why: new API calls kept shipping without tests (#471, #472, #505).
