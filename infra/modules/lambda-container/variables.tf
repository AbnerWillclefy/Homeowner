variable "name" {
  description = "Name of the function, the ECR repository, the role and the log group."
  type        = string
}

variable "image_tag" {
  description = "Tag of the image in the repository to run (the git SHA). Tags are immutable, so a new SHA is what makes Lambda pick up new code."
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

variable "invoke_function_arns" {
  description = "ARNs of Lambda functions this function may invoke (lambda:InvokeFunction on exactly these, nothing broader). Empty adds no statement."
  type        = list(string)
  default     = []
}

variable "memory_size" {
  type    = number
  default = 512
}

variable "timeout" {
  type    = number
  default = 15
}

variable "log_retention_days" {
  type    = number
  default = 14
}

variable "keep_images" {
  description = "How many images the repository keeps."
  type        = number
  default     = 5
}
