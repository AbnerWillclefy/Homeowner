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
