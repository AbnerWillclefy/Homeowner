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
  description = "Region for the state bucket and both environments."
  type        = string
}

variable "github_repo" {
  description = "Repository allowed to assume the deploy role, as GitHub writes it in the OIDC subject: owner@owner-id/name@repo-id (from gh api repos/OWNER/NAME, fields owner.id and id). The numeric ids stop a deleted and re-created repository with the same name from inheriting the role."
  type        = string
  default     = "AbnerWillclefy@81093119/Homeowner@1413384133"
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

# One deploy role per environment, each assumable only from its own branch:
# staging from main, production from the production branch. Pull requests never
# get AWS credentials.
locals {
  deploy_environments = {
    staging    = "refs/heads/main"
    production = "refs/heads/production"
  }
}

data "aws_iam_policy_document" "deploy_trust" {
  for_each = local.deploy_environments

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
      values   = ["repo:${var.github_repo}:ref:${each.value}"]
    }
  }
}

# The role name deliberately does not start with "homeowner-<environment>-", so
# the IAM permissions below (limited to that prefix) never let it edit itself.
resource "aws_iam_role" "deploy" {
  for_each = local.deploy_environments

  name                 = "homeowner-github-deploy-${each.key}"
  assume_role_policy   = data.aws_iam_policy_document.deploy_trust[each.key].json
  max_session_duration = 3600
}

data "aws_iam_policy_document" "deploy" {
  for_each = local.deploy_environments

  # Terraform state.
  statement {
    sid       = "StateBucketList"
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.state.arn]
  }

  statement {
    sid       = "StateObjects"
    actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
    resources = ["${aws_s3_bucket.state.arn}/${each.key}/*"]
  }

  # ECR: the repositories Terraform manages, plus the login token.
  statement {
    sid       = "EcrToken"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  # The image build pulls the Lambda Web Adapter from ECR Public. Anonymous
  # pulls are capped per source IP, which shared GitHub runners often exhaust
  # (429 "Data limit exceeded"), so the deploy logs in first.
  statement {
    sid       = "EcrPublicToken"
    actions   = ["ecr-public:GetAuthorizationToken", "sts:GetServiceBearerToken"]
    resources = ["*"]
  }

  statement {
    sid       = "EcrRepositories"
    actions   = ["ecr:*"]
    resources = ["arn:aws:ecr:${var.aws_region}:${local.account_id}:repository/homeowner-${each.key}-*"]
  }

  # Lambda functions.
  statement {
    sid       = "LambdaFunctions"
    actions   = ["lambda:*"]
    resources = ["arn:aws:lambda:${var.aws_region}:${local.account_id}:function:homeowner-${each.key}-*"]
  }

  # EventBridge rules of the scheduled jobs (#13), named homeowner-<environment>-*
  # on the default event bus.
  statement {
    sid       = "EventBridgeRules"
    actions   = ["events:*"]
    resources = ["arn:aws:events:${var.aws_region}:${local.account_id}:rule/homeowner-${each.key}-*"]
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

  # The environment's web bucket: Terraform manages it, the web job syncs into it.
  statement {
    sid = "WebBucketManage"
    actions = [
      "s3:CreateBucket", "s3:DeleteBucket", "s3:ListBucket",
      "s3:GetBucketLocation", "s3:GetBucketTagging", "s3:PutBucketTagging",
      "s3:GetBucketPolicy", "s3:PutBucketPolicy", "s3:DeleteBucketPolicy",
      "s3:GetBucketPublicAccessBlock", "s3:PutBucketPublicAccessBlock",
      "s3:GetEncryptionConfiguration", "s3:PutEncryptionConfiguration",
      "s3:GetLifecycleConfiguration", "s3:PutLifecycleConfiguration",
      "s3:GetBucketVersioning", "s3:GetBucketAcl", "s3:GetBucketCORS",
      "s3:GetBucketWebsite", "s3:GetBucketLogging", "s3:GetBucketObjectLockConfiguration",
      "s3:GetAccelerateConfiguration", "s3:GetBucketRequestPayment",
      "s3:GetReplicationConfiguration", "s3:GetBucketOwnershipControls",
    ]
    resources = ["arn:aws:s3:::homeowner-${each.key}-web-*"]
  }

  statement {
    sid       = "WebBucketObjects"
    actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
    resources = ["arn:aws:s3:::homeowner-${each.key}-web-*/*"]
  }

  # CloudFront ids are generated, so distributions and access controls cannot
  # be scoped by name, only by type.
  statement {
    sid = "CloudFrontDistributions"
    actions = [
      "cloudfront:CreateDistribution", "cloudfront:GetDistribution",
      "cloudfront:GetDistributionConfig", "cloudfront:UpdateDistribution",
      "cloudfront:DeleteDistribution", "cloudfront:TagResource",
      "cloudfront:UntagResource", "cloudfront:ListTagsForResource",
      "cloudfront:CreateInvalidation", "cloudfront:GetInvalidation",
      "cloudfront:ListInvalidations",
    ]
    resources = ["arn:aws:cloudfront::${local.account_id}:distribution/*"]
  }

  statement {
    sid = "CloudFrontAccessControls"
    actions = [
      "cloudfront:CreateOriginAccessControl", "cloudfront:GetOriginAccessControl",
      "cloudfront:GetOriginAccessControlConfig", "cloudfront:UpdateOriginAccessControl",
      "cloudfront:DeleteOriginAccessControl",
    ]
    resources = ["arn:aws:cloudfront::${local.account_id}:origin-access-control/*"]
  }

  # Actions without resource-level permissions, and the managed policies the
  # web module looks up by name.
  statement {
    sid = "CloudFrontListAndPolicies"
    actions = [
      "cloudfront:ListDistributions", "cloudfront:ListOriginAccessControls",
      "cloudfront:GetCachePolicy", "cloudfront:ListCachePolicies",
      "cloudfront:GetResponseHeadersPolicy", "cloudfront:ListResponseHeadersPolicies",
    ]
    resources = ["*"]
  }

  # CloudWatch log groups of the environment's functions.
  statement {
    sid       = "LogGroups"
    actions   = ["logs:*"]
    resources = ["arn:aws:logs:${var.aws_region}:${local.account_id}:log-group:/aws/lambda/homeowner-${each.key}-*:*"]
  }

  statement {
    sid       = "LogGroupsDescribe"
    actions   = ["logs:DescribeLogGroups", "logs:ListTagsForResource"]
    resources = ["*"]
  }

  # SSM parameters under the environment's path only.
  statement {
    sid       = "Ssm${title(each.key)}Parameters"
    actions   = ["ssm:*"]
    resources = ["arn:aws:ssm:${var.aws_region}:${local.account_id}:parameter/homeowner/${each.key}/*"]
  }

  statement {
    sid       = "SsmDescribe"
    actions   = ["ssm:DescribeParameters"]
    resources = ["*"]
  }

  # Cognito user pools (#8). Pool ids are generated, so this cannot be scoped
  # by name, only to user pools of this account and region.
  statement {
    sid       = "CognitoUserPools"
    actions   = ["cognito-idp:*"]
    resources = ["arn:aws:cognito-idp:${var.aws_region}:${local.account_id}:userpool/*"]
  }

  # CreateUserPool has no pool yet to name, so Terraform cannot be limited to
  # one; the provider also lists pools. Both need "*".
  statement {
    sid       = "CognitoUserPoolsList"
    actions   = ["cognito-idp:CreateUserPool", "cognito-idp:ListUserPools", "cognito-idp:DescribeUserPool"]
    resources = ["*"]
  }

  # IAM only for roles prefixed homeowner-<environment>-.
  statement {
    sid = "Iam${title(each.key)}Roles"
    actions = [
      "iam:CreateRole", "iam:DeleteRole", "iam:GetRole", "iam:UpdateRole",
      "iam:UpdateAssumeRolePolicy", "iam:TagRole", "iam:UntagRole",
      "iam:PutRolePolicy", "iam:GetRolePolicy", "iam:DeleteRolePolicy",
      "iam:ListRolePolicies", "iam:ListAttachedRolePolicies",
      "iam:ListInstanceProfilesForRole", "iam:PassRole",
    ]
    resources = ["arn:aws:iam::${local.account_id}:role/homeowner-${each.key}-*"]
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

resource "aws_iam_role_policy" "deploy" {
  for_each = local.deploy_environments

  name   = "deploy-${each.key}"
  role   = aws_iam_role.deploy[each.key].id
  policy = data.aws_iam_policy_document.deploy[each.key].json
}

# The staging role existed before the loop; these keep it in place instead of
# destroying and recreating it under its new address.
moved {
  from = aws_iam_role.deploy_staging
  to   = aws_iam_role.deploy["staging"]
}

moved {
  from = aws_iam_role_policy.deploy_staging
  to   = aws_iam_role_policy.deploy["staging"]
}

# --------------------------------------------------------------------- outputs

output "state_bucket" {
  value = aws_s3_bucket.state.bucket
}

output "deploy_role_arns" {
  description = "Set staging's as the GitHub variable AWS_DEPLOY_ROLE_ARN and production's as PRODUCTION_AWS_DEPLOY_ROLE_ARN."
  value       = { for environment, role in aws_iam_role.deploy : environment => role.arn }
}
