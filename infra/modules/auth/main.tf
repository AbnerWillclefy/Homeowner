terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

data "aws_region" "current" {}

# The user pool: the directory of Users. No domain, no hosted UI and no
# identity pool; the PWA calls the Cognito public API with its own forms.
resource "aws_cognito_user_pool" "this" {
  name = var.name

  # People sign in with their email. Changing username_attributes (or adding
  # schema attributes) later forces a NEW pool and deletes its users: read
  # `terraform plan` for any "replace" before applying.
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  # A replace is a deliberate act: switch this to INACTIVE first.
  deletion_protection = "ACTIVE"

  mfa_configuration = "OFF"

  password_policy {
    minimum_length                   = 10
    require_lowercase                = true
    require_numbers                  = true
    require_symbols                  = false
    require_uppercase                = true
    temporary_password_validity_days = 7
  }

  # The default sender is free and sends about 50 emails a day, which is
  # enough for staging. It may land in spam; production should use SES.
  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  verification_message_template {
    default_email_option = "CONFIRM_WITH_CODE"
  }
}

# The super admin role (ADR 0017). The API reads this group from the ID token's
# cognito:groups claim. Membership is a manual step with the AWS CLI (see
# docs/development.md), so no code or config names a person.
resource "aws_cognito_user_group" "super_admin" {
  name         = "super-admin"
  user_pool_id = aws_cognito_user_pool.this.id
  description  = "The maintainer: may call the API's /admin/ routes. Granted by hand."
}

# The app client for the PWA. A browser cannot keep a secret, so there is none.
resource "aws_cognito_user_pool_client" "web" {
  name         = "${var.name}-web"
  user_pool_id = aws_cognito_user_pool.this.id

  generate_secret = false

  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
  ]

  prevent_user_existence_errors = "ENABLED"
  enable_token_revocation       = true

  id_token_validity      = 60
  access_token_validity  = 60
  refresh_token_validity = 30

  token_validity_units {
    id_token      = "minutes"
    access_token  = "minutes"
    refresh_token = "days"
  }
}
