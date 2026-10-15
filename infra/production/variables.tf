variable "aws_region" {
  description = "Region of the production resources."
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
  description = "Extra comma-separated browser origins allowed to call the API, for example http://localhost:5173. The production CloudFront origin is always added."
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

variable "vapid_public_key" {
  description = "Public VAPID key for Web Push (TF_VAR_vapid_public_key, from the VAPID_PUBLIC_KEY repository variable). Empty disables push. The private key lives only in SSM, never in Terraform; see infra/README.md."
  type        = string
  default     = ""
}

variable "llm_allocator_enabled" {
  description = "Let the daily Allocation ask the LLM allocator first (TF_VAR_llm_allocator_enabled, from the LLM_ALLOCATOR_ENABLED repository variable). Needs the anthropic-api-key SSM parameter; see infra/README.md."
  type        = bool
  default     = false
}

variable "vapid_subject" {
  description = "Contact the push services can reach, mailto: or https: (TF_VAR_vapid_subject, from the VAPID_SUBJECT repository variable). Required when vapid_public_key is set."
  type        = string
  default     = ""

  validation {
    condition     = var.vapid_public_key == "" || var.vapid_subject != ""
    error_message = "vapid_subject is required when vapid_public_key is set."
  }
}
