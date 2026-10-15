locals {
  name_prefix = "homeowner-production"
  ssm_prefix  = "/homeowner/production"
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      project     = "homeowner"
      environment = "production"
    }
  }
}

# Budgets is a global service served from us-east-1.
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

# Authenticates with the NEON_API_KEY environment variable.
provider "neon" {}

# Production's own project, not a branch of another environment's, so this
# root's state owns its data: no other root can delete it, and its branch
# starts empty instead of forking someone else's.
resource "neon_project" "this" {
  name       = local.name_prefix
  org_id     = var.neon_org_id
  pg_version = 16
  region_id  = var.neon_region_id

  # The free plan allows at most 6 hours of history; the provider defaults to 24.
  history_retention_seconds = 21600
}

module "database" {
  source = "../modules/neon-branch"

  project_id      = neon_project.this.id
  branch_name     = "production"
  role_name       = "homeowner_production"
  database_name   = "homeowner"
  ssm_path_prefix = local.ssm_prefix
}

data "aws_caller_identity" "current" {}

# The PWA on S3 + CloudFront. The API trusts its origin (CORS_ALLOWED_ORIGINS);
# CloudFront does not depend on the API, so there is no cycle.
module "web" {
  source = "../modules/web"

  name        = "${local.name_prefix}-web"
  bucket_name = "${local.name_prefix}-web-${data.aws_caller_identity.current.account_id}"
}

# Sign-in (#8): the Cognito user pool and the PWA's app client. It depends on
# nothing, so the API can take its issuer and client id without a cycle.
module "auth" {
  source = "../modules/auth"

  name = local.name_prefix
}

module "api" {
  source = "../modules/lambda-container"

  name      = "${local.name_prefix}-api"
  image_tag = var.image_tag
  # POST /push/test waits up to 10s, then sends with a 10s timeout. The HTTP
  # API cuts integrations off at 30s.
  timeout         = 25
  ssm_path_prefix = local.ssm_prefix

  environment = merge(
    {
      PORT                           = "8080"
      DB_MAX_CONNS                   = "2"
      CORS_ALLOWED_ORIGINS           = join(",", compact(["https://${module.web.domain_name}", var.cors_allowed_origins]))
      DATABASE_URL_SSM_PARAM         = module.database.database_url_param
      MIGRATE_DATABASE_URL_SSM_PARAM = module.database.migrate_database_url_param

      # Public identifiers, not secrets, so plain variables (no SSM).
      COGNITO_ISSUER    = module.auth.issuer
      COGNITO_CLIENT_ID = module.auth.client_id
    },
    # Web Push (#7). The private key is a SecureString a human puts in SSM
    # (Terraform never sees it); without the public key push stays off and the
    # API answers 503 on /push/*.
    var.vapid_public_key == "" ? {} : {
      VAPID_PUBLIC_KEY            = var.vapid_public_key
      VAPID_SUBJECT               = var.vapid_subject
      VAPID_PRIVATE_KEY_SSM_PARAM = "${local.ssm_prefix}/vapid-private-key"
    },
  )
}

# The Allocation job (#13): the same image as the API, started with the command
# "events", on an EventBridge schedule. It has no URL and is not behind the HTTP
# API (docs/adr/0008). Every 15 minutes because Allocation times are quarter
# hours; the job plans each Home at or after its time, once per day.
module "allocation_job" {
  source = "../modules/scheduled-job"

  name                = "${local.name_prefix}-allocate"
  description         = "Plans every Home whose Allocation time has arrived"
  image_uri           = "${module.api.ecr_repository_url}:${var.image_tag}"
  command             = ["events"]
  schedule_expression = "rate(15 minutes)"
  ssm_path_prefix     = local.ssm_prefix

  environment = merge(
    {
      PORT                   = "8080"
      DB_MAX_CONNS           = "2"
      DATABASE_URL_SSM_PARAM = module.database.database_url_param

      # Lambda Web Adapter forwards the scheduled event to POST /events (its
      # default pass-through path); it is told explicitly where to check
      # readiness, since "/" is not served by the job.
      AWS_LWA_READINESS_CHECK_PATH = "/healthz"
    },
    # The same VAPID settings as the API (#25): the tick sends the Check-in
    # reminder and "Day Plan ready" pushes. Without the public key the job only
    # plans. The module's SSM read policy already covers the private key.
    var.vapid_public_key == "" ? {} : {
      VAPID_PUBLIC_KEY            = var.vapid_public_key
      VAPID_SUBJECT               = var.vapid_subject
      VAPID_PRIVATE_KEY_SSM_PARAM = "${local.ssm_prefix}/vapid-private-key"
    },
    # The LLM allocator (#26), off unless switched on. The key is a SecureString
    # a human creates (infra/README.md), covered by the module's SSM read policy.
    # Model, daily cap and timeouts keep their defaults in code.
    var.llm_allocator_enabled ? {
      LLM_ALLOCATOR_ENABLED       = "true"
      ANTHROPIC_API_KEY_SSM_PARAM = "${local.ssm_prefix}/anthropic-api-key"
    } : {},
  )
}

module "http_api" {
  source = "../modules/http-api"

  name                 = "${local.name_prefix}-api"
  lambda_function_name = module.api.function_name
  lambda_invoke_arn    = module.api.invoke_arn
}

# Production's own spend, by the environment tag every resource here carries
# (default_tags). The tag must be activated as a cost allocation tag in Billing
# before the filter sees anything; see infra/README.md.
module "budget" {
  source = "../modules/budget"

  providers = {
    aws = aws.us_east_1
  }

  name        = "${local.name_prefix}-monthly"
  limit_usd   = "5"
  environment = "production"
  email       = var.budget_email
}
