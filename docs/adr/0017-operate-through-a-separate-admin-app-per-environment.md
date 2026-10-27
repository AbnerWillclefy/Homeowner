# Operate through a separate admin app per environment, gated by a Cognito group, fed by a per-call LLM record

The maintainer needs one place to see how Homeowner and its AI behave in staging and production. Staging and production must stay isolated (no service with credentials for both databases, the staging deploy role cannot touch production), the budget is under $20 a month with nothing billing while idle ([ADR 0002](0002-mirror-the-work-stack.md)), and Residents must never receive admin code or see personal data on it.

## Decision

- **Role.** A Cognito group `super-admin` in each environment's user pool, created by Terraform. Membership is granted by hand with the AWS CLI, per environment; no code names a person. The API reads `cognito:groups` from the ID token; every route under `/admin/` sits behind one `requireSuperAdmin` guard: 401 without a valid token, 403 without the group. The guard does not create a User. The role says nothing about Homes.
- **Reaching each environment.** Each environment's API serves read-only `/admin/*` routes over its own database. A separate React app in `admin/` is built and deployed per environment to its own S3 bucket and CloudFront distribution, by that environment's deploy job, and signs in to that environment's pool with the existing app client. Each API allows only its own admin origin in CORS. The environment switch is a link to the other environment's admin origin, keeping the path.
- **Numbers.** Aggregates are queried at request time from the existing tables, in a read-only transaction. Every LLM attempt is recorded in `llm_call_events` (service, model, outcome, latency, tokens, estimated cost, Home and run ids, local date; never prompt or output text), written by `dayplan` after the outcome is known, best effort and outside the planning transaction. `llm_calls` stays the cap. Cost is estimated from tokens with a price table in code.

## Alternatives rejected

- **One admin deployment for both environments**: two sessions in one origin, and a switch bug could show production as staging; deploying it needs the other environment's outputs.
- **One admin backend reading both databases**: breaks isolation (rejected in #317).
- **A route inside the PWA**: ships admin code to Residents; the service worker and the SPA fallback capture its paths.
- **A nightly rollup**: a job, a table and staleness for data this small.
- **CloudWatch metrics**: bill per metric per month and per query.
- **The Anthropic cost API**: needs an organisation Admin key and cannot separate environments.
- **A hard-coded admin email or a column on `users`**: a code change per grant, or a grant reachable through a database bug.

## Consequences

- Switching environments is a page load to another origin, and each environment needs its own sign-in.
- Revoking the group takes effect within the ID token's 60 minutes.
- Estimated cost can drift from the bill; the Anthropic Console stays authoritative.
- `internal/admin` reads many tables directly, so schema changes to them must update its queries; the API tests catch drift.
- Two more distributions and buckets cost cents; queries run only when the maintainer looks.
- `llm_call_events` grows by a few rows per Home per day; pruning is deferred.
