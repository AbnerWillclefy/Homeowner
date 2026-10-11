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
  description = "Comma-separated browser origins allowed to call the API. Empty until the web app has a domain (#6)."
  type        = string
  default     = ""
}

variable "neon_region_id" {
  description = "Neon region of the project."
  type        = string
  default     = "aws-us-east-2"
}
