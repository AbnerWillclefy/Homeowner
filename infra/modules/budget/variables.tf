variable "name" {
  description = "Budget name. Without an environment it covers the whole AWS account (staging and production share it), so name it accordingly."
  type        = string
}

variable "limit_usd" {
  type    = string
  default = "5"
}

variable "environment" {
  description = "Value of the environment cost allocation tag to budget for, for example production. Null covers the whole account."
  type        = string
  default     = null
}

variable "email" {
  description = "Address that receives the alerts."
  type        = string
  sensitive   = true
}
