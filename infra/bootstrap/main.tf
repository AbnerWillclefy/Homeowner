terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

# Applied once by a human with local state (see infra/README.md). It creates
# what the other folders need before they can run: the state bucket, the GitHub
# OIDC provider and the role GitHub Actions assumes.

provider "aws" {
  region = var.aws_region
}

variable "aws_region" {
  description = "Region for the state bucket and the staging resources."
  type        = string
}

variable "github_repo" {
  description = "owner/name of the repository allowed to assume the deploy role."
  type        = string
  default     = "AbnerWillclefy/Homeowner"
}

data "aws_caller_identity" "current" {}

locals {
  account_id   = data.aws_caller_identity.current.account_id
  state_bucket = "homeowner-tfstate-${local.account_id}"
}

# ---------------------------------------------------------------- state bucket

resource "aws_s3_bucket" "state" {
  bucket = local.state_bucket
}

resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "state" {
  bucket                  = aws_s3_bucket.state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

data "aws_iam_policy_document" "state_tls_only" {
  statement {
    sid       = "DenyInsecureTransport"
    effect    = "Deny"
    actions   = ["s3:*"]
    resources = [aws_s3_bucket.state.arn, "${aws_s3_bucket.state.arn}/*"]

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "state" {
  bucket = aws_s3_bucket.state.id
  policy = data.aws_iam_policy_document.state_tls_only.json

  depends_on = [aws_s3_bucket_public_access_block.state]
}

# ------------------------------------------------------- GitHub OIDC and role

resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
}

# Only workflow runs on main may assume the role. Pull requests never get AWS
# credentials.
data "aws_iam_policy_document" "deploy_trust" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_repo}:ref:refs/heads/main"]
    }
  }
}

# The role name deliberately does not start with "homeowner-staging-", so the
# IAM permissions below (limited to that prefix) never let it edit itself.
resource "aws_iam_role" "deploy_staging" {
  name                 = "homeowner-github-deploy-staging"
  assume_role_policy   = data.aws_iam_policy_document.deploy_trust.json
  max_session_duration = 3600
}

data "aws_iam_policy_document" "deploy_staging" {
  # Terraform state.
  statement {
    sid       = "StateBucketList"
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.state.arn]
  }

  statement {
    sid       = "StateObjects"
    actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
    resources = ["${aws_s3_bucket.state.arn}/staging/*"]
  }

  # ECR: the repositories Terraform manages, plus the login token.
  statement {
    sid       = "EcrToken"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    sid       = "EcrRepositories"
    actions   = ["ecr:*"]
    resources = ["arn:aws:ecr:${var.aws_region}:${local.account_id}:repository/homeowner-staging-*"]
  }

  # Lambda functions.
  statement {
    sid       = "LambdaFunctions"
    actions   = ["lambda:*"]
    resources = ["arn:aws:lambda:${var.aws_region}:${local.account_id}:function:homeowner-staging-*"]
  }

  # API Gateway HTTP APIs. API ids are generated, so this cannot be narrowed
  # by name; it is limited to API Gateway v2 resources in this region.
  statement {
    sid = "ApiGateway"
    actions = [
      "apigateway:GET", "apigateway:POST", "apigateway:PUT",
      "apigateway:PATCH", "apigateway:DELETE", "apigateway:TagResource",
    ]
    resources = [
      "arn:aws:apigateway:${var.aws_region}::/apis",
      "arn:aws:apigateway:${var.aws_region}::/apis/*",
      "arn:aws:apigateway:${var.aws_region}::/tags/*",
    ]
  }

  # CloudWatch log groups of the staging functions.
  statement {
    sid       = "LogGroups"
    actions   = ["logs:*"]
    resources = ["arn:aws:logs:${var.aws_region}:${local.account_id}:log-group:/aws/lambda/homeowner-staging-*:*"]
  }

  statement {
    sid       = "LogGroupsDescribe"
    actions   = ["logs:DescribeLogGroups", "logs:ListTagsForResource"]
    resources = ["*"]
  }

  # SSM parameters under the staging path only.
  statement {
    sid       = "SsmStagingParameters"
    actions   = ["ssm:*"]
    resources = ["arn:aws:ssm:${var.aws_region}:${local.account_id}:parameter/homeowner/staging/*"]
  }

  statement {
    sid       = "SsmDescribe"
    actions   = ["ssm:DescribeParameters"]
    resources = ["*"]
  }

  # IAM only for roles prefixed homeowner-staging-.
  statement {
    sid = "IamStagingRoles"
    actions = [
      "iam:CreateRole", "iam:DeleteRole", "iam:GetRole", "iam:UpdateRole",
      "iam:UpdateAssumeRolePolicy", "iam:TagRole", "iam:UntagRole",
      "iam:PutRolePolicy", "iam:GetRolePolicy", "iam:DeleteRolePolicy",
      "iam:ListRolePolicies", "iam:ListAttachedRolePolicies",
      "iam:ListInstanceProfilesForRole", "iam:PassRole",
    ]
    resources = ["arn:aws:iam::${local.account_id}:role/homeowner-staging-*"]
  }

  # The account-wide budget. Budgets is a global service (us-east-1 endpoint).
  statement {
    sid       = "Budgets"
    actions   = ["budgets:*"]
    resources = ["arn:aws:budgets::${local.account_id}:budget/homeowner-*"]
  }

  statement {
    sid       = "BudgetsList"
    actions   = ["budgets:ViewBudget", "budgets:DescribeBudgets"]
    resources = ["*"]
  }

  # Read-only lookups Terraform and the workflow make.
  statement {
    sid       = "Identity"
    actions   = ["sts:GetCallerIdentity"]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "deploy_staging" {
  name   = "deploy-staging"
  role   = aws_iam_role.deploy_staging.id
  policy = data.aws_iam_policy_document.deploy_staging.json
}

# --------------------------------------------------------------------- outputs

output "state_bucket" {
  value = aws_s3_bucket.state.bucket
}

output "deploy_role_arn" {
  description = "Set as the GitHub variable AWS_DEPLOY_ROLE_ARN."
  value       = aws_iam_role.deploy_staging.arn
}
