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
  pg_version = 16
  region_id  = var.neon_region_id
}

module "database" {
  source = "../modules/neon-branch"

  project_id      = neon_project.this.id
  branch_name     = "staging"
  role_name       = "homeowner_staging"
  database_name   = "homeowner"
  ssm_path_prefix = local.ssm_prefix
}

module "api" {
  source = "../modules/lambda-container"

  name            = "${local.name_prefix}-api"
  image_tag       = var.image_tag
  ssm_path_prefix = local.ssm_prefix

  environment = {
    PORT                           = "8080"
    DB_MAX_CONNS                   = "2"
    CORS_ALLOWED_ORIGINS           = var.cors_allowed_origins
    DATABASE_URL_SSM_PARAM         = module.database.database_url_param
    MIGRATE_DATABASE_URL_SSM_PARAM = module.database.migrate_database_url_param
  }
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
