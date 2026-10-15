# The bucket (homeowner-tfstate-<account id>, created by infra/bootstrap) and
# region are passed at init time so no account id is committed:
#   terraform init -backend-config="bucket=..." -backend-config="region=..."
terraform {
  backend "s3" {
    key          = "production/terraform.tfstate"
    use_lockfile = true
    encrypt      = true
  }
}
