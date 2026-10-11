# Infrastructure

Terraform for the Homeowner backend on AWS, within the budget in
[ADR 0002](../docs/adr/0002-mirror-the-work-stack.md): nothing that bills while
idle, no VPC, no NAT Gateway.

```
bootstrap/   applied once by a human with local state: state bucket, GitHub OIDC provider, deploy role
modules/
  lambda-container/  ECR repository, Lambda (image), execution role, log group
  http-api/          API Gateway HTTP API in front of a Lambda
  neon-branch/       Neon branch, role, database, endpoint; connection strings into SSM
  web/               private S3 bucket behind CloudFront (default HTTPS domain, SPA fallback)
  budget/            account-wide monthly AWS Budget with email alerts
staging/     thin folder wiring the modules together (state in S3)
```

Modules know no environment names; `staging/` passes `homeowner-staging`. A
future `production/` folder is another thin folder over the same modules.

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
4. **GitHub settings** (repository, Settings, Secrets and variables, Actions):
   - variables `AWS_REGION`, `AWS_DEPLOY_ROLE_ARN` (output `deploy_role_arn`) and `NEON_ORG_ID`
   - secrets `NEON_API_KEY` and `BUDGET_EMAIL` (kept secret so the address never
     shows in logs)
5. **After the first deploy**, set the repository variables `STAGING_API_URL`
   (the `api_url` output) and `STAGING_WEB_URL` (the `web_url` output, an
   `https://dxxxx.cloudfront.net` address); both are printed in the job summary.
   `GITHUB_TOKEN` cannot write repository variables, so the workflow only warns
   when a variable differs. QA reads both. If the CloudFront distribution is ever
   recreated its domain changes: CORS follows automatically, but
   `STAGING_WEB_URL` must be reset by hand.
6. **CloudFront on a brand-new AWS account** can be refused ("your account must
   be verified"). That is an AWS support step, not a code problem; ask AWS
   Support to enable CloudFront, then re-run the deploy.

7. **Web Push keys (#7)**, once, before the first deploy that includes push.
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
set to the API URL, uploads it to the web bucket in passes (fingerprinted
`assets/` immutable for a year, `index.html`, `sw.js`, `registerSW.js`,
`workbox-*.js` and the manifest `no-cache`, `index.html` last, stale objects
deleted afterwards), invalidates `/*` and smoke tests the site: `/` and a deep
link return the app, the manifest is served, and the API answers `/healthz` with
`access-control-allow-origin` equal to the web URL. It lives in the same
workflow so QA runs once after both jobs. The first run creates the CloudFront
distribution, which takes 3 to 10 minutes.

The workflow never runs `terraform destroy`.

### Migrations: expand, then contract

Migrations run before the new code is live, and a failing migration stops the
deploy before the function is swapped. So **every migration must be backward
compatible with the previous release**: add columns and tables first (expand),
ship code that uses them, and remove the old ones in a later release (contract).
Never rename or drop something the running release still reads.

## State and secrets

State is in S3 (`homeowner-tfstate-<account id>`, key `staging/terraform.tfstate`)
with native locking (`use_lockfile`, no DynamoDB). The bucket is private,
versioned, encrypted (SSE-S3) and TLS-only.

The Neon connection strings are written to SSM (`/homeowner/staging/database-url`
pooled, `/homeowner/staging/migrate-database-url` direct) by Terraform, so **the
secrets also sit in Terraform state**. That is acceptable because the bucket is
private, encrypted and versioned and staging data is disposable. They are
`SecureString` on the default `aws/ssm` key (a customer-managed key costs
$1/month). The Lambda reads them at startup through `DATABASE_URL_SSM_PARAM` and
`MIGRATE_DATABASE_URL_SSM_PARAM`, so they never appear in the function's
environment; its role can read `/homeowner/staging/*` only.

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

## Idle-cost audit

| Resource | Billing |
|---|---|
| Lambda function | pay per use |
| API Gateway HTTP API (+ `$default` stage) | pay per use |
| SSM standard parameters (3: two database URLs, the VAPID private key) | free |
| AWS Budget | free (first two budgets) |
| ECR repository | storage (lifecycle keeps the last 5 images) |
| S3 web bucket | storage and requests |
| CloudFront distribution (`PriceClass_100`, default certificate) | pay per use (requests and transfer) |
| CloudFront Origin Access Control | free |
| S3 state bucket | storage |
| CloudWatch log group | storage (14-day retention) |
| IAM roles, policies, OIDC provider | free |
| Neon project, branch, endpoint | free tier, scales to zero |

Must stay absent: WAF, CloudFront Origin Shield and access logs, VPC, NAT Gateway, load balancer, provisioned concurrency,
customer-managed KMS keys, RDS/Aurora, DynamoDB, EC2.

## Known follow-ups

- The deploy role is least privilege by prefix (`homeowner-staging-*`, the SSM
  path `/homeowner/staging/*`), but API Gateway ids are generated, so its API
  Gateway permissions are scoped to HTTP APIs in the region, not to one API.
- CloudFront ids are generated, so the deploy role's CloudFront permissions are
  scoped to distributions and origin access controls of this account, not to
  one distribution; the list and managed-policy lookups need `*`.
- A missing file such as an old `/assets/<hash>.js` returns `index.html` with
  200 (the SPA fallback maps 403 and 404), so a stale client may get HTML where
  JavaScript was expected. `registerType: "autoUpdate"` recovers on the next load.
- The Neon project is owned by `staging/`. A future `production/` folder should
  take the project id as a variable instead of creating a second project.
