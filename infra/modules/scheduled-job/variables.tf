variable "name" {
  description = "Name of the function, the role, the log group and the schedule rule."
  type        = string
}

variable "description" {
  description = "What the schedule is for."
  type        = string
  default     = ""
}

variable "image_uri" {
  description = "Full image URI to run, repository and immutable tag. Normally the API's image."
  type        = string
}

variable "command" {
  description = "Arguments passed to the image's entrypoint, for example [\"events\"]."
  type        = list(string)
}

variable "schedule_expression" {
  description = "EventBridge schedule, for example rate(15 minutes)."
  type        = string
}

variable "ssm_path_prefix" {
  description = "SSM path prefix (for example /homeowner/staging) the function may read, and nothing else."
  type        = string
}

variable "environment" {
  description = "Environment variables of the function. Never put secrets here; pass SSM parameter names."
  type        = map(string)
  default     = {}
}

variable "memory_size" {
  type    = number
  default = 256
}

variable "timeout" {
  type    = number
  default = 60
}

variable "log_retention_days" {
  type    = number
  default = 14
}
