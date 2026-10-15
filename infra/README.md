# Infrastructure

Terraform for the Homeowner backend on AWS, within the budget in
[ADR 0002](../docs/adr/0002-mirror-the-work-stack.md): nothing that bills while
idle, no VPC, no NAT Gateway.

```
bootstrap/   applied once by a human with local state: state bucket, GitHub OIDC provider, one deploy role per environment
modules/
  lambda-container/  ECR repository, Lambda (image), execution role, log group
  scheduled-job/     Lambda from an existing image with another command, started by an EventBridge schedule
  http-api/          API Gateway HTTP API in front of a Lambda
  neon-branch/       Neon branch, role, database, endpoint; connection strings into SSM
  web/               private S3 bucket behind CloudFront (default HTTPS domain, SPA fallback)
  auth/              Cognito user pool and the PWA's app client (sign-in)
  budget/            monthly AWS Budget with email alerts, account-wide or for one environment tag
staging/     thin folder wiring the modules together (state in S3)
production/  the same wiring with the homeowner-production prefix and its own Neon project
```

Modules know no environment names; `staging/` passes `homeowner-staging` and
`production/` passes `homeowner-production`. The two folders differ only in
their `locals`, backend key, `environment` tag, Neon project and budget.

## Prerequisites only a human can do

1. **AWS account** (shared by staging and production) and a region. Credentials
   with enough rights to run the bootstrap.
2. **Neon account** and an API key. Save it as the GitHub secret `NEON_API_KEY`,
   and the organisation id (Neon console, organisation settings, `org-...`) as the
   repository variable `NEON_ORG_ID`.
3. **Bootstrap apply** with local state:
   ```sh
   cd infra/bootstrap
   terraform init
   terraform apply -var aws_region=<region>
   ```
   Keep the local `terraform.tfstate` somewhere safe (it is git-ignored); it only
   describes the bucket, the OIDC provider and the role. Note the outputs.

   **Re-run this apply whenever `bootstrap/` changes.** The web hosting (#6)
   extended the deploy role with permissions for the `homeowner-staging-web-*`
   bucket and CloudFront; until the maintainer re-applies (same command, same
   local state), the first deploy on `main` fails with AccessDenied.

   **Sign-in (#8) needs this re-apply too, before the deploy that follows its
   merge:** the deploy role gains `cognito-idp:*` on user pools of the account and
   region, and without it the first deploy fails creating the user pool.
4. **GitHub settings** (repository, Settings, Secrets and variables, Actions):
   - variables `AWS_REGION`, `AWS_DEPLOY_ROLE_ARN` (the `staging` entry of the output `deploy_role_arns`) and `NEON_ORG_ID`
   - secrets `NEON_API_KEY` and `BUDGET_EMAIL` (kept secret so the address never
     shows in logs)
5. **CloudFront on a brand-new AWS account** can be refused ("your account must
   be verified"). That is an AWS support step, not a code problem; ask AWS
   Support to enable CloudFront, then re-run the deploy.

6. **Web Push keys (#7)**, once, before the first deploy that includes push.
   Without them the deploy still works but push stays off (`/push/*` answers 503).
   ```sh
   cd backend
   go run ./cmd/api vapid        # prints VAPID_PUBLIC_KEY=... and VAPID_PRIVATE_KEY=...
   aws ssm put-parameter --name /homeowner/staging/vapid-private-key \
     --type SecureString --value '<the private key>'
   ```
   Then set the repository variables `VAPID_PUBLIC_KEY` (the public key) and
   `VAPID_SUBJECT` (a contact the push services can reach, for example
   `mailto:you@example.com`). The deploy passes them to Terraform as
   `TF_VAR_vapid_public_key` and `TF_VAR_vapid_subject`. Create the parameter by
   hand, not in Terraform, so the private key never lands in state. Rotating the
   pair means a new `put-parameter --overwrite`, new variables and a redeploy;
   browsers re-subscribe on their next launch. Keep the private key out of
   chat, tickets and logs.

7. **LLM allocator (#26)**, optional and off by default. Without it the daily
   Allocation uses the baseline allocator only.
   ```sh
   aws ssm put-parameter --name /homeowner/staging/anthropic-api-key \
     --type SecureString --value '<an Anthropic API key>'
   ```
   Then set the repository variable `LLM_ALLOCATOR_ENABLED` to `true`; the
   deploy passes it as `TF_VAR_llm_allocator_enabled` and only the Allocation
   job gets the key. Set it back to `false` (or delete it) to switch the LLM
   off. Create the parameter by hand so the key never lands in Terraform state.
   The AWS Budget does not see Anthropic spend; the monthly spend limit in
   "Production" below caps it. The per-Home daily cap (3 calls) bounds it in code.

## How a deploy works

`.github/workflows/deploy-staging.yml` (named exactly `Deploy staging`) runs on
every push to `main`:

1. assume the deploy role through OIDC (only `refs/heads/main` of this repository
   can; pull requests never get AWS credentials)
2. `terraform apply` of the ECR repository and the Neon database only, so the
   first run has a registry and a database before any image exists
3. build the image tagged with the git SHA (single platform, no provenance, so
   Lambda accepts it) and run `migrate` from that same image against the direct
   Neon URL
4. push the image, then the full `terraform apply -var image_tag=<sha>`
5. smoke test `GET /healthz`, retrying for about 90 seconds (Lambda cold start
   plus Neon resume)

A second job, `web` (`needs: api`), then builds the PWA with `VITE_API_BASE_URL`
set to the API URL and `VITE_COGNITO_CLIENT_ID` / `VITE_COGNITO_REGION` set to
the `cognito_client_id` and `cognito_region` Terraform outputs (public
identifiers, not secrets), uploads it to the web bucket in passes (fingerprinted
`assets/` immutable for a year, `index.html`, `sw.js`, `registerSW.js`,
`workbox-*.js` and the manifest `no-cache`, `index.html` last, stale objects
deleted afterwards), invalidates `/*` and smoke tests the site: `/` and a deep
link return the app, the manifest is served, and the API answers `/healthz` with
`access-control-allow-origin` equal to the web URL. The first run creates the CloudFront
distribution, which takes 3 to 10 minutes.

The workflow never runs `terraform destroy`.

## Production

Production is promoted, not deployed on merge. `main` deploys staging; a human
opens a pull request from `main` into the `production` branch once staging is
verified, and merging it runs `.github/workflows/deploy-production.yml`
(`Deploy production`). It is `deploy-staging.yml` with production's names: the
`infra/production` root, `homeowner-production-api`, `/homeowner/production/*`
and its own `deploy-production` concurrency group.

The wall between the environments is IAM. `bootstrap/` creates
`homeowner-github-deploy-production`, assumable only by workflow runs on
`refs/heads/production`, with the staging role's permissions on the
`homeowner-production-` prefix, the `/homeowner/production/*` path and the
`production/*` state objects. So a workflow on `main` cannot touch production
through AWS. The type-scoped statements (API Gateway, CloudFront, Cognito) and
the shared `NEON_API_KEY` still reach both environments; see #186.

**Neon.** Production owns its own project (`homeowner-production`) instead of a
branch of staging's: a `destroy` in `staging/` cannot delete production's data,
and production's branch starts empty. The free plan allows 100 projects.

One-off human steps, in order, before the first promotion:

1. Re-apply `bootstrap/` (above) and set the repository variable
   `PRODUCTION_AWS_DEPLOY_ROLE_ARN` to the `production` entry of the output
   `deploy_role_arns`.
2. A new VAPID pair, never staging's: `go run ./cmd/api vapid`, the private key
   with `aws ssm put-parameter --name /homeowner/production/vapid-private-key
   --type SecureString`, and the public key as the variable
   `PRODUCTION_VAPID_PUBLIC_KEY`. `VAPID_SUBJECT` is shared.
3. Optional LLM allocator: a separate Anthropic API key at
   `/homeowner/production/anthropic-api-key` and the variable
   `PRODUCTION_LLM_ALLOCATOR_ENABLED=true`.
4. Create the branch (`git push origin main:production`) and a ruleset on it
   that requires a pull request approved by the maintainer and blocks force
   pushes. The role trusts the branch, not the person pushing, so this rule is
   what keeps agents out of production.

A hotfix goes to `production` through a pull request and is then merged back
into `main`.

### Spend limits

| Guard | Limit | Where | Check |
|---|---|---|---|
| AWS Budget `homeowner-account-monthly` | $10 a month, whole account | `staging/` | Billing, Budgets |
| AWS Budget `homeowner-production-monthly` | $5 a month, tag `environment=production` | `production/` | Billing, Budgets |
| Anthropic spend limit | $10 a month, whole organisation (all workspaces; workspaces only separate API keys), resets on the 1st | Anthropic Console, `/settings/billing`, set 2026-10-15 | the same page shows the limit and the reset date |

The $10 AWS budget and the Anthropic limit together are the $20 ceiling of ADR
0002. Both budgets email `BUDGET_EMAIL` at 100% of actual and forecast spend. The
production budget filters on the `environment` cost allocation tag, which was
activated in Billing, Cost allocation tags; a deactivated tag makes it report $0.
Budgets lag by hours and only warn; the Anthropic limit is the one that refuses
requests.

### Migrations: expand, then contract

Migrations run before the new code is live, and a failing migration stops the
deploy before the function is swapped. So **every migration must be backward
compatible with the previous release**: add columns and tables first (expand),
ship code that uses them, and remove the old ones in a later release (contract).
Never rename or drop something the running release still reads.

## State and secrets

State is in S3 (`homeowner-tfstate-<account id>`, keys `staging/terraform.tfstate`
and `production/terraform.tfstate`) with native locking (`use_lockfile`, no DynamoDB). The bucket is private,
versioned, encrypted (SSE-S3) and TLS-only.

The Neon connection strings are written to SSM (`/homeowner/staging/database-url`
pooled, `/homeowner/staging/migrate-database-url` direct) by Terraform, so **the
secrets also sit in Terraform state**. That is acceptable because the bucket is
private, encrypted and versioned. Production's data is not disposable, and
the decision still holds for it: its state object is readable only by the
production role and account administrators, not by the staging role. They are
`SecureString` on the default `aws/ssm` key (a customer-managed key costs
$1/month). The Lambda reads them at startup through `DATABASE_URL_SSM_PARAM` and
`MIGRATE_DATABASE_URL_SSM_PARAM`, so they never appear in the function's
environment; each function's role can read its own environment's path only.

The pooled URL carries `default_query_exec_mode=cache_describe` because Neon's
pooler is PgBouncer in transaction mode, where pgx's default prepared-statement
cache can fail. Migrations use the direct URL.

The Neon provider does not expose both connection URIs for a non-default branch,
so the module builds them from the endpoint host and derives the pooled host by
adding `-pooler` to the first label.

## Stale state lock

If an apply is cancelled, the lock file can be left behind and the next run
fails with `Error acquiring the state lock` and a lock ID. Once sure no apply is
running:

```sh
cd infra/staging
terraform init -backend-config="bucket=homeowner-tfstate-<account id>" -backend-config="region=<region>"
terraform force-unlock <lock id>
```

## Measuring the LLM allocator

The referee (`allocation.Check`) refuses any LLM plan that breaks a hard rule,
and the run records why in `allocation_runs.fallback_reason` (see
`docs/architecture/allocation.md`). Measure how often that happens before
tuning the model:

```sh
U=$(aws ssm get-parameter --region us-east-1 --name /homeowner/staging/migrate-database-url \
  --with-decryption --query Parameter.Value --output text)
psql "$U" -X -c "
SELECT allocator, coalesce(fallback_reason, '-') AS fallback, count(*) AS runs
FROM allocation_runs GROUP BY 1, 2 ORDER BY 3 DESC;" -c "
SELECT v->>'kind' AS violation, count(*) FROM allocation_runs, jsonb_array_elements(reasons->'llmViolations') v
GROUP BY 1 ORDER BY 2 DESC;"
unset U
```

The first table shows how many runs used the LLM's plan (`llm`) against those
that fell back, and why. The second shows which rules the model broke. Only the
daily Allocation asks the LLM, once per Home and day, and only when there is an
open Task and a Resident with Energy. Check-ins and "get my tasks right away"
use the baseline, so test with several Homes, not several presses.

The first staging call (2026-10-15) was refused for `over_energy`: the model
gave a Resident 19 Effort against 14 Energy. The client
(`backend/internal/llmalloc/anthropic.go`) sends thinking off and effort
`low`, which is cheap but weak at summing Effort. If `llm_rejected_by_checker`
with `over_energy` dominates, the next step is a ticket to turn on adaptive
thinking (keep effort `low`) and raise `max_tokens` in `Allocator.Propose`
(`backend/internal/llmalloc/llmalloc.go`), since thinking tokens count against
it. Then compare the fallback rate and the cost per call.

## Idle-cost audit

| Resource | Billing |
|---|---|
| Lambda function | pay per use |
| API Gateway HTTP API (+ `$default` stage) | pay per use |
| SSM standard parameters (4 per environment: two database URLs, the VAPID private key, the Anthropic API key) | free |
| AWS Budgets (2: account-wide and production) | free (first two budgets) |
| Cognito user pool and app client (default email sender, no domain) | free (first 50,000 monthly active users) |
| ECR repository | storage (lifecycle keeps the last 5 images) |
| S3 web bucket | storage and requests |
| CloudFront distribution (`PriceClass_100`, default certificate) | pay per use (requests and transfer) |
| CloudFront Origin Access Control | free |
| S3 state bucket | storage |
| CloudWatch log group | storage (14-day retention) |
| IAM roles, policies, OIDC provider | free |
| Neon project, branch, endpoint (one project per environment) | free tier, scales to zero |

Must stay absent: WAF, CloudFront Origin Shield and access logs, VPC, NAT Gateway, load balancer, provisioned concurrency,
customer-managed KMS keys, RDS/Aurora, DynamoDB, EC2.

## Known follow-ups

- Each deploy role is least privilege by prefix (`homeowner-<environment>-*`,
  the SSM path `/homeowner/<environment>/*`), but API Gateway ids are generated,
  so its API Gateway permissions are scoped to HTTP APIs in the region, not to
  one API. The same holds for CloudFront and Cognito below, so each role can
  reach the other environment's API, distribution and user pool (#186).
- CloudFront ids are generated, so the deploy role's CloudFront permissions are
  scoped to distributions and origin access controls of this account, not to
  one distribution; the list and managed-policy lookups need `*`.
- Cognito user pool ids are generated, so the deploy role's `cognito-idp`
  permissions are scoped to user pools of this account and region, not to one
  pool; creating and listing pools needs `*`.
- The pool sends mail with Cognito's default sender (free, about 50 emails a
  day, may land in spam), in production too until #71 moves both pools to SES. Changing the sign-in
  attribute or schema later replaces the pool and deletes its users; the pool has
  `deletion_protection` on so that is a deliberate act.
- A missing file such as an old `/assets/<hash>.js` returns `index.html` with
  200 (the SPA fallback maps 403 and 404), so a stale client may get HTML where
  JavaScript was expected. `registerType: "autoUpdate"` recovers on the next load.
- The LLM allocator runs with thinking off. Decide whether to turn it on once
  the fallback rate is measured (see "Measuring the LLM allocator").
