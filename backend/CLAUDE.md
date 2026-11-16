# Backend rules

These rules come from findings the reviewer raised in more than one pull request (`.claude/skills/review-lessons/`).

- Give each new branch its own test case, usually a table row: both ends of an accepted range, every rejected input (an extra key, a wrong type, a value over a limit) and every row a loop skips. Why: an untested branch was the most frequent backend finding (#451, #463, #500, #501, #502, #506, #511, #514).
- When you change which month a card charge or card bill counts in, add a table row for each edge: a charge on the closing day, one dated after today, a card whose due day comes before its closing day, a card with no typed days, and a bill the bank reported closed. Why: each of these was counted in no month or in two (#677, #694, #697, #728).
- Log a database or provider error only through `safeErr`, never `err.Error()`. Why: a database error can quote a row, so the raw text leaks a Resident's data into the logs (#674).
- Before pushing a new migration, fetch `main`, number the file after its newest one and set `latestMigration` in `db_test.go` to match. Why: two migrations built in parallel took the same slot, and the one merged out of order blocked every later migration on staging (#727).
