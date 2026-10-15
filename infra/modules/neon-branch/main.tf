terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    neon = {
      source  = "kislerdm/neon"
      version = "~> 0.9"
    }
  }
}

resource "neon_branch" "this" {
  project_id = var.project_id
  name       = var.branch_name
}

# Default scale-to-zero (suspend after inactivity) keeps the idle cost at zero.
resource "neon_endpoint" "this" {
  project_id = var.project_id
  branch_id  = neon_branch.this.id
  type       = "read_write"
}

resource "neon_role" "this" {
  project_id = var.project_id
  branch_id  = neon_branch.this.id
  name       = var.role_name

  # Neon creates roles through the branch's read-write endpoint and answers 404
  # ("no read-write endpoint for branch") without one. Nothing here references
  # the endpoint, so without this both are created in parallel.
  depends_on = [neon_endpoint.this]
}

resource "neon_database" "this" {
  project_id = var.project_id
  branch_id  = neon_branch.this.id
  name       = var.database_name
  owner_name = neon_role.this.name
}

locals {
  # Neon pooled hosts are the endpoint host with "-pooler" appended to the
  # first label (the provider does not expose both URIs for a non-default
  # branch). The direct host is used for migrations.
  direct_host = neon_endpoint.this.host
  pooled_host = replace(neon_endpoint.this.host, "/^([^.]+)/", "$1-pooler")

  credentials = "${neon_role.this.name}:${urlencode(neon_role.this.password)}"
  database    = neon_database.this.name

  direct_url = "postgres://${local.credentials}@${local.direct_host}/${local.database}?sslmode=require"
  # The pooled endpoint is PgBouncer in transaction mode, where pgx's default
  # prepared-statement cache can fail; describe-only caching is safe there.
  pooled_url = "postgres://${local.credentials}@${local.pooled_host}/${local.database}?sslmode=require&default_query_exec_mode=cache_describe"
}

# SecureString on the default aws/ssm key (a customer-managed key costs
# $1/month). The values also sit in Terraform state; see infra/README.md.
resource "aws_ssm_parameter" "database_url" {
  name  = "${var.ssm_path_prefix}/database-url"
  type  = "SecureString"
  tier  = "Standard"
  value = local.pooled_url
}

resource "aws_ssm_parameter" "migrate_database_url" {
  name  = "${var.ssm_path_prefix}/migrate-database-url"
  type  = "SecureString"
  tier  = "Standard"
  value = local.direct_url
}
