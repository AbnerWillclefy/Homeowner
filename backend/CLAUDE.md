# Backend rules

These rules come from findings the reviewer raised in more than one pull request (`.claude/skills/review-lessons/`).

- Give each new branch its own test case, usually a table row: both ends of an accepted range, every rejected input (an extra key, a wrong type, a value over a limit) and every row a loop skips. Why: an untested branch was the most frequent backend finding (#451, #463, #500, #501, #502, #506, #511, #514).
