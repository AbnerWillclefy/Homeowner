# Take bank data from Pluggy with per-User credentials encrypted by the app

Finances (#419) gives each User a private, read-only money view. Its data comes from Pluggy, so the app stores a third party's credentials for each User and holds their bank Transactions. Nothing like that exists yet, so this records the risks, what is protected and what is not, and the upgrade path, before any credential is stored. The budget is still under $20 a month ([ADR 0002](0002-mirror-the-work-stack.md)).

## Decision

- **Source of bank data: MeuPluggy, each User bringing their own key.** The User connects their banks at meu.pluggy.ai and pastes their own Pluggy Client ID and Secret into the app. MeuPluggy is free for personal use, up to 5 active connections of the same holder, which fits two Users. The app never uses a Homeowner-owned Pluggy account for other people's data.
- **Credentials at rest: AES-256-GCM in the app, key in SSM.** The Go standard library encrypts the Client ID and Secret with a 256-bit key held in an SSM SecureString parameter, with a fresh random nonce per value. Each row stores a `key_version`, so a later key, or KMS, can be introduced without guessing how old rows were sealed. Credentials are never returned to the browser; the User can replace or remove them.
  - *Protects against:* a leaked database, a backup, a log line or a SQL dump. Without the key, those hold only ciphertext.
  - *Does not protect against:* code running in the Lambda, which holds the key and the plaintext in memory while it works; a bug or a malicious dependency there reads everything. The deploy role (`ssm:*` on the environment path, `infra/bootstrap/main.tf`) can also read the key. That is accepted.
- **A separate finance Lambda.** The daily sync runs as a `finance-events` command: the same image, the `scheduled-job` module, only `POST /events` and `GET /healthz`, no function URL, exactly as [ADR 0008](0008-scheduled-jobs-run-as-a-second-lambda-from-the-api-image.md). It is a separate function so the key can be granted to it and to the API only.
  - *Today that is not yet true.* `lambda-container` and `scheduled-job` both grant `ssm:GetParameter` on `${ssm_path_prefix}/*`, so the Allocation job can read the key. "Only the finance job and the API" holds once #423 limits the Allocation job to an explicit list of parameter names; the key must not be created before that.
- **A missing key does not stop the API.** `cmd/api/secrets.go` stops the process when a listed parameter cannot be read. The key is read as an optional secret instead: finance is off, and the rest of the app runs.
- **Access by allowlist.** A list of emails in an SSM parameter per environment, read at cold start. Terraform owns it with `ignore_changes = [value]`, so a hand edit survives an apply and takes effect on the next cold start. The finance job checks it too, so removing a User stops their sync.
- **Bank data stays out of the Home model, the logs and the admin app.** Finance tables are keyed by User, never by Home. No log line carries a description, amount or credential. `internal/admin` never reads a `finance_*` table, which keeps [ADR 0017](0017-operate-through-a-separate-admin-app-per-environment.md): admin stays read-only aggregates over its own tables.
- **What goes to Anthropic.** Only the normalised `merchant_key` of an Expense, with no amount, date, account or User. Descriptions that look like a transfer to a person (PIX, TED, DOC) never go, because they carry other people's names; they fall back to Other. Categorizer calls are recorded in `llm_call_events` with `home_id` NULL and no prompt or output text, as ADR 0017 requires.
- **Push payloads.** A reminder for a Bill to pay (#435) names the Bill, but the comment on `push.Payload` forbids names. Web Push payloads are end-to-end encrypted (RFC 8291), so the push provider cannot read them. This ADR proposes accepting that for finance reminders; **the maintainer confirms on review**, and #435 then updates the comment in `backend/internal/push/push.go`.
- **The Pluggy Connect script** runs in the PWA's origin, where the session tokens live. It is loaded only when the User taps connect, from the pinned URL `https://cdn.pluggy.ai/pluggy-connect/v2.7.0/pluggy-connect.js`, with `integrity` and `crossorigin="anonymous"`. Pluggy publishes no hash; `sha384-EfJtVYPBw2vssrS8cou8sSUccnxm72OwXqa4V+b1injWH0avP4mtCJr2XM6Sb2/7` was computed on 2026-11-07, and the CDN sends `access-control-allow-origin: *`. A version bump recomputes it.
- **Privacy and deletion.** No delete-account flow exists, so the guarantee is `ON DELETE CASCADE` from `users` on every finance table. `DELETE /me/finance` removes the User's finance data and credentials but does not remove the item at Pluggy; the User manages that in MeuPluggy.
- **Answers from the sandbox ([#420](https://github.com/AbnerWillclefy/Homeowner/issues/420)),** captured on 2026-11-07 from Pluggy Bank, and what follows from each:
  - `providerId` is missing on every row, so Transactions are de-duplicated by Pluggy's transaction `id`, which was stable across two fetches.
  - `GET /transactions` (v1) returns `410` and is removed on 2026-12-31. The sync uses `GET /v2/transactions?accountId=&dateFrom=&dateTo=` and follows the cursor in `next` until it is `null`. `/accounts`, `/items/{id}` and `/bills` still page by `page`.
  - Direction comes from the sign of `amount` (negative is money out), never from `type`: card purchases are negative with `type: "CREDIT"`. Amounts have at most 2 decimals.
  - `date` is a UTC timestamp (São Paulo midnight is `T03:00:00.000Z`); it is converted to a São Paulo date, not truncated.
  - Only `POSTED` rows were seen, so whether a pending row keeps its `id` is unknown. Until it is seen, `PENDING` rows are not imported.
  - Card bills exist (`GET /bills`), and `category` can be `null`.
  - Not yet answered, tracked in #443 for on or after 2026-11-22: whether the sandbox works on the free plan after the 15-day trial, and whether a sandbox item counts toward the 5-connection limit.

## Alternatives rejected

- **Pluggy's paid plan,** so Homeowner owns one key: R$ 2,500 a month, far over the budget, and it would make Homeowner the holder of other people's bank access.
- **Statement-file import (OFX/CSV):** no third-party credentials, but a manual step every time, so the data is never current. Out of scope for v1 (#419).
- **KMS from the start:** the better home for the key, but it adds a resource and a per-request cost for two Users. It is the planned upgrade: `key_version` lets new rows use a KMS data key while old rows are re-sealed by a job.
- **Plain-text credentials in the database** behind a restricted role: one leaked backup would give away read access to people's banks.
- **Finance inside the API Lambda only,** with no separate function: the sync would run with the API's wider permissions, and the key could not be limited to two functions.

## Consequences

- A leaked database or backup does not expose credentials; a compromised Lambda or deploy role does. The scheme is a floor, not a vault.
- #423 must land before the key exists: until the Allocation job's SSM grant is an explicit list, that job could read it.
- Allowlist changes need a cold start; removing a User also stops their sync.
- The re-test in #443 may change the testing plan, not the design.
- Every finance table needs `ON DELETE CASCADE`, and a `key_version` where it holds ciphertext; review of any new finance table checks both.
- Merchant keys of non-person merchants leave the system to Anthropic.
