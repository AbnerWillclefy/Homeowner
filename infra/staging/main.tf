locals {
  name_prefix = "homeowner-staging"
  ssm_prefix  = "/homeowner/staging"
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      project     = "homeowner"
      environment = "staging"
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

# One free-tier project; staging is a branch of it. A future infra/production
# folder should reference this project's id rather than create a second one.
resource "neon_project" "this" {
  name       = "homeowner"
  org_id     = var.neon_org_id
  pg_version = 16
  region_id  = var.neon_region_id

  # The free plan allows at most 6 hours of history; the provider defaults to 24.
  history_retention_seconds = 21600
}

module "database" {
  source = "../modules/neon-branch"

  project_id      = neon_project.this.id
  branch_name     = "staging"
  role_name       = "homeowner_staging"
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

  name            = "${local.name_prefix}-api"
  image_tag       = var.image_tag
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

module "http_api" {
  source = "../modules/http-api"

  name                 = "${local.name_prefix}-api"
  lambda_function_name = module.api.function_name
  lambda_invoke_arn    = module.api.invoke_arn
}

module "budget" {
  source = "../modules/budget"

  providers = {
    aws = aws.us_east_1
  }

  name  = "homeowner-account-monthly"
  email = var.budget_email
}
