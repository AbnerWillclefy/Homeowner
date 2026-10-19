variable "bucket_name" {
  description = "Name of the private photo bucket. Bucket names are global, so include the account id (homeowner-<env>-photos-<account id>)."
  type        = string
}

variable "allowed_origin" {
  description = "The web origin (https://<domain>) that may PUT uploads straight to the bucket. CORS allows exactly this origin."
  type        = string
}

variable "distribution_arn" {
  description = "ARN of the web CloudFront distribution, the only reader of the bucket."
  type        = string
}
