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
