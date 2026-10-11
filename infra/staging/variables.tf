variable "aws_region" {
  description = "Region of the staging resources."
  type        = string
}

variable "image_tag" {
  description = "Git SHA of the API image in ECR."
  type        = string
}

variable "budget_email" {
  description = "Address for the account-wide AWS Budget alerts (TF_VAR_budget_email, from the BUDGET_EMAIL secret)."
  type        = string
  sensitive   = true
}

variable "cors_allowed_origins" {
  description = "Extra comma-separated browser origins allowed to call the API, for example http://localhost:5173. The staging CloudFront origin is always added."
  type        = string
  default     = ""
}

variable "neon_region_id" {
  description = "Neon region of the project, next to the Lambda in us-east-1."
  type        = string
  default     = "aws-us-east-1"
}

variable "neon_org_id" {
  description = "Neon organisation that owns the project (TF_VAR_neon_org_id, from the NEON_ORG_ID repository variable). Accounts created since Neon introduced organisations cannot create projects without it."
  type        = string
}
