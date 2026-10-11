variable "name" {
  description = "Budget name. It covers the whole AWS account (staging and production share it), so name it accordingly."
  type        = string
}

variable "limit_usd" {
  type    = string
  default = "5"
}

variable "email" {
  description = "Address that receives the alerts."
  type        = string
  sensitive   = true
}
